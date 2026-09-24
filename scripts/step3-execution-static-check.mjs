import { spawnSync } from 'node:child_process';

const files=[
  'lib/recruiter-execution.mjs',
  'lib/recruiter.js',
  'lib/recruiter-access.js',
  'app/api/recruiter/route.js',
  'app/api/recruiter/resume/route.js'
];
for(const file of files){
  const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
console.log('STEP3_EXECUTION_STATIC_PASS files='+files.length+' syntax=true');
