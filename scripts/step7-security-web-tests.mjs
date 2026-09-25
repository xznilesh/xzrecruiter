import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spreadsheetSafeValue,csvCell} from '../lib/csv.js';
import {mutationRequestIsTrusted,declaredBodyWithin} from '../lib/request-security.js';

for(const dangerous of ['=1+1','+SUM(A1:A2)','-10+20','@cmd','\t=1','\r=1','   =HYPERLINK("x")']){
  assert.ok(spreadsheetSafeValue(dangerous).startsWith("'"),'CSV formula-like value must be neutralized: '+JSON.stringify(dangerous));
}
assert.equal(spreadsheetSafeValue('Normal text'),'Normal text');
assert.ok(csvCell('a"b').includes('""'),'CSV quote escaping missing');

const appFiles=[];
function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap((e)=>{
    const p=path.join(dir,e.name);return e.isDirectory()?walk(p):[p];
  });
}
for(const file of walk('app').filter((p)=>/\.(js|jsx|mjs)$/.test(p))){
  const c=fs.readFileSync(file,'utf8');
  if(c.includes('dangerouslySetInnerHTML'))appFiles.push(file);
}
assert.deepEqual(appFiles,[],'untrusted app content must not use dangerouslySetInnerHTML');

const config=fs.readFileSync('next.config.mjs','utf8');
for(const token of [
  "default-src 'self'","object-src 'none'","frame-ancestors 'none'","base-uri 'self'",
  "X-Content-Type-Options","X-Frame-Options","Referrer-Policy","Permissions-Policy",
  "Cross-Origin-Opener-Policy","Strict-Transport-Security"
])assert.ok(config.includes(token),'security header/CSP control missing: '+token);

function req({origin='https://app.example',fetchSite='same-origin',referer='',length='100'}={}){
  const map=new Map([['origin',origin],['sec-fetch-site',fetchSite],['referer',referer],['content-length',length]]);
  return {headers:{get:(k)=>map.get(k)||''},nextUrl:{origin:'https://app.example'}};
}
assert.equal(mutationRequestIsTrusted(req()),true);
assert.equal(mutationRequestIsTrusted(req({origin:'https://evil.example'})),false);
assert.equal(mutationRequestIsTrusted(req({origin:'',fetchSite:'cross-site'})),false);
assert.equal(mutationRequestIsTrusted(req({origin:'',fetchSite:'',referer:'https://evil.example/x'})),false);
assert.equal(declaredBodyWithin(req({length:'1000'}),1024),true);
assert.equal(declaredBodyWithin(req({length:'2000'}),1024),false);

console.log('STEP7_WEB_SECURITY_PASS xss=true csv_formula=true csrf=true payload_bounds=true headers=true');
