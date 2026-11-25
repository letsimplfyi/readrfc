import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, homeHref, rfcHref } from '../js/route.js';

test('routes round-trip', () => {
  assert.deepEqual(parseRoute('#/rfc/9110'), { view: 'rfc', n: 9110, section: '' });
  assert.deepEqual(parseRoute(rfcHref(9110, 'section-5.1')), { view: 'rfc', n: 9110, section: 'section-5.1' });
  assert.deepEqual(parseRoute(homeHref('secure http')), { view: 'home', q: 'secure http' });
  assert.deepEqual(parseRoute(homeHref('')), { view: 'home', q: '' });
});

test('unknown or malformed routes fall back to home, never an error', () => {
  for (const hash of ['', '#', '#/rfc', '#/rfc/abc', '#/rfc/0', '#/rfc/123456', '#/nope', '#/rfc/%E0%A4%A']) assert.equal(parseRoute(hash).view, 'home', hash);
  assert.equal(parseRoute('#/rfc/9110/<script>').section, '');
  assert.equal(parseRoute('#/?q=' + 'x'.repeat(500)).q.length, 200);
});

test('graph routes round-trip and bad ones fall back to the chooser', async () => {
  const { graphHref, tagHref } = await import('../js/route.js');
  const cases = [
    { view: 'graph', kind: 'choose', sel: null },
    { view: 'graph', kind: 'rfc', n: 9110, hops: 1, sel: null },
    { view: 'graph', kind: 'rfc', n: 9110, hops: 2, sel: 2616 },
    { view: 'graph', kind: 'tag', tag: 'kw', value: 'congestion control', sel: null },
    { view: 'graph', kind: 'tag', tag: 'wg', value: 'httpbis', sel: 9110 },
    { view: 'graph', kind: 'year', from: 1998, to: 2003, sel: null },
  ];
  for (const c of cases) assert.deepEqual(parseRoute(graphHref(c, c.sel)), c, graphHref(c, c.sel));
  assert.equal(tagHref('area', 'sec'), '#/graph/tag/area%3Asec');
  for (const hash of ['#/graph/rfc/abc', '#/graph/tag/bogus:x', '#/graph/tag/area:%3Cb%3E', '#/graph/year/2003-1998', '#/graph/year/1800-1900', '#/graph/nope']) assert.deepEqual(parseRoute(hash), { view: 'graph', kind: 'choose', sel: null }, hash);
});
