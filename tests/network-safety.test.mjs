import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isPublicIPv4,parsePublicHttpsUrl} from "../src/lib/network-safety.mjs";

test("public HTTPS URL accepts only safe hostnames",()=>{
 assert.equal(parsePublicHttpsUrl("https://example.com/blog").hostname,"example.com");
 for(const s of ["http://example.com","https://127.0.0.1","https://localhost","https://user:pass@example.com","https://example.com:8443","file:///etc/passwd","https://[::1]/"]){
  assert.throws(()=>parsePublicHttpsUrl(s),undefined,s);
 }
});
test("private, reserved, and documentation IPv4 ranges are denied",()=>{
 for(const s of ["10.0.0.1","172.16.0.8","192.168.1.1","127.0.0.1","169.254.169.254","100.64.1.1","198.18.1.4","192.0.2.3","198.51.100.4","203.0.113.9","0.0.0.0","240.0.0.1","::ffff:127.0.0.1"]){
  assert.equal(isPublicIPv4(s),false,s);
 }
 assert.equal(isPublicIPv4("8.8.8.8"),true);
 assert.equal(isPublicIPv4("1.1.1.1"),true);
});

test("pinned HTTPS requests disable Node.js 22 family autoselection",()=>{
 const source=readFileSync(new URL("../src/lib/public-http.ts",import.meta.url),"utf8");
 assert.match(source,/family:\s*4,\s*autoSelectFamily:\s*false/);
 assert.match(source,/lookup:[^\n]*callback\(null,address,4\)/);
});
