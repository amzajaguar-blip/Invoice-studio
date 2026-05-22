-- Fix: handle_new_user() trigger fails when full_name is NULL in user metadata
-- The organizations.name column is NOT NULL, but the original trigger doesn't
-- provide a default when raw_user_meta_data->>'full_name' is NULL.
-- Run this in the Supabase SQL Editor.
--
-- Bug:  null value in column "name" of relation "organizations" violates not-null constraint

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_name   text;
BEGIN
  -- Provide a default name when full_name is not set
  v_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    'Freelancer'
  ) || '''s Studio';

  -- Create organization
  INSERT INTO public.organizations (name, plan)
  VALUES (v_name, 'free')
  RETURNING id INTO v_org_id;

  -- Add user as owner
  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (v_org_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;
