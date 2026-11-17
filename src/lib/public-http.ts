import "server-only";
import {request} from "node:https";
import {lookup} from "node:dns/promises";
import {parsePublicHttpsUrl,isPublicIPv4} from "@/lib/network-safety.mjs";

export type SafeResponse={status:number;contentType:string;body:Buffer};
type RequestOptions={maxBytes:number;timeoutMs:number;headers?:Record<string,string>;method?:"GET"|"POST";jsonBody?:unknown};
/** HTTPS only, public-IP DNS verification, IP pinned during TLS, redirects disabled. */
export async function publicHttpsRequest(raw:string,options:RequestOptions):Promise<SafeResponse>{
 const url=parsePublicHttpsUrl(raw);
 const addresses=await lookup(url.hostname,{family:4,all:true,verbatim:true});
 if(!addresses.length||addresses.some(a=>!isPublicIPv4(a.address)))
  throw new Error("Website không có IPv4 công khai hợp lệ.");
 const address=addresses[0].address;
 const data=options.jsonBody===undefined?undefined:Buffer.from(JSON.stringify(options.jsonBody),"utf8");
 if(data&&data.length>180000)throw new Error("Bản sửa WordPress vượt giới hạn kích thước an toàn.");
 if(options.method==="GET"&&data)throw new Error("GET không được chứa nội dung cập nhật.");
 return new Promise((resolve,reject)=>{
  let total=0,settled=false;
  const fail=(err:Error)=>{if(settled)return;settled=true;reject(err);};
  const req=request(url,{
   method:options.method||"GET",servername:url.hostname,rejectUnauthorized:true,timeout:options.timeoutMs,
   // Node 22 must use the single validated IPv4 returned by our pinned callback.
   family:4,
   lookup:(_host,_opts,callback)=>callback(null,address,4),
   headers:{"User-Agent":"NgocAgentStudio/1.0",Accept:"application/json,text/html",
    ...(data?{"Content-Type":"application/json","Content-Length":String(data.length)}:{}),...options.headers}
  },res=>{
   const status=res.statusCode||0;
   if(status>=300&&status<400){res.destroy();fail(new Error("Website chuyển hướng, không tự gửi quyền WordPress đến địa chỉ khác."));return;}
   if(Number(res.headers["content-length"]||0)>options.maxBytes){res.destroy();fail(new Error("Phản hồi vượt giới hạn an toàn."));return;}
   const chunks:Buffer[]=[];
   res.on("data",(chunk:Buffer)=>{
    total+=chunk.length;
    if(total>options.maxBytes){res.destroy();fail(new Error("Phản hồi vượt giới hạn an toàn."));return;}
    chunks.push(chunk);
   });
   res.on("end",()=>{if(settled)return;settled=true;resolve({status,contentType:String(res.headers["content-type"]||""),body:Buffer.concat(chunks)});});
   res.on("error",fail);
  });
  req.on("error",fail);
  req.on("timeout",()=>req.destroy(new Error("Hết thời gian kết nối website.")));
  if(data)req.write(data);
  req.end();
 });
}
export function publicHttpsGet(raw:string,options:{maxBytes:number;timeoutMs:number;headers?:Record<string,string>}):Promise<SafeResponse>{
 return publicHttpsRequest(raw,{...options,method:"GET"});
}
