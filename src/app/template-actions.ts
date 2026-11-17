"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {isStudioOwner} from "@/lib/access";
import {installSeoFirstTemplate} from "@/lib/seo-first-install";
import type {Result} from "@/app/actions";

export async function applySeoFirstTemplateAction(projectId:string):Promise<Result>{
 if(!z.uuid().safeParse(projectId).success)return {ok:false,message:"ID dự án không hợp lệ."};
 try{
  const db=await createClient();
  const {data:{user},error}=await db.auth.getUser();
  if(error||!user||!isStudioOwner(user.id))return {ok:false,message:"Không có quyền quản lý dự án."};
  const {data:project}=await db.from("projects").select("id,status").eq("id",projectId).eq("owner_id",user.id).maybeSingle();
  if(!project||project.status==="archived")return {ok:false,message:"Không tìm thấy dự án hợp lệ."};
  const outcome=await installSeoFirstTemplate(db,user.id,projectId);
  await db.from("audit_events").insert({owner_id:user.id,actor_id:user.id,event_type:"template.seo_first_applied",target_table:"projects",target_id:projectId,details:{agents_added:outcome.agents,schedules_added:outcome.schedules,workflow_definitions_added:outcome.workflows,existing_roles_linked:outcome.rolesLinked}});
  revalidatePath("/");
  return {ok:true,message:outcome.agents+outcome.schedules+outcome.workflows+outcome.rolesLinked===0?"Bộ mẫu SEO-First đã có đầy đủ, không tạo bản ghi trùng.":`Đã cấu hình ${outcome.agents} Agent mới, ${outcome.rolesLinked} vai trò cũ, ${outcome.workflows} workflow (tắt), ${outcome.schedules} lịch mẫu (tắt). Không tự chạy AI.`};
 }catch(error){return {ok:false,message:error instanceof Error?error.message:"Không cài được bộ mẫu."}}
}
