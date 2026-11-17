import {test} from "node:test";
import assert from "node:assert/strict";
import {SEO_FIRST_ROLES,SEO_FIRST_SCHEDULES,getMissingTemplateRoles} from "../src/lib/seo-first-template.mjs";

test("SEO-first reusable template includes core roles and no duplicate names",()=>{
 const names=SEO_FIRST_ROLES.map(x=>x.name.toLocaleLowerCase("vi"));
 assert.equal(new Set(names).size,names.length);
 for(const name of ["Đốm","SEO Agent","Content Agent","Social Agent","SEO Internal Link Agent","SEO Backlink & PR Agent","SEO Entity & Local Agent","Quality Auditor Agent"]){
  assert.ok(SEO_FIRST_ROLES.some(role=>role.name===name),name);
 }
 assert.ok(SEO_FIRST_ROLES.every(x=>x.purpose.length>=6&&x.instructions.length>=20));
});
test("Template installation is additive and idempotent with existing roles",()=>{
 assert.equal(getMissingTemplateRoles(SEO_FIRST_ROLES.map(x=>x.name)).length,0);
 assert.equal(getMissingTemplateRoles(["seo agent","CONTENT AGENT"]).length,SEO_FIRST_ROLES.length-2);
 assert.equal(getMissingTemplateRoles([]).length,SEO_FIRST_ROLES.length);
});
test("Schedule templates are disabled by installer and refer to defined roles",()=>{
 const names=new Set(SEO_FIRST_ROLES.map(x=>x.name));
 assert.equal(new Set(SEO_FIRST_SCHEDULES.map(x=>x.title)).size,SEO_FIRST_SCHEDULES.length);
 assert.ok(SEO_FIRST_SCHEDULES.every(s=>names.has(s.agent)&&["daily","weekly"].includes(s.frequency)));
 const src=String(SEO_FIRST_ROLES.map(a=>a.instructions).join(" ")).toLowerCase();
 assert.match(src,/không tự đăng|không tự công bố|không tự sửa/);
});
