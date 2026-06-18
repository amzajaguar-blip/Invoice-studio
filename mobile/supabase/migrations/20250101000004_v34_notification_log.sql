-- ============================================================================
-- InvoiceStudio V34 — Migration 004: notification_log
--
-- Covers tasks: 8.2
-- Requirements: 5.2, 10.4
--
-- Implements the notification_log table used by SmartNotificationService
-- (lib/smart-notifications.ts) to enforce the 48-hour rate limit and
-- prevent notification spam.
--
-- Security model (Requirement 10.4):
--   - INSERT: allowed for authenticated roles (service writes notification records)
--   - SELECT: DENIED to all client roles
--   - UPDATE: DENIED to all client roles
--   - DELETE: DENIED to all client roles
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: Tabella `notification_log`
-- Requirements: 5.2, 5.5
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.notification_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category   TEXT        NOT NULL
             CHECK (category IN (
               'productivity',
               'revenue',
               'reminder',
               'premium',
               'business_boost'
             )),
  title      TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at  TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);

-- ─── Index ────────────────────────────────────────────────────────────────────

-- idx_notif_log_org_sent: time-ordered lookups per organisation.
-- Used by SmartNotificationService to check the most recent sent_at
-- when evaluating the 48-hour rate limit (Requirement 5.1).
CREATE INDEX IF NOT EXISTS idx_notif_log_org_sent
  ON public.notification_log(org_id, sent_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: Row Level Security
-- Requirements: 10.4
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- INSERT: authenticated users may insert notification records.
-- The application (SmartNotificationService) writes a record for every
-- successfully scheduled notification (Requirement 5.2).
CREATE POLICY "notification_log_insert_authenticated"
  ON public.notification_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- SELECT: explicitly denied to all client roles.
-- Notification history is write-only from the client; backend pipelines
-- use the service_role which bypasses RLS.
CREATE POLICY "notification_log_select_denied"
  ON public.notification_log
  FOR SELECT
  TO authenticated
  USING (false);

-- UPDATE: explicitly denied to all client roles.
CREATE POLICY "notification_log_update_denied"
  ON public.notification_log
  FOR UPDATE
  TO authenticated
  USING (false);

-- DELETE: explicitly denied to all client roles.
CREATE POLICY "notification_log_delete_denied"
  ON public.notification_log
  FOR DELETE
  TO authenticated
  USING (false);

-- ============================================================================
-- END OF MIGRATION 004
-- ============================================================================
