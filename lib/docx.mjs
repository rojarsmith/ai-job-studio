// Markdown → DOCX without dependencies. Many ATS parse .docx more reliably than PDF, and some portals only accept it.
// Supports the templates/README.md shape: H1 name, contact line, H2 sections, H3 roles with a meta line, bullets,
// paragraphs, **bold**, *italic*, `code`, [links](url) (text kept, url dropped). Tables and images are not supported on purpose.
import fs from 'node:fs';
import zlib from 'node:zlib';

// ---- minimal zip ---------------------------------------------------------------------------
const CRC_TABLE = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
export function crc32(buf) { let c = -1; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };

/** entries: [{ name, data: Buffer|string }] → zip Buffer (deflate, DOS time 1980-01-01). */
export function zip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const raw = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, 'utf8');
    const data = zlib.deflateRawSync(raw);
    const crc = crc32(raw);
    const head = Buffer.concat([u32(0x04034b50), u16(20), u16(0x0800), u16(8), u16(0), u16(0x21), u32(crc), u32(data.length), u32(raw.length), u16(name.length), u16(0), name]);
    locals.push(head, data);
    centrals.push(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(8), u16(0), u16(0x21), u32(crc), u32(data.length), u32(raw.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    offset += head.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(cd.length), u32(offset), u16(0)]);
  return Buffer.concat([...locals, cd, end]);
}
/** Read entries back (only what zip() writes: deflate or stored, no data descriptors). Returns Map name → Buffer. */
export function unzip(buf) {
  const out = new Map();
  let p = 0;
  while (p + 30 <= buf.length && buf.readUInt32LE(p) === 0x04034b50) {
    const method = buf.readUInt16LE(p + 8), csize = buf.readUInt32LE(p + 18), nlen = buf.readUInt16LE(p + 26), xlen = buf.readUInt16LE(p + 28);
    const name = buf.subarray(p + 30, p + 30 + nlen).toString('utf8');
    const data = buf.subarray(p + 30 + nlen + xlen, p + 30 + nlen + xlen + csize);
    out.set(name, method === 8 ? zlib.inflateRawSync(data) : Buffer.from(data));
    p += 30 + nlen + xlen + csize;
  }
  return out;
}

// ---- markdown → WordprocessingML ----------------------------------------------------------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Inline markdown → runs. */
export function runs(text) {
  const parts = [];
  const re = /(\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_|`(.+?)`|\[([^\]]+)\]\([^)]*\))/g;
  let last = 0, m;
  const push = (t, props = '') => { if (t) parts.push(`<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`); };
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index));
    if (m[2] ?? m[3]) push(m[2] ?? m[3], '<w:b/>');
    else if (m[4] ?? m[5]) push(m[4] ?? m[5], '<w:i/>');
    else if (m[6]) push(m[6], '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>');
    else if (m[7]) push(m[7]);
    last = m.index + m[0].length;
  }
  push(text.slice(last));
  return parts.join('');
}
const para = (text, style, extra = '') => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extra}</w:pPr>${runs(text)}</w:p>`;

export function markdownToDocumentXml(md) {
  const lines = String(md).replace(/<!--[\s\S]*?-->/g, '').replace(/\r\n/g, '\n').split('\n');
  const body = [];
  let afterH1 = false, afterH3 = false, paraBuf = [];
  const flush = () => { if (paraBuf.length) { body.push(para(paraBuf.join(' '), null)); paraBuf = []; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if ((m = line.match(/^#\s+(.+)$/))) { flush(); body.push(para(m[1], 'Title')); afterH1 = true; continue; }
    if ((m = line.match(/^##\s+(.+)$/))) { flush(); body.push(para(m[1], 'Heading1')); afterH1 = afterH3 = false; continue; }
    if ((m = line.match(/^###\s+(.+)$/))) { flush(); body.push(para(m[1], 'Heading2')); afterH3 = true; afterH1 = false; continue; }
    if ((m = line.match(/^\s*[-*]\s+(.+)$/))) { flush(); body.push(para(m[1], 'ListParagraph', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>')); afterH1 = afterH3 = false; continue; }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) { flush(); continue; }
    if (!line.trim()) { flush(); afterH1 = afterH3 = false; continue; }
    if (afterH1) { body.push(para(line.trim(), 'Contact')); afterH1 = false; continue; }
    if (afterH3) { body.push(para(line.trim(), 'Meta')); afterH3 = false; continue; }
    paraBuf.push(line.trim());
  }
  flush();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="794" w:right="794" w:bottom="794" w:left="794" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

const STYLES = (font) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="Microsoft JhengHei" w:cs="${font}"/><w:sz w:val="21"/><w:lang w:val="en-US" w:eastAsia="zh-TW"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="20"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Contact"><w:name w:val="Contact"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="160"/></w:pPr><w:rPr><w:color w:val="333333"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="999999"/></w:pBdr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:caps/><w:sz w:val="23"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="120" w:after="20"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="21"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Meta"><w:name w:val="Meta"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="40"/></w:pPr><w:rPr><w:color w:val="444444"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="30"/><w:ind w:left="360" w:hanging="360"/></w:pPr></w:style>
</w:styles>`;
const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="&#8226;"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`;
const CORE = (title, author) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(title)}</dc:title><dc:creator>${esc(author)}</dc:creator></cp:coreProperties>`;

/** Build a .docx Buffer from markdown. Metadata holds only the title and the author (the candidate), nothing else. */
export function markdownToDocxBuffer(md, { font = 'Calibri', title, author = '' } = {}) {
  const t = title ?? (String(md).match(/^#\s+(.+)$/m)?.[1] ?? '').trim();
  return zip([
    { name: '[Content_Types].xml', data: CONTENT_TYPES },
    { name: '_rels/.rels', data: RELS },
    { name: 'word/_rels/document.xml.rels', data: DOC_RELS },
    { name: 'word/document.xml', data: markdownToDocumentXml(md) },
    { name: 'word/styles.xml', data: STYLES(font) },
    { name: 'word/numbering.xml', data: NUMBERING },
    { name: 'docProps/core.xml', data: CORE(t, author || t) },
  ]);
}
export function markdownToDocx(mdFile, outFile, opts = {}) {
  fs.writeFileSync(outFile, markdownToDocxBuffer(fs.readFileSync(mdFile, 'utf8'), opts));
  return outFile;
}
/** Plain text of a .docx in document order (paragraphs joined by \n), for checks and tests. */
export function docxText(file) {
  const xml = unzip(fs.readFileSync(file)).get('word/document.xml')?.toString('utf8') ?? '';
  return xml.split(/<\/w:p>/).map((p) => [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')).filter(Boolean)
    .join('\n').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
