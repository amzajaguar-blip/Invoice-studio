import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/supabase/auth-helper";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

/**
 * POST /api/invoices/export-csv
 * Exports the specified invoice IDs (or all org invoices) as a CSV file.
 *
 * Body: { ids?: string[] }  — omit ids to export all
 */
export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, orgId, user } = auth;

  // Rate limit: 10 exports per minute per user
  const rlKey = getRateLimitKey(request, user.id);
  const { allowed } = rateLimit(`export-csv:${rlKey}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Troppe richieste. Attendi un minuto." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const ids: string[] | undefined = Array.isArray(body.ids) ? body.ids : undefined;

  // Build query
  let query = supabase
    .from("invoices")
    .select("number, status, issue_date, due_date, total, currency, paid_at, notes, clients(name, email, vat_number)")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (ids && ids.length > 0) {
    query = query.in("id", ids);
  }

  const { data: invoices, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message },
      { status: 500 }
    );
  }

  // Build CSV
  const STATUS_IT: Record<string, string> = {
    draft: "Bozza",
    sent: "Inviata",
    overdue: "Scaduta",
    paid: "Pagata",
    cancelled: "Annullata",
  };

  const headers = [
    "Numero",
    "Cliente",
    "Email Cliente",
    "P.IVA Cliente",
    "Stato",
    "Data emissione",
    "Scadenza",
    "Totale",
    "Valuta",
    "Pagata il",
    "Note",
  ];

  const rows = (invoices ?? []).map((inv) => {
    const client = inv.clients as { name?: string; email?: string; vat_number?: string } | null;
    return [
      inv.number ?? "",
      client?.name ?? "",
      client?.email ?? "",
      client?.vat_number ?? "",
      STATUS_IT[inv.status] ?? inv.status,
      inv.issue_date ?? "",
      inv.due_date ?? "",
      (inv.total ?? 0).toFixed(2),
      inv.currency ?? "EUR",
      inv.paid_at ?? "",
      (inv.notes ?? "").replace(/"/g, '""'),
    ].map((v) => `"${v}"`).join(",");
  });

  const csv = [headers.map((h) => `"${h}"`).join(","), ...rows].join("\n");

  const filename = `InvoiceStudio_export_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
