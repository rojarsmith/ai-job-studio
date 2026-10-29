import fs from 'node:fs';
const clean = (v) => String(v ?? '').replace(/[\t\r\n]+/g, ' ').trim();
export function appendTsv(file, header, row) {
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) fs.writeFileSync(file, header.join('\t') + '\n');
  fs.appendFileSync(file, header.map((h) => clean(row[h])).join('\t') + '\n');
}
export function readTsv(file) {
  if (!fs.existsSync(file)) return [];
  const [head, ...lines] = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  const cols = head.split('\t');
  return lines.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cols[i], v])));
}
