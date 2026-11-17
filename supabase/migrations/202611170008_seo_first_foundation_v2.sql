-- SEO-first foundation v2. Additive migration; preserve all legacy 3-stage tasks.
-- Scope: Ngoc Agent Studio Supabase project zvbwknltooymuenpvptr ONLY.
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS role_key text;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS template_version text;
CREATE INDEX IF NOT EXISTS agents_project_role_idx ON public.agents(owner_id,project_id,role_key);

CREATE TABLE IF NOT EXISTS public.workflow_definitions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 project_id uuid NOT NULL,
 template_key text NOT NULL CHECK(length(template_key) BETWEEN 3 AND 90),
 template_version text NOT NULL CHECK(length(template_version) BETWEEN 1 AND 40),
 title text NOT NULL CHECK(length(title) BETWEEN 3 AND 180),
 description text NOT NULL DEFAULT '',
 trigger_type text NOT NULL DEFAULT 'manual' CHECK(trigger_type IN ('manual','schedule','event')),
 steps jsonb NOT NULL CHECK(jsonb_typeof(steps)='array'),
 required_capabilities text[] NOT NULL DEFAULT '{}',
 enabled boolean NOT NULL DEFAULT false,
 customized boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT workflow_defs_project_fk FOREIGN KEY(project_id,owner_id)
   REFERENCES public.projects(id,owner_id) ON DELETE CASCADE,
 UNIQUE(owner_id,project_id,template_key),
 UNIQUE(id,owner_id,project_id)
);
CREATE INDEX IF NOT EXISTS workflow_definitions_project_idx ON public.workflow_definitions(owner_id,project_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.workflow_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 project_id uuid NOT NULL,
 definition_id uuid NOT NULL,
 template_key text NOT NULL,
 template_version text NOT NULL,
 title text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'planned'
  CHECK(status IN ('planned','active','paused','cancelled','completed','failed')),
 started_at timestamptz,
 finished_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT workflow_run_project_fk FOREIGN KEY(project_id,owner_id)
   REFERENCES public.projects(id,owner_id) ON DELETE CASCADE,
 CONSTRAINT workflow_run_definition_fk FOREIGN KEY(definition_id,owner_id,project_id)
   REFERENCES public.workflow_definitions(id,owner_id,project_id) ON DELETE RESTRICT,
 UNIQUE(id,owner_id,project_id)
);
CREATE INDEX IF NOT EXISTS workflow_runs_project_idx ON public.workflow_runs(owner_id,project_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.workflow_step_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 project_id uuid NOT NULL,
 run_id uuid NOT NULL,
 step_key text NOT NULL,
 label text NOT NULL,
 step_order integer NOT NULL CHECK(step_order>=1 AND step_order<=50),
 requires text[] NOT NULL DEFAULT '{}',
 gate text NOT NULL CHECK(gate IN ('read','draft','approval','external')),
 status text NOT NULL DEFAULT 'pending'
  CHECK(status IN ('pending','ready','running','needs_input','needs_approval','approved','blocked','failed','skipped','done')),
 task_id uuid,
 evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT workflow_step_run_fk FOREIGN KEY(run_id,owner_id,project_id)
   REFERENCES public.workflow_runs(id,owner_id,project_id) ON DELETE CASCADE,
 CONSTRAINT workflow_step_task_fk FOREIGN KEY(task_id,owner_id,project_id)
   REFERENCES public.tasks(id,owner_id,project_id) ON DELETE SET NULL(task_id),
 UNIQUE(run_id,step_key),
 UNIQUE(id,owner_id,project_id)
);
CREATE INDEX IF NOT EXISTS workflow_steps_project_idx ON public.workflow_step_runs(owner_id,project_id,run_id,step_order);

CREATE TABLE IF NOT EXISTS public.seo_crawl_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 project_id uuid NOT NULL,
 source_asset_id uuid,
 root_url text NOT NULL,
 audit_schema text NOT NULL DEFAULT 'ngoc.seo.audit.v2',
 mode text NOT NULL CHECK(mode IN ('quick','extended')),
 sampled_count integer NOT NULL DEFAULT 0 CHECK(sampled_count>=0),
 discovered_count integer NOT NULL DEFAULT 0 CHECK(discovered_count>=0),
 failed_count integer NOT NULL DEFAULT 0 CHECK(failed_count>=0),
 summary jsonb NOT NULL DEFAULT '{}'::jsonb,
 data_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
 checked_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT seo_crawl_project_fk FOREIGN KEY(project_id,owner_id)
   REFERENCES public.projects(id,owner_id) ON DELETE CASCADE,
 UNIQUE(id,owner_id,project_id),
 UNIQUE(owner_id,project_id,source_asset_id)
);
CREATE INDEX IF NOT EXISTS seo_crawl_project_idx ON public.seo_crawl_runs(owner_id,project_id,checked_at DESC);

CREATE TABLE IF NOT EXISTS public.seo_site_urls (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 project_id uuid NOT NULL,
 url text NOT NULL CHECK(length(url) BETWEEN 10 AND 2048),
 page_kind text NOT NULL DEFAULT 'page' CHECK(page_kind IN ('product','category','article','page')),
 title text,
 canonical_url text,
 first_seen_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT seo_url_project_fk FOREIGN KEY(project_id,owner_id)
   REFERENCES public.projects(id,owner_id) ON DELETE CASCADE,
 UNIQUE(owner_id,project_id,url),
 UNIQUE(id,owner_id,project_id)
);
CREATE INDEX IF NOT EXISTS seo_urls_project_kind_idx ON public.seo_site_urls(owner_id,project_id,page_kind);

CREATE TABLE IF NOT EXISTS public.seo_findings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 project_id uuid NOT NULL,
 crawl_id uuid NOT NULL,
 code text NOT NULL CHECK(length(code) BETWEEN 3 AND 100),
 severity text NOT NULL CHECK(severity IN ('high','medium','info')),
 message text NOT NULL,
 affected_count integer NOT NULL DEFAULT 0 CHECK(affected_count>=0),
 evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
 source_url text,
 confidence text NOT NULL DEFAULT 'observed' CHECK(confidence IN ('observed','inferred','unverified')),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','resolved','dismissed')),
 last_verified_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT seo_finding_crawl_fk FOREIGN KEY(crawl_id,owner_id,project_id)
   REFERENCES public.seo_crawl_runs(id,owner_id,project_id) ON DELETE CASCADE,
 UNIQUE(owner_id,project_id,crawl_id,code)
);
CREATE INDEX IF NOT EXISTS seo_findings_project_idx ON public.seo_findings(owner_id,project_id,created_at DESC);

-- Owner isolation + composite same-project foreign keys. All new workflows disabled.
DO $$
DECLARE target text;
BEGIN
 FOREACH target IN ARRAY ARRAY['workflow_definitions','workflow_runs','workflow_step_runs','seo_crawl_runs','seo_site_urls','seo_findings']
 LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',target);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()))',target||'_owner_only',target);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated',target);
 END LOOP;
END $$;
