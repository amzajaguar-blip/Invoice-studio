import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest } from "@/lib/supabase/auth-helper";

const createClientBodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  vat_number: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  currency: z.enum(["EUR", "USD", "GBP", "CHF"]).default("EUR"),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, orgId } = auth;

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("org_id", orgId)
    .order("name");

  if (error) {
    console.error("GET /api/clients error:", error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, orgId } = auth;

  const body = await request.json();

  const parsed = createClientBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, vat_number, address, currency, phone, notes } = parsed.data;

  const { data, error } = await supabase
    .from("clients")
    .insert({
      org_id: orgId,
      name,
      email,
      vat_number: vat_number ?? null,
      address: address ?? null,
      currency,
      phone: phone ?? null,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("POST /api/clients error:", error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}
