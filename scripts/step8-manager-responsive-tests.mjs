import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('app/step8-manager-control.css','utf8');
const manager=fs.readFileSync('app/components/ManagerControlCenter.js','utf8');
const requirement=fs.readFileSync('app/components/ManagerRequirementControl.js','utf8');
const notifications=fs.readFileSync('app/components/AutomationNotificationCenter.js','utf8');

for(const bp of ['@media(max-width:1180px)','@media(max-width:900px)','@media(max-width:800px)','@media(max-width:520px)'])
  assert.ok(css.includes(bp),'responsive breakpoint missing '+bp);
assert.ok(css.includes('overflow:auto'),'wide manager tables must remain usable without layout breakage');
assert.ok(css.includes('.mc-heading-actions{display:grid;grid-template-columns:1fr;width:100%}'),'mobile heading actions must stack');
assert.ok(css.includes('.mc-row-actions{display:grid;grid-template-columns:1fr}'),'mobile operational actions must become full-width');

assert.ok(manager.includes('setInterval(()=>refresh({silent:true}),30000)'),'manager dashboard near-real-time refresh missing');
assert.ok(requirement.includes('setInterval(()=>refresh({silent:true}),30000)'),'requirement manager refresh missing');
assert.ok(notifications.includes('setInterval(()=>refresh({silent:true}),30000)'),'notification center refresh missing');

for(const ui of [manager,requirement,notifications]){
  assert.ok(ui.includes('role="status"')||ui.includes("role={'status'}"),'loading/error success feedback must remain accessible');
}
assert.ok(manager.includes('No open manager exceptions.')&&manager.includes('No active requirements.'),'manager empty states missing');
assert.ok(requirement.includes('No active recruiter assignment.')&&requirement.includes('No open exceptions.'),'requirement empty states missing');
assert.ok(notifications.includes('No active notifications in this filter.'),'notification empty state missing');

console.log('STEP8_MANAGER_RESPONSIVE_PASS desktop=true tablet=true mobile=true polling=true empty_states=true');
