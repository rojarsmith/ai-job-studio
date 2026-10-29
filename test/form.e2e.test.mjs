// End-to-end form filling against a local HTML fixture using the configured Chrome. Skips when no Chrome is resolvable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanForm, planFill, fillForm, summarize } from '../lib/form.mjs';
import { parseAnswers } from '../lib/answers.mjs';

let chrome = null;
try { ({ resolveChrome: (await import('../browser/launch.mjs')).resolveChrome }); chrome = (await import('../browser/launch.mjs')).resolveChrome(); } catch { chrome = null; }

test('fill local fixture form: text + upload filled, radio/checkbox/knock-outs untouched, submit never clicked', { skip: !chrome && 'no Chrome configured' }, async () => {
  const { chromium } = await import('patchright');
  const fixture = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'form.html');
  const pdf = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ajs-e2e-')), 'cv.pdf');
  fs.writeFileSync(pdf, '%PDF-1.4\n%fake\n');
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  try {
    const page = await browser.newPage();
    let submitted = false;
    await page.exposeFunction('__submitted', () => { submitted = true; });
    await page.goto('file:///' + fixture.replace(/\\/g, '/'));
    await page.evaluate(() => document.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); window.__submitted(); }));
    const fields = await scanForm(page);
    assert.ok(fields.length >= 11, `scanned ${fields.length}`);
    assert.ok(!fields.some((f) => f.name === 'token'), 'hidden input excluded');
    const answers = parseAnswers('## Identity\n- full_name: Jane Doe\n- email: j@d.e\n- phone: +886 9\n- linkedin: https://linkedin.com/in/jane\n## Compensation (needs_confirmation)\n- salary_expectation: 100k\n## Free-text\n- why_this_company: Because.\n');
    const plan = await fillForm(page, planFill(fields, answers, { files: { resume: pdf } }));
    const s = summarize(plan);
    assert.equal(s.filled, 7, JSON.stringify(plan.map((e) => [e.label, e.status, e.note])));
    assert.equal(s.needs_confirmation, 4);
    assert.equal(await page.inputValue('#first_name'), 'Jane');
    assert.equal(await page.inputValue('#last_name'), 'Doe');
    assert.equal(await page.inputValue('#why'), 'Because.');
    assert.equal(await page.inputValue('#salary'), '');
    assert.equal(await page.inputValue('#auth'), '');
    assert.equal(await page.isChecked('input[name="agree"]'), false);
    assert.equal(await page.evaluate(() => document.querySelector('#resume').files.length), 1);
    assert.equal(submitted, false);
    assert.ok(plan.find((e) => e.label.includes('salary')).status === 'needs_confirmation');
  } finally { await browser.close(); }
});
