import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planFill, coverLetterText } from '../lib/form.mjs';

test('coverLetterText drops the name heading and contact line', () => {
  const md = '# Ada Example\nada@example.com · +1 555 0100 · Example City\n\nDear team,\n\nI build **billing** systems.\n\nAda\n';
  assert.equal(coverLetterText(md), 'Dear team,\n\nI build billing systems.\n\nAda');
  assert.equal(coverLetterText('Dear team,\n\nHello.'), 'Dear team,\n\nHello.');
});
test('the only textarea gets the letter when the site says so', () => {
  const fields = [{ key: 'a', type: 'textarea', label: '系統預設', required: false }];
  const plan = planFill(fields, {}, { texts: { cover_letter: 'Dear team' }, onlyTextareaIs: 'cover_letter' });
  assert.equal(plan[0].status, 'fill');
  assert.equal(plan[0].value, 'Dear team');
  assert.equal(planFill(fields, {}, { texts: { cover_letter: 'Dear team' } })[0].status, 'unmatched');
});
test('two textareas: no guessing', () => {
  const fields = [{ key: 'a', type: 'textarea', label: 'x' }, { key: 'b', type: 'textarea', label: 'y' }];
  assert.ok(planFill(fields, {}, { texts: { cover_letter: 'Dear team' }, onlyTextareaIs: 'cover_letter' }).every((e) => e.status === 'unmatched'));
});
test('a labelled cover letter box takes the letter text when answers.md is empty', () => {
  const plan = planFill([{ key: 'a', type: 'textarea', label: '自我推薦信' }], {}, { texts: { cover_letter: 'Dear team' } });
  assert.equal(plan[0].value, 'Dear team');
});
