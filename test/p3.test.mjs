import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseCredentialText, totp, base32Decode, providers } from '../lib/credentials.mjs';
import { parseAnswers, matchAnswerKey, splitName } from '../lib/answers.mjs';
import { knockoutCategory, knockoutsInText } from '../lib/knockout.mjs';
import { planFill, summarize } from '../lib/form.mjs';
import { parseTracker, writeTracker, addApplication, setStatus, duplicateChannel, countToday, logApplication } from '../lib/tracker.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ajs-p3-'));

test('credential text: labelled id/email/password, bare trailing line ignored', () => {
  const c = parseCredentialText('https://www.104.com.tw/\nhttps://accounts.104.com.tw/profile\n\nid: E1230\nemail: a@b.c\npassword: s3cret\nnickname\n');
  assert.equal(c.username, 'a@b.c');
  assert.equal(c.username_alt, 'E1230');
  assert.equal(c.password, 's3cret');
  assert.deepEqual(c.urls.length, 2);
});
test('credential text: chinese labels, key=value, unlabelled fallback, totp', () => {
  assert.deepEqual(parseCredentialText('帳號：user1\n密碼：pw1\n2fa secret: JBSW Y3DP EHPK 3PXP').totp_secret, 'JBSWY3DPEHPK3PXP');
  const c = parseCredentialText('user=u2\npass=p2');
  assert.equal(c.username, 'u2'); assert.equal(c.password, 'p2');
  const d = parseCredentialText('some note\nme@x.y\nhunter2\n');
  assert.equal(d.username, 'me@x.y'); assert.equal(d.password, 'hunter2');
});
test('dir provider finds file by site name and respects aliases', () => {
  const dir = path.join(tmp, 'secrets'); fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, '104.txt'), 'email: a@b.c\npassword: x\n');
  fs.writeFileSync(path.join(dir, 'LinkedIn帳號.txt'), 'email: l@b.c\npassword: y\n');
  assert.equal(providers.dir('104', { path: dir }).username, 'a@b.c');
  assert.equal(providers.dir('linkedin', { path: dir }).username, 'l@b.c');
  assert.equal(providers.dir('cake', { path: dir }), null);
  assert.equal(providers.dir('cake', { path: dir, aliases: { cake: '104.txt' } }).username, 'a@b.c');
});
test('env provider', () => {
  process.env.JOB_CRED_104_USER = 'eu'; process.env.JOB_CRED_104_PASS = 'ep';
  assert.equal(providers.env('104').password, 'ep');
  delete process.env.JOB_CRED_104_USER; delete process.env.JOB_CRED_104_PASS;
  assert.equal(providers.env('104'), null);
});
test('totp matches RFC 6238 vector (SHA1, secret 12345678901234567890, T=59 → 287082→ 6 digits 287082)', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // base32 of 12345678901234567890
  assert.equal(base32Decode(secret).toString(), '12345678901234567890');
  assert.equal(totp(secret, { time: 59 * 1000 }), '287082');
  assert.equal(totp(secret, { time: 1111111109 * 1000 }), '081804');
});
test('answers.md parsing and label matching', () => {
  const a = parseAnswers('## Identity\n- full_name: Lin Mei (Amy Lin)\n- email: a@b.c\n\n## Compensation (needs_confirmation)\n- salary_expectation: TWD 100000   # needs_confirmation\n- notice_period: 30 days\n\n## Free-text\n- why_this_company: because\n');
  assert.equal(a.full_name.value, 'Lin Mei (Amy Lin)');
  assert.equal(a.salary_expectation.needs_confirmation, true);
  assert.equal(a.notice_period.needs_confirmation, true);
  assert.equal(a.why_this_company.needs_confirmation, false);
  assert.equal(matchAnswerKey('Email Address *'), 'email');
  assert.equal(matchAnswerKey('LinkedIn Profile'), 'linkedin');
  assert.equal(matchAnswerKey('Why do you want to work at Acme?'), 'why_this_company');
  assert.equal(matchAnswerKey('Favourite colour'), null);
  assert.deepEqual(splitName('Lin Mei (Amy Lin)'), { first: 'Wu', last: 'Bin' });
  assert.deepEqual(splitName('王小明'), { first: '王小明', last: '' });
});
test('knock-out detection', () => {
  assert.equal(knockoutCategory('Are you legally authorized to work in the United States?'), 'work_auth');
  assert.equal(knockoutCategory('Will you now or in the future require sponsorship?'), 'sponsorship');
  assert.equal(knockoutCategory('Expected salary (TWD)'), 'salary');
  assert.equal(knockoutCategory('Gender'), 'demographic');
  assert.equal(knockoutCategory('First name'), null);
  assert.ok(knockoutsInText('must be authorized to work; visa sponsorship not available').includes('sponsorship'));
});
test('planFill: fills matched text, uploads, never touches checkbox/radio/knock-outs', () => {
  const fields = [
    { key: 'a', type: 'text', label: 'First Name *', required: true },
    { key: 'b', type: 'text', label: 'Last Name', required: true },
    { key: 'c', type: 'email', label: 'Email', required: true },
    { key: 'd', type: 'file', label: 'Resume/CV', required: true },
    { key: 'e', type: 'file', label: 'Cover Letter' },
    { key: 'f', type: 'select', label: 'Are you authorized to work in Taiwan?', options: [{ value: '', text: 'Select' }, { value: '1', text: 'Yes' }, { value: '0', text: 'No' }] },
    { key: 'g', type: 'checkbox', label: 'I agree to the privacy policy' },
    { key: 'h', type: 'radio', label: 'Gender' },
    { key: 'i', type: 'textarea', label: 'Why do you want to work here?' },
    { key: 'j', type: 'text', label: 'Desired salary' },
    { key: 'k', type: 'select', label: 'Notice period', options: [{ value: 'imm', text: 'Immediately' }, { value: '30', text: '30 days' }] },
    { key: 'l', type: 'text', label: 'Favourite colour' },
  ];
  const answers = parseAnswers('## Identity\n- full_name: Jane Q Doe\n- email: j@d.e\n## Eligibility (needs_confirmation)\n- work_authorization_taiwan: citizen\n## Compensation (needs_confirmation)\n- salary_expectation: 100k\n- notice_period: 30 days\n## Free-text\n- why_this_company: I like it\n');
  const plan = planFill(fields, answers, { files: { resume: 'cv.pdf', cover_letter: 'cover.pdf' } });
  const by = Object.fromEntries(plan.map((e) => [e.key, e]));
  assert.equal(by.a.value, 'Jane Q'); assert.equal(by.a.status, 'fill');
  assert.equal(by.b.value, 'Doe');
  assert.equal(by.c.value, 'j@d.e');
  assert.equal(by.d.status, 'upload'); assert.equal(by.d.value, 'cv.pdf');
  assert.equal(by.e.value, 'cover.pdf');
  assert.equal(by.f.status, 'needs_confirmation');
  assert.equal(by.g.status, 'needs_confirmation');
  assert.equal(by.h.status, 'needs_confirmation');
  assert.equal(by.i.status, 'fill'); assert.equal(by.i.value, 'I like it');
  assert.equal(by.j.status, 'needs_confirmation'); assert.equal(by.j.value, '100k');
  assert.equal(by.k.status, 'needs_confirmation');  // notice period is flagged in answers.md
  assert.equal(by.l.status, 'unmatched');
  assert.equal(summarize(plan).fill, 4);
});
test('tracker: add, status, duplicate channel, daily count', () => {
  const file = path.join(tmp, 'tracker.md'), log = path.join(tmp, 'status.tsv'), apps = path.join(tmp, 'apps.tsv');
  writeTracker({ preamble: '# T', rows: [] }, file);
  addApplication({ id: '008', company: 'GitLab', title: 'Principal TPM', url: 'https://x/8', channel: 'greenhouse' }, file);
  assert.throws(() => addApplication({ id: '008', company: 'x', title: 'y', url: 'z', channel: 'c' }, file), /already/);
  const t = parseTracker(fs.readFileSync(file, 'utf8'));
  assert.equal(t.rows[0].status, 'submitted');
  setStatus('008', 'screening', { note: 'recruiter call', file, logFile: log });
  assert.match(fs.readFileSync(log, 'utf8'), /submitted\tscreening\trecruiter call/);
  assert.ok(duplicateChannel({ company: 'gitlab', title: 'principal tpm', channel: 'linkedin' }, file));
  assert.equal(duplicateChannel({ company: 'gitlab', title: 'principal tpm', channel: 'greenhouse' }, file), null);
  logApplication('greenhouse', 'https://x/8', apps); logApplication('104', 'https://x/9', apps);
  assert.deepEqual(countToday('greenhouse', apps), { site: 1, total: 2 });
});
