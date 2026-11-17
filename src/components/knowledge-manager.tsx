"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {BookOpen,Check,Plus,Trash2,X,Pencil} from "lucide-react";
import type {WorkspaceData} from "@/lib/types";
import {deleteKnowledgeAction,updateKnowledgeAction} from "@/app/actions";

export function KnowledgeManager({initial,filter,onAdd}:{initial:WorkspaceData;filter:string;onAdd:()=>void}){
 const router=useRouter(),[pending,start]=useTransition(),[editing,setEditing]=useState<string|null>(null),[notice,setNotice]=useState("");
 const [title,setTitle]=useState(""),[content,setContent]=useState("");
 const projects=new Map(initial.projects.map(p=>[p.id,p.name]));
 const rows=initial.knowledge.filter(x=>filter==="all"||x.project_id===filter);
 function edit(id:string,name:string,body:string){setEditing(id);setTitle(name);setContent(body);setNotice("");}
 function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!editing)return;
  const data=new FormData(e.currentTarget),id=editing;
  start(async()=>{const result=await updateKnowledgeAction(id,data);setNotice(result.message);if(result.ok)setEditing(null);router.refresh()});
 }
 function remove(id:string){
  if(!window.confirm("Xóa vĩnh viễn mục tri thức này? Nội dung sẽ không còn được Agent tham khảo."))return;
  start(async()=>{const result=await deleteKnowledgeAction(id);setNotice(result.message);router.refresh()});
 }
 return <section className="panel"><div className="panel-head"><h3>Kho tri thức ({rows.length})</h3>
  <button className="primary" onClick={onAdd}><Plus size={16}/> Thêm tài liệu</button></div>
  {notice&&<div className="alert" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
  {rows.length===0?<p className="muted">Chưa có tri thức cho bộ lọc này. Thêm hướng dẫn thương hiệu, sản phẩm và tài liệu đã kiểm chứng.</p>:
   <div className="list">{rows.map(k=><div className="item" key={k.id}>
    <div className="card-icon"><BookOpen size={19}/></div><div className="item-main">
     <b>{k.title}</b><small>{k.project_id?projects.get(k.project_id):"Tri thức dùng chung"}</small>
     <p>{(k.content||"").slice(0,180)}</p>
     {editing===k.id&&<form className="form-stack" onSubmit={submit}>
      <label>Tiêu đề<input name="title" value={title} onChange={e=>setTitle(e.target.value)} maxLength={180} minLength={2} required/></label>
      <label>Nội dung<textarea name="content" value={content} onChange={e=>setContent(e.target.value)} maxLength={30000} minLength={20} rows={9} required/></label>
      <div className="ops-rowbuttons" style={{justifyContent:"flex-start"}}>
       <button className="primary" disabled={pending} type="submit"><Check size={14}/> Lưu chỉnh sửa</button>
       <button className="ops-outline" type="button" onClick={()=>setEditing(null)}><X size={14}/> Hủy</button>
      </div>
     </form>}
    </div><div className="ops-rowbuttons">
     <button disabled={pending} onClick={()=>edit(k.id,k.title||"",k.content||"")}><Pencil size={14}/> Sửa</button>
     <button disabled={pending} onClick={()=>remove(k.id)}><Trash2 size={14}/> Xóa</button>
    </div>
   </div>)}</div>}
 </section>;
}
