import Link from "next/link";
import {AlertCircle,CheckCircle2,Database,RefreshCw,ShieldAlert,ShieldCheck} from "lucide-react";
import {createClient,hasDatabaseConfig} from "@/lib/supabase/server";
import {isStudioOwner} from "@/lib/access";
import {workspaceOrderColumn} from "@/lib/workspace-order.mjs";
export const dynamic="force-dynamic";

type Check={title:string;ok:boolean;description:string};
const tables=["agents","tasks","knowledge_items","integrations","task_runs",
 "automation_schedules","content_assets","dom_messages","workflow_definitions",
 "workflow_runs","workflow_step_runs","seo_crawl_runs","seo_site_urls","seo_findings"] as const;

async function checkDatabase():Promise<{checks:Check[];ready:boolean}>{
 const checks:Check[]=[];
 if(!hasDatabaseConfig()){
  checks.push({title:"Cấu hình môi trường",ok:false,description:"Thiếu SUPABASE_URL hoặc Publishable Key trên bản triển khai này."});
  return {checks,ready:false};
 }
 checks.push({title:"Cấu hình môi trường",ok:true,description:"Vercel đã có URL và khóa công khai để kết nối Supabase."});
 try{
  const db=await createClient();
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError||!user){
   checks.push({title:"Phiên đăng nhập",ok:false,description:"Không có phiên Supabase hợp lệ trên trình duyệt này. Hãy đăng nhập lại; database có thể vẫn đang hoạt động."});
   return {checks,ready:false};
  }
  checks.push({title:"Phiên đăng nhập",ok:true,description:"Supabase Auth đã xác minh người dùng trên máy chủ."});
  if(!isStudioOwner(user.id)){
   checks.push({title:"Quyền truy cập",ok:false,description:"Tài khoản đang đăng nhập không trùng tài khoản quản trị của Studio."});
   return {checks,ready:false};
  }
  checks.push({title:"Quyền truy cập",ok:true,description:"Tài khoản có quyền quản trị Ngọc Agent Studio."});
  const {data:projects,error:projectError}=await db.from("projects")
   .select("id").eq("owner_id",user.id).limit(1);
  if(projectError){
   checks.push({title:"Bảng dự án",ok:false,description:"API không đọc được bảng projects (mã: "+(projectError.code||"không rõ")+")."});
   return {checks,ready:false};
  }
  checks.push({title:"Bảng dự án",ok:true,description:projects?.length?"Đã đọc được ít nhất một dự án thuộc tài khoản.":"Kết nối thành công, nhưng tài khoản chưa có dự án."});
  if(!projects?.length)return {checks,ready:true};
  const projectId=projects[0].id;
  const results=await Promise.all(tables.map(async table=>{
   const {error}=await db.from(table).select("id").eq("owner_id",user.id)
    .eq("project_id",projectId).order(workspaceOrderColumn(table),{ascending:false})
    .order("id",{ascending:false}).limit(1);
   return {table,error};
  }));
  const errors=results.filter(item=>Boolean(item.error));
  if(errors.length){
   const codes=errors.slice(0,6).map(item=>item.table+": "+(item.error?.code||"không rõ")).join("; ");
   checks.push({title:"Các bảng dữ liệu dự án",ok:false,
    description:"Có "+errors.length+" bảng đọc lỗi. "+codes+". Cần kiểm tra migration, quyền đọc hoặc phiên truy cập."});
  }else{
   checks.push({title:"Các bảng dữ liệu dự án",ok:true,description:"Đã kiểm tra quyền đọc "+tables.length+" bảng thuộc đúng dự án."});
  }
  return {checks,ready:errors.length===0};
 }catch{
  checks.push({title:"Kết nối ứng dụng",ok:false,description:"Không thể hoàn thành yêu cầu từ máy chủ đến Supabase. Kiểm tra mạng và cấu hình."});
  return {checks,ready:false};
 }
}

export default async function DatabaseDiagnostics(){
 const {checks,ready}=await checkDatabase();
 return <main className="screen">
  <section className="setup-card" style={{maxWidth:750}}>
   <div className="setup-top"><div className="brand-logo"><Database size={24}/></div>
    <span>Ngọc Agent Studio<small>CHẨN ĐOÁN KẾT NỐI DATABASE</small></span></div>
   <h1 style={{fontSize:26}}>{ready?"Kết nối ứng dụng đã xác minh":"Cần kiểm tra kết nối hoặc phiên đăng nhập"}</h1>
   <p>Trang này kiểm tra trực tiếp từ phiên trình duyệt tới Supabase qua máy chủ Vercel. Không hiển thị khóa bí mật hay dữ liệu dự án khác.</p>
   <div className="steps">
    {checks.map(item=><div key={item.title}>
     {item.ok?<CheckCircle2 size={20} color="#208060"/>:<AlertCircle size={20} color="#b46331"/>}
     <span><b>{item.title}: {item.ok?"Đạt":"Cần xử lý"}</b><small>{item.description}</small></span>
    </div>)}
   </div>
   <div className="note">
    {ready?<><ShieldCheck size={16}/> Nếu một chức năng riêng vẫn báo lỗi, đó có thể là lỗi của chức năng hoặc kết nối API ngoài Supabase.</>:
     <><ShieldAlert size={16}/> Nếu lỗi phiên đăng nhập: đóng các tab Studio cũ, đăng nhập lại tại đúng tên miền Production. Không cần tạo database hoặc đổi khóa API.</>}
   </div>
   <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:15}}>
    <form method="get" action="/ket-noi"><button className="primary" type="submit"><RefreshCw size={15}/> Kiểm tra lại</button></form>
    <Link className="ops-outline" href="/">Về ứng dụng</Link>
   </div>
  </section>
 </main>;
}
