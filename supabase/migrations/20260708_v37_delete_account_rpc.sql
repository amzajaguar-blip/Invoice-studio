-- VELA v37: Delete Account RPC Function
-- Esegui in Supabase SQL Editor (copy/pasta tutto)

-- ═══════════════════════════════════════════════════════════════════════════════
-- DELETE_OWN_ACCOUNT RPC
-- ═══════════════════════════════════════════════════════════════════════════════
-- This function deletes the current user's account and all associated data.
-- It uses SECURITY DEFINER to run with elevated privileges and access auth tables.

CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
BEGIN
  -- Get the current authenticated user's ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utente non autenticato';
  END IF;

  -- Get the user's organization ID (if any)
  SELECT org_id INTO v_org_id 
  FROM org_members 
  WHERE user_id = v_user_id 
  LIMIT 1;

  -- Delete user's data in correct order (respecting FK constraints)
  -- Note: org_members will be cleaned up by CASCADE on organizations
  
  -- 1. Delete user's push tokens
  DELETE FROM push_tokens WHERE user_id = v_user_id;
  
  -- 2. Delete user's notification settings
  DELETE FROM notification_settings WHERE user_id = v_user_id;
  
  -- 3. Delete user's invoices (will cascade to invoice_items via FK)
  DELETE FROM invoices WHERE user_id = v_user_id;
  
  -- 4. Delete user's quotes (will cascade to quote_items via FK)
  DELETE FROM quotes WHERE org_id = v_org_id;
  
  -- 5. Delete user's clients
  DELETE FROM clients WHERE org_id = v_org_id;
  
  -- 6. Delete org_members entry (user's membership)
  DELETE FROM org_members WHERE user_id = v_user_id;
  
  -- 7. Delete organization if this was the only member
  -- (only if org_id exists and no other members remain)
  IF v_org_id IS NOT NULL THEN
    DELETE FROM organizations 
    WHERE id = v_org_id 
    AND NOT EXISTS (
      SELECT 1 FROM org_members WHERE org_id = v_org_id
    );
  END IF;
  
  -- 8. Finally, delete the auth user (this is the critical step)
  -- auth.users is managed by Supabase Auth - we use the admin function
  PERFORM auth.admin_delete_user(v_user_id);
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and re-raise
    RAISE EXCEPTION 'Errore durante eliminazione account: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_own_account() TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERY
-- ═══════════════════════════════════════════════════════════════════════════════
-- Run this to verify the function exists:
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'delete_own_account';