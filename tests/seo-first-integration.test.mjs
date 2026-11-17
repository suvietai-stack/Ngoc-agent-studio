import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Authenticated SEO audit only writes to its selected owner and project",()=>{
 const operations=file("src/app/operations.ts");
 const audit=operations.slice(operations.indexOf("export async function seoAuditAction"),operations.indexOf("/** Turn verified HTML audit"));
 assert.match(audit,/\.eq\("owner_id",user\.id\)/);
 assert.match(audit,/\.eq\("id",projectId\)/);
 assert.match(audit,/project_id:project\.id/);
 assert.match(audit,/mode/);
});
test("Audit task generation never auto-runs AI, spends ads or publishes",()=>{
 const operations=file("src/app/operations.ts");
 const section=operations.slice(operations.indexOf("export async function createSeoAuditTasksAction"),operations.indexOf("/\*\* Create a three-stage workflow"));
 assert.match(section,/\.eq\("project_id",projectId\)/);
 assert.match(section,/status:"draft",source:"seo-audit"/);
 assert.doesNotMatch(section,/generateText|runTaskAction|publish|postToFacebook|updateBudget/);
 assert.match(section,/existing\.some/);
});
test("New dashboard distinguishes real data from absent Google APIs",()=>{
 const component=file("src/components/seo-audit-center.tsx");
 assert.match(component,/parseAuditV2/);
 assert.match(component,/Chưa có số liệu/);
 assert.match(component,/chưa lấy KPI/);
 assert.match(component,/Không đủ dữ liệu/);
 assert.match(component,/Chưa có nguồn backlink/);
});
test("Knowledge importer only accepts bounded text files and keeps project scoped",()=>{
 const component=file("src/components/knowledge-manager.tsx");
 assert.match(component,/txt\|md\|csv\|json/);
 assert.match(component,/file\.size>90000/);
 assert.match(component,/payload\.set\("project_id",projectId\)/);
 assert.match(component,/chưa được xác minh tự động/);
});
