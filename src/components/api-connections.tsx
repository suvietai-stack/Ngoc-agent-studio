"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {CheckCircle2,KeyRound,PlugZap,ShieldCheck,Unplug} from "lucide-react";
import type {WorkspaceData} from "@/lib/types";
import {disconnectAction,saveConnectionAction,saveOAuthAppConfigAction,testConnectionAction} from "@/app/integrations";
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
 const googleApp=initial.integrations.find(x=>x.project_id===selected&&x.provider==="google_oauth_app");
 const metaApp=initial.integrations.find(x=>x.project_id===selected&&x.provider==="meta_oauth_app");
 const googleReady=Boolean(googleApp)||oauthReady.google;
 const metaReady=Boolean(metaApp)||oauthReady.meta;
 const adsReady=oauthReady.ads||Boolean(googleApp?.display_name==="Google OAuth App + Ads");
 function act(fn:()=>Promise<{ok:boolean;message:string}>){
  start(async()=>{try{const res=await fn();setMessage(res.message);router.refresh()}catch{setMessage("Không thực hiện được. Vui lòng thử lại.")}});
 }
 function saveOAuthApp(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();
  const form=e.currentTarget,data=new FormData(form);
  act(async()=>{const r=await saveOAuthAppConfigAction(data);if(r.ok)form.reset();return r});
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

  <h3 style={{margin:"24px 0 14px"}}>Cấu hình ứng dụng OAuth theo dự án</h3>
  <p className="muted">Nhập Client ID và Client Secret ngay trên app; dữ liệu được mã hóa riêng cho dự án. Đây là thông tin OAuth App do Google Cloud/Meta cấp, không phải access token cá nhân.</p>
  <div className="cards integrations">
   <article className="integration">
    <div className="card-icon"><KeyRound size={19}/></div>
    <h3>Google OAuth App</h3>
    <span className={"chip"+(googleReady?" on":"")}>{googleApp?"Đã lưu trong dự án":oauthReady.google?"Đã cấu hình máy chủ":"Chưa cấu hình"}</span>
    <p>Dùng cho Search Console, GA4, Drive và Google Ads.</p>
    <form className="form-stack" onSubmit={saveOAuthApp}>
     <input type="hidden" name="project_id" value={selected}/><input type="hidden" name="kind" value="google"/>
     <label>Google OAuth Client ID<input name="client_id" autoComplete="off" maxLength={400} minLength={5} required disabled={!selected||!encryptionConfigured} placeholder="...apps.googleusercontent.com"/></label>
     <label>Google OAuth Client Secret<input name="client_secret" type="password" autoComplete="new-password" maxLength={4096} minLength={5} required disabled={!selected||!encryptionConfigured} placeholder="Client secret từ Google Cloud"/></label>
     <label>Google Ads Developer Token (không bắt buộc)<input name="developer_token" type="password" autoComplete="new-password" maxLength={1000} disabled={!selected||!encryptionConfigured} placeholder="Chỉ cần nếu dùng Google Ads"/></label>
     <button type="submit" className="primary" disabled={pending||!selected||!encryptionConfigured}>Lưu cấu hình Google</button>
    </form>
   </article>
   <article className="integration">
    <div className="card-icon"><KeyRound size={19}/></div>
    <h3>Meta OAuth App</h3>
    <span className={"chip"+(metaReady?" on":"")}>{metaApp?"Đã lưu trong dự án":oauthReady.meta?"Đã cấu hình máy chủ":"Chưa cấu hình"}</span>
    <p>Dùng cho Facebook Page và tài khoản Instagram Professional.</p>
    <form className="form-stack" onSubmit={saveOAuthApp}>
     <input type="hidden" name="project_id" value={selected}/><input type="hidden" name="kind" value="meta"/>
     <label>Meta App ID<input name="client_id" autoComplete="off" maxLength={400} minLength={5} required disabled={!selected||!encryptionConfigured} placeholder="App ID từ Meta for Developers"/></label>
     <label>Meta App Secret<input name="client_secret" type="password" autoComplete="new-password" maxLength={4096} minLength={5} required disabled={!selected||!encryptionConfigured} placeholder="App Secret từ Meta"/></label>
     <button type="submit" className="primary" disabled={pending||!selected||!encryptionConfigured}>Lưu cấu hình Meta</button>
    </form>
   </article>
  </div>
  <p className="muted">Lưu lại Client ID/Secret mới sẽ ngắt các token OAuth cũ trong dự án và yêu cầu cấp quyền lại. Không có nội dung nào được tự xuất bản.</p>
  <h3 style={{margin:"24px 0 14px"}}>Google, Meta và các nền tảng dữ liệu</h3>
  <p className="muted">Mỗi dự án cấp quyền OAuth riêng, không dùng token của dự án khác. Chỉ xác minh quyền đọc API thực tế; chưa tự đăng bài, quảng cáo hoặc thay đổi dữ liệu bên ngoài.</p>
  <div className="cards integrations">{oauthProviders.map(provider=>{
   const item=OAUTH_PROVIDERS[provider];
   const status=initial.integrations.find(x=>x.project_id===selected&&x.provider===provider)?.connection_status||"disconnected";
   const ready=provider==="google_ads"?googleReady&&adsReady:item.kind==="google"?googleReady:metaReady;
   const origin=item.kind==="google"?"Google":"Meta";
   const startUrl="/api/integrations/oauth/start?provider="+encodeURIComponent(provider)+"&project="+encodeURIComponent(selected);
   return <article className="integration" key={provider}>
    <div className="card-icon"><PlugZap size={20}/></div>
    <h3>{item.name}</h3>
    <span className={"chip"+(status==="connected"?" on":"")}>{status==="connected"?"Đã xác minh tài sản":status==="error"?"Thiếu quyền hoặc tài sản":"Chưa kết nối"}</span>
    <p>{item.description}</p>
    {!ready&&<small>Chưa có Client ID/Secret {origin} OAuth trong dự án hoặc Vercel{provider==="google_ads"?" (cần Google Ads Developer Token)":""}.</small>}
    <div className="ops-rowbuttons" style={{marginTop:12,justifyContent:"flex-start"}}>
     {ready&&encryptionConfigured&&selected?
      <a className="primary" href={startUrl}><KeyRound size={15}/> {status==="disconnected"?"Kết nối "+origin:"Cấp lại quyền"}</a>:
      <button type="button" className="ops-outline" disabled title="Lưu Client ID và Client Secret trong form ở trên hoặc cấu hình biến môi trường trên Vercel"><KeyRound size={15}/> Chưa sẵn sàng OAuth</button>}
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
    <p><b>Google:</b> tạo OAuth Client (Web application) tại <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">Google Cloud Console</a>, bật API của GSC, GA4, Drive và/hoặc Ads. Nhập Client ID/Secret vào form Google ngay trên app. Biến môi trường Vercel cũng được hỗ trợ.</p>
    <p><b>Meta:</b> tạo ứng dụng tại <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer">Meta for Developers</a>, bật Facebook Login for Business và quyền Trang/Instagram. Nhập App ID/Secret vào form Meta ngay trên app. App Review có thể cần được Meta phê duyệt.</p>
    <p><b>Google Ads:</b> cần Developer Token từ Google Ads API Center, nhập trong form Google phía trên hoặc đặt biến máy chủ <code>GOOGLE_ADS_DEVELOPER_TOKEN</code>.</p>
    <p><b>Redirect URI cần khai báo chính xác trong Google Cloud và Meta:</b> <code>https://ngoc-agent-studio.vercel.app/api/integrations/oauth/callback</code></p>
    <small>Cấu hình trong app được mã hóa ở máy chủ theo dự án. Nếu dùng biến môi trường Vercel thay thế, thêm biến server-only và triển khai lại. Không dán Client Secret vào chat.</small>
   </div>
  </details>
 </section>;
}
