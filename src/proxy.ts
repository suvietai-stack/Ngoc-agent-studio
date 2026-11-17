import {type NextRequest,NextResponse} from "next/server";
import {createServerClient} from "@supabase/ssr";

/**
 * Next.js 16 proxy refreshes expired Supabase Auth cookies once and passes
 * the rotated values to BOTH the Server Components and the browser.
 * Do not call getSession() here; it does not validate the user JWT.
 */
export async function proxy(request:NextRequest){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return NextResponse.next();
 let response=NextResponse.next({request});
 const db=createServerClient(url,key,{
  cookies:{
   getAll(){return request.cookies.getAll()},
   setAll(items){
    // The next Server Component must read the updated session in THIS request.
    items.forEach(({name,value})=>request.cookies.set(name,value));
    response=NextResponse.next({request});
    // The browser must receive the identical rotated cookies.
    items.forEach(({name,value,options})=>response.cookies.set(name,value,options));
   }
  }
 });
 try{
  // Recommended SSR refresh path: validate signed claims, refresh when needed.
  await db.auth.getClaims();
 }catch{
  // Do not redirect or erase cookies on network failure. Login and the
  // authenticated diagnostic page distinguish expired sessions from API errors.
 }
 return response;
}
export const config={
 matcher:["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"]
};
