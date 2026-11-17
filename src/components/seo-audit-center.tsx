"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {Activity,AlertCircle,AlertTriangle,ArrowRight,BookOpen,CheckCircle2,ClipboardList,ExternalLink,FileSearch,Globe2,Link2,MapPin,RefreshCw,ShieldCheck,TrendingUp} from "lucide-react";
import type {WorkspaceData} from "@/lib/types";
import {WordPressRepairBoard} from "@/components/wordpress-repair";
import {seoAuditAction,updateProjectWebsiteAction,createSeoAuditTasksAction,reindexSeoAuditAction} from "@/app/operations";
import {parseAuditV2,SEO_OFFICIAL_SOURCES} from "@/lib/seo-audit-v2.mjs";
import {parseSeoAuditReport} from "@/lib/seo-audit-report.mjs";
import {projectWorkspaceHref} from "@/lib/project-entry.mjs";

type Section="overview"|"issues"|"links"|"tasks";
const sectionNames:{id:Section;title:string}[]=[
 {id:"overview",title:"Tổng quan"},{id:"issues",title:"Vấn đề & URL"},
 {id:"links",title:"Liên kết & Entity"},{id:"tasks",title:"Công việc"}
];
const kindNames:Record<string,string>={product:"Sản phẩm",category:"Danh mục",article:"Bài viết",page:"Trang khác"};
const severities:Record<string,string>={high:"Ưu tiên xác minh",medium:"Cần xem xét",info:"Thông tin"};
const providers=[
 {code:"gsc",name:"Search Console"},{code:"ga4",name:"Google Analytics"},
 {code:"wordpress",name:"WordPress"},{code:"facebook",name:"Facebook Page"}
];
const issueIcons:{[key:string]:typeof AlertCircle}={high:AlertCircle,medium:AlertTriangle,info:Activity};
function showDate(input?:string){if(!input)return "—";const d=new Date(input);return Number.isNaN(+d)?"—":d.toLocaleString("vi-VN");}

