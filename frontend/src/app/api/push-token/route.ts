import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/supabase/auth-helper";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

/**
 * POST /api/push-token
 * Register or update the Expo push token for the authenticated user.
 * Called by the mobile app on startup after acquiring a push token.
 *
 * Body: { token: string, platform: "android" | "ios" }
 */
export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, user } = auth;

  // Rate limit: 10 registrations per minute per user
  const rateKey = getRateLimitKey(request, user.id);
  const { allowed } = rateLimit(`push-token:${rateKey}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { token?: string; platform?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, platform } = body;

  if (!token || typeof token !== "string" || !token.startsWith("ExponentPushToken[")) {
    return NextResponse.json(
      { error: "Invalid Expo push token format" },
      { status: 400 }
    );
  }

  if (!platform || !["android", "ios"].includes(platform)) {
    return NextResponse.json(
      { error: "platform must be 'android' or 'ios'" },
      { status: 400 }
    );
  }

  // Upsert the token — one row per user (update if exists)
  const { error } = await supabase
    .from("user_push_tokens")
    .upsert(
      {
        user_id: user.id,
        token,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("POST /api/push-token error:", error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Internal server error" : error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/push-token
 * Remove the push token for the authenticated user (on logout).
 */
export async function DELETE(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, user } = auth;

  await supabase.from("user_push_tokens").delete().eq("user_id", user.id);

  return NextResponse.json({ success: true });
}
