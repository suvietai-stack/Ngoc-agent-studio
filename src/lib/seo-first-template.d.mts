export type SeoFirstRole={name:string;purpose:string;instructions:string};
export type SeoFirstSchedule={title:string;agent:string;frequency:"daily"|"weekly";brief:string};
export const SEO_FIRST_TEMPLATE:{key:string;version:string;name:string};
export const SEO_FIRST_ROLES:readonly SeoFirstRole[];
export const SEO_FIRST_SCHEDULES:readonly SeoFirstSchedule[];
export function getMissingTemplateRoles(existingNames:Iterable<string>):SeoFirstRole[];
