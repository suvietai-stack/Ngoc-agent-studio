-- v6: transactional review, idempotent content and schedule state.
-- Run ONLY in standalone Supabase ngoc-agent-studio-db.
create unique index if not exists content_assets_one_per_task_idx
 on public.content_assets(task_id) where task_id is not null;

create or replace function public.approve_content_asset(p_asset_id uuid)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare v_asset record; v_task uuid; v_owner uuid := (select auth.uid());
begin
 if v_owner is null then return false; end if;
 select id,task_id,owner_id into v_asset from public.content_assets
  where id=p_asset_id and owner_id=v_owner and status='draft'
  for update;
 if not found then return false; end if;
 if v_asset.task_id is not null then
  update public.tasks set status='approved',updated_at=now()
   where id=v_asset.task_id and owner_id=v_owner and status='pending_approval'
   returning id into v_task;
  if v_task is null then return false; end if;
 end if;
 update public.content_assets set status='approved',updated_at=now()
  where id=p_asset_id and owner_id=v_owner and status='draft';
 insert into public.audit_events(owner_id,actor_id,event_type,target_table,target_id,details)
 values (v_owner,v_owner,'content.approved','content_assets',p_asset_id,
         jsonb_build_object('task_id',v_asset.task_id));
 return true;
end;
$$;
revoke all on function public.approve_content_asset(uuid) from public,anon;
grant execute on function public.approve_content_asset(uuid) to authenticated;

create or replace function public.enqueue_schedule_now(p_schedule_id uuid)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare v_schedule record; v_owner uuid := (select auth.uid()); v_task uuid;
begin
 if v_owner is null then return false; end if;
 select s.*,p.status as project_status into v_schedule
 from public.automation_schedules s join public.projects p
   on p.id=s.project_id and p.owner_id=s.owner_id
 where s.id=p_schedule_id and s.owner_id=v_owner
 for update of s;
 if not found or v_schedule.project_status<>'active' then return false; end if;
 insert into public.tasks(owner_id,project_id,agent_id,title,brief,status,source,schedule_id)
 values (v_owner,v_schedule.project_id,v_schedule.agent_id,v_schedule.title,v_schedule.brief,
         'draft','automation',v_schedule.id)
 returning id into v_task;
 update public.automation_schedules
  set last_run_at=now(),
      next_run_at=now()+case when v_schedule.frequency='daily'
                    then interval '1 day' else interval '7 days' end
 where id=v_schedule.id and owner_id=v_owner;
 insert into public.audit_events(owner_id,actor_id,event_type,target_table,target_id,details)
 values (v_owner,v_owner,'schedule.queued','tasks',v_task,
         jsonb_build_object('schedule_id',p_schedule_id));
 return true;
end;
$$;
revoke all on function public.enqueue_schedule_now(uuid) from public,anon;
grant execute on function public.enqueue_schedule_now(uuid) to authenticated;

create or replace function private.run_due_automations() returns integer
language plpgsql security invoker set search_path=''
as $$
declare s record; generated integer:=0;
begin
 for s in select a.* from public.automation_schedules a
    join public.projects p on p.id=a.project_id and p.owner_id=a.owner_id
    where a.enabled=true and a.next_run_at<=now() and p.status='active'
    order by a.next_run_at for update of a skip locked loop
   insert into public.tasks(owner_id,project_id,agent_id,title,brief,status,source,schedule_id)
   values(s.owner_id,s.project_id,s.agent_id,s.title,s.brief,'draft','automation',s.id);
   update public.automation_schedules
     set last_run_at=now(),next_run_at=
       case when s.frequency='daily' then greatest(now(),s.next_run_at)+interval '1 day'
       else greatest(now(),s.next_run_at)+interval '7 days' end
     where id=s.id;
   generated:=generated+1;
 end loop;
 return generated;
end $$;
revoke all on function private.run_due_automations() from public,anon,authenticated;
