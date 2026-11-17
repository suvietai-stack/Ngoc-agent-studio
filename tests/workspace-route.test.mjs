import {test} from "node:test";
import assert from "node:assert/strict";
import {resolveWorkspaceLink} from "../src/lib/workspace-route.mjs";
const tabs=["home","agents","tasks","content","integrations"],projects=["p1","p2"];
test("Deep link opens tasks and retains its project selection",()=>{
 assert.deepEqual(resolveWorkspaceLink("?tab=tasks&project=p2",tabs,projects),{tab:"tasks",project:"p2",oauth:null});
});
test("OAuth callback opens connections with safe project and status",()=>{
 assert.deepEqual(resolveWorkspaceLink("?tab=integrations&project=p1&oauth=connected",tabs,projects),
  {tab:"integrations",project:"p1",oauth:"connected"});
});
test("Rejects unknown tabs, foreign projects and unrecognized statuses",()=>{
 assert.deepEqual(resolveWorkspaceLink("?tab=admin&project=unknown&oauth=superuser",tabs,projects),{tab:null,project:null,oauth:null});
});
