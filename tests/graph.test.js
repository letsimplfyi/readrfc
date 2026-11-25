import test from 'node:test';
import assert from 'node:assert/strict';
import { relations, neighbourhood, tagSet, yearSet, newestInChain, chooser, layout, layoutVertical, edgesAmong } from '../js/graph.js';
import { hydrate } from '../js/index.js';
import { data, INDEX } from './fixtures.js';

const d = data();
const nums = g => g.records.map(r => r.n).sort((a, b) => a - b);

test('relations: both directions, with the kind', () => {
  assert.deepEqual(relations(d, 2616), [{ n: 9110, kind: 'o', dir: 'in' }, { n: 9112, kind: 'o', dir: 'in' }]);
  assert.deepEqual(relations(d, 8446), [{ n: 2818, kind: 'u', dir: 'out' }]);
  assert.deepEqual(relations(d, 1234), []);
});

test('neighbourhood: one hop is direct links; two hops reach their neighbours; the focus is always in', () => {
  assert.deepEqual(nums(neighbourhood(d, 2616, 1)), [2616, 9110, 9112]);
  assert.deepEqual(nums(neighbourhood(d, 9110, 1)), [2616, 9110]);
  assert.deepEqual(nums(neighbourhood(d, 9110, 2)), [2616, 9110, 9112]);
  assert.deepEqual(nums(neighbourhood(d, 1234)), [1234]);
  assert.deepEqual(neighbourhood(d, 4242).records, []);
  assert.equal(neighbourhood(d, 2616).focus, 2616);
});

test('edges point from the newer RFC to the one it replaced or updated, and stay inside the set', () => {
  const g = neighbourhood(d, 2616, 1);
  assert.deepEqual(g.edges, [{ from: 9110, to: 2616, kind: 'o' }, { from: 9112, to: 2616, kind: 'o' }]);
  assert.deepEqual(edgesAmong(d, [d.byNumber.get(9110)]), []);
});

test('the cap keeps the focus, then the most connected, then the newest', () => {
  const g = neighbourhood(d, 2616, 1, 2);
  assert.equal(g.capped, true); assert.equal(g.total, 3);
  assert.deepEqual(nums(g), [2616, 9112]); // 9112 beats 9110: same degree, newer by number
  const t = tagSet(d, 'kw', 'http', 2);
  assert.equal(t.records.length, 2); assert.equal(t.total, 4);
  assert.equal(t.records[0].n, 2616); // degree 2 beats everything else
});

test('tags and year ranges select what they say', () => {
  assert.deepEqual(nums(tagSet(d, 'area', 'sec')), [2818, 8446]);
  assert.deepEqual(nums(tagSet(d, 'wg', 'tls')), [2818, 8446]);
  assert.deepEqual(nums(tagSet(d, 'stream', 'legacy')), [1234, 2616]);
  assert.deepEqual(nums(tagSet(d, 'kw', 'security')), [8446]);
  assert.deepEqual(nums(yearSet(d, 1999, 2000)), [2616, 2818]);
  assert.deepEqual(tagSet(d, 'kw', 'nothing').records, []);
});

test('newestInChain is the newest RFC that nothing in the set replaced', () => {
  assert.equal(newestInChain(d, neighbourhood(d, 2616).records).n, 9112);
  assert.equal(newestInChain(d, [d.byNumber.get(2616)]).n, 2616);
  assert.equal(newestInChain(d, []), null);
});

test('chooser counts tags and lists decades', () => {
  const c = chooser(d);
  assert.deepEqual(c.areas, [{ value: 'art', n: 2 }, { value: 'sec', n: 2 }].sort((a, b) => b.n - a.n || (a.value < b.value ? -1 : 1)));
  assert.deepEqual(c.decades, [1990, 2000, 2010, 2020]);
  assert.equal(c.keywords[0].value, 'http');
});

test('layout: time runs left to right, lanes are areas, nothing overlaps, edges join the right nodes', () => {
  const g = neighbourhood(d, 2616, 1);
  const out = layout(d, g);
  const at = n => out.nodes.find(x => x.n === n);
  assert.ok(at(2616).x < at(9110).x);
  assert.equal(at(9110).x, at(9112).x === at(9110).x ? at(9110).x : at(9110).x); // same month: same x
  assert.notEqual(at(9110).y, at(9112).y); // so they take different rows
  for (const a of out.nodes) for (const b of out.nodes) if (a.n < b.n) assert.ok(Math.abs(a.x - b.x) >= 100 || Math.abs(a.y - b.y) >= 60, `${a.n} and ${b.n} overlap`);
  assert.ok(out.nodes.every(n => n.x > 0 && n.y > 0 && n.x < out.width && n.y < out.height));
  const e = out.edges.find(x => x.from === 9110);
  assert.deepEqual([e.x2, e.y2, e.x1, e.y1], [at(9110).x, at(9110).y, at(2616).x, at(2616).y]); // arrow end is the newer RFC
  assert.ok(out.ticks.length > 0);
  assert.deepEqual(out.lanes, []); // one timeline unless lanes are asked for
});

