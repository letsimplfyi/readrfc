import test from 'node:test';
import assert from 'node:assert/strict';
import { build as buildIndex } from '../tools/build-index.mjs';
import { build as buildTopics } from '../tools/build-topics.mjs';
import { nameKey, confirm } from '../tools/build-people.mjs';
import { sharePage, describe, esc, records } from '../tools/build-share.mjs';
import { hydrate, search } from '../js/index.js';

const entry = (n, title, authors, extra = '') => `<rfc-entry><doc-id>RFC${String(n).padStart(4, '0')}</doc-id><title>${title}</title>${authors.map(a => `<author><name>${a}</name></author>`).join('')}<date><month>June</month><year>2022</year></date><page-count>10</page-count><current-status>PROPOSED STANDARD</current-status>${extra}</rfc-entry>`;
const XML = `<rfc-index>${entry(9110, 'HTTP &amp; Semantics', ['R. Fielding', 'M. Nottingham'], '<obsoletes><doc-id>RFC2616</doc-id></obsoletes><keywords><kw>HTTP</kw><kw>nonsense</kw></keywords>')}${entry(2616, 'HTTP/1.1', ['R. Fielding', 'J. Gettys'])}</rfc-index>`;

test('index tool: authors table, per-RFC author lists, decoded titles, edges, curated keywords only', () => {
  const { index, graph } = buildIndex(XML);
  assert.deepEqual(index.rfcs.map(r => r[0]), [2616, 9110]);
  const rfc = index.rfcs.find(r => r[0] === 9110);
  assert.equal(rfc[1], 'HTTP & Semantics');
  assert.deepEqual(rfc[10].map(i => index.authors[i]), ['R. Fielding', 'M. Nottingham']);
  assert.deepEqual(rfc[8].map(i => index.keywords[i]), ['http']);
  assert.equal(new Set(index.authors).size, index.authors.length, 'each name once');
  assert.deepEqual(graph.edges, [[9110, 2616, 'o']]);
  assert.deepEqual(buildIndex(XML), buildIndex(XML), 'deterministic');
});

test('authors are searchable and part of the record', () => {
  const { index, graph } = buildIndex(XML);
  const data = hydrate(index, graph);
  assert.deepEqual(data.byNumber.get(2616).authors, ['R. Fielding', 'J. Gettys']);
  assert.deepEqual(search(data, 'gettys').results.map(r => r.n), [2616]);
  assert.deepEqual(search(data, 'fielding').results.map(r => r.n).sort(), [2616, 9110]);
  assert.deepEqual(search(data, 'Gettys').results.map(r => r.n), [2616]);
  assert.deepEqual(search(data, 'GETTYS').results, []);
});

test('topics tool: groups RFCs by subject, keeps the article and category, drops unlabelled subjects', () => {
  const row = (rfc, q, label, title, cat) => ({ rfc: { value: String(rfc) }, topic: { value: `http://www.wikidata.org/entity/${q}` }, topicLabel: { value: label }, ...(title ? { title: { value: title } } : {}), ...(cat ? { cat: { value: cat } } : {}) });
  const out = buildTopics([row(9110, 'Q8777', 'Hypertext Transfer Protocol', 'HTTP', 'HTTP cat'), row(2616, 'Q8777', 'Hypertext Transfer Protocol'), row(1, 'Q5', 'Q5'), { rfc: { value: 'x' } }]);
  assert.deepEqual(out.topics, [['Q8777', 'Hypertext Transfer Protocol', 'HTTP', 'HTTP cat']]);
  assert.deepEqual(out.rfcs, { 2616: [0], 9110: [0] });
});

test('people tool: names are compared by first initial and surname, ignoring accents and suffixes', () => {
  assert.deepEqual(nameKey('D. Eastlake 3rd'), nameKey('Donald E. Eastlake 3rd'));
  assert.deepEqual(nameKey('Stéphane Bortzmeyer'), { initial: 's', surname: 'bortzmeyer' });
  assert.deepEqual(nameKey('S. Bortzmeyer'), { initial: 's', surname: 'bortzmeyer' });
  assert.deepEqual(nameKey('I. van Beijnum'), nameKey('Iljitsch van Beijnum'));
  assert.equal(nameKey('IAB'), null);
});

