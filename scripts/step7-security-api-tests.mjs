import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap((entry)=>{
    const p=path.join(dir,entry.name);
    return entry.isDirectory()?walk(p):[p];
  });
}
const routes=walk('app/api').filter((p)=>p.endsWith('route.js'));
assert.ok(routes.length>=20,'expected production API surface');

const findings=[];
for(const file of routes){
  const c=fs.readFileSync(file,'utf8');
  const methods=[...c.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)/g)].map((m)=>m[1]);
  const mutates=methods.some((m)=>m!=='GET');
  const parsesBody=/req\.(json|formData)\s*\(/.test(c);
  const isHealth=file.includes('/health/');
  if(mutates&&!isHealth){
    assert.ok(c.includes('mutationRequestIsTrusted(req)'),`${file}: mutation route must enforce request integrity/CSRF boundary`);
  }
  if(parsesBody&&!file.endsWith('auth/logout/route.js')){
    assert.ok(c.includes('declaredBodyWithin(req')||(/MAX_BYTES/.test(c)&&/content-length/i.test(c)),`${file}: request body must be bounded before parsing`);
  }
  if(file.includes('/public/')&&methods.includes('POST')){
    assert.ok(c.includes('consumeRateLimit('),`${file}: public mutation must use durable rate limiting`);
  }
  if(/auth\/(login|signup|password-reset|resend-verification|verify-email)\/route\.js$/.test(file)){
    assert.ok(c.includes('consumeRateLimit('),`${file}: auth abuse surface must be rate limited`);
  }
  if(file.endsWith('/submissions/route.js')){
    assert.ok(c.includes("action==='generate'")&&c.includes('consumeRateLimit('),'submission generation/client release must be throttled');
    assert.ok(c.includes('expectedVersion')&&c.includes('expectedLock'),'submission mutation must carry optimistic concurrency guards');
  }
  assert.ok(!/NextResponse\.json\([^\n]*(error\?\.details|error\.details|error\?\.stack|error\.stack)/.test(c),`${file}: public error response must not expose internal details/stack`);
  findings.push({file,methods,mutates});
}
console.log(`STEP7_API_SECURITY_PASS routes=${routes.length} csrf=true body_limits=true public_rate_limits=true safe_errors=true`);
