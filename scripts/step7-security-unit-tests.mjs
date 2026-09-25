import assert from 'node:assert/strict';
import {
  ROLE_PERMISSIONS,DATA_CLASSIFICATION,canonicalRole,hasPermission,
  classificationAtLeast,permissionForDocument
} from '../lib/security-policy.mjs';
import {
  validatePrivateUpload,normalizeUploadFilename,assertSafeStoragePath
} from '../lib/file-security.js';
import {
  mutationRequestIsTrusted,declaredBodyWithin,safeRequestId
} from '../lib/request-security.js';
import {
  neutralizeSpreadsheetFormula,escapeCsvCell,rowsToCsv
} from '../lib/csv.js';

assert.equal(canonicalRole('bdm'),'ACCOUNT_MANAGER');
assert.equal(canonicalRole('business_development'),'ACCOUNT_MANAGER');
assert.equal(canonicalRole('sourcer'),'RECRUITER');
assert.equal(hasPermission('RECRUITER','candidate:view'),true);
assert.equal(hasPermission('RECRUITER','commercial:view'),false);
assert.equal(hasPermission('ACCOUNT_MANAGER','submission:am_review'),true);
assert.equal(hasPermission('ACCOUNT_MANAGER','submission:client_submit'),true);
assert.equal(hasPermission('COMPLIANCE_REVIEWER','document:sensitive_view'),true);
assert.equal(hasPermission('CLIENT_USER','candidate:view'),false);
assert.deepEqual(ROLE_PERMISSIONS.CLIENT_USER,[]);
assert.ok(DATA_CLASSIFICATION.HIGHLY_SENSITIVE);
assert.equal(classificationAtLeast('HIGHLY_SENSITIVE','CONFIDENTIAL'),true);
assert.equal(classificationAtLeast('INTERNAL','HIGHLY_SENSITIVE'),false);
assert.equal(permissionForDocument({documentType:'RESUME'}),'document:resume_view');
assert.equal(permissionForDocument({documentType:'WORK_AUTHORIZATION',classification:'HIGHLY_SENSITIVE'}),'document:sensitive_view');

const pdf=Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n');
assert.equal(validatePrivateUpload({bytes:pdf,mimeType:'application/pdf',filename:'resume.pdf'}).mimeType,'application/pdf');
assert.throws(()=>validatePrivateUpload({bytes:pdf,mimeType:'application/pdf',filename:'resume.exe'}),/file_extension_mismatch/);
assert.throws(()=>validatePrivateUpload({bytes:Buffer.from('not a pdf'),mimeType:'application/pdf',filename:'resume.pdf'}),/file_content_mismatch/);
assert.throws(()=>assertSafeStoragePath('../tenant-b/resume.pdf'),/unsafe_storage_path/);
assert.throws(()=>assertSafeStoragePath('%2e%2e/tenant-b/resume.pdf'),/unsafe_storage_path/);
assert.ok(!normalizeUploadFilename('../../evil<script>.pdf').includes('/'));
assert.equal(validatePrivateUpload({bytes:Buffer.from('safe plain text'),mimeType:'text/plain',filename:'note.txt'}).extension,'txt');

function req({origin='https://app.example.com',site='same-origin',referer='',length='100'}={}){
  const map=new Map([
    ['origin',origin],['sec-fetch-site',site],['referer',referer],['content-length',length]
  ]);
  return {headers:{get:(k)=>map.get(k)||''},nextUrl:new URL('https://app.example.com/api/test')};
}
assert.equal(mutationRequestIsTrusted(req()),true);
assert.equal(mutationRequestIsTrusted(req({origin:'https://evil.example'})),false);
assert.equal(mutationRequestIsTrusted(req({origin:'',site:'cross-site'})),false);
assert.equal(mutationRequestIsTrusted(req({origin:'',site:'same-origin',referer:'https://evil.example/form'})),false);
assert.equal(declaredBodyWithin(req({length:'1024'}),2048),true);
assert.equal(declaredBodyWithin(req({length:'4096'}),2048),false);
assert.match(safeRequestId(req()),/^[A-Za-z0-9._:-]{8,100}$/);

for(const value of ['=2+3','+CMD','-10+20','@SUM(A1:A2)','  =HYPERLINK("x")','\t=1+1']){
  assert.ok(neutralizeSpreadsheetFormula(value).startsWith("'"),'formula-like CSV value must be neutralized');
}
assert.equal(escapeCsvCell('normal'),'normal');
assert.equal(escapeCsvCell('a,b'),'"a,b"');
const csv=rowsToCsv(['name','value'],[{name:'Alice',value:'=1+1'}]);
assert.ok(csv.includes("'=1+1"));

console.log('STEP7_SECURITY_UNIT_PASS rbac=true classification=true uploads=true csrf=true request_limits=true csv=true');
