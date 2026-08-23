-- Harden prevent_profile_role_change search_path (impl-review F1).
-- Empty search_path avoids pg_temp shadowing; qualify pg_catalog.pg_roles.
-- Keep SECURITY INVOKER (default) and current_user — not DEFINER / session_user.

CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_roles
      WHERE rolname = current_user AND rolbypassrls
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'profiles.role cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;
