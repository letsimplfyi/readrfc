// Builds data/topics.json from Wikidata: the protocol or subject each RFC is about ("main subject"), its English Wikipedia
// article and its Commons category. Runs in CI after the index (weekly) and by hand: `npm run topics`.
// This is the only place Wikidata is contacted; the app itself never talks to it. Output is deterministic.
import { writeFile, mkdir } from 'node:fs/promises';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const OUT = new URL('../data/', import.meta.url);
const UA = 'readrfc-index/0.1 (https://readrfc.letsimpl.fyi; https://github.com/letsimplfyi/readrfc)';
const QUERY = `SELECT ?rfc ?topic ?topicLabel ?title ?cat WHERE {
  ?item wdt:P892 ?rfc ; wdt:P921 ?topic .
  OPTIONAL { ?art schema:about ?topic ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title . }
  OPTIONAL { ?topic wdt:P373 ?cat . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

export function build(rows) {
  const topics = new Map(), rfcs = new Map();
  for (const r of rows) {
    const rfc = Number(r.rfc?.value), q = (r.topic?.value || '').split('/').pop();
    if (!Number.isInteger(rfc) || !/^Q\d+$/.test(q)) continue;
    const label = r.topicLabel?.value || '';
    if (!label || label === q) continue;
    const t = topics.get(q) || { q, label, wiki: '', cat: '' };
    if (r.title?.value && !t.wiki) t.wiki = r.title.value;
    if (r.cat?.value && !t.cat) t.cat = r.cat.value;
    topics.set(q, t);
    if (!rfcs.has(rfc)) rfcs.set(rfc, new Set());
    rfcs.get(rfc).add(q);
  }
  const list = [...topics.values()].sort((a, b) => (a.q.length - b.q.length) || (a.q < b.q ? -1 : 1));
  const index = new Map(list.map((t, i) => [t.q, i]));
  return {
    v: 1,
    topics: list.map(t => [t.q, t.label, t.wiki, t.cat]),
    rfcs: Object.fromEntries([...rfcs].sort((a, b) => a[0] - b[0]).map(([n, qs]) => [n, [...qs].map(q => index.get(q)).sort((a, b) => a - b)])),
  };
}

async function query() {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(QUERY)}`, { headers: { accept: 'application/sparql-results+json', 'user-agent': UA } });
    const type = res.headers.get('content-type') || '';
    if (res.ok && type.includes('json')) return (await res.json()).results.bindings;
    console.error(`Wikidata answered ${res.status} (${type}); retrying in ${attempt * 20}s`);
    await new Promise(done => setTimeout(done, attempt * 20000));
  }
  throw new Error('Wikidata did not answer');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const topics = build(await query());
  await mkdir(OUT, { recursive: true });
  const body = JSON.stringify(topics);
  await writeFile(new URL('topics.json', OUT), body + '\n');
  console.log(`topics.json ${body.length} bytes: ${topics.topics.length} topics, ${Object.keys(topics.rfcs).length} RFCs`);
}
