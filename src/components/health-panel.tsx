import {Activity,AlertTriangle,CheckCircle2,Clock3,KeyRound,ShieldCheck} from "lucide-react";
import type {WorkspaceData} from "@/lib/types";
export function HealthPanel({initial,aiReady,runnerConfigured,encryptionConfigured}:{initial:WorkspaceData;aiReady:boolean;runnerConfigured:boolean;encryptionConfigured:boolean}){
 const pending=initial.tasks.filter(t=>t.status==="pending_approval").length;
 const failed=initial.tasks.filter(t=>t.status==="failed").length;
 const activeAutomations=initial.automations.filter(s=>s.enabled).length;
 const optedIn=initial.projects.filter(p=>p.auto_run_enabled).length;
 const approved=initial.content.filter(c=>c.status==="approved").length;
 const latest=initial.runs[0];
 return <section className="panel"><div className="panel-head"><h3><Activity size={17}/> Sức khỏe vận hành</h3><span className="chip">Dữ liệu nội bộ thực tế</span></div>
  <div className="cards integrations">
   <article className="integration"><Clock3 size={21}/><h3>Hàng đợi & phê duyệt</h3>
    <p>{pending} nhiệm vụ chờ duyệt · {approved} nội dung đã duyệt · {failed} nhiệm vụ lỗi</p></article>
   <article className="integration"><CheckCircle2 size={21}/><h3>Lịch tự động</h3>
    <p>{activeAutomations} lịch đã bật · {optedIn} dự án bật AI tự tạo nháp</p></article>
   <article className="integration"><KeyRound size={21}/><h3>Kết nối API</h3>
    <p>{initial.integrations.filter(i=>i.connection_status==="connected").length} kết nối đã xác minh · Kho mã hóa {encryptionConfigured?"đã cấu hình":"chưa cấu hình"}</p></article>
  </div>
  <div className="ops-inline"><span className={"chip "+(aiReady?"on":"")}><ShieldCheck size={13}/> OpenAI {aiReady?"sẵn cấu hình":"chưa kết nối"}</span>
   <span className={"chip "+(runnerConfigured?"on":"")}><Activity size={13}/> Worker {runnerConfigured?"sẵn cấu hình":"chưa kích hoạt"}</span>
   {failed>0&&<span className="chip"><AlertTriangle size={13}/> Có công việc lỗi cần xử lý</span>}
  </div>
  <small>Lần chạy Agent gần nhất: {latest?.created_at?new Date(latest.created_at).toLocaleString("vi-VN"):"Chưa có lần chạy"} · {latest?.state||"Chưa có kết quả"}. Thống kê giới hạn trong 200 bản ghi mới nhất trên mỗi bảng.</small>
 </section>;
}
