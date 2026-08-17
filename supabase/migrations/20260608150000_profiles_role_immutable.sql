-- Prevent non-service-role clients from changing profiles.role (impl-review F5).
-- RLS WITH CHECK already rejects role changes; this trigger is defense in depth.

CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'profiles.role cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_prevent_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_change();
