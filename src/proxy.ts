import {NextRequest,NextResponse} from "next/server";
import {createServerClient} from "@supabase/ssr";
export async function proxy(req:NextRequest){const u=process.env.NEXT_PUBLIC_SUPABASE_URL,k=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;if(!u||!k)return NextResponse.next();let res=NextResponse.next({request:req});const db=createServerClient(u,k,{cookies:{getAll(){return req.cookies.getAll()},setAll(items){items.forEach(({name,value})=>req.cookies.set(name,value));res=NextResponse.next({request:req});items.forEach(({name,value,options})=>res.cookies.set(name,value,options))}}});await db.auth.getUser();return res}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"]};
