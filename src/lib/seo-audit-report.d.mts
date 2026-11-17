export type SeoAuditMetric={url:string;title:string;h1Count:number;issues:{severity:string;message:string}[]};
export type ParsedAudit={scanned:number;high:number;medium:number;discovered:number;pending:number;limit:number|null;time:string;root:string;pages:SeoAuditMetric[];failed:number};
export function parseSeoAuditReport(body:unknown):ParsedAudit|null;
