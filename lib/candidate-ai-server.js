import { analyzeCandidateWithProvider } from './candidate-ai.mjs';
import { callOpenAiStructured,jdAiConfigured } from './jd-ai-server';

const DEFAULT_MODEL=process.env.XZRECRUITER_CANDIDATE_MODEL||process.env.XZRECRUITER_JD_MODEL||'gpt-5.6-terra';

export function candidateAiConfigured(){return jdAiConfigured()}

export async function analyzeCandidateServer({resumeText='',candidateProfile={},requirementContext={},model=DEFAULT_MODEL}={}){
  if(!candidateAiConfigured())throw Object.assign(new Error('candidate_ai_not_configured'),{code:'candidate_ai_not_configured'});
  try{
    return await analyzeCandidateWithProvider({
      resumeText,candidateProfile,requirementContext,model,callModel:callOpenAiStructured,maxAttempts:2,
    });
  }catch(error){
    if(error?.code==='jd_ai_not_configured')throw Object.assign(new Error('candidate_ai_not_configured'),{code:'candidate_ai_not_configured'});
    if(error?.code==='jd_ai_timeout')throw Object.assign(new Error('candidate_ai_timeout'),{code:'candidate_ai_timeout',retryable:true});
    throw error;
  }
}
