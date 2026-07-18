-- VELA v43: Row Level Security for clients & invoices + delete_own_account fix
--
-- SECURITY FIX (P0):
--   1. Enable RLS on `clients` and `invoices` tables (previously unprotected —
--      any authenticated user with the anon key could read/modify ALL users' data).
--   2. Fix `delete_own_account()` RPC to only delete quotes/clients when the
--      caller is the sole remaining org member (was deleting by org_id
--      regardless of membership count — cross-tenant data wipe).
--
-- Run in Supabase SQL Editor.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. RLS for `clients` table
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS org_members_can_read_clients ON clients;
DROP POLICY IF EXISTS org_members_can_insert_clients ON clients;
DROP POLICY IF EXISTS org_members_can_update_clients ON clients;
DROP POLICY IF EXISTS org_members_can_delete_clients ON clients;

CREATE POLICY org_members_can_read_clients ON clients
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY org_members_can_insert_clients ON clients
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY org_members_can_update_clients ON clients
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY org_members_can_delete_clients ON clients
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. RLS for `invoices` table
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_members_can_read_invoices ON invoices;
DROP POLICY IF EXISTS org_members_can_insert_invoices ON invoices;
DROP POLICY IF EXISTS org_members_can_update_invoices ON invoices;
DROP POLICY IF EXISTS org_members_can_delete_invoices ON invoices;

CREATE POLICY org_members_can_read_invoices ON invoices
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY org_members_can_insert_invoices ON invoices
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY org_members_can_update_invoices ON invoices
  FOR UPDATE USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY org_members_can_delete_invoices ON invoices
  FOR DELETE USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. RLS for `invoice_items` table (if it exists)
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_items') THEN
    ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS org_members_can_read_invoice_items ON invoice_items;
    DROP POLICY IF EXISTS org_members_can_insert_invoice_items ON invoice_items;
    DROP POLICY IF EXISTS org_members_can_update_invoice_items ON invoice_items;
    DROP POLICY IF EXISTS org_members_can_delete_invoice_items ON invoice_items;

    CREATE POLICY org_members_can_read_invoice_items ON invoice_items
      FOR SELECT USING (
        invoice_id IN (
          SELECT id FROM invoices
          WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
        )
      );

    CREATE POLICY org_members_can_insert_invoice_items ON invoice_items
      FOR INSERT WITH CHECK (
        invoice_id IN (
          SELECT id FROM invoices
          WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
        )
      );

    CREATE POLICY org_members_can_update_invoice_items ON invoice_items
      FOR UPDATE USING (
        invoice_id IN (
          SELECT id FROM invoices
          WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
        )
      );

    CREATE POLICY org_members_can_delete_invoice_items ON invoice_items
      FOR DELETE USING (
        invoice_id IN (
          SELECT id FROM invoices
          WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
        )
      );
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Fix `delete_own_account()` RPC — scope deletes to sole-member check
-- ═══════════════════════════════════════════════════════════════════════════════
-- Previously: quotes/clients deleted by org_id unconditionally → cross-tenant wipe
-- Fixed: only delete quotes/clients when caller is the SOLE remaining org member
CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_member_count INTEGER;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utente non autenticato';
  END IF;

  SELECT org_id INTO v_org_id
  FROM org_members
  WHERE user_id = v_user_id
  LIMIT 1;

  -- 1. Delete user's push tokens
  DELETE FROM push_tokens WHERE user_id = v_user_id;

  -- 2. Delete user's notification settings
  DELETE FROM notification_settings WHERE user_id = v_user_id;

  -- 3. Delete user's invoices (user_id-scoped, safe for multi-member orgs)
  DELETE FROM invoices WHERE user_id = v_user_id;

  -- 4. Check if caller is the sole remaining member of the org
  IF v_org_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_member_count
    FROM org_members WHERE org_id = v_org_id;

    IF v_member_count <= 1 THEN
      -- Sole member: safe to delete org-scoped data
      DELETE FROM quotes WHERE org_id = v_org_id;
      DELETE FROM clients WHERE org_id = v_org_id;
    ELSE
      -- Other members exist: do NOT delete shared org data
      -- Only remove the caller's own membership
      RAISE NOTICE 'Organization % has % members — preserving shared data', v_org_id, v_member_count;
    END IF;
  END IF;

  -- 5. Delete org_members entry
  DELETE FROM org_members WHERE user_id = v_user_id;

  -- 6. Delete organization if sole owner (only if no other members remain)
  IF v_org_id IS NOT NULL THEN
    DELETE FROM organizations
    WHERE id = v_org_id
    AND NOT EXISTS (
      SELECT 1 FROM org_members WHERE org_id = v_org_id
    );
  END IF;

  -- 7. Delete the auth user
  PERFORM auth.admin_delete_user(v_user_id);

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Errore durante eliminazione account: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_own_account() TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════════
-- Verify RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('clients', 'invoices', 'invoice_items');
