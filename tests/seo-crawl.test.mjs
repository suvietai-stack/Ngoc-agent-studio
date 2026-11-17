import {test} from "node:test";
import assert from "node:assert/strict";
import {discoverInternalLinks,inspectSeoHtml,formatSeoSampleReport} from "../src/lib/seo-crawl.mjs";
const base="https://example.com/";
const sample=`<html><head><title>Danh mục sản phẩm</title><meta name="description" content="Xem danh mục"/><link rel="canonical" href="https://example.com/"></head><body><h1>Sản phẩm</h1><a href="/bo-am-chen/">Bộ ấm chén</a><a href="https://evil.com/">Khác</a><a href="/bo-am-chen/?sort=1">lọc</a><a href="/wp-admin/">admin</a><img src="/real.jpg"></body></html>`;
test("Crawler only discovers finite same-host HTTPS content URLs",()=>{
 assert.deepEqual(discoverInternalLinks(sample,base),["https://example.com/bo-am-chen/"]);
 assert.deepEqual(discoverInternalLinks('<a href="http://example.com/insecure">X</a>',base),[]);
});
test("HTML inspection does not claim Google indexing or a rigid SEO score",()=>{
 const result=inspectSeoHtml(sample,base);
 assert.equal(result.title,"Danh mục sản phẩm");
 assert.equal(result.firstH1,"Sản phẩm");
 assert.equal(result.imageCount,1);
 assert.equal(result.imagesMissingAlt,1);
 assert.ok(result.issues.some(x=>x.code==="image_alt_review"));
 assert.ok(!result.issues.some(x=>x.code==="missing_canonical"));
});
test("Real noindex is identified as needing human verification",()=>{
 const result=inspectSeoHtml('<meta name="robots" content="noindex, follow"><title>A</title>',base);
 assert.equal(result.issues.find(x=>x.code==="noindex")?.severity,"high");
});
test("Report flags sampled scope and source guidance",()=>{
 const p=inspectSeoHtml(sample,base);
 const report=formatSeoSampleReport({startUrl:base,pages:[p],errors:[],limit:6,checkedAt:"2026-11-17T00:00:00Z"});
 assert.match(report,/không phải full crawl/);
 assert.match(report,/developers.google.com\/search\/docs/);
});
