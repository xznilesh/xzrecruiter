import { spawnSync } from 'node:child_process';

const files=[
  'lib/candidate-ai-contract.mjs',
  'lib/candidate-ai.mjs',
  'lib/candidate-ai-server.js',
  'lib/candidate-intelligence.js',
  'lib/candidate-intelligence.mjs',
  'app/api/candidate-intelligence/route.js',
  'scripts/step4-candidate-intelligence-test-helpers.mjs',
  'scripts/step4-candidate-intelligence-unit-tests.mjs',
  'scripts/step4-candidate-intelligence-integration-tests.mjs',
  'scripts/step4-candidate-intelligence-e2e-tests.mjs',
  'scripts/step4-candidate-intelligence-regression-tests.mjs',
  'scripts/step4-candidate-intelligence-security-tests.mjs',
  'scripts/step4-candidate-intelligence-concurrency-tests.mjs',
  'scripts/step4-candidate-intelligence-performance-tests.mjs',
  'scripts/step4-candidate-intelligence-responsive-tests.mjs'
];
for(const file of files){
  const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
console.log('STEP4_CANDIDATE_STATIC_PASS files='+files.length+' syntax=true');
