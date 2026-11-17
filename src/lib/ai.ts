import "server-only";

type MessageContent={type?:string;text?:string};
type ResponseItem={type?:string;content?:MessageContent[]};
type ModelResponse={output?:ResponseItem[];output_text?:string;usage?:{input_tokens?:number;output_tokens?:number};error?:{message?:string}};

export const aiReady=()=>Boolean(process.env.OPENAI_API_KEY?.trim());

export async function generateText(instructions:string,input:string,requestedModel?:string):Promise<{text:string;model:string;usage?:{input_tokens:number;output_tokens:number}}>{
 const key=process.env.OPENAI_API_KEY;
 if(!key)throw new Error("AI chưa kích hoạt: cần thêm OPENAI_API_KEY trong Vercel → Environment Variables và triển khai lại.");
 if(input.length>24000)throw new Error("Nội dung đầu vào quá dài.");
 const model=requestedModel&&/^gpt-[a-zA-Z0-9.-]{3,40}$/.test(requestedModel)?requestedModel:"gpt-4.1-mini";
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),45000);
 try{
  const response=await fetch("https://api.openai.com/v1/responses",{
   method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},
   body:JSON.stringify({model,store:false,max_output_tokens:1700,
    instructions:instructions.slice(0,14000),
    input:input.slice(0,24000)}),
   signal:controller.signal,cache:"no-store"
  });
  const data=await response.json() as ModelResponse;
  if(!response.ok)throw new Error(response.status===401?"OPENAI_API_KEY không hợp lệ.":response.status===429?"AI hết hạn mức hoặc đang bị giới hạn; kiểm tra billing.":`AI API lỗi HTTP ${response.status}.`);
  const textOut=data.output_text||data.output?.filter(x=>x.type==="message").flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text||"").join("\n")||"";
  if(!textOut.trim())throw new Error("AI không trả nội dung; hãy thử lại.");
  const usage=data.usage&&Number.isInteger(data.usage.input_tokens)&&Number.isInteger(data.usage.output_tokens)
   ?{input_tokens:Math.max(0,data.usage.input_tokens!),output_tokens:Math.max(0,data.usage.output_tokens!)}
   :undefined;
  return {text:textOut.trim(),model,usage};
 }catch(e){
  if(e instanceof Error&&e.name==="AbortError")throw new Error("AI phản hồi quá lâu, hãy thử lại.");
  throw e;
 }finally{clearTimeout(timer)}
}
