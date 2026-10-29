// Minimal HTML → text for job descriptions. Keeps block structure, drops tags, decodes entities (also double-encoded).
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeEntities(s) {
  const once = (x) => x.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });
  let out = s;
  for (let i = 0; i < 3 && /&[#a-z0-9]+;/i.test(out); i++) out = once(out);
  return out;
}
export function htmlToText(html) {
  let s = decodeEntities(String(html ?? ''));
  if (!/<[a-z!/]/i.test(s)) return s.trim();
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|tr|section|article|blockquote)>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '- ').replace(/<\/li>/gi, '\n')
    .replace(/<(h[1-6])[^>]*>/gi, '\n\n### ')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(s).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
