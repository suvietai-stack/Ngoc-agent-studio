import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {safeWpPageUrl,sameWpPermalink,cleanWpProposal,editableMetaDescription,buildSafeH1Content} from "../src/lib/wordpress-guard.mjs";
const site="https://xuonggomsuviet.vn/";
test("WordPress writes stay within project website and precise page URL",()=>{
 assert.equal(safeWpPageUrl("https://xuonggomsuviet.vn/bai-viet",site),"https://xuonggomsuviet.vn/bai-viet/");
 assert.equal(sameWpPermalink("https://xuonggomsuviet.vn/bai-viet/","https://xuonggomsuviet.vn/bai-viet",site),true);
 for(const url of ["http://xuonggomsuviet.vn/bai-viet","https://other.vn/bai-viet","https://xuonggomsuviet.vn/",
  "https://xuonggomsuviet.vn/bai-viet?preview=true","https://xuonggomsuviet.vn/wp-json/wp/v2/posts/1"]){
  assert.throws(()=>safeWpPageUrl(url,site),undefined,url);
 }
});
test("AI field proposals are bounded plain text and H1 is escaped",()=>{
 assert.equal(cleanWpProposal("H1: Bộ ấm chén dùng trong doanh nghiệp","h1"),"Bộ ấm chén dùng trong doanh nghiệp");
 for(const bad of ["<script>alert(1)</script>","ngắn","Dòng một\n<script>x</script>"]){
  assert.throws(()=>cleanWpProposal(bad,"post_title"));
 }
 const h=buildSafeH1Content("<p>Giới thiệu</p>","Bộ ấm chén & quà tặng doanh nghiệp");
 assert.match(h,/&amp;/);
 assert.match(h,/<!-- wp:heading/);
 assert.throws(()=>buildSafeH1Content("<h1>Đã có</h1>","Bộ ấm chén quà tặng doanh nghiệp"));
 assert.throws(()=>buildSafeH1Content("[vc_row]abc","Bộ ấm chén quà tặng doanh nghiệp"));
});
test("description updates require plugin field to be REST-exposed",()=>{
 assert.equal(editableMetaDescription({rank_math_description:""}),"rank_math_description");
 assert.equal(editableMetaDescription({_yoast_wpseo_metadesc:""}),"_yoast_wpseo_metadesc");
 assert.equal(editableMetaDescription({hidden_meta:"value"}),null);
});
test("write flow is explicit approval gated and includes remote conflict verification",()=>{
 const source=readFileSync(new URL("../src/app/wordpress-actions.ts",import.meta.url),"utf8");
 assert.match(source,/applyWordPressChangeAction\(changeId:string,confirmed:boolean\)/);
 assert.match(source,/confirmed!==true/);
 assert.match(source,/fresh.modified!==change.original_modified/);
 assert.match(source,/status:"applying"/);
 assert.match(source,/status:"reverting"/);
 assert.match(source,/wpReadById\(ctx.site,ctx.auth/);
 const transport=readFileSync(new URL("../src/lib/public-http.ts",import.meta.url),"utf8");
 assert.match(transport,/publicHttpsRequest/);
 assert.match(transport,/family:4/);
 assert.match(transport,/status>=300&&status<400/);
});
