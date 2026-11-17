import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("P0 new tables have owner/project foreign keys and RLS, no destructive legacy edits",()=>{
 const sql=file("supabase/migrations/202611170008_seo_first_foundation_v2.sql");
 for(const table of ["workflow_definitions","workflow_runs","workflow_step_runs","seo_crawl_runs","seo_site_urls","seo_findings"]){
  assert.match(sql,new RegExp("CREATE TABLE IF NOT EXISTS public\\."+table));
  assert.match(sql,new RegExp("'"+table+"'"));
 }
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/owner_id = \(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/REFERENCES public\.projects\(id,owner_id\)/);
 assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE|DELETE FROM public\.tasks|ALTER TABLE public\.tasks DROP/i);
});
test("Template installer links roles but does not override custom Agent instructions or enable workflows",()=>{
 const s=file("src/lib/seo-first-install.ts");
 assert.match(s,/role_key:AGENT_ROLE_KEYS/);
 assert.match(s,/customized:false/);
 assert.match(s,/enabled:false/);
 assert.match(s,/is\("role_key",null\)/);
 assert.doesNotMatch(s,/\.update\(\{[^}]*instructions:/);
});
test("Manual workflow records require project ownership, predecessor evidence and block external actions",()=>{
 const s=file("src/app/workflow-v2-actions.ts");
 assert.match(s,/step\.gate==="external"/);
 assert.match(s,/\.eq\("project_id",step\.project_id\)/);
 assert.match(s,/dependencies\.every\(key=>readyKeys\.has\(key\)\)/);
 assert.match(s,/note:z\.string\(\)\.trim\(\)\.min\(15\)/);
 assert.doesNotMatch(s,/publishWordPress|publishFacebook|changeAdsBudget|generateText/);
});
test("Normalized SEO index is written under owner/project with idempotent unique keys",()=>{
 const s=file("src/lib/seo-index.ts");
 assert.match(s,/onConflict:"owner_id,project_id,source_asset_id"/);
 assert.match(s,/onConflict:"owner_id,project_id,url"/);
 assert.match(s,/onConflict:"owner_id,project_id,crawl_id,code"/);
 assert.match(s,/owner_id:ownerId,project_id:projectId/);
});
test("Every new workspace table is owner and project filtered before reaching client",()=>{
 const s=file("src/app/page.tsx");
 for(const table of ["workflow_definitions","workflow_runs","workflow_step_runs","seo_crawl_runs","seo_site_urls","seo_findings"])
  assert.ok(s.includes('"'+table+'"'));
 assert.match(s,/\.eq\("owner_id",user\.id\)\.eq\("project_id",selectedProject\.id\)/);
});
test("Manual decision inbox does not approve or publish without opening review UI",()=>{
 const s=file("src/components/decision-inbox.tsx");
 assert.match(s,/onNavigate\("content"\)/);
 assert.match(s,/Đốm|SEO|Việc/);
 assert.doesNotMatch(s,/approveContentAction|publish|setBudget/);
});
