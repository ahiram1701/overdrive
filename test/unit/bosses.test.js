import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOSSES, BOSS_BY_ID, ATTACK_EVERY, bossFor, phaseOf, attackCooldown } from '../../js/bosses.js';

test('6 jefes distintos, cada uno con 2 fases y ataques que existen', () => {
  assert.equal(BOSSES.length, 6);
  assert.equal(new Set(BOSSES.map((b) => b.shape)).size, 6, 'formas distintas');
  for (const b of BOSSES) {
    assert.equal(b.phases.length, 2, b.id);
    for (const ph of b.phases) for (const a of ph) assert.ok(ATTACK_EVERY[a], `${b.id}: ataque ${a}`);
    assert.ok(b.phases[1].length >= b.phases[0].length, `${b.id}: la fase 2 no es más fácil`);
    assert.equal(BOSS_BY_ID[b.id], b);
  }
});

test('los encuentros rotan por los 6 jefes', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((i) => bossFor(i).id), ['gusano', 'ojo', 'devorador', 'censor', 'ovni', 'leviatan', 'gusano']);
});

test('la fase 2 empieza al 50% de vida y acelera los ataques', () => {
  assert.equal(phaseOf(4, 4), 0);
  assert.equal(phaseOf(3, 4), 0);
  assert.equal(phaseOf(2, 4), 1);
  assert.ok(attackCooldown('shots', 2, 1) < attackCooldown('shots', 2, 0));
  assert.ok(attackCooldown('shots', 30, 1) > 0.5, 'nunca demasiado rápido');
});
