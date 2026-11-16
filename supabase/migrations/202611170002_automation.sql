-- Ngoc Agent Studio v2 — independent Supabase project only.
create table if not exists public.automation_schedules (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 project_id uuid not null,
 agent_id uuid,
 title text not null check(length(trim(title)) between 4 and 180),
 brief text not null default '',
 frequency text not null check(frequency in ('daily','weekly')),
 enabled boolean not null default false,
 next_run_at timestamptz not null default now(),
 last_run_at timestamptz,
 created_at timestamptz not null default now(),
 foreign key(project_id,owner_id) references public.projects(id,owner_id) on delete cascade,
 foreign key(agent_id,owner_id) references public.agents(id,owner_id) on delete set null(agent_id)
);
create unique index if not exists automation_schedule_unique on public.automation_schedules(owner_id,project_id,title);
create index if not exists automation_due_idx on public.automation_schedules(enabled,next_run_at);
alter table public.tasks add column if not exists source text not null default 'manual';
alter table public.tasks add column if not exists schedule_id uuid references public.automation_schedules(id) on delete set null;
alter table public.task_runs add column if not exists output text;
alter table public.task_runs add column if not exists error_message text;
alter table public.task_runs add column if not exists model text;
create table if not exists public.content_assets (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 project_id uuid not null,
 task_id uuid,
 channel text not null default 'general',
 title text not null check(length(trim(title)) between 2 and 200),
 body text not null,
 status text not null default 'draft' check(status in('draft','approved')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(project_id,owner_id) references public.projects(id,owner_id) on delete cascade,
 foreign key(task_id,owner_id) references public.tasks(id,owner_id) on delete set null(task_id)
);
create index if not exists content_owner_idx on public.content_assets(owner_id,created_at desc);
create table if not exists public.dom_messages (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 project_id uuid,
 role text not null check(role in ('user','assistant')),
 content text not null check(length(content) between 1 and 16000),
 created_at timestamptz not null default now(),
 foreign key(project_id,owner_id) references public.projects(id,owner_id) on delete cascade
);
create index if not exists dom_owner_idx on public.dom_messages(owner_id,created_at desc);
alter table public.automation_schedules enable row level security;
alter table public.content_assets enable row level security;
alter table public.dom_messages enable row level security;
create policy schedules_owner on public.automation_schedules for all to authenticated
 using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy content_owner on public.content_assets for all to authenticated
 using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy dom_owner on public.dom_messages for all to authenticated
 using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy runs_owner_insert on public.task_runs for insert to authenticated
 with check(owner_id=(select auth.uid()));
create policy runs_owner_update on public.task_runs for update to authenticated
 using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
revoke all on public.automation_schedules,public.content_assets,public.dom_messages from anon;
grant select,insert,update,delete on public.automation_schedules,public.content_assets to authenticated;
grant select,insert,delete on public.dom_messages to authenticated;
grant insert,update on public.task_runs to authenticated;
create schema if not exists private;
create or replace function private.run_due_automations() returns integer
language plpgsql security invoker set search_path=''
as $$
declare s record; generated integer:=0;
begin
 for s in select * from public.automation_schedules
          where enabled=true and next_run_at<=now()
          order by next_run_at for update skip locked loop
   insert into public.tasks(owner_id,project_id,agent_id,title,brief,status,source,schedule_id)
   values(s.owner_id,s.project_id,s.agent_id,s.title,s.brief,'draft','automation',s.id);
   update public.automation_schedules set last_run_at=now(),
      next_run_at=case when s.frequency='daily'
       then greatest(now(),s.next_run_at) + interval '1 day'
       else greatest(now(),s.next_run_at) + interval '7 days' end
    where id=s.id;
   generated:=generated+1;
 end loop;
 return generated;
end $$;
revoke all on function private.run_due_automations() from public,anon,authenticated;
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
select cron.schedule('ngoc-agent-studio-queue','0 * * * *','select private.run_due_automations();');
