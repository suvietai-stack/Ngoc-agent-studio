"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {CheckCircle2,KeyRound,PlugZap,ShieldCheck,Unplug} from "lucide-react";
import type {WorkspaceData} from "@/lib/types";
import {disconnectAction,saveConnectionAction,testConnectionAction} from "@/app/integrations";
import type {Provider} from "@/lib/integration-credentials";
import {OAUTH_PROVIDERS,type OAuthProvider} from "@/lib/oauth-providers";
type Props={initial:WorkspaceData;filter:string;encryptionConfigured:boolean;envOpenAI:boolean;oauthReady:{google:boolean;meta:boolean;ads:boolean}};
export function APIConnections({initial,filter,encryptionConfigured,envOpenAI,oauthReady}:Props){
 const router=useRouter(),[pending,start]=useTransition(),[message,setMessage]=useState("");
 const [project,setProject]=useState(filter==="all"?initial.projects[0]?.id||"":filter);
 const preferred=filter!=="all"&&initial.projects.some(p=>p.id===filter)?filter:project;
 const selected=initial.projects.some(p=>p.id===preferred)?preferred:initial.projects[0]?.id||"";
 const providers:[Provider,string,string][]=[
  ["openai","OpenAI","Tạo nội dung và chat Đốm AI; API key lưu mã hóa riêng theo dự án."],
  ["wordpress","WordPress","Dùng Application Password; chỉ kiểm tra quyền đọc, chưa đăng bài."]
 ];
 const oauthProviders:OAuthProvider[]=["gsc","ga4","drive","google_ads","facebook","instagram"];
 function act(fn:()=>Promise<{ok:boolean;message:string}>){
  start(async()=>{try{const res=await fn();setMessage(res.message);router.refresh()}catch{setMessage("Không thực hiện được. Vui lòng thử lại.")}});
 }
 function save(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();const form=e.currentTarget;const data=new FormData(form);
  act(async()=>{const r=await saveConnectionAction(data);if(r.ok)form.reset();return r});
 }
 return <section className="panel"><div className="panel-head"><h3>Trung tâm kết nối API</h3><span className="chip"><ShieldCheck size={13}/> Khóa mã hóa ở máy chủ</span></div>
  <p className="muted">Chọn dự án, thêm thông tin API rồi kiểm tra. Không hiển thị lại mật khẩu hoặc API key sau khi lưu. Chưa có tự xuất bản.</p>
  {message&&<div className="alert" role="status">{message}<button onClick={()=>setMessage("")}>×</button></div>}
  <div className="ops-inline"><label htmlFor="connection-project">Dự án</label><select id="connection-project" value={selected} onChange={e=>{setProject(e.target.value);setMessage("")}}>{initial.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
  {!encryptionConfigured&&<p className="ops-warning"><b>Chưa bật kho khóa an toàn.</b> Quản trị viên cần đặt INTEGRATION_ENCRYPTION_KEY (Base64 của 32 byte) trên Vercel và áp dụng migration 004. Không nhập khóa thật khi chưa kích hoạt.</p>}
  {!selected&&<p className="muted">Hãy tạo dự án trước khi cấu hình API.</p>}
  <div className="cards integrations">{providers.map(([id,title,description])=>{
   const status=initial.integrations.find(x=>x.project_id===selected&&x.provider===id)?.connection_status||"disconnected";
   return <article className="integration" key={id}>
    <div className="card-icon"><PlugZap size={20}/></div><h3>{title}</h3>
    <span className={"chip"+(status==="connected"?" on":"")}>{status==="connected"?"Đã xác minh":status==="error"?"Kiểm tra thất bại":"Chưa xác minh"}</span>
    {id==="openai"&&envOpenAI&&<small>API key máy chủ không dùng chung; mỗi dự án phải lưu và xác minh khóa riêng.</small>}
    <p>{description}</p>
    <form className="form-stack" onSubmit={save}>
     <input type="hidden" name="project_id" value={selected}/>
     <input type="hidden" name="provider" value={id}/>
     {id==="wordpress"&&<label>Tên đăng nhập WordPress<input name="username" autoComplete="off" maxLength={200} required disabled={!encryptionConfigured||!selected}/></label>}
     <label>{id==="openai"?"OpenAI API Key":"Application Password"}
      <input type="password" name={id==="openai"?"api_key":"app_password"} autoComplete="new-password" required minLength={id==="openai"?10:8} disabled={!encryptionConfigured||!selected} placeholder="Chỉ nhập trên trang ứng dụng đã đăng nhập"/>
     </label>
     <button className="primary" type="submit" disabled={pending||!encryptionConfigured||!selected}><KeyRound size={15}/> Lưu khóa mã hóa</button>
    </form>
    <div className="ops-rowbuttons" style={{marginTop:12,justifyContent:"flex-start"}}>
     <button type="button" disabled={pending||!encryptionConfigured||!selected} onClick={()=>act(()=>testConnectionAction(selected,id))}><CheckCircle2 size={14}/> Kiểm tra</button>
     <button type="button" disabled={pending||!selected} onClick={()=>act(()=>disconnectAction(selected,id))}><Unplug size={14}/> Ngắt kết nối</button>
    </div>
   </article>;
  })}</div>
  <h3 style={{margin:"24px 0 14px"}}>Google, Meta và các nền tảng dữ liệu</h3>
  <p className="muted">Mỗi dự án cấp quyền OAuth riêng, không dùng token của dự án khác. Chỉ xác minh quyền đọc API thực tế; chưa tự đăng bài, quảng cáo hoặc thay đổi dữ liệu bên ngoài.</p>
  <div className="cards integrations">{oauthProviders.map(provider=>{
   const item=OAUTH_PROVIDERS[provider];
   const status=initial.integrations.find(x=>x.project_id===selected&&x.provider===provider)?.connection_status||"disconnected";
   const ready=provider==="google_ads"?oauthReady.ads:item.kind==="google"?oauthReady.google:oauthReady.meta;
   const origin=item.kind==="google"?"Google":"Meta";
   const startUrl="/api/integrations/oauth/start?provider="+encodeURIComponent(provider)+"&project="+encodeURIComponent(selected);
   return <article className="integration" key={provider}>
    <div className="card-icon"><PlugZap size={20}/></div>
    <h3>{item.name}</h3>
    <span className={"chip"+(status==="connected"?" on":"")}>{status==="connected"?"Đã xác minh tài sản":status==="error"?"Thiếu quyền hoặc tài sản":"Chưa kết nối"}</span>
    <p>{item.description}</p>
    {!ready&&<small>Chưa có cấu hình ứng dụng {origin} OAuth trên Vercel{provider==="google_ads"?" (cần cả Google Ads developer token)":""}.</small>}
    <div className="ops-rowbuttons" style={{marginTop:12,justifyContent:"flex-start"}}>
     {ready&&encryptionConfigured&&selected?
      <a className="primary" href={startUrl}><KeyRound size={15}/> {status==="disconnected"?"Kết nối "+origin:"Cấp lại quyền"}</a>:
      <button type="button" className="ops-outline" disabled title="Cần cấu hình OAuth Client ID và Client Secret trên Vercel trước"><KeyRound size={15}/> Chưa sẵn sàng OAuth</button>}
     <button type="button" disabled={pending||!selected||status==="disconnected"||!ready}
      onClick={()=>act(()=>testConnectionAction(selected,provider))}><CheckCircle2 size={14}/> Kiểm tra</button>
     {status!=="disconnected"&&<button type="button" disabled={pending||!selected}
      onClick={()=>act(()=>disconnectAction(selected,provider))}><Unplug size={14}/> Ngắt</button>}
    </div>
   </article>;
  })}</div>
  <details className="oauth-setup" style={{marginTop:20}}>
   <summary>Hướng dẫn cấu hình OAuth ứng dụng Google / Meta (thiết lập một lần)</summary>
   <div className="form-stack" style={{marginTop:12}}>
    <p><b>Google:</b> tạo OAuth Client (Web application) tại <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">Google Cloud Console</a>, bật API của GSC, GA4, Drive và/hoặc Google Ads. Trên Vercel Environment Variables, đặt <code>GOOGLE_OAUTH_CLIENT_ID</code> và <code>GOOGLE_OAUTH_CLIENT_SECRET</code>.</p>
    <p><b>Meta:</b> tạo ứng dụng tại <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer">Meta for Developers</a>, cấu hình Facebook Login for Business, App Review và quyền Trang/Instagram. Trên Vercel đặt <code>META_APP_ID</code> và <code>META_APP_SECRET</code>.</p>
    <p><b>Google Ads:</b> ngoài Google OAuth còn cần <code>GOOGLE_ADS_DEVELOPER_TOKEN</code> từ Google Ads API Center, và quyền truy cập tài khoản quảng cáo.</p>
    <p><b>Redirect URI cần khai báo chính xác trong Google Cloud và Meta:</b> <code>https://ngoc-agent-studio.vercel.app/api/integrations/oauth/callback</code></p>
    <small>Client Secret phải nhập trong Vercel (server-only), không dán vào chat. Sau khi thêm biến môi trường, redeploy để bật nút Kết nối.</small>
   </div>
  </details>
 </section>;
}
