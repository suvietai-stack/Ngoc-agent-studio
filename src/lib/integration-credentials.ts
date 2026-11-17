import "server-only";
import {createCipheriv,createDecipheriv,randomBytes} from "node:crypto";
import {lookup} from "node:dns/promises";
import {isPublicIP} from "@/lib/seo";
import type {SupabaseClient} from "@supabase/supabase-js";

export type Provider="openai"|"wordpress";
export function encryptionReady():boolean {
 const key=process.env.INTEGRATION_ENCRYPTION_KEY;
 if(!key)return false;
 try{return Buffer.from(key,"base64").length===32;}catch{return false;}
}
function secretKey():Buffer {
 const key=process.env.INTEGRATION_ENCRYPTION_KEY;
 if(!key)throw new Error("Cần cấu hình INTEGRATION_ENCRYPTION_KEY trên máy chủ.");
 const buffer=Buffer.from(key,"base64");
 if(buffer.length!==32)throw new Error("INTEGRATION_ENCRYPTION_KEY phải là 32 byte, mã hóa Base64.");
 return buffer;
}
export function encryptCredentials(input:Record<string,string>):string {
 const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",secretKey(),iv);
 const encrypted=Buffer.concat([cipher.update(JSON.stringify(input),"utf8"),cipher.final()]);
 return ["v1",iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),encrypted.toString("base64url")].join(":");
}
export function decryptCredentials(value:string):Record<string,string> {
 const parts=value.split(":");
 if(parts.length!==4||parts[0]!=="v1")throw new Error("Phiên bản dữ liệu API không hợp lệ.");
 const decipher=createDecipheriv("aes-256-gcm",secretKey(),Buffer.from(parts[1],"base64url"));
 decipher.setAuthTag(Buffer.from(parts[2],"base64url"));
 const data=Buffer.concat([decipher.update(Buffer.from(parts[3],"base64url")),decipher.final()]);
 const valueParsed:unknown=JSON.parse(data.toString("utf8"));
 if(!valueParsed||typeof valueParsed!=="object"||Array.isArray(valueParsed))throw new Error("Dữ liệu API không hợp lệ.");
 return valueParsed as Record<string,string>;
}
export async function getStoredCredentials(db:SupabaseClient,ownerId:string,projectId:string,provider:Provider):Promise<Record<string,string>|null>{
 const {data,error}=await db.from("integration_secrets").select("encrypted_credentials")
  .eq("owner_id",ownerId).eq("project_id",projectId).eq("provider",provider).maybeSingle();
 if(error||!data)return null;
 return decryptCredentials(data.encrypted_credentials);
}
export async function getOpenAIKey(db:SupabaseClient,ownerId:string,projectId:string):Promise<string|undefined> {
 const stored=await getStoredCredentials(db,ownerId,projectId,"openai");
 return stored?.apiKey||process.env.OPENAI_API_KEY||undefined;
}
export async function verifyConnection(provider:Provider,credentials:Record<string,string>,website?:string|null):Promise<boolean>{
 if(provider==="openai"){
  const result=await fetch("https://api.openai.com/v1/models",{headers:{Authorization:"Bearer "+credentials.apiKey},cache:"no-store",signal:AbortSignal.timeout(12000)});
  return result.ok;
 }
 if(!website)throw new Error("Dự án chưa có website HTTPS.");
 const url=new URL(website);
 if(url.protocol!=="https:"||url.username||url.password||url.port||!url.hostname.includes("."))
  throw new Error("WordPress yêu cầu website HTTPS hợp lệ.");
 const addresses=await lookup(url.hostname,{all:true});
 if(!addresses.length||addresses.some(a=>!isPublicIP(a.address)))throw new Error("Tên miền website không công khai.");
 const endpoint=new URL("/wp-json/wp/v2/users/me",url.origin);
 const authorization=Buffer.from(credentials.username+":"+credentials.appPassword,"utf8").toString("base64");
 const response=await fetch(endpoint,{headers:{Authorization:"Basic "+authorization,Accept:"application/json"},redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(12000)});
 return response.ok;
}
