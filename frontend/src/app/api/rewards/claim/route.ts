import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest } from "@/lib/supabase/auth-helper";
import { grantRewardedCredit, verifyRewardSignature, getUserQuota } from "@/lib/plan";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

// ─── Validation ───────────────────────────────────────────────────────────────

const claimBodySchema = z.object({
  nonce: z.string().uuid(),
  signature: z.string().min(1),
  timestamp: z.number().int().positive(),
  rewardType: z.string().optional(),
  rewardAmount: z.number().int().min(1).max(5).default(1),
});

// ─── POST /api/rewards/claim ──────────────────────────────────────────────────
// Server-side verification of rewarded ad completion.
// Client submits a nonce + HMAC signature; server verifies and grants credits.

export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user, orgId } = auth;

  // Rate limit: 5 claim attempts per minute per user
  const rateKey = getRateLimitKey(request, user.id);
  const { allowed } = rateLimit(rateKey, 5, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: "Troppe richieste. Attendi un minuto." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const parsed = claimBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    );
  }

  const { nonce, signature, timestamp, rewardAmount } = parsed.data;

  // Verify the HMAC signature using server-side-only secret.
  // NEXT_PUBLIC_* secrets are exposed in the client bundle and MUST NOT be used here.
  const secret = process.env.REWARD_VERIFICATION_SECRET;
  if (!secret) {
    console.error("REWARD_VERIFICATION_SECRET env var not set — rewards claim disabled");
    return NextResponse.json(
      { success: false, error: "Server configuration error" },
      { status: 500 }
    );
  }

  const isValid = await verifyRewardSignature(nonce, orgId, timestamp, signature, secret);
  if (!isValid) {
    return NextResponse.json(
      { success: false, error: "Firma di verifica non valida" },
      { status: 403 }
    );
  }

  // Generate a unique verification hash for idempotency
  const verificationHash = `${nonce}:${orgId}:${timestamp}`;

  // Grant credits atomically
  const result = await grantRewardedCredit(
    orgId,
    user.id,
    verificationHash,
    "admob",
    rewardAmount
  );

  if (!result.success) {
    const isDailyLimit = result.error?.includes("Limite giornaliero");
    return NextResponse.json(
      { success: false, error: result.error },
      { status: isDailyLimit ? 429 : 400 }
    );
  }

  // Return updated quota
  const quota = await getUserQuota(orgId);

  return NextResponse.json({
    success: true,
    creditsGranted: result.creditsGranted,
    totalCredits: result.totalCredits,
    quota,
  });
}
