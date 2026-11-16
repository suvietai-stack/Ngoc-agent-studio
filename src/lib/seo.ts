import "server-only";
import {lookup} from "node:dns/promises";
import {isIP} from "node:net";

function isPublicIP(ip:string):boolean{
 if(ip.includes(":")){const lower=ip.toLowerCase();return /^(2|3)[0-9a-f]{3}:/.test(lower)&&!lower.startsWith("2001:db8");}
 const n=ip.split(".").map(Number);
 if(n.length!==4||n.some(x=>!Number.isInteger(x)||x<0||x>255))return false;
 const [a,b,c]=n;
 if(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===198&&b>=18&&b<=19||a===192&&b===0&&c===0||a===192&&b===0&&c===2||a===198&&b===51&&c===100||a===203&&b===0&&c===113)return false;
 return true;
}
const extract=(html:string,regex:RegExp)=>{const m=html.match(regex);return (m?.[1]||"").replace(/<[^>]*>/g,"").replace(/\s+/g," ").trim()};
function meta(html:string,name:string){
 const tags=html.match(/<meta\b[^>]*>/gi)||[];
 const tag=tags.find(t=>new RegExp(`\\b(?:name|property)\\s*=\\s*["']${name}["']`,"i").test(t));
 return tag?extract(tag,/\bcontent\s*=\s*["']([^"']*)["']/i):"";
}
export async function auditWebsite(raw:string):Promise<string>{
 const url=new URL(raw);
 if(url.protocol!=="https:"||url.username||url.password||url.port||(isIP(url.hostname)>0)||!url.hostname.includes(".")||url.hostname.length>253)
  throw new Error("Chỉ kiểm tra website HTTPS công khai, không có port hoặc địa chỉ IP.");
 const addresses=await lookup(url.hostname,{all:true});
 if(!addresses.length||addresses.some(x=>!isPublicIP(x.address)))throw new Error("Website không có địa chỉ IP công khai hợp lệ.");
 const resp=await fetch(url.toString(),{redirect:"manual",cache:"no-store",headers:{"User-Agent":"NgocAgentStudio-SEOAudit/1.0","Accept":"text/html"},signal:AbortSignal.timeout(14000)});
 if(resp.status>=300&&resp.status<400)throw new Error("Website đang chuyển hướng. Hãy nhập URL HTTPS đích.");
 if(!resp.ok)throw new Error(`Website trả về HTTP ${resp.status}.`);
 const kind=resp.headers.get("content-type")||"";
 if(!kind.includes("text/html"))throw new Error("URL không trả nội dung HTML.");
 if(Number(resp.headers.get("content-length")||0)>1000000)throw new Error("Trang quá lớn để kiểm tra.");
 if(!resp.body)throw new Error("Không đọc được nội dung trang.");
 const reader=resp.body.getReader();let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1000000)throw new Error("Trang quá lớn để kiểm tra.");chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 const html=new TextDecoder().decode(bytes);
 const title=extract(html,/<title[^>]*>([\s\S]*?)<\/title>/i);
 const description=meta(html,"description");
 const h1=(html.match(/<h1\b/gi)||[]).length;
 const firstH1=extract(html,/<h1[^>]*>([\s\S]*?)<\/h1>/i);
 const canonical=(html.match(/<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*>/i)||[])[0]||"";
 const canonicalURL=extract(canonical,/\bhref\s*=\s*["']([^"']*)["']/i);
 const robots=meta(html,"robots");
 const og=meta(html,"og:title");
 const checks=[
 `URL kiểm tra: ${url.toString()}`,
 `HTTP: ${resp.status}`,
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
