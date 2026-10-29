// wait_human(): the only answer to login, 2FA, CAPTCHA, lock pages and confirmation questions.
// Bring the window on screen, print reason + URL, wait for Enter, return. Never retries, never guesses.
import readline from 'node:readline';

export async function waitHuman(page, reason, { prompt = '按 Enter 繼續 / press Enter to continue' } = {}) {
  try { await page.bringToFront(); } catch { /* headless or detached */ }
  console.log(`\n[needs_human] ${reason}\n[needs_human] url=${page.url()}`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((r) => rl.question(`[needs_human] ${prompt}\n`, r));
  rl.close();
  return { reason, url: page.url(), at: new Date().toISOString() };
}
