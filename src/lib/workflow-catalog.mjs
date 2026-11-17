/**
 * Immutable SEO-first workflow catalogue; all definitions are installed DISABLED.
 * "external" is a non-executable approval boundary until a verified provider adapter
 * and explicit scoped write permission exist.
 */
export const WORKFLOW_TEMPLATE_VERSION="seo-first-standard-v2.0.0";
const step=(key,label,gate="read",requires=[])=>({key,label,gate,requires});
export const WORKFLOW_CATALOG=Object.freeze([
 {key:"seo_initial_audit",title:"SEO · Audit lần đầu",trigger:"manual",steps:[
  step("discover","Khám phá URL & sitemap"),step("crawl","Quét HTTPS an toàn","read",["discover"]),step("analyze","Nhóm vấn đề theo bằng chứng","read",["crawl"]),step("prioritize","Lập kế hoạch SEO","draft",["analyze"])]},
 {key:"seo_daily_guardian",title:"SEO · Giám sát thay đổi",trigger:"manual",steps:[
  step("baseline","Đọc baseline thực"),step("compare","Đối chiếu URL và tín hiệu","read",["baseline"]),step("alert","Tạo cảnh báo có nguồn","draft",["compare"])]},
 {key:"seo_weekly_opportunities",title:"SEO · Cơ hội hàng tuần",trigger:"manual",steps:[
  step("sources","Kiểm tra kết nối và kỳ dữ liệu"),step("analyze","Phân tích GSC/GA4 đã đồng bộ","read",["sources"]),step("prioritize","Đề xuất cơ hội có căn cứ","draft",["analyze"])]},
 {key:"seo_content_publish",title:"SEO · Soạn và xuất bản bài",trigger:"manual",steps:[
  step("brief","Brief theo search intent"),step("draft","Viết nháp có dẫn nguồn","draft",["brief"]),step("media","Chọn ảnh thật đã duyệt","draft",["draft"]),step("links","Kiểm tra internal links","draft",["media"]),step("quality","Kiểm định nội dung độc lập","approval",["links"]),step("approve","Người quản lý phê duyệt","approval",["quality"]),step("publish","Đăng WordPress khi có quyền","external",["approve"]),step("verify","Xác minh URL đã xuất bản","read",["publish"])]},
 {key:"seo_content_refresh",title:"SEO · Cập nhật nội dung",trigger:"manual",steps:[
  step("select","Chọn URL cần cập nhật"),step("compare","Đánh giá nội dung hiện tại","read",["select"]),step("diff","Đề xuất bản thay đổi","draft",["compare"]),step("approval","Duyệt thay đổi","approval",["diff"]),step("update","Cập nhật trang có quyền","external",["approval"]),step("verify","Quét xác minh","read",["update"])]},
 {key:"seo_internal_link",title:"SEO · Internal Link",trigger:"manual",steps:[
  step("graph","Thu thập liên kết nội bộ"),step("suggest","Đề xuất source/target/anchor","draft",["graph"]),step("diff","Kiểm tra vị trí và trùng lặp","draft",["suggest"]),step("approval","Duyệt chèn liên kết","approval",["diff"]),step("write","Cập nhật trang qua CMS","external",["approval"]),step("recrawl","Kiểm tra lại liên kết","read",["write"])]},
 {key:"seo_backlink_monitor",title:"Backlink · Theo dõi & Digital PR",trigger:"manual",steps:[
  step("source","Xác minh nguồn backlink"),step("verify","Kiểm tra liên kết thực tế","read",["source"]),step("changes","Phân tích mới/mất","read",["verify"]),step("prospects","Đề xuất cơ hội PR chất lượng","draft",["changes"])]},
 {key:"brand_entity_audit",title:"Entity · Kiểm toán thương hiệu",trigger:"manual",steps:[
  step("identity","Xác minh thông tin thương hiệu"),step("profiles","Đối chiếu website, Page, GBP","read",["identity"]),step("findings","Báo cáo thông tin sai lệch","draft",["profiles"])]},
 {key:"local_seo_review",title:"Maps · Local SEO và đánh giá",trigger:"manual",steps:[
  step("permissions","Xác minh quyền GBP"),step("reviews","Đọc review thật","read",["permissions"]),step("response","Soạn phản hồi","draft",["reviews"]),step("approval","Duyệt phản hồi","approval",["response"]),step("post","Phản hồi qua GBP","external",["approval"])]},
 {key:"facebook_content_publish",title:"Facebook · Nội dung Page",trigger:"manual",steps:[
  step("source","Chọn nội dung website đã duyệt"),step("caption","Soạn caption phù hợp Page","draft",["source"]),step("photo","Chọn ảnh có quyền sử dụng","draft",["caption"]),step("quality","Kiểm định & xem trước","approval",["photo"]),step("approval","Duyệt đúng Page đích","approval",["quality"]),step("post","Xuất bản qua Meta","external",["approval"]),step("verify","Xác minh ID bài đăng","read",["post"])]},
 {key:"marketing_weekly_report",title:"Marketing · Báo cáo tuần",trigger:"manual",steps:[
  step("health","Kiểm tra độ mới dữ liệu"),step("metrics","Tổng hợp KPI có nguồn","read",["health"]),step("analysis","Giải thích biến động","draft",["metrics"]),step("review","Duyệt báo cáo","approval",["analysis"])]},
 {key:"ads_readonly_monitor",title:"Ads · Phân tích chỉ đọc",trigger:"manual",steps:[
  step("permissions","Kiểm tra quyền đọc Ads"),step("metrics","Đọc chi phí và chuyển đổi","read",["permissions"]),step("recommend","Đề xuất tối ưu","draft",["metrics"]),step("approval","Duyệt đề xuất, không đổi ngân sách","approval",["recommend"])]},
 {key:"data_integration_guardian",title:"Data · Giám sát kết nối",trigger:"manual",steps:[
  step("status","Kiểm tra kết nối API"),step("freshness","Kiểm tra thời điểm đồng bộ","read",["status"]),step("warning","Cảnh báo lỗi dữ liệu","draft",["freshness"])]}
].map(item=>Object.freeze({...item,steps:Object.freeze(item.steps.map(s=>Object.freeze(s)))})));

