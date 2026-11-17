// Shared, directly testable URL/IP checks. No browser or secret access.
import {isIP} from "node:net";

export function isPublicIPv4(address){
 if(isIP(address)!==4)return false;
 const [a,b,c]=address.split(".").map(Number);
 if(a===0||a===10||a===127||a>=224)return false;
 if(a===169&&b===254)return false;
 if(a===172&&b>=16&&b<=31)return false;
 if(a===192&&b===168)return false;
 if(a===100&&b>=64&&b<=127)return false;
 if(a===198&&b>=18&&b<=19)return false;
 if(a===192&&b===0&&c===0)return false;
 if(a===192&&b===0&&c===2)return false;
 if(a===192&&b===88&&c===99)return false;
 if(a===198&&b===51&&c===100)return false;
 if(a===203&&b===0&&c===113)return false;
 return true;
}
export function parsePublicHttpsUrl(raw){
 const url=new URL(raw);
 if(url.protocol!=="https:"||url.username||url.password||url.port||
    !url.hostname.includes(".")||url.hostname.length>253||isIP(url.hostname)>0)
  throw new Error("Chỉ chấp nhận website HTTPS công khai, không có IP, tài khoản hoặc port tùy chỉnh.");
 return url;
}
