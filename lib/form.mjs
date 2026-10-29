// Generic application-form filler (L2 helper, pure Playwright, no LLM).
// scanForm  → list of fields with labels, types, options.
// planFill  → pure: map fields to answers; checkbox / radio / knock-outs → needs_confirmation, never touched.
// fillForm  → type / select / upload, then re-read the DOM to verify each value.
import { matchAnswerKey, splitName } from './answers.mjs';
import { knockoutCategory } from './knockout.mjs';

const SCAN_JS = `() => {
  const seen = new Set(); const out = [];
  const textOf = (el) => (el?.innerText ?? el?.textContent ?? '').replace(/\\s+/g, ' ').trim();
  const labelFor = (el) => {
    const parts = [];
    if (el.id) for (const l of document.querySelectorAll('label[for="' + CSS.escape(el.id) + '"]')) parts.push(textOf(l));
    const wrap = el.closest('label'); if (wrap) parts.push(textOf(wrap));
    if (el.getAttribute('aria-label')) parts.push(el.getAttribute('aria-label'));
    if (el.getAttribute('aria-labelledby')) for (const id of el.getAttribute('aria-labelledby').split(/\\s+/)) parts.push(textOf(document.getElementById(id)));
    if (!parts.join('')) { const g = el.closest('fieldset, .field, .form-group, div'); const lg = g?.querySelector('legend, label, .label'); if (lg) parts.push(textOf(lg)); }
    if (!parts.join('')) parts.push(el.placeholder || el.name || '');
    return parts.filter(Boolean).join(' ').slice(0, 200);
  };
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && (r.width > 0 || r.height > 0 || el.type === 'file'); };
  let i = 0;
  for (const el of document.querySelectorAll('input, textarea, select')) {
    const type = el.tagName === 'SELECT' ? 'select' : el.tagName === 'TEXTAREA' ? 'textarea' : (el.type || 'text').toLowerCase();
    if (['hidden', 'submit', 'button', 'image', 'reset'].includes(type)) continue;
    if (!vis(el)) continue;
    if (type === 'radio' && seen.has('radio:' + el.name)) continue;
    if (type === 'radio') seen.add('radio:' + el.name);
    const key = 'ajs-' + (i++);
    el.setAttribute('data-ajs', key);
    out.push({ key, type, name: el.name || '', id: el.id || '', label: labelFor(el), required: el.required || el.getAttribute('aria-required') === 'true',
      options: type === 'select' ? [...el.options].map((o) => ({ value: o.value, text: textOf(o) })) : undefined,
      value: type === 'file' ? '' : (el.value ?? ''), accept: el.accept || '' });
  }
  return out;
}`;

// Patchright's isolated-world evaluate does not treat a string as a function expression, so build a real function.
const scanFn = new Function(`return (${SCAN_JS})`)();
export async function scanForm(page) { return page.evaluate(scanFn); }

/** Pure planning step so it can be unit-tested without a browser. */
export function planFill(fields, answers, { files = {} } = {}) {
  const plan = [];
  const val = (k) => answers[k]?.value ?? '';
  for (const f of fields) {
    const entry = { key: f.key, label: f.label, type: f.type, required: f.required, value: '', status: 'unmatched', answer_key: null, note: '' };
    const ko = knockoutCategory(f.label);
    if (f.type === 'checkbox' || f.type === 'radio') { entry.status = 'needs_confirmation'; entry.note = `${f.type} never auto-filled${ko ? `; knock-out:${ko}` : ''}`; plan.push(entry); continue; }
    if (f.type === 'file') {
      const k = matchAnswerKey(f.label) ?? (/cover/i.test(f.label) ? 'cover_letter' : 'resume');
      if (files[k]) { entry.status = 'upload'; entry.value = files[k]; entry.answer_key = k; } else { entry.status = 'unmatched'; entry.note = `no file for ${k}`; }
      plan.push(entry); continue;
    }
    const k = matchAnswerKey(f.label);
    entry.answer_key = k;
    if (ko && !['notice_period', 'earliest_start', 'location'].includes(k)) { entry.status = 'needs_confirmation'; entry.note = `knock-out:${ko}`; if (k) entry.value = val(k); plan.push(entry); continue; }
    if (!k) { plan.push(entry); continue; }
    if (answers[k]?.needs_confirmation) { entry.status = 'needs_confirmation'; entry.value = val(k); entry.note = 'answers.md marks needs_confirmation'; plan.push(entry); continue; }
    let v = val(k);
    if (!v && k === 'first_name') v = splitName(val('full_name')).first;
    if (!v && k === 'last_name') v = splitName(val('full_name')).last;
    if (!v) { entry.note = 'empty in answers.md'; plan.push(entry); continue; }
    if (f.type === 'select') {
      const opt = (f.options ?? []).find((o) => o.text.toLowerCase() === v.toLowerCase() || o.value.toLowerCase() === v.toLowerCase())
        ?? (f.options ?? []).find((o) => o.text.toLowerCase().includes(v.toLowerCase()));
      if (!opt) { entry.status = 'needs_confirmation'; entry.value = v; entry.note = 'no matching option'; plan.push(entry); continue; }
      entry.value = opt.value; entry.display = opt.text;
    } else entry.value = v;
    entry.status = 'fill';
    plan.push(entry);
  }
  return plan;
}

const jitter = (lo, hi) => lo + Math.random() * (hi - lo);

/** Execute the plan. Returns the plan with status → filled | verify_failed | needs_confirmation | unmatched | error. */
export async function fillForm(page, plan, { delay = [120, 420] } = {}) {
  for (const e of plan) {
    if (!['fill', 'upload'].includes(e.status)) continue;
    const loc = page.locator(`[data-ajs="${e.key}"]`);
    try {
      if (e.status === 'upload') { await loc.setInputFiles(e.value); e.status = 'filled'; }
      else if (e.type === 'select') { await loc.selectOption(e.value); e.status = 'filled'; }
      else {
        await loc.click({ timeout: 5000 });
        await loc.fill('');
        await loc.pressSequentially(e.value, { delay: jitter(25, 90) });
        e.status = 'filled';
      }
      await page.waitForTimeout(jitter(delay[0], delay[1]));
      if (e.type !== 'file') {
        const now = await loc.inputValue().catch(() => null);
        if (now !== null && now !== e.value) { e.status = 'verify_failed'; e.note = `dom has ${JSON.stringify(now.slice(0, 60))}`; }
      }
    } catch (err) { e.status = 'error'; e.note = err.message.split('\n')[0]; }
  }
  return plan;
}

export const summarize = (plan) => plan.reduce((m, e) => (m[e.status] = (m[e.status] ?? 0) + 1, m), {});
