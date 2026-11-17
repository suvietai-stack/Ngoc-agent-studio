import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Proxy refreshes authenticated cookies consistently between request and response",()=>{
 const p=source("src/proxy.ts");
 assert.match(p,/auth\.getClaims\(\)/);
 assert.match(p,/request\.cookies\.set\(name,value\)/);
 assert.match(p,/response\.cookies\.set\(name,value,options\)/);
 assert.doesNotMatch(p,/auth\.getSession\(\)/);
});
test("Connection diagnostic verifies current Auth session and project-owned tables",()=>{
 const d=source("src/app/ket-noi/page.tsx");
 assert.match(d,/db\.auth\.getUser\(\)/);
 assert.match(d,/isStudioOwner\(user\.id\)/);
 assert.match(d,/\.eq\("owner_id",user\.id\)/);
 assert.match(d,/\.eq\("project_id",projectId\)/);
 assert.match(d,/workflow_definitions/);
 assert.match(d,/seo_findings/);
 assert.doesNotMatch(d,/service_role|supabase_service_role_key/i);
});
test("Login and recovery UI link to diagnostic, without asking to create a second database",()=>{
 const login=source("src/components/login.tsx");
 const setup=source("src/components/setup.tsx");
 assert.match(login,/href="\/ket-noi"/);
 assert.match(setup,/href="\/ket-noi"/);
 assert.match(login,/invalid_credentials/);
 assert.match(login,/refresh_token_already_used/);
 assert.doesNotMatch(setup,/Tạo Supabase project mới/);
});

test("Session recovery and logout only clear the current device",()=>{
 const login=source("src/components/login.tsx");
 const actions=source("src/app/actions.ts");
 assert.match(login,/auth\\.signOut\\(\\{scope:"local"\\}\\)/);
 assert.match(login,/type="button" disabled=\\{busy\\|\\|recovering\\}/);
 assert.match(login,/Không đăng nhập được\\? Xóa phiên cũ trên thiết bị/);
 assert.match(actions,/db\\.auth\\.signOut\\(\\{scope:"local"\\}\\)/);
 assert.doesNotMatch(actions,/db\\.auth\\.signOut\\(\\)/);
});
