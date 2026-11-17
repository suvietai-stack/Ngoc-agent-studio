/** Parse only our own audit format: never infer success from missing fields. */
function num(report,label){
 const m=report.match(new RegExp("^\\s*- "+label+":\\s*([0-9]+)","m"));
 return m?Number(m[1]):null;
}
export function parseSeoAuditReport(body){
 if(typeof body!=="string"||!body.startsWith("# SEO Audit — Mẫu URL thực tế"))return null;
 const scanned=num(body,"URL đã kiểm tra");
 const high=num(body,"Vấn đề cần xác minh ưu tiên cao");
 const medium=num(body,"Cảnh báo trung bình");
 const discovered=num(body,"URL tìm thấy qua liên kết nội bộ");
 const pending=num(body,"URL phát hiện nhưng chưa kiểm tra");
 const time=body.match(/^- Thời điểm: (.+)$/m)?.[1]||"";
 const root=body.match(/^- Website: (.+)$/m)?.[1]||"";
 const max=body.match(/^- URL đã kiểm tra: [0-9]+\/tối đa ([0-9]+)/m)?.[1];
 if([scanned,high,medium,discovered,pending].some(x=>x===null))return null;
 const pages=[];
 const headings=[...body.matchAll(/^### (https:\/\/[^\n]+)$/gm)];
 for(let i=0;i<headings.length;i++){
  const start=headings[i].index??0;
  const next=headings[i+1]?.index??body.indexOf("\n## Giới hạn và nguồn kiểm tra",start);
  const segment=body.slice(start,next>start?next:undefined);
  const title=segment.match(/^- HTTP: [^\n]* · Title: (.+)$/m)?.[1]||"";
  const h1=segment.match(/^- H1: ([0-9]+)/m)?.[1]||"";
  const issues=[...segment.matchAll(/^- \[(HIGH|MEDIUM|INFO)\] ([^\n]+)/gm)].map(x=>({severity:x[1].toLowerCase(),message:x[2]}));
  pages.push({url:headings[i][1],title,h1Count:Number(h1)||0,issues});
 }
 const failures=body.match(/^## URL không đọc được\n([\s\S]*?)(?:\n## |$)/m)?.[1]?.match(/^- https:\/\/[^\n]+/gm)||[];
 return {scanned,high,medium,discovered,pending,limit:Number(max)||null,time,root,pages,failed:failures.length};
}
