import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES, newAbility, trigger, tickAbility, canUse, onNearMissCd, readiness, NEAR_MISS_CD } from '../../js/abilities.js';
import { SHIPS } from '../../js/upgrades.js';

const run = (a, sec, dt = 1 / 60) => {
  const events = [];
  for (let t = 0; t < sec; t += dt) { const e = tickAbility(a, dt); if (e) events.push(e); }
  return events;
};

test('cada nave tiene una habilidad que existe, y las 7 son distintas', () => {
  for (const s of SHIPS) assert.ok(ABILITIES[s.ability], `${s.id} → ${s.ability}`);
  assert.equal(new Set(SHIPS.map((s) => s.ability)).size, SHIPS.length);
});

test('empieza lista; al usarla dura dur, después recarga cd y avisa de que vuelve a estar lista', () => {
  const a = newAbility('overclock');
  assert.ok(canUse(a));
  assert.equal(readiness(a), 1);
  assert.ok(trigger(a));
  assert.ok(!trigger(a), 'no se puede relanzar mientras está activa');
  const ev = run(a, a.dur + a.cd + 0.1);
  assert.deepEqual(ev, ['ended', 'ready']);
  assert.ok(canUse(a));
});

test('las habilidades instantáneas pasan directamente a recarga', () => {
  const a = newAbility('laser');
  trigger(a);
  assert.equal(a.active, 0);
  assert.ok(!canUse(a));
  assert.ok(readiness(a) < 0.01);
  run(a, a.cd + 0.05);
  assert.ok(canUse(a));
});

test('cada near-miss recorta la recarga, pero no durante el efecto', () => {
  const a = newAbility('ram');
  trigger(a);
  onNearMissCd(a);
  assert.equal(a.cdLeft, a.cd, 'activa: no recorta');
  run(a, a.dur + 0.01);
  const before = a.cdLeft;
  onNearMissCd(a);
  assert.ok(Math.abs(before - a.cdLeft - NEAR_MISS_CD) < 1e-9);
});

test('los modificadores del árbol cambian recarga y duración', () => {
  const a = newAbility('phase', { cd: 0.85, dur: 1.3, mut: 'wave' });
  assert.ok(Math.abs(a.cd - ABILITIES.phase.cd * 0.85) < 1e-9);
  assert.ok(Math.abs(a.dur - ABILITIES.phase.dur * 1.3) < 1e-9);
  assert.equal(a.mut, 'wave');
});
