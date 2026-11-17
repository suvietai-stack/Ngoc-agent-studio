import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectWorkspaceHref,projectFromOwnedList,allowedWorkspaceTab} from "../src/lib/project-entry.mjs";
const a="7a61fe99-fede-4238-ba3e-06e8a227d63b",b="b2d25e90-8f8b-45c4-aa0c-8c34b1f0dcde";
test("Project first: explicit selection is required; no implicit fallback",()=>{
 const projects=[{id:a,name:"A"}];
 assert.equal(projectFromOwnedList(projects,undefined),null);
 assert.equal(projectFromOwnedList(projects,b),null);
 assert.equal(projectFromOwnedList(projects,"all"),null);
 assert.equal(projectFromOwnedList(projects,a)?.name,"A");
});
test("Workspace links always preserve the project and permitted destination tab",()=>{
 assert.equal(projectWorkspaceHref(a,"integrations"),"/?project="+a+"&tab=integrations");
 assert.equal(projectWorkspaceHref(a,"tasks"),"/?project="+a+"&tab=tasks");
 assert.equal(projectWorkspaceHref(a,"bad"),"/?project="+a);
 assert.equal(allowedWorkspaceTab("agents"),"agents");
 assert.equal(allowedWorkspaceTab("garbage"),null);
 assert.throws(()=>projectWorkspaceHref("all","home"));
});
test("Server page selects only one owned project and scopes every data request",()=>{
 const src=readFileSync(new URL("../src/app/page.tsx",import.meta.url),"utf8");
 assert.match(src,/projectFromOwnedList\(projects,requestedProject\)/);
 assert.match(src,/if\(!selectedProject\)return <ProjectGate/);
 assert.match(src,/\.eq\("project_id",selectedProject\.id\)/);
 assert.match(src,/projects:\[selectedProject\]/);
});
test("Workspace cannot switch to an all-project filter or lose project after callback",()=>{
 const src=readFileSync(new URL("../src/components/workspace.tsx",import.meta.url),"utf8");
 assert.doesNotMatch(src,/<option value="all">Tất cả dự án/);
 assert.match(src,/projectWorkspaceHref\(filter/);
 assert.match(src,/Chuyển dự án/);
});
