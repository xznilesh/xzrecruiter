import { redirect } from 'next/navigation';
import { getRecruiterHome } from '@/lib/recruiter';

export async function redirectRecruiterFromLegacyWorkspace(){
  const context=await getRecruiterHome(1).catch(()=>null);
  if(context?.business_role==='RECRUITER')redirect('/recruiter');
  return context;
}