export function SeoAuditCenter({initial,projectId}:{initial:WorkspaceData;projectId:string}){
 const router=useRouter();
 const [pending,start]=useTransition();
 const [notice,setNotice]=useState("");
 const [section,setSection]=useState<Section>("overview");
 const [selectedId,setSelectedId]=useState("");
 const [search,setSearch]=useState("");
 const project=initial.projects.find(p=>p.id===projectId);
 const [website,setWebsite]=useState(project?.website_url||"");
 const audits=initial.content.filter(x=>x.project_id===projectId&&x.channel==="seo-audit").sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
 const selected=audits.find(x=>x.id===selectedId)||audits[0];
 const report=selected?parseAuditV2(selected.body):null;
 const legacy=selected&&!report?parseSeoAuditReport(selected.body):null;
 const indexRun=selected?initial.seoCrawls.find(run=>run.source_asset_id===selected.id):null;
 const indexedUrlCount=initial.seoUrls.filter(row=>row.project_id===projectId).length;
 const indexedFindingCount=indexRun?initial.seoFindings.filter(row=>row.project_id===projectId&&row.crawl_id===indexRun.id).length:0;
 const older=audits.filter(x=>x.id!==selected?.id).map(x=>parseAuditV2(x.body)).find(x=>x&&report&&x.scope.root===report.scope.root);
 const taskRows=initial.tasks.filter(t=>t.project_id===projectId&&t.source==="seo-audit");
 const savedUrl=project?.website_url||"";
 const isOutdated=Boolean(report&&savedUrl&&new URL(report.scope.root).hostname!==new URL(savedUrl).hostname);
 const integration=(code:string)=>initial.integrations.find(x=>x.project_id===projectId&&x.provider===code);
 function call(action:()=>Promise<{ok:boolean;message:string}>,goto?:Section){
  start(async()=>{
   try{const result=await action();setNotice(result.message);if(result.ok){if(goto)setSection(goto);setSelectedId("");}router.refresh();}
   catch{setNotice("Không thực hiện được. Kiểm tra kết nối và thử lại.");}
  });
 }
 function openTab(tab:"integrations"|"knowledge"|"automations"|"tasks"){router.push(projectWorkspaceHref(projectId,tab));}
 function save(e:React.FormEvent<HTMLFormElement>){e.preventDefault();call(()=>updateProjectWebsiteAction(projectId,website));}
 const s=report?.summary;
 const severity=s?.severity;
 const groups=s?.issues||[];
 const filtered=groups.filter(g=>g.message.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"))||g.code.includes(search));
 return <div className="seo2">
  <header className="seo2-header">
   <div><p className="eyebrow">SEO-FIRST · TRUNG TÂM WEBSITE</p><h2>Kiểm toán & vận hành SEO</h2>
    <p>Kiểm tra website → phát hiện vấn đề → giao Agent xử lý → xác minh kết quả. Không dùng điểm SEO giả.</p></div>
   <div className="seo2-header-actions">
    <button type="button" className="ops-outline" onClick={()=>openTab("integrations")}>Kết nối dữ liệu <ArrowRight size={14}/></button>
    <button type="button" className="primary" disabled={pending||!savedUrl||project?.status!=="active"} onClick={()=>call(()=>seoAuditAction(projectId,"quick"))}><RefreshCw size={16}/>{pending?"Đang xử lý":"Audit nhanh"}</button>
   </div>
  </header>
  {notice&&<div role="status" className="alert seo2-notice">{notice}<button aria-label="Đóng" onClick={()=>setNotice("")}>×</button></div>}
  <section className="seo2-sources" aria-label="Nguồn dữ liệu">
   <div className="seo2-source"><Globe2 size={17}/><span><b>Website</b><small>{savedUrl?"Đã khai báo URL":"Chưa khai báo"}</small></span><i className={savedUrl?"seo2-dot is-on":"seo2-dot"}/></div>
   {providers.map(p=>{const item=integration(p.code);const connected=item?.connection_status==="connected";
    return <div className="seo2-source" key={p.code}><span><b>{p.name}</b><small>{connected?"Đã kết nối · chưa lấy KPI":item?.connection_status==="error"?"Kết nối lỗi":"Chưa có số liệu"}</small></span><i className={connected?"seo2-dot is-on":"seo2-dot"}/></div>;
   })}
  </section>
  <div className="seo2-metrics" aria-label="Số liệu SEO từ nguồn thực">
   {[
    {name:"URL đã quét",value:s?String(s.scanned):"—",info:s?"Giới hạn "+s.limit+" trang":"Chưa chạy Audit",icon:Globe2},
    {name:"Ưu tiên cao",value:severity?String(severity.high):"—",info:"Dấu hiệu cần xác minh",icon:AlertCircle},
    {name:"Cảnh báo",value:severity?String(severity.medium):"—",info:"Khuyến nghị cần xem",icon:AlertTriangle},
    {name:"Liên kết nội bộ",value:s?String(s.internal.uniqueTargets):"—",info:"URL đích phát hiện trong mẫu",icon:Link2}
   ].map(m=><article className="seo2-metric" key={m.name}><m.icon size={19}/><span>{m.name}</span><strong>{m.value}</strong><small>{m.info}</small></article>)}
  </div>
  {report&&<section className="seo2-index-state" aria-label="SEO Inventory đã lưu">
   <div><b>{indexRun?"Đã lưu chỉ mục SEO riêng dự án":"Chưa đồng bộ chỉ mục SEO"}</b>
    <small>{indexRun?indexedUrlCount+" URL trong inventory · "+indexedFindingCount+" nhóm phát hiện của lần quét đang xem":"Báo cáo Audit có thật, nhưng dữ liệu URL và finding chưa được chuẩn hóa vào bảng SEO."}</small></div>
   <button className="ops-outline" disabled={pending} onClick={()=>call(()=>reindexSeoAuditAction(projectId,selected?.id||""))}>
    {indexRun?"Đồng bộ lại":"Lập chỉ mục từ Audit"}
   </button>
  </section>}
  <div className="seo2-tabs" role="tablist" aria-label="Các chức năng SEO">
   {sectionNames.map(t=><button key={t.id} type="button" role="tab" aria-selected={section===t.id} onClick={()=>setSection(t.id)}>{t.title}</button>)}
  </div>
  {section==="overview"&&<>
   <section className="seo2-two">
    <div className="panel seo2-panel"><div className="seo2-panel-title"><div><h3>Chạy Audit website</h3><p>Kiểm tra HTML, robots, sitemap, title, meta, H1, canonical, ảnh, internal link.</p></div><FileSearch size={22}/></div>
     <form className="seo2-url-form" onSubmit={save}>
      <label htmlFor="seo2-web">Website HTTPS</label><div><input id="seo2-web" type="url" required maxLength={500} value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://website.vn/"/><button className="ops-outline" disabled={pending} type="submit">Lưu</button></div>
     </form>
     <div className="seo2-buttons">
      <button className="primary" type="button" disabled={pending||!savedUrl||project?.status!=="active"} onClick={()=>call(()=>seoAuditAction(projectId,"quick"))}><RefreshCw size={15}/> Audit nhanh · tối đa 8 URL</button>
      <button className="ops-outline" type="button" disabled={pending||!savedUrl||project?.status!=="active"} onClick={()=>call(()=>seoAuditAction(projectId,"extended"))}><FileSearch size={15}/> Audit mở rộng · tối đa 30 URL</button>
     </div>
     <small>Quét trực tiếp trên website, có giới hạn truy cập; không phải full crawl. Không xác nhận trạng thái index hay thứ hạng Google. Lần chạy cách nhau tối thiểu 1 phút.</small>
    </div>
    <div className="panel seo2-panel">
     <div className="seo2-panel-title"><div><h3>Tình trạng & phạm vi</h3><p>{report?"Dữ liệu đo từ báo cáo đã lưu":"Chưa có số liệu mới"}</p></div><ShieldCheck size={22}/></div>
     {report?<div className="seo2-insights">
       <div><span>Thời gian Audit</span><b>{showDate(report.checkedAt)}</b></div>
       <div><span>URL tìm thấy (phạm vi quét)</span><b>{s?.discovered}</b></div>
       <div><span>URL đọc lỗi</span><b>{s?.failed}</b></div>
       <div><span>Sản phẩm / Danh mục / Bài viết</span><b>{s?.kinds.product} / {s?.kinds.category} / {s?.kinds.article}</b></div>
       <div><span>Sitemap</span><b>{report.scope.dataSources?.find(x=>x.startsWith("Sitemap:"))||"Chưa xác minh"}</b></div>
      </div>:<div className="seo2-onboarding"><CheckCircle2 size={22}/><h3>Bắt đầu bằng một lần Audit</h3><p>Hệ thống sẽ đọc website, nhận diện vấn đề và chuẩn bị kế hoạch xử lý; không tự tạo số liệu Google.</p></div>}
    </div>
   </section>
   {report&&<section className="panel seo2-panel">
    <div className="seo2-panel-title"><div><h3>Những việc nên ưu tiên</h3><p>Tổng hợp từ bằng chứng trên các URL đã kiểm tra, không phải kết luận về thứ hạng.</p></div><span className="chip">{groups.length} loại vấn đề</span></div>
    {isOutdated&&<p className="seo2-caution">Báo cáo này thuộc một hostname khác URL dự án đang lưu. Nên chạy Audit mới trước khi tạo việc.</p>}
    {older&&<p className="seo2-compare"><TrendingUp size={15}/> So với lần trước cùng website: ưu tiên cao {older.summary.severity.high} → {severity?.high}, cảnh báo {older.summary.severity.medium} → {severity?.medium}. Kết quả chỉ tham khảo khi phạm vi quét khác nhau.</p>}
    <div className="seo2-finding-list">{groups.filter(x=>x.severity!=="info").slice(0,6).map(g=><div className="seo2-finding" key={g.code}>
     <span className={"seo2-severity "+g.severity}>{g.severity==="high"?"Cao":"Xem xét"}</span><div><b>{g.message}</b><small>{g.count} URL trong phạm vi quét · {g.code}</small></div>
    </div>)}
    {groups.filter(x=>x.severity!=="info").length===0&&<p>Chưa phát hiện cảnh báo cao/trung bình trong phạm vi được quét; không đồng nghĩa toàn website không có vấn đề.</p>}</div>
    <div className="seo2-footer"><button className="ops-outline" onClick={()=>setSection("issues")}>Xem từng URL <ArrowRight size={14}/></button>
     <button className="primary" disabled={pending||isOutdated||!groups.some(x=>x.severity!=="info")} onClick={()=>call(()=>createSeoAuditTasksAction(projectId,selected?.id||""),"tasks")}><ClipboardList size={15}/> Tạo công việc SEO</button></div>
   </section>}
  </>}
  {section==="issues"&&<section className="panel seo2-panel">
   <div className="seo2-panel-title"><div><h3>Vấn đề và URL bị ảnh hưởng</h3><p>Mỗi cảnh báo có mã quy tắc, số URL và bằng chứng từ HTML thực tế.</p></div><span className="chip">{groups.length} nhóm</span></div>
   <input className="seo2-search" aria-label="Tìm cảnh báo" placeholder="Tìm mã vấn đề hoặc mô tả…" value={search} onChange={e=>setSearch(e.target.value)}/>
   {!report?<div className="seo2-onboarding"><FileSearch size={22}/><b>Chạy Audit để có danh sách URL</b></div>:
   <div className="seo2-issue-list">{filtered.map(g=>{const Icon=issueIcons[g.severity]||Activity;return <details key={g.code} className="seo2-issue">
    <summary><Icon size={17}/><span><b>{g.message}</b><small>{g.code} · {severities[g.severity]}</small></span><strong>{g.count} URL</strong></summary>
    <div>{g.urls.map(url=><a key={url} href={url} target="_blank" rel="noopener noreferrer">{url}<ExternalLink size={12}/></a>)}{g.count>g.urls.length&&<small>Đang hiển thị tối đa {g.urls.length} URL ví dụ.</small>}</div>
   </details>})}
   {!filtered.length&&<p>Không có vấn đề phù hợp bộ lọc trong lần Audit này.</p>}</div>}
   {report&&<details className="seo2-urls"><summary>Danh sách {report.pages.length} URL đã kiểm tra (chi tiết)</summary>
    {report.pages.map(p=><div key={p.url}><a href={p.url} target="_blank" rel="noopener noreferrer">{p.title||"Không có title"} <ExternalLink size={12}/></a><small>{kindNames[p.kind||"page"]} · H1: {p.h1Count} · Ảnh cần kiểm tra ALT: {p.imagesMissingAlt} · {p.issues.length} nhận xét</small></div>)}
   </details>}
  </section>}
  {section==="links"&&<div className="seo2-two">
   <section className="panel seo2-panel">
    <div className="seo2-panel-title"><div><h3>Internal Link</h3><p>Đo cấu trúc liên kết trong đúng mẫu URL đã quét.</p></div><Link2 size={21}/></div>
    {report?<><div className="seo2-insights"><div><span>Liên kết nội bộ phát hiện</span><b>{s?.internal.edges}</b></div><div><span>URL đích không trùng</span><b>{s?.internal.uniqueTargets}</b></div><div><span>URL đích chưa được quét</span><b>{s?.internal.unscannedTargets}</b></div><div><span>Trang không có link đến trong mẫu</span><b>{s?.internal.noIncomingInSample.length}</b></div></div>
     <small>Không đủ dữ liệu để kết luận “trang mồ côi”. Cần quét toàn bộ website và nguồn CMS để xác minh.</small>
     <details className="seo2-urls"><summary>Trang ít được liên kết trong mẫu</summary>{s?.internal.noIncomingInSample.map(url=><a href={url} target="_blank" rel="noopener noreferrer" key={url}>{url}</a>)}</details>
    </>:<p>Chưa có sơ đồ liên kết. Chạy Audit để đọc các URL đang được dẫn đến.</p>}
   </section>
   <section className="panel seo2-panel">
    <div className="seo2-panel-title"><div><h3>Entity · Google Maps · Backlink</h3><p>Ưu tiên sự nhất quán và uy tín thực, tránh backlink rác.</p></div><MapPin size={21}/></div>
    <div className="seo2-status-list"><div><b>Google Business Profile</b><span>Chưa tích hợp API đọc dữ liệu Maps</span></div><div><b>Backlink / Digital PR</b><span>Chưa có nguồn backlink có xác minh</span></div><div><b>Entity doanh nghiệp</b><span>Cần kiểm tra nguồn hồ sơ chính thức và website</span></div></div>
    <p className="seo2-small">Agent có thể tư vấn dựa trên tài liệu bạn cung cấp; chưa được coi là đã quét Google Maps hay backlink.</p>
   </section>
  </div>}
  {section==="tasks"&&<section className="panel seo2-panel">
   <div className="seo2-panel-title"><div><h3>Đốm & đội Agent xử lý SEO</h3><p>Tạo việc từ kết quả Audit; Agent chỉ chạy khi bạn chủ động bấm chạy và có API được cấp quyền.</p></div><ClipboardList size={21}/></div>
   <div className="seo2-buttons"><button className="primary" disabled={pending||isOutdated||!report||!groups.some(x=>x.severity!=="info")} onClick={()=>call(()=>createSeoAuditTasksAction(projectId,selected?.id||""))}>Tạo công việc từ Audit</button>
    <button className="ops-outline" onClick={()=>openTab("automations")}>Bộ mẫu workflow <ArrowRight size={14}/></button>
    <button className="ops-outline" onClick={()=>openTab("tasks")}>Mở bảng công việc <ArrowRight size={14}/></button></div>
   <div className="seo2-task-list">{taskRows.slice(0,12).map(t=><div key={t.id}><b>{t.title}</b><small>{t.status==="draft"?"Chờ xử lý":t.status==="approved"?"Đã duyệt":t.status==="pending_approval"?"Chờ duyệt":t.status||"Không rõ"} · {showDate(t.created_at)}</small></div>)}
   {!taskRows.length&&<div className="seo2-onboarding"><ClipboardList size={23}/><h3>Chưa có việc SEO từ Audit</h3><p>Quét website, xem vấn đề và bấm “Tạo công việc từ Audit”. Không tự phát sinh chi phí AI.</p></div>}</div>
  </section>}
  <WordPressRepairBoard projectId={projectId} changes={initial.wpChanges}/>
  <section className="panel seo2-panel seo2-bottom">
   <div className="seo2-panel-title"><div><h3>Nguồn chuẩn & lịch sử</h3><p>Những khuyến nghị SEO được đối chiếu theo tài liệu chính thức, không cam kết thứ hạng.</p></div><BookOpen size={19}/></div>
   <div className="seo2-doc-links">{SEO_OFFICIAL_SOURCES.slice(0,4).map(x=><a href={x.url} key={x.url} target="_blank" rel="noopener noreferrer">{x.name}<ExternalLink size={12}/></a>)}</div>
   {audits.length>0&&<div className="seo2-history"><label htmlFor="seo2-history-select">Báo cáo đã lưu ({audits.length})</label><select id="seo2-history-select" value={selected?.id||""} onChange={e=>setSelectedId(e.target.value)}>{audits.slice(0,50).map(a=><option value={a.id} key={a.id}>{showDate(a.created_at)} · {a.title}</option>)}</select>
    {legacy&&<details><summary>Xem báo cáo Audit phiên bản cũ</summary><pre className="ops-content">{selected?.body}</pre></details>}
    {selected&&!report&&!legacy&&<p>Báo cáo cũ chưa có dữ liệu có cấu trúc. Chạy Audit mới để xem chỉ số.</p>}
   </div>}
   <p className="seo2-disclaimer">Dữ liệu GSC, GA4, Google Maps, backlink và Ads chỉ được hiển thị khi thực sự lấy được từ API tương ứng. Kết quả quét HTML không xác nhận Google đã index trang.</p>
  </section>
 </div>;
}
