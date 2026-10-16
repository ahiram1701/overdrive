import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseSpeed, baseDist, timeAtDist, trackSpeed } from '../../js/pacing.js';

test('baseDist es la integral de baseSpeed', () => {
  const dt = 1 / 120;
  let d = 0;
  for (let t = 0; t < 120; t += dt) d += baseSpeed(t + dt / 2) * dt;
  assert.ok(Math.abs(d - baseDist(120)) < 0.5, `${d} vs ${baseDist(120)}`);
});

test('timeAtDist invierte baseDist', () => {
  for (const t of [0.5, 10, 60, 240, 900]) {
    assert.ok(Math.abs(timeAtDist(baseDist(t)) - t) < 1e-6);
  }
  assert.equal(timeAtDist(0), 0);
});

test('trackSpeed depende solo de la distancia y crece con ella', () => {
  let prev = 0;
  for (let d = 0; d < 50000; d += 500) {
    const v = trackSpeed(d);
    assert.ok(v >= prev);
    prev = v;
  }
  // con multiplicador, a la misma distancia se va más rápido
  assert.ok(trackSpeed(5000, 1.5) > trackSpeed(5000, 1));
});
