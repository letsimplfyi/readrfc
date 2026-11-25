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
  for (const hash of ['', '#', '#/rfc', '#/rfc/abc', '#/rfc/0', '#/rfc/123456', '#/nope', '#/rfc/%E0%A4%A', '#/graph/rfc/1']) assert.equal(parseRoute(hash).view, 'home', hash);
  assert.equal(parseRoute('#/rfc/9110/<script>').section, '');
  assert.equal(parseRoute('#/?q=' + 'x'.repeat(500)).q.length, 200);
});
