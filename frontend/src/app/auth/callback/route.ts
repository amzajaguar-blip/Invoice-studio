import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_REDIRECTS = new Set([
  "/dashboard",
  "/invoices",
  "/clients",
  "/analytics",
  "/settings",
]);

function sanitizeRedirect(path: string | null): string {
  if (!path) return "/dashboard";
  // Block protocol-relative URLs and absolute URLs
  if (path.startsWith("//") || path.startsWith("http:") || path.startsWith("https:")) {
    return "/dashboard";
  }
  // Only allow whitelisted paths
  return ALLOWED_REDIRECTS.has(path) ? path : "/dashboard";
}

/**
 * Auth callback — handles email confirmation and OAuth redirects.
 * Supabase redirects here after a user clicks the confirmation link.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeRedirect(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Fallback: redirect to login
  return NextResponse.redirect(`${origin}/login`);
}
