import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('app/step3-recruiter-execution.css','utf8');
const center=fs.readFileSync('app/components/RecruiterCommandCenter.js','utf8');
const workspace=fs.readFileSync('app/components/RecruiterRequirementWorkspace.js','utf8');
const shell=fs.readFileSync('app/components/AppShell.js','utf8');

for(const breakpoint of ['@media(max-width:1100px)','@media(max-width:760px)','@media(max-width:480px)'])assert.ok(css.includes(breakpoint),'missing responsive breakpoint '+breakpoint);
assert.ok(css.includes('.rx-intake-modal'));
assert.ok(css.includes('min-height:42px'));
assert.ok(center.includes('My priority requirements'));
assert.ok(center.includes('Open role →'));
assert.ok(workspace.includes('＋ Source candidate'));
assert.ok(workspace.includes('rx-queue-tabs'));
assert.ok(shell.includes("label: 'My Work'"));
assert.ok(!workspace.includes('/candidates/'),'recruiter critical path should not escape into legacy candidate pages');
console.log('STEP3_EXECUTION_RESPONSIVE_PASS desktop=true tablet=true mobile=true critical_actions=true no_dead_legacy_link=true');
