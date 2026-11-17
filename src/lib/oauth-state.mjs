import {timingSafeEqual} from "node:crypto";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NONCE=/^[A-Za-z0-9_-]{40,80}$/;
export function packOAuthState({provider,projectId,nonce}){
 if(typeof provider!=="string"||!UUID.test(projectId)||!NONCE.test(nonce))throw Error("Invalid OAuth state");
 return Buffer.from(JSON.stringify({provider,projectId,nonce}),"utf8").toString("base64url");
}
export function parseOAuthState(cookie,returned,allowed){
 if(typeof cookie!=="string"||cookie.length>1200||typeof returned!=="string"||!Array.isArray(allowed))return null;
 try{
  const obj=JSON.parse(Buffer.from(cookie,"base64url").toString("utf8"));
  if(!obj||typeof obj!=="object"||!allowed.includes(obj.provider)||!UUID.test(obj.projectId)||!NONCE.test(obj.nonce))return null;
  const a=Buffer.from(obj.nonce,"utf8"),b=Buffer.from(returned,"utf8");
  if(a.length!==b.length||!timingSafeEqual(a,b))return null;
  return {provider:obj.provider,projectId:obj.projectId,nonce:obj.nonce};
 }catch{return null}
}
