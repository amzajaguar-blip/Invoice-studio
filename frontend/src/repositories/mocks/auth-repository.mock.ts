// ─── Auth Repository — Mock implementation ───

import type { AuthRepository, AuthResult } from "@/repositories/interfaces/auth-repository";
import type { User } from "@/types/models";

const MOCK_USER: User = {
  id: "user-1",
  email: "freelance@esempio.it",
  name: "Marco Rossi",
  avatarUrl: null,
  role: "owner",
  orgId: "org-1",
  createdAt: "2026-01-15T08:30:00Z",
  lastSignInAt: "2026-06-01T09:00:00Z",
};

export function createAuthRepositoryMock(): AuthRepository {
  let signedIn = true;

  return {
    async getCurrentUser(): Promise<User | null> {
      await new Promise((r) => setTimeout(r, 100));
      return signedIn ? MOCK_USER : null;
    },

    async getOrganization(_orgId: string) {
      await new Promise((r) => setTimeout(r, 100));
      return {
        id: "org-1",
        name: "Marco Rossi Freelance",
        plan: "free",
      };
    },

    async signIn(email: string, _password: string): Promise<AuthResult> {
      await new Promise((r) => setTimeout(r, 800));
      if (!email.includes("@")) {
        return { success: false, error: "Email non valida" };
      }
      signedIn = true;
      return { success: true, user: MOCK_USER };
    },

    async signUp(_email: string, _password: string, name: string): Promise<AuthResult> {
      await new Promise((r) => setTimeout(r, 1000));
      signedIn = true;
      return {
        success: true,
        user: { ...MOCK_USER, name, email: _email },
      };
    },

    async signOut(): Promise<void> {
      await new Promise((r) => setTimeout(r, 300));
      signedIn = false;
    },

    async resetPassword(_email: string): Promise<void> {
      await new Promise((r) => setTimeout(r, 600));
    },
  };
}
