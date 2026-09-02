import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';

const COOKIE='xz_session';
const ITERATIONS=210000;

export function normalizeEmail(v=''){ return String(v).trim().toLowerCase(); }
export function hashPassword(password, saltHex){ return crypto.pbkdf2Sync(password, Buffer.from(saltHex,'hex'), ITERATIONS, 64, 'sha512').toString('hex'); }
export function makePassword(password){ const salt=crypto.randomBytes(18).toString('hex'); return { salt, hash:hashPassword(password,salt) }; }
export function constantEqual(a,b){ const x=Buffer.from(String(a)); const y=Buffer.from(String(b)); return x.length===y.length && crypto.timingSafeEqual(x,y); }
export function tokenHash(token){ return crypto.createHash('sha256').update(token).digest('hex'); }

export async function createSession(userId){
  const token=crypto.randomBytes(32).toString('base64url');
  const id=crypto.randomUUID();
  await query('insert into user_sessions (id,user_id,token_hash,expires_at) values ($1,$2,$3,now()+interval \'30 days\')',[id,userId,tokenHash(token)]);
  const store=await cookies();
  store.set(COOKIE,token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*24*30});
  return token;
}

export async function destroySession(){
  const store=await cookies();
  const token=store.get(COOKIE)?.value;
  if(token){ try{ await query('update user_sessions set revoked_at=now() where token_hash=$1 and revoked_at is null',[tokenHash(token)]); }catch{} }
  store.set(COOKIE,'',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0});
}

export async function getCurrentUser(){
  const store=await cookies();
  const token=store.get(COOKIE)?.value;
  if(!token) return null;
  const r=await query(`select u.id,u.email,u.display_name,a.id as agency_id,a.name as agency_name,am.role
    from user_sessions s join users u on u.id=s.user_id
    join agency_memberships am on am.user_id=u.id
    join agencies a on a.id=am.agency_id
    where s.token_hash=$1 and s.revoked_at is null and s.expires_at>now()
    order by am.created_at asc limit 1`,[tokenHash(token)]);
  if(!r.rows[0]) return null;
  query('update user_sessions set last_seen_at=now() where token_hash=$1',[tokenHash(token)]).catch(()=>{});
  return r.rows[0];
}
