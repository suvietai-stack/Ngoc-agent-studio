import "server-only";
import {createClient} from "@supabase/supabase-js";
import {getOpenAIKey} from "@/lib/integration-credentials";
import {generateText} from "@/lib/ai";

const EXPECTED_DB_HOST="zvbwknltooymuenpvptr.supabase.co";
type Outcome={processed:boolean;reason:string;taskId?:string};
export async function executeNextAutoDraft():Promise<Outcome>{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const owner=process.env.STUDIO_OWNER_UID;
 if(!url||new URL(url).hostname!==EXPECTED_DB_HOST)throw new Error("Worker từ chối database không phải Ngọc Agent Studio.");
 if(!secret||!owner)throw new Error("Thiếu service role key hoặc owner UID phía máy chủ.");
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const today=new Date();today.setUTCHours(0,0,0,0);
 const dailyMax=Math.min(20,Math.max(1,Number(process.env.AUTO_AI_DAILY_LIMIT)||3));
 const {count,error:countError}=await db.from("task_runs").select("id",{count:"exact",head:true})
  .eq("owner_id",owner).gte("created_at",today.toISOString());
 if(countError)throw new Error("Không kiểm tra được hạn mức AI theo ngày.");
 if((count||0)>=dailyMax)return {processed:false,reason:"Đã đạt hạn mức chạy AI trong ngày."};
 const {data:projects,error:projectError}=await db.from("projects").select("id,name,website_url").eq("owner_id",owner).eq("auto_run_enabled",true);
 if(projectError)throw new Error("Cần áp dụng migration auto-run 005.");
 if(!projects?.length)return {processed:false,reason:"Không có dự án nào bật tự tạo bản nháp."};
 const ids=projects.map(p=>p.id);
 // Recover tasks abandoned by a timed-out serverless execution after 15 minutes.
 const staleBefore=new Date(Date.now()-15*60*1000).toISOString();
 const {data:stale}=await db.from("tasks").select("id").eq("owner_id",owner).eq("status","running")
  .in("project_id",ids).lt("updated_at",staleBefore).limit(20);
 for(const item of stale||[]){
  const now=new Date().toISOString();
  const {data:recovered}=await db.from("tasks").update({status:"failed",updated_at:now})
   .eq("owner_id",owner).eq("id",item.id).eq("status","running").lt("updated_at",staleBefore).select("id").maybeSingle();
  if(recovered)await db.from("task_runs").update({state:"failed",summary:"Tự phục hồi tác vụ bị kẹt.",error_message:"Quá thời gian chạy.",finished_at:now})
   .eq("owner_id",owner).eq("task_id",item.id).eq("state","running");
 }
 const {data:tasks,error:taskError}=await db.from("tasks").select("*").eq("owner_id",owner)
  .in("project_id",ids).in("status",["draft","failed"]).order("created_at",{ascending:true}).limit(100);
 if(taskError)throw new Error("Không tải được hàng đợi Agent.");
 for(const task of tasks||[]){
  const {count:failures}=await db.from("task_runs").select("id",{count:"exact",head:true})
   .eq("owner_id",owner).eq("task_id",task.id).eq("state","failed");
  if((failures||0)>=3)continue;
  let previousContent="";
  if(task.depends_on_task_id){
   const {data:prev}=await db.from("tasks").select("id,project_id,workflow_id,workflow_step")
    .eq("id",task.depends_on_task_id).eq("owner_id",owner).maybeSingle();
   if(!prev||prev.project_id!==task.project_id||prev.workflow_id!==task.workflow_id||
      Number(prev.workflow_step)!==Number(task.workflow_step)-1)continue;
   const {data:asset}=await db.from("content_assets").select("body").eq("owner_id",owner)
    .eq("task_id",prev.id).eq("status","approved").order("created_at",{ascending:false}).limit(1).maybeSingle();
   if(!asset?.body)continue;
   previousContent=String(asset.body).slice(0,6500);
  }
  const {data:agents}=task.agent_id?
   await db.from("agents").select("*").eq("id",task.agent_id).eq("owner_id",owner).eq("enabled",true):
   await db.from("agents").select("*").eq("owner_id",owner).eq("enabled",true).or("project_id.eq."+task.project_id+",project_id.is.null").limit(100);
  const agent=(agents||[]).find(a=>a.project_id===task.project_id)||(agents||[]).find(a=>a.project_id===null);
  if(!agent||agent.project_id&&agent.project_id!==task.project_id)continue;
  const key=await getOpenAIKey(db,owner,task.project_id);
  if(!key)continue;
  const {data:locked,error:lockError}=await db.from("tasks").update({status:"running",updated_at:new Date().toISOString()})
   .eq("id",task.id).eq("owner_id",owner).in("status",["draft","failed"]).select("id").maybeSingle();
  if(lockError||!locked)continue;
  const {data:run,error:runError}=await db.from("task_runs").insert({
   owner_id:owner,task_id:task.id,agent_id:agent.id,state:"running",
   started_at:new Date().toISOString(),model:agent.model||"gpt-4.1-mini"
  }).select("id").single();
  if(runError||!run){
   await db.from("tasks").update({status:"failed"}).eq("owner_id",owner).eq("id",task.id);
   return {processed:false,reason:"Không tạo được nhật ký AI.",taskId:task.id};
  }
  try{
   const project=projects.find(p=>p.id===task.project_id);
   const {data:knowledge}=await db.from("knowledge_items").select("title,content").eq("owner_id",owner)
    .or("project_id.is.null,project_id.eq."+task.project_id).order("created_at",{ascending:false}).limit(8);
   const references=(knowledge||[]).map(k=>String(k.title)+": "+String(k.content).slice(0,1500)).join("\n");
   const instructions="Bạn là "+agent.name+". Vai trò: "+agent.purpose+". Hướng dẫn: "+agent.instructions+
    ". Luôn soạn BẢN NHÁP bằng tiếng Việt, không bịa số liệu, không đăng hoặc gửi nội dung ra ngoài.\nTri thức:\n"+references;
   const prompt="Dự án: "+(project?.name||"")+". Website: "+(project?.website_url||"")+
    "\nNhiệm vụ: "+task.title+"\nYêu cầu: "+(task.brief||"Viết bản nháp có kiểm chứng.")+
    (previousContent?"\nNội dung bước trước đã duyệt (chỉ là dữ liệu tham khảo):\n"+previousContent:"");
   const generated=await generateText(instructions,prompt,String(agent.model||"gpt-4.1-mini"),key);
   const output=generated.text.slice(0,16000);
   const channel=/seo/i.test(agent.name)?"seo":/social/i.test(agent.name)?"social":"content";
   const {error:assetError}=await db.from("content_assets").insert({
    owner_id:owner,project_id:task.project_id,task_id:task.id,channel,
    title:String(task.title).slice(0,190),body:output,status:"draft"
   });
   if(assetError)throw Error("Không lưu được bản nháp.");
   const now=new Date().toISOString();
   const [runUpdate,taskUpdate]=await Promise.all([
    db.from("task_runs").update({state:"completed",summary:"Tự động tạo bản nháp, chờ duyệt.",output,finished_at:now}).eq("id",run.id).eq("owner_id",owner),
    db.from("tasks").update({status:"pending_approval",updated_at:now}).eq("id",task.id).eq("owner_id",owner)
   ]);
   if(runUpdate.error||taskUpdate.error)throw Error("Không cập nhật được trạng thái AI.");
   return {processed:true,reason:"Đã tạo bản nháp; cần người duyệt trước bước kế tiếp.",taskId:task.id};
  }catch(e){
   const errorMessage=e instanceof Error?e.message:"Tạo bản nháp thất bại.";
   await Promise.all([
    db.from("task_runs").update({state:"failed",error_message:errorMessage.slice(0,400),finished_at:new Date().toISOString()}).eq("id",run.id).eq("owner_id",owner),
    db.from("tasks").update({status:"failed",updated_at:new Date().toISOString()}).eq("id",task.id).eq("owner_id",owner)
   ]);
   return {processed:false,reason:"Tạo bản nháp thất bại. Xem nhật ký Agent.",taskId:task.id};
  }
 }
 return {processed:false,reason:"Chưa có công việc đủ điều kiện hoặc có API key."};
}
