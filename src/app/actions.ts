"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {isStudioOwner} from "@/lib/access";
import {parsePublicHttpsUrl} from "@/lib/network-safety.mjs";
export type Result={ok:boolean;message:string};
const fail=(message:string):Result=>({ok:false,message});
const ok=(message:string):Result=>({ok:true,message});
async function auth(){const db=await createClient();const {data:{user},error}=await db.auth.getUser();if(error||!user)throw Error("Chưa đăng nhập");if(!isStudioOwner(user.id))throw Error("Không có quyền quản trị");return {db,user}}
function err(error:unknown){if(error instanceof Error&&error.message==="Chưa đăng nhập")return "Cần đăng nhập lại.";if(error instanceof Error&&error.message==="Không có quyền quản trị")return "Tài khoản này không có quyền quản trị.";return "Không thể lưu. Kiểm tra dữ liệu, quyền hoặc cấu hình database."}
export async function createProjectAction(form:FormData):Promise<Result>{
 const p=z.object({name:z.string().trim().min(2).max(120),category:z.string().max(80),website_url:z.union([z.url().max(500),z.literal("")]),description:z.string().max(1500)}).safeParse({name:form.get("name"),category:form.get("category")||"SEO & Content",website_url:form.get("website_url")||"",description:form.get("description")||""});
 if(!p.success)return fail("Tên hoặc URL dự án chưa hợp lệ.");
 let website:string|null=null;
 if(p.data.website_url){try{website=parsePublicHttpsUrl(p.data.website_url).toString();}catch{return fail("Website dự án phải là địa chỉ HTTPS công khai, không có IP hoặc port tùy chỉnh.");}}
 try{const {db,user}=await auth();const {error}=await db.from("projects").insert({...p.data,owner_id:user.id,website_url:website});if(error)return fail(err(error));revalidatePath("/");return ok("Đã tạo dự án.");}catch(e){return fail(err(e))}
}
const cap=["read","research","draft","edit"] as const; // No external publish/send/delete implementation.
export async function createAgentAction(form:FormData):Promise<Result>{
 const p=z.object({name:z.string().trim().min(2).max(100),purpose:z.string().trim().min(6).max(500),instructions:z.string().trim().min(10).max(20000),model:z.string().trim().min(3).max(100),project_id:z.uuid(),capabilities:z.array(z.enum(cap))}).safeParse({name:form.get("name"),purpose:form.get("purpose"),instructions:form.get("instructions"),model:form.get("model")||"gpt-4.1-mini",project_id:form.get("project_id"),capabilities:form.getAll("capabilities").map(String)});
 if(!p.success)return fail("Thông tin Agent chưa đầy đủ hoặc không hợp lệ.");
 try{const {db,user}=await auth();
 const {data:project}=await db.from("projects").select("status").eq("id",p.data.project_id).eq("owner_id",user.id).maybeSingle();
 if(!project||project.status!=="active")return fail("Chọn dự án đang hoạt động cho Agent.");
 const {error}=await db.from("agents").insert({...p.data,owner_id:user.id,enabled:false,approval_required:true});if(error)return fail(err(error));revalidatePath("/");return ok("Đã tạo Agent. Bật Agent để có thể chạy nhiệm vụ AI.");}catch(e){return fail(err(e))}
}
export async function toggleAgentAction(id:string,enabled:boolean):Promise<Result>{
 if(!z.uuid().safeParse(id).success)return fail("ID Agent không hợp lệ.");
 try{const {db,user}=await auth();
 if(enabled){
  const {data:agent}=await db.from("agents").select("project_id").eq("id",id).eq("owner_id",user.id).maybeSingle();
  if(!agent?.project_id)return fail("Agent chưa có dự án hợp lệ.");
  const {data:project}=await db.from("projects").select("status").eq("id",agent.project_id).eq("owner_id",user.id).maybeSingle();
  if(project?.status!=="active")return fail("Không bật Agent khi dự án đang tạm dừng hoặc đã lưu trữ.");
 }
 const {data,error}=await db.from("agents").update({enabled}).eq("id",id).eq("owner_id",user.id).select("id").maybeSingle();if(error||!data)return fail("Không thể đổi trạng thái.");revalidatePath("/");return ok(enabled?"Đã bật Agent; có thể chạy công việc trong hàng đợi.":"Đã tắt Agent.");}catch(e){return fail(err(e))}
}
export async function createTaskAction(form:FormData):Promise<Result>{
 const p=z.object({title:z.string().trim().min(4).max(200),brief:z.string().max(5000),project_id:z.uuid(),agent_id:z.union([z.uuid(),z.literal("")]),approval:z.boolean()}).safeParse({title:form.get("title"),brief:form.get("brief")||"",project_id:form.get("project_id"),agent_id:form.get("agent_id")||"",approval:form.get("approval")==="on"});
 if(!p.success)return fail("Chọn dự án và nhập tên công việc hợp lệ.");
 try{const {db,user}=await auth();
  const {data:project}=await db.from("projects").select("status").eq("id",p.data.project_id).eq("owner_id",user.id).maybeSingle();
  if(!project||project.status!=="active")return fail("Chỉ tạo công việc cho dự án đang hoạt động.");
  if(p.data.agent_id){
   const {data:agent}=await db.from("agents").select("project_id").eq("id",p.data.agent_id).eq("owner_id",user.id).maybeSingle();
   if(!agent||agent.project_id!==p.data.project_id)return fail("Agent đã chọn không thuộc dự án này.");
  }
  const {error}=await db.from("tasks").insert({owner_id:user.id,title:p.data.title,brief:p.data.brief,project_id:p.data.project_id,agent_id:p.data.agent_id||null,status:"draft"});
  if(error)return fail(err(error));revalidatePath("/");return ok("Đã lưu nhiệm vụ vào hàng đợi. Chọn Chạy AI để tạo bản nháp.");}catch(e){return fail(err(e))}
}
export async function approveTaskAction(id:string):Promise<Result>{
 if(!z.uuid().safeParse(id).success)return fail("ID nhiệm vụ không hợp lệ.");
 try{const {db}=await auth();
  const {data:asset}=await db.from("content_assets").select("id").eq("task_id",id).eq("status","approved").limit(1).maybeSingle();
  if(!asset)return fail("Phải duyệt bản nháp tại tab Nội dung trước.");
  const {data,error}=await db.rpc("approve_task",{p_task_id:id});
  if(error||data!==true)return fail("Nhiệm vụ không còn ở trạng thái chờ duyệt.");
  revalidatePath("/");return ok("Đã đồng bộ trạng thái nhiệm vụ sau khi duyệt nội dung.");
 }catch(e){return fail(err(e))}
}
export async function createKnowledgeAction(form:FormData):Promise<Result>{
 const p=z.object({title:z.string().trim().min(2).max(180),content:z.string().trim().min(20).max(30000),project_id:z.uuid()}).safeParse({title:form.get("title"),content:form.get("content"),project_id:form.get("project_id")});
 if(!p.success)return fail("Tri thức cần tiêu đề và nội dung ít nhất 20 ký tự.");
 try{const {db,user}=await auth();
 const {data:project}=await db.from("projects").select("id").eq("id",p.data.project_id).eq("owner_id",user.id).maybeSingle();
 if(!project)return fail("Dự án tri thức không hợp lệ.");
 const {error}=await db.from("knowledge_items").insert({...p.data,owner_id:user.id});if(error)return fail(err(error));revalidatePath("/");return ok("Đã lưu tri thức; Đốm và các Agent sẽ tham khảo khi tạo nội dung.");}catch(e){return fail(err(e))}
}
export async function signOutAction(){const db=await createClient();await db.auth.signOut();revalidatePath("/")}


