import { notFound } from 'next/navigation';
import Brand from '@/app/components/Brand';
import PublicApplyForm from '@/app/components/PublicApplyForm';
import { rpc } from '@/lib/supabase-api';

export const dynamic='force-dynamic';

export default async function PublicJobPage({params}){
 const {slug}=await params; const result=await rpc('xzrecruiter_public_job',{p_slug:slug}).catch(()=>null); if(!result?.ok||!result.job)notFound(); const j=result.job;
 return <main className="public-job"><header><Brand/><span className="status good">Open role</span></header><section className="public-job-hero"><span className="page-kicker">Recruitment opportunity</span><h1>{j.title}</h1><p>{[j.location,j.city,j.region,j.country_code].filter(Boolean).join(' · ')}</p><div className="public-job-facts"><span>{j.workplace_type||'Workplace flexible'}</span><span>{j.employment_type||'Employment type flexible'}</span>{j.salary_min?<span>{j.salary_currency} {Number(j.salary_min).toLocaleString()}{j.salary_max?` – ${Number(j.salary_max).toLocaleString()}`:''} {j.salary_period||''}</span>:null}</div></section><section className="public-job-grid"><article><h2>About the role</h2><div className="job-copy">{j.description||'The recruitment team will share the full role brief during the process.'}</div></article><aside><h2>Apply</h2><PublicApplyForm slug={slug} job={j}/></aside></section></main>
}
