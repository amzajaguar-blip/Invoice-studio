-- ============================================================
-- Migration: V34 analytics_events table
-- Requirements: 10.3, 8.1, 8.2
-- ============================================================
-- Creates the analytics_events table used by the AnalyticsEventBus
-- (lib/analytics-events.ts) to persist every tracked event.
--
-- Security model (Requirement 10.3):
--   - INSERT: allowed for authenticated roles (app clients write events)
--   - SELECT: DENIED to all client roles (analytics are write-only from client)
--   - UPDATE: DENIED to all client roles
--   - DELETE: DENIED to all client roles
-- ============================================================

-- ------------------------------------------------------------
-- 1. Table DDL
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event      TEXT        NOT NULL,
  properties JSONB       NOT NULL DEFAULT '{}',
  org_id     UUID        REFERENCES organizations(id) ON DELETE SET NULL,
  user_id    UUID        REFERENCES auth.users(id)    ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2. Indexes
-- ------------------------------------------------------------

-- idx_analytics_event_name: fast lookup / aggregation by event name
CREATE INDEX IF NOT EXISTS idx_analytics_event_name
  ON analytics_events(event);

-- idx_analytics_org_time: time-series queries scoped to an organisation
CREATE INDEX IF NOT EXISTS idx_analytics_org_time
  ON analytics_events(org_id, created_at DESC);

-- ------------------------------------------------------------
-- 3. Row-Level Security
-- ------------------------------------------------------------

-- Enable RLS on the table
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- INSERT: authenticated users may insert their own events
-- (org_id / user_id are set by the application, not enforced here
--  because anonymous/unattributed events are valid — e.g. pre-login)
CREATE POLICY "analytics_events_insert_authenticated"
  ON analytics_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- SELECT: explicitly denied to all client roles
-- (service_role can still read for backend analytics pipelines)
CREATE POLICY "analytics_events_select_denied"
  ON analytics_events
  FOR SELECT
  TO authenticated
  USING (false);

-- UPDATE: explicitly denied to all client roles
CREATE POLICY "analytics_events_update_denied"
  ON analytics_events
  FOR UPDATE
  TO authenticated
  USING (false);

-- DELETE: explicitly denied to all client roles
CREATE POLICY "analytics_events_delete_denied"
  ON analytics_events
  FOR DELETE
  TO authenticated
  USING (false);
