-- Ngoc Agent Studio only: encrypted provider credentials, isolated by owner/project.
-- Apply ONLY to ngoc-agent-studio-db. Never apply to Base Su Viet.
create table if not exists public.integration_secrets (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 project_id uuid not null,
 provider text not null check (provider in ('openai','wordpress')),
 encrypted_credentials text not null check (length(encrypted_credentials) between 35 and 12000),
 tested_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key (project_id,owner_id) references public.projects(id,owner_id) on delete cascade,
 unique(owner_id,project_id,provider)
);
create index if not exists integration_secrets_owner_idx
 on public.integration_secrets(owner_id,project_id);
alter table public.integration_secrets enable row level security;
create policy integration_secrets_owner on public.integration_secrets for all to authenticated
 using(owner_id = (select auth.uid()))
 with check(owner_id = (select auth.uid()));
revoke all on public.integration_secrets from anon;
grant select,insert,update,delete on public.integration_secrets to authenticated;
-- Only ciphertext is saved. The AES-256-GCM key lives on the server, not in Postgres.
