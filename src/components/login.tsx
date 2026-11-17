"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {createClient} from "@/lib/supabase/browser";
import {BrainCircuit,ArrowRight,LockKeyhole} from "lucide-react";

export function Login(){
 const router=useRouter();
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [recovering,setRecovering]=useState(false);
 const [recoveryNotice,setRecoveryNotice]=useState("");

 async function submit(e:React.FormEvent){
  e.preventDefault();
  if(busy)return;
  setBusy(true);
  setError("");
  setRecoveryNotice("");
  try{
   const {error:authError}=await createClient().auth.signInWithPassword({email,password});
   if(authError){
    if(authError.code==="invalid_credentials")setError("Email hoặc mật khẩu không đúng. Bạn có thể kiểm tra tài khoản rồi thử lại.");
    else if(authError.code==="over_request_rate_limit")setError("Bạn đăng nhập quá nhiều lần. Vui lòng thử lại sau khi hết giới hạn.");
    else if(authError.code==="refresh_token_already_used")setError("Phiên đăng nhập cũ đã hết hiệu lực. Đóng các tab Studio cũ và mở lại trang này.");
    else setError("Supabase Auth từ chối đăng nhập (mã: "+(authError.code||"không rõ")+"). Xem phần Kiểm tra kết nối bên dưới.");
    return;
   }
   router.refresh();
  }catch{
   setError("Không liên hệ được với Supabase Auth từ trình duyệt này. Hãy kiểm tra kết nối.");
  }finally{
   setBusy(false);
  }
 }
 async function resetLocalSession(){
  if(busy||recovering)return;
  setRecovering(true);
  setError("");
  setRecoveryNotice("");
  try{
   // The local scope clears this device, never invalidating other sessions.
   const {error:signOutError}=await createClient().auth.signOut({scope:"local"});
   setRecoveryNotice(signOutError
    ?"Đã yêu cầu xóa phiên trên thiết bị này; máy chủ chưa xác nhận thu hồi token. Hãy đăng nhập lại."
    :"Đã xóa phiên đăng nhập cũ trên thiết bị này. Bạn có thể đăng nhập lại.");
   router.refresh();
  }catch{
   setError("Không làm mới được phiên. Hãy kiểm tra kết nối rồi thử lại.");
  }finally{
   setRecovering(false);
  }
 }
 return <main className="screen"><section className="auth-card">
  <div className="brand-logo"><BrainCircuit size={30}/></div>
  <span className="eyebrow">NGỌC AGENT STUDIO</span>
  <h1>Chào mừng trở lại.</h1>
  <p>Đăng nhập để quản lý các dự án và đội ngũ AI Agent.</p>
  <form onSubmit={submit} className="form-stack">
   <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required placeholder="Email cá nhân"/></label>
   <label>Mật khẩu<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label>
   {error&&<div className="alert" role="alert">{error}</div>}
   <button className="primary full" disabled={busy}>{busy?"Đang đăng nhập...":"Đăng nhập"} <ArrowRight size={16}/></button>
  </form>
  {recoveryNotice&&<div className="note" role="status">{recoveryNotice}</div>}
  <button className="ops-outline" type="button" disabled={busy||recovering} onClick={resetLocalSession}>
   {recovering?"Đang làm mới phiên...":"Không đăng nhập được? Xóa phiên cũ trên thiết bị"}
  </button>
  <p style={{marginTop:10,fontSize:12}}>Chỉ xóa phiên trên thiết bị hiện tại, không đăng xuất máy khác.</p>
  <p style={{marginTop:15,fontSize:12}}><Link href="/ket-noi">Kiểm tra chi tiết kết nối Supabase</Link></p>
  <small className="privacy"><LockKeyhole size={13}/> Chỉ tài khoản được cấp quyền, không đăng ký công khai.</small>
 </section></main>;
}