export const AGENT_ROLE_KEYS=Object.freeze({
 "Đốm":"marketing_orchestrator",
 "SEO Agent":"seo_strategy",
 "Technical SEO Agent":"seo_technical",
 "On-page SEO Agent":"seo_onpage",
 "SEO Internal Link Agent":"seo_internal_links",
 "SEO Backlink & PR Agent":"seo_backlink_pr",
 "SEO Entity & Local Agent":"seo_entity_local",
 "SEO Ecommerce Agent":"seo_ecommerce",
 "SEO Content Gap Agent":"seo_content_gap",
 "SEO Performance Agent":"seo_performance",
 "SEO Guardian Agent":"seo_guardian",
 "Content Agent":"content_writer",
 "Media Assistant Agent":"media_assistant",
 "Social Agent":"facebook_social",
 "Marketing Agent":"marketing_planning",
 "Reporting Agent":"reporting",
 "Quality Auditor Agent":"independent_quality",
 "Lead & CRO Analyst":"lead_cro"
});
export function validateWorkflow(workflow){
 if(!workflow||typeof workflow!=="object"||!Array.isArray(workflow.steps)||workflow.steps.length<2||workflow.steps.length>30)return false;
 const seen=new Set();
 for(const st of workflow.steps){
  if(!st||typeof st.key!=="string"||!/^[a-z][a-z0-9_]{2,49}$/.test(st.key)||seen.has(st.key))return false;
  if(!["read","draft","approval","external"].includes(st.gate)||typeof st.label!=="string"||st.label.length<4)return false;
  if(!Array.isArray(st.requires)||!st.requires.every(k=>typeof k==="string"&&seen.has(k)))return false;
  seen.add(st.key);
 }
 return true;
}
export function plannedSteps(workflow){
 if(!validateWorkflow(workflow))throw Error("Định nghĩa workflow sai hoặc có vòng lặp.");
 return workflow.steps.map((st,i)=>({
  step_key:st.key,label:st.label,step_order:i+1,requires:[...st.requires],gate:st.gate,
  status:st.gate==="external"?"blocked":st.requires.length===0?"ready":"pending"
 }));
}
