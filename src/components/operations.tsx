"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {Bot,CalendarClock,CheckCircle2,Clock3,FileText,Globe2,Play,Plus,Send,Sparkles,ToggleLeft,ToggleRight,WandSparkles} from "lucide-react";
import type {WorkspaceData} from "@/lib/types";
import {askDomAction,createCampaignAction,createScheduleAction,toggleScheduleAction,runScheduleNowAction,approveContentAction,seoAuditAction,updateProjectWebsiteAction,toggleProjectAutoRunAction,updateDraftContentAction} from "@/app/operations";
import type {Result} from "@/app/actions";
import {WorkflowBoard} from "@/components/workflows";

type Tab="dom"|"automations"|"content";
export function StudioOperations({tab,initial,filter,aiReady,runnerConfigured}:{tab:Tab;initial:WorkspaceData;filter:string;aiReady:boolean;runnerConfigured:boolean}){
 const router=useRouter(),[pending,start]=useTransition(),[notice,setNotice]=useState(""),[question,setQuestion]=useState(""),[answer,setAnswer]=useState(""),[answerProject,setAnswerProject]=useState(""),[selected,setSelected]=useState(""),[showForm,setShowForm]=useState(false),[editing,setEditing]=useState<string|null>(null),[editBody,setEditBody]=useState("");
 const projects=initial.projects;
 const selectedProject=filter!=="all"?filter:(selected&&projects.some(p=>p.id===selected)?selected:projects[0]?.id||"");
 const projectAiReady=initial.integrations.some(c=>c.project_id===selectedProject&&c.provider==="openai"&&c.connection_status==="connected");
 const projectMap=new Map(projects.map(p=>[p.id,p.name]));
 const schedules=initial.automations.filter(s=>s.project_id===selectedProject);
 const assets=initial.content.filter(a=>a.project_id===selectedProject);
 const chatMessages=initial.messages.filter(m=>m.project_id===selectedProject);
 function call(fn:()=>Promise<Result>){start(async()=>{try{const r=await fn();setNotice(r.message);router.refresh()}catch{setNotice("Không thể thực hiện. Kiểm tra kết nối.")}})}
 function scheduleSubmit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const data=new FormData(e.currentTarget);call(async()=>{const r=await createScheduleAction(data);if(r.ok)setShowForm(false);return r})}
 function ask(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(!question.trim())return;const content=question;start(async()=>{setNotice("");const r=await askDomAction(content,selectedProject||undefined);if(r.ok){setAnswer(r.answer||"");setAnswerProject(selectedProject);setQuestion("");router.refresh()}else setNotice(r.message)})}
 return <div className="ops">
 {notice&&<div className="alert" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
 {tab==="dom"&&<>
  <section className="ops-hero"><div className="ops-icon"><Sparkles size={26}/></div><div><p className="eyebrow">ĐỐM AI · TRỢ LÝ ĐIỀU PHỐI</p><h2>Hỏi Đốm bất cứ điều gì về chiến dịch.</h2><p>Đốm sử dụng dự án, nhiệm vụ và kho tri thức của bạn để tư vấn. Không tự đăng hoặc thay đổi tài khoản bên ngoài.</p></div></section>
  {!projectAiReady&&<div className="ops-warning"><b>Chưa bật bộ não AI</b><p>Thêm và xác minh OpenAI API key riêng của dự án trong tab Kết nối. Lịch tự động vẫn tạo hàng đợi công việc bình thường.</p></div>}
  <section className="panel ops-chat"><div className="ops-toolbar"><h3>Hội thoại với Đốm</h3><select aria-label="Chọn dự án hội thoại" value={selectedProject} onChange={e=>{setSelected(e.target.value);setAnswer("")}}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div className="ops-messages">
   {chatMessages.length===0&&(!answer||answerProject!==selectedProject)&&<div className="ops-placeholder"><Bot size={30}/><b>Đốm đang sẵn sàng nhận hướng dẫn</b><span>Gợi ý: “Lập kế hoạch SEO và social 7 ngày cho Sứ Việt.”</span></div>}
   {chatMessages.slice(-12).map(m=><div key={m.id} className={"ops-bubble "+(m.role==="user"?"self":"assistant")}><small>{m.role==="user"?"Bạn":"Đốm AI"}</small><p>{m.content}</p></div>)}
   {answer&&answerProject===selectedProject&&chatMessages.length===0&&<div className="ops-bubble assistant"><small>Đốm AI</small><p>{answer}</p></div>}
  </div><form className="ops-composer" onSubmit={ask}><textarea value={question} onChange={e=>setQuestion(e.target.value)} rows={3} maxLength={4000} required placeholder="Hỏi Đốm về SEO, kế hoạch marketing, công việc..." disabled={!projectAiReady||pending}/><button type="submit" className="primary" disabled={!aiReady||pending||question.trim().length<3}><Send size={16}/>{pending?"Đang nghĩ...":"Gửi Đốm"}</button></form></section>
 </>}
 {tab==="automations"&&<>
   <section className="panel"><div className="ops-toolbar"><div><h3>AI tự tạo bản nháp theo lịch</h3>
    <p>Worker Vercel chạy mỗi ngày, xử lý công việc đủ điều kiện có giới hạn lượt. Luôn duyệt nội dung trước khi chuyển Agent. Không đăng bài.</p></div>
    <span className={"chip "+(runnerConfigured?"on":"")}>{runnerConfigured?"Worker đã cấu hình":"Worker chưa cấu hình"}</span></div>
    <div className="ops-inline"><select aria-label="Chọn dự án tự động" value={selectedProject} onChange={e=>setSelected(e.target.value)}>
     {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
     <button className="ops-outline" disabled={pending||!selectedProject||!runnerConfigured} onClick={()=>call(()=>toggleProjectAutoRunAction(selectedProject,!projects.find(p=>p.id===selectedProject)?.auto_run_enabled))}>
      {projects.find(p=>p.id===selectedProject)?.auto_run_enabled?"Tắt tự chạy AI":"Bật tự chạy AI"}</button>
    </div><small>Chế độ cần migration 005, khóa máy chủ riêng và được tắt mặc định cho mỗi dự án.</small>
   </section>
  <WorkflowBoard initial={initial} filter={filter} selectedProject={selectedProject} onProjectChange={setSelected} aiReady={projectAiReady}/>
  <div className="ops-toolbar"><div><h3>Lịch tự động có thật</h3><p>Supabase Cron mỗi giờ kiểm tra lịch đến hạn, tạo công việc mới trong hàng đợi. Chạy AI và duyệt nội dung là bước riêng để tránh đăng nhầm.</p></div><button className="primary" onClick={()=>setShowForm(v=>!v)}><Plus size={16}/> Tạo lịch</button></div>
  <div className="panel"><h3>Bắt đầu nhanh</h3><p>Tạo 4 nhiệm vụ chuẩn SEO, Content, Social và Marketing cho dự án đang chọn, không cần API key.</p>
  <div className="ops-inline"><select aria-label="Chọn dự án" value={selectedProject} onChange={e=>setSelected(e.target.value)}>{projects.length===0?<option value="">Chưa có dự án</option>:projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
   <button className="primary" disabled={pending||!selectedProject} onClick={()=>call(()=>createCampaignAction(selectedProject))}><WandSparkles size={16}/> Tạo chiến dịch</button>
   <button className="ops-outline" disabled={pending||!selectedProject} onClick={()=>call(()=>seoAuditAction(selectedProject))}><Globe2 size={16}/> Audit SEO website</button></div>
  <form className="ops-url-form" onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);call(()=>updateProjectWebsiteAction(selectedProject,String(form.get("website_url")||"")))}}>
   <label>Website HTTPS để kiểm tra SEO<input key={selectedProject} type="url" name="website_url" defaultValue={projects.find(p=>p.id===selectedProject)?.website_url||""} placeholder="https://website-cua-ban.vn" required maxLength={500}/></label>
   <button type="submit" className="ops-outline" disabled={pending||!selectedProject}>Lưu website</button>
  </form>
  <small>Audit chỉ quét HTML thật từ website HTTPS đã khai báo trong dự án. Không tự nhận có số liệu Google Search Console.</small></div>
  {showForm&&<section className="panel"><h3>Thiết lập lịch mới</h3><form className="form-stack" onSubmit={scheduleSubmit}>
    <label>Dự án<select name="project_id" value={selectedProject} onChange={e=>setSelected(e.target.value)} required>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>Tên công việc<input name="title" required minLength={4} maxLength={180} placeholder="Ví dụ: Kiểm tra kế hoạch social mỗi ngày"/></label>
    <label>Agent phụ trách<select name="agent_id" required><option value="">Chọn Agent bắt buộc</option>{initial.agents.filter(a=>a.project_id===selectedProject&&a.enabled).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <label>Yêu cầu<textarea name="brief" maxLength={5000} rows={3} placeholder="Mô tả nội dung cần sinh theo lịch"/></label>
    <label>Tần suất<select name="frequency"><option value="daily">Hằng ngày</option><option value="weekly">Hằng tuần</option></select></label>
    <div className="ops-inline"><button className="primary" disabled={pending||!selectedProject} type="submit">Lưu và bật lịch</button><button className="ops-outline" type="button" onClick={()=>setShowForm(false)}>Hủy</button></div>
  </form></section>}
  <section className="panel"><h3>Đang theo dõi ({schedules.length})</h3>
  {schedules.length===0?<p className="muted">Chưa có lịch. Tạo lịch đầu tiên để kích hoạt hàng đợi tự động.</p>:<div className="ops-list">
   {schedules.map(s=><div className="ops-schedule" key={s.id}><div className="ops-icon"><CalendarClock size={18}/></div><div className="ops-grow"><b>{s.title}</b><p>{s.brief||"Không có mô tả"}</p><small>{projectMap.get(s.project_id||"")||"Dự án"} · {s.frequency==="daily"?"Hằng ngày":"Hằng tuần"} · Lần tiếp: {s.next_run_at?new Date(s.next_run_at).toLocaleString("vi-VN"):"—"}</small></div><div className="ops-rowbuttons"><button disabled={pending} onClick={()=>call(()=>runScheduleNowAction(s.id))} title="Thêm một việc vào hàng đợi"><Play size={14}/> Chạy lịch</button><button disabled={pending} onClick={()=>call(()=>toggleScheduleAction(s.id,!s.enabled))}>{s.enabled?<><ToggleRight size={17}/> Đang bật</>:<><ToggleLeft size={17}/> Đã tắt</>}</button></div></div>)}
  </div>}</section>
 </>}
 {tab==="content"&&<>
  <div className="ops-toolbar"><div><h3>Thư viện bản nháp và báo cáo</h3><p>Nội dung do AI tạo hoặc SEO Audit ghi vào đây. Mọi nội dung đều phải được duyệt thủ công; hiện chưa kết nối công cụ đăng bài.</p></div><span className="chip on">{assets.length} tài liệu</span></div>
  {assets.length===0?<section className="panel ops-placeholder"><FileText size={36}/><b>Chưa có bản nháp</b><p>Hãy chạy một công việc AI ở tab Công việc, hoặc tạo báo cáo audit trong Tự động hóa.</p></section>:<div className="ops-list">{assets.map(a=><article className="panel ops-asset" key={a.id}><div className="ops-assethead"><div><span className="eyebrow">{a.channel||"CONTENT"} · {projectMap.get(a.project_id||"")||"Dự án"}</span><h3>{a.title}</h3><small>{a.created_at?new Date(a.created_at).toLocaleString("vi-VN"):""}</small></div><span className={"chip "+(a.status==="approved"?"on":"")}>{a.status==="approved"?"Đã duyệt":"Bản nháp"}</span></div><details><summary>Xem nội dung đầy đủ</summary><pre className="ops-content">{a.body}</pre></details><div className="ops-inline"><button className="ops-outline" onClick={()=>{void navigator.clipboard.writeText(a.body||"");setNotice("Đã sao chép nội dung.")}}>Sao chép</button>
 {a.status!=="approved"&&<><button className="ops-outline" onClick={()=>{setEditing(a.id);setEditBody(a.body||"")}}>Chỉnh sửa</button>
 <button className="primary" disabled={pending} onClick={()=>call(()=>approveContentAction(a.id))}><CheckCircle2 size={15}/> Duyệt nội dung</button></>}</div>
 {editing===a.id&&<form className="form-stack" onSubmit={e=>{e.preventDefault();call(async()=>{const r=await updateDraftContentAction(a.id,editBody);if(r.ok)setEditing(null);return r})}}>
 <label>Chỉnh sửa bản nháp<textarea value={editBody} onChange={e=>setEditBody(e.target.value)} rows={12} minLength={20} maxLength={16000} required/></label>
 <div className="ops-inline"><button className="primary" type="submit" disabled={pending||editBody.trim().length<20}>Lưu bản nháp</button>
 <button className="ops-outline" type="button" onClick={()=>setEditing(null)}>Hủy</button></div></form>}</article>)}</div>}
 </>}
 </div>;
}
