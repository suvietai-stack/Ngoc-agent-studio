export const WP_FIELDS:readonly ["post_title","h1","seo_description","image_alt"];
export const WP_COLLECTIONS:readonly ["posts","pages","product","products"];
export const META_DESCRIPTION_KEYS:readonly ["_yoast_wpseo_metadesc","rank_math_description","_aioseo_description"];
export function safeWpPageUrl(raw:string,website:string):string;
export function sameWpPermalink(left:string,right:string,website:string):boolean;
export function cleanWpProposal(text:string,kind:string):string;
export function editableMetaDescription(meta:unknown):string|null;
export function buildSafeH1Content(raw:string,text:string):string;
