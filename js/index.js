// Loads data/index.json and data/graph.json once; search and lookups. Pure apart from the fetch.
import { STATUS_NAMES, STREAM_NAMES, MONTH_NAMES } from './config.js';
import { parseNumber } from './rfc.js';

export function hydrate(index, graph, topics = null, people = null) {
  const byNumber = new Map();
  for (const [n, t, y, m, s, x, a, w, k, p, u = []] of index.rfcs) {
    byNumber.set(n, { n, title: t, year: y, month: m, status: s, stream: x >= 0 ? index.streams[x] : '', area: a >= 0 ? index.areas[a] : '', group: w >= 0 ? index.groups[w] : '',
      keywords: k.map(i => index.keywords[i]), pages: p, authors: u.map(i => index.authors[i]) });
  }
  const topicByQ = new Map();
  if (topics) {
    const list = topics.topics.map(([q, label, wiki, cat]) => ({ q, label, wiki, cat }));
    list.forEach(t => topicByQ.set(t.q, t));
    for (const [n, idx] of Object.entries(topics.rfcs)) { const r = byNumber.get(Number(n)); if (r) r.topics = idx.map(k => list[k]).filter(Boolean); }
  }
  for (const r of byNumber.values()) { r.topics ||= []; r.people = []; r.authorsFold = r.authors.map(a => a.toLowerCase()); }
  const personByName = new Map(); // author name -> the one confirmed person, when every confirmation agrees
  if (people) {
    const list = people.people.map(([q, label, wiki]) => ({ q, label, wiki, cat: '' })), seen = new Map();
    for (const [n, pairs] of Object.entries(people.rfcs)) {
      const r = byNumber.get(Number(n));
      for (const [name, k] of pairs) {
        if (!list[k]) continue;
        if (r) r.people.push({ name, ...list[k] });
        if (!seen.has(name)) seen.set(name, new Set());
        seen.get(name).add(k);
      }
    }
    for (const [name, ks] of seen) if (ks.size === 1) personByName.set(name, list[[...ks][0]]);
  }
  const obsoletes = new Map(), obsoletedBy = new Map(), updates = new Map(), updatedBy = new Map();
  const add = (map, key, value) => { if (!map.has(key)) map.set(key, []); map.get(key).push(value); };
  for (const [from, to, kind] of graph.edges) {
    if (kind === 'o') { add(obsoletes, from, to); add(obsoletedBy, to, from); } else { add(updates, from, to); add(updatedBy, to, from); }
  }
  return { byNumber, topicByQ, personByName, obsoletes, obsoletedBy, updates, updatedBy, count: byNumber.size };
}

let loading = null;
export function loadIndex() {
  loading ||= Promise.all([fetch('./data/index.json').then(r => r.json()), fetch('./data/graph.json').then(r => r.json()), fetch('./data/topics.json').then(r => r.json()).catch(() => null), fetch('./data/people.json').then(r => r.json()).catch(() => null)])
    .then(([i, g, t, p]) => hydrate(i, g, t, p)).catch(error => { loading = null; throw error; });
  return loading;
}

export const statusName = code => STATUS_NAMES[code] || code;
export const streamName = key => STREAM_NAMES[key] || key;
export const dateOf = r => (r.month ? `${MONTH_NAMES[r.month - 1]} ${r.year}` : String(r.year || ''));

// Rules copied from rfcreader.com: several words are AND; a lower-case query is case-insensitive, any capital letter makes
// it case-sensitive; a title match is a substring. Words also match a tag (keyword, group, area) or the RFC number.
// Returns { jump, results }: `jump` is the RFC number when the whole query is just a number or "RFC nnnn".
export function search(data, query) {
  const q = String(query || '').trim();
  if (!q) return { jump: null, results: [] };
  const n = parseNumber(q);
  if (n) return { jump: data.byNumber.has(n) ? n : null, results: [] };
  const sensitive = /[A-Z]/.test(q);
  const fold = s => (sensitive ? s : s.toLowerCase());
  const words = q.split(/\s+/).map(fold);
  const hits = [];
  for (const r of data.byNumber.values()) {
    const title = fold(r.title), tags = [...r.keywords, r.group, r.area].filter(Boolean).map(fold), people = sensitive ? r.authors : r.authorsFold;
    let inTitle = 0, ok = true;
    for (const w of words) {
      if (title.includes(w)) inTitle++;
      else if (!(tags.some(t => t === w || t.includes(w)) || people.some(p => p.includes(w)) || String(r.n) === w)) { ok = false; break; }
    }
    if (ok) hits.push({ r, inTitle });
  }
  hits.sort((a, b) => (b.inTitle - a.inTitle) || (b.r.year - a.r.year) || (b.r.n - a.r.n));
  return { jump: null, results: hits.map(h => h.r) };
}
