-- Strict project boundaries for dedicated Ngoc Agent Studio Supabase only.
ALTER TABLE public.agents ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.knowledge_items ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.dom_messages ALTER COLUMN project_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS agents_owner_project_key ON public.agents(id,owner_id,project_id);
CREATE UNIQUE INDEX IF NOT EXISTS tasks_owner_project_key ON public.tasks(id,owner_id,project_id);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_agent_same_project_fk
 FOREIGN KEY(agent_id,owner_id,project_id) REFERENCES public.agents(id,owner_id,project_id)
 ON DELETE SET NULL (agent_id);
ALTER TABLE public.automation_schedules ADD CONSTRAINT schedules_agent_same_project_fk
 FOREIGN KEY(agent_id,owner_id,project_id) REFERENCES public.agents(id,owner_id,project_id)
 ON DELETE SET NULL (agent_id);
ALTER TABLE public.content_assets ADD CONSTRAINT assets_task_same_project_fk
 FOREIGN KEY(task_id,owner_id,project_id) REFERENCES public.tasks(id,owner_id,project_id)
 ON DELETE SET NULL (task_id);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_dependency_same_project_fk
 FOREIGN KEY(depends_on_task_id,owner_id,project_id) REFERENCES public.tasks(id,owner_id,project_id)
 ON DELETE RESTRICT;
ALTER TABLE public.task_runs ADD COLUMN IF NOT EXISTS project_id uuid;
UPDATE public.task_runs AS r SET project_id=t.project_id FROM public.tasks AS t
 WHERE r.task_id=t.id AND r.owner_id=t.owner_id AND r.project_id IS NULL;
ALTER TABLE public.task_runs ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.task_runs ADD CONSTRAINT runs_project_owner_fk
 FOREIGN KEY(project_id,owner_id) REFERENCES public.projects(id,owner_id) ON DELETE CASCADE;
ALTER TABLE public.task_runs ADD CONSTRAINT runs_task_same_project_fk
 FOREIGN KEY(task_id,owner_id,project_id) REFERENCES public.tasks(id,owner_id,project_id)
 ON DELETE CASCADE;
ALTER TABLE public.task_runs ADD CONSTRAINT runs_agent_same_project_fk
 FOREIGN KEY(agent_id,owner_id,project_id) REFERENCES public.agents(id,owner_id,project_id)
 ON DELETE SET NULL (agent_id);
CREATE INDEX IF NOT EXISTS task_runs_project_created_idx ON public.task_runs(owner_id,project_id,created_at DESC);
