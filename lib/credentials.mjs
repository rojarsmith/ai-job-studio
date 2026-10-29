// Site credentials. Read only at the moment of login, kept in memory, never logged, never written anywhere.
// Providers (browser.yml → credentials.providers, default [dir, file, env]); first provider that knows the site wins;
// none → null → the caller falls back to wait_human.
//   dir  : one text file per site under <workspace>/runtime/secrets (or credentials.dir.path), e.g. 104.txt
//   file : <workspace>/runtime/secrets/credentials.yml   { "<site>": { username, password, totp_secret } }
//   env  : JOB_CRED_<SITE>_USER / _PASS / _TOTP
// Any value may be prefixed:  cmd:<shell command>  (stdout, trimmed)   dpapi:<base64>  (Windows DPAPI, current user)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync, execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import { P } from './paths.mjs';
import { loadConfig } from './config.mjs';

const USER_KEYS = /^(email|e-mail|mail|信箱|電子郵件|username|user|account|acct|login|id|帳號|帳戶|會員編號)$/i;
const PASS_KEYS = /^(password|pass|pwd|passwd|密碼)$/i;
const TOTP_KEYS = /^(totp|totp[ _-]?secret|2fa|2fa[ _-]?secret|otp[ _-]?secret|authenticator|驗證碼金鑰|雙重驗證)$/i;
const LABEL_RE = /^\s*([^:：=]{1,24}?)\s*[:：=]\s*(.+?)\s*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Parse one credential text file. Labelled lines win; unlabelled lines are ignored when any label exists. */
export function parseCredentialText(text) {
  const out = { username: '', username_alt: '', password: '', totp_secret: '', urls: [] };
  const unlabelled = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^https?:\/\//i.test(line)) { out.urls.push(line); continue; }
    const m = line.match(LABEL_RE);
    if (m && !/^https?$/i.test(m[1])) {
      const k = m[1].trim(), v = m[2].trim();
      if (USER_KEYS.test(k)) {
        if (/^(email|e-mail|mail|信箱|電子郵件)$/i.test(k) || EMAIL_RE.test(v)) { if (out.username && !EMAIL_RE.test(out.username)) out.username_alt = out.username; out.username ||= v; if (!EMAIL_RE.test(out.username) && EMAIL_RE.test(v)) { out.username_alt = out.username; out.username = v; } }
        else if (!out.username) out.username = v; else out.username_alt ||= v;
      } else if (PASS_KEYS.test(k)) out.password ||= v;
      else if (TOTP_KEYS.test(k)) out.totp_secret ||= v.replace(/\s+/g, '');
      continue;
    }
    unlabelled.push(line);
  }
  if (!out.username && !out.password) {
    const i = unlabelled.findIndex((l) => EMAIL_RE.test(l));
    const u = i >= 0 ? i : 0;
    out.username = unlabelled[u] ?? '';
    out.password = unlabelled[u + 1] ?? '';
  }
  return out;
}

export function resolveValue(v) {
  const s = String(v ?? '');
  if (s.startsWith('cmd:')) return execSync(s.slice(4), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  if (s.startsWith('dpapi:')) {
    const ps = `[System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR((ConvertTo-SecureString -String '${s.slice(6)}')))`;
    return execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  }
  return s;
}
/** Encrypt a secret with Windows DPAPI for the current user; paste the result as "dpapi:<...>" in credentials.yml. */
export function dpapiEncrypt(plain) {
  const ps = `ConvertFrom-SecureString -SecureString (ConvertTo-SecureString -String '${String(plain).replace(/'/g, "''")}' -AsPlainText -Force)`;
  return 'dpapi:' + execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

const siteKey = (site) => String(site).toUpperCase().replace(/[^A-Z0-9]+/g, '_');

export const providers = {
  dir(site, cfg = {}) {
    const dir = cfg.path ? path.resolve(cfg.path) : P.secrets;
    if (!fs.existsSync(dir)) return null;
    let file = cfg.aliases?.[site];
    if (!file) {
      const want = String(site).toLowerCase();
      const hits = fs.readdirSync(dir).filter((f) => /\.(txt|md|text)$/i.test(f) && f.toLowerCase().includes(want));
      if (hits.length !== 1) { if (hits.length > 1) console.error(`[credentials] dir: ${hits.length} files match "${site}", set credentials.dir.aliases`); return null; }
      file = hits[0];
    }
    const full = path.join(dir, file);
    if (!fs.existsSync(full)) return null;
    const c = parseCredentialText(fs.readFileSync(full, 'utf8'));
    return c.username && c.password ? { ...c, source: `dir:${file}` } : null;
  },
  file(site) {
    const f = path.join(P.secrets, 'credentials.yml');
    if (!fs.existsSync(f)) return null;
    const all = yaml.load(fs.readFileSync(f, 'utf8')) ?? {};
    const c = all[site];
    if (!c?.username || !c?.password) return null;
    return { username: resolveValue(c.username), password: resolveValue(c.password), totp_secret: c.totp_secret ? resolveValue(c.totp_secret) : '', source: 'file:credentials.yml' };
  },
  env(site) {
    const k = siteKey(site);
    const u = process.env[`JOB_CRED_${k}_USER`], p = process.env[`JOB_CRED_${k}_PASS`];
    if (!u || !p) return null;
    return { username: resolveValue(u), password: resolveValue(p), totp_secret: resolveValue(process.env[`JOB_CRED_${k}_TOTP`] ?? ''), source: 'env' };
  },
};

export function getCredentials(site, cfg = loadConfig('browser').credentials ?? {}) {
  for (const name of cfg.providers ?? ['dir', 'file', 'env']) {
    const p = providers[name];
    if (!p) { console.error(`[credentials] unknown provider "${name}"`); continue; }
    try { const c = p(site, cfg[name] ?? {}); if (c) return c; }
    catch (e) { console.error(`[credentials] ${name}: ${e.message}`); }
  }
  return null;
}

// ---- TOTP (RFC 6238, SHA-1, 6 digits, 30 s) without external dependencies ----
export function base32Decode(s) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(s).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0; const out = [];
  for (const ch of clean) { value = (value << 5) | A.indexOf(ch); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; } }
  return Buffer.from(out);
}
export function totp(secret, { time = Date.now(), step = 30, digits = 6 } = {}) {
  const counter = Math.floor(time / 1000 / step);
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 0x0f;
  const code = ((h[o] & 0x7f) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 10 ** digits;
  return String(code).padStart(digits, '0');
}
