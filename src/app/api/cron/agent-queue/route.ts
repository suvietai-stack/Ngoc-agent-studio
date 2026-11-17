import {NextRequest,NextResponse} from "next/server";
import {timingSafeEqual} from "node:crypto";
import {executeNextAutoDraft} from "@/lib/automation-worker";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(req:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret||process.env.AUTO_AGENT_RUNNER_ENABLED!=="true")
  return NextResponse.json({ok:false,message:"Agent worker đang tắt."},{status:503});
 const actual=req.headers.get("authorization")||"";
 const expected="Bearer "+secret;
 const a=Buffer.from(actual),b=Buffer.from(expected);
 if(a.length!==b.length||!timingSafeEqual(a,b))
  return NextResponse.json({ok:false,message:"Unauthorized"},{status:401});
 try{
  const outcome=await executeNextAutoDraft();
  return NextResponse.json({ok:true,...outcome},{headers:{"Cache-Control":"no-store"}});
 }catch{
  return NextResponse.json({ok:false,message:"Cấu hình worker hoặc database chưa sẵn sàng."},{status:503});
 }
}
