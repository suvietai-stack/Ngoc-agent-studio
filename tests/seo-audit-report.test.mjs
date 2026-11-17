import {test} from "node:test";
import assert from "node:assert/strict";
import {parseSeoAuditReport} from "../src/lib/seo-audit-report.mjs";
import {inspectSeoHtml,formatSeoSampleReport} from "../src/lib/seo-crawl.mjs";

test("SEO dashboard metrics come exclusively from persisted audit facts",()=>{
 const page=inspectSeoHtml('<html><head><title>Test</title></head><body><a href="/category/">Danh mục</a></body></html>',"https://example.com/");
 const report=formatSeoSampleReport({startUrl:"https://example.com/",pages:[page],errors:[],limit:6,checkedAt:"2026-11-17T12:00:00Z"});
 const result=parseSeoAuditReport(report);
 assert.equal(result.scanned,1);
 assert.equal(result.high,0);
 assert.equal(result.medium,2);
 assert.equal(result.discovered,1);
 assert.equal(result.pending,1);
 assert.equal(result.pages.length,1);
 assert.equal(result.pages[0].url,"https://example.com/");
 assert.equal(result.time,"2026-11-17T12:00:00Z");
});
test("Old/unknown audit formats are never converted to invented metrics",()=>{
 assert.equal(parseSeoAuditReport("# Báo cáo SEO kỹ thuật (quét HTML thực tế)"),null);
 assert.equal(parseSeoAuditReport("# SEO Audit — Mẫu URL thực tế\n- URL đã kiểm tra: 4"),null);
 assert.equal(parseSeoAuditReport(""),null);
});
