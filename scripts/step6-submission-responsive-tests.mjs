import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const css=await readFile(new URL('../app/step6-submission.css',import.meta.url),'utf8');
assert.ok(css.includes('@media(max-width:900px)'));assert.ok(css.includes('@media(max-width:480px)'));assert.ok(css.includes('overflow:auto'));assert.ok(css.includes('overflow-wrap:anywhere'));
console.log('Step 6 responsive guards passed.');
