"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {isStudioOwner} from "@/lib/access";
import {encryptCredentials,encryptionReady,getStoredCredentials,verifyConnection,type Provider} from "@/lib/integration-credentials";
import type {Result} from "@/app/actions";
import {isOAuthProvider,OAUTH_PROVIDERS} from "@/lib/oauth-providers";
import {testStoredOAuth} from "@/lib/oauth-server";

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
 if(!z.uuid().safeParse(projectId).success||
  (!isOAuthProvider(provider)&&provider!=="openai"&&provider!=="wordpress"))return fail("Kết nối không hợp lệ.");
 try{
  const {db,user}=await context();
  const {data:project}=await db.from("projects").select("website_url").eq("id",projectId).eq("owner_id",user.id).maybeSingle();
  if(!project)return fail("Dự án không tồn tại.");
  let verified=false,detail="";
  try{
   if(isOAuthProvider(provider)){
    const result=await testStoredOAuth(db,user.id,projectId,provider);
    verified=result.ok;detail=result.detail;
   }else{
    const credentials=await getStoredCredentials(db,user.id,projectId,provider);
    if(!credentials)return fail("Chưa lưu thông tin API cho dự án này.");
    verified=await verifyConnection(provider,credentials,project.website_url);
   }
  }catch(e){detail=e instanceof Error?e.message.slice(0,260):"Không thể xác minh quyền truy cập API.";}
  const {error}=await db.from("integrations").upsert({
   owner_id:user.id,project_id:projectId,provider,
   display_name:isOAuthProvider(provider)?OAUTH_PROVIDERS[provider].name:provider==="openai"?"OpenAI API":"WordPress",
   connection_status:verified?"connected":"error"
  },{onConflict:"owner_id,project_id,provider"});
  if(error)return fail("Không cập nhật được trạng thái kiểm tra.");
  if(verified){
   const {error:testTimeError}=await db.from("integration_secrets").update({tested_at:new Date().toISOString()})
    .eq("owner_id",user.id).eq("project_id",projectId).eq("provider",provider);
   if(testTimeError)return fail("API hợp lệ nhưng chưa ghi được thời gian xác minh.");
  }
  await db.from("audit_events").insert({owner_id:user.id,actor_id:user.id,event_type:"integration.tested",
   target_table:"integrations",details:{provider,project_id:projectId,ok:verified}});
  revalidatePath("/");
  return verified?done("Đã xác minh API thực tế. "+detail):fail("Chưa xác minh API. "+(detail||"Kiểm tra quyền, tài khoản và endpoint."));
 }catch{return fail("Không thể kiểm tra API. Kiểm tra cấu hình máy chủ.");}
}

export async function disconnectAction(projectId:string,provider:Provider):Promise<Result>{
 if(!z.uuid().safeParse(projectId).success||(!isOAuthProvider(provider)&&provider!=="openai"&&provider!=="wordpress"))return fail("Kết nối không hợp lệ.");
 try{
  const {db,user}=await context();
  const {error}=await db.from("integration_secrets").delete().eq("owner_id",user.id).eq("project_id",projectId).eq("provider",provider);
  if(error)return fail("Không thể xóa khóa đã lưu.");
  await db.from("integrations").delete().eq("owner_id",user.id).eq("project_id",projectId).eq("provider",provider);
  await db.from("audit_events").insert({owner_id:user.id,actor_id:user.id,event_type:"integration.disconnected",target_table:"integrations",details:{provider,project_id:projectId}});
  revalidatePath("/");
  return done("Đã xóa kết nối trên app. Muốn thu hồi quyền OAuth hoàn toàn, hãy gỡ quyền ứng dụng trên Google/Meta.");
 }catch{return fail("Không thể ngắt kết nối. Vui lòng thử lại.");}
}
