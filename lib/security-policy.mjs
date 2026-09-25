export const DATA_CLASSIFICATION=Object.freeze({
  PUBLIC_LOW:'PUBLIC_LOW',
  INTERNAL:'INTERNAL',
  CONFIDENTIAL:'CONFIDENTIAL',
  HIGHLY_SENSITIVE:'HIGHLY_SENSITIVE'
});

export const ROLE_PERMISSIONS=Object.freeze({
  OWNER:Object.freeze(['*']),
  ADMIN:Object.freeze(['*']),
  RECRUITMENT_MANAGER:Object.freeze([
    'requirement:create','requirement:approve','requirement:assign',
    'candidate:view','candidate:edit','candidate:screen',
    'submission:create',
    'document:resume_view','document:review',
    'audit:view'
  ]),
  ACCOUNT_MANAGER:Object.freeze([
    'requirement:create','requirement:approve','requirement:assign',
    'candidate:view',
    'submission:am_review','submission:client_submit',
    'commercial:view','commercial:edit',
    'document:resume_view','document:sensitive_view','document:review',
    'audit:view'
  ]),
  RECRUITER:Object.freeze([
    'candidate:view','candidate:edit','candidate:screen',
    'submission:create',
    'document:resume_view'
  ]),
  COMPLIANCE_REVIEWER:Object.freeze([
    'candidate:view',
    'document:resume_view','document:sensitive_view','document:review',
    'audit:view'
  ]),
  CLIENT_USER:Object.freeze([])
});

export function canonicalRole(role){
  const value=String(role||'').trim().toUpperCase();
  if(value==='BUSINESS_DEVELOPMENT'||value==='BDM')return 'ACCOUNT_MANAGER';
  if(value==='SOURCER')return 'RECRUITER';
  return value;
}

export function hasPermission(role,permission){
  const canonical=canonicalRole(role);
  const permissions=ROLE_PERMISSIONS[canonical]||[];
  const target=String(permission||'').trim().toLowerCase();
  return permissions.includes('*')||permissions.includes(target);
}

export function classificationAtLeast(actual,minimum){
  const order={PUBLIC_LOW:0,INTERNAL:1,CONFIDENTIAL:2,HIGHLY_SENSITIVE:3};
  return Number.isInteger(order[actual])&&Number.isInteger(order[minimum])&&order[actual]>=order[minimum];
}

export function permissionForDocument({documentType='',classification='HIGHLY_SENSITIVE'}={}){
  const type=String(documentType||'').trim().toUpperCase();
  if(type==='RESUME')return 'document:resume_view';
  return classificationAtLeast(String(classification||'HIGHLY_SENSITIVE').toUpperCase(),'HIGHLY_SENSITIVE')
    ?'document:sensitive_view'
    :'document:resume_view';
}
