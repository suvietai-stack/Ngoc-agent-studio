import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../supabase/migrations/202611170009_content_integrity_and_stale_recovery.sql",import.meta.url),"utf8");
test("Approved content is immutable at DB trigger level",()=>{
 assert.match(sql,/BEFORE INSERT OR UPDATE OR DELETE ON public\.content_assets/);
 assert.match(sql,/IF OLD\.status='approved'/);
 assert.match(sql,/REVOKE UPDATE ON public\.content_assets FROM authenticated/);
 assert.match(sql,/GRANT UPDATE\(body,updated_at\) ON public\.content_assets TO authenticated/);
});
test("Only owner-authorized approval transaction can mark content approved",()=>{
 assert.match(sql,/FUNCTION public\.approve_content_asset\(p_asset_id uuid\)/);
 assert.match(sql,/SECURITY DEFINER/);
 assert.match(sql,/owner_id=v_owner AND status='draft'/);
 assert.match(sql,/status='pending_approval'/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.approve_content_asset/);
});
test("Stale recover never generates a new AI result or asset",()=>{
 const fn=sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.recover_stale_task"));
 assert.match(fn,/updated_at < now\(\)-interval '15 minutes'/);
 assert.match(fn,/status='running'/);
 assert.match(fn,/audit_events/);
 assert.doesNotMatch(fn,/INSERT INTO public\.content_assets|generateText|https:\/\/api\.openai\.com/);
});
