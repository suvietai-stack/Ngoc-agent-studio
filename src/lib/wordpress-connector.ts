import "server-only";
import {publicHttpsRequest} from "@/lib/public-http";
import {parsePublicHttpsUrl} from "@/lib/network-safety.mjs";
import {safeWpPageUrl,sameWpPermalink,WP_COLLECTIONS,editableMetaDescription,buildSafeH1Content} from "@/lib/wordpress-guard.mjs";

export type WordpressField="post_title"|"h1"|"seo_description"|"image_alt";
export type WpTarget={collection:string;id:number;url:string;sourceUrl:string;modified:string;title:string;content:string;rendered:string;alt:string;meta:Record<string,unknown>;description:string;status:string};
type Auth={username:string;appPassword:string};
function wpEndpoint(site:string,path:string):string{
 const base=parsePublicHttpsUrl(site);
 if(!/^\/(?:posts|pages|product|products|media)(?:\/\d+)?(?:\?[a-zA-Z0-9%&=._~-]+)?$/.test(path))
  throw new Error("Endpoint WordPress không hợp lệ.");
 return new URL("/wp-json/wp/v2"+path,base.origin).toString();
}
async function wpJson(site:string,auth:Auth,path:string,method:"GET"|"POST"="GET",body?:unknown):Promise<unknown|null>{
 const header="Basic "+Buffer.from(auth.username+":"+auth.appPassword,"utf8").toString("base64");
 const response=await publicHttpsRequest(wpEndpoint(site,path),{
  method,jsonBody:body,maxBytes:300000,timeoutMs:14000,
  headers:{Authorization:header,Accept:"application/json"}
 });
 if(response.status===404)return null;
 if(response.status===401)throw new Error("WordPress HTTP 401: Application Password không hợp lệ hoặc thiếu quyền.");
 if(response.status===403)throw new Error("WordPress HTTP 403: tài khoản không được sửa tài nguyên này.");
 if(response.status<200||response.status>=300)throw new Error("WordPress HTTP "+response.status+"; chưa áp dụng thay đổi.");
 if(!response.contentType.toLowerCase().includes("json"))throw new Error("WordPress không trả JSON REST API.");
 try{return JSON.parse(response.body.toString("utf8")) as unknown}catch{throw new Error("WordPress trả JSON lỗi.");}
}
function readTarget(collection:string,raw:Record<string,unknown>):WpTarget{
 const obj=(x:unknown):Record<string,unknown>=>x&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:{};
 return {collection,id:Number(raw.id),url:String(raw.link||""),sourceUrl:String(raw.source_url||""),
  modified:String(raw.modified_gmt||raw.modified||""),title:String(obj(raw.title).raw||""),
  content:String(obj(raw.content).raw||""),rendered:String(obj(raw.content).rendered||""),
  alt:String(raw.alt_text||""),meta:obj(raw.meta),description:String(obj(raw.description).raw||""),
  status:String(raw.status||"")};
}
export async function wpFindTarget(site:string,auth:Auth,rawUrl:string,field:WordpressField,mediaId?:number):Promise<WpTarget>{
 if(!auth.username||!auth.appPassword)throw new Error("Chưa có tài khoản WordPress đã mã hóa.");
 if(field==="image_alt"){
  if(typeof mediaId!=="number"||!Number.isSafeInteger(mediaId)||mediaId<1)throw new Error("ALT ảnh cần ID Media trong thư viện WordPress.");
  const raw=await wpJson(site,auth,"/media/"+mediaId+"?context=edit");
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Không tìm thấy ảnh trong Media Library.");
  const media=readTarget("media",raw as Record<string,unknown>);
  if(media.id!==mediaId||!media.sourceUrl||!String((raw as Record<string,unknown>).mime_type||"").startsWith("image/"))
   throw new Error("ID Media không phải ảnh WordPress hợp lệ.");
  return media;
 }
 const url=safeWpPageUrl(rawUrl,site);
 const path=new URL(url).pathname.replace(/\/+$/,"");
 const slug=decodeURIComponent(path.split("/").at(-1)||"");
 if(!slug||slug.length>200||slug.includes("/"))throw new Error("URL không có slug WordPress hợp lệ.");
 for(const collection of WP_COLLECTIONS){
  const list=await wpJson(site,auth,"/"+collection+"?context=edit&per_page=30&slug="+encodeURIComponent(slug));
  if(!Array.isArray(list))continue;
  for(const raw of list){
   if(!raw||typeof raw!=="object"||Array.isArray(raw))continue;
   const entry=raw as Record<string,unknown>;
   if(!sameWpPermalink(String(entry.link||""),url,site))continue;
   const target=readTarget(collection,entry);
   if(!Number.isSafeInteger(target.id)||target.id<=0)throw new Error("ID bài viết không hợp lệ.");
   const fresh=await wpJson(site,auth,"/"+collection+"/"+target.id+"?context=edit");
   if(!fresh||typeof fresh!=="object"||Array.isArray(fresh))throw new Error("Không đọc được bài viết với quyền chỉnh sửa.");
   const selected=readTarget(collection,fresh as Record<string,unknown>);
   if(!sameWpPermalink(selected.url,url,site))throw new Error("Đường dẫn WordPress đã thay đổi.");
   if(!["publish","future","draft","pending","private"].includes(selected.status))
    throw new Error("Bài viết có trạng thái không thể chỉnh sửa an toàn.");
   return selected;
  }
 }
 throw new Error("Chưa tìm được bài/trang có REST API chỉnh sửa tương ứng URL. Trang WooCommerce hoặc trình dựng có thể cần adapter riêng.");
}
export async function wpReadById(site:string,auth:Auth,collection:string,id:number):Promise<WpTarget>{
 if(!(["posts","pages","product","products","media"] as readonly string[]).includes(collection)||!Number.isSafeInteger(id)||id<=0)
  throw new Error("Loại tài nguyên/ID WordPress không hợp lệ.");
 const raw=await wpJson(site,auth,"/"+collection+"/"+id+"?context=edit");
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Tài nguyên WordPress đã bị xóa hoặc đổi quyền.");
 return readTarget(collection,raw as Record<string,unknown>);
}
export function wpValue(target:WpTarget,field:WordpressField,metaKey?:string|null):string{
 if(field==="post_title")return target.title;
 if(field==="h1")return target.content;
 if(field==="image_alt")return target.alt;
 if(field==="seo_description"){
  const key=editableMetaDescription(target.meta);
  if(!key||key!==metaKey)throw new Error("Plugin SEO không còn cung cấp trường mô tả được REST API cho phép đọc.");
  return String(target.meta[key]);
 }
 throw new Error("Trường WordPress không được hỗ trợ.");
}
export function wpUpdateBody(field:WordpressField,original:string,proposed:string,metaKey?:string|null):Record<string,unknown>{
 if(field==="post_title")return {title:proposed};
 if(field==="image_alt")return {alt_text:proposed};
 if(field==="h1")return {content:buildSafeH1Content(original,proposed)};
 if(field==="seo_description"&&metaKey&&["rank_math_description","_yoast_wpseo_metadesc","_aioseo_description"].includes(metaKey))
  return {meta:{[metaKey]:proposed}};
 throw new Error("Không thể cập nhật trường WordPress này.");
}
export async function wpWrite(site:string,auth:Auth,collection:string,id:number,body:Record<string,unknown>):Promise<void>{
 if(!(["posts","pages","product","products","media"] as readonly string[]).includes(collection)||!Number.isSafeInteger(id)||id<=0)
  throw new Error("Không được gửi bản sửa đến tài nguyên ngoài danh sách.");
 const response=await wpJson(site,auth,"/"+collection+"/"+id,"POST",body);
 if(!response||typeof response!=="object"||Array.isArray(response))throw new Error("WordPress chưa xác nhận cập nhật.");
}
