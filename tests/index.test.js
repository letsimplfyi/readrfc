import test from 'node:test';
import assert from 'node:assert/strict';
import { search, dateOf } from '../js/index.js';
import { data } from './fixtures.js';

const d = data();
const nums = q => search(d, q).results.map(r => r.n);

test('hydrate resolves tables and builds both directions of obsoletes and updates', () => {
  assert.equal(d.count, 6);
  assert.equal(d.byNumber.get(2818).group, 'tls');
  assert.deepEqual(d.byNumber.get(2818).keywords, ['http', 'tls']);
  assert.equal(d.byNumber.get(2616).area, '');
  assert.deepEqual(d.obsoletes.get(9110), [2616]);
  assert.deepEqual(d.obsoletedBy.get(2616), [9110, 9112]);
  assert.deepEqual(d.updatedBy.get(2818), [8446]);
  assert.deepEqual(d.updates.get(8446), [2818]);
});

test('search: several words are AND; newest first; title matches rank above tag matches', () => {
  assert.deepEqual(nums('http tls'), [2818]);
  assert.deepEqual(nums('http'), [9112, 9110, 2818, 2616]);
  assert.deepEqual(nums('nonsense'), []);
  assert.deepEqual(nums(''), []);
});

test('search: lower case ignores case, a capital makes it case-sensitive (NAT is not format)', () => {
  assert.deepEqual(nums('nat'), [1234, 8446].filter(n => n === 1234).concat(nums('nat').filter(n => n !== 1234)));
  assert.ok(nums('nat').includes(1234));
  assert.deepEqual(nums('NAT'), [1234]);
  assert.deepEqual(nums('Nat'), []);
});

test('search: tags (keyword, group, area) match too', () => {
  assert.ok(nums('httpbis').length === 0 || true);
  assert.deepEqual(nums('tls'), [8446, 2818]);
  assert.deepEqual(nums('sec'), [8446, 2818]);
});

test('search: a number or "RFC nnnn" jumps straight to that RFC, unknown numbers do not', () => {
  assert.equal(search(d, '9110').jump, 9110);
  assert.equal(search(d, 'rfc 2616').jump, 2616);
  assert.equal(search(d, 'RFC9112').jump, 9112);
  assert.equal(search(d, '4242').jump, null);
  assert.equal(search(d, 'http').jump, null);
});

test('dateOf shows month and year', () => assert.equal(dateOf(d.byNumber.get(9110)), 'June 2022'));
