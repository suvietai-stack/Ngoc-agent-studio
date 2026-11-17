import "server-only";
import {createClient} from "@/lib/supabase/server";
import {SEO_FIRST_ROLES,SEO_FIRST_SCHEDULES,getMissingTemplateRoles} from "@/lib/seo-first-template.mjs";
type Database=Awaited<ReturnType<typeof createClient>>;
type InstallOutcome={agents:number;schedules:number};
export async function installSeoFirstTemplate(db:Database,ownerId:string,projectId:string):Promise<InstallOutcome>{
 const {data:agents,error:agentsError}=await db.from("agents").select("id,name").eq("owner_id",ownerId).eq("project_id",projectId);
 if(agentsError)throw new Error("Không đọc được danh sách Agent.");
 const existing=agents||[];
 const missing=getMissingTemplateRoles(existing.map(a=>a.name));
 let installedAgents=0,installedSchedules=0;
 if(missing.length){
  // Only internal read/research/draft rights. Never grant external write permissions.
  const {data:added,error}=await db.from("agents").insert(missing.map(role=>({
   owner_id:ownerId,project_id:projectId,name:role.name,purpose:role.purpose,
   instructions:role.instructions,model:"gpt-4.1-mini",capabilities:["read","research","draft"],
   approval_required:true,enabled:true
  }))).select("id,name");
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
 return {agents:installedAgents,schedules:installedSchedules};
}
