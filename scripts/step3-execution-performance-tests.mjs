import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync('supabase/migrations/20260926_step3_recruiter_execution_workspace.sql','utf8');
const workspace=fs.readFileSync('app/components/RecruiterRequirementWorkspace.js','utf8');

for(const index of [
  'idx_xzr_requirement_assignments_recruiter',
  'idx_xzr_requirement_assignments_job',
  'idx_xzr_applications_recruiter_queue',
  'idx_xzr_recruiter_tasks_due',
  'idx_xzr_recruiter_tasks_job'
])assert.ok(sql.includes(index),'missing performance index '+index);

assert.ok(sql.includes('least(coalesce(p_limit,50),100)'),'dashboard/queue limit missing');
assert.ok(sql.includes('least(coalesce(p_limit,20),30)'),'candidate search limit missing');
assert.ok(sql.includes('limit 30'),'task list bound missing');
assert.ok(sql.includes('limit 20'),'interview/search bound missing');
assert.ok(sql.includes('limit 50'),'role task/queue bound missing');
assert.ok(workspace.includes('search.trim().length<2'),'candidate search should not fire on empty query');
assert.ok(!workspace.includes('/api/ats?module=CANDIDATES'),'browser must not load entire candidate DB');
console.log('STEP3_EXECUTION_PERFORMANCE_PASS indexes=true bounded_lists=true pagination_contract=true search_server_side=true');
