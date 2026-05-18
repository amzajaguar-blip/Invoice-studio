import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, getCurrentOrgId } from "@/lib/supabase/server";

// ─── Validation schemas ──────────────────────────────────────────────────────

const itemBodySchema = z.object({
  description: z.string().min(1),
  quantity: z.number().min(1),
  unit_price: z.number().min(0),
  tax_rate: z.number().min(0).max(100).optional(),
});

const createInvoiceBodySchema = z.object({
  client_id: z.string().uuid(),
  currency: z.enum(["EUR", "USD", "GBP", "CHF"]).default("EUR"),
  items: z.array(itemBodySchema).min(1),
  issue_date: z.string().optional(),
  due_date: z.string().optional(),
  tax_rate: z.number().min(0).max(100).default(22),
  withholding_tax_rate: z.number().min(0).max(100).default(0),
  notes: z.string().nullable().optional(),
});

// ─── GET /api/invoices ────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const supabase = await createClient();
  const orgId = await getCurrentOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const from = (page - 1) * limit;

  let query = supabase
    .from("invoices")
    .select("*, clients(name, email), invoice_items(*)", { count: "exact" })
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (search) {
    query = query.or(`number.ilike.%${search}%,clients.name.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("GET /api/invoices error:", error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data, total: count ?? 0, page, limit });
}

// ─── POST /api/invoices ───────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: authUser } = await supabase.auth.getUser();
  const orgId = await getCurrentOrgId();

  if (!authUser.user || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Zod validation
  const parsed = createInvoiceBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { client_id, currency, items: bodyItems, issue_date, due_date, tax_rate, withholding_tax_rate, notes } = parsed.data;

  const issueDate = issue_date || new Date().toISOString().slice(0, 10);
  const dueDate = due_date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const taxRate = tax_rate;
  const withholdingTaxRate = withholding_tax_rate;

  // Compute totals — Italian tax law: ritenuta d'acconto applies to pre-VAT subtotal only
  const subtotal = bodyItems.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );
  const vatAmount = subtotal * (taxRate / 100);
  const withholdingAmount = subtotal * (withholdingTaxRate / 100);
  const total = subtotal + vatAmount - withholdingAmount;

  // Generate invoice number with retry on race condition
  const year = new Date().getFullYear();
  const MAX_RETRIES = 3;
  let invoice: { id: string; number: string } | null = null;
  let invError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data: lastInvoice } = await supabase
      .from("invoices")
      .select("number")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastNum = lastInvoice ? parseInt(lastInvoice.number.split("-").pop() || "0") : 0;
    const number = `INV-${year}-${String(lastNum + 1).padStart(3, "0")}`;

    const result = await supabase
      .from("invoices")
      .insert({
        org_id: orgId,
        client_id,
        number,
        status: "draft",
        issue_date: issueDate,
        due_date: dueDate,
        subtotal,
        tax_rate: taxRate,
        withholding_tax_rate: withholdingTaxRate,
        total,
        currency,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (result.error) {
      // Retry on unique constraint violation (race condition)
      if (result.error.code === "23505") {
        invError = result.error;
        continue;
      }
      console.error("POST /api/invoices insert error:", result.error);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "production" ? "Internal server error" : result.error.message },
        { status: 500 }
      );
    }

    invoice = result.data;
    invError = null;
    break;
  }

  if (invError || !invoice) {
    return NextResponse.json({ error: "Failed to generate unique invoice number after retries" }, { status: 409 });
  }

  // Create line items
  const lineItems = bodyItems.map((item) => ({
    invoice_id: invoice.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    tax_rate: item.tax_rate ?? taxRate,
  }));

  const { error: itemsError } = await supabase.from("invoice_items").insert(lineItems);

  if (itemsError) {
    // Rollback invoice creation
    await supabase.from("invoices").delete().eq("id", invoice.id);
    console.error("POST /api/invoices items error:", itemsError);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Internal server error" : itemsError.message },
      { status: 500 }
    );
  }

  // Log event
  await supabase.from("invoice_events").insert({
    invoice_id: invoice.id,
    event_type: "created",
  });

  return NextResponse.json({ data: invoice }, { status: 201 });
}
