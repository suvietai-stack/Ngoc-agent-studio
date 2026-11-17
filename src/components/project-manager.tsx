"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {ArrowRight,Check,FolderKanban,Pencil,Plus,X} from "lucide-react";
import type {WorkspaceData} from "@/lib/types";
import {updateProjectAction} from "@/app/actions";
export function ProjectManager({initial,filter,onAdd,onOpenAgents}:{initial:WorkspaceData;filter:string;onAdd:()=>void;onOpenAgents:(id:string)=>void}){
 const router=useRouter(),[pending,start]=useTransition(),[editing,setEditing]=useState<string|null>(null),[notice,setNotice]=useState("");
 const rows=initial.projects.filter(p=>filter==="all"||p.id===filter);
 const submit=(e:React.FormEvent<HTMLFormElement>,id:string)=>{
  e.preventDefault();const payload=new FormData(e.currentTarget);
  start(async()=>{const result=await updateProjectAction(id,payload);setNotice(result.message);if(result.ok)setEditing(null);router.refresh()});
 };
 return <section className="panel"><div className="panel-head"><h3>Danh sách dự án ({rows.length})</h3>
  <button className="primary" onClick={onAdd}><Plus size={16}/> Dự án mới</button></div>
  {notice&&<div className="alert" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
  {!rows.length?<p className="muted">Chưa có dự án. Hãy tạo dự án đầu tiên để phân công Agent và kết nối API.</p>:<div className="cards">
   {rows.map(p=><article className="project-card" key={p.id}>
    <div className="card-icon"><FolderKanban size={22}/></div><h3>{p.name}</h3>
    <p>{p.category||"SEO & Content"}</p><small>{p.website_url||"Chưa có website"}</small>
    <div className="ops-inline"><span className={"chip"+(p.status==="active"?" on":"")}>{p.status==="paused"?"Tạm dừng":p.status==="archived"?"Lưu trữ":"Đang hoạt động"}</span></div>
    <div className="card-bottom"><button className="flat" onClick={()=>onOpenAgents(p.id)}>Mở Agent <ArrowRight size={15}/></button>
     <button className="flat" onClick={()=>setEditing(editing===p.id?null:p.id)}><Pencil size={15}/> Sửa</button></div>
    {editing===p.id&&<form key={p.id} className="form-stack" onSubmit={e=>submit(e,p.id)}>
     <label>Tên dự án<input name="name" defaultValue={p.name} minLength={2} maxLength={120} required/></label>
     <label>Loại dự án<input name="category" defaultValue={p.category||"SEO & Content"} maxLength={80}/></label>
     <label>Website HTTPS<input name="website_url" type="url" defaultValue={p.website_url||""} maxLength={500} placeholder="https://website.vn"/></label>
     <label>Mô tả<textarea name="description" rows={3} maxLength={1500} defaultValue={p.description||""}/></label>
     <label>Trạng thái<select name="status" defaultValue={p.status||"active"}>
      <option value="active">Đang hoạt động</option><option value="paused">Tạm dừng</option><option value="archived">Lưu trữ</option></select></label>
     <small>Tạm dừng hoặc lưu trữ dự án cũng tắt chế độ AI tự tạo bản nháp.</small>
     <div className="ops-rowbuttons" style={{justifyContent:"flex-start"}}>
      <button className="primary" type="submit" disabled={pending}><Check size={14}/> Lưu</button>
      <button className="ops-outline" type="button" onClick={()=>setEditing(null)}><X size={14}/> Hủy</button></div>
    </form>}
   </article>)}</div>}
 </section>;
}
