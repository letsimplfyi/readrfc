// Builds data/people.json: authors who are confirmed to be a known person on Wikidata with an English Wikipedia article.
// "Confirmed" means: Wikidata says this person is an author of RFC n, AND exactly one author name in the RFC Editor's index for that
// RFC matches the person (same first initial and surname). Confirmation is per RFC, so a different person who shares a name on some
// other RFC never inherits anyone's biography. Anything uncertain is left out.
// Runs in CI after the index and topics (weekly) and by hand: `npm run people`. Wikidata is contacted here only.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const OUT = new URL('../data/', import.meta.url);
const UA = 'readrfc-index/0.1 (https://readrfc.letsimpl.fyi; https://github.com/letsimplfyi/readrfc)';
const QUERY = `SELECT ?rfc ?person ?personLabel ?title WHERE {
  ?item wdt:P892 ?rfc ; wdt:P50 ?person .
  ?art schema:about ?person ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

const SUFFIX = new Set(['jr', 'sr', 'ii', 'iii', 'iv', '2nd', '3rd', '4th', 'ed', 'phd']);
const plain = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// "D. Eastlake 3rd" and "Donald E. Eastlake 3rd" both become { initial: 'd', surname: 'eastlake' }.
export function nameKey(name) {
  const tokens = plain(String(name)).replace(/[(),]/g, ' ').split(/\s+/).map(t => t.replace(/\.$/, '')).filter(t => t && !SUFFIX.has(t));
  if (tokens.length < 2) return null;
  return { initial: tokens[0][0], surname: tokens.at(-1) };
}
const same = (a, b) => a && b && a.initial === b.initial && a.surname === b.surname;

// rows: Wikidata bindings. authorsByRfc: Map rfc number -> author names from the index.
export function confirm(rows, authorsByRfc) {
  const people = new Map(), rfcs = new Map();
  for (const r of rows) {
    const n = Number(r.rfc?.value), q = (r.person?.value || '').split('/').pop(), label = r.personLabel?.value, wiki = r.title?.value;
    if (!Number.isInteger(n) || !/^Q\d+$/.test(q) || !label || label === q || !wiki) continue;
    const key = nameKey(label), names = authorsByRfc.get(n);
    if (!key || !names) continue;
    const hits = names.filter(name => same(nameKey(name), key));
    if (hits.length !== 1) continue; // none, or ambiguous: not confirmed
    people.set(q, { q, label, wiki });
    if (!rfcs.has(n)) rfcs.set(n, new Map());
    rfcs.get(n).set(hits[0], q); // a name on one RFC belongs to one person
  }
  const list = [...people.values()].sort((a, b) => (a.q.length - b.q.length) || (a.q < b.q ? -1 : 1));
  const at = new Map(list.map((p, i) => [p.q, i]));
  return {
    v: 1,
    people: list.map(p => [p.q, p.label, p.wiki]),
    rfcs: Object.fromEntries([...rfcs].sort((a, b) => a[0] - b[0]).map(([n, m]) => [n, [...m].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([name, q]) => [name, at.get(q)])])),
  };
}

async function query() {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(QUERY)}`, { headers: { accept: 'application/sparql-results+json', 'user-agent': UA } });
    if (res.ok && (res.headers.get('content-type') || '').includes('json')) return (await res.json()).results.bindings;
    console.error(`Wikidata answered ${res.status}; retrying in ${attempt * 20}s`);
    await new Promise(done => setTimeout(done, attempt * 20000));
  }
  throw new Error('Wikidata did not answer');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const index = JSON.parse(await readFile(new URL('index.json', OUT), 'utf8'));
  const authorsByRfc = new Map(index.rfcs.map(r => [r[0], r[10].map(i => index.authors[i])]));
  const out = confirm(await query(), authorsByRfc);
  await mkdir(OUT, { recursive: true });
  const body = JSON.stringify(out);
  await writeFile(new URL('people.json', OUT), body + '\n');
  console.log(`people.json ${body.length} bytes: ${out.people.length} people confirmed on ${Object.keys(out.rfcs).length} RFCs`);
}
