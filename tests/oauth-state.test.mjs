import {test} from "node:test";
import assert from "node:assert/strict";
import {packOAuthState,parseOAuthState} from "../src/lib/oauth-state.mjs";
const projectId="fa81a77b-e640-4cc7-908e-b1b449fba619";
const nonce="jD1XJsYY1rf_tuFsKCf2jb6TY_Xw9imprpsNRP9sdxo";
test("OAuth state binds nonce, provider and project",()=>{
 const packed=packOAuthState({provider:"gsc",projectId,nonce});
 assert.deepEqual(parseOAuthState(packed,nonce,["gsc","ga4"]),{provider:"gsc",projectId,nonce});
 assert.equal(parseOAuthState(packed,"incorrect",["gsc","ga4"]),null);
 assert.equal(parseOAuthState(packed,nonce,["ga4"]),null);
 assert.equal(parseOAuthState(packed,nonce+"x",["gsc"]),null);
 assert.equal(parseOAuthState("garbage",nonce,["gsc"]),null);
});
test("Unscoped or invalid project states never encode",()=>{
 assert.throws(()=>packOAuthState({provider:"gsc",projectId:"",nonce}));
 assert.throws(()=>packOAuthState({provider:"gsc",projectId,nonce:"tiny"}));
});
