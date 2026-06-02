// ─── User domain model ───
// Canonical representation. Matches Supabase auth.users + public.org_members.

export type UserRole = "owner" | "admin" | "member";

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: UserRole;
  orgId: string;
  createdAt: string;
  lastSignInAt: string | null;
}
