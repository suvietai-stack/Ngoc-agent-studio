import {createClient,hasDatabaseConfig} from "@/lib/supabase/server";
import {aiReady} from "@/lib/ai";
import {oauthReadyFlags} from "@/lib/oauth-providers";
import {encryptionReady} from "@/lib/integration-credentials";
import {isStudioOwner} from "@/lib/access";
import {AccessDenied} from "@/components/access-denied";
import {Workspace} from "@/components/workspace";
import {Login} from "@/components/login";
import {Setup} from "@/components/setup";
import type {WorkspaceData,Row} from "@/lib/types";

export const dynamic="force-dynamic";
export default async function Home(){
 if(!hasDatabaseConfig())return <Setup/>;
 const db=await createClient();
 const {data:{user}}=await db.auth.getUser();
 if(!user)return <Login/>;
 if(!isStudioOwner(user.id))return <AccessDenied/>;
 const sources=["projects","agents","tasks","knowledge_items","integrations","task_runs","automation_schedules","content_assets","dom_messages"] as const;
 // Supabase Data API returns at most 1,000 rows per request by default. Page deterministically.
 // Avoid silent truncation: if the safety ceiling is reached, explicitly warn in the UI.
 const pageSize=200,maxRecords=2000;
 const results=await Promise.all(sources.map(async name=>{
  const rows:Row[]=[];
  for(let offset=0;offset<maxRecords;offset+=pageSize){
   const result=await db.from(name).select("*").order("created_at",{ascending:false})
    .order("id",{ascending:false}).range(offset,offset+pageSize-1);
   if(result.error)return {rows,error:result.error,truncated:false};
   rows.push(...(result.data||[]) as Row[]);
   if((result.data||[]).length<pageSize)return {rows,error:null,truncated:false};
  }
  return {rows,error:null,truncated:true};
 }));
 const error=results.find(r=>r.error);
 if(error?.error)return <Setup migrationError="Database thiếu bảng hoặc không có quyền đọc. Kiểm tra migration và RLS."/>;
 const incompleteSources=sources.filter((_,i)=>results[i].truncated);
 const data=Object.fromEntries(sources.map((name,i)=>[name,results[i].rows])) as Record<typeof sources[number],WorkspaceData["projects"]>;
 const initial:WorkspaceData={
  projects:data.projects,agents:data.agents,tasks:data.tasks,
  knowledge:data.knowledge_items,integrations:data.integrations,runs:data.task_runs,
  automations:data.automation_schedules,content:data.content_assets,
  messages:[...data.dom_messages].reverse()
 };
 return <Workspace initial={initial} incompleteSources={incompleteSources} email={user.email||"Cá nhân"} aiConfigured={data.integrations.some(i=>i.provider==="openai"&&i.connection_status==="connected")} encryptionConfigured={encryptionReady()} envOpenAI={aiReady()} runnerConfigured={Boolean(process.env.CRON_SECRET&&process.env.SUPABASE_SERVICE_ROLE_KEY&&process.env.AUTO_AGENT_RUNNER_ENABLED==="true")} oauthReady={oauthReadyFlags()}/>;
}
