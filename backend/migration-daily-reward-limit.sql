-- ============================================================================
-- Migration: Daily rewarded credit limit for free-plan users
-- Adds daily_earned_credits + daily_period_date to org_credits.
-- Reset is automatic: when daily_period_date < CURRENT_DATE the counter
-- is zeroed on the next grant attempt.
-- ============================================================================

ALTER TABLE public.org_credits
ADD COLUMN IF NOT EXISTS daily_earned_credits integer NOT NULL DEFAULT 0
  CHECK (daily_earned_credits >= 0);

ALTER TABLE public.org_credits
ADD COLUMN IF NOT EXISTS daily_period_date date NOT NULL DEFAULT CURRENT_DATE;

COMMENT ON COLUMN public.org_credits.daily_earned_credits IS
  'How many rewarded credits this org earned today (resets every 24h).';

COMMENT ON COLUMN public.org_credits.daily_period_date IS
  'The date for which daily_earned_credits is valid. When < CURRENT_DATE, counter resets.';
