export function projectWorkspaceHref(projectId:string,tab?:string|null):string;
export function projectFromOwnedList<T extends {id:string}>(projects:readonly T[],requested:unknown):T|null;
export function allowedWorkspaceTab(tab:unknown):string|null;
