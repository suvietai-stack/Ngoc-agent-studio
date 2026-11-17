import {createClient,hasDatabaseConfig} from "@/lib/supabase/server";
import {aiReady} from "@/lib/ai";
import {oauthReadyFlags} from "@/lib/oauth-providers";
import {encryptionReady} from "@/lib/integration-credentials";
import {isStudioOwner} from "@/lib/access";
import {AccessDenied} from "@/components/access-denied";
import {Workspace} from "@/components/workspace";
import {ProjectGate} from "@/components/project-gate";
import {projectFromOwnedList,allowedWorkspaceTab} from "@/lib/project-entry.mjs";
import {Login} from "@/components/login";
import {Setup} from "@/components/setup";
import type {WorkspaceData,Row} from "@/lib/types";

export const dynamic="force-dynamic";
export default async function Home({searchParams}:{searchParams:Promise<{project?:string|string[];tab?:string|string[];new?:string|string[]}>}){
 if(!hasDatabaseConfig())return <Setup/>;
 const db=await createClient();
 const {data:{user}}=await db.auth.getUser();
 if(!user)return <Login/>;
 if(!isStudioOwner(user.id))return <AccessDenied/>;
 // First choose the project. Do not fetch or send workspace data before selection.
 const requested=await searchParams;
 const requestedProject=typeof requested.project==="string"?requested.project:null;
 const requestedTab=allowedWorkspaceTab(requested.tab);
 const pageSize=200,maxRecords=2000;
 const projects:Row[]=[];
 let projectsTruncated=false;
 for(let offset=0;offset<maxRecords;offset+=pageSize){
  const result=await db.from("projects").select("*").eq("owner_id",user.id)
   .order("created_at",{ascending:false}).order("id",{ascending:false}).range(offset,offset+pageSize-1);
  if(result.error)return <Setup migrationError="Không tải được dự án. Kiểm tra cấu hình Supabase và quyền truy cập."/>;
  projects.push(...(result.data||[]) as Row[]);
  if((result.data||[]).length<pageSize)break;
  if(offset+pageSize>=maxRecords)projectsTruncated=true;
 }
 const selectedProject=projectFromOwnedList(projects,requestedProject);
 if(!selectedProject)return <ProjectGate projects={projects} email={user.email||"Cá nhân"}
   requestedTab={requestedTab} invalidProject={Boolean(requestedProject)} truncated={projectsTruncated} initialCreate={requested.new==="1"}/>;
 // The server retrieves ONLY rows assigned to the chosen project. No cross-project
 // agent/content/knowledge/API connection rows reach client components.
 const sources=["agents","tasks","knowledge_items","integrations","task_runs","automation_schedules","content_assets","dom_messages"] as const;
 const results=await Promise.all(sources.map(async name=>{
  const rows:Row[]=[];
  for(let offset=0;offset<maxRecords;offset+=pageSize){
   const result=await db.from(name).select("*")
    .eq("owner_id",user.id).eq("project_id",selectedProject.id)
    .order("created_at",{ascending:false}).order("id",{ascending:false}).range(offset,offset+pageSize-1);
   if(result.error)return {rows,error:result.error,truncated:false};
   rows.push(...(result.data||[]) as Row[]);
   if((result.data||[]).length<pageSize)return {rows,error:null,truncated:false};
  }
  return {rows,error:null,truncated:true};
 }));
 const error=results.find(r=>r.error);
 if(error?.error)return <Setup migrationError="Database thiếu bảng hoặc không có quyền đọc. Kiểm tra migration và RLS."/>;
 const incompleteSources=sources.filter((_,i)=>results[i].truncated);
 const data=Object.fromEntries(sources.map((name,i)=>[name,results[i].rows])) as Record<typeof sources[number],Row[]>;
 const initial:WorkspaceData={
  projects:[selectedProject],agents:data.agents,tasks:data.tasks,
  knowledge:data.knowledge_items,integrations:data.integrations,runs:data.task_runs,
  automations:data.automation_schedules,content:data.content_assets,
  messages:[...data.dom_messages].reverse()
 };
 return <Workspace initial={initial} incompleteSources={incompleteSources} email={user.email||"Cá nhân"} aiConfigured={data.integrations.some(i=>i.provider==="openai"&&i.connection_status==="connected")} encryptionConfigured={encryptionReady()} envOpenAI={aiReady()} runnerConfigured={Boolean(process.env.CRON_SECRET&&process.env.SUPABASE_SERVICE_ROLE_KEY&&process.env.AUTO_AGENT_RUNNER_ENABLED==="true")} oauthReady={oauthReadyFlags()}/>;
}
