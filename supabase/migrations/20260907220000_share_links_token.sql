-- Owner-readable raw share token for re-copy after reload (nullable for legacy hash-only rows).
ALTER TABLE public.share_links ADD COLUMN token text;
