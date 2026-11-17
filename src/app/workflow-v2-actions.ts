"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {isStudioOwner} from "@/lib/access";
import {plannedSteps,validateWorkflow} from "@/lib/workflow-catalog.mjs";
import type {Result} from "@/app/actions";

const uuid=z.uuid();
const fail=(message:string):Result=>({ok:false,message});
async function context(){
 const db=await createClient();
 const {data:{user},error}=await db.auth.getUser();
 if(error||!user||!isStudioOwner(user.id))throw Error("Không có quyền điều hành workflow.");
 return {db,user};
}
export async function createWorkflowPlanAction(projectId:string,templateKey:string):Promise<Result>{
 if(!uuid.safeParse(projectId).success||!z.string().regex(/^[a-z][a-z0-9_]{2,89}$/).safeParse(templateKey).success)
  return fail("Dự án hoặc loại workflow không hợp lệ.");
 try{
  const {db,user}=await context();
  const {data:project}=await db.from("projects").select("id,status").eq("owner_id",user.id).eq("id",projectId).maybeSingle();
  if(project?.status!=="active")return fail("Chỉ tạo kế hoạch trong dự án đang hoạt động.");
  const {data:definition,error:readError}=await db.from("workflow_definitions").select("*")
   .eq("owner_id",user.id).eq("project_id",projectId).eq("template_key",templateKey).maybeSingle();
  if(readError||!definition)return fail("Hãy cài bộ mẫu SEO-First vào dự án trước.");
  const workflow={key:templateKey,title:definition.title,trigger:definition.trigger_type,steps:definition.steps};
  if(!validateWorkflow(workflow))return fail("Cấu trúc workflow chưa hợp lệ. Cần kiểm tra định nghĩa.");
  const {data:run,error:runError}=await db.from("workflow_runs").insert({
   owner_id:user.id,project_id:projectId,definition_id:definition.id,
   template_key:definition.template_key,template_version:definition.template_version,
   title:definition.title,status:"planned"
  }).select("id").single();
  if(runError||!run)return fail("Không khởi tạo được kế hoạch workflow.");
  const steps=plannedSteps(workflow);
  const {error:stepError}=await db.from("workflow_step_runs").insert(steps.map(step=>({
   ...step,owner_id:user.id,project_id:projectId,run_id:run.id
  })));
  if(stepError){
   await db.from("workflow_runs").delete().eq("id",run.id).eq("owner_id",user.id).eq("project_id",projectId);
   return fail("Không lưu được các bước workflow. Chưa chạy Agent.");
  }
  await db.from("audit_events").insert({owner_id:user.id,actor_id:user.id,event_type:"workflow.v2_plan_created",
   target_table:"workflow_runs",target_id:run.id,details:{template_key:templateKey,version:definition.template_version}});
  revalidatePath("/");
  return {ok:true,message:"Đã tạo kế hoạch "+steps.length+" bước. Không gọi AI, không tự xuất bản hay thay đổi website."};
 }catch(e){return fail(e instanceof Error?e.message:"Không tạo được kế hoạch workflow.")}
}
/** Explicit manual evidence record. This never performs the provider action.
 * The approval gate is a user-signed checkpoint, not an independent AI quality check.
 */
export async function recordWorkflowStepAction(runId:string,stepId:string,rawNote:string):Promise<Result>{
 const check=z.object({runId:uuid,stepId:uuid,note:z.string().trim().min(15).max(1800)}).safeParse({runId,stepId,note:rawNote});
 if(!check.success)return fail("Cần ghi bằng chứng/nhận xét tối thiểu 15 ký tự.");
 try{
  const {db,user}=await context();
  const {data:step}=await db.from("workflow_step_runs").select("*").eq("id",stepId).eq("run_id",runId).eq("owner_id",user.id).maybeSingle();
  if(!step)return fail("Không tìm thấy bước workflow.");
  if(step.gate==="external")return fail("Bước đăng/cập nhật bên ngoài phải qua adapter và phê duyệt riêng. Hiện không cho đánh dấu đã thực hiện.");
  if(!["pending","ready","needs_approval"].includes(step.status))return fail("Bước này không còn chờ xác nhận.");
  const {data:project}=await db.from("projects").select("status").eq("id",step.project_id).eq("owner_id",user.id).maybeSingle();
  if(project?.status!=="active")return fail("Dự án chưa hoạt động.");
  const {data:run}=await db.from("workflow_runs").select("id,status").eq("id",runId).eq("owner_id",user.id).eq("project_id",step.project_id).maybeSingle();
  if(!run||!["planned","active"].includes(run.status))return fail("Workflow đã tạm dừng hoặc kết thúc.");
  const {data:related,error}=await db.from("workflow_step_runs").select("step_key,status").eq("run_id",runId).eq("project_id",step.project_id).eq("owner_id",user.id);
  if(error)return fail("Không kiểm tra được phụ thuộc workflow.");
  const readyKeys=new Set((related||[]).filter(x=>["done","approved","skipped"].includes(x.status)).map(x=>x.step_key));
  const dependencies=Array.isArray(step.requires)?step.requires as string[]:[];
  if(!dependencies.every(key=>readyKeys.has(key)))return fail("Cần hoàn thành và ghi bằng chứng bước trước.");
  const newStatus=step.gate==="approval"?"approved":"done";
  const {data:changed,error:writeError}=await db.from("workflow_step_runs")
   .update({status:newStatus,evidence:{note:check.data.note,kind:"manual_confirmation",recorded_at:new Date().toISOString(),actor_id:user.id},
    updated_at:new Date().toISOString()})
   .eq("id",stepId).eq("run_id",runId).eq("owner_id",user.id).eq("project_id",step.project_id)
   .in("status",["pending","ready","needs_approval"]).select("id").maybeSingle();
  if(writeError||!changed)return fail("Không cập nhật được bước; hãy tải lại trạng thái workflow.");
  await db.from("workflow_runs").update({status:"active",started_at:new Date().toISOString()})
   .eq("id",runId).eq("owner_id",user.id).eq("project_id",step.project_id).eq("status","planned");
  await db.from("audit_events").insert({owner_id:user.id,actor_id:user.id,event_type:"workflow.v2_step_confirmed",
   target_table:"workflow_step_runs",target_id:stepId,details:{run_id:runId,step_key:step.step_key,gate:step.gate,confirmation_type:"manual"}});
  revalidatePath("/");
  return {ok:true,message:newStatus==="approved"?"Đã ghi nhận duyệt thủ công với bằng chứng.":"Đã ghi nhận bước được xác nhận thủ công."};
 }catch(e){return fail(e instanceof Error?e.message:"Không cập nhật được bước.")}
}