export async function updateKnowledgeAction(id:string,form:FormData):Promise<Result>{
 if(!z.uuid().safeParse(id).success)return fail("ID tri thức không hợp lệ.");
 const p=z.object({title:z.string().trim().min(2).max(180),content:z.string().trim().min(20).max(30000)}).safeParse({
  title:form.get("title"),content:form.get("content")
 });
 if(!p.success)return fail("Tiêu đề hoặc nội dung tri thức không hợp lệ.");
 try{
  const {db,user}=await auth();
  const {data,error}=await db.from("knowledge_items").update({...p.data,updated_at:new Date().toISOString()})
   .eq("id",id).eq("owner_id",user.id).select("id").maybeSingle();
  if(error||!data)return fail("Không cập nhật được tri thức.");
  await db.from("audit_events").insert({owner_id:user.id,actor_id:user.id,event_type:"knowledge.updated",target_table:"knowledge_items",target_id:id});
  revalidatePath("/");return ok("Đã cập nhật tri thức.");
 }catch(e){return fail(err(e))}
}
export async function deleteKnowledgeAction(id:string):Promise<Result>{
 if(!z.uuid().safeParse(id).success)return fail("ID tri thức không hợp lệ.");
 try{
  const {db,user}=await auth();
  const {data,error}=await db.from("knowledge_items").delete().eq("id",id).eq("owner_id",user.id).select("id").maybeSingle();
  if(error||!data)return fail("Không xóa được tri thức.");
  await db.from("audit_events").insert({owner_id:user.id,actor_id:user.id,event_type:"knowledge.deleted",target_table:"knowledge_items",target_id:id});
  revalidatePath("/");return ok("Đã xóa mục tri thức.");
 }catch(e){return fail(err(e))}
}


