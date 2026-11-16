-- v3: sequential, approval-gated agent workflow tasks.
-- Runs only against the independent Ngoc Agent Studio Supabase project.
alter table public.tasks
  add column if not exists workflow_id uuid,
  add column if not exists workflow_step smallint,
  add column if not exists depends_on_task_id uuid;

alter table public.tasks
  add constraint tasks_workflow_step_valid check (
    (workflow_id is null and workflow_step is null and depends_on_task_id is null)
    or
    (workflow_id is not null and workflow_step between 1 and 3 and
      ((workflow_step=1 and depends_on_task_id is null)
      or (workflow_step>1 and depends_on_task_id is not null)))
  );

alter table public.tasks
  add constraint tasks_depends_owner_fkey foreign key (depends_on_task_id, owner_id)
  references public.tasks(id, owner_id) on delete restrict;

create index if not exists tasks_workflow_owner_idx
  on public.tasks(owner_id, workflow_id, workflow_step)
  where workflow_id is not null;

-- Existing tasks RLS policies already restrict rows to owner_id=auth.uid().
-- No public permissions or automated publishing are added by this migration.
