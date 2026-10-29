// L1 browser layer. Fixed config from design 5.2 (Patchright + real Chrome + per-site persistent profile)
// and the 5.6 mode B alternative (attach to an already-running Chrome over CDP).
// Used from P3 on, plus lib/browser-fetch.mjs for APIs that reject Node's TLS fingerprint.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'patchright';
import { P } from '../lib/paths.mjs';
import { loadConfig } from '../lib/config.mjs';

const CANDIDATES = [
  () => process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
  () => process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'),
  () => process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
  () => '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  () => '/usr/bin/google-chrome',
  () => '/usr/bin/chromium',
];

/** Chrome binary: JOB_CHROME_EXE env → workspace config/browser.yml chrome_exe → common install locations. */
export function resolveChrome() {
  const cfg = loadConfig('browser');
  const explicit = process.env.JOB_CHROME_EXE || cfg.chrome_exe;
  if (explicit) {
    if (!fs.existsSync(explicit)) throw new Error(`chrome_exe not found: ${explicit}`);
    if (/GoogleChromePortable\.exe$/i.test(explicit)) throw new Error('point chrome_exe at App\\Chrome-bin\\chrome.exe, not the PortableApps launcher');
    return explicit;
  }
  for (const c of CANDIDATES) { const p = c(); if (p && fs.existsSync(p)) return p; }
  throw new Error('no Chrome found. Set JOB_CHROME_EXE or chrome_exe in <workspace>/config/browser.yml (portable Chrome: App\\Chrome-bin\\chrome.exe)');
}
export const cdpUrl = () => process.env.JOB_CDP_URL || loadConfig('browser').cdp_url || 'http://127.0.0.1:9222';

/** Mode A: dedicated persistent profile per site under <workspace>/profiles. Never Chrome's own user-data-dir. */
export async function launchSite(site, { headless = false } = {}) {
  const profileDir = path.join(P.profiles, site);
  fs.mkdirSync(profileDir, { recursive: true });
  const ctx = await chromium.launchPersistentContext(profileDir, {
    executablePath: resolveChrome(),
    headless,            // headed is required for stealth and for wait_human
    viewport: null,      // no fixed viewport fingerprint
    // no userAgent / locale override: let Chrome report itself
  });
  return { ctx, page: ctx.pages()[0] ?? (await ctx.newPage()), profileDir, mode: 'A' };
}

/** Mode B: attach to a running Chrome started with --remote-debugging-port=9222 (non-default user-data-dir). */
export async function attachRunning() {
  const browser = await chromium.connectOverCDP(cdpUrl());
  const ctx = browser.contexts()[0] ?? (await browser.newContext());
  return { browser, ctx, page: await ctx.newPage(), mode: 'B' };
}

export async function saveStorageState(ctx, site) {
  const out = path.join(P.profiles, `${site}.storageState.json`);
  await ctx.storageState({ path: out });
  return out;
}
