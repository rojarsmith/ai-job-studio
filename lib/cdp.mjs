// Minimal raw Chrome DevTools Protocol client for the Chrome you started with --remote-debugging-port (README "Attach mode").
// Used where Patchright's connectOverCDP is not wanted or hangs (seen 2026-11-03 with ~50 targets): it speaks only to one tab
// and never touches the others. Node 22+ (global WebSocket, fetch).
//   const tab = await openTab('https://example.com/');   // new tab in the person's Chrome
//   await tab.navigate(url, { waitMs });                 // Page.navigate + fixed wait
//   await tab.evaluate('document.title');               // Runtime.evaluate, awaitPromise, returnByValue
//   tab.requests()                                      // XHR/fetch requests the page made since Network was enabled
//   await tab.close();
import { loadConfig } from './config.mjs';

export const cdpUrl = () => process.env.JOB_CDP_URL || loadConfig('browser').cdp_url || 'http://127.0.0.1:9222';

async function connect() {
  let version;
  try { version = await (await fetch(`${cdpUrl()}/json/version`)).json(); }
  catch { throw new Error(`no Chrome with a debugging port at ${cdpUrl()}; start it as described in README "Attach mode"`); }
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP websocket failed')); });
  let id = 0; const pending = new Map(); const listeners = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) for (const l of listeners) l(m);
  };
  const send = (method, params = {}, sessionId, timeoutMs = 60000) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)));
    ws.send(JSON.stringify({ id: i, method, params, sessionId }));
    setTimeout(() => { if (pending.has(i)) { pending.delete(i); rej(new Error(`CDP timeout: ${method}`)); } }, timeoutMs);
  });
  return { ws, send, listeners };
}

/** Open a new tab in the attached Chrome (same profile, same logins) and return a small handle bound to it. */
export async function openTab(url = 'about:blank') {
  const { ws, send, listeners } = await connect();
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const reqs = new Map();
  listeners.push((m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === 'Network.requestWillBeSent' && /xhr|fetch/i.test(m.params.type)) reqs.set(m.params.requestId, { url: m.params.request.url, headers: m.params.request.headers });
    if (m.method === 'Network.responseReceived' && reqs.has(m.params.requestId)) reqs.get(m.params.requestId).status = m.params.response.status;
  });
  await send('Network.enable', {}, sessionId);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const tab = {
    targetId,
    async navigate(u, { waitMs = 8000 } = {}) { await send('Page.navigate', { url: u }, sessionId); await sleep(waitMs); },
    async evaluate(expression) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    },
    requests() { return [...reqs.values()]; },
    async responseBody(requestId) { return (await send('Network.getResponseBody', { requestId }, sessionId)).body; },
    sleep,
    async close() { try { await send('Target.closeTarget', { targetId }); } catch { /* already gone */ } ws.close(); },
  };
  if (url && url !== 'about:blank') await tab.navigate(url);
  return tab;
}
