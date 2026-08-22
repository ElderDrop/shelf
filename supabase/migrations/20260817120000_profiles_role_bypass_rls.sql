-- Allow postgres / service_role (rolbypassrls) to promote an admin.
-- Keep blocking authenticated clients. SECURITY INVOKER on purpose:
-- DEFINER would make current_user the owner and allow every role change.

CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF EXISTS (
      SELECT 1 FROM pg_roles
      WHERE rolname = current_user AND rolbypassrls
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'profiles.role cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;
