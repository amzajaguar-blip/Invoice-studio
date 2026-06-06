import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_REDIRECTS = new Set([
  "/dashboard",
  "/scanner",
  "/invoices",
  "/clients",
  "/analytics",
  "/settings",
  "/forgot-password",
  "/reset-password",
]);

function sanitizeRedirect(path: string | null): string {
  if (!path) return "/scanner";
  // Block protocol-relative URLs and absolute URLs
  if (
    path.startsWith("//") ||
    path.startsWith("http:") ||
    path.startsWith("https:")
  ) {
    return "/scanner";
  }
  // Only allow whitelisted paths
  return ALLOWED_REDIRECTS.has(path) ? path : "/scanner";
}

/**
 * Auth callback — handles email confirmation and OAuth redirects.
 *
 * Supabase supports two flows:
 *  1. PKCE flow  → ?code=xxx  (used by signInWithOAuth, magic link with PKCE)
 *  2. OTP flow   → ?token_hash=xxx&type=signup (used by email confirmation links)
 *
 * Both must be handled here or the user sees a 404 / lands on /login.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as
    | "signup"
    | "recovery"
    | "invite"
    | null;
  const next = sanitizeRedirect(searchParams.get("next"));

  const supabase = await createClient();

  // ── Flow 1: PKCE (code exchange) ───────────────────────────────────────────
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] exchangeCodeForSession error:", error.message);
  }

  // ── Flow 2: OTP / email-link (token_hash + type) ───────────────────────────
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] verifyOtp error:", error.message);
  }

  // ── Fallback: send to login with error indicator ────────────────────────────
  return NextResponse.redirect(
    `${origin}/login?error=confirmation_expired`
  );
}
