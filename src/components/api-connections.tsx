"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {CheckCircle2,KeyRound,PlugZap,ShieldCheck,Unplug} from "lucide-react";
import type {WorkspaceData} from "@/lib/types";
import {disconnectAction,saveConnectionAction,testConnectionAction} from "@/app/integrations";
import type {Provider} from "@/lib/integration-credentials";
type Props={initial:WorkspaceData;filter:string;encryptionConfigured:boolean;envOpenAI:boolean};
export function APIConnections({initial,filter,encryptionConfigured,envOpenAI}:Props){
 const router=useRouter(),[pending,start]=useTransition(),[message,setMessage]=useState("");
 const [project,setProject]=useState(filter==="all"?initial.projects[0]?.id||"":filter);
 const selected=initial.projects.some(p=>p.id===project)?project:initial.projects[0]?.id||"";
 const providers:[Provider,string,string][]=[
  ["openai","OpenAI","Tạo nội dung và chat Đốm AI; API key lưu mã hóa riêng theo dự án."],
  ["wordpress","WordPress","Dùng Application Password; chỉ kiểm tra quyền đọc, chưa đăng bài."]
 ];
 const future=[["Google Search Console","Cần kết nối Google OAuth"],["Google Analytics 4","Cần Google OAuth và quyền Analytics"],["Facebook / Instagram","Cần Meta OAuth và quyền Page"],["Google Drive","Cần Google OAuth"],["Google Ads","Cần OAuth, developer token và quyền quảng cáo"]];
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
  <div className="ops-inline"><label htmlFor="connection-project">Dự án</label><select id="connection-project" value={selected} onChange={e=>setProject(e.target.value)}>{initial.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
  {!encryptionConfigured&&<p className="ops-warning"><b>Chưa bật kho khóa an toàn.</b> Quản trị viên cần đặt INTEGRATION_ENCRYPTION_KEY (Base64 của 32 byte) trên Vercel và áp dụng migration 004. Không nhập khóa thật khi chưa kích hoạt.</p>}
  {!selected&&<p className="muted">Hãy tạo dự án trước khi cấu hình API.</p>}
  <div className="cards integrations">{providers.map(([id,title,description])=>{
   const status=initial.integrations.find(x=>x.project_id===selected&&x.provider===id)?.connection_status||"disconnected";
   return <article className="integration" key={id}>
    <div className="card-icon"><PlugZap size={20}/></div><h3>{title}</h3>
    <span className={"chip"+(status==="connected"?" on":"")}>{status==="connected"?"Đã xác minh":status==="error"?"Kiểm tra thất bại":"Chưa xác minh"}</span>
    {id==="openai"&&envOpenAI&&<small>Máy chủ đã có OpenAI API key dùng chung.</small>}
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
  <h3 style={{margin:"24px 0 14px"}}>Các nền tảng cần OAuth chính thức</h3>
  <div className="cards integrations">{future.map(([name,description])=><article className="integration" key={name}>
   <div className="card-icon"><PlugZap size={20}/></div><h3>{name}</h3><span className="chip">Chưa kết nối</span><p>{description}. Không yêu cầu dán access token vào ứng dụng khi chưa có quy trình OAuth an toàn.</p>
  </article>)}</div>
 </section>;
}
