export type AuditIssue={severity:"high"|"medium"|"info";code:string;message:string};
export type AuditPage={
 url:string;title:string;description:string;firstH1:string;h1Count:number;canonical:string;robots:string;
 imageCount:number;imagesMissingAlt:number;links:string[];issues:AuditIssue[];hasJsonLd:boolean;
 schemaTypes:string[];incomingSample?:number;kind?:string;
};
export type AuditGroup={code:string;severity:"high"|"medium"|"info";message:string;count:number;urls:string[]};
export type SeoV2Audit={
 schema:"ngoc.seo.audit.v2";checkedAt:string;
 scope:{root:string;mode:"quick"|"extended";limit:number;description:string;dataSources:string[];sitemapCandidates:number};
 summary:{scanned:number;limit:number;discovered:number;failed:number;severity:{high:number;medium:number;info:number};
  issues:AuditGroup[];kinds:{product:number;category:number;article:number;page:number};
  internal:{uniqueTargets:number;edges:number;noIncomingInSample:string[];unscannedTargets:number}};
 pages:AuditPage[];failures:{url:string;reason:string}[];references:string[];
};
export function auditUrl(input:string,origin:string):string|null;
export function sitemapUrls(xml:string,origin:string,max?:number):string[];
export function sitemapRefs(xml:string,origin:string,max?:number):string[];
export function robotsRules(raw:string):(path:string)=>boolean;
export function pageKind(page:AuditPage):string;
export function jsonLdTypes(html:string):string[];
export function summarizeAudit(pages:AuditPage[],failed:{url:string;reason:string}[],discoveredCount:number,limit:number):SeoV2Audit["summary"];
export function parseAuditV2(value:unknown):SeoV2Audit|null;
export const SEO_OFFICIAL_SOURCES:readonly {name:string;url:string;area:string}[];
