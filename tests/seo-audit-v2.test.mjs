import {test} from "node:test";
import assert from "node:assert/strict";
import {auditUrl,sitemapUrls,sitemapRefs,robotsRules,summarizeAudit,parseAuditV2,jsonLdTypes} from "../src/lib/seo-audit-v2.mjs";
import {inspectSeoHtml} from "../src/lib/seo-crawl.mjs";
const origin="https://example.com/";
test("Only same-domain public HTTPS content URLs are audit candidates",()=>{
 assert.equal(auditUrl("/danh-muc/",origin),"https://example.com/danh-muc/");
 assert.equal(auditUrl("https://evil.com/link",origin),null);
 assert.equal(auditUrl("http://example.com/not-tls",origin),null);
 assert.equal(auditUrl("https://example.com/wp-json/",origin),null);
 assert.equal(auditUrl("https://example.com/cart/",origin),null);
 assert.equal(auditUrl("https://example.com/product?orderby=price",origin),null);
});
test("Index and URL sitemap parsing is bounded",()=>{
 const index="<sitemapindex><sitemap><loc>https://example.com/products.xml</loc></sitemap></sitemapindex>";
 assert.deepEqual(sitemapRefs(index,origin),["https://example.com/products.xml"]);
 assert.deepEqual(sitemapUrls(index,origin),[]);
 const xml="<urlset><url><loc>https://example.com/a</loc></url><url><loc>https://evil.com/b</loc></url><url><loc>https://example.com/c</loc></url></urlset>";
 assert.deepEqual(sitemapUrls(xml,origin,1),["https://example.com/a"]);
});
test("Robots excludes explicitly disallowed URLs",()=>{
 const allowed=robotsRules("User-agent: *\nDisallow: /private\nAllow: /private/public\nUser-agent: anotherbot\nDisallow: /");
 assert.equal(allowed("/private/file"),false);
 assert.equal(allowed("/private/public/about"),true);
 assert.equal(allowed("/public"),true);
});
test("Audit summary counts observed findings and never invents ranking",()=>{
 const a=inspectSeoHtml("<title>A</title><h1>A</h1><a href='/b'>B</a>",origin);
 a.schemaTypes=[];a.issues=[]; const b=inspectSeoHtml("<title>A</title><h1>B</h1>",origin+"b");
 b.schemaTypes=[];b.issues=[];
 const summary=summarizeAudit([a,b],[],3,8);
 assert.equal(summary.scanned,2);
 assert.equal(summary.severity.medium,2);
 assert.equal(summary.internal.uniqueTargets,1);
 assert.equal(summary.kinds.page,2);
 assert.equal(summary.issues[0].code,"duplicate_title_sample");
});
test("V2 parser rejects fake and unsupported payloads",()=>{
 assert.equal(parseAuditV2("garbage"),null);
 assert.equal(parseAuditV2(JSON.stringify({schema:"ngoc.seo.audit.v2"})),null);
 assert.deepEqual(jsonLdTypes('<script type="application/ld+json">{"@type":"Product"}</script>'),["Product"]);
});
