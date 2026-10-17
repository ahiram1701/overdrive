import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAPS, capStats, stackValue, STACKS, vampireNeed } from '../../js/balance.js';
import { baseStats, applyCard, CARD_BY_ID, SHIPS, applyShipTree } from '../../js/upgrades.js';

const run = () => ({ stats: baseStats(), cards: {}, synergies: new Set(), shields: 0, dashCharges: 1, player: { lane: 0 } });

test('topes: ninguna combinación pasa de ellos', () => {
  const r = run();
  SHIPS.find((s) => s.id === 'nova').apply(r);
  applyShipTree(r, { a: 3, b: 3, c: 3 });
  for (const id of ['cargador', 'cargador', 'cargador', 'odplus', 'odplus', 'odplus', 'carga', 'recarga', 'recarga', 'recarga']) applyCard(r, id);
  capStats(r);
  assert.ok(r.stats.odRate <= CAPS.odRate);
  assert.ok(r.stats.odDur <= CAPS.odDur);
  assert.ok(r.stats.dashMax <= CAPS.dashMax);
  assert.ok(r.stats.dashRecharge >= CAPS.dashRechargeMin);
  assert.ok(r.dashCharges <= r.stats.dashMax);
});

test('rendimientos decrecientes: cada copia vale menos', () => {
  for (const [id, steps] of Object.entries(STACKS)) {
    for (let n = 2; n <= steps.length; n++) {
      // Recarga multiplica (menos efecto = más cerca de 1); las demás suman
      const prev = stackValue(steps, n - 1), cur = stackValue(steps, n);
      assert.ok(id === 'recarga' ? cur > prev : cur < prev, `${id} copia ${n}`);
    }
  }
  const r = run();
  applyCard(r, 'cargador');
  applyCard(r, 'cargador');
  assert.ok(Math.abs(r.stats.odRate - (1 + 0.35 + 0.25)) < 1e-9);
  assert.equal(CARD_BY_ID.cargador.descN(3), 'El OVERDRIVE se llena un 15% más rápido.');
  assert.equal(CARD_BY_ID.carga.max, 1, 'Doble carga solo una vez');
});

test('Vampiro pide cada vez más', () => {
  assert.equal(vampireNeed(0), 12);
  assert.ok(vampireNeed(1) > vampireNeed(0) && vampireNeed(2) > vampireNeed(1));
});
