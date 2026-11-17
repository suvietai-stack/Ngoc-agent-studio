import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("WordPress repair has a dedicated visible navigation entry and actual workspace panel",()=>{
 const workspace=readFileSync(new URL("../src/components/workspace.tsx",import.meta.url),"utf8");
 const seo=readFileSync(new URL("../src/components/seo-audit-center.tsx",import.meta.url),"utf8");
 assert.match(workspace,/\["wordpress","Sửa WordPress",FilePenLine\]/);
 assert.match(workspace,/tab==="wordpress"&&filter&&<WordPressRepairBoard/);
 assert.match(seo,/projectWorkspaceHref\(projectId,"wordpress"\)/);
});
