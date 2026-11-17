import "server-only";
import {publicHttpsGet} from "@/lib/public-http";
import {inspectSeoHtml,formatSeoSampleReport} from "@/lib/seo-crawl.mjs";

/** Bounded sample crawl. Does NOT claim full-site coverage or Google index status.
 * All requests are same-host HTTPS and checked for SSRF by publicHttpsGet.
 */
export async function auditWebsite(raw:string):Promise<string>{
 const root=new URL(raw).toString();
 const limit=6, checkedAt=new Date().toISOString();
 const fetchPage=async(url:string)=>{
  const response=await publicHttpsGet(url,{
   maxBytes:500000,timeoutMs:7500,
   headers:{Accept:"text/html","User-Agent":"NgocAgentStudio-SEOAudit/2.0"}
  });
  if(response.status!==200)throw new Error("HTTP "+response.status);
  if(!response.contentType.toLowerCase().includes("text/html"))throw new Error("URL không trả HTML.");
  return inspectSeoHtml(response.body.toString("utf8"),url);
 };
 const home=await fetchPage(root);
 const pages=[home];
 const errors:{url:string;error:string}[]=[];
 const targets=home.links.filter(url=>url!==root).slice(0,limit-1);
 // Bounded requests: three parallel at most, with short timeouts and size limits.
 for(let offset=0;offset<targets.length;offset+=3){
  const results=await Promise.allSettled(targets.slice(offset,offset+3).map(url=>fetchPage(url)));
  results.forEach((result,index)=>{
   if(result.status==="fulfilled")pages.push(result.value);
   else errors.push({url:targets[offset+index],error:result.reason instanceof Error?result.reason.message:"Không đọc được"});
  });
 }
 return formatSeoSampleReport({startUrl:root,pages,errors,limit,checkedAt});
}
