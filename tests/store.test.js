import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanNumbers, cleanPositions, pushFront, toggle } from '../js/store.js';

test('stored lists are untrusted: only positive RFC numbers, no duplicates, capped', () => {
  assert.deepEqual(cleanNumbers([1, '2', 3.5, -4, 9999999, 1, null, 5], 10), [1, 5]);
  assert.deepEqual(cleanNumbers('nope', 10), []);
  assert.deepEqual(cleanNumbers([1, 2, 3, 4], 2), [1, 2]);
});
test('stored positions: only numeric keys with safe section ids', () => {
  assert.deepEqual(cleanPositions({ 9110: 'section-5.1', abc: 'section-1', 12: '<b>', 13: 5 }), { 9110: 'section-5.1' });
  assert.deepEqual(cleanPositions([1, 2]), {});
  assert.deepEqual(cleanPositions(null), {});
});
test('recent and favourites helpers', () => {
  assert.deepEqual(pushFront([1, 2, 3], 3, 3), [3, 1, 2]);
  assert.deepEqual(pushFront([1, 2, 3], 4, 3), [4, 1, 2]);
  assert.deepEqual(toggle([1, 2], 2, 5), [1]);
  assert.deepEqual(toggle([1, 2], 3, 5), [3, 1, 2]);
});
