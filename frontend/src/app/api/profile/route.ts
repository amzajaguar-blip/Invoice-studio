import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest } from "@/lib/supabase/auth-helper";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  orgName: z.string().min(1).max(120).optional(),
});

/**
 * PATCH /api/profile
 * Updates the authenticated user's display name and/or organization name.
 */
export async function PATCH(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, orgId, user } = auth;

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const { fullName, orgName } = parsed.data;
  const admin = createAdminClient();

  // Update display name via admin client (bypasses auth.users RLS)
  if (fullName !== undefined) {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { full_name: fullName },
    });
    if (error) {
      return NextResponse.json(
        { error: process.env.NODE_ENV === "production" ? "Errore aggiornamento profilo" : error.message },
        { status: 500 }
      );
    }
  }

  // Update org name via RLS-aware client
  if (orgName !== undefined && orgId) {
    const { error } = await supabase
      .from("organizations")
      .update({ name: orgName } as { name: string })
      .eq("id", orgId);
    if (error) {
      return NextResponse.json(
        { error: process.env.NODE_ENV === "production" ? "Errore aggiornamento organizzazione" : error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true });
}
