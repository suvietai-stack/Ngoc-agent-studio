"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {isStudioOwner} from "@/lib/access";
import {encryptCredentials,encryptionReady,getStoredCredentials,verifyConnection,type Provider} from "@/lib/integration-credentials";
import type {Result} from "@/app/actions";

const inputSchema=z.object({
 project_id:z.uuid(),
 provider:z.enum(["openai","wordpress"]),
 api_key:z.string().trim().max(4096).optional(),
 username:z.string().trim().max(200).optional(),
 app_password:z.string().max(4096).optional()
});
async function context(){
 const db=await createClient(),{data:{user},error}=await db.auth.getUser();
 if(error||!user||!isStudioOwner(user.id))throw new Error("Bạn không có quyền cấu hình kết nối.");
 return {db,user};
}
const fail=(message:string):Result=>({ok:false,message});
const done=(message:string):Result=>({ok:true,message});
export async function saveConnectionAction(form:FormData):Promise<Result>{
 const parse=inputSchema.safeParse({
  project_id:form.get("project_id"),provider:form.get("provider"),
  api_key:form.get("api_key")||"",username:form.get("username")||"",app_password:form.get("app_password")||""
 });
 if(!parse.success)return fail("Thông tin kết nối không hợp lệ.");
 const p=parse.data;
 if(!encryptionReady())return fail("Máy chủ chưa thiết lập INTEGRATION_ENCRYPTION_KEY. Không lưu API key ở dạng rõ.");
 if(p.provider==="openai"&&(!p.api_key||p.api_key.length<10))return fail("Nhập API key OpenAI hợp lệ.");
 if(p.provider==="wordpress"&&(!p.username||!p.app_password||p.app_password.length<8))return fail("Nhập tên tài khoản và WordPress Application Password.");
 try{
  const {db,user}=await context();
  const {data:project}=await db.from("projects").select("id,website_url").eq("owner_id",user.id).eq("id",p.project_id).maybeSingle();
  if(!project)return fail("Không tìm thấy dự án.");
  if(p.provider==="wordpress"&&!project.website_url)return fail("Hãy khai báo website HTTPS của dự án trước.");
  const credentials:Record<string,string>=p.provider==="openai"?{apiKey:p.api_key!}:{username:p.username!,appPassword:p.app_password!};
  const encrypted=encryptCredentials(credentials);
  const {error}=await db.from("integration_secrets").upsert({
   owner_id:user.id,project_id:p.project_id,provider:p.provider,encrypted_credentials:encrypted,
   tested_at:null,updated_at:new Date().toISOString()
  },{onConflict:"owner_id,project_id,provider"});
  if(error)return fail("Không thể lưu kết nối. Kiểm tra migration 004 và quyền truy cập.");
  const {error:statusError}=await db.from("integrations").upsert({
   owner_id:user.id,project_id:p.project_id,provider:p.provider,
   display_name:p.provider==="openai"?"OpenAI API":"WordPress",connection_status:"disconnected"
  },{onConflict:"owner_id,project_id,provider"});
  if(statusError)return fail("Đã mã hóa khóa nhưng không thể cập nhật trạng thái kết nối.");
  await db.from("audit_events").insert({owner_id:user.id,actor_id:user.id,event_type:"integration.credentials_saved",target_table:"integrations",details:{provider:p.provider,project_id:p.project_id}});
  revalidatePath("/");
  return done("Đã lưu thông tin API dưới dạng mã hóa. Chọn Kiểm tra kết nối để xác minh.");
 }catch{return fail("Không lưu được thông tin kết nối. Kiểm tra cấu hình máy chủ.");}
}
export async function testConnectionAction(projectId:string,provider:Provider):Promise<Result>{
 if(!z.uuid().safeParse(projectId).success||!z.enum(["openai","wordpress"]).safeParse(provider).success)return fail("Kết nối không hợp lệ.");
 try{
  const {db,user}=await context();
  const {data:project}=await db.from("projects").select("website_url").eq("id",projectId).eq("owner_id",user.id).maybeSingle();
  if(!project)return fail("Dự án không tồn tại.");
  const credentials=await getStoredCredentials(db,user.id,projectId,provider);
  if(!credentials)return fail("Chưa lưu thông tin API cho dự án này.");
  let verified=false;
  try{verified=await verifyConnection(provider,credentials,project.website_url);}
  catch{verified=false;}
  const {error}=await db.from("integrations").upsert({
   owner_id:user.id,project_id:projectId,provider,
   display_name:provider==="openai"?"OpenAI API":"WordPress",
   connection_status:verified?"connected":"error"
  },{onConflict:"owner_id,project_id,provider"});
  if(error)return fail("Không cập nhật được trạng thái kiểm tra.");
  if(verified)await db.from("integration_secrets").update({tested_at:new Date().toISOString()})
   .eq("owner_id",user.id).eq("project_id",projectId).eq("provider",provider);
  await db.from("audit_events").insert({owner_id:user.id,actor_id:user.id,event_type:"integration.tested",target_table:"integrations",details:{provider,project_id:projectId,ok:verified}});
  revalidatePath("/");
  return verified?done("Đã xác minh kết nối API thành công."):fail("Kết nối chưa xác minh: kiểm tra API key, quyền hoặc endpoint của dịch vụ.");
 }catch{return fail("Không thể kiểm tra API. Kiểm tra cấu hình máy chủ.");}
}
export async function disconnectAction(projectId:string,provider:Provider):Promise<Result>{
 if(!z.uuid().safeParse(projectId).success||!z.enum(["openai","wordpress"]).safeParse(provider).success)return fail("Kết nối không hợp lệ.");
 try{
  const {db,user}=await context();
  const {error}=await db.from("integration_secrets").delete().eq("owner_id",user.id).eq("project_id",projectId).eq("provider",provider);
  if(error)return fail("Không thể xóa khóa đã lưu.");
  await db.from("integrations").delete().eq("owner_id",user.id).eq("project_id",projectId).eq("provider",provider);
  await db.from("audit_events").insert({owner_id:user.id,actor_id:user.id,event_type:"integration.disconnected",target_table:"integrations",details:{provider,project_id:projectId}});
  revalidatePath("/");
  return done("Đã ngắt kết nối và xóa khóa đã lưu trong database.");
 }catch{return fail("Không thể ngắt kết nối. Vui lòng thử lại.");}
}
