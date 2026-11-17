import Link from "next/link";
import {BrainCircuit,Database,ShieldCheck,ExternalLink,AlertCircle} from "lucide-react";

export function Setup({migrationError}:{migrationError?:string}){
 return <main className="screen"><section className="setup-card">
  <div className="setup-top"><div className="brand-logo"><BrainCircuit size={28}/></div>
   <span>Ngọc Agent Studio<small>Personal AI Workspace</small></span></div>
  <p className="eyebrow">TRẠNG THÁI KẾT NỐI</p>
  <h1>{migrationError?"Ứng dụng chưa đọc được dữ liệu dự án":"Bản triển khai này thiếu cấu hình Supabase"}</h1>
  <p>{migrationError?
   "Database có thể vẫn đang hoạt động; lỗi có thể thuộc phiên đăng nhập, quyền truy cập hoặc một bảng chưa được ứng dụng đọc đúng.":
   "Cần kiểm tra biến môi trường NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY trên Vercel. Không tạo database mới để khắc phục lỗi cấu hình."}</p>
  {migrationError&&<div className="alert" role="alert"><AlertCircle size={17}/>{migrationError}</div>}
  <div className="steps">
   <div><Database size={20}/><span><b>1. Kiểm tra kết nối trực tiếp</b><small>Xác minh URL, phiên đăng nhập, quyền và các bảng dự án qua trang chẩn đoán.</small></span></div>
   <div><ShieldCheck size={20}/><span><b>2. Giữ nguyên dữ liệu đang có</b><small>Không xóa, không tạo lại Supabase project, không thay khóa khi chưa xác định nguyên nhân.</small></span></div>
  </div>
  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
   <Link className="primary" href="/ket-noi">Kiểm tra kết nối <ExternalLink size={15}/></Link>
   <a className="ops-outline" href="https://supabase.com/dashboard/project/zvbwknltooymuenpvptr" target="_blank" rel="noreferrer">Mở Supabase Dashboard <ExternalLink size={14}/></a>
  </div>
 </section></main>;
}