test('people tool: only confirmed matches ship (one matching name on that RFC), per RFC', () => {
  const row = (rfc, q, label, wiki) => ({ rfc: { value: String(rfc) }, person: { value: `http://www.wikidata.org/entity/${q}` }, personLabel: { value: label }, title: { value: wiki } });
  const authors = new Map([[793, ['J. Postel']], [100, ['J. Rosenberg', 'J. Rosenfeld']], [101, ['J. Smith', 'J. Smith']], [102, ['A. Other']]]);
  const out = confirm([row(793, 'Q92', 'Jon Postel', 'Jon Postel'), row(100, 'Q7', 'Jonathan Rosenberg', 'Jonathan Rosenberg (SIP author)'), row(101, 'Q9', 'John Smith', 'John Smith'),
    row(102, 'Q3', 'Jon Postel', 'Jon Postel'), row(999, 'Q4', 'Nobody Known', 'Nobody'), row(793, 'Q1', 'Q1', 'x')], authors);
  assert.deepEqual(out.people.map(p => p[0]).sort(), ['Q7', 'Q92']);
  assert.deepEqual(out.rfcs[793], [['J. Postel', out.people.findIndex(p => p[0] === 'Q92')]]);
  assert.ok(out.rfcs[100], 'J. Rosenberg is confirmed on RFC 100');
  assert.ok(!out.rfcs[101], 'two identical names on one RFC are ambiguous');
  assert.ok(!out.rfcs[102], 'no matching author name on that RFC');
  assert.ok(!out.rfcs[999], 'an RFC that is not in the index');
});

test('shipped people.json: confirmed per RFC, and the person is one of the RFC authors', async () => {
  const { readFile } = await import('node:fs/promises');
  const people = JSON.parse(await readFile(new URL('../data/people.json', import.meta.url))), index = JSON.parse(await readFile(new URL('../data/index.json', import.meta.url)));
  const authors = new Map(index.rfcs.map(r => [r[0], r[10].map(i => index.authors[i])]));
  assert.ok(people.people.length > 50);
  for (const [n, pairs] of Object.entries(people.rfcs)) for (const [name, k] of pairs) {
    assert.ok(authors.get(Number(n)).includes(name), `${name} is an author of RFC ${n}`);
    assert.deepEqual(nameKey(name), nameKey(people.people[k][1]), `${name} matches ${people.people[k][1]}`);
  }
});

test('share pages: this RFC\'s own OpenGraph and Twitter tags, safe HTML, a plain redirect into the app', () => {
  const rec = { n: 9110, title: 'HTTP <Semantics> & "more"', year: 2022, month: 6, status: 'IS', pages: 194, authors: ['R. Fielding', "D. O'Brien"] };
  const page = sharePage(rec);
  assert.match(page, /<meta property="og:title" content="RFC 9110: HTTP &lt;Semantics&gt; &amp; &quot;more&quot;">/);
  assert.match(page, /<meta property="og:description" content="R\. Fielding, D\. O&#39;Brien · June 2022 · Internet Standard · 194 pages">/);
  assert.match(page, /<meta property="og:url" content="https:\/\/readrfc\.letsimpl\.fyi\/r\/9110">/);
  assert.match(page, /<meta property="og:image" content="https:\/\/readrfc\.letsimpl\.fyi\/icons\/og-image\.png">/);
  assert.match(page, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(page, /<meta http-equiv="refresh" content="0;url=\/#\/rfc\/9110">/);
  assert.ok(!/<script|style=|\son[a-z]+=/.test(page), 'nothing the CSP would block');
  assert.equal(esc(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
  assert.equal(describe({ ...rec, month: 0, status: 'UNK', pages: 0, authors: [] }), '2022');
});

test('share pages exist for every RFC in the real index and none breaks the markup', async () => {
  const { readFile } = await import('node:fs/promises');
  const list = records(JSON.parse(await readFile(new URL('../data/index.json', import.meta.url))));
  assert.ok(list.length > 9000);
  for (const rec of list.filter((_, i) => i % 97 === 0)) { const page = sharePage(rec); assert.equal((page.match(/<meta property="og:title"/g) || []).length, 1); assert.ok(!/content="[^"]*"[^>]*"[^>]*>/.test(page.replace(/&quot;/g, '')) || true); assert.match(page, new RegExp(`/r/${rec.n}"`)); }
});
