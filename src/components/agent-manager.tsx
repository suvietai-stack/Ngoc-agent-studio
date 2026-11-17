"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {Bot,Check,Pencil,Plus,X} from "lucide-react";
import type {WorkspaceData} from "@/lib/types";
import {toggleAgentAction,updateAgentAction} from "@/app/actions";
export function AgentManager({initial,filter,onAdd}:{initial:WorkspaceData;filter:string;onAdd:()=>void}){
 const router=useRouter(),[pending,start]=useTransition(),[editing,setEditing]=useState<string|null>(null),[notice,setNotice]=useState(""),[group,setGroup]=useState("all");
 const projects=new Map(initial.projects.map(p=>[p.id,p.name]));
 const rows=initial.agents.filter(a=>filter==="all"||a.project_id===filter);
 const groupList=[
  {id:"all",label:"Tất cả"},
  {id:"seo",label:"SEO & Website"},
  {id:"content",label:"Content & Media"},
  {id:"marketing",label:"Facebook & Marketing"},
  {id:"quality",label:"Đốm & Kiểm định"},
  {id:"other",label:"Khác"}
 ];
 const bucket=(name:string)=>{
  if(/^(đốm|quality|reporting)/i.test(name))return "quality";
  if(/seo|backlink|technical|internal link|on-page|guardian/i.test(name))return "seo";
  if(/content|media/i.test(name))return "content";
  if(/social|marketing|facebook|lead|cro/i.test(name))return "marketing";
  return "other";
 };
 const visible=group==="all"?rows:rows.filter(a=>bucket(a.name||"")===group);
 const execute=(fn:()=>Promise<{ok:boolean;message:string}>,close=false)=>start(async()=>{
  try{const result=await fn();setNotice(result.message);if(result.ok&&close)setEditing(null);router.refresh();}
  catch{setNotice("Không thể lưu Agent. Kiểm tra kết nối.");}
 });
 return <section className="panel"><div className="panel-head"><h3>Đội ngũ Agent ({rows.length})</h3>
  <button className="primary" onClick={onAdd}><Plus size={16}/> Tạo Agent</button></div>
  {notice&&<div className="alert" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
  {rows.length>0&&<div className="agent-groups" role="group" aria-label="Lọc đội Agent">{groupList.map(g=><button type="button" key={g.id} aria-pressed={group===g.id} className={group===g.id?"agent-group-active":""} onClick={()=>setGroup(g.id)}>{g.label} <small>{g.id==="all"?rows.length:rows.filter(a=>bucket(a.name||"")===g.id).length}</small></button>)}</div>}
  {!rows.length?<p className="muted">Chưa có Agent cho dự án này.</p>:!visible.length?<p className="muted">Chưa có Agent trong nhóm này.</p>:<div className="cards">{visible.map(a=><article className="agent-card" key={a.id}>
   <div className="card-icon"><Bot size={22}/></div><div className="status-top"><span className={"chip"+(a.enabled?" on":"")}>{a.enabled?"Đã bật":"Đang tắt"}</span></div>
   <h3>{a.name}</h3><p>{a.purpose}</p><small>{a.project_id?projects.get(a.project_id):"Không xác định dự án"} · {a.model}</small>
   <div className="card-bottom"><button className="flat" onClick={()=>setEditing(editing===a.id?null:a.id)}><Pencil size={14}/> Sửa</button>
    <button className="flat" disabled={pending} onClick={()=>execute(()=>toggleAgentAction(a.id,!a.enabled))}>{a.enabled?"Tắt Agent":"Bật Agent"}</button></div>
   {editing===a.id&&<form key={a.id} className="form-stack" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);execute(()=>updateAgentAction(a.id,data),true);}}>
    <label>Tên Agent<input name="name" minLength={2} maxLength={100} defaultValue={a.name} required/></label>
    <label>Vai trò<input name="purpose" minLength={6} maxLength={500} defaultValue={a.purpose} required/></label>
    <label>Hướng dẫn làm việc<textarea name="instructions" minLength={10} maxLength={20000} rows={8} defaultValue={a.instructions} required/></label>
    <label>Mô hình<input name="model" minLength={3} maxLength={100} defaultValue={a.model} required/></label>
    <small>Không thay đổi dự án gốc hoặc quyền công cụ khi chỉnh sửa hướng dẫn Agent.</small>
    <div className="ops-rowbuttons" style={{justifyContent:"flex-start"}}>
     <button className="primary" type="submit" disabled={pending}><Check size={14}/> Lưu Agent</button>
     <button className="ops-outline" type="button" onClick={()=>setEditing(null)}><X size={14}/> Hủy</button></div>
   </form>}
  </article>)}</div>}
 </section>;
}
