import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/supabase/auth-helper";

// ─── GET /api/documents/[id] ────────────────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, orgId } = auth;
  const { id } = await params;

  const { data, error } = await supabase
    .from("documents")
    .select("*, clients(name, email, vat_number, address), document_items(*)")
    .eq("id", id)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error("GET /api/documents/[id] error:", error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Not found" : error.message },
      { status: 404 }
    );
  }

  return NextResponse.json({ data });
}

// ─── PATCH /api/documents/[id] ──────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, orgId } = auth;
  const { id } = await params;
  const body = await request.json();

  const { data: existing } = await supabase
    .from("documents")
    .select("id, status, document_type")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowedFields: Record<string, string[]> = {
    draft: ["client_id", "due_date", "notes", "currency", "status", "payment_terms"],
    sent: ["notes", "status"],
    overdue: ["notes", "status"],
    paid: ["notes"],
    accepted: ["notes", "status"],
    rejected: ["notes"],
    invoiced: ["notes"],
  };

  const fields = allowedFields[existing.status] ?? [];
  const updates: Record<string, unknown> = {};

  for (const field of fields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ data: existing });
  }

  const { data, error } = await supabase
    .from("documents")
    .update(updates)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) {
    console.error("PATCH /api/documents/[id] error:", error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Update failed" : error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}

// ─── DELETE /api/documents/[id] ─────────────────────────────────────────────

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, orgId } = auth;
  const { id } = await params;

  const { data: existing } = await supabase
    .from("documents")
    .select("id")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) {
    console.error("DELETE /api/documents/[id] error:", error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Delete failed" : error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
