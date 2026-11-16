import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export function hasDatabaseConfig(){const u=process.env.NEXT_PUBLIC_SUPABASE_URL;const k=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;return !!(u&&k&&!u.includes("YOUR_PROJECT"));}
export async function createClient(){if(!hasDatabaseConfig())throw new Error("Chưa có database riêng");const store=await cookies();return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{cookies:{getAll(){return store.getAll()},setAll(changes){try{changes.forEach(({name,value,options})=>store.set(name,value,options))}catch{/* Next Server Component cannot update cookies */}}}})}
