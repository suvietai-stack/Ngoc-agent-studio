export type WorkspaceLink={tab:string|null;project:string|null;oauth:string|null};
export function resolveWorkspaceLink(search:string,allowedTabs:string[],projectIds:string[]):WorkspaceLink;
