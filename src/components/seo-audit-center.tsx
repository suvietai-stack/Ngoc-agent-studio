"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {Activity,AlertCircle,AlertTriangle,CheckCircle2,ExternalLink,FileSearch,Globe2,Link2,RefreshCw,ShieldCheck} from "lucide-react";
import type {WorkspaceData} from "@/lib/types";
import {seoAuditAction,updateProjectWebsiteAction} from "@/app/operations";
import {parseSeoAuditReport} from "@/lib/seo-audit-report.mjs";
export function SeoAuditCenter({initial,projectId}:{initial:WorkspaceData;projectId:string}){
 const router=useRouter();
 const [pending,start]=useTransition();
 const [notice,setNotice]=useState("");
 const [website,setWebsite]=useState(initial.projects[0]?.website_url||"");
 const auditAssets=initial.content.filter(x=>x.project_id===projectId&&x.channel==="seo-audit").sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
 const latest=auditAssets[0];
 const report=latest?parseSeoAuditReport(latest.body):null;
 function call(fn:()=>Promise<{ok:boolean;message:string}>){
  start(async()=>{try{const result=await fn();setNotice(result.message);router.refresh();}catch{setNotice("Lỗi kết nối. Vui lòng kiểm tra rồi thử lại.");}});
 }
 return <div className="seo-center">
  <section className="panel seo-head">
   <div className="seo-head-copy"><p className="eyebrow">SEO WEBSITE · TRUNG TÂM CHIẾN LƯỢC</p><h2>Audit website và ưu tiên cải thiện</h2><p>Kiểm tra mẫu URL thực tế trước khi tạo nội dung. Mọi vấn đề đều cần đối chiếu ngữ cảnh; không có điểm SEO ảo hoặc cam kết thứ hạng.</p></div>
   <div className="seo-head-icon"><FileSearch size={30}/></div>
  </section>
  {notice&&<div className="alert" role="status">{notice}<button type="button" onClick={()=>setNotice("")} aria-label="Đóng thông báo">×</button></div>}
  <section className="panel seo-tools">
   <div><h3>Website của dự án</h3><p>Chỉ quét địa chỉ HTTPS đã lưu. Giới hạn tối đa 6 URL/lần để không gây tải lớn.</p></div>
   <form onSubmit={e=>{e.preventDefault();call(()=>updateProjectWebsiteAction(projectId,website));}} className="seo-site-form">
    <label htmlFor="seo-website">Địa chỉ website HTTPS</label>
    <div className="seo-site-controls">
     <input id="seo-website" type="url" value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://website.vn" maxLength={500} required/>
     <button className="ops-outline" disabled={pending||!website.trim()} type="submit">Lưu website</button>
     <button className="primary" disabled={pending||!initial.projects[0]?.website_url||initial.projects[0]?.status!=="active"} type="button" onClick={()=>call(()=>seoAuditAction(projectId))}><RefreshCw size={15}/>{pending?"Đang xử lý...":"Quét SEO"}</button>
    </div>
    <small>Nếu bạn vừa thay đổi URL, hãy bấm Lưu website trước khi quét. Không tự quét nền hoặc thay đổi nội dung website.</small>
   </form>
  </section>
  {report&&latest?<><section className="seo-metrics" aria-label="Số liệu Audit SEO">
    <article className="seo-metric"><span>URL đã quét</span><b>{report.scanned}<small> / {report.limit||6}</small></b><p>Phạm vi mẫu URL</p><Globe2 size={19}/></article>
    <article className="seo-metric"><span>Cần ưu tiên xác minh</span><b>{report.high}</b><p>Vấn đề mức cao</p><AlertCircle size={19}/></article>
    <article className="seo-metric"><span>Cảnh báo</span><b>{report.medium}</b><p>Vấn đề mức trung bình</p><AlertTriangle size={19}/></article>
    <article className="seo-metric"><span>Liên kết nội bộ</span><b>{report.discovered}</b><p>URL đích được phát hiện</p><Link2 size={19}/></article>
   </section>
   <section className="panel seo-data-note"><div><CheckCircle2 size={18}/><b>Quét từ dữ liệu website thật</b></div><p>Quét lúc {report.time?new Date(report.time).toLocaleString("vi-VN"):"không rõ"} · {report.pending} URL phát hiện chưa quét · {report.failed} URL đọc lỗi. <b>Chưa phải full-site audit</b>; chưa xác minh trạng thái index, thứ hạng, backlink, Core Web Vitals hoặc GSC/GA4.</p></section>
   <section className="panel seo-pages"><div className="ops-toolbar"><div><h3>URL và vấn đề cần kiểm tra ({report.pages.length})</h3><p>Mỗi kết quả có URL và bằng chứng từ HTML. Nhấp để xem chi tiết.</p></div><span className="chip">{report.high+report.medium} cảnh báo cao/trung bình</span></div>
    <div className="seo-page-list">{report.pages.map((p,i)=>{
     const high=p.issues.filter(x=>x.severity==="high").length;
     const med=p.issues.filter(x=>x.severity==="medium").length;
     return <details className="seo-page" key={p.url} open={i===0}>
      <summary><span className="seo-page-title"><b>{p.title&&p.title!=="THIẾU"?p.title:"Trang chưa có title"}</b><small>{p.url}</small></span><span className={"chip "+(high?"":med?"":"on")}>{high?high+" ưu tiên cao":med?med+" cảnh báo":"Không có cảnh báo cao"}</span></summary>
      <div className="seo-issue-list">{p.issues.length?p.issues.map((issue,j)=><div className="seo-issue" key={j}>{issue.severity==="high"?<AlertCircle size={16}/>:issue.severity==="medium"?<AlertTriangle size={16}/>:<Activity size={16}/>}<span><b>{issue.severity==="high"?"Ưu tiên xác minh":issue.severity==="medium"?"Khuyến nghị":"Thông tin"}</b>{issue.message}</span></div>):<p>Chưa phát hiện lỗi trong những trường đã kiểm tra, không có nghĩa trang đạt toàn bộ tiêu chuẩn SEO.</p>}</div>
      <a href={p.url} rel="noopener noreferrer" target="_blank">Mở URL trên website <ExternalLink size={13}/></a>
     </details>;
    })}</div>
   </section>
   </>:<section className="panel seo-empty"><ShieldCheck size={28}/><h3>{latest?"Báo cáo Audit phiên bản cũ":"Chưa có lần Audit mẫu"}</h3><p>{latest?"Báo cáo cũ chưa có các chỉ số có cấu trúc. Bạn vẫn xem được nội dung gốc bên dưới.":"Lưu địa chỉ website và chạy quét lần đầu. Hệ thống sẽ chỉ hiển thị dữ liệu thực tế."}</p></section>}
  {auditAssets.length>0&&<section className="panel"><h3>Lịch sử báo cáo ({auditAssets.length})</h3><p className="muted">Lưu trong kho nội dung của đúng dự án. Không tự tạo nhiệm vụ sửa hoặc xuất bản.</p><div className="seo-history">{auditAssets.slice(0,15).map(a=><details key={a.id}><summary><FileSearch size={16}/><span>{a.title} · {a.created_at?new Date(a.created_at).toLocaleString("vi-VN"):"Không rõ thời gian"}</span></summary><pre className="ops-content">{a.body}</pre></details>)}</div></section>}
 </div>;
}
