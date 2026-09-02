import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createSession, makePassword, normalizeEmail } from '@/lib/auth';

export async function POST(req){
  let body; try{ body=await req.json(); }catch{ return NextResponse.json({error:'Invalid request.'},{status:400}); }
  const email=normalizeEmail(body.email), password=String(body.password||''), name=String(body.name||'').trim(), agency=String(body.agency||'').trim();
  if(!name || !agency || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({error:'Name, agency and a valid email are required.'},{status:400});
  if(password.length<12) return NextResponse.json({error:'Use a password with at least 12 characters.'},{status:400});
  const client=await db().connect();
  let userId;
  try{
    await client.query('begin');
    const existing=await client.query('select id from users where lower(email)=lower($1) limit 1',[email]);
    if(existing.rowCount){ await client.query('rollback'); return NextResponse.json({error:'An account with this email already exists.'},{status:409}); }
    userId=crypto.randomUUID(); const agencyId=crypto.randomUUID(); const p=makePassword(password);
    await client.query('insert into users (id,email,display_name) values ($1,$2,$3)',[userId,email,name]);
    await client.query('insert into user_credentials (user_id,password_hash,password_salt) values ($1,$2,$3)',[userId,p.hash,p.salt]);
    await client.query("insert into agencies (id,name,country,timezone,onboarding_status) values ($1,$2,'IN','Asia/Kolkata','IN_PROGRESS')",[agencyId,agency]);
    await client.query("insert into agency_memberships (agency_id,user_id,role) values ($1,$2,'OWNER')",[agencyId,userId]);
    await client.query('commit');
  }catch(e){ await client.query('rollback').catch(()=>{}); console.error('signup_failed',e?.message); return NextResponse.json({error:'Could not create the workspace. Please try again.'},{status:500}); }
  finally{ client.release(); }
  await createSession(userId);
  return NextResponse.json({ok:true});
}
