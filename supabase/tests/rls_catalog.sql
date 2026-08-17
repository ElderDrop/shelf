-- Repeatable RLS checks for catalog/profiles/assignments (F-01).
-- Run in Studio SQL editor or: npx supabase db query --local --file supabase/tests/rls_catalog.sql
-- Replace the UUID placeholders after signing up two users.

-- Look up users:
-- SELECT id, email FROM auth.users;

-- Promote one admin (service role / postgres; bypasses RLS):
-- UPDATE public.profiles SET role = 'admin' WHERE id = '<admin-uuid>';

-- ---------------------------------------------------------------------------
-- Seed catalog rows as postgres (bypasses RLS)
-- ---------------------------------------------------------------------------
-- INSERT INTO public.catalog_items (title, status)
-- VALUES ('Pending Book', 'pending'), ('Approved Book', 'approved')
-- ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Regular user: approved catalog only; no other users' assignments
-- ---------------------------------------------------------------------------
-- BEGIN;
-- SET LOCAL role authenticated;
-- SET LOCAL request.jwt.claim.sub = '<user-a-uuid>';
-- SELECT id, title, status FROM public.catalog_items;           -- approved only
-- SELECT * FROM public.user_assignments;                        -- own rows only
-- INSERT INTO public.user_assignments (user_id, catalog_item_id, list_type)
-- VALUES (
--   '<user-a-uuid>',
--   (SELECT id FROM public.catalog_items WHERE title = 'Approved Book' LIMIT 1),
--   'library'
-- );                                                             -- should succeed
-- INSERT INTO public.user_assignments (user_id, catalog_item_id, list_type)
-- VALUES (
--   '<user-a-uuid>',
--   (SELECT id FROM public.catalog_items WHERE title = 'Pending Book' LIMIT 1),
--   'library'
-- );                                                             -- should fail
-- COMMIT;

-- ---------------------------------------------------------------------------
-- Admin: all catalog statuses; can insert/update/delete catalog items
-- ---------------------------------------------------------------------------
-- BEGIN;
-- SET LOCAL role authenticated;
-- SET LOCAL request.jwt.claim.sub = '<admin-uuid>';
-- SELECT id, title, status FROM public.catalog_items;           -- pending + approved + rejected
-- INSERT INTO public.catalog_items (title, status) VALUES ('Admin Insert', 'pending');
-- COMMIT;

-- ---------------------------------------------------------------------------
-- Cross-user leak: User B must not see User A's assignments
-- ---------------------------------------------------------------------------
-- BEGIN;
-- SET LOCAL role authenticated;
-- SET LOCAL request.jwt.claim.sub = '<user-b-uuid>';
-- SELECT * FROM public.user_assignments;                        -- empty or B's rows only
-- COMMIT;

-- ---------------------------------------------------------------------------
-- Unauthenticated (anon): no domain rows
-- ---------------------------------------------------------------------------
-- BEGIN;
-- SET LOCAL role anon;
-- SELECT * FROM public.profiles;
-- SELECT * FROM public.catalog_items;
-- SELECT * FROM public.user_assignments;
-- COMMIT;
