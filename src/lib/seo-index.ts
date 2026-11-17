import "server-only";
import {createClient} from "@/lib/supabase/server";
import type {SeoV2Audit} from "@/lib/seo-audit-v2.mjs";

type Database=Awaited<ReturnType<typeof createClient>>;
/** Persist factual observations. This is NOT a Google index-status API.
 * Idempotent on (owner,project,source asset); rerunning repairs partial writes.
 */
export async function indexSeoAudit(db:Database,ownerId:string,projectId:string,assetId:string,report:SeoV2Audit){
 if(report.schema!=="ngoc.seo.audit.v2"||report.pages.length>30||report.summary.issues.length>100)
  throw Error("Phạm vi dữ liệu SEO vượt giới hạn.");
 const now=new Date().toISOString();
 const {data:crawl,error:crawlError}=await db.from("seo_crawl_runs").upsert({
  owner_id:ownerId,project_id:projectId,source_asset_id:assetId,
  root_url:report.scope.root,audit_schema:report.schema,mode:report.scope.mode,
  sampled_count:report.summary.scanned,discovered_count:report.summary.discovered,
  failed_count:report.summary.failed,summary:report.summary,
  data_sources:report.scope.dataSources,checked_at:report.checkedAt
 },{onConflict:"owner_id,project_id,source_asset_id"}).select("id").single();
 if(crawlError||!crawl)throw Error("Không lưu được lần quét SEO có cấu trúc.");
 const uniquePages=new Map(report.pages.map(p=>[p.url,p]));
 if(uniquePages.size){
  const rows=[...uniquePages.values()].map(page=>({
   owner_id:ownerId,project_id:projectId,url:page.url,
   page_kind:["product","category","article","page"].includes(page.kind||"")?page.kind:"page",
   title:page.title?.slice(0,1000)||null,canonical_url:page.canonical?.slice(0,2048)||null,
   last_seen_at:now
  }));
  const {error}=await db.from("seo_site_urls").upsert(rows,{onConflict:"owner_id,project_id,url"});
  if(error)throw Error("Không lưu được URL Inventory; báo cáo nguồn vẫn được giữ.");
 }
 if(report.summary.issues.length){
  const rows=report.summary.issues.map(issue=>({
   owner_id:ownerId,project_id:projectId,crawl_id:crawl.id,
   code:issue.code,severity:issue.severity,message:issue.message,
   affected_count:issue.count,evidence:issue.urls.slice(0,12),
   source_url:report.references[0]||null,
   confidence:issue.code==="duplicate_title_sample"?"inferred":"observed",
   status:"open"
  }));
  const {error}=await db.from("seo_findings").upsert(rows,{onConflict:"owner_id,project_id,crawl_id,code"});
  if(error)throw Error("Không lưu được SEO Findings; báo cáo nguồn vẫn được giữ.");
 }
 return {crawlId:crawl.id,urls:uniquePages.size,findings:report.summary.issues.length};
}
