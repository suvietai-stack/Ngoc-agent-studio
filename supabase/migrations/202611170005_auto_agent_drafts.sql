-- Opt-in automatic AI drafts. Applies ONLY to ngoc-agent-studio-db.
alter table public.projects add column if not exists auto_run_enabled boolean not null default false;
create index if not exists projects_auto_run_idx
 on public.projects(owner_id,auto_run_enabled) where auto_run_enabled=true;
-- The scheduled worker only writes drafts. Human approval remains mandatory.
