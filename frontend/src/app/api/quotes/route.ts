import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest } from "@/lib/supabase/auth-helper";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

// ─── Validation schemas ──────────────────────────────────────────────────────

const itemBodySchema = z.object({
  description: z.string().min(1),
  quantity: z.number().min(1),
  unit_price: z.number().min(0),
  tax_rate: z.number().min(0).max(100).optional(),
});

const createQuoteBodySchema = z.object({
  client_id: z.string().uuid(),
  currency: z.enum(["EUR", "USD", "GBP", "CHF"]).default("EUR"),
  items: z.array(itemBodySchema).min(1),
  issue_date: z.string().optional(),
  due_date: z.string().optional(),
  tax_rate: z.number().min(0).max(100).default(22),
  notes: z.string().nullable().optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getNextMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year, month, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

async function getPlanState(supabase: any, orgId: string) {
  const monthKey = getMonthKey();
  const { data: row, error } = await supabase
    .from("user_plan")
    .select("plan, quotes_limit, quotes_used, period_start")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !row) {
    return { isPremium: false, canCreate: false, row: null };
  }

  // Reset monthly counters if needed
  if (row.period_start && row.period_start < monthKey) {
    await supabase
      .from("user_plan")
      .update({
        quotes_used: 0,
        period_start: monthKey,
      })
      .eq("org_id", orgId);
    row.quotes_used = 0;
  }

  const isPremium = row.plan === "premium";
  const limit = row.quotes_limit ?? 3;
  const used = row.quotes_used ?? 0;

  return {
    isPremium,
    canCreate: isPremium || used < limit,
    row,
  };
}

// ─── GET /api/quotes ────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, orgId } = auth;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const page = parseInt(searchParams.get("page") || "1");
  const from = (page - 1) * limit;

  let query = supabase
    .from("quotes")
    .select("*, clients(name, email), quote_items(*)", { count: "exact" })
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("GET /api/quotes error:", error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data, total: count ?? 0, page, limit });
}

// ─── POST /api/quotes ───────────────────────────────────────────────────────

export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, user, orgId } = auth;

  // ─── Plan limit enforcement ────────────────────────────────────────────

  const planState = await getPlanState(supabase, orgId);
  if (!planState.canCreate) {
    return NextResponse.json(
      { error: "Limite preventivi raggiunto", code: "PLAN_LIMIT" },
      { status: 402 }
    );
  }

  // Rate limiting: 30 quote creations per minute per user
  const rateKey = getRateLimitKey(request, user.id);
  const { allowed } = rateLimit(`quote-create:${rateKey}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Troppe richieste. Riprova tra qualche secondo." },
      { status: 429 }
    );
  }

  const body = await request.json();

  const parsed = createQuoteBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { client_id, currency, items: bodyItems, issue_date, due_date, tax_rate, notes } = parsed.data;

  const issueDate = issue_date || new Date().toISOString().slice(0, 10);
  const dueDate = due_date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  // Compute totals
  const subtotal = bodyItems.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );
  const vatAmount = subtotal * (tax_rate / 100);
  const total = subtotal + vatAmount;

  // Generate quote number with retry on race condition
  const year = new Date().getFullYear();
  const MAX_RETRIES = 3;
  let quote: { id: string; number: string } | null = null;
  let quoteError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data: lastQuote } = await supabase
      .from("quotes")
      .select("number")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastNum = lastQuote ? parseInt(lastQuote.number.split("-").pop() || "0") : 0;
    const number = `Q-${year}-${String(lastNum + 1).padStart(3, "0")}`;

    const result = await supabase
      .from("quotes")
      .insert({
        org_id: orgId,
        client_id,
        number,
        status: "draft",
        issue_date: issueDate,
        due_date: dueDate,
        subtotal,
        tax_rate: tax_rate,
        total,
        currency,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (result.error) {
      if (result.error.code === "23505") {
        quoteError = result.error;
        continue;
      }
      console.error("POST /api/quotes insert error:", result.error);
      return NextResponse.json(
        { error: process.env.NODE_ENV === "production" ? "Internal server error" : result.error.message },
        { status: 500 }
      );
    }

    quote = result.data;
    quoteError = null;
    break;
  }

  if (quoteError || !quote) {
    return NextResponse.json({ error: "Failed to generate unique quote number after retries" }, { status: 409 });
  }

  // Create line items
  const lineItems = bodyItems.map((item) => ({
    quote_id: quote!.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    tax_rate: item.tax_rate ?? tax_rate,
  }));

  const { error: itemsError } = await supabase.from("quote_items").insert(lineItems);

  if (itemsError) {
    await supabase.from("quotes").delete().eq("id", quote.id);
    console.error("POST /api/quotes items error:", itemsError);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Internal server error" : itemsError.message },
      { status: 500 }
    );
  }

  // Increment quote usage for non-premium orgs
  if (!planState.isPremium && planState.row) {
    await supabase
      .from("user_plan")
      .update({ quotes_used: (planState.row.quotes_used ?? 0) + 1 })
      .eq("org_id", orgId);
  }

  return NextResponse.json({ data: quote }, { status: 201 });
}
