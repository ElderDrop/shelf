-- New Supabase secret keys (sb_secret_*) authenticate as service_role but do not
-- inherit table privileges from authenticated. Share resolve (and any future
-- service-role reads) need explicit GRANTs. SELECT-only — no write grants.

GRANT SELECT ON TABLE public.share_links TO service_role;
GRANT SELECT ON TABLE public.user_assignments TO service_role;
GRANT SELECT ON TABLE public.catalog_items TO service_role;
