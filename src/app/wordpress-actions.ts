"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {isStudioOwner} from "@/lib/access";
import {getOpenAIKey,getStoredCredentials} from "@/lib/integration-credentials";
import {generateText} from "@/lib/ai";
import {publicHttpsGet} from "@/lib/public-http";
import {safeWpPageUrl,cleanWpProposal,editableMetaDescription,buildSafeH1Content,sameWpPermalink} from "@/lib/wordpress-guard.mjs";
import {wpFindTarget,wpReadById,wpValue,wpWrite,wpUpdateBody,type WordpressField,type WpTarget} from "@/lib/wordpress-connector";
import type {Result} from "@/app/actions";

const uuid=z.uuid();
const fail=(message:string):Result=>({ok:false,message});
const ok=(message:string):Result=>({ok:true,message});
function reason(e:unknown){return e instanceof Error?e.message.slice(0,230):"WordPress không hoàn thành thao tác."}
async function context(projectId:string){
 const db=await createClient();
 const {data:{user},error}=await db.auth.getUser();
 if(error||!user||!isStudioOwner(user.id))throw new Error("Chỉ chủ dự án được thực thi thay đổi WordPress.");
 const {data:project}=await db.from("projects").select("id,website_url,status").eq("id",projectId).eq("owner_id",user.id).maybeSingle();
 if(!project||project.status!=="active"||!project.website_url)throw new Error("Dự án cần hoạt động và đã khai báo website.");
 const {data:integration}=await db.from("integrations").select("connection_status").eq("owner_id",user.id).eq("project_id",projectId).eq("provider","wordpress").maybeSingle();
 if(integration?.connection_status!=="connected")throw new Error("Hãy kiểm tra lại kết nối WordPress trước.");
 const secrets=await getStoredCredentials(db,user.id,projectId,"wordpress");
 if(!secrets?.username||!secrets?.appPassword)throw new Error("Chưa có WordPress Application Password.");
 return {db,user,site:project.website_url,auth:{username:secrets.username,appPassword:secrets.appPassword}};
}
function fieldBefore(target:WpTarget,field:WordpressField,metaKey:string|null){
 return wpValue(target,field,metaKey);
}
function verifyIdentity(target:WpTarget,site:string,proposal:{field:string;target_url:string;resource:string;wp_id:number}){
 if(target.collection!==proposal.resource||target.id!==proposal.wp_id)
  throw new Error("Định danh WordPress đã thay đổi.");
 if(proposal.field==="image_alt"){
  if(target.sourceUrl!==proposal.target_url)throw new Error("Ảnh WordPress đã đổi đường dẫn.");
 }else if(!sameWpPermalink(target.url,proposal.target_url,site)){
  throw new Error("Đường dẫn bài viết đã thay đổi. Dừng để tránh sửa nhầm.");
 }
}
async function record(db:Awaited<ReturnType<typeof createClient>>,owner:string,projectId:string,eventType:string,proposalId:string){
 await db.from("audit_events").insert({owner_id:owner,actor_id:owner,event_type:eventType,target_table:"wordpress_changes",target_id:proposalId,details:{project_id:projectId}});
}
export async function prepareWordPressChangeAction(form:FormData):Promise<Result>{
 const input=z.object({
  project_id:uuid,field:z.enum(["post_title","h1","seo_description","image_alt"]),
  target_url:z.string().trim().max(1200),media_id:z.coerce.number().int().positive().optional()
 }).safeParse({
  project_id:form.get("project_id"),field:form.get("field"),target_url:form.get("target_url")||"",
  media_id:form.get("media_id")||undefined
 });
 if(!input.success)return fail("Cần chọn loại sửa và URL chính xác (ALT ảnh cần Media ID).");
 try{
  const p=input.data;
  const {db,user,site,auth}=await context(p.project_id);
  const aiKey=await getOpenAIKey(db,user.id,p.project_id);
  if(!aiKey)return fail("Chưa xác minh OpenAI của dự án.");
  if(p.field!=="image_alt")safeWpPageUrl(p.target_url,site);
  const target=await wpFindTarget(site,auth,p.target_url,p.field,p.media_id);
  const metaKey=p.field==="seo_description"?editableMetaDescription(target.meta):null;
  if(p.field==="seo_description"&&!metaKey)
   return fail("Chưa có trường SEO Meta Description được plugin cho phép đọc qua WordPress REST API. Không thể ghi an toàn; cần adapter cho plugin đang dùng.");
  if(p.field==="h1"){
   if(target.collection==="media")return fail("Ảnh không có H1.");
   buildSafeH1Content(target.content,"H1 minh họa hợp lệ");
   const publicUrl=safeWpPageUrl(target.url,site);
   const live=await publicHttpsGet(publicUrl,{maxBytes:300000,timeoutMs:12000});
   if(live.status!==200)throw new Error("Không đọc được HTML công khai trước khi tạo bản sửa H1.");
   if(/<h1\b/i.test(live.body.toString("utf8")))
    return fail("HTML công khai đã có H1; không tự thêm H1 trùng. Hãy xem lại báo cáo Audit.");
  }
  const before=fieldBefore(target,p.field,metaKey);
  if(before.length>110000)return fail("Bài có nội dung quá lớn để hỗ trợ khôi phục an toàn.");
  const plain=target.rendered.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,3700);
  const fieldLabel={post_title:"tiêu đề WordPress",h1:"H1 đầu nội dung",seo_description:"meta description qua plugin đã đăng ký REST",image_alt:"ALT cho ảnh WordPress"}[p.field];
  const subject=p.field==="image_alt"?(target.sourceUrl+"; tên: "+target.title):("URL: "+target.url+"; tiêu đề hiện có: "+target.title+"; nội dung: "+plain);
  const constraints="Chỉ trả về duy nhất một dòng văn bản tiếng Việt cho trường "+fieldLabel+". Không Markdown, không HTML, không kèm lời dẫn. Không tự bịa tên sản phẩm, giá, thông số, chứng nhận hoặc ưu đãi. Sử dụng đúng dữ kiện được cung cấp, nếu thiếu thì viết trung tính.";
  const generated=await generateText(constraints,"Dự án: "+site+". Tài nguyên: "+subject+". Giá trị hiện tại: "+(p.field==="h1"?"chưa có H1":before.slice(0,500))+". Hãy đề xuất nội dung mới rõ ràng, hữu ích, tránh nhồi từ khóa.","gpt-4.1-mini",aiKey);
  const newValue=cleanWpProposal(generated.text,p.field);
  if(p.field!=="h1"&&newValue===before)return fail("Đề xuất giống dữ liệu cũ; không tạo thay đổi không cần thiết.");
  if(p.field==="h1")buildSafeH1Content(before,newValue);
  const targetUrl=p.field==="image_alt"?target.sourceUrl:safeWpPageUrl(target.url,site);
  const {error}=await db.from("wordpress_changes").insert({
   owner_id:user.id,project_id:p.project_id,resource:target.collection,wp_id:target.id,
   target_url:targetUrl,field:p.field,meta_key:metaKey,old_value:before,proposed_value:newValue,
   original_modified:target.modified,status:"pending_approval"
  });
  if(error)throw new Error("Không lưu được bản đề xuất; kiểm tra migration WordPress 010.");
  revalidatePath("/");
  return ok("Agent đã tạo bản sửa nháp cho "+targetUrl+". Xem giá trị cũ/mới và bấm 'Duyệt & áp dụng' nếu đồng ý. Website CHƯA bị sửa.");
 }catch(e){return fail(reason(e))}
}
export async function applyWordPressChangeAction(changeId:string,confirmed:boolean):Promise<Result>{
 if(!uuid.safeParse(changeId).success||confirmed!==true)return fail("Bạn phải chủ động xác nhận trước khi cập nhật WordPress.");
 try{
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user||!isStudioOwner(user.id))return fail("Chỉ chủ sở hữu được duyệt.");
  const {data:change}=await db.from("wordpress_changes").select("*").eq("id",changeId).eq("owner_id",user.id).eq("status","pending_approval").maybeSingle();
  if(!change)return fail("Không còn bản sửa chờ duyệt hoặc đã được xử lý.");
  const ctx=await context(change.project_id);
  const {data:claimed,error:claimError}=await db.from("wordpress_changes")
   .update({status:"applying",approved_at:new Date().toISOString(),updated_at:new Date().toISOString()})
   .eq("id",change.id).eq("owner_id",user.id).eq("project_id",change.project_id).eq("status","pending_approval").select("id").maybeSingle();
  if(claimError||!claimed)return fail("Bản sửa đã được người khác xử lý; không thực thi hai lần.");
  try{
   const fresh=await wpReadById(ctx.site,ctx.auth,change.resource,change.wp_id);
   verifyIdentity(fresh,ctx.site,change);
   if(fresh.modified!==change.original_modified||fieldBefore(fresh,change.field,change.meta_key)!==change.old_value)
    throw new Error("CONFLICT: Nội dung WordPress đã thay đổi sau khi AI tạo bản sửa. Không ghi đè, hãy tạo đề xuất mới.");
   const body=wpUpdateBody(change.field,change.old_value,change.proposed_value,change.meta_key);
   await wpWrite(ctx.site,ctx.auth,change.resource,change.wp_id,body);
   const after=await wpReadById(ctx.site,ctx.auth,change.resource,change.wp_id);
   verifyIdentity(after,ctx.site,change);
   const expected=change.field==="h1"?buildSafeH1Content(change.old_value,change.proposed_value):change.proposed_value;
   if(fieldBefore(after,change.field,change.meta_key)!==expected)
    throw new Error("WordPress nhận yêu cầu nhưng dữ liệu trả về không khớp. Cần kiểm tra trực tiếp; không tự chạy lại.");
   const {error:completeError}=await db.from("wordpress_changes")
    .update({status:"applied",applied_at:new Date().toISOString(),applied_modified:after.modified,updated_at:new Date().toISOString(),error_message:null})
    .eq("id",change.id).eq("owner_id",user.id).eq("status","applying");
   if(completeError)throw new Error("Đã ghi WordPress nhưng không lưu được trạng thái, cần kiểm tra thủ công.");
   await record(db,user.id,change.project_id,"wordpress.change_applied",change.id);
   revalidatePath("/");
   return ok("Đã cập nhật WordPress và đọc lại API xác nhận giá trị mới. Có thể Hoàn tác trong Studio.");
  }catch(e){
   const why=reason(e),status=why.startsWith("CONFLICT:")?"conflict":"error";
   await db.from("wordpress_changes").update({status,error_message:why,updated_at:new Date().toISOString()})
    .eq("id",change.id).eq("owner_id",user.id).eq("status","applying");
   revalidatePath("/");
   return fail(status==="conflict"?why:"Chưa xác minh hoàn tất: "+why+" Không tự thử lại để tránh ghi đè.");
  }
 }catch(e){return fail(reason(e))}
}
export async function rollbackWordPressChangeAction(changeId:string,confirmed:boolean):Promise<Result>{
 if(!uuid.safeParse(changeId).success||confirmed!==true)return fail("Cần xác nhận Hoàn tác bản sửa WordPress.");
 try{
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user||!isStudioOwner(user.id))return fail("Chỉ chủ sở hữu được hoàn tác.");
  const {data:change}=await db.from("wordpress_changes").select("*").eq("id",changeId).eq("owner_id",user.id).eq("status","applied").maybeSingle();
  if(!change)return fail("Bản sửa không ở trạng thái có thể hoàn tác.");
  const ctx=await context(change.project_id);
  const {data:claimed,error:claimError}=await db.from("wordpress_changes")
   .update({status:"reverting",updated_at:new Date().toISOString()})
   .eq("id",change.id).eq("owner_id",user.id).eq("status","applied").select("id").maybeSingle();
  if(claimError||!claimed)return fail("Bản sửa đang được xử lý ở nơi khác.");
  try{
   const fresh=await wpReadById(ctx.site,ctx.auth,change.resource,change.wp_id);
   verifyIdentity(fresh,ctx.site,change);
   const expected=change.field==="h1"?buildSafeH1Content(change.old_value,change.proposed_value):change.proposed_value;
   if(fresh.modified!==change.applied_modified||fieldBefore(fresh,change.field,change.meta_key)!==expected)
    throw new Error("CONFLICT: Website đã có chỉnh sửa mới; không tự ghi đè khi hoàn tác.");
   const body=change.field==="post_title"?{title:change.old_value}:
    change.field==="h1"?{content:change.old_value}:
    change.field==="image_alt"?{alt_text:change.old_value}:{meta:{[change.meta_key]:change.old_value}};
   await wpWrite(ctx.site,ctx.auth,change.resource,change.wp_id,body);
   const restored=await wpReadById(ctx.site,ctx.auth,change.resource,change.wp_id);
   if(fieldBefore(restored,change.field,change.meta_key)!==change.old_value)
    throw new Error("WordPress trả giá trị khác bản gốc; cần kiểm tra thủ công.");
   await db.from("wordpress_changes").update({status:"reverted",reverted_at:new Date().toISOString(),updated_at:new Date().toISOString()})
    .eq("id",change.id).eq("owner_id",user.id).eq("status","reverting");
   await record(db,user.id,change.project_id,"wordpress.change_reverted",change.id);
   revalidatePath("/");
   return ok("Đã hoàn tác và xác minh giá trị gốc trên WordPress.");
  }catch(e){
   const why=reason(e),status=why.startsWith("CONFLICT:")?"conflict":"error";
   await db.from("wordpress_changes").update({status,error_message:why,updated_at:new Date().toISOString()})
    .eq("id",change.id).eq("owner_id",user.id).eq("status","reverting");
   revalidatePath("/");
   return fail(why+" Không tự thử lại để tránh ghi đè.");
  }
 }catch(e){return fail(reason(e))}
}
