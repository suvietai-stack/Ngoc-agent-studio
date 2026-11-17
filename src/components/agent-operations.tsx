"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {Bot,CalendarClock,CheckCircle2,Clock3,LockKeyhole,PauseCircle,PlayCircle,Save,Settings2,ShieldCheck} from "lucide-react";
import type {Row,WorkspaceData} from "@/lib/types";
import {toggleAgentAction,updateAgentOperationAction,type Result} from "@/app/actions";

type Mode="manual"|"supervised"|"scheduled";
const labels:Record<Mode,string>={
 manual:"Thủ công",supervised:"Có giám sát",scheduled:"Theo lịch"
};
const descriptions:Record<Mode,string>={
 manual:"Chạy tác vụ tạo tay hoặc chiến dịch sau khi người quản trị bấm Chạy AI; không chạy các bước workflow hoặc tác vụ từ lịch.",
 supervised:"Nhận tác vụ thủ công và chuỗi workflow; yêu cầu duyệt nội dung trước bước sau. Không nhận nhiệm vụ từ lịch.",
 scheduled:"Cho phép lịch Supabase tạo tác vụ nháp và thực hiện các workflow; mỗi lần gọi AI vẫn do người quản trị bấm Chạy AI."
};
function asMode(mode:Row["operation_mode"]):Mode{
 return mode==="manual"||mode==="scheduled"?mode:"supervised";
}
export function AgentOperations({initial,filter}:{initial:WorkspaceData;filter:string}){
 const router=useRouter();
 const [pending,start]=useTransition();
 const [notice,setNotice]=useState("");
 const [busyId,setBusyId]=useState("");
 const agents=initial.agents.filter(a=>filter==="all"||a.project_id===filter);
 const now=Date.now(),cutoff=now-24*60*60*1000;
 const recent=initial.runs.filter(r=>r.agent_id&&r.created_at&&Date.parse(r.created_at)>=cutoff);
 const projectNames=new Map(initial.projects.map(p=>[p.id,p.name]));
 const enabled=agents.filter(a=>a.enabled).length;
 const scheduled=agents.filter(a=>a.operation_mode==="scheduled"&&a.enabled).length;

 function act(id:string,fn:()=>Promise<Result>){
  setBusyId(id);
  start(async()=>{
   try{
    const r=await fn();
    setNotice(r.message);
    if(r.ok)router.refresh();
   }catch{setNotice("Lưu cấu hình thất bại. Vui lòng kiểm tra kết nối.");}
   finally{setBusyId("");}
  });
 }
 return <div className="agent-ops">
  <section className="ops-hero"><div className="ops-icon"><Settings2 size={26}/></div><div>
    <p className="eyebrow">AGENT CONTROL CENTER</p>
    <h2>Thiết lập chế độ vận hành từng Agent</h2>
    <p>Kiểm soát cách nhận việc, giới hạn lượt chạy AI, mô hình, hướng dẫn và trạng thái bật/tắt. Chính sách được kiểm tra tại máy chủ.</p>
  </div></section>
  <div className="agent-ops-summary">
   <div className="stat"><span>Agent đang bật</span><b>{enabled}/{agents.length}</b><small>Trạng thái thực tế</small><Bot size={21}/></div>
   <div className="stat"><span>Chế độ theo lịch</span><b>{scheduled}</b><small>Chỉ thêm tác vụ nháp</small><CalendarClock size={21}/></div>
   <div className="stat"><span>Lần chạy 24h</span><b>{recent.filter(r=>agents.some(a=>a.id===r.agent_id)).length}</b><small>Đếm từ nhật ký chạy</small><Clock3 size={21}/></div>
  </div>
  <div className="ops-warning"><b><ShieldCheck size={15}/> Quy tắc an toàn cố định</b>
   <p>Không chế độ nào tự đăng Facebook, WordPress, gửi email hoặc xóa dữ liệu. Lịch chỉ tạo hàng đợi nháp; AI chỉ chạy khi có API key và người quản trị bấm thực hiện. Nội dung phải duyệt riêng.</p>
  </div>
  {notice&&<div className="alert" role="status">{notice}<button type="button" onClick={()=>setNotice("")}>×</button></div>}
  <div className="agent-ops-list">
  {agents.length===0?<section className="panel"><p className="muted">Chưa có Agent trong bộ lọc này. Tạo Agent tại tab Đội ngũ AI.</p></section>:agents.map(agent=>{
   const mode=asMode(agent.operation_mode);
   const used=recent.filter(r=>r.agent_id===agent.id).length;
   const limit=agent.daily_run_limit||10;
   const tokenEvents=initial.usage.filter(e=>e.agent_id===agent.id);
   const tokens=tokenEvents.reduce((n,e)=>n+(e.input_tokens||0)+(e.output_tokens||0),0);
   const scheduleCount=initial.automations.filter(s=>s.agent_id===agent.id&&s.enabled).length;
   return <section key={agent.id} className="panel agent-ops-card">
    <header className="agent-ops-cardhead">
     <div className="agent-ops-avatar"><Bot size={22}/></div>
     <div className="agent-ops-title"><h3>{agent.name}</h3>
      <small>{projectNames.get(agent.project_id||"")||"Agent dùng chung"} · {agent.purpose}</small>
     </div>
     <span className={"chip "+(agent.enabled?"on":"")}>{agent.enabled?"Đang bật":"Đang tắt"}</span>
     <button className="ops-outline" disabled={pending} onClick={()=>act(agent.id,()=>toggleAgentAction(agent.id,!agent.enabled))} type="button">
      {agent.enabled?<><PauseCircle size={14}/> Tạm dừng</>:<><PlayCircle size={14}/> Bật Agent</>}
     </button>
    </header>
    <div className="agent-ops-metrics">
     <span><Settings2 size={14}/> {labels[mode]}</span>
     <span><Clock3 size={14}/> {used}/{limit} lượt · 24 giờ</span>
     <span><CalendarClock size={14}/> {scheduleCount} lịch đang bật</span>
     <span><CheckCircle2 size={14}/> {tokens.toLocaleString("vi-VN")} tokens ghi nhận</span>
    </div>
    <details className="agent-ops-details">
     <summary>Thiết lập chế độ và hướng dẫn <Settings2 size={15}/></summary>
     <form key={agent.id+"-"+agent.updated_at} className="agent-ops-form" onSubmit={e=>{
      e.preventDefault();
      const form=new FormData(e.currentTarget);
      act(agent.id,()=>updateAgentOperationAction(form));
     }}>
      <input type="hidden" name="agent_id" value={agent.id}/>
      <div className="agent-ops-fields">
       <label>Chế độ vận hành
        <select name="operation_mode" defaultValue={mode} required>
         <option value="manual">Thủ công</option>
         <option value="supervised">Có giám sát (workflow)</option>
         <option value="scheduled">Theo lịch (tạo hàng đợi)</option>
        </select>
       </label>
       <label>Giới hạn lượt chạy / 24 giờ
        <input type="number" name="daily_run_limit" min={1} max={100} step={1} defaultValue={limit} required/>
       </label>
       <label>AI model
        <input name="model" pattern="gpt-[A-Za-z0-9.-]{3,40}" defaultValue={agent.model||"gpt-4.1-mini"} required maxLength={50}/>
       </label>
      </div>
      <div className="agent-ops-modeguide">
       {(["manual","supervised","scheduled"] as Mode[]).map(m=><p key={m}><b>{labels[m]}:</b> {descriptions[m]}</p>)}
      </div>
      <label>System prompt / Hướng dẫn Agent
       <textarea rows={7} name="instructions" minLength={10} maxLength={20000} required defaultValue={agent.instructions||""}/>
      </label>
      <div className="agent-ops-formfooter">
       <small><LockKeyhole size={13}/> Quyền duyệt không thể tắt. Giới hạn áp dụng cả khi nhiều yêu cầu đến cùng lúc.</small>
       <button type="submit" className="primary" disabled={pending}>
        <Save size={15}/>{pending&&busyId===agent.id?"Đang lưu...":"Lưu cấu hình"}
       </button>
      </div>
     </form>
    </details>
   </section>;
  })}
  </div>
 </div>;
}
