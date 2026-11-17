import "server-only";
import {publicHttpsGet} from "@/lib/public-http";
import {parsePublicHttpsUrl} from "@/lib/network-safety.mjs";
import {inspectSeoHtml} from "@/lib/seo-crawl.mjs";
import {auditUrl,sitemapUrls,sitemapRefs,robotsRules,jsonLdTypes,summarizeAudit} from "@/lib/seo-audit-v2.mjs";
import type {AuditPage} from "@/lib/seo-audit-v2.mjs";

type Mode="quick"|"extended";

type Failed={url:string;reason:string};

export async function auditWebsite(raw:string,mode:Mode="quick"):Promise<string>{
 const site=parsePublicHttpsUrl(raw);
 const root=site.toString();
 const limit: number=mode==="extended"?30:8;
 const checkedAt=new Date().toISOString();
 const failures:Failed[]=[];
 const inspected:AuditPage[]=[];
 let robotsSource="không đọc được",sitemapSource="không tìm thấy",sitemapCount=0;
 async function fetchSafe(url:string,kind:"html"|"xml"|"text"){
  const accepted=kind==="html"?"text/html":kind==="xml"?"application/xml,text/xml":"text/plain";
  const r=await publicHttpsGet(url,{maxBytes:kind==="html"?600000:450000,timeoutMs:6000,headers:{Accept:accepted,"User-Agent":"NgocAgentStudio-SEOAudit/2.0"}});
  if(r.status!==200)throw new Error("HTTP "+r.status);
  const type=r.contentType.toLowerCase();
  if(kind==="html"&&!type.includes("text/html"))throw new Error("Không phải trang HTML.");
  if(kind==="xml"&&!(/xml|text\/plain/.test(type)))throw new Error("Không phải XML sitemap.");
  return r.body.toString("utf8");
 }
 let allowed=(_path:string)=>true;
 try{
  const robots=await fetchSafe(new URL("/robots.txt",site.origin).toString(),"text");
  allowed=robotsRules(robots);
  robotsSource="robots.txt";
 }catch{/* robots.txt may not be present; no claims of full robots validation */}
 if(!allowed(site.pathname))throw new Error("robots.txt không cho phép quét URL chính.");
 const homeHtml=await fetchSafe(root,"html");
 const home=inspectSeoHtml(homeHtml,root) as AuditPage;
 home.schemaTypes=jsonLdTypes(homeHtml);
 inspected.push(home);
 const candidates=new Set<string>([root]);
 const accept=(input:string)=>{
  const normalized=auditUrl(input,root);
  if(normalized&&allowed(new URL(normalized).pathname))candidates.add(normalized);
 };
 for(const url of home.links)accept(url);
 // Find sitemap index or sitemap.xml; a sitemap may declare up to 5 child indexes.
 const sitemapCandidates=[new URL("/sitemap.xml",site.origin).toString(),new URL("/sitemap_index.xml",site.origin).toString()];
 const visitedSitemaps=new Set<string>();
 for(const mapUrl of sitemapCandidates){
  if(visitedSitemaps.has(mapUrl))continue;
  visitedSitemaps.add(mapUrl);
  try{
   const xml=await fetchSafe(mapUrl,"xml");
   const direct=sitemapUrls(xml,root,450);
   direct.forEach(accept);
   sitemapCount+=direct.length;sitemapSource=mapUrl;
   for(const child of sitemapRefs(xml,root,4)){
    if(visitedSitemaps.has(child))continue;
    visitedSitemaps.add(child);
    try{const sub=await fetchSafe(child,"xml");const urls=sitemapUrls(sub,root,450);urls.forEach(accept);sitemapCount+=urls.length;}catch{/* some child indexes may be inaccessible */}
   }
   if(direct.length||sitemapRefs(xml,root,1).length)break;
  }catch{/* another standard sitemap location may exist */}
 }
 const initial=[...candidates].filter(url=>url!==root);
 // Diverse, bounded sample. Prioritize categories and products, then blog and other pages.
 const typePriority=(url:string)=>/danh-muc-san-pham|product-category|category/i.test(url)?0:/san-pham|product/i.test(url)?1:2;
 const fromSitemap=initial.sort((a,b)=>typePriority(a)-typePriority(b));
 const queue=fromSitemap.slice(0,limit-1);
 // Five HTTPS fetches max in parallel. Per-target HTTP and content-type failures are recorded.
 for(let index=0;index<queue.length;index+=5){
  const batch=queue.slice(index,index+5);
  const results=await Promise.allSettled(batch.map(url=>fetchSafe(url,"html")));
  results.forEach((result,i)=>{
   const url=batch[i];
   if(result.status==="fulfilled"){
    const page=inspectSeoHtml(result.value,url) as Inspected;
    page.schemaTypes=jsonLdTypes(result.value);
    inspected.push(page);
    for(const link of page.links)accept(link);
   }else failures.push({url,reason:result.reason instanceof Error?result.reason.message:"Không đọc được"});
  });
 }
 const summary=summarizeAudit(inspected,failures,candidates.size,limit);
 // The report is permanently scoped by the server-side project owner when persisted.
 const report={
  schema:"ngoc.seo.audit.v2",checkedAt,scope:{root,mode,limit,
   description:"Quét mẫu có giới hạn; không phải toàn bộ URL website hoặc dữ liệu Google Search Console.",
   dataSources:["HTML công khai",robotsSource,"Sitemap: "+sitemapSource],
   sitemapCandidates:sitemapCount},
  summary,pages:inspected,failures,
  references:["https://developers.google.com/search/docs/essentials",
   "https://developers.google.com/search/docs/fundamentals/seo-starter-guide",
   "https://developers.google.com/search/docs/crawling-indexing/overview"]
 };
 return JSON.stringify(report);
}
