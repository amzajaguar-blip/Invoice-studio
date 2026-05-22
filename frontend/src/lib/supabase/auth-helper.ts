import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthResult {
  supabase: SupabaseClient;
  user: User;
  orgId: string;
  authenticated: true;
}

interface AuthFailure {
  supabase: null;
  user: null;
  orgId: null;
  authenticated: false;
}

type AuthFromRequest = AuthResult | AuthFailure;

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Authenticate a request using Bearer token (mobile) or cookies (web).
 *
 * Priority:
 *   1. Authorization: Bearer <jwt> — for mobile / external clients
 *   2. Cookie-based session — for the Next.js web app
 *
 * Returns { supabase, user, orgId, authenticated } or a failure object.
 */
export async function getAuthFromRequest(
  request: Request
): Promise<AuthFromRequest> {
  const authHeader = request.headers.get("authorization");

  let supabase: SupabaseClient;
  let user: User | null = null;

  if (authHeader?.match(/^Bearer\s+(.+)$/i)) {
    // ── Mobile / API auth via Bearer token ────────────────────────────────
    const token = authHeader.match(/^Bearer\s+(.+)$/i)![1];
    supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return { supabase: null, user: null, orgId: null, authenticated: false };
    }
    user = data.user;
  } else {
    // ── Web auth via cookies ──────────────────────────────────────────────
    const cookieStore = await cookies();
    supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              for (const { name, value, options } of cookiesToSet) {
                cookieStore.set(name, value, options);
              }
            } catch {
              // Called from a Server Component — supabase-js handles this
            }
          },
        },
      }
    );
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return { supabase: null, user: null, orgId: null, authenticated: false };
    }
    user = data.user;
  }

  // ── Resolve org_id ────────────────────────────────────────────────────────
  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member?.org_id) {
    return { supabase: null, user: null, orgId: null, authenticated: false };
  }

  return {
    supabase,
    user,
    orgId: member.org_id,
    authenticated: true,
  };
}
