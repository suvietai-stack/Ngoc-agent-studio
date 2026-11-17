import {NextRequest,NextResponse} from "next/server";
import {randomBytes} from "node:crypto";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {isStudioOwner} from "@/lib/access";
import {encryptionReady} from "@/lib/integration-credentials";
import {authorizationUrl} from "@/lib/oauth-server";
import {isOAuthProvider} from "@/lib/oauth-providers";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){
 const provider=req.nextUrl.searchParams.get("provider")||"";
 const projectId=req.nextUrl.searchParams.get("project")||"";
 if(!isOAuthProvider(provider)||!z.uuid().safeParse(projectId).success)
  return NextResponse.json({ok:false,message:"Dự án hoặc dịch vụ không hợp lệ."},{status:400});
 if(!encryptionReady())return NextResponse.json({ok:false,message:"Chưa có kho mã hóa khóa."},{status:503});
 const db=await createClient();
 const {data:{user},error}=await db.auth.getUser();
 if(error||!user||!isStudioOwner(user.id))return NextResponse.json({ok:false,message:"Cần đăng nhập với quyền quản trị."},{status:401});
 const {data:project}=await db.from("projects").select("id").eq("owner_id",user.id).eq("id",projectId).maybeSingle();
 if(!project)return NextResponse.json({ok:false,message:"Không tìm thấy dự án."},{status:404});
 const nonce=randomBytes(32).toString("base64url");
 try{
  const url=authorizationUrl(provider,nonce);
  const response=NextResponse.redirect(url);
  response.cookies.set("nas_oauth_state",Buffer.from(JSON.stringify({provider,projectId,nonce})).toString("base64url"),{
   httpOnly:true,secure:true,sameSite:"lax",maxAge:600,path:"/api/integrations/oauth/callback"
  });
  response.headers.set("Cache-Control","no-store");
  return response;
 }catch{
  return NextResponse.json({ok:false,message:"Chưa cấu hình ứng dụng OAuth hoặc callback URL trên Vercel."},{status:503});
 }
}
