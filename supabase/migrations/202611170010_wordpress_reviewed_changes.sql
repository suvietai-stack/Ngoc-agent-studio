-- Ngoc Agent Studio database only (zvbwknltooymuenpvptr).
-- Store reviewed per-field WordPress edits and exact before-values for safe rollback.
CREATE TABLE IF NOT EXISTS public.wordpress_changes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 project_id uuid NOT NULL,
 resource text NOT NULL CHECK(resource IN ('posts','pages','product','products','media')),
 wp_id integer NOT NULL CHECK(wp_id>0),
 target_url text NOT NULL CHECK(length(target_url) BETWEEN 12 AND 1200),
 field text NOT NULL CHECK(field IN ('post_title','h1','seo_description','image_alt')),
 meta_key text,
 old_value text NOT NULL CHECK(length(old_value)<=120000),
 proposed_value text NOT NULL CHECK(length(proposed_value) BETWEEN 8 AND 160),
 original_modified text NOT NULL DEFAULT '',
 applied_modified text,
 status text NOT NULL DEFAULT 'pending_approval' CHECK(status IN ('pending_approval','applying','applied','reverting','reverted','conflict','error')),
 error_message text,
 created_at timestamptz NOT NULL DEFAULT now(),
 approved_at timestamptz,
 applied_at timestamptz,
 reverted_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(project_id,owner_id) REFERENCES public.projects(id,owner_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS wp_changes_project_idx ON public.wordpress_changes(owner_id,project_id,created_at DESC);
ALTER TABLE public.wordpress_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY wp_changes_owner_select ON public.wordpress_changes FOR SELECT TO authenticated
 USING(owner_id=(SELECT auth.uid()));
CREATE POLICY wp_changes_owner_insert ON public.wordpress_changes FOR INSERT TO authenticated
 WITH CHECK(owner_id=(SELECT auth.uid()));
CREATE POLICY wp_changes_owner_update ON public.wordpress_changes FOR UPDATE TO authenticated
 USING(owner_id=(SELECT auth.uid())) WITH CHECK(owner_id=(SELECT auth.uid()));
REVOKE ALL ON public.wordpress_changes FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE ON public.wordpress_changes TO authenticated;

-- Status transitions cannot bypass the explicit review + apply flow via CRUD.
CREATE OR REPLACE FUNCTION private.guard_wp_reviewed_change()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Lịch sử sửa WordPress không được xóa.';
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'pending_approval' OR NEW.approved_at IS NOT NULL OR NEW.applied_at IS NOT NULL
     OR NEW.reverted_at IS NOT NULL OR NEW.applied_modified IS NOT NULL THEN
   RAISE EXCEPTION 'Thay đổi mới bắt buộc chờ người duyệt.';
  END IF;
  RETURN NEW;
 END IF;
 IF (NEW.id,NEW.owner_id,NEW.project_id,NEW.resource,NEW.wp_id,NEW.target_url,
     NEW.field,NEW.meta_key,NEW.old_value,NEW.proposed_value,NEW.original_modified,NEW.created_at)
   IS DISTINCT FROM
    (OLD.id,OLD.owner_id,OLD.project_id,OLD.resource,OLD.wp_id,OLD.target_url,
     OLD.field,OLD.meta_key,OLD.old_value,OLD.proposed_value,OLD.original_modified,OLD.created_at) THEN
  RAISE EXCEPTION 'Không được sửa dữ liệu đã đưa cho người duyệt.';
 END IF;
 IF NOT (
  (OLD.status='pending_approval' AND NEW.status='applying') OR
  (OLD.status='applying' AND NEW.status IN ('applied','conflict','error')) OR
  (OLD.status='applied' AND NEW.status='reverting') OR
  (OLD.status='reverting' AND NEW.status IN ('reverted','conflict','error'))
 ) THEN
  RAISE EXCEPTION 'Trình tự phê duyệt và thực thi WordPress không hợp lệ.';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_wp_reviewed_change ON public.wordpress_changes;
CREATE TRIGGER guard_wp_reviewed_change BEFORE INSERT OR UPDATE OR DELETE ON public.wordpress_changes
 FOR EACH ROW EXECUTE FUNCTION private.guard_wp_reviewed_change();
