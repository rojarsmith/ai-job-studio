// L1 browser layer. Fixed config from design 5.2 (Patchright + portable chrome.exe + per-site persistent profile)
// and the 5.6 mode B alternative (attach to your already-running portable Chrome over CDP).
// Used from P3 on; P1 only needs login-free APIs.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'patchright';
import { P } from '../lib/paths.mjs';

export const CHROME_EXE = process.env.JOB_CHROME_EXE
  || 'C:/my/build/toolchain/GoogleChromePortable64-auto/App/Chrome-bin/chrome.exe';
export const CDP_URL = process.env.JOB_CDP_URL || 'http://127.0.0.1:9222';

/** Mode A: dedicated persistent profile per site. Never point this at Chrome's own Data\profile. */
export async function launchSite(site, { headless = false } = {}) {
  if (!fs.existsSync(CHROME_EXE)) throw new Error(`portable Chrome not found: ${CHROME_EXE} (set JOB_CHROME_EXE)`);
  const profileDir = path.join(P.profiles, site);
  fs.mkdirSync(profileDir, { recursive: true });
  const ctx = await chromium.launchPersistentContext(profileDir, {
    executablePath: CHROME_EXE,
    headless,            // headed is required for stealth and for wait_human
    viewport: null,      // no fixed viewport fingerprint
    // no userAgent / locale override: let Chrome report itself
  });
  return { ctx, page: ctx.pages()[0] ?? (await ctx.newPage()), profileDir, mode: 'A' };
}

/** Mode B: attach to the running portable Chrome started with --remote-debugging-port=9222. */
export async function attachRunning() {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const ctx = browser.contexts()[0] ?? (await browser.newContext());
  return { browser, ctx, page: await ctx.newPage(), mode: 'B' };
}

export async function saveStorageState(ctx, site) {
  const out = path.join(P.profiles, `${site}.storageState.json`);
  await ctx.storageState({ path: out });
  return out;
}
