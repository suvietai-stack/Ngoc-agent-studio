/** Pure HTML audit and same-site discovery. The network layer pins public IPv4 over HTTPS. */
const text=s=>String(s||"").replace(/<[^>]*>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/\s+/g," ").trim();
const getAttr=(tag,name)=>{
 const escaped=name.replace(/[.*+?^$\{\}()|[\]\\]/g,"\\$&");
 const pattern=new RegExp("(?:^|\\s)"+escaped+"\\s*=\\s*([\\\"'])(.*?)\\1","i");
 const quoted=tag.match(pattern);
 if(quoted)return quoted[2].trim();
 const unquoted=tag.match(new RegExp("(?:^|\\s)"+escaped+"\\s*=\\s*([^\\s>]+)","i"));
 return unquoted?unquoted[1].trim():"";
};
function meta(html,name){
 const tags=html.match(/<meta\b[^>]*>/gi)||[];
 const match=tags.find(tag=>getAttr(tag,"name").toLowerCase()===name||getAttr(tag,"property").toLowerCase()===name);
 return match?getAttr(match,"content"):"";
}
export function discoverInternalLinks(html,raw,max=60){
 const origin=new URL(raw);
 const result=[];
 const seen=new Set();
 for(const hit of html.matchAll(/<a\b[^>]*>/gi)){
  const href=getAttr(hit[0],"href");
  if(!href||href.startsWith("#")||href.startsWith("?"))continue;
  try{
   const url=new URL(href,origin);
   if(url.protocol!=="https:"||url.hostname!==origin.hostname||url.port||url.username||url.password)continue;
   if(/\/((wp-admin|wp-json)(\/|$)|wp-login\.php)/i.test(url.pathname))continue;
   if(/\.(?:pdf|jpe?g|png|webp|gif|svg|zip|css|js|xml|mp4|xlsx?|docx?)$/i.test(url.pathname))continue;
   if(url.search)continue; // No arbitrary queries, infinite paginated or faceted crawling.
   url.hash="";
   const value=url.toString();
   if(seen.has(value))continue;
   seen.add(value);result.push(value);
   if(result.length>=max)break;
  }catch{}
 }
 return result;
}
export function inspectSeoHtml(html,url){
 const title=text((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)||[])[1]);
 const desc=meta(html,"description");
 const h1Tags=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
 const h1=text(h1Tags[0]?.[1]);
 const canonicalTag=(html.match(/<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*>/i)||[])[0]||"";
 const canonical=getAttr(canonicalTag,"href");
 const robots=meta(html,"robots");
 const images=html.match(/<img\b[^>]*>/gi)||[];
 const imagesMissingAlt=images.filter(tag=>!getAttr(tag,"alt")).length;
 const links=discoverInternalLinks(html,url);
 const issues=[];
 if(!title)issues.push({severity:"high",code:"missing_title",message:"Thiếu title."});
 if(h1Tags.length===0)issues.push({severity:"medium",code:"missing_h1",message:"Không tìm thấy H1."});
 if(h1Tags.length>1)issues.push({severity:"info",code:"multiple_h1",message:"Có nhiều H1; kiểm tra thứ bậc heading (không mặc định là lỗi Google)."});
 if(!desc)issues.push({severity:"medium",code:"missing_description",message:"Thiếu meta description (khuyến nghị tối ưu snippet)."});
 if(/(?:^|[,\s])noindex(?:[,\s]|$)/i.test(robots))issues.push({severity:"high",code:"noindex",message:"Có noindex; cần xác nhận trang có chủ đích loại khỏi Google không."});
 if(canonical){
  try{const target=new URL(canonical,url);if(target.origin!==new URL(url).origin)issues.push({severity:"info",code:"cross_domain_canonical",message:"Canonical trỏ sang domain khác; xác minh có chủ đích."});}
  catch{issues.push({severity:"medium",code:"invalid_canonical",message:"Canonical không hợp lệ."});}
 }else issues.push({severity:"info",code:"missing_canonical",message:"Chưa thấy canonical; chỉ là khuyến nghị kiểm tra khi có URL trùng."});
 if(imagesMissingAlt)issues.push({severity:"medium",code:"image_alt_review",message:`Có ${imagesMissingAlt} ảnh chưa có ALT mô tả; xác minh ảnh trang trí trước khi bổ sung.`});
 return {url,title,description:desc,firstH1:h1,h1Count:h1Tags.length,canonical,robots,imageCount:images.length,imagesMissingAlt,links,issues,hasJsonLd:/type\s*=\s*["']application\/ld\+json["']/i.test(html)};
}
export function formatSeoSampleReport({startUrl,pages,errors,limit,checkedAt}){
 const high=pages.flatMap(p=>p.issues.filter(i=>i.severity==="high"));
 const medium=pages.flatMap(p=>p.issues.filter(i=>i.severity==="medium"));
 const known=new Set(pages.map(p=>p.url));
 const discovered=new Set(pages.flatMap(p=>p.links));
 const duplicated=pages.filter(p=>p.title&&pages.some(x=>x!==p&&x.title===p.title));
 const lines=[
 "# SEO Audit — Mẫu URL thực tế",
 "",
 `- Website: ${startUrl}`,
 `- Thời điểm: ${checkedAt}`,
 `- URL đã kiểm tra: ${pages.length}/tối đa ${limit}`,
 `- Vấn đề cần xác minh ưu tiên cao: ${high.length}`,
 `- Cảnh báo trung bình: ${medium.length}`,
 `- URL tìm thấy qua liên kết nội bộ: ${discovered.size}`,
 `- URL phát hiện nhưng chưa kiểm tra: ${[...discovered].filter(u=>!known.has(u)).length}`,
 "",
 "## Chi tiết từng URL"
 ];
 for(const p of pages){
  lines.push("",`### ${p.url}`,`- HTTP: 200 · Title: ${p.title||"THIẾU"}`,`- H1: ${p.h1Count} · ${p.firstH1||"Không có"}`,
   `- Meta description: ${p.description||"THIẾU"}`,`- Canonical: ${p.canonical||"Không phát hiện"}`,
   `- Robots: ${p.robots||"Không có meta robots"}`,
   `- Ảnh: ${p.imageCount} · cần kiểm tra ALT: ${p.imagesMissingAlt}`,
   `- Liên kết nội bộ tìm thấy: ${p.links.length} · JSON-LD: ${p.hasJsonLd?"Có":"Không phát hiện"}`);
  for(const issue of p.issues)lines.push(`- [${issue.severity.toUpperCase()}] ${issue.message}`);
 }
 if(duplicated.length){lines.push("","## Title giống nhau trong mẫu",...duplicated.map(p=>"- "+p.url));}
 if(errors.length){lines.push("","## URL không đọc được",...errors.map(e=>`- ${e.url}: ${e.error}`));}
 lines.push("","## Giới hạn và nguồn kiểm tra",
 "Đây là phép quét mẫu các trang được liên kết nội bộ (không phải full crawl). Không xác nhận Google index, thứ hạng, Core Web Vitals, backlink hoặc hiệu quả GSC/GA4.",
 "Trang thiếu meta description, canonical hoặc JSON-LD chưa chắc là lỗi Google. Hãy ưu tiên kiểm tra ngữ cảnh thực tế.",
 "Tiêu chuẩn tham khảo: https://developers.google.com/search/docs/essentials và https://developers.google.com/search/docs/fundamentals/seo-starter-guide");
 return lines.join("\n");
}
