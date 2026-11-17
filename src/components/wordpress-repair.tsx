"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {CheckCircle2,ExternalLink,RefreshCw,RotateCcw,ShieldCheck,AlertTriangle,FilePenLine} from "lucide-react";
import {prepareWordPressChangeAction,applyWordPressChangeAction,rollbackWordPressChangeAction} from "@/app/wordpress-actions";
import type {WordpressChange} from "@/lib/types";
type Field="post_title"|"h1"|"seo_description"|"image_alt";
const names:Record<Field,string>={
 post_title:"Tiêu đề bài/trang WordPress",
 h1:"H1 đầu nội dung (Gutenberg / Classic)",
 seo_description:"Meta Description (plugin phải hỗ trợ REST)",
 image_alt:"ALT ảnh trong WordPress Media"
};
const statuses:Record<string,string>={
 pending_approval:"Chờ bạn duyệt",applying:"Đang cập nhật",applied:"Đã áp dụng",
 reverting:"Đang hoàn tác",reverted:"Đã hoàn tác",conflict:"Xung đột — cần kiểm tra",error:"Không xác minh được — kiểm tra thủ công"
};
export function WordPressRepairBoard({projectId,changes}:{projectId:string;changes:WordpressChange[]}){
 const router=useRouter(),[pending,start]=useTransition();
 const [field,setField]=useState<Field>("post_title"),[target,setTarget]=useState(""),[mediaId,setMediaId]=useState("");
 const [notice,setNotice]=useState(""),[confirmIds,setConfirmIds]=useState<Record<string,boolean>>({});
 function run(work:()=>Promise<{ok:boolean;message:string}>,reset=false){
  start(async()=>{
   try{
    const response=await work();
    setNotice(response.message);
    if(response.ok&&reset){setConfirmIds({});setTarget("");setMediaId("");}
    router.refresh();
   }catch{setNotice("Không thể hoàn tất. Xem nhật ký và kiểm tra lại WordPress.");}
  });
 }
 function create(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();
  const f=new FormData(e.currentTarget);
  f.set("project_id",projectId);
  run(()=>prepareWordPressChangeAction(f),true);
 }
 const sorted=[...changes].sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||""))).slice(0,30);
 return <section className="panel seo2-panel" id="wordpress-repair">
  <div className="seo2-panel-title"><div>
   <h3><FilePenLine size={19} style={{verticalAlign:"middle"}}/> Agent sửa WordPress sau khi duyệt</h3>
   <p>AI đọc bài/trang thật → đề xuất 1 thay đổi → bạn duyệt → ghi WordPress → đọc lại xác minh → lưu bản gốc để hoàn tác.</p>
  </div><ShieldCheck size={22}/></div>
  <p className="seo2-small">Không tự đăng bài, không tự ghi hàng loạt. Các trang Elementor/WooCommerce không có REST chỉnh sửa, hoặc plugin SEO không mở trường meta qua API sẽ được báo là chưa hỗ trợ. Chỉ áp dụng với tài khoản WordPress có quyền sửa.</p>
  {notice&&<div role="status" className="alert">{notice}</div>}
  <form className="form-stack" onSubmit={create}>
   <label>Loại thay đổi
    <select value={field} onChange={e=>setField(e.target.value as Field)} name="field">
     {Object.entries(names).map(([id,name])=><option value={id} key={id}>{name}</option>)}
    </select>
   </label>
   {field==="image_alt"?<label>Media ID trong WordPress → Thư viện → chọn ảnh (không dùng ID của trang)
    <input name="media_id" required type="number" min={1} value={mediaId} onChange={e=>setMediaId(e.target.value)} placeholder="Ví dụ: 1234"/>
   </label>:
   <label>URL bài viết/trang thật trên website (sao chép URL từ kết quả SEO Audit)
    <input name="target_url" type="url" required maxLength={1200} value={target} onChange={e=>setTarget(e.target.value)} placeholder="https://xuonggomsuviet.vn/ten-bai-viet/"/>
   </label>}
   {field==="image_alt"&&<input type="hidden" name="target_url" value=""/>}
   <div><button type="submit" className="primary" disabled={pending}><RefreshCw size={15}/>{pending?"Đang xử lý...":"AI chuẩn bị bản sửa để duyệt"}</button></div>
  </form>
  <div className="seo2-panel-title"><div><h3>Bản sửa & nhật ký ({changes.length})</h3><p>Xem chính xác giá trị cũ/mới, trạng thái và thao tác cho từng thay đổi.</p></div></div>
  {sorted.length===0?<div className="seo2-onboarding"><FilePenLine size={23}/><b>Chưa có bản sửa WordPress</b><p>Chọn loại thay đổi và URL rồi bấm AI chuẩn bị bản sửa. Không thay đổi website cho tới khi duyệt.</p></div>:
  <div className="ops-list">{sorted.map(change=>{
   const key=change.id;
   const name=names[change.field as Field]||change.field;
   const before=change.field==="h1"?"(H1 chưa tồn tại ở phần nội dung; đã lưu bản content gốc để hoàn tác)":change.old_value;
   return <article key={key} className="panel ops-asset">
    <div className="ops-assethead">
     <div><b>{name}</b><small style={{display:"block",overflowWrap:"anywhere"}}>{change.target_url}</small>
      <small>{change.created_at?new Date(change.created_at).toLocaleString("vi-VN"):""}</small></div>
     <span className={"chip "+(change.status==="applied"?"on":"")}>{statuses[change.status]||change.status}</span>
    </div>
    <div className="form-stack">
     <div><b>Trước khi sửa</b><p className="muted" style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{before?.slice(0,600)||"(trống)"}</p></div>
     <div><b>AI đề xuất</b><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{change.proposed_value}</p></div>
     {change.meta_key&&<small>Trường meta REST: {change.meta_key}</small>}
     {change.error_message&&<p className="seo2-caution"><AlertTriangle size={15}/> {change.error_message}</p>}
    </div>
    {change.status==="pending_approval"&&<div className="form-stack">
     <label style={{display:"flex",alignItems:"flex-start",gap:8}}>
      <input type="checkbox" checked={Boolean(confirmIds[key])} onChange={e=>setConfirmIds({...confirmIds,[key]:e.target.checked})}/>
      <span>Tôi đã kiểm tra URL, nội dung trước/sau và đồng ý sửa trực tiếp WordPress.</span>
     </label>
     <div><button className="primary" type="button" disabled={pending||!confirmIds[key]}
      onClick={()=>run(()=>applyWordPressChangeAction(key,true),true)}><CheckCircle2 size={15}/> Duyệt & áp dụng lên WordPress</button></div>
    </div>}
    {change.status==="applied"&&<div className="ops-inline">
     <button type="button" className="ops-outline" disabled={pending}
      onClick={()=>{if(window.confirm("Hoàn tác bản sửa này trên WordPress? Chỉ thực hiện nếu chưa có chỉnh sửa mới."))run(()=>rollbackWordPressChangeAction(key,true));}}>
      <RotateCcw size={14}/> Hoàn tác thay đổi này</button>
    </div>}
   </article>;
  })}</div>}
 </section>;
}
