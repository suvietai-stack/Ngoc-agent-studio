import {parsePublicHttpsUrl} from "./network-safety.mjs";
export const WP_FIELDS=["post_title","h1","seo_description","image_alt"];
export const WP_COLLECTIONS=["posts","pages","product","products"];
export const META_DESCRIPTION_KEYS=["_yoast_wpseo_metadesc","rank_math_description","_aioseo_description"];
export function safeWpPageUrl(raw,website){
 const url=parsePublicHttpsUrl(raw),root=parsePublicHttpsUrl(website);
 if(url.origin!==root.origin||url.search||url.hash||url.pathname==="/")
  throw new Error("URL phải là trang HTTPS cụ thể thuộc đúng website dự án, không có tham số.");
 const cleaned=url.pathname.replace(/\/+$/,"")||"/";
 if(cleaned.includes("/wp-admin")||cleaned.includes("/wp-json")||cleaned.includes("/wp-login"))
  throw new Error("Không được chỉnh URL quản trị/API.");
 return url.origin+cleaned+"/";
}
export function sameWpPermalink(left,right,website){
 try{return safeWpPageUrl(left,website)===safeWpPageUrl(right,website)}catch{return false}
}
export function cleanWpProposal(text,kind){
 if(!WP_FIELDS.includes(kind))throw new Error("Loại thay đổi chưa được hỗ trợ.");
 const value=String(text||"").replace(/^(?:tiêu đề|h1|description|alt|meta description)\s*:\s*/i,"")
  .replace(/^[\\\"'\u0060]+|[\\\"'\u0060]+$/g,"").replace(/\s+/g," ").trim();
 const limit=kind==="seo_description"?160:kind==="image_alt"?160:kind==="post_title"?130:115;
 if(value.length<8||value.length>limit||/[<>\u0000-\u001f]/.test(value))
  throw new Error("Đề xuất AI không đạt yêu cầu độ dài hoặc có HTML/ký tự không an toàn.");
 return value;
}
export function editableMetaDescription(meta){
 if(!meta||typeof meta!=="object"||Array.isArray(meta))return null;
 for(const key of META_DESCRIPTION_KEYS){
  if(Object.prototype.hasOwnProperty.call(meta,key)&&typeof meta[key]==="string")return key;
 }
 return null;
}
export function buildSafeH1Content(raw,text){
 if(typeof raw!=="string"||raw.trim().length<20||raw.length>85000)throw new Error("Nội dung trống, quá ngắn hoặc quá lớn; không tự sửa H1 vì có thể dùng trình dựng trang.");
 if(/<h1\b/i.test(raw))throw new Error("Nội dung đã có H1; không thêm trùng.");
 if(/elementor|vc_row|et_pb_|oxygen|fl-builder|<!--\s*wp:html\s*-->/i.test(raw))
  throw new Error("Trang dùng trình dựng/HTML tùy biến; cần adapter riêng, không tự ghi đè.");
 const clean=cleanWpProposal(text,"h1");
 const escaped=clean.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
 return '<!-- wp:heading {"level":1} -->\n<h1 class="wp-block-heading">'+escaped+'</h1>\n<!-- /wp:heading -->\n'+raw;
}
