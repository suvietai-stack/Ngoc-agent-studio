"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {isStudioOwner} from "@/lib/access";
export type Result={ok:boolean;message:string};
const fail=(message:string):Result=>({ok:false,message});
const ok=(message:string):Result=>({ok:true,message});
async function auth(){const db=await createClient();const {data:{user},error}=await db.auth.getUser();if(error||!user)throw Error("Chưa đăng nhập");if(!isStudioOwner(user.id))throw Error("Không có quyền quản trị");return {db,user}}
function err(error:unknown){if(error instanceof Error&&error.message==="Chưa đăng nhập")return "Cần đăng nhập lại.";if(error instanceof Error&&error.message==="Không có quyền quản trị")return "Tài khoản này không có quyền quản trị.";return "Không thể lưu. Kiểm tra dữ liệu, quyền hoặc cấu hình database."}
export async function createProjectAction(form:FormData):Promise<Result>{
 const p=z.object({name:z.string().trim().min(2).max(120),category:z.string().max(80),website_url:z.union([z.url().max(500),z.literal("")]),description:z.string().max(1500)}).safeParse({name:form.get("name"),category:form.get("category")||"SEO & Content",website_url:form.get("website_url")||"",description:form.get("description")||""});
 if(!p.success)return fail("Tên hoặc URL dự án chưa hợp lệ.");
 try{const {db,user}=await auth();const {error}=await db.from("projects").insert({...p.data,owner_id:user.id,website_url:p.data.website_url||null});if(error)return fail(err(error));revalidatePath("/");return ok("Đã tạo dự án.");}catch(e){return fail(err(e))}
}
const cap=["read","research","draft","edit","publish","external_send","delete"] as const;
export async function createAgentAction(form:FormData):Promise<Result>{
 const p=z.object({name:z.string().trim().min(2).max(100),purpose:z.string().trim().min(6).max(500),instructions:z.string().trim().min(10).max(20000),model:z.string().trim().min(3).max(100),project_id:z.union([z.uuid(),z.literal("")]),capabilities:z.array(z.enum(cap))}).safeParse({name:form.get("name"),purpose:form.get("purpose"),instructions:form.get("instructions"),model:form.get("model")||"gpt-4.1-mini",project_id:form.get("project_id")||"",capabilities:form.getAll("capabilities").map(String)});
 if(!p.success)return fail("Thông tin Agent chưa đầy đủ hoặc không hợp lệ.");
 try{const {db,user}=await auth();const {error}=await db.from("agents").insert({...p.data,project_id:p.data.project_id||null,owner_id:user.id,enabled:false,approval_required:true});if(error)return fail(err(error));revalidatePath("/");return ok("Đã tạo Agent. Bật Agent để có thể chạy nhiệm vụ AI.");}catch(e){return fail(err(e))}
}
export async function toggleAgentAction(id:string,enabled:boolean):Promise<Result>{
 if(!z.uuid().safeParse(id).success)return fail("ID Agent không hợp lệ.");
 try{const {db,user}=await auth();const {data,error}=await db.from("agents").update({enabled}).eq("id",id).eq("owner_id",user.id).select("id").maybeSingle();if(error||!data)return fail("Không thể đổi trạng thái.");revalidatePath("/");return ok(enabled?"Đã bật Agent; có thể chạy công việc trong hàng đợi.":"Đã tắt Agent.");}catch(e){return fail(err(e))}
}
export async function createTaskAction(form:FormData):Promise<Result>{
 const p=z.object({title:z.string().trim().min(4).max(200),brief:z.string().max(5000),project_id:z.uuid(),agent_id:z.union([z.uuid(),z.literal("")]),approval:z.boolean()}).safeParse({title:form.get("title"),brief:form.get("brief")||"",project_id:form.get("project_id"),agent_id:form.get("agent_id")||"",approval:form.get("approval")==="on"});
 if(!p.success)return fail("Chọn dự án và nhập tên công việc hợp lệ.");
 try{const {db,user}=await auth();const {error}=await db.from("tasks").insert({owner_id:user.id,title:p.data.title,brief:p.data.brief,project_id:p.data.project_id,agent_id:p.data.agent_id||null,status:"draft"});if(error)return fail(err(error));revalidatePath("/");return ok("Đã lưu nhiệm vụ vào hàng đợi. Chọn Chạy AI để tạo bản nháp.");}catch(e){return fail(err(e))}
}
export async function approveTaskAction(id:string):Promise<Result>{
 if(!z.uuid().safeParse(id).success)return fail("ID nhiệm vụ không hợp lệ.");
 try{const {db}=await auth();const {data,error}=await db.rpc("approve_task",{p_task_id:id});if(error||data!==true)return fail("Không thể phê duyệt nhiệm vụ.");revalidatePath("/");return ok("Đã duyệt công việc. Nội dung cần duyệt riêng trước khi xuất bản.");}catch(e){return fail(err(e))}
}
export async function createKnowledgeAction(form:FormData):Promise<Result>{
 const p=z.object({title:z.string().trim().min(2).max(180),content:z.string().trim().min(20).max(30000),project_id:z.union([z.uuid(),z.literal("")])}).safeParse({title:form.get("title"),content:form.get("content"),project_id:form.get("project_id")||""});
 if(!p.success)return fail("Tri thức cần tiêu đề và nội dung ít nhất 20 ký tự.");
 try{const {db,user}=await auth();const {error}=await db.from("knowledge_items").insert({...p.data,owner_id:user.id,project_id:p.data.project_id||null});if(error)return fail(err(error));revalidatePath("/");return ok("Đã lưu tri thức; Đốm và các Agent sẽ tham khảo khi tạo nội dung.");}catch(e){return fail(err(e))}
}
export async function signOutAction(){const db=await createClient();await db.auth.signOut();revalidatePath("/")}
