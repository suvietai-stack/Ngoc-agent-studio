/** SEO Audit V2: pure, directly testable extraction and measurements.
 * These are website observations, not Google ranking/indexing data.
 */
const BLOCKED=/\/(?:wp-admin|wp-json|wp-login\.php|xmlrpc\.php)(?:\/|$)|\.(?:pdf|jpe?g|png|webp|gif|svg|zip|css|js|xml|mp4|mov|xlsx?|docx?|ico|woff2?)$/i;
const EXCLUDED=/\/(?:cart|checkout|my-account|gio-hang|thanh-toan|tai-khoan)(?:\/|$)/i;
const IGNORE_Q=/[?]/;
const entityDecode=s=>String(s).replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&apos;/gi,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
export function auditUrl(input,origin){
 try{
  const site=new URL(origin),u=new URL(entityDecode(input),site);
  if(u.protocol!=="https:"||u.hostname!==site.hostname||u.port||u.username||u.password||u.search||IGNORE_Q.test(input))return null;
  if(BLOCKED.test(u.pathname)||EXCLUDED.test(u.pathname)||u.pathname.length>230)return null;
  u.hash="";
  return u.toString();
 }catch{return null;}
}
export function sitemapUrls(xml,origin,max=400){
 if(typeof xml!=="string"||xml.length>1100000)return [];
 const urls=[];const known=new Set();
 for(const m of xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)){
  const url=auditUrl(m[1].trim(),origin);
  // XML sitemap index lists .xml sitemaps; handle them in sitemapRefs, not this function.
  if(url&&!known.has(url)){known.add(url);urls.push(url);if(urls.length>=max)break;}
 }
 return urls;
}
export function sitemapRefs(xml,origin,max=5){
 if(typeof xml!=="string"||!/<sitemapindex\b/i.test(xml))return [];
 const out=[],seen=new Set(),site=new URL(origin);
 for(const m of xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)){
  try{
   const u=new URL(entityDecode(m[1].trim()),site);
   if(u.protocol==="https:"&&u.hostname===site.hostname&&!u.username&&!u.password&&!u.port&&/\.xml$/i.test(u.pathname)&&!u.search&&!seen.has(u.toString())){
    seen.add(u.toString());out.push(u.toString());if(out.length>=max)break;
   }
  }catch{}
 }
 return out;
}
export function robotsRules(raw){
 const groups=[];let agents=[],allows=[],disallows=[],collecting=false;
 const flush=()=>{if(agents.length)groups.push({agents,allows,disallows});agents=[];allows=[];disallows=[];collecting=false;};
 for(const ln of String(raw||"").split(/\r?\n/)){
  const line=ln.replace(/#.*$/,"").trim();if(!line)continue;
  const sep=line.indexOf(":");if(sep<1)continue;
  const key=line.slice(0,sep).trim().toLowerCase(),val=line.slice(sep+1).trim();
  if(key==="user-agent"){if(collecting)flush();agents.push(val.toLowerCase());}
  else if(key==="allow"||key==="disallow"){collecting=true;if(key==="allow")allows.push(val);else disallows.push(val);}
 }
 flush();
 const specific=groups.filter(g=>g.agents.some(a=>a!=="*"&&"ngocagentstudio-seoaudit".toLowerCase().includes(a)));
 const chosen=specific.length?specific:groups.filter(g=>g.agents.includes("*"));
 const allow=chosen.flatMap(g=>g.allows),disallow=chosen.flatMap(g=>g.disallows);
 const match=(rule,path)=>{if(!rule)return -1;const before=rule.replace(/\$$/,"");return path.startsWith(before)?before.length:-1;};
 return path=>{
  const a=Math.max(-1,...allow.map(rule=>match(rule,path)));
  const d=Math.max(-1,...disallow.map(rule=>match(rule,path)));
  return !(d>a);
 };
}
export function pageKind(page){
 const u=new URL(page.url),path=u.pathname.toLowerCase();
 if(page.schemaTypes?.includes("Product")||/\/(?:san-pham|product)\//.test(path))return "product";
 if(/\/(?:danh-muc-san-pham|product-category|category|danh-muc)\//.test(path))return "category";
 if(page.schemaTypes?.some(x=>/Article|BlogPosting/i.test(x)))return "article";
 return "page";
}
export function jsonLdTypes(html){
 const types=[];
 for(const m of String(html).matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{
   const root=JSON.parse(m[1]);
   function walk(v,depth){if(depth>8||!v||typeof v!=="object")return;
    if(Array.isArray(v)){v.slice(0,100).forEach(x=>walk(x,depth+1));return;}
    const type=v["@type"];if(typeof type==="string"&&!types.includes(type))types.push(type);
    else if(Array.isArray(type))for(const x of type)if(typeof x==="string"&&!types.includes(x))types.push(x);
    if(v["@graph"])walk(v["@graph"],depth+1);
   }walk(root,0);
  }catch{}
 }
 return types.slice(0,25);
}
const rank={high:0,medium:1,info:2};
export function summarizeAudit(pages,failed,discoveredCount,limit){
 const inspected=new Set(pages.map(p=>p.url));
 const titleMap=new Map();
 for(const page of pages){if(page.title){const key=page.title.trim().toLowerCase();titleMap.set(key,[...(titleMap.get(key)||[]),page]);}}
 for(const arr of titleMap.values())if(arr.length>1)for(const page of arr)page.issues.push({severity:"medium",code:"duplicate_title_sample",message:"Title trùng với "+(arr.length-1)+" URL khác trong phạm vi quét; cần kiểm tra ý định tìm kiếm."});
 const incoming=new Map([...inspected].map(url=>[url,0]));
 const targets=new Set();
 for(const page of pages)for(const url of page.links||[]){
  targets.add(url);if(incoming.has(url))incoming.set(url,(incoming.get(url)||0)+1);
 }
 for(const page of pages){page.incomingSample=incoming.get(page.url)||0;page.kind=pageKind(page);}
 const issueMap=new Map();
 for(const page of pages)for(const issue of page.issues){
  const key=issue.code;
  if(!issueMap.has(key))issueMap.set(key,{code:key,severity:issue.severity,message:issue.message,count:0,urls:[]});
  const entry=issueMap.get(key);entry.count++;if(entry.urls.length<8)entry.urls.push(page.url);
 }
 const issues=[...issueMap.values()].sort((a,b)=>rank[a.severity]-rank[b.severity]||b.count-a.count);
 const severity={high:0,medium:0,info:0};
 for(const x of issues)severity[x.severity]+=x.count;
 const kinds={product:0,category:0,article:0,page:0};
 for(const p of pages)kinds[p.kind]++;
 const missingInSample=pages.filter(p=>p.url!==pages[0]?.url&&p.incomingSample===0).map(p=>p.url);
 return {scanned:pages.length,limit,discovered:discoveredCount,failed:failed.length,severity,issues,kinds,
  internal:{uniqueTargets:targets.size,edges:[...pages].reduce((sum,p)=>sum+(p.links?.length||0),0),noIncomingInSample:missingInSample.slice(0,20),unscannedTargets:[...targets].filter(url=>!inspected.has(url)).length}};
}
export function parseAuditV2(value){
 if(typeof value!=="string"||value.length>2000000)return null;
 try{
  const r=JSON.parse(value);
  if(r?.schema!=="ngoc.seo.audit.v2"||!r?.summary||!Array.isArray(r.pages)||!Array.isArray(r.failures)||!r.scope||r.pages.length>50)return null;
  if(typeof r.scope.root!=="string"||typeof r.checkedAt!=="string"||typeof r.summary.scanned!=="number"||!r.summary.severity||!Array.isArray(r.summary.issues)||!r.summary.internal||!r.summary.kinds)return null;
  try{const u=new URL(r.scope.root);if(u.protocol!=="https:"||!u.hostname)return null;}catch{return null;}
  if(r.pages.some(p=>!p||typeof p.url!=="string"||!Array.isArray(p.issues)))return null;
  return r;
 }catch{return null;}
}
export const SEO_OFFICIAL_SOURCES=Object.freeze([
 {name:"Google Search Essentials",url:"https://developers.google.com/search/docs/essentials",area:"Nền tảng, khả năng xuất hiện, spam"},
 {name:"SEO Starter Guide",url:"https://developers.google.com/search/docs/fundamentals/seo-starter-guide",area:"Cấu trúc, nội dung, liên kết"},
 {name:"Crawl & Indexing",url:"https://developers.google.com/search/docs/crawling-indexing/overview",area:"Thu thập và lập chỉ mục"},
 {name:"Product structured data",url:"https://developers.google.com/search/docs/appearance/structured-data/product",area:"Schema sản phẩm"},
 {name:"Google Business Profile Help",url:"https://support.google.com/business/",area:"Maps, hồ sơ và uy tín địa phương"}
]);