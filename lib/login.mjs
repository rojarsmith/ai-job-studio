// Generic login-state detection and human-paced login used by adapters. Site specifics come from the adapter's
// defaults merged with <workspace>/config/sites.yml so selectors can be fixed without touching code.
import { loadConfig } from './config.mjs';

export function siteConfig(name, defaults) {
  let overrides = {};
  try { overrides = loadConfig('sites')?.[name] ?? {}; } catch { /* no sites.yml anywhere */ }
  return { ...defaults, ...overrides, selectors: { ...(defaults.selectors ?? {}), ...(overrides.selectors ?? {}) } };
}

const anyVisible = async (page, selectors) => {
  for (const s of selectors ?? []) { try { if (await page.locator(s).first().isVisible({ timeout: 300 })) return true; } catch { /* */ } }
  return false;
};

/** state: in | out | challenge | locked */
export async function genericLoginState(page, cfg) {
  const url = page.url();
  const title = (await page.title().catch(() => '')) ?? '';
  const body = (await page.locator('body').innerText({ timeout: 3000 }).catch(() => '')).slice(0, 20000);
  if (cfg.locked_re && new RegExp(cfg.locked_re, 'i').test(body)) return 'locked';
  if (/just a moment|attention required/i.test(title) || /cf-chl|captcha|verify you are human|security verification|two-step|two-factor|verification code|驗證碼|安全驗證/i.test(body) && !(await anyVisible(page, cfg.selectors.logged_in))) return 'challenge';
  if (cfg.challenge_re && new RegExp(cfg.challenge_re, 'i').test(url + '\n' + body)) return 'challenge';
  if (await anyVisible(page, cfg.selectors.logged_in)) return 'in';
  if (cfg.cookie_names?.length) {
    const names = new Set((await page.context().cookies()).map((c) => c.name));
    if (cfg.cookie_names.some((n) => names.has(n)) && !(await anyVisible(page, cfg.selectors.logged_out))) return 'in';
  }
  return 'out';
}

const typeHuman = async (loc, text) => { await loc.click(); await loc.fill(''); await loc.pressSequentially(text, { delay: 40 + Math.random() * 80 }); };

export async function genericLogin(page, creds, cfg) {
  if (cfg.login_url && !new RegExp(cfg.login_url_re ?? cfg.login_url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(page.url())) {
    await page.goto(cfg.login_url, { waitUntil: 'domcontentloaded' });
  }
  const s = cfg.selectors;
  const user = page.locator(s.username).first();
  await user.waitFor({ state: 'visible', timeout: 15000 });
  await typeHuman(user, creds.username);
  await page.waitForTimeout(300 + Math.random() * 500);
  if (s.next) { try { await page.locator(s.next).first().click({ timeout: 2000 }); } catch { /* single-page form */ } }
  const pass = page.locator(s.password).first();
  await pass.waitFor({ state: 'visible', timeout: 15000 });
  await typeHuman(pass, creds.password);
  await page.waitForTimeout(300 + Math.random() * 500);
  if (s.submit) await page.locator(s.submit).first().click(); else await pass.press('Enter');
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(2500 + Math.random() * 1500);
  if (creds.totp && s.totp) {
    const t = page.locator(s.totp).first();
    if (await t.isVisible({ timeout: 3000 }).catch(() => false)) {
      await typeHuman(t, creds.totp());
      if (s.totp_submit) await page.locator(s.totp_submit).first().click(); else await t.press('Enter');
      await page.waitForTimeout(2500);
    }
  }
}
