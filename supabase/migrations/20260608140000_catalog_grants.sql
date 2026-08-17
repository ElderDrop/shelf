-- Data API grants for Shelf domain tables (impl-review F1)
-- RLS policies still decide which rows are visible; these GRANTs only let
-- authenticated clients reach the tables through PostgREST / supabase-js.
-- No grants to anon.

GRANT USAGE ON TYPE public.app_role TO authenticated;
GRANT USAGE ON TYPE public.catalog_status TO authenticated;
GRANT USAGE ON TYPE public.list_type TO authenticated;

GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catalog_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_assignments TO authenticated;
