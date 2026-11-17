import "server-only";
import {publicHttpsGet} from "@/lib/public-http";
const extract=(html:string,regex:RegExp)=>{const m=html.match(regex);return (m?.[1]||"").replace(/<[^>]*>/g,"").replace(/\s+/g," ").trim()};
function meta(html:string,name:string){
 const tags=html.match(/<meta\b[^>]*>/gi)||[];
 const tag=tags.find(t=>new RegExp(`\\b(?:name|property)\\s*=\\s*["']${name}["']`,"i").test(t));
 return tag?extract(tag,/\bcontent\s*=\s*["']([^"']*)["']/i):"";
}
export async function auditWebsite(raw:string):Promise<string>{
 const response=await publicHttpsGet(raw,{maxBytes:1000000,timeoutMs:14000,headers:{"Accept":"text/html","User-Agent":"NgocAgentStudio-SEOAudit/1.0"}});
 if(response.status<200||response.status>=300)throw new Error(`Website trả về HTTP ${response.status}.`);
 if(!response.contentType.toLowerCase().includes("text/html"))throw new Error("URL không trả nội dung HTML.");
 const html=response.body.toString("utf8");
 const title=extract(html,/<title[^>]*>([\s\S]*?)<\/title>/i);
 const description=meta(html,"description");
 const h1=(html.match(/<h1\b/gi)||[]).length;
 const firstH1=extract(html,/<h1[^>]*>([\s\S]*?)<\/h1>/i);
 const canonical=(html.match(/<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*>/i)||[])[0]||"";
 const canonicalURL=extract(canonical,/\bhref\s*=\s*["']([^"']*)["']/i);
 const robots=meta(html,"robots");
 const og=meta(html,"og:title");
 const checks=[
 `URL kiểm tra: ${raw}`,
 `HTTP: ${response.status}`,
 `Title (${title.length} ký tự): ${title||"THIẾU"}`,
 `Meta description (${description.length} ký tự): ${description||"THIẾU"}`,
 `H1: ${h1} thẻ. ${firstH1||"Không tìm thấy nội dung H1"}`,
 `Canonical: ${canonicalURL||"CHƯA PHÁT HIỆN"}`,
 `Robots: ${robots||"Không có meta robots"}`,
 `Open Graph title: ${og||"CHƯA PHÁT HIỆN"}`
 ];
 const issues:string[]=[];
 if(!title)issues.push("Thêm thẻ title duy nhất.");else if(title.length<30||title.length>65)issues.push("Xem lại độ dài title (tham khảo khoảng 30–65 ký tự).");
 if(!description)issues.push("Thêm meta description.");else if(description.length<70||description.length>165)issues.push("Xem lại độ dài mô tả (tham khảo khoảng 70–165 ký tự).");
 if(h1!==1)issues.push("Kiểm tra cấu trúc H1 (thường nên có một H1 chính).");
 if(!canonicalURL)issues.push("Cân nhắc thêm canonical để quản lý URL trùng lặp.");
 if(!og)issues.push("Bổ sung og:title để cải thiện chia sẻ social.");
 return ["# Báo cáo SEO kỹ thuật (quét HTML thực tế)","","## Thông số",...checks.map(x=>"- "+x),"","## Hạng mục cần xem xét",...(issues.length?issues.map(x=>"- "+x):["- Không phát hiện thiếu sót cơ bản trong các thẻ vừa kiểm tra."]),"","Lưu ý: Chỉ là audit HTML trang này, không phải dữ liệu Search Console, Core Web Vitals hay thứ hạng Google."].join("\n");
}
