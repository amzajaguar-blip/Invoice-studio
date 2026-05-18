import { NextResponse } from "next/server";
import { createClient, getCurrentOrgId } from "@/lib/supabase/server";

// ─── GET /api/invoices/[id] ──────────────────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const orgId = await getCurrentOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabase
    .from("invoices")
    .select("*, clients(name, email, vat_number, address), invoice_items(*), invoice_events(*)")
    .eq("id", id)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error("GET /api/invoices/[id] error:", error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Not found" : error.message },
      { status: 404 }
    );
  }

  return NextResponse.json({ data });
}

// ─── PATCH /api/invoices/[id] ────────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const orgId = await getCurrentOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  // Verify ownership
  const { data: existing } = await supabase
    .from("invoices")
    .select("id, status")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only allow updating certain fields based on status
  const allowedFields: Record<string, string[]> = {
    draft: ["client_id", "due_date", "notes", "currency", "status"],
    sent: ["notes", "status"],
    overdue: ["notes", "status"],
    paid: ["notes"],
  };

  const fields = allowedFields[existing.status] ?? [];
  const updates: Record<string, unknown> = {};

  for (const field of fields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // If marking as paid, set paid_at
  if (updates.status === "paid") {
    updates.paid_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("invoices")
    .update(updates)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) {
    console.error("PATCH /api/invoices/[id] error:", error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message },
      { status: 500 }
    );
  }
  if (body.status) {
    const STATUS_TO_EVENT: Record<string, string> = {
      draft: "created",
      sent: "sent",
      overdue: "sent",
      paid: "paid",
      cancelled: "cancelled",
    };
    await supabase.from("invoice_events").insert({
      invoice_id: id,
      event_type: STATUS_TO_EVENT[body.status] || body.status,
    });
  }

  return NextResponse.json({ data });
}

// ─── DELETE /api/invoices/[id] (soft delete) ─────────────────────────────────

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const orgId = await getCurrentOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Soft delete
  const { error } = await supabase
    .from("invoices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) {
    console.error("DELETE /api/invoices/[id] error:", error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
