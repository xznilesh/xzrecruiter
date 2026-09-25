import { NextResponse } from 'next/server';
import { safeRequestId } from '@/lib/request-security';

export function proxy(request){
  const requestId=safeRequestId(request);
  const headers=new Headers(request.headers);
  headers.set('x-request-id',requestId);
  const response=NextResponse.next({request:{headers}});
  response.headers.set('x-request-id',requestId);
  return response;
}

export const config={
  matcher:['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)']
};
