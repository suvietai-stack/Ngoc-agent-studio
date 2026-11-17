"use client";
import {AlertCircle,CheckCircle2,FileCheck2,PlugZap,Search,UserRoundCheck} from "lucide-react";
import type {WorkspaceData} from "@/lib/types";
type Section="content"|"tasks"|"seo"|"integrations";
export function DecisionInbox({initial,projectId,onNavigate}:{initial:WorkspaceData;projectId:string;onNavigate:(tab:Section)=>void}){
 const tasks=initial.tasks.filter(t=>t.project_id===projectId);
 const approvals=tasks.filter(t=>t.status==="pending_approval");
 const unassigned=tasks.filter(t=>t.source==="seo-audit"&&!t.agent_id&&["draft","failed"].includes(t.status||""));
 const failures=initial.integrations.filter(i=>i.project_id===projectId&&i.connection_status==="error");
 const latest=[...initial.seoCrawls].filter(x=>x.project_id===projectId)
  .sort((a,b)=>String(b.checked_at||b.created_at).localeCompare(String(a.checked_at||a.created_at)))[0];
 const important=latest?initial.seoFindings.filter(f=>f.project_id===projectId&&f.crawl_id===latest.id&&f.severity==="high"&&f.status==="open"):[];
 const total=approvals.length+unassigned.length+failures.length+important.length;
 return <div className="decision-inbox">
  <section className="panel decision-inbox-intro"><div><p className="eyebrow">PHÒNG DIGITAL MARKETING · VIỆC CHỜ TÔI</p><h2>Quyết định và cảnh báo cần xử lý</h2>
   <p>Chỉ hiển thị việc thật từ đúng dự án, không dựng thông báo mẫu. Mở mục liên quan để xem dữ liệu và duyệt.</p></div>
   <strong>{total}<small>mục cần xem</small></strong></section>
  <div className="decision-inbox-metrics">{[
   {n:approvals.length,t:"Chờ duyệt nội dung",icon:FileCheck2},
   {n:important.length,t:"Vấn đề SEO ưu tiên cao",icon:AlertCircle},
   {n:unassigned.length,t:"Việc SEO chưa có Agent",icon:UserRoundCheck},
   {n:failures.length,t:"Kết nối cần sửa",icon:PlugZap}
  ].map(x=><div className="decision-inbox-metric" key={x.t}><x.icon size={19}/><b>{x.n}</b><span>{x.t}</span></div>)}</div>
  {total===0?<section className="panel decision-inbox-empty"><CheckCircle2 size={27}/><h3>Không có yêu cầu cần quyết định trong dữ liệu hiện tại</h3>
   <p>Điều này không có nghĩa SEO hay Marketing đã hoàn chỉnh. Bạn có thể bắt đầu bằng Audit, thêm tài liệu và kết nối nguồn dữ liệu.</p>
   <button className="ops-outline" onClick={()=>onNavigate("seo")}><Search size={14}/> Mở SEO Website</button></section>:
   <div className="decision-inbox-list">
    {approvals.map(item=><article className="panel decision-inbox-item" key={item.id}><div><b>Nội dung chờ duyệt: {item.title}</b><p>AI đã tạo bản nháp, cần kiểm tra nội dung và nguồn trước khi duyệt. Chưa xuất bản ra ngoài.</p></div><button className="primary" onClick={()=>onNavigate("content")}>Xem nội dung</button></article>)}
    {important.map(item=><article className="panel decision-inbox-item" key={item.id}><div><b>SEO ưu tiên: {item.code}</b><p>{item.message} · {item.affected_count||0} URL trong mẫu Audit. Cần xác minh ngữ cảnh.</p></div><button className="ops-outline" onClick={()=>onNavigate("seo")}>Xem bằng chứng</button></article>)}
    {unassigned.map(item=><article className="panel decision-inbox-item" key={item.id}><div><b>Việc chưa có Agent: {item.title}</b><p>Chưa được phân công nên không thể tự chạy AI. Không tự gán Agent từ dự án khác.</p></div><button className="ops-outline" onClick={()=>onNavigate("tasks")}>Phân công</button></article>)}
    {failures.map(item=><article className="panel decision-inbox-item" key={item.id}><div><b>Kết nối lỗi: {item.provider||"Nguồn dữ liệu"}</b><p>Chưa thể sử dụng nguồn này để báo cáo KPI hoặc xuất bản. Cần kiểm tra cấp quyền.</p></div><button className="ops-outline" onClick={()=>onNavigate("integrations")}>Kiểm tra API</button></article>)}
   </div>}
 </div>;
}
