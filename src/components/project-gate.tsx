"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {ArrowRight,BrainCircuit,Check,FolderKanban,Globe2,LogOut,Plus,ShieldCheck,X} from "lucide-react";
import type {Row} from "@/lib/types";
import {createProjectAction,signOutAction} from "@/app/actions";
import {projectWorkspaceHref} from "@/lib/project-entry.mjs";

export function ProjectGate({projects,email,requestedTab,invalidProject=false,truncated=false}:{projects:Row[];email:string;requestedTab:string|null;invalidProject?:boolean;truncated?:boolean}){
 const router=useRouter();
 const [creating,setCreating]=useState(false);
 const [pending,start]=useTransition();
 const [notice,setNotice]=useState("");
 function create(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();
  const data=new FormData(e.currentTarget);
  start(async()=>{
   try{
    const res=await createProjectAction(data);
    if(!res.ok){setNotice(res.message);return;}
    if(res.projectId){router.push(projectWorkspaceHref(res.projectId,requestedTab));router.refresh();}
    else{setNotice("Đã tạo dự án. Chọn dự án từ danh sách để tiếp tục.");router.refresh();}
   }catch{setNotice("Không tạo được dự án. Kiểm tra kết nối và thử lại.");}
  });
 }
 return <main className="project-entry-screen">
  <div className="project-entry-container">
   <header className="project-entry-header">
    <div className="project-entry-brand"><div className="brand-logo"><BrainCircuit size={23}/></div><div><b>Ngọc Agent Studio</b><small>KHÔNG GIAN AI THEO DỰ ÁN</small></div></div>
    <button className="project-entry-logout" type="button" disabled={pending} onClick={()=>start(async()=>{await signOutAction();router.refresh()})}><LogOut size={17}/> Đăng xuất</button>
   </header>
   <div className="project-entry-intro">
    <div className="project-entry-icon"><FolderKanban size={26}/></div>
    <p className="eyebrow">BƯỚC 1 · CHỌN DỰ ÁN</p>
    <h1>Bạn muốn làm việc với dự án nào?</h1>
    <p>Chọn một dự án để mở không gian làm việc riêng. Agent, công việc, tri thức và kết nối API sẽ không trộn lẫn với dự án khác.</p>
    <span className="project-entry-privacy"><ShieldCheck size={15}/> Đã đăng nhập · {email}</span>
   </div>
   {invalidProject&&<p className="alert" role="alert">Dự án trong liên kết không tồn tại hoặc bạn không có quyền truy cập. Hãy chọn một dự án bên dưới.</p>}
   {truncated&&<p className="alert" role="status">Danh sách vượt 2.000 dự án. Hãy liên hệ quản trị để bật phân trang danh sách dự án đầy đủ.</p>}
   {notice&&<div className="alert" role="status">{notice}<button type="button" onClick={()=>setNotice("")} aria-label="Ẩn thông báo"><X size={15}/></button></div>}
   <div className="project-entry-toolbar"><h2>Dự án của bạn <span>({projects.length})</span></h2><button type="button" className="primary" onClick={()=>setCreating(v=>!v)} aria-expanded={creating}><Plus size={16}/> Dự án mới</button></div>
   {creating&&<section className="project-entry-create" aria-label="Tạo dự án mới">
    <div className="project-entry-create-head"><h3>Thêm dự án mới</h3><button type="button" onClick={()=>setCreating(false)} aria-label="Đóng form"><X size={17}/></button></div>
    <form className="form-stack" onSubmit={create}>
     <label>Tên dự án<input name="name" required minLength={2} maxLength={120} placeholder="Ví dụ: Sứ Việt SEO & Social"/></label>
     <label>Loại dự án<select name="category" defaultValue="SEO & Content"><option>SEO & Content</option><option>Marketing tổng hợp</option><option>Social Media</option><option>Khác</option></select></label>
     <label>Website HTTPS (nếu có)<input type="url" name="website_url" placeholder="https://ten-mien.vn" maxLength={500}/></label>
     <label>Mô tả<textarea name="description" rows={3} maxLength={1500} placeholder="Mục tiêu của dự án này"/></label>
     <button type="submit" className="primary" disabled={pending}><Check size={15}/>{pending?"Đang tạo...":"Tạo và vào dự án"}</button>
    </form>
   </section>}
   {projects.length===0?<div className="project-entry-empty"><FolderKanban size={30}/><h3>Chưa có dự án</h3><p>Bấm “Dự án mới” để tạo không gian làm việc đầu tiên.</p></div>:<div className="project-entry-grid">
    {projects.map(project=><Link className="project-entry-card" key={project.id} href={projectWorkspaceHref(project.id,requestedTab)}>
     <div className="project-entry-card-top"><div className="card-icon"><FolderKanban size={22}/></div><span className={"chip"+(project.status==="active"?" on":"")}>{project.status==="paused"?"Tạm dừng":project.status==="archived"?"Đã lưu trữ":"Đang hoạt động"}</span></div>
     <h3>{project.name}</h3><p>{project.description||project.category||"Không gian làm việc riêng"}</p>
     <small>{project.website_url?<><Globe2 size={13}/>{project.website_url}</>:"Chưa khai báo website"}</small>
     <span className="project-entry-enter">Vào không gian làm việc <ArrowRight size={16}/></span>
    </Link>)}
   </div>}
   <p className="project-entry-footnote">Mỗi dự án có vùng dữ liệu và cấu hình kết nối riêng. Dùng “Chuyển dự án” trong workspace để quay lại màn hình này.</p>
  </div>
 </main>;
}
