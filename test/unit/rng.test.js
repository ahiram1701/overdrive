import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, hashString, todayKey } from '../../js/rng.js';

test('la misma semilla produce la misma secuencia (reto diario)', () => {
  const a = makeRng(1234), b = makeRng(1234);
  const sa = Array.from({ length: 50 }, () => a.next());
  const sb = Array.from({ length: 50 }, () => b.next());
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, Array.from({ length: 50 }, makeRng(4321).next));
});

test('next() está en [0, 1) e int() respeta los límites', () => {
  const r = makeRng(7);
  for (let i = 0; i < 2000; i++) {
    const v = r.next();
    assert.ok(v >= 0 && v < 1);
    const n = r.int(-1, 1);
    assert.ok(n >= -1 && n <= 1 && Number.isInteger(n));
  }
});

test('weighted() nunca elige pesos 0 y shuffle() conserva los elementos', () => {
  const r = makeRng(99);
  const items = [{ id: 'a', w: 0 }, { id: 'b', w: 1 }, { id: 'c', w: 3 }];
  for (let i = 0; i < 500; i++) assert.notEqual(r.weighted(items).id, 'a');
  const arr = [1, 2, 3, 4, 5, 6];
  assert.deepEqual([...r.shuffle([...arr])].sort(), arr);
});

test('hashString es estable y todayKey tiene formato AAAA-MM-DD', () => {
  assert.equal(hashString('overdrive-2026-10-16'), hashString('overdrive-2026-10-16'));
  assert.notEqual(hashString('a'), hashString('b'));
  assert.equal(todayKey(new Date(2026, 0, 5)), '2026-01-05');
});
