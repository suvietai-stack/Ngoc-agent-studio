-- Ngoc Agent Studio v4: review lifecycle + usage metering + task cancellation.
-- Apply only to ngoc-agent-studio-db (never Base Su Viet).
alter table public.content_assets
  add column if not exists review_note text not null default '',
  add column if not exists reviewed_at timestamptz;
alter table public.content_assets
  add constraint content_review_note_limit check (length(review_note)<=2000);
alter table public.content_assets drop constraint if exists content_assets_status_check;
alter table public.content_assets
  add constraint content_assets_status_check
  check (status in ('draft','approved','rejected'));

alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks
  add constraint tasks_status_check
  check (status in ('draft','pending_approval','approved','running','done','failed','canceled'));

create table if not exists public.ai_usage_events(
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid,
  task_id uuid,
  kind text not null check(kind in ('task','chat')),
  model text not null check(length(model) between 2 and 100),
  input_tokens integer check(input_tokens>=0),
  output_tokens integer check(output_tokens>=0),
  created_at timestamptz not null default now(),
  foreign key(project_id,owner_id) references public.projects(id,owner_id) on delete cascade,
  foreign key(task_id,owner_id) references public.tasks(id,owner_id) on delete set null (task_id)
);
create index if not exists usage_owner_created_idx on public.ai_usage_events(owner_id,created_at desc);
alter table public.ai_usage_events enable row level security;
create policy usage_owner_select on public.ai_usage_events for select to authenticated
 using(owner_id=(select auth.uid()));
create policy usage_owner_insert on public.ai_usage_events for insert to authenticated
 with check(owner_id=(select auth.uid()));
revoke all on public.ai_usage_events from anon;
grant select,insert on public.ai_usage_events to authenticated;

-- RLS for existing content_assets/tasks is retained unchanged.
