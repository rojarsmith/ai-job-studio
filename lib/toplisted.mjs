// Taiwan-listed companies ranked by market capitalisation, from the exchange's open data (no login):
//   company list  https://openapi.twse.com.tw/v1/opendata/t187ap03_L          (code, names, shares issued)
//   closing price https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL
// Market cap = closing price x shares issued, so the order is close to, but not identical to, an index such as 0050
// (index weights use free-float shares and a periodic review). Cached for a day under generated/data.
import fs from 'node:fs';
import { P } from './paths.mjs';

const COMPANIES = 'https://openapi.twse.com.tw/v1/opendata/t187ap03_L';
const PRICES = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
const MAX_AGE_MS = 86400000;

const num = (s) => parseFloat(String(s ?? '').replace(/,/g, ''));

/** companies: rows of t187ap03_L; prices: rows of STOCK_DAY_ALL. Returns the top `n` as { rank, code, name, legal, cap } (cap in NT$ 100 million). */
export function rankByMarketCap(companies, prices, n = 50) {
  const px = new Map(prices.map((r) => [r.Code, num(r.ClosingPrice)]));
  return companies
    .map((c) => ({ code: c['公司代號'], name: c['公司簡稱'], legal: c['公司名稱'], price: px.get(c['公司代號']), shares: num(c['已發行普通股數或TDR原股發行股數']) }))
    .filter((c) => c.price > 0 && c.shares > 0)
    .map((c) => ({ code: c.code, name: c.name, legal: c.legal, cap: Math.round((c.price * c.shares) / 1e8) }))
    .sort((a, b) => b.cap - a.cap)
    .slice(0, n)
    .map((c, i) => ({ rank: i + 1, ...c }));
}

export async function topListed(n = 50, { refresh = false } = {}) {
  const file = P.data('top-tw.json');
  if (!refresh && fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < MAX_AGE_MS) {
    const cached = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (cached.length >= n) return cached.slice(0, n);
  }
  const get = async (url) => { const r = await fetch(url, { headers: { accept: 'application/json' } }); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.json(); };
  const ranked = rankByMarketCap(await get(COMPANIES), await get(PRICES), Math.max(n, 100));
  fs.mkdirSync(P.data('.'), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(ranked));
  return ranked.slice(0, n);
}
