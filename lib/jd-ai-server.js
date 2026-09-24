import { analyzeJdWithProvider } from './jd-ai.mjs';

const API_URL=process.env.OPENAI_RESPONSES_URL || 'https://api.openai.com/v1/responses';
const API_KEY=process.env.OPENAI_API_KEY || '';
const DEFAULT_MODEL=process.env.XZRECRUITER_JD_MODEL || 'gpt-5.6-terra';
const TIMEOUT_MS=Math.max(5000,Math.min(Number(process.env.XZRECRUITER_JD_TIMEOUT_MS||45000),90000));

function sleep(ms){return new Promise((resolve)=>setTimeout(resolve,ms))}

function outputTextFromResponse(data){
  if(typeof data?.output_text==='string') return data.output_text;
  for(const item of Array.isArray(data?.output)?data.output:[]){
    for(const content of Array.isArray(item?.content)?item.content:[]){
      if(typeof content?.text==='string'&&content.text.trim()) return content.text;
    }
  }
  return '';
}

export function jdAiConfigured(){
  return Boolean(API_KEY && API_URL);
}

export async function callOpenAiStructured(request,{attempt=1}={}){
  if(!jdAiConfigured()) throw Object.assign(new Error('jd_ai_not_configured'),{code:'jd_ai_not_configured'});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const response=await fetch(API_URL,{
      method:'POST',
      headers:{
        authorization:`Bearer ${API_KEY}`,
        'content-type':'application/json',
      },
      body:JSON.stringify(request),
      signal:controller.signal,
      cache:'no-store',
    });
    const data=await response.json().catch(()=>null);
    if(!response.ok){
      const error=Object.assign(new Error(`jd_ai_http_${response.status}`),{
        code:`jd_ai_http_${response.status}`,
        status:response.status,
        retryable:response.status===408||response.status===409||response.status===429||response.status>=500,
      });
      if(error.retryable && attempt<3) await sleep(attempt===1?500:1500);
      throw error;
    }
    return {
      ...data,
      output_text:outputTextFromResponse(data),
    };
  }catch(error){
    if(error?.name==='AbortError') throw Object.assign(new Error('jd_ai_timeout'),{code:'jd_ai_timeout',retryable:true});
    throw error;
  }finally{
    clearTimeout(timer);
  }
}

export async function analyzeJdServer({jdText,sourceMeta={},model=DEFAULT_MODEL}={}){
  return analyzeJdWithProvider({
    jdText,
    sourceMeta,
    model,
    callModel:callOpenAiStructured,
    maxAttempts:2,
  });
}
