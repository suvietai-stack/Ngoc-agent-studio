import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {isStudioOwner} from "@/lib/access";
import {encryptCredentials} from "@/lib/integration-credentials";
import {exchangeOAuthCode,verifyOAuth} from "@/lib/oauth-server";
import {isOAuthProvider,OAUTH_PROVIDERS} from "@/lib/oauth-providers";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){
 const base=new URL("/",req.url);
 let projectId="";
 let provider="";
 const raw=req.cookies.get("nas_oauth_state")?.value;
 try{
  if(!raw||raw.length>1200)throw new Error("Missing OAuth state");
  const state:unknown=JSON.parse(Buffer.from(raw,"base64url").toString("utf8"));
  if(!state||typeof state!=="object")throw new Error("Invalid OAuth state");
  const s=state as Record<string,unknown>;
  if(typeof s.provider!=="string"||!isOAuthProvider(s.provider)||!z.uuid().safeParse(s.projectId).success||
   typeof s.nonce!=="string"||s.nonce.length<32||req.nextUrl.searchParams.get("state")!==s.nonce)
   throw new Error("OAuth state invalid");
  projectId=String(s.projectId);provider=s.provider;
  if(req.nextUrl.searchParams.get("error"))throw new Error("OAuth access denied");
  const code=req.nextUrl.searchParams.get("code");
  if(!code||code.length>4096)throw new Error("OAuth code missing");
  const db=await createClient();
  const {data:{user},error}=await db.auth.getUser();
  if(error||!user||!isStudioOwner(user.id))throw new Error("Owner authorization failed");
  const {data:project}=await db.from("projects").select("id").eq("id",projectId).eq("owner_id",user.id).maybeSingle();
  if(!project)throw new Error("Project unavailable");
  const ctx={db,ownerId:user.id,projectId};
  const credentials=await exchangeOAuthCode(s.provider,code,ctx);
  let verified=false;
  let savedCredentials=credentials;
  try{
   const test=await verifyOAuth(s.provider,credentials,ctx);
   verified=test.ok;savedCredentials=test.credentials;
  }catch{verified=false;}
  const {error:secretError}=await db.from("integration_secrets").upsert({
   owner_id:user.id,project_id:projectId,provider:s.provider,
   encrypted_credentials:encryptCredentials(savedCredentials),tested_at:verified?new Date().toISOString():null,
   updated_at:new Date().toISOString()
  },{onConflict:"owner_id,project_id,provider"});
  if(secretError)throw new Error("Could not save OAuth token");
  const {error:statusError}=await db.from("integrations").upsert({
   owner_id:user.id,project_id:projectId,provider:s.provider,
   display_name:OAUTH_PROVIDERS[s.provider].name,connection_status:verified?"connected":"error"
  },{onConflict:"owner_id,project_id,provider"});
  if(statusError)throw new Error("Could not save OAuth status");
  await db.from("audit_events").insert({
   owner_id:user.id,actor_id:user.id,event_type:"integration.oauth_authorized",
   target_table:"integrations",details:{provider:s.provider,project_id:projectId,verified}
  });
  base.searchParams.set("tab","integrations");
  base.searchParams.set("project",projectId);
  base.searchParams.set("oauth",verified?"connected":"needs_access");
 }catch{
  base.searchParams.set("tab","integrations");
  if(projectId)base.searchParams.set("project",projectId);
  base.searchParams.set("oauth","failed");
 }
 const response=NextResponse.redirect(base);
 response.cookies.set("nas_oauth_state","",{httpOnly:true,secure:true,sameSite:"lax",maxAge:0,path:"/api/integrations/oauth/callback"});
 response.headers.set("Cache-Control","no-store");
 return response;
}
