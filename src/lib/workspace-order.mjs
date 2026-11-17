/** Every workspace table must be sorted on an existing database column.
 * SEO URL inventory has first_seen_at / last_seen_at, not created_at.
 */
export function workspaceOrderColumn(table){
 return table==="seo_site_urls"?"last_seen_at":"created_at";
}