export async function updateProjectAction(id:string,form:FormData):Promise<Result>{
 if(!z.uuid().safeParse(id).success)return fail("Dự án không hợp lệ.");
 const p=z.object({name:z.string().trim().min(2).max(120),category:z.string().trim().max(80),
  website_url:z.union([z.url().max(500),z.literal("")]),description:z.string().max(1500),
  status:z.enum(["active","paused","archived"])}).safeParse({
   name:form.get("name"),category:form.get("category")||"SEO & Content",
   website_url:form.get("website_url")||"",description:form.get("description")||"",status:form.get("status")
  });
 if(!p.success)return fail("Dữ liệu dự án không hợp lệ.");
 let website:string|null=null;
 if(p.data.website_url){
  try{website=parsePublicHttpsUrl(p.data.website_url).toString();}
  catch{return fail("Website phải là địa chỉ HTTPS công khai, không có IP hoặc port tùy chỉnh.");}
 }
 try{
  const {db,user}=await auth();
  const {data,error}=await db.from("projects").update({
   ...p.data,website_url:website,
   ...(p.data.status!=="active"?{auto_run_enabled:false}:{}),updated_at:new Date().toISOString()
  }).eq("id",id).eq("owner_id",user.id).select("id").maybeSingle();
  if(error||!data)return fail("Không cập nhật được dự án.");
  await db.from("audit_events").insert({owner_id:user.id,actor_id:user.id,event_type:"project.updated",target_table:"projects",target_id:id});
  revalidatePath("/");return ok("Đã cập nhật dự án.");
 }catch(e){return fail(err(e))}
}
export async function updateAgentAction(id:string,form:FormData):Promise<Result>{
 if(!z.uuid().safeParse(id).success)return fail("Agent không hợp lệ.");
 const p=z.object({name:z.string().trim().min(2).max(100),purpose:z.string().trim().min(6).max(500),
  instructions:z.string().trim().min(10).max(20000),model:z.string().trim().min(3).max(100)}).safeParse({
   name:form.get("name"),purpose:form.get("purpose"),instructions:form.get("instructions"),model:form.get("model")
  });
 if(!p.success)return fail("Thông tin Agent không hợp lệ.");
 try{
  const {db,user}=await auth();
  const {data,error}=await db.from("agents").update({...p.data,updated_at:new Date().toISOString()})
   .eq("id",id).eq("owner_id",user.id).select("id").maybeSingle();
  if(error||!data)return fail("Không cập nhật được Agent.");
  await db.from("audit_events").insert({owner_id:user.id,actor_id:user.id,event_type:"agent.updated",target_table:"agents",target_id:id});
  revalidatePath("/");return ok("Đã cập nhật Agent.");
 }catch(e){return fail(err(e))}
}


export async function updateTaskAction(id:string,form:FormData):Promise<Result>{
 if(!z.uuid().safeParse(id).success)return fail("Công việc không hợp lệ.");
 const p=z.object({title:z.string().trim().min(4).max(200),brief:z.string().trim().max(5000),
  agent_id:z.union([z.uuid(),z.literal("")])}).safeParse({
  title:form.get("title"),brief:form.get("brief")||"",agent_id:form.get("agent_id")||""
 });
 if(!p.success)return fail("Thông tin công việc không hợp lệ.");
 try{
  const {db,user}=await auth();
  const {data:task}=await db.from("tasks").select("id,project_id,status,source")
   .eq("id",id).eq("owner_id",user.id).maybeSingle();
  if(!task||!["draft","failed"].includes(task.status)||task.source==="workflow")
   return fail("Không được sửa nhiệm vụ đang chạy, đã duyệt hoặc thuộc chuỗi Agent.");
  if(p.data.agent_id){
   const {data:agent}=await db.from("agents").select("project_id,enabled").eq("id",p.data.agent_id).eq("owner_id",user.id).maybeSingle();
   if(!agent||!agent.enabled||agent.project_id!==task.project_id)return fail("Agent không hợp lệ cho dự án này.");
  }
  const {data,error}=await db.from("tasks").update({
   title:p.data.title,brief:p.data.brief,agent_id:p.data.agent_id||null,status:"draft",updated_at:new Date().toISOString()
  }).eq("id",id).eq("owner_id",user.id).in("status",["draft","failed"]).select("id").maybeSingle();
  if(error||!data)return fail("Không cập nhật được công việc.");
  await db.from("audit_events").insert({owner_id:user.id,actor_id:user.id,event_type:"task.updated",target_table:"tasks",target_id:id});
  revalidatePath("/");return ok("Đã lưu công việc. Có thể chạy AI để tạo bản nháp.");
 }catch(e){return fail(err(e))}
}
