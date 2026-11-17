-- Extend encrypted connection providers ONLY in ngoc-agent-studio-db.
-- Do not apply this migration to Base Su Viet.
ALTER TABLE public.integration_secrets DROP CONSTRAINT IF EXISTS integration_secrets_provider_check;
ALTER TABLE public.integration_secrets ADD CONSTRAINT integration_secrets_provider_check
 CHECK (provider IN ('openai','wordpress','gsc','ga4','drive','google_ads','facebook','instagram'));
