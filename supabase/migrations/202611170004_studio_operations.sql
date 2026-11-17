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


-- Agent operation policy: no mode grants unattended external actions.
alter table public.agents
  add column if not exists operation_mode text not null default 'supervised',
  add column if not exists daily_run_limit smallint not null default 10;
alter table public.agents
  add constraint agent_operation_mode_valid check(operation_mode in ('manual','supervised','scheduled'));
alter table public.agents
  add constraint agent_daily_run_limit_valid check(daily_run_limit between 1 and 100);

alter table public.ai_usage_events add column if not exists agent_id uuid;
alter table public.ai_usage_events add constraint ai_usage_events_agent_owner_fkey
  foreign key(agent_id,owner_id) references public.agents(id,owner_id) on delete set null (agent_id);

-- Preserve previously enabled schedules that have a valid, assigned agent.
update public.agents a set operation_mode='scheduled'
where exists (
  select 1 from public.automation_schedules s
  where s.agent_id=a.id and s.owner_id=a.owner_id and s.enabled=true
    and (a.project_id is null or a.project_id=s.project_id)
);

-- Stop unassigned/incompatible schedules rather than spawning orphan tasks.
update public.automation_schedules s set enabled=false
where s.enabled and not exists (
  select 1 from public.agents a
  where a.id=s.agent_id and a.owner_id=s.owner_id and a.enabled=true
    and a.operation_mode='scheduled'
    and (a.project_id is null or a.project_id=s.project_id)
);

-- Enforce a rolling 24-hour per-agent execution cap, even for parallel requests.
create or replace function public.enforce_agent_daily_limit()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare v_limit int; v_enabled boolean; v_used int;
begin
  if new.agent_id is null then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(new.owner_id::text), pg_catalog.hashtext(new.agent_id::text)
  );
  select a.daily_run_limit,a.enabled into v_limit,v_enabled
  from public.agents a where a.id=new.agent_id and a.owner_id=new.owner_id;
  if v_limit is null or not v_enabled then
    raise exception 'Agent không tồn tại hoặc đang tắt';
  end if;
  select count(*) into v_used from public.task_runs
  where owner_id=new.owner_id and agent_id=new.agent_id
    and created_at > pg_catalog.now()-interval '24 hours';
  if v_used >= v_limit then
    raise exception 'Agent đã đạt giới hạn % lượt trong 24 giờ', v_limit;
  end if;
  return new;
end $$;
revoke all on function public.enforce_agent_daily_limit() from public,anon,authenticated;
drop trigger if exists agent_run_quota_guard on public.task_runs;
create trigger agent_run_quota_guard before insert on public.task_runs
  for each row execute function public.enforce_agent_daily_limit();

-- Deactivate schedules immediately when Agent is paused or switched out of scheduled mode.
create or replace function public.pause_incompatible_schedules()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
  if new.enabled=false or new.operation_mode<>'scheduled' then
    update public.automation_schedules
    set enabled=false
    where owner_id=new.owner_id and agent_id=new.id and enabled=true;
  end if;
  return new;
end $$;
revoke all on function public.pause_incompatible_schedules() from public,anon,authenticated;
drop trigger if exists pause_schedules_on_agent_change on public.agents;
create trigger pause_schedules_on_agent_change
  after update of enabled,operation_mode on public.agents
  for each row execute function public.pause_incompatible_schedules();

-- Supabase Cron only creates queue drafts for explicitly scheduled, enabled Agents.
create or replace function private.run_due_automations() returns integer
language plpgsql security invoker set search_path=''
as $$
declare s record; generated integer:=0;
begin
 for s in
  select schedule.* from public.automation_schedules schedule
  join public.agents agent on agent.id=schedule.agent_id and agent.owner_id=schedule.owner_id
  where schedule.enabled=true and schedule.next_run_at<=pg_catalog.now()
    and agent.enabled=true and agent.operation_mode='scheduled'
    and (agent.project_id is null or agent.project_id=schedule.project_id)
  order by schedule.next_run_at
  for update of schedule skip locked
 loop
  insert into public.tasks(owner_id,project_id,agent_id,title,brief,status,source,schedule_id)
  values(s.owner_id,s.project_id,s.agent_id,s.title,s.brief,'draft','automation',s.id);
  update public.automation_schedules set last_run_at=pg_catalog.now(),
    next_run_at=case when s.frequency='daily'
       then greatest(pg_catalog.now(),s.next_run_at) + interval '1 day'
       else greatest(pg_catalog.now(),s.next_run_at) + interval '7 days' end
  where id=s.id;
  generated:=generated+1;
 end loop;
 return generated;
end $$;
revoke all on function private.run_due_automations() from public,anon,authenticated;
