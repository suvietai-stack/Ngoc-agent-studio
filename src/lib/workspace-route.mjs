/** Parse safe shareable workspace deep links without granting data access. */
export function resolveWorkspaceLink(search,allowedTabs,projectIds){
 const query=new URLSearchParams(search);
 const tab=query.get("tab"),project=query.get("project"),oauth=query.get("oauth");
 return {
  tab:tab&&allowedTabs.includes(tab)?tab:null,
  project:project&&projectIds.includes(project)?project:null,
  oauth:["connected","needs_access","failed"].includes(oauth)?oauth:null
 };
}
