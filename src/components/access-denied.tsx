"use client";
import {useRouter} from "next/navigation";
import {createClient} from "@/lib/supabase/browser";
import {ShieldAlert,LogOut} from "lucide-react";
export function AccessDenied(){const router=useRouter();async function exit(){await createClient().auth.signOut();router.refresh()}return <main className="screen"><section className="auth-card"><div className="brand-logo"><ShieldAlert size={27}/></div><h1>Không có quyền quản trị.</h1><p>Chỉ tài khoản Admin đã được cấp quyền mới truy cập được Ngọc Agent Studio.</p><button className="primary full" onClick={()=>void exit()}><LogOut size={16}/> Đăng xuất và đổi tài khoản</button></section></main>}
