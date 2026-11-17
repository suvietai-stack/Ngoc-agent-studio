"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {Check,ClipboardList,FileText,Pencil,Play,Plus,RefreshCcw,X} from "lucide-react";
import type {WorkspaceData} from "@/lib/types";
import {updateTaskAction} from "@/app/actions";
import {recoverStaleTaskAction,runTaskAction} from "@/app/operations";

export function TaskManager({initial,filter,connectedProjects,onAdd,onOpenContent}:{initial:WorkspaceData;filter:string;connectedProjects:Set<string>;onAdd:()=>void;onOpenContent:()=>void}){
 const router=useRouter(),[pending,start]=useTransition(),[editing,setEditing]=useState<string|null>(null),[notice,setNotice]=useState("");
 const rows=initial.tasks.filter(t=>filter==="all"||t.project_id===filter);
 const projects=new Map(initial.projects.map(p=>[p.id,p.name]));
 const projectStates=new Map(initial.projects.map(p=>[p.id,p.status]));
 function execute(fn:()=>Promise<{ok:boolean;message:string}>,close=false){
  start(async()=>{try{const r=await fn();setNotice(r.message);if(r.ok&&close)setEditing(null);router.refresh();}
   catch{setNotice("Không thể xử lý công việc. Vui lòng thử lại.");}});
 }
 return <section className="panel"><div className="panel-head"><h3>Công việc & phê duyệt ({rows.length})</h3>
  <button className="primary" onClick={onAdd}><Plus size={16}/> Tạo việc</button></div>
  {notice&&<div className="alert" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
  {!rows.length?<p className="muted">Chưa có công việc cho dự án được chọn.</p>:<div className="list">{rows.map(t=>{
   const editable=["draft","failed"].includes(t.status||"")&&t.source!=="workflow";
   return <div className="item" key={t.id}><div className="card-icon"><ClipboardList size={19}/></div>
    <div className="item-main"><b>{t.title}</b><small>{projects.get(t.project_id||"")||"Dự án"} · {t.created_at?new Date(t.created_at).toLocaleString("vi-VN"):""}</small>
     <p>{t.brief}</p>
     {editing===t.id&&<form className="form-stack" onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);execute(()=>updateTaskAction(t.id,form),true);}}>
      <label>Tên công việc<input name="title" minLength={4} maxLength={200} required defaultValue={t.title}/></label>
      <label>Yêu cầu<textarea name="brief" rows={5} maxLength={5000} defaultValue={t.brief||""}/></label>
      <label>Agent phụ trách<select name="agent_id" defaultValue={t.agent_id||""}>
       <option value="">Chọn Agent để chạy AI</option>
       {initial.agents.filter(a=>a.project_id===t.project_id&&a.enabled).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
      </select></label>
      <div className="ops-rowbuttons" style={{justifyContent:"flex-start"}}>
       <button className="primary" disabled={pending} type="submit"><Check size={14}/> Lưu</button>
       <button className="ops-outline" type="button" onClick={()=>setEditing(null)}><X size={14}/> Hủy</button></div>
     </form>}
    </div>
    <span className={"chip"+(["approved","done"].includes(t.status||"")?" on":"")}>
     {t.status==="pending_approval"?"Cần duyệt nội dung":t.status==="approved"?"Nội dung đã duyệt":t.status==="running"?"AI đang chạy":t.status==="failed"?"Lỗi":t.status==="done"?"Hoàn tất":"Bản nháp"}</span>
    <div className="ops-rowbuttons">
     {editable&&<button disabled={pending} onClick={()=>setEditing(editing===t.id?null:t.id)}><Pencil size={14}/> Sửa</button>}
     {["draft","failed"].includes(t.status||"")&&<button disabled={pending||!t.agent_id||!connectedProjects.has(t.project_id||"")||projectStates.get(t.project_id||"")!=="active"} title={!t.agent_id?"Nhiệm vụ chưa gán Agent. Bấm Sửa để phân công.":projectStates.get(t.project_id||"")!=="active"?"Chỉ chạy khi dự án đang hoạt động":!connectedProjects.has(t.project_id||"")?"Cần xác minh API OpenAI riêng cho dự án này":""} onClick={()=>execute(()=>runTaskAction(t.id))}><Play size={14}/> Chạy AI</button>}
     {t.status==="running"&&<button type="button" disabled={pending} title="Chỉ khôi phục nếu nhiệm vụ bị kẹt trên 15 phút. Không gọi AI mới." onClick={()=>execute(()=>recoverStaleTaskAction(t.id))}><RefreshCcw size={14}/> Khôi phục nếu kẹt</button>}
     {t.status==="pending_approval"&&<button onClick={onOpenContent}><FileText size={14}/> Mở Nội dung</button>}
    </div>
   </div>;
  })}</div>}
 </section>;
}
