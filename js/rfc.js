// Pure RFC logic: numbers, URLs, fetching, cleaning the published text, headings, cross-references.
import { RFC_HOST, FETCH_TIMEOUT_MS } from './config.js';

export function parseNumber(input) {
  const m = String(input || '').trim().match(/^(?:rfc[\s\-_]*)?0*(\d{1,5})$/i);
  return m && Number(m[1]) > 0 ? Number(m[1]) : null;
}
export const textUrl = n => `${RFC_HOST}/rfc/rfc${n}.txt`;
export const metaUrl = n => `${RFC_HOST}/rfc/rfc${n}.json`;
export const officialUrl = n => `${RFC_HOST}/info/rfc${n}`;
export const errataUrl = n => `${RFC_HOST}/errata/rfc${n}`;

async function get(url, signal) {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), FETCH_TIMEOUT_MS);
  signal?.addEventListener('abort', () => timeout.abort());
  try { return await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: timeout.signal }); }
  finally { clearTimeout(timer); }
}
// Resolves to the body, or null when the RFC has no such file (404); throws on network trouble or other errors.
export async function fetchText(n, signal) {
  const res = await get(textUrl(n), signal);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}
export async function fetchMeta(n, signal) {
  const res = await get(metaUrl(n), signal);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  try { return await res.json(); } catch { return null; }
}

// ---- cleaning ---------------------------------------------------------------------------------
const HEADER = /^RFC \d+ {2,}(?:.* {2,})?[A-Z][a-z]+ \d{4}\s*$/;
const FOOTER = /\[Page \d+\]\s*$/;
const SENTENCE_END = /[.:?!)"'\]]\s*$/;

// Removes form feeds, the running header after each page break and the "[Page n]" footer before it. The words are
// never changed. A blank line is kept between pages only where the text before it ends a sentence; otherwise the
// paragraph simply continues on the next page.
export function cleanText(raw) {
  const text = String(raw || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const pages = text.split('\f').map((page, i) => {
    let lines = page.split('\n');
    while (lines.length && !lines.at(-1).trim()) lines.pop();
    if (lines.length && FOOTER.test(lines.at(-1))) lines.pop();
    if (i > 0) {
      let k = 0;
      while (k < lines.length && !lines[k].trim()) k++;
      if (k < lines.length && HEADER.test(lines[k])) k++;
      while (k < lines.length && !lines[k].trim()) k++;
      lines = lines.slice(k);
    }
    while (lines.length && !lines.at(-1).trim()) lines.pop();
    return lines;
  }).filter(lines => lines.length);
  const out = [];
  pages.forEach((lines, i) => {
    if (i > 0) {
      const last = out.at(-1) || '';
      if (SENTENCE_END.test(last) || !last.trim()) out.push('');
    }
    out.push(...lines);
  });
  return out.join('\n').replace(/\n{4,}/g, '\n\n\n').replace(/^\n+/, '') + '\n';
}

// ---- headings -----------------------------------------------------------------------------------
const NAMED = new Set(['abstract', 'status of this memo', 'copyright notice', 'table of contents', 'contents', 'introduction', 'acknowledgements', 'acknowledgments',
  "authors' addresses", "author's address", "authors’ addresses", 'references', 'normative references', 'informative references', 'security considerations', 'iana considerations']);
const SEP = String.raw`(?:\.\s{1,6}|\s{2,6})`;
const NUMBERED = new RegExp(`^(?:(\\d+(?:\\.\\d+)*)${SEP}|Appendix ([A-Z](?:\\.\\d+)*)${SEP}|([A-Z](?:\\.\\d+)+)${SEP})(\\S.{0,100})$`);
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Returns { id, title, level, line } for a heading line at column 0, or null.
export function headingOf(line, index) {
  if (!line || /^\s/.test(line) || /\.{4,}\s*\d+\s*$/.test(line)) return null;
  const m = line.match(NUMBERED);
  if (m) {
    const token = m[1] || m[2] || m[3];
    const title = m[4].trim();
    if (/[,;]\s*$/.test(title) || title.length > 90) return null;
    return { id: `section-${token}`, title: line.trim(), level: token.split('.').length, line: index };
  }
  const name = line.trim().replace(/:$/, '');
  if (NAMED.has(name.toLowerCase())) return { id: slug(name), title: name, level: 1, line: index };
  return null;
}

// Splits cleaned text into chunks: [{ id, title, level, text }]. The first chunk is the title block (no heading).
export function chunks(clean) {
  const lines = clean.replace(/\n$/, '').split('\n');
  const out = [{ id: '', title: '', level: 0, lines: [] }];
  const seen = new Set();
  lines.forEach((line, i) => {
    const h = headingOf(line, i);
    if (h && !seen.has(h.id)) { seen.add(h.id); out.push({ id: h.id, title: h.title, level: h.level, lines: [line] }); }
    else out.at(-1).lines.push(line);
  });
  return out.map(({ id, title, level, lines: l }) => ({ id, title, level, text: l.join('\n') + '\n' })).filter(c => c.id || c.text.trim());
}

// ---- cross-references ---------------------------------------------------------------------------
const REF = /\[?\bRFC[\s-]?(\d{1,5})\b\]?/g;
// Splits text into strings and { n, text } link parts for RFCs that exist. Never changes the words.
export function linkify(text, exists) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(REF)) {
    const n = Number(m[1]);
    if (!exists(n)) continue;
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ n, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// ---- reflow (optional prose mode) ---------------------------------------------------------------
// Paragraphs of ordinary prose are joined into flowing text; anything that looks like a figure, table, code or a list
// stays exactly as published. Returns [{ pre: boolean, text }].
export function paragraphs(text) {
  return text.replace(/\n$/, '').split(/\n{2,}/).filter(p => p.trim()).map(p => {
    const lines = p.split('\n');
    const indents = lines.map(l => l.match(/^ */)[0].length);
    const flowing = lines.every(l => !/[^.?!:)"'\]] {2,}\S/.test(l.trim()) && !/^\s*[-*o+]\s|^\s*\d+[.)]\s|^\s*\[\d+\]/.test(l)) && Math.max(...indents) - Math.min(...indents) <= 0 && Math.min(...indents) <= 3;
    return flowing && lines.length > 0 ? { pre: false, text: lines.map(l => l.trim()).join(' ') } : { pre: true, text: p };
  });
}
