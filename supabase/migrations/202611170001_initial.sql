-- Only run in a NEW, independent Supabase project. NEVER use Base Su Viet.
create extension if not exists pgcrypto;
create table if not exists public.projects(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 2 and 120),
 category text not null default 'SEO & Content',
 description text,
 website_url text,
 status text not null default 'active' check(status in ('active','paused','archived')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,owner_id)
);
create table if not exists public.agents(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 project_id uuid,
 name text not null,
 purpose text not null,
 instructions text not null,
 model text not null default 'gpt-4.1',
 capabilities text[] not null default array['read','research','draft']::text[],
 approval_required boolean not null default true,
 enabled boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(project_id,owner_id) references public.projects(id,owner_id) on delete cascade,
 unique(id,owner_id)
);
create table if not exists public.tasks(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 project_id uuid not null,
 agent_id uuid,
 title text not null,
 brief text,
 status text not null default 'draft' check(status in('draft','pending_approval','approved','running','done','failed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(project_id,owner_id) references public.projects(id,owner_id) on delete cascade,
 foreign key(agent_id,owner_id) references public.agents(id,owner_id) on delete set null(agent_id),
 unique(id,owner_id)
);
create table if not exists public.knowledge_items(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 project_id uuid,
 title text not null,
 content text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(project_id,owner_id) references public.projects(id,owner_id) on delete cascade,
 unique(id,owner_id)
);
create table if not exists public.integrations(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 project_id uuid not null,
 provider text not null,
 display_name text not null,
 connection_status text not null default 'disconnected' check(connection_status in ('disconnected','connected','error')),
 created_at timestamptz not null default now(),
 foreign key(project_id,owner_id) references public.projects(id,owner_id) on delete cascade,
 unique(id,owner_id),unique(owner_id,project_id,provider)
);
create table if not exists public.task_runs(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid,
 agent_id uuid,
 state text not null default 'pending' check(state in('pending','running','completed','failed')),
 summary text,
 started_at timestamptz,
 finished_at timestamptz,
 created_at timestamptz not null default now(),
 foreign key(task_id,owner_id) references public.tasks(id,owner_id) on delete cascade,
 foreign key(agent_id,owner_id) references public.agents(id,owner_id) on delete set null(agent_id)
);
create table if not exists public.audit_events(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid not null references auth.users(id),
 event_type text not null,
 target_table text not null,
 target_id uuid,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists projects_owner_idx on public.projects(owner_id,created_at desc);
create index if not exists agents_owner_idx on public.agents(owner_id,created_at desc);
create index if not exists tasks_owner_idx on public.tasks(owner_id,created_at desc);
create index if not exists knowledge_owner_idx on public.knowledge_items(owner_id,created_at desc);
create index if not exists runs_owner_idx on public.task_runs(owner_id,created_at desc);
alter table public.projects enable row level security;
alter table public.agents enable row level security;
alter table public.tasks enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.integrations enable row level security;
alter table public.task_runs enable row level security;
alter table public.audit_events enable row level security;
create policy projects_owner on public.projects for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy agents_owner on public.agents for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy tasks_owner on public.tasks for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy knowledge_owner on public.knowledge_items for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy integrations_owner on public.integrations for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy runs_read on public.task_runs for select to authenticated using(owner_id=(select auth.uid()));
create policy audit_read on public.audit_events for select to authenticated using(owner_id=(select auth.uid()));
create policy audit_insert on public.audit_events for insert to authenticated with check(owner_id=(select auth.uid()) and actor_id=(select auth.uid()));
revoke all on public.projects,public.agents,public.tasks,public.knowledge_items,public.integrations,public.task_runs,public.audit_events from anon;
grant select,insert,update,delete on public.projects,public.agents,public.tasks,public.knowledge_items,public.integrations to authenticated;
grant select on public.task_runs to authenticated;
grant select,insert on public.audit_events to authenticated;
create or replace function public.approve_task(p_task_id uuid)
returns boolean language plpgsql security invoker set search_path=''
as $$
declare v_title text;
begin
 update public.tasks set status='approved',updated_at=now()
 where id=p_task_id and owner_id=(select auth.uid()) and status='pending_approval'
 returning title into v_title;
 if not found then return false; end if;
 insert into public.audit_events(owner_id,actor_id,event_type,target_table,target_id,details)
 values ((select auth.uid()),(select auth.uid()),'task.approved','tasks',p_task_id,jsonb_build_object('title',v_title));
 return true;
end;
$$;
revoke all on function public.approve_task(uuid) from public,anon;
grant execute on function public.approve_task(uuid) to authenticated;
