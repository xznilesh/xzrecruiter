export function mutationRequestIsTrusted(req){
  const origin=String(req?.headers?.get?.('origin')||'');
  if(origin&&origin!==req.nextUrl.origin)return false;

  const fetchSite=String(req?.headers?.get?.('sec-fetch-site')||'').toLowerCase();
  if(fetchSite&&fetchSite!=='same-origin'&&fetchSite!=='none')return false;

  if(!origin){
    const referer=String(req?.headers?.get?.('referer')||'');
    if(referer){
      try{if(new URL(referer).origin!==req.nextUrl.origin)return false;}
      catch{return false;}
    }
  }
  return true;
}

export function declaredBodyWithin(req,maxBytes){
  const raw=req?.headers?.get?.('content-length');
  if(!raw)return true;
  const size=Number(raw);
  return Number.isFinite(size)&&size>=0&&size<=Number(maxBytes);
}
