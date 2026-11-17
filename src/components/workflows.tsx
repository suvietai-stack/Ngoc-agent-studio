"use client";

import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {CheckCircle2,GitBranch,LockKeyhole,Play,Plus} from "lucide-react";
import type {Row,WorkspaceData} from "@/lib/types";
import {createWorkflowAction,runTaskAction} from "@/app/operations";
import {createWorkflowPlanAction,recordWorkflowStepAction} from "@/app/workflow-v2-actions";
import type {Result} from "@/app/actions";

type Props={
 initial:WorkspaceData;
 filter:string;
 selectedProject:string;
 onProjectChange:(id:string)=>void;
 aiReady:boolean;
};

function statusLabel(task:Row,approved:Set<string>){
 if(approved.has(task.id))return "Đã duyệt nội dung";
 if(task.status==="pending_approval")return "Chờ duyệt nội dung";
 if(task.status==="running")return "Đang chạy";
 if(task.status==="failed")return "Lỗi · có thể thử lại";
 if(task.status==="approved")return "Đã duyệt nhiệm vụ";
 return "Chưa chạy";
}

export function WorkflowBoard({initial,filter,selectedProject,onProjectChange,aiReady}:Props){
 const router=useRouter();
 const [pending,start]=useTransition();
 const [topic,setTopic]=useState("");
 const [notice,setNotice]=useState("");
 const [notes,setNotes]=useState<Record<string,string>>({});
 const approved=new Set(initial.content.filter(a=>a.status==="approved"&&a.task_id).map(a=>a.task_id!));
 const grouped=new Map<string,Row[]>();
 for(const task of initial.tasks){
  if(task.source!=="workflow"||!task.workflow_id)continue;
  if(task.project_id!==selectedProject)continue;
  grouped.set(task.workflow_id,[...(grouped.get(task.workflow_id)||[]),task]);
 }
 const workflows=[...grouped.entries()].map(([id,steps])=>({
  id,steps:steps.sort((a,b)=>(a.workflow_step||0)-(b.workflow_step||0))
 })).sort((a,b)=>String(b.steps[0]?.created_at||"").localeCompare(String(a.steps[0]?.created_at||"")));
 const definitions=initial.workflowDefinitions.filter(w=>w.project_id===selectedProject);
 const v2Runs=initial.workflowRuns.filter(w=>w.project_id===selectedProject)
  .sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||""))).slice(0,12);
 const allSteps=initial.workflowSteps.filter(s=>s.project_id===selectedProject);
 const projectNames=new Map(initial.projects.map(p=>[p.id,p.name]));
 const activeProject=initial.projects.some(p=>p.id===selectedProject&&p.status==="active");

 function execute(fn:()=>Promise<Result>,clearTopic=false){
  start(async()=>{
   try{
    const result=await fn();
    setNotice(result.message);
    if(result.ok&&clearTopic)setTopic("");
    router.refresh();
   }catch{setNotice("Không thể thực hiện. Kiểm tra kết nối và thử lại.");}
  });
 }
 return <section className="panel workflow-board">
  <div className="workflow-heading"><div className="workflow-icon"><GitBranch size={19}/></div>
   <div><h3>Chuỗi cộng tác 3 AI Agent</h3><p>SEO nghiên cứu → Content viết bài → Social biên tập. Mỗi bước phải được duyệt nội dung trước khi bước sau được chạy. Không tự xuất bản.</p></div>
  </div>
  {notice&&<div className="alert" role="status">{notice}<button type="button" onClick={()=>setNotice("")}>×</button></div>}
  
  <div className="workflow-v2-box">
   <div className="workflow-v2-heading"><div><h3>Quy trình chuẩn SEO-First 2.0</h3>
    <p>Mẫu có phiên bản, nhiều bước và cổng duyệt. Tạo lộ trình không tự gọi AI hoặc đăng lên website/Facebook.</p></div>
    <span className="chip">{definitions.length} mẫu trong dự án</span></div>
   {definitions.length===0?<div className="workflow-v2-empty"><b>Chưa cài bộ mẫu quy trình 2.0</b>
    <p>Dùng nút “Cài bộ mẫu vào dự án” ở khu vực Tự động hóa để thêm 13 quy trình mặc định tắt.</p></div>:
    <div className="workflow-v2-library">{definitions.map(def=><article key={def.id} className="workflow-v2-definition">
     <div><b>{def.title}</b><small>{def.steps?.length||0} bước · {def.template_version||"Chưa rõ phiên bản"} · Không chạy nền</small></div>
     <button type="button" className="ops-outline" disabled={pending||!activeProject} onClick={()=>execute(()=>createWorkflowPlanAction(selectedProject,def.template_key||""))}><Plus size={14}/> Lập kế hoạch</button>
    </article>)}</div>}
   {v2Runs.length>0&&<div className="workflow-v2-runs"><h3>Lộ trình đã tạo</h3>{v2Runs.map(run=>{
    const runSteps=allSteps.filter(st=>st.run_id===run.id).sort((a,b)=>(a.step_order||0)-(b.step_order||0));
    const done=new Set(runSteps.filter(st=>st.status==="done"||st.status==="approved").map(st=>st.step_key));
    const completed=done.size;
    return <details className="workflow-v2-run" key={run.id}>
     <summary><span><b>{run.title}</b><small>{completed}/{runSteps.length} bước được xác nhận thủ công · {run.template_version}</small></span>
       <span className="chip">{run.status==="planned"?"Kế hoạch":run.status==="active"?"Đang theo dõi":run.status||"—"}</span></summary>
     <div className="workflow-v2-steps">{runSteps.map(st=>{
      const unlocked=(st.requires||[]).every(key=>done.has(key));
      const finished=done.has(st.step_key);
      const external=st.gate==="external";
      const canConfirm=unlocked&&!finished&&!external&&["pending","ready","needs_approval"].includes(st.status||"");
      return <div className="workflow-v2-step" key={st.id}>
       <div className="workflow-v2-step-main"><span className={"workflow-v2-step-index"+(finished?" complete":"")}>{st.step_order}</span>
        <div><b>{st.label}</b><small>{external?"Chặn hành động bên ngoài: chưa có adapter/ủy quyền":finished?"Đã ghi nhận bằng chứng thủ công":unlocked?"Cần người kiểm tra và xác nhận":"Đợi bước trước"}</small></div></div>
       {canConfirm&&<div className="workflow-v2-evidence">
        <textarea rows={2} value={notes[st.id]||""} placeholder="Ghi bằng chứng/kết quả thực tế (≥ 15 ký tự). Không đánh dấu nếu chưa làm." onChange={e=>setNotes(old=>({...old,[st.id]:e.target.value}))}/>
        <button type="button" className="ops-outline" disabled={pending||(notes[st.id]||"").trim().length<15} onClick={()=>execute(()=>recordWorkflowStepAction(run.id,st.id,notes[st.id]||""))}>Ghi nhận đã kiểm tra</button>
       </div>}
      </div>;
     })}</div>
    </details>;
   })}</div>}
  </div>
  <div className="workflow-legacy-title"><h3>Chuỗi 3 Agent hiện có</h3><p>Giữ lại tương thích công việc cũ: SEO → Content → Facebook. Các bản nháp vẫn phải duyệt.</p></div>
  <form className="workflow-form" onSubmit={e=>{e.preventDefault();execute(()=>createWorkflowAction(selectedProject,topic),true);}}>
   <label>Dự án
    <select value={selectedProject} required onChange={e=>onProjectChange(e.target.value)}>
     {initial.projects.length===0?<option value="">Chưa có dự án</option>:initial.projects.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}
    </select>
   </label>
   <label>Chủ đề chiến dịch
    <input value={topic} onChange={e=>setTopic(e.target.value)} minLength={8} maxLength={140}
     placeholder="Ví dụ: Bộ ấm chén quà tặng doanh nghiệp" required/>
   </label>
   <button className="primary" type="submit" disabled={pending||!selectedProject||!activeProject||topic.trim().length<8}>
    <Plus size={15}/>{pending?"Đang tạo...":"Tạo workflow"}
   </button>
  </form>
  <small>Cần bật đúng 3 Agent SEO, Content và Social thuộc riêng dự án này. Tạo workflow chỉ xếp việc; không gọi API AI.</small>
  <div className="workflow-list">
   {workflows.length===0?<p className="muted">Chưa có workflow nào. Nhập chủ đề và tạo chuỗi công việc đầu tiên.</p>:workflows.map(w=>{
    const first=w.steps[0];
    const completed=w.steps.filter(t=>approved.has(t.id)).length;
    return <article className="workflow-card" key={w.id}>
     <header><div><b>{first?.title?.replace(/^SEO · /,"")||"Chiến dịch AI"}</b>
      <small>{projectNames.get(first?.project_id||"")||"Dự án"} · {completed}/3 bước được duyệt</small></div>
      <span className="chip">{completed===3?"Đã duyệt 3 bước":"Đang xử lý"}</span></header>
     <div className="workflow-steps">{w.steps.map(task=>{
      const unlocked=!task.depends_on_task_id||approved.has(task.depends_on_task_id);
      const runnable=["draft","failed"].includes(task.status||"")&&unlocked;
      const finished=approved.has(task.id);
      return <div className="workflow-step" key={task.id}>
       <div className={"workflow-step-num"+(finished?" done":"")}>{finished?<CheckCircle2 size={15}/>:task.workflow_step}</div>
       <div className="workflow-step-main"><b>{task.title?.split(" · ")[0]||"Agent"}</b>
        <small>{statusLabel(task,approved)}</small></div>
       {!unlocked?<span className="workflow-locked"><LockKeyhole size={13}/> Đợi duyệt bước trước</span>:
        runnable?<button type="button" className="ops-outline" disabled={pending||!aiReady||!activeProject} title={!activeProject?"Dự án đang tạm dừng hoặc lưu trữ":!aiReady?"Chưa xác minh OpenAI cho dự án":"Chạy AI cho bước này"} onClick={()=>execute(()=>runTaskAction(task.id))}><Play size={13}/> Chạy AI</button>:
        <span className={finished?"chip on":"chip"}>{finished?"Đã duyệt":task.status==="running"?"Đang chạy":"Xem trong Nội dung"}</span>}
      </div>;
     })}</div>
    </article>;
   })}
  </div>
 </section>;
}
