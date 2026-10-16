import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFrom, migrate, SAVE_VERSION } from '../../js/save.js';

// Guardado v1 tal y como existe hoy en los móviles de los jugadores
const V1 = JSON.stringify({
  gems: 340, best: 1234567, bestDist: 9000,
  daily: { key: '2026-10-16', best: 50000 },
  ships: ['viper', 'brick'], ship: 'brick',
  meta: { shield: true, card: false },
  settings: { sound: false, vibe: true, fx: true, text: 'min' },
  runs: 42,
  missions: { key: '2026-10-16', list: [{ kind: 'near', mode: 'sum', n: 60, progress: 12, done: false, gems: 15, diff: 'easy', text: 'x' }] },
});

test('un guardado v1 migra conservando todo el progreso', () => {
  const s = loadFrom(V1);
  assert.equal(s.v, SAVE_VERSION);
  assert.equal(s.gems, 340);
  assert.equal(s.best, 1234567);
  assert.deepEqual(s.ships, ['viper', 'brick']);
  assert.equal(s.ship, 'brick');
  assert.equal(s.meta.shield, true);
  assert.equal(s.settings.sound, false);
  assert.equal(s.settings.text, 'min');
  assert.equal(s.missions.list[0].progress, 12);
  assert.deepEqual(s.shipLvl, {});
  assert.equal(s.xp, 0);
});

test('los mapas de progreso sobreviven a guardar y cargar (antes se perdían)', () => {
  const s = loadFrom(null);
  s.shipLvl.viper = { a: 1, b: 0, c: 2 };
  s.shipLvl.raptor = { a: 3, b: 3, c: 3 };
  s.abilityUses.overclock = 7;
  s.campaign['1-1'] = 3;
  const again = loadFrom(JSON.stringify(s));
  assert.deepEqual(again.shipLvl, { viper: { a: 1, b: 0, c: 2 }, raptor: { a: 3, b: 3, c: 3 } });
  assert.equal(again.abilityUses.overclock, 7);
  assert.equal(again.campaign['1-1'], 3);
});

test('un guardado corrupto o vacío no rompe la carga', () => {
  assert.equal(loadFrom('{no es json').gems, 0);
  assert.equal(loadFrom('').gems, 0);
  assert.equal(migrate({}).v, SAVE_VERSION);
});

test('claves desconocidas de nivel superior se ignoran (no ensucian el guardado)', () => {
  const s = loadFrom(JSON.stringify({ gems: 5, basura: 123 }));
  assert.equal(s.gems, 5);
  assert.ok(!('basura' in s));
});
