import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest } from "@/lib/supabase/auth-helper";

const updateClientBodySchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  vat_number: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  currency: z.enum(["EUR", "USD", "GBP", "CHF"]).optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, orgId } = auth;

  const { id } = await params;

  const body = await request.json();

  const parsed = updateClientBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nessun campo da aggiornare" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("clients")
    .update(updates)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) {
    console.error(`PUT /api/clients/${id} error:`, error);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Internal server error"
            : error.message,
      },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, orgId } = auth;

  const { id } = await params;

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) {
    console.error(`DELETE /api/clients/${id} error:`, error);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Internal server error"
            : error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}