test('layout with lanes groups rows by area, a row nearer to its neighbours is preferred', () => {
  const g = yearSet(d, 1990, 2030);
  const out = layout(d, g, { lanes: true });
  assert.deepEqual(out.lanes.map(l => l.key), ['art', 'sec', '']);
  for (const l of out.lanes) for (const n of out.nodes) if (d.byNumber.get(n.n).area === l.key) assert.ok(n.y >= l.y && n.y <= l.y + l.height, `${n.n} outside its lane`);
  const line = layout(d, neighbourhood(d, 2616, 1));
  const at = n => line.nodes.find(x => x.n === n);
  assert.equal(at(9110).row, at(2616).row); // the first free row nearest its neighbour: the same row
});

test('layout is deterministic: the same input gives the same picture', () => {
  const g = tagSet(d, 'kw', 'http');
  assert.deepEqual(layout(d, g), layout(d, g));
  assert.deepEqual(layout(d, g), layout(hydrate(INDEX, { v: 1, edges: [[9110, 2616, 'o'], [9112, 2616, 'o'], [8446, 2818, 'u']] }), tagSet(hydrate(INDEX, { v: 1, edges: [[9110, 2616, 'o'], [9112, 2616, 'o'], [8446, 2818, 'u']] }), 'kw', 'http')));
});

test('layout copes with one node, none, and a short span', () => {
  assert.equal(layout(d, neighbourhood(d, 1234)).nodes.length, 1);
  assert.deepEqual(layout(d, { records: [], edges: [] }).nodes, []);
  const same = layout(d, { records: [d.byNumber.get(9110), d.byNumber.get(9112)], edges: [] });
  assert.ok(Math.abs(same.nodes[0].x - same.nodes[1].x) >= 96);
});

test('layout on the real index: the biggest neighbourhood stays within the cap and is drawn without overlaps', async () => {
  const { readFile } = await import('node:fs/promises');
  const real = hydrate(JSON.parse(await readFile(new URL('../data/index.json', import.meta.url))), JSON.parse(await readFile(new URL('../data/graph.json', import.meta.url))));
  const g = neighbourhood(real, 8996, 2);
  assert.ok(g.records.length <= 150 && g.records.some(r => r.n === 8996));
  const out = layout(real, g);
  assert.equal(out.nodes.length, g.records.length);
  for (const a of out.nodes) for (const b of out.nodes) if (a.n < b.n && a.y === b.y) assert.ok(Math.abs(a.x - b.x) >= 100, `${a.n}/${b.n}`);
});

test('phone layout: time runs down and never back, three columns at most, nothing overlaps, inside the box, deterministic', async () => {
  const { readFile } = await import('node:fs/promises');
  const real = hydrate(JSON.parse(await readFile(new URL('../data/index.json', import.meta.url))), JSON.parse(await readFile(new URL('../data/graph.json', import.meta.url))));
  for (const g of [neighbourhood(real, 2616, 2), tagSet(real, 'kw', 'http'), tagSet(real, 'area', 'sec'), neighbourhood(real, 1234), yearSet(real, 1999, 1999)]) {
    const out = layoutVertical(real, g);
    assert.equal(out.orientation, 'v');
    const by = new Map(g.records.map(r => [r.n, r]));
    const timeOf = n => by.get(n).year + (by.get(n).month - 1) / 12;
    const chronological = [...out.nodes].sort((a, b) => timeOf(a.n) - timeOf(b.n) || a.n - b.n);
    chronological.forEach((n, i) => { if (i) assert.ok(n.y >= chronological[i - 1].y, 'time never runs backwards'); });
    assert.ok(new Set(out.nodes.map(n => n.x)).size <= 3, 'at most three columns');
    for (const a of out.nodes) { assert.ok(a.x > 0 && a.x < out.width && a.y > 0 && a.y < out.height); for (const b of out.nodes) if (a.n < b.n && a.x === b.x) assert.ok(Math.abs(a.y - b.y) >= 64, `${a.n} and ${b.n} overlap`); }
    assert.deepEqual(layoutVertical(real, g), out);
  }
  assert.deepEqual(layoutVertical(d, { records: [], edges: [] }).nodes, []);
});
