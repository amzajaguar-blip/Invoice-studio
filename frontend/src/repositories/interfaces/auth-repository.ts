// ─── Auth Repository interface ───
// NO API implementation. Mock only.
// Provides user session, org membership, and profile info.

import type { User } from "@/types/models";

export interface AuthRepository {
  /** Get the currently authenticated user with org context. */
  getCurrentUser(): Promise<User | null>;

  /** Get the user's organization. */
  getOrganization(orgId: string): Promise<{
    id: string;
    name: string;
    plan: string;
  } | null>;

  /** Sign in with email and password. */
  signIn(email: string, password: string): Promise<AuthResult>;

  /** Sign up a new user. */
  signUp(email: string, password: string, name: string): Promise<AuthResult>;

  /** Sign out the current user. */
  signOut(): Promise<void>;

  /** Request a password reset. */
  resetPassword(email: string): Promise<void>;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}
