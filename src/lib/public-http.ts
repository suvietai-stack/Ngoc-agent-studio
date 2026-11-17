import "server-only";
import {request} from "node:https";
import {lookup} from "node:dns/promises";
import {parsePublicHttpsUrl,isPublicIPv4} from "@/lib/network-safety.mjs";

type SafeResponse={status:number;contentType:string;body:Buffer;};
export async function publicHttpsGet(raw:string,options:{maxBytes:number;timeoutMs:number;headers?:Record<string,string>}):Promise<SafeResponse>{
 const url=parsePublicHttpsUrl(raw);
 // DNS is checked immediately before TLS and pinned for the actual request, defeating DNS rebinding.
 const addresses=await lookup(url.hostname,{family:4,all:true,verbatim:true});
 if(!addresses.length||addresses.some(a=>!isPublicIPv4(a.address)))
  throw new Error("Website không có IPv4 công khai hợp lệ.");
 const address=addresses[0].address;
 return new Promise((resolve,reject)=>{
  let total=0,settled=false;
  const fail=(err:Error)=>{if(settled)return;settled=true;reject(err);};
  const req=request(url,{
   method:"GET",servername:url.hostname,rejectUnauthorized:true,timeout:options.timeoutMs,
   lookup:(_host,_opts,callback)=>callback(null,address,4),
   headers:{"User-Agent":"NgocAgentStudio/1.0",Accept:"text/html,application/json",...options.headers}
  },res=>{
   const status=res.statusCode||0;
   if(status>=300&&status<400){res.destroy();fail(new Error("Website đang chuyển hướng; chỉ cho phép HTTPS URL đích."));return;}
   if(Number(res.headers["content-length"]||0)>options.maxBytes){res.destroy();fail(new Error("Nội dung vượt giới hạn đọc."));return;}
   const chunks:Buffer[]=[];
   res.on("data",(chunk:Buffer)=>{
    total+=chunk.length;
    if(total>options.maxBytes){res.destroy();fail(new Error("Nội dung vượt giới hạn đọc."));return;}
    chunks.push(chunk);
   });
   res.on("end",()=>{if(settled)return;settled=true;resolve({status,contentType:String(res.headers["content-type"]||""),body:Buffer.concat(chunks)});});
   res.on("error",fail);
  });
  req.on("error",fail);
  req.on("timeout",()=>req.destroy(new Error("Hết thời gian kết nối website.")));
  req.end();
 });
}
