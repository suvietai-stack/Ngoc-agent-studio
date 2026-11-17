import "server-only";
import {encryptCredentials,getStoredCredentials} from "@/lib/integration-credentials";
import {OAUTH_PROVIDERS,type OAuthProvider} from "@/lib/oauth-providers";
import type {SupabaseClient} from "@supabase/supabase-js";

type Tokens=Record<string,string>;
type TokenResponse={access_token?:string;refresh_token?:string;expires_in?:number;scope?:string};
type MetaPage={id?:string;name?:string;instagram_business_account?:{id?:string;username?:string}};
export type Verification={ok:boolean;detail:string;credentials:Tokens};

function appCredentials(provider:OAuthProvider){
 const google=OAUTH_PROVIDERS[provider].kind==="google";
 const clientId=google?process.env.GOOGLE_OAUTH_CLIENT_ID:process.env.META_APP_ID;
 const clientSecret=google?process.env.GOOGLE_OAUTH_CLIENT_SECRET:process.env.META_APP_SECRET;
 if(!clientId||!clientSecret)throw new Error("Chưa có OAuth Client ID và Client Secret trên Vercel.");
 if(provider==="google_ads"&&!process.env.GOOGLE_ADS_DEVELOPER_TOKEN)throw new Error("Google Ads cần GOOGLE_ADS_DEVELOPER_TOKEN.");
 return {clientId,clientSecret,google};
}
export function redirectUri():string{
 const raw=process.env.NEXT_PUBLIC_SITE_URL;
 if(!raw)throw new Error("Chưa có NEXT_PUBLIC_SITE_URL trên Vercel.");
 const url=new URL(raw);
 if(url.protocol!=="https:"&&!(url.protocol==="http:"&&url.hostname==="localhost"))throw new Error("OAuth yêu cầu HTTPS.");
 url.pathname="/api/integrations/oauth/callback";url.search="";url.hash="";
 return url.toString();
}
export function authorizationUrl(provider:OAuthProvider,state:string):string{
 const {clientId,google}=appCredentials(provider);
 const url=new URL(google?"https://accounts.google.com/o/oauth2/v2/auth":"https://www.facebook.com/v24.0/dialog/oauth");
 url.searchParams.set("client_id",clientId);
 url.searchParams.set("redirect_uri",redirectUri());
 url.searchParams.set("response_type","code");
 url.searchParams.set("state",state);
 url.searchParams.set("scope",OAUTH_PROVIDERS[provider].scope);
 if(google){url.searchParams.set("access_type","offline");url.searchParams.set("prompt","consent");}
 return url.toString();
}
async function getJson(url:string,init:RequestInit,timeout=14000):Promise<Record<string,unknown>>{
 const response=await fetch(url,{...init,cache:"no-store",signal:AbortSignal.timeout(timeout),redirect:"error"});
 const raw=(await response.json()) as Record<string,unknown>;
 if(!response.ok)throw new Error("Nền tảng từ chối xác minh (HTTP "+response.status+"). Kiểm tra OAuth, quyền và API.");
 return raw;
}
export async function exchangeOAuthCode(provider:OAuthProvider,code:string):Promise<Tokens>{
 const {clientId,clientSecret,google}=appCredentials(provider);
 if(google){
  const response=await getJson("https://oauth2.googleapis.com/token",{
   method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri(),grant_type:"authorization_code",code}).toString()
  }) as TokenResponse;
  if(!response.access_token||!response.refresh_token)throw new Error("Google chưa cấp refresh token. Kết nối lại với quyền offline.");
  return {kind:"google",accessToken:response.access_token,refreshToken:response.refresh_token,
   scope:response.scope||OAUTH_PROVIDERS[provider].scope,
   expiresAt:String(Date.now()+Math.max(60,Number(response.expires_in)||3600)*1000)};
 }
 const url=new URL("https://graph.facebook.com/v24.0/oauth/access_token");
 for(const [k,v] of Object.entries({client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri(),code}))url.searchParams.set(k,v);
 const short=await getJson(url.toString(),{method:"GET"}) as TokenResponse;
 if(!short.access_token)throw new Error("Meta chưa cấp access token.");
 const longURL=new URL("https://graph.facebook.com/v24.0/oauth/access_token");
 for(const [k,v] of Object.entries({grant_type:"fb_exchange_token",client_id:clientId,client_secret:clientSecret,fb_exchange_token:short.access_token}))longURL.searchParams.set(k,v);
 const longer=await getJson(longURL.toString(),{method:"GET"}) as TokenResponse;
 if(!longer.access_token)throw new Error("Meta không cấp token dài hạn.");
 return {kind:"meta",accessToken:longer.access_token,scope:OAUTH_PROVIDERS[provider].scope,
  expiresAt:String(Date.now()+Math.max(3600,Number(longer.expires_in)||5184000)*1000)};
}
async function renew(provider:OAuthProvider,credentials:Tokens):Promise<Tokens>{
 if(Date.now()+60000<Number(credentials.expiresAt||0))return credentials;
 const {clientId,clientSecret,google}=appCredentials(provider);
 if(google){
  if(!credentials.refreshToken)throw new Error("Đã hết phiên Google; kết nối OAuth lại.");
  const data=await getJson("https://oauth2.googleapis.com/token",{
   method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({grant_type:"refresh_token",client_id:clientId,client_secret:clientSecret,refresh_token:credentials.refreshToken}).toString()
  }) as TokenResponse;
  if(!data.access_token)throw new Error("Google không làm mới được token.");
  return {...credentials,accessToken:data.access_token,expiresAt:String(Date.now()+Math.max(60,Number(data.expires_in)||3600)*1000)};
 }
 if(!credentials.accessToken)throw new Error("Chưa có token Meta.");
 const url=new URL("https://graph.facebook.com/v24.0/oauth/access_token");
 for(const [k,v] of Object.entries({grant_type:"fb_exchange_token",client_id:clientId,client_secret:clientSecret,fb_exchange_token:credentials.accessToken}))url.searchParams.set(k,v);
 const data=await getJson(url.toString(),{method:"GET"}) as TokenResponse;
 if(!data.access_token)throw new Error("Không làm mới được token Meta.");
 return {...credentials,accessToken:data.access_token,expiresAt:String(Date.now()+Math.max(3600,Number(data.expires_in)||5184000)*1000)};
}
export async function verifyOAuth(provider:OAuthProvider,original:Tokens):Promise<Verification>{
 const credentials=await renew(provider,original);
 if(!credentials.accessToken)throw new Error("Chưa cấp OAuth access token.");
 const headers:Record<string,string>={Authorization:"Bearer "+credentials.accessToken,Accept:"application/json"};
 let endpoint="";
 if(provider==="gsc")endpoint="https://www.googleapis.com/webmasters/v3/sites";
 else if(provider==="ga4")endpoint="https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=25";
 else if(provider==="drive")endpoint="https://www.googleapis.com/drive/v3/files?pageSize=1&fields=nextPageToken,files(id,name)";
 else if(provider==="google_ads"){
  endpoint="https://googleads.googleapis.com/v26/customers:listAccessibleCustomers";
  headers["developer-token"]=process.env.GOOGLE_ADS_DEVELOPER_TOKEN||"";
 }else endpoint="https://graph.facebook.com/v24.0/me/accounts?fields=id,name,instagram_business_account&limit=100";
 const data=await getJson(endpoint,{headers,method:"GET"});
 if(provider==="gsc"){
  const count=Array.isArray(data.siteEntry)?data.siteEntry.length:0;
  return {ok:count>0,detail:count?"Có quyền với "+count+" website Search Console.":"Google đã cấp quyền, nhưng chưa thấy website Search Console.",credentials};
 }
 if(provider==="ga4"){
  const count=Array.isArray(data.accountSummaries)?data.accountSummaries.length:0;
  return {ok:count>0,detail:count?"Đã xác minh "+count+" tài khoản GA4.":"Google đã cấp quyền, nhưng chưa thấy tài khoản GA4.",credentials};
 }
 if(provider==="drive")return {ok:true,detail:"Đã xác minh quyền đọc metadata Google Drive.",credentials};
 if(provider==="google_ads"){
  const count=Array.isArray(data.resourceNames)?data.resourceNames.length:0;
  return {ok:count>0,detail:count?"Có quyền với "+count+" tài khoản Google Ads.":"OAuth hợp lệ nhưng chưa thấy tài khoản Google Ads.",credentials};
 }
 const pages=Array.isArray(data.data)?data.data as MetaPage[]:[];
 if(provider==="facebook")return {ok:pages.length>0,detail:pages.length?"Đã xác minh "+pages.length+" Trang Facebook.":"Meta đã cấp quyền nhưng chưa trả về Trang Facebook.",credentials};
 const count=pages.filter(x=>x.instagram_business_account?.id).length;
 return {ok:count>0,detail:count?"Đã xác minh "+count+" Instagram Professional.":"Chưa có Instagram Professional liên kết với Trang được cấp quyền.",credentials};
}
export async function testStoredOAuth(db:SupabaseClient,ownerId:string,projectId:string,provider:OAuthProvider):Promise<Verification>{
 const credentials=await getStoredCredentials(db,ownerId,projectId,provider);
 if(!credentials)throw new Error("Chưa có kết nối OAuth trong dự án.");
 const result=await verifyOAuth(provider,credentials);
 if(JSON.stringify(credentials)!==JSON.stringify(result.credentials)){
  const {error}=await db.from("integration_secrets").update({
   encrypted_credentials:encryptCredentials(result.credentials),updated_at:new Date().toISOString()
  }).eq("owner_id",ownerId).eq("project_id",projectId).eq("provider",provider);
  if(error)throw new Error("Không lưu được token mới. Kết nối cần thử lại.");
 }
 return result;
}
