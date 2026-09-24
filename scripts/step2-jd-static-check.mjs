import { spawnSync } from 'node:child_process';

const files=[
  'lib/jd-contract.mjs',
  'lib/jd-ai.mjs',
  'lib/jd-ai-server.js',
  'lib/jd.js',
  'lib/jd-document-parser.js',
  'app/api/requirements/jd/route.js',
  'app/api/requirements/jd/upload/route.js',
  'app/api/requirements/jd/document/route.js',
  'scripts/jd-test-helpers.mjs',
  'scripts/step2-jd-unit-tests.mjs',
  'scripts/step2-jd-integration-tests.mjs',
  'scripts/step2-jd-e2e-tests.mjs',
  'scripts/step2-jd-security-tests.mjs',
  'scripts/step2-jd-regression-tests.mjs',
];
for(const file of files){
  const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
console.log(`STEP2_JD_STATIC_PASS files=${files.length} syntax=true`);
