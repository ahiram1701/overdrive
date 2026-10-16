import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmt, clamp } from '../../js/state.js';

test('fmt abrevia números grandes', () => {
  assert.equal(fmt(0), '0');
  assert.equal(fmt(999.9), '999');
  assert.equal(fmt(1234), '1.2K');
  assert.equal(fmt(3_400_000), '3.4M');
  assert.equal(fmt(150_000), '150K');
  assert.equal(fmt(7.2e9), '7.2B');
});

test('clamp limita al rango', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
});
