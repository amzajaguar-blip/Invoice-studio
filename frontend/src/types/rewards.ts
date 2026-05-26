// ─── Rewarded Ads ──────────────────────────────────────────────────────────────

export interface RewardedCredit {
  id: string;
  org_id: string;
  credits: number;
  max_credits: number;
  month_key: string; // "YYYY-MM"
  created_at?: string;
  updated_at?: string;
}

export interface RewardClaim {
  id: string;
  org_id: string;
  user_id: string;
  ad_provider: "admob" | "unity";
  ad_provider_id?: string | null;
  verification_hash: string;
  reward_amount: number;
  claimed_at: string;
}

// ─── Plan Limits ──────────────────────────────────────────────────────────────

export interface PlanQuota {
  /** Maximum invoices per month (base plan limit) */
  maxInvoices: number;
  /** Maximum rewarded ad credits per month (hard cap) */
  maxRewardedCredits: number;
  /** Maximum rewarded ad credits per day (resets every 24h) */
  maxDailyRewardedCredits: number;
  /** Whether rewarded ads are available for this plan */
  rewardedAdsEnabled: boolean;
  /** Whether the plan is unlimited */
  unlimited: boolean;
}

export const PLAN_QUOTAS: Record<string, PlanQuota> = {
  free: {
    maxInvoices: 5,
    maxRewardedCredits: 300,
    maxDailyRewardedCredits: 10,
    rewardedAdsEnabled: true,
    unlimited: false,
  },
  pro: {
    maxInvoices: Infinity,
    maxRewardedCredits: 0,
    maxDailyRewardedCredits: 0,
    rewardedAdsEnabled: false,
    unlimited: true,
  },
  agency: {
    maxInvoices: Infinity,
    maxRewardedCredits: 0,
    maxDailyRewardedCredits: 0,
    rewardedAdsEnabled: false,
    unlimited: true,
  },
  enterprise: {
    maxInvoices: Infinity,
    maxRewardedCredits: 0,
    maxDailyRewardedCredits: 0,
    rewardedAdsEnabled: false,
    unlimited: true,
  },
};

export function getPlanQuota(plan: string): PlanQuota {
  return PLAN_QUOTAS[plan] ?? PLAN_QUOTAS.free;
}

// ─── User Quota (combined: plan limit + rewarded credits) ────────────────────

export interface UserQuota {
  plan: string;
  planLimit: number;
  currentMonthInvoices: number;
  remainingBase: number;
  rewardedCredits: number;
  maxRewardedCredits: number;
  dailyRewardedCredits: number;
  maxDailyRewardedCredits: number;
  canCreateInvoice: boolean;
  /** Whether the plan has no limits (Pro, Agency, Enterprise) */
  unlimited: boolean;
  /** If false, the reason why */
  reason?: "plan_limit" | "no_credits" | "max_credits_reached" | "daily_limit_reached";
  /** Whether the user should see the rewarded ad option */
  showRewardedAdOption: boolean;
}

// ─── Ad Provider Types ───────────────────────────────────────────────────────

export type AdProvider = "admob";

export interface RewardedAdConfig {
  provider: AdProvider;
  /** AdMob ad unit ID (from env) */
  adUnitId: string;
  /** Server-side verification URL (AdMob SSV) */
  ssvUrl?: string;
}

export interface RewardedAdEvent {
  type: "ad_loaded" | "ad_failed_to_load" | "ad_shown" | "ad_closed" | "reward_granted" | "reward_claimed";
  error?: string;
  rewardAmount?: number;
}

// ─── Ad Reward Claim Request/Response ─────────────────────────────────────────

export interface ClaimRewardRequest {
  /** Client-generated nonce (crypto.randomUUID) */
  nonce: string;
  /** HMAC signature: HMAC-SHA256(nonce + orgId + timestamp, REWARD_VERIFICATION_SECRET) */
  signature: string;
  /** Unix timestamp (ms) when the ad was completed */
  timestamp: number;
  /** Optional: AdMob reward item type/amount from client SDK */
  rewardType?: string;
  rewardAmount?: number;
}

export interface ClaimRewardResponse {
  success: boolean;
  creditsGranted?: number;
  totalCredits?: number;
  error?: string;
  retryAfterMs?: number;
}
