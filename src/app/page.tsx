import {createClient,hasDatabaseConfig} from "@/lib/supabase/server";
import {Workspace} from "@/components/workspace";
import {Login} from "@/components/login";
import {Setup} from "@/components/setup";
import type {WorkspaceData} from "@/lib/types";
export const dynamic="force-dynamic";
export default async function Home(){if(!hasDatabaseConfig())return <Setup/>;const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return <Login/>;const queries=await Promise.all([db.from("projects").select("*").order("created_at",{ascending:false}),db.from("agents").select("*").order("created_at",{ascending:false}),db.from("tasks").select("*").order("created_at",{ascending:false}),db.from("knowledge_items").select("*").order("created_at",{ascending:false}),db.from("integrations").select("*").order("created_at",{ascending:false}),db.from("task_runs").select("*").order("created_at",{ascending:false})]);const bad=queries.find(q=>q.error);if(bad?.error)return <Setup migrationError="Database chưa khởi tạo các bảng. Hãy chạy migration trong Supabase."/>;const initial:WorkspaceData={projects:queries[0].data||[],agents:queries[1].data||[],tasks:queries[2].data||[],knowledge:queries[3].data||[],integrations:queries[4].data||[],runs:queries[5].data||[]};return <Workspace initial={initial} email={user.email||"Cá nhân"}/>}
