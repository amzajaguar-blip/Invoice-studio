import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase server client — for use in:
 * - Server Components
 * - Server Actions
 * - API Routes
 *
 * Reads cookies via next/headers (App Router).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
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
}

/**
 * Get the currently authenticated user from a Server Component.
 * Returns null if not authenticated.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/**
 * Get the org_id for the current authenticated user.
 * Returns null if user has no organization.
 */
export async function getCurrentOrgId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.user.id)
    .maybeSingle();

  return member?.org_id ?? null;
}
