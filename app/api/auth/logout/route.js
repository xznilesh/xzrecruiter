import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';
import { mutationRequestIsTrusted } from '@/lib/request-security';

export async function POST(req) {
  if(!mutationRequestIsTrusted(req))return NextResponse.json({error:'invalid_origin'},{status:403});
  await destroySession();
  return NextResponse.redirect(new URL('/login', req.url), 303);
}
