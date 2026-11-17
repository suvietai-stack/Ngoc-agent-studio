/** Stable project-first routes. Explicit project selection is required for a workspace. */
const allowedTabs=new Set(["home","inbox","seo","dom","projects","agents","tasks","automations","content","knowledge","integrations","runs","settings"]);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function projectWorkspaceHref(projectId,tab){
 if(typeof projectId!=="string"||!uuid.test(projectId))throw new Error("Project ID không hợp lệ.");
 const query=new URLSearchParams({project:projectId});
 if(typeof tab==="string"&&allowedTabs.has(tab))query.set("tab",tab);
 return "/?"+query.toString();
}
export function projectFromOwnedList(projects,requested){
 if(typeof requested!=="string"||!uuid.test(requested))return null;
 return projects.find(p=>p.id===requested)||null;
}
export function allowedWorkspaceTab(tab){
 return typeof tab==="string"&&allowedTabs.has(tab)?tab:null;
}
