-- Ngọc Agent Studio ONLY (Supabase zvbwknltooymuenpvptr).
-- Defense in depth: approved assets are immutable in PostgreSQL, not just in the UI.
CREATE OR REPLACE FUNCTION private.guard_content_asset_integrity()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'draft' THEN
   RAISE EXCEPTION 'Nội dung mới phải ở trạng thái draft.';
  END IF;
  RETURN NEW;
 END IF;
 IF OLD.status='approved' THEN
  RAISE EXCEPTION 'Nội dung đã duyệt là bất biến, không được sửa hoặc xóa.';
 END IF;
 IF TG_OP='DELETE' THEN
  RETURN OLD;
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
  OR NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.task_id IS DISTINCT FROM OLD.task_id
  OR NEW.channel IS DISTINCT FROM OLD.channel THEN
  RAISE EXCEPTION 'Không được thay đổi chủ sở hữu, dự án hoặc công việc của nội dung.';
 END IF;
 IF NEW.status='approved' AND current_user<>'postgres' THEN
  RAISE EXCEPTION 'Chỉ được phê duyệt nội dung qua hành động duyệt của ứng dụng.';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_content_asset_integrity ON public.content_assets;
CREATE TRIGGER guard_content_asset_integrity
BEFORE INSERT OR UPDATE OR DELETE ON public.content_assets
FOR EACH ROW EXECUTE FUNCTION private.guard_content_asset_integrity();

-- A directly edited task cannot claim approval without an approved content asset.
CREATE OR REPLACE FUNCTION private.guard_approved_task_integrity()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.status='approved' THEN
   RAISE EXCEPTION 'Không thể xóa công việc có nội dung đã duyệt.';
  END IF;
  RETURN OLD;
 END IF;
 IF OLD.status='approved' AND NEW IS DISTINCT FROM OLD THEN
  RAISE EXCEPTION 'Không thể thay đổi công việc đã duyệt.';
 END IF;
 IF NEW.status='approved' AND OLD.status<>'approved'
  AND NOT EXISTS(
   SELECT 1 FROM public.content_assets a
   WHERE a.task_id=OLD.id AND a.owner_id=OLD.owner_id
    AND a.project_id=OLD.project_id AND a.status='approved'
  ) THEN
  RAISE EXCEPTION 'Phải có nội dung đã duyệt trước khi duyệt công việc.';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_approved_task_integrity ON public.tasks;
CREATE TRIGGER guard_approved_task_integrity
BEFORE UPDATE OR DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION private.guard_approved_task_integrity();

-- Lock the status column from direct authenticated PostgREST mutations.
-- Draft edits still use column-scoped UPDATE(body,updated_at).
REVOKE UPDATE ON public.content_assets FROM authenticated;
GRANT UPDATE(body,updated_at) ON public.content_assets TO authenticated;

-- This is the *only* publicly callable transition from draft to approved.
-- SECURITY DEFINER is intentional because authenticated clients have no direct
-- UPDATE(status) permission. The function explicitly checks auth.uid and ownership.
CREATE OR REPLACE FUNCTION public.approve_content_asset(p_asset_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_owner uuid := (SELECT auth.uid());
 v_asset record;
 v_task uuid;
BEGIN
 IF v_owner IS NULL OR p_asset_id IS NULL THEN RETURN false; END IF;
 SELECT id,task_id,project_id INTO v_asset FROM public.content_assets
  WHERE id=p_asset_id AND owner_id=v_owner AND status='draft'
  FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF v_asset.task_id IS NOT NULL THEN
  PERFORM 1 FROM public.tasks
   WHERE id=v_asset.task_id AND project_id=v_asset.project_id AND owner_id=v_owner
   AND status='pending_approval' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
 END IF;
 UPDATE public.content_assets SET status='approved',updated_at=now()
  WHERE id=p_asset_id AND owner_id=v_owner AND status='draft';
 IF v_asset.task_id IS NOT NULL THEN
  UPDATE public.tasks SET status='approved',updated_at=now()
   WHERE id=v_asset.task_id AND owner_id=v_owner AND status='pending_approval'
   RETURNING id INTO v_task;
  IF v_task IS NULL THEN
   RAISE EXCEPTION 'Nhiệm vụ đổi trạng thái trong khi phê duyệt.';
  END IF;
 END IF;
 INSERT INTO public.audit_events(owner_id,actor_id,event_type,target_table,target_id,details)
 VALUES (v_owner,v_owner,'content.approved','content_assets',p_asset_id,
    jsonb_build_object('task_id',v_asset.task_id));
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.approve_content_asset(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.approve_content_asset(uuid) TO authenticated;

-- Recover a stale task without re-running AI or duplicating content.
-- 15 minutes is safely above the OpenAI 45-second timeout.
CREATE OR REPLACE FUNCTION public.recover_stale_task(p_task_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE
 v_owner uuid:=(SELECT auth.uid());
 v_task record;
 v_asset_status text;
 v_next_status text;
BEGIN
 IF v_owner IS NULL OR p_task_id IS NULL THEN RETURN false; END IF;
 SELECT id,project_id,updated_at INTO v_task FROM public.tasks
  WHERE id=p_task_id AND owner_id=v_owner AND status='running'
    AND updated_at < now()-interval '15 minutes'
  FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT status INTO v_asset_status FROM public.content_assets
  WHERE task_id=v_task.id AND owner_id=v_owner AND project_id=v_task.project_id
  ORDER BY created_at DESC LIMIT 1;
 v_next_status:=CASE WHEN v_asset_status='approved' THEN 'approved'
  WHEN v_asset_status='draft' THEN 'pending_approval' ELSE 'failed' END;
 UPDATE public.tasks SET status=v_next_status,updated_at=now()
  WHERE id=v_task.id AND owner_id=v_owner AND status='running';
 UPDATE public.task_runs SET
   state=CASE WHEN v_asset_status IS NULL THEN 'failed' ELSE 'completed' END,
   summary=CASE WHEN v_asset_status IS NULL THEN 'Đã khôi phục tác vụ AI bị gián đoạn.' ELSE 'Đã tìm lại bản nháp khi khôi phục.' END,
   error_message=CASE WHEN v_asset_status IS NULL THEN 'Hết thời gian xử lý; cần chạy lại thủ công.' ELSE NULL END,
   finished_at=now()
  WHERE owner_id=v_owner AND task_id=v_task.id AND state='running';
 INSERT INTO public.audit_events(owner_id,actor_id,event_type,target_table,target_id,details)
 VALUES (v_owner,v_owner,'task.stale_recovered','tasks',v_task.id,
    jsonb_build_object('new_status',v_next_status));
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.recover_stale_task(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.recover_stale_task(uuid) TO authenticated;
