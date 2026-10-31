#!/usr/bin/env node
// Run a small script against one tab of the Chrome you started with --remote-debugging-port (see README "Attach mode").
// Saves re-writing the attach boilerplate every time a site needs a one-off look or edit.
//   node scripts/tab-run.mjs <url-substring> <script.js>
// The script body is the inside of an async function with: p (Playwright page), b (browser), sleep(ms), shot(name),
// fs, TMP (a temp directory for screenshots; read them with an image viewer). Whatever it returns is printed as JSON.
// Keep throwaway scripts outside the repo (the temp directory); write down what you learn in docs/sites/<site>.md.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'patchright';
import { cdpUrl } from '../browser/launch.mjs';

const [match, file] = process.argv.slice(2);
if (!match || !file) { console.error('usage: node scripts/tab-run.mjs <url-substring> <script.js>'); process.exit(2); }
let browser;
try { browser = await chromium.connectOverCDP(cdpUrl()); }
catch { console.error(`[tab-run] no Chrome with a debugging port at ${cdpUrl()}; start it as described in README "Attach mode"`); process.exit(1); }
const page = browser.contexts().flatMap((c) => c.pages()).find((x) => x.url().includes(match));
if (!page) { console.error(`[tab-run] no open tab whose URL contains "${match}" (node scripts/tabs.mjs lists them)`); process.exit(1); }
await page.bringToFront();
const TMP = path.join(os.tmpdir(), 'ajs-scratch');
fs.mkdirSync(TMP, { recursive: true });
const sleep = (ms) => page.waitForTimeout(ms);
const shot = async (name = 'a') => { const f = path.join(TMP, `${name}.png`); await page.screenshot({ path: f }); console.log(`[tab-run] screenshot ${f}`); };
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
let code = 0;
try {
  const r = await new AsyncFunction('p', 'b', 'sleep', 'shot', 'fs', 'TMP', fs.readFileSync(file, 'utf8'))(page, browser, sleep, shot, fs, TMP);
  if (r !== undefined) console.log(typeof r === 'string' ? r : JSON.stringify(r, null, 1));
} catch (e) { console.error(`[tab-run] ${e.message.split('\n')[0]}`); code = 1; }
process.exit(code);
