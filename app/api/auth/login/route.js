import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createSession, hashPassword, constantEqual, normalizeEmail } from '@/lib/auth';

export async function POST(req){
  let body; try{body=await req.json();}catch{return NextResponse.json({error:'Invalid request.'},{status:400});}
  const email=normalizeEmail(body.email), password=String(body.password||'');
  const r=await query(`select u.id,c.password_hash,c.password_salt from users u join user_credentials c on c.user_id=u.id where lower(u.email)=lower($1) limit 1`,[email]);
  const row=r.rows[0];
  if(!row || !constantEqual(hashPassword(password,row.password_salt),row.password_hash)) return NextResponse.json({error:'Email or password is incorrect.'},{status:401});
  await createSession(row.id);
  return NextResponse.json({ok:true});
}
