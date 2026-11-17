-- Backward compatibility with currently deployed Ngoc Agent Studio workspace loader.
-- The SEO site URL table was introduced with first_seen_at/last_seen_at but
-- the original project workspace orders every source by created_at.
-- Add the missing timestamp without replacing, deleting or moving any data.
ALTER TABLE public.seo_site_urls
  ADD COLUMN IF NOT EXISTS created_at timestamptz;
UPDATE public.seo_site_urls
  SET created_at = first_seen_at
  WHERE created_at IS NULL;
ALTER TABLE public.seo_site_urls
  ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.seo_site_urls
  ALTER COLUMN created_at SET NOT NULL;
CREATE INDEX IF NOT EXISTS seo_urls_project_created_at_idx
  ON public.seo_site_urls(owner_id,project_id,created_at DESC,id DESC);
