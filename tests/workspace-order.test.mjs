import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {workspaceOrderColumn} from "../src/lib/workspace-order.mjs";
const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("SEO URL inventory is sorted by its real last_seen_at column",()=>{
 assert.equal(workspaceOrderColumn("seo_site_urls"),"last_seen_at");
 for(const table of ["projects","agents","tasks","content_assets","workflow_definitions","seo_crawl_runs","seo_findings"]){
  assert.equal(workspaceOrderColumn(table),"created_at",table);
 }
});
test("Workspace and diagnostics use the same table-specific order helper",()=>{
 const page=source("src/app/page.tsx");
 const diag=source("src/app/ket-noi/page.tsx");
 assert.match(page,/\.order\(workspaceOrderColumn\(name\),\{ascending:false\}\)/);
 assert.match(diag,/\.order\(workspaceOrderColumn\(table\),\{ascending:false\}\)/);
 assert.match(page,/seo_site_urls/);
 assert.match(diag,/seo_site_urls/);
});
test("Setup no longer misleadingly asks to create a new Supabase project",()=>{
 const setup=source("src/components/setup.tsx");
 assert.doesNotMatch(setup,/Tạo Supabase project mới|Chưa kết nối database cá nhân/);
 assert.match(setup,/Kiểm tra kết nối/);
});
