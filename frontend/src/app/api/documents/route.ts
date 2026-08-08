import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest } from "@/lib/supabase/auth-helper";
import { getUserQuota, consumeRewardedCredit } from "@/lib/plan";
import { audit } from "@/lib/audit";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

// ─── Types ──────────────────────────────────────────────────────────────────

const VALID_DOCUMENT_TYPES = ["invoice", "quote", "contract", "letter", "report", "custom"] as const;
type DocumentType = (typeof VALID_DOCUMENT_TYPES)[number];

// ─── Validation schemas ──────────────────────────────────────────────────────

const itemBodySchema = z.object({
  description: z.string().min(1),
  quantity: z.number().min(1),
  unit_price: z.number().min(0),
  tax_rate: z.number().min(0).max(100).optional(),
});

const createDocumentBodySchema = z.object({
  document_type: z.enum(VALID_DOCUMENT_TYPES).default("invoice"),
  client_id: z.string().uuid(),
  currency: z.enum(["EUR", "USD", "GBP", "CHF"]).default("EUR"),
  items: z.array(itemBodySchema).min(1),
  issue_date: z.string().optional(),
  due_date: z.string().optional(),
  valid_until: z.string().optional(),
  tax_rate: z.number().min(0).max(100).default(22),
  withholding_tax_rate: z.number().min(0).max(100).default(0),
  notes: z.string().nullable().optional(),
  payment_terms: z.string().nullable().optional(),
  // Custom document fields
  title: z.string().optional(),
  body_markdown: z.string().optional(),
});

// ─── GET /api/documents ─────────────────────────────────────────────────────

export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, orgId } = auth;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const document_type = searchParams.get("document_type");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const from = (page - 1) * limit;

  let query = supabase
    .from("documents")
    .select("*, clients(name, email), document_items(*)", { count: "exact" })
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (document_type && document_type !== "all") {
    query = query.eq("document_type", document_type);
  }

  if (search) {
    query = query.or(`number.ilike.%${search}%,clients.name.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("GET /api/documents error:", error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data, total: count ?? 0, page, limit });
}

// ─── POST /api/documents ────────────────────────────────────────────────────

export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, user, orgId } = auth;

  // ─── Plan limit enforcement ────────────────────────────────────────────

  const quota = await getUserQuota(orgId);
  if (!quota.canCreateInvoice) {
    return NextResponse.json(
      {
        error: "Limite documenti raggiunto",
        quota,
        code: quota.reason === "max_credits_reached" ? "PLAN_LIMIT_HARD" : "PLAN_LIMIT",
      },
      { status: 402 }
    );
  }

  // Rate limiting
  const rateKey = getRateLimitKey(request, user.id);
  const { allowed } = rateLimit(`document-create:${rateKey}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Troppe richieste. Riprova tra qualche secondo." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const parsed = createDocumentBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    document_type, client_id, currency, items: bodyItems,
    issue_date, due_date, valid_until, tax_rate, withholding_tax_rate,
    notes, payment_terms, title, body_markdown,
  } = parsed.data;

  const issueDate = issue_date || new Date().toISOString().slice(0, 10);
  const dueDate = due_date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const taxRate = tax_rate;
  const withholdingTaxRate = withholding_tax_rate;

  // Compute totals
  const subtotal = bodyItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const vatAmount = subtotal * (taxRate / 100);
  const withholdingAmount = subtotal * (withholdingTaxRate / 100);
  const total = subtotal + vatAmount - withholdingAmount;

  // Generate document number
  const year = new Date().getFullYear();
  const prefix = document_type === "invoice" ? "INV" : document_type === "quote" ? "Q" : "DOC";
  const MAX_RETRIES = 3;
  let document: { id: string; number: string } | null = null;
  let docError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data: lastDoc } = await supabase
      .from("documents")
      .select("number")
      .eq("org_id", orgId)
      .eq("document_type", document_type)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastNum = lastDoc ? parseInt(lastDoc.number.split("-").pop() || "0") : 0;
    const number = `${prefix}-${year}-${String(lastNum + 1).padStart(3, "0")}`;

    const result = await supabase
      .from("documents")
      .insert({
        org_id: orgId,
        document_type,
        client_id,
        number,
        status: "draft",
        issue_date: issueDate,
        due_date: dueDate,
        valid_until: valid_until || null,
        subtotal,
        tax_rate: taxRate,
        tax_amount: vatAmount,
        discount_amount: 0,
        withholding_tax_rate: withholdingTaxRate,
        total,
        currency,
        notes: notes ?? title ?? null,
        payment_terms: payment_terms ?? null,
      })
      .select()
      .single();

    if (result.error) {
      if (result.error.code === "23505") {
        docError = result.error;
        continue;
      }
      console.error("POST /api/documents insert error:", result.error);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "production" ? "Internal server error" : result.error.message },
        { status: 500 }
      );
    }

    document = result.data;
    docError = null;
    break;
  }

  if (docError || !document) {
    return NextResponse.json({ error: "Failed to generate unique document number after retries" }, { status: 409 });
  }

  // Create line items
  const lineItems = bodyItems.map((item) => ({
    document_id: document!.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    tax_rate: item.tax_rate ?? taxRate,
  }));

  const { error: itemsError } = await supabase.from("document_items").insert(lineItems);

  if (itemsError) {
    await supabase.from("documents").delete().eq("id", document.id);
    console.error("POST /api/documents items error:", itemsError);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Internal server error" : itemsError.message },
      { status: 500 }
    );
  }

  // Audit log
  await audit({
    orgId,
    userId: user.id,
    action: "document.created",
    entityType: "document",
    entityId: document.id,
  });

  // Consume rewarded credit if applicable
  let creditConsumed = false;
  let remainingCredits = quota.rewardedCredits;

  if (!quota.unlimited && quota.currentMonthInvoices >= quota.planLimit) {
    const result = await consumeRewardedCredit(orgId, document.id);
    creditConsumed = result.consumed;
    remainingCredits = result.remainingCredits;
  }

  return NextResponse.json(
    {
      data: document,
      quota: {
        ...quota,
        rewardedCredits: remainingCredits,
        creditConsumed,
      },
    },
    { status: 201 }
  );
}
