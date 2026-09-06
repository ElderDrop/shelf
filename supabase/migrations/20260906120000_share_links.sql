-- Share links for read-only library + wishlist (S-05 / FR-008)
-- Delete-on-revoke: one row per user; revoke deletes the row.

CREATE TABLE public.share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  UNIQUE (token_hash)
);

CREATE INDEX share_links_token_hash_idx ON public.share_links (token_hash);

ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY share_links_select_own
  ON public.share_links
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY share_links_insert_own
  ON public.share_links
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY share_links_update_own
  ON public.share_links
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY share_links_delete_own
  ON public.share_links
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- No grants to anon.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.share_links TO authenticated;
