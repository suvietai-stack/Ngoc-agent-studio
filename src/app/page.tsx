import {createClient,hasDatabaseConfig} from "@/lib/supabase/server";
import {aiReady} from "@/lib/ai";
import {encryptionReady} from "@/lib/integration-credentials";
import {isStudioOwner} from "@/lib/access";
import {AccessDenied} from "@/components/access-denied";
import {Workspace} from "@/components/workspace";
import {Login} from "@/components/login";
import {Setup} from "@/components/setup";
import type {WorkspaceData} from "@/lib/types";

export const dynamic="force-dynamic";
export default async function Home(){
 if(!hasDatabaseConfig())return <Setup/>;
 const db=await createClient();
 const {data:{user}}=await db.auth.getUser();
 if(!user)return <Login/>;
 if(!isStudioOwner(user.id))return <AccessDenied/>;
 const sources=["projects","agents","tasks","knowledge_items","integrations","task_runs","automation_schedules","content_assets","dom_messages"] as const;
 const results=await Promise.all(sources.map(name=>db.from(name).select("*").order("created_at",{ascending:false}).limit(200)));
 const error=results.find(r=>r.error);
 if(error?.error)return <Setup migrationError="Database thiếu bảng hoặc không có quyền đọc. Kiểm tra migration và RLS."/>;
 const data=Object.fromEntries(sources.map((name,i)=>[name,results[i].data||[]])) as Record<typeof sources[number],WorkspaceData["projects"]>;
 const initial:WorkspaceData={
  projects:data.projects,agents:data.agents,tasks:data.tasks,
  knowledge:data.knowledge_items,integrations:data.integrations,runs:data.task_runs,
  automations:data.automation_schedules,content:data.content_assets,
  messages:[...data.dom_messages].reverse()
 };
 return <Workspace initial={initial} email={user.email||"Cá nhân"} aiConfigured={aiReady()||data.integrations.some(i=>i.provider==="openai"&&i.connection_status==="connected")} encryptionConfigured={encryptionReady()} envOpenAI={aiReady()}/>;
}
