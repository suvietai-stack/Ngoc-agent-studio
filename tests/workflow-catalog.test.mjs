import {test} from "node:test";
import assert from "node:assert/strict";
import {WORKFLOW_CATALOG,WORKFLOW_TEMPLATE_VERSION,AGENT_ROLE_KEYS,plannedSteps,validateWorkflow} from "../src/lib/workflow-catalog.mjs";
import {SEO_FIRST_ROLES} from "../src/lib/seo-first-template.mjs";
test("Blueprint has 13 unique, valid SEO-first versioned workflows",()=>{
 assert.equal(WORKFLOW_CATALOG.length,13);
 assert.equal(new Set(WORKFLOW_CATALOG.map(x=>x.key)).size,13);
 assert.ok(WORKFLOW_CATALOG.every(validateWorkflow));
 assert.ok(WORKFLOW_TEMPLATE_VERSION.startsWith("seo-first-standard-v"));
 assert.ok(WORKFLOW_CATALOG.every(x=>x.trigger==="manual"));
});
test("External effects are explicitly blocked and do not auto-run",()=>{
 for(const def of WORKFLOW_CATALOG){
  const steps=plannedSteps(def);
  assert.ok(steps.every(s=>s.gate!=="external"||s.status==="blocked"));
  assert.ok(steps.every(s=>s.gate==="external"||["pending","ready"].includes(s.status)));
 }
});
test("Workflow DAG validates dependencies and rejects cycles/invalid keys",()=>{
 const w={steps:[{key:"aaa",label:"Đầu vào",gate:"read",requires:["bbb"]},{key:"bbb",label:"Đầu ra",gate:"draft",requires:["aaa"]}]};
 assert.equal(validateWorkflow(w),false);
 assert.equal(validateWorkflow({steps:[{key:"a",label:"X",gate:"read",requires:[]}]}),false);
});
test("Every specialist has stable role key",()=>{
 assert.equal(Object.keys(AGENT_ROLE_KEYS).length,SEO_FIRST_ROLES.length);
 assert.ok(SEO_FIRST_ROLES.every(role=>/^[a-z0-9_]+$/.test(AGENT_ROLE_KEYS[role.name])));
 assert.equal(new Set(Object.values(AGENT_ROLE_KEYS)).size,SEO_FIRST_ROLES.length);
});
