import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODS, MOD_BY_ID, cleanMods, modScore, modGems, toggleMod, mutationOf, modsUnlocked } from '../../js/modifiers.js';
import { baseStats } from '../../js/upgrades.js';
import { addShields, shieldCap } from '../../js/state.js';

test('12 modificadores con ids únicos, bonus > 1 y rango creciente', () => {
  assert.equal(MODS.length, 12);
  assert.equal(new Set(MODS.map((m) => m.id)).size, 12);
  for (const m of MODS) assert.ok(m.score > 1 && m.score <= 2, m.id);
  assert.deepEqual(modsUnlocked(1).map((m) => m.id), ['turbo'], 'al empezar solo hay uno');
  assert.equal(modsUnlocked(99).length, 12);
});

test('bonus: producto de puntos y gemas con tope', () => {
  assert.equal(modScore([]), 1);
  assert.ok(Math.abs(modScore(['turbo', 'glass']) - 1.3 * 1.6) < 1e-9);
  assert.equal(modGems([]), 1);
  assert.ok(modGems(['turbo']) > 1);
  assert.equal(modGems(MODS.map((m) => m.id)), 3, 'tope x3');
});

test('cleanMods: quita lo bloqueado, lo desconocido, lo repetido y lo que choca', () => {
  assert.deepEqual(cleanMods(['turbo', 'nope', 'turbo', 'glass'], 3), ['turbo']);
  assert.deepEqual(cleanMods(['glass', 'fragile']), ['glass'], 'Cristal y Frágil no van juntos');
  assert.deepEqual(toggleMod(['glass'], 'fragile'), ['fragile'], 'activar uno quita su rival');
  assert.deepEqual(toggleMod(['turbo', 'mines'], 'turbo'), ['mines']);
});

test('mutación del día: determinista, 2 distintos y compatibles', () => {
  for (const day of ['2026-10-17', '2026-10-18', '2027-01-01']) {
    const m = mutationOf(day);
    assert.deepEqual(m, mutationOf(day));
    assert.equal(m.length, 2);
    assert.deepEqual(cleanMods(m), m);
  }
  const days = new Set(Array.from({ length: 20 }, (_, i) => mutationOf(`2026-11-${String(i + 1).padStart(2, '0')}`).join()));
  assert.ok(days.size >= 10, 'cambia de un día a otro');
});

test('apply: Cristal y Frágil limitan los escudos; Sin DASH quita las cargas', () => {
  const r = { stats: baseStats(), shields: 0, dashCharges: 1 };
  MOD_BY_ID.fragile.apply(r);
  addShields(r, 3);
  assert.equal(r.shields, 1);
  MOD_BY_ID.glass.apply(r);
  assert.equal(shieldCap(r), 0);
  addShields(r, 1);
  assert.equal(r.shields, 0);
  MOD_BY_ID.nodash.apply(r);
  assert.equal(r.stats.dashMax, 0);
  assert.ok(r.noDash);
});
