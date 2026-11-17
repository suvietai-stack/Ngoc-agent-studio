import "server-only";
import {createClient} from "@/lib/supabase/server";
import {SEO_FIRST_ROLES,SEO_FIRST_SCHEDULES,getMissingTemplateRoles,SEO_FIRST_TEMPLATE} from "@/lib/seo-first-template.mjs";
import {AGENT_ROLE_KEYS,WORKFLOW_CATALOG,WORKFLOW_TEMPLATE_VERSION,validateWorkflow} from "@/lib/workflow-catalog.mjs";
type Database=Awaited<ReturnType<typeof createClient>>;
type InstallOutcome={agents:number;schedules:number;workflows:number;rolesLinked:number};
export async function installSeoFirstTemplate(db:Database,ownerId:string,projectId:string):Promise<InstallOutcome>{
 const {data:agents,error:agentsError}=await db.from("agents").select("id,name,role_key").eq("owner_id",ownerId).eq("project_id",projectId);
 if(agentsError)throw new Error("Không đọc được danh sách Agent.");
 const existing=agents||[];
 const missing=getMissingTemplateRoles(existing.map(a=>a.name));
 let installedAgents=0,installedSchedules=0,installedWorkflows=0,rolesLinked=0;
 if(missing.length){
  // Only internal read/research/draft rights. Never grant external write permissions.
  const {data:added,error}=await db.from("agents").insert(missing.map(role=>({
   owner_id:ownerId,project_id:projectId,name:role.name,role_key:AGENT_ROLE_KEYS[role.name],template_version:SEO_FIRST_TEMPLATE.version,purpose:role.purpose,
   instructions:role.instructions,model:"gpt-4.1-mini",capabilities:["read","research","draft"],
   approval_required:true,enabled:true
  }))).select("id,name,role_key");
  if(error||!added)throw new Error("Không cài được Agent. Có thể thử lại; cấu hình hiện có không bị ghi đè.");
  existing.push(...added);
  installedAgents=added.length;
 }
 const {data:current,error:scheduleError}=await db.from("automation_schedules").select("title").eq("owner_id",ownerId).eq("project_id",projectId);
 if(scheduleError)throw new Error("Không đọc được lịch tự động.");
 const titles=new Set((current||[]).map(s=>s.title.toLocaleLowerCase("vi")));
 const ids=new Map(existing.map(a=>[a.name.toLocaleLowerCase("vi"),a.id]));
 const schedules=SEO_FIRST_SCHEDULES.filter(s=>!titles.has(s.title.toLocaleLowerCase("vi"))&&ids.has(s.agent.toLocaleLowerCase("vi"))).map(s=>({
  owner_id:ownerId,project_id:projectId,agent_id:ids.get(s.agent.toLocaleLowerCase("vi")),
  title:s.title,brief:s.brief,frequency:s.frequency,enabled:false,
  next_run_at:new Date(Date.now()+7*24*60*60*1000).toISOString()
 }));
 if(schedules.length){
  const {error}=await db.from("automation_schedules").insert(schedules);
  if(error)throw new Error("Agent đã có, nhưng không cài đủ lịch mẫu. Bấm cài lại để hoàn tất.");
  installedSchedules=schedules.length;
 }
 // Link existing manually created Agents to stable roles without changing their custom instructions.
 for(const existingAgent of existing){
  const roleKey=AGENT_ROLE_KEYS[existingAgent.name as keyof typeof AGENT_ROLE_KEYS];
  if(!roleKey||existingAgent.role_key)continue;
  const {error}=await db.from("agents").update({role_key:roleKey,template_version:SEO_FIRST_TEMPLATE.version})
   .eq("id",existingAgent.id).eq("owner_id",ownerId).eq("project_id",projectId).is("role_key",null);
  if(error)throw new Error("Không gắn được mã vai trò Agent. Có thể thử cài lại.");
  rolesLinked++;
 }
 // Versioned definitions are project-local and deliberately DISABLED.
 const {data:defined,error:definedError}=await db.from("workflow_definitions")
  .select("template_key").eq("owner_id",ownerId).eq("project_id",projectId);
 if(definedError)throw new Error("Chưa có cấu trúc workflow v2. Cần migration 008.");
 const definedKeys=new Set((defined||[]).map(x=>x.template_key));
 const missingWorkflows=WORKFLOW_CATALOG.filter(w=>!definedKeys.has(w.key));
 if(missingWorkflows.some(w=>!validateWorkflow(w)))throw new Error("Định nghĩa workflow không hợp lệ.");
 if(missingWorkflows.length){
  const rows=missingWorkflows.map(w=>({
   owner_id:ownerId,project_id:projectId,template_key:w.key,template_version:WORKFLOW_TEMPLATE_VERSION,
   title:w.title,description:"Kế hoạch chuẩn SEO-first: thực hiện qua quyền và kiểm định riêng.",
   trigger_type:w.trigger,steps:w.steps,enabled:false,customized:false,
   required_capabilities:["read","research","draft"]
  }));
  const {error}=await db.from("workflow_definitions").insert(rows);
  if(error)throw new Error("Chưa cài được bộ định nghĩa workflow. Có thể thử lại; không ghi đè cấu hình cũ.");
  installedWorkflows=rows.length;
 }
 return {agents:installedAgents,schedules:installedSchedules,workflows:installedWorkflows,rolesLinked};
}
