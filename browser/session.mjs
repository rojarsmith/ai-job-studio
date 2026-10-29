// Open a site in the user's Chrome and make sure it is logged in. The only exits are: logged in, or the human was asked.
//   state: in | out | challenge | locked   (adapter.login_state)
//   out + credentials + auto_login → adapter.login (human-paced typing) → re-check → still not in → wait_human
//   challenge → wait_human.  locked → sessions.tsv locked, throw (24 h cool-down, design 5.4).
import { launchSite, attachRunning, saveStorageState } from './launch.mjs';
import { waitHuman } from './wait-human.mjs';
import { loadConfig } from '../lib/config.mjs';
import { getCredentials, totp } from '../lib/credentials.mjs';
import { isLocked, markLocked, markVerified } from '../lib/sessions.mjs';
import { sleep } from '../lib/http.mjs';

export async function openSite(site, { mode } = {}) {
  const cfg = loadConfig('browser');
  const m = mode ?? cfg.attach ?? 'profile';
  if (m === 'cdp') { const r = await attachRunning(); return { ...r, site, close: async () => { try { await r.page.close(); } catch { /* */ } } }; }
  const r = await launchSite(site, { headless: false });
  return { ...r, site, close: async () => { try { await r.ctx.close(); } catch { /* */ } } };
}

export const humanPause = async () => { const r = loadConfig('thresholds').rate ?? {}; await sleep((r.min_delay_ms ?? 1500) + Math.random() * ((r.max_delay_ms ?? 4000) - (r.min_delay_ms ?? 1500))); };

export async function ensureLoggedIn(session, adapter, { url } = {}) {
  const { page, site, ctx } = session;
  if (isLocked(site)) throw new Error(`${site} is locked (sessions.tsv); wait 24 h and check the account by hand`);
  if (url) await page.goto(url, { waitUntil: 'domcontentloaded' });
  let state = await adapter.login_state(page);
  let how = 'session';
  if (state === 'locked') { markLocked(site); throw new Error(`${site}: account lock / unusual-activity page detected; stopping all ${site} actions`); }
  if (state === 'out' && adapter.login) {
    const cfg = loadConfig('browser');
    const auto = cfg.auto_login?.[site] ?? cfg.auto_login?.default ?? false;
    const creds = auto ? getCredentials(site) : null;
    if (creds) {
      console.log(`[session] ${site}: logged out, trying credentials from ${creds.source}`);
      try {
        await adapter.login(page, { ...creds, totp: creds.totp_secret ? () => totp(creds.totp_secret) : null });
        await humanPause();
        state = await adapter.login_state(page);
        how = 'auto';
      } catch (e) { console.error(`[session] ${site}: auto login failed: ${e.message.split('\n')[0]}`); }
      if (state === 'locked') { markLocked(site); throw new Error(`${site}: locked after login attempt`); }
    } else if (auto) console.log(`[session] ${site}: no credentials found (providers), asking you`);
  }
  if (state !== 'in') {
    await waitHuman(page, `${site}: ${state === 'challenge' ? '2FA / CAPTCHA / verification page' : 'please log in'} — finish it in the window`);
    state = await adapter.login_state(page);
    how = 'human';
    if (state !== 'in') throw new Error(`${site}: still not logged in after human step (state=${state})`);
  }
  if (ctx?.storageState) await saveStorageState(ctx, site).catch(() => {});
  markVerified(site, { login: how !== 'session', mfa: how === 'human' ? 'human' : undefined });
  return { state, how };
}
