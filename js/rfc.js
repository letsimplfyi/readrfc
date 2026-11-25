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
const MONTH = '(?:January|February|March|April|May|June|July|August|September|October|November|December)';
const HEADER = /^RFC \d+ {2,}(?:.* {2,})?[A-Z][a-z]+ \d{4}\s*$/;
const DATE_ONLY = new RegExp(`^${MONTH} \\d{4}$`); // old running header: the date alone, then an indented title
const FOOTER = /\[Page \d+\]\s*$/;
const SENTENCE_END = /[.:?!)"'\]]\s*$/;

// Removes form feeds, the running header after each page break and the "[Page n]" footer before it. The words are
// never changed. A blank line is kept between pages only where the text before it ends a sentence; otherwise the
// paragraph simply continues on the next page.
export function cleanText(raw) {
  const text = String(raw || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '');
  const pages = text.split('\f').map((page, i) => {
    let lines = page.split('\n');
    while (lines.length && !lines.at(-1).trim()) lines.pop();
    if (lines.length && FOOTER.test(lines.at(-1))) lines.pop();
    if (i > 0) {
      let k = 0;
      while (k < lines.length && !lines[k].trim()) k++;
      if (k < lines.length && HEADER.test(lines[k])) k++;
      else if (k < lines.length && DATE_ONLY.test(lines[k].trim())) { k++; if (k < lines.length && lines[k].trim() && /^ {15,}\S/.test(lines[k]) && lines[k].trim().length < 60) k++; }
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

// The title block of an RFC is laid out for 72 columns: centred titles, two columns, runs of blank lines. For a narrow screen it
// is rewritten as plain short lines. Only whitespace changes; every word stays.
export function tidyFront(text) {
  const out = [];
  for (const line of String(text).replace(/\n$/, '').split('\n')) {
    if (!line.trim()) { if (out.length && out.at(-1) !== '') out.push(''); continue; }
    for (const part of line.trim().split(/ {3,}/)) out.push(part);
  }
  while (out.length && out.at(-1) === '') out.pop();
  return out.join('\n') + '\n';
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
// Ordinary prose is joined into flowing text. Lists become items. Figures, tables, code and anything that is not clearly prose stay
// exactly as published (shown in a block that scrolls sideways, not wrapped). Returns [{ kind: 'p' | 'list' | 'pre', text, items? }].
const MARKER = /^(\s*)(\[[^\]\s]{1,30}\]|[-*+o•]|\(?\d{1,3}[.)]|\(?[a-zA-Z][.)])\s{1,4}(?=\S)/;
const CODEISH = /[{};]\s*$|::=|^\s*(\/\/|\/\*|#|<)|\s=\/\s|\.{4,}/;

function listItems(lines) {
  const items = [];
  for (const line of lines) {
    const m = line.match(MARKER);
    if (m && (!items.length || m[1].length <= items[0].indent)) items.push({ indent: m[1].length, marker: m[2], parts: [line.slice(m[0].length).trim()] });
    else if (items.length) items.at(-1).parts.push(line.trim());
    else return null;
  }
  return items.map(({ marker, parts }) => ({ marker, text: parts.join(' ').replace(/\s+/g, ' ') }));
}

export function paragraphs(text) {
  return text.replace(/^(?:[ \t]*\n)+/, '').replace(/\s+$/, '').split(/\n(?:[ \t]*\n)+/).filter(p => p.trim()).map(p => {
    const lines = p.split('\n');
    if (lines.some(l => CODEISH.test(l)) || lines.some(l => /\S {2,}\S/.test(l.trim()) && !/[.?!:)"'\]] {2,}\S/.test(l.trim()) ) && !MARKER.test(lines[0])) return { kind: 'pre', pre: true, text: p };
    if (MARKER.test(lines[0])) {
      const items = listItems(lines);
      if (items && items.length && items.every(i => i.text)) return { kind: 'list', pre: false, text: p, items };
    }
    const indents = lines.map(l => l.match(/^ */)[0].length);
    const body = lines.slice(0, -1).map(l => l.trim().length);
    const filled = lines.length === 1 ? lines[0].trim().length >= 20 || /[.:]$/.test(lines[0].trim()) : Math.min(...body) >= 40;
    const flowing = filled && Math.max(...indents) - Math.min(...indents) <= 0 && Math.min(...indents) <= 3;
    return flowing ? { kind: 'p', pre: false, text: lines.map(l => l.trim()).join(' ') } : { kind: 'pre', pre: true, text: p };
  });
}
