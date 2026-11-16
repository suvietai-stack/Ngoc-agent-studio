import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export async function GET(req:NextRequest){const code=new URL(req.url).searchParams.get("code");if(code){const db=await createClient();const {error}=await db.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL("/",req.url))}return NextResponse.redirect(new URL("/?auth_error=1",req.url))}
