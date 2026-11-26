import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFrom } from '../../js/save.js';
import {
  DIFF_KEYS, diffOf, nextDiff, towFee, respawnHull, pirateMul, matsLost, makeWreck, wreckExpired, wreckJumpsLeft, recoverWreck, WRECK_JUMPS,
  juicyChance, wantedBonus,
} from '../../js/galaxyRisk.js';

test('dificultad: por defecto Piloto (también en guardados antiguos) y se cambia en ciclo', () => {
  assert.equal(loadFrom(null).galaxy.difficulty, 'pilot');
  const old = JSON.stringify({ v: 6, galaxy: { credits: 500, up: { laser: 2 } } });
  assert.equal(loadFrom(old).galaxy.difficulty, 'pilot', 'un guardado de antes empieza en Piloto');
  assert.equal(loadFrom(old).galaxy.credits, 500);
  assert.equal(diffOf({}), 'pilot');
  assert.equal(diffOf({ difficulty: 'nada' }), 'pilot');
  const seen = new Set();
  let d = 'relaxed';
  for (let i = 0; i < DIFF_KEYS.length; i++) { seen.add(d); d = nextDiff(d); }
  assert.equal(seen.size, DIFF_KEYS.length);
  assert.equal(d, 'relaxed');
});

test('morir: Relajado no cuesta nada; Piloto paga y vuelve tocado; Veterano, más', () => {
  assert.equal(towFee(10000, 6, 'relaxed'), 0);
  assert.equal(respawnHull('relaxed'), 1);
  const pilot = towFee(10000, 2, 'pilot'), vet = towFee(10000, 2, 'veteran');
  assert.ok(pilot > 0 && vet > pilot);
  assert.equal(towFee(100, 2, 'pilot'), 15, 'con poco dinero, un porcentaje');
  assert.ok(towFee(1e7, 6, 'pilot') <= 400 + 320 * 6, 'con tope');
  assert.ok(respawnHull('veteran') < respawnHull('pilot') && respawnHull('pilot') < 1);
  assert.equal(pirateMul('pilot'), 1);
  assert.ok(pirateMul('veteran') > 1);
  assert.deepEqual(matsLost({ chatarra: 5, nucleos: 0, circuitos: 1 }, 'veteran'), { chatarra: 1, circuitos: 1 });
  assert.deepEqual(matsLost({ chatarra: 5 }, 'pilot'), {});
});

test('pecio propio: guarda la carga, caduca a los pocos saltos y se recupera lo que quepa', () => {
  assert.equal(makeWreck(3, { x: 0, y: 0, z: 0 }, { iron: 0 }, 10), null, 'sin carga, no hay pecio');
  const w = makeWreck(3, { x: 1, y: 2, z: 3 }, { iron: 8, crystal: 4, dark: 0 }, 10);
  assert.deepEqual(w.cargo, { iron: 8, crystal: 4 });
  assert.equal(wreckJumpsLeft(w, 10), WRECK_JUMPS);
  assert.ok(!wreckExpired(w, 10 + WRECK_JUMPS));
  assert.ok(wreckExpired(w, 11 + WRECK_JUMPS));
  const r = recoverWreck(w, { iron: 2 }, 10);
  assert.equal(r.got, 10);
  assert.equal(r.cargo.iron, 10);
  assert.equal(r.cargo.crystal, 2);
});

test('botín jugoso y prima de búsqueda', () => {
  assert.equal(juicyChance(5000, 0), 0, 'en ORIGEN nunca');
  assert.equal(juicyChance(300, 5), 0, 'poca carga, nada');
  assert.ok(juicyChance(3000, 4) > juicyChance(1000, 4));
  assert.ok(juicyChance(1e6, 6) <= 0.4);
  assert.equal(wantedBonus(0), 1);
  assert.ok(Math.abs(wantedBonus(5) - 1.6) < 1e-9);
});

test('pecio propio: lo que no cabe se queda en el pecio', () => {
  const w = makeWreck(3, { x: 0, y: 0, z: 0 }, { iron: 8, crystal: 4 }, 10);
  const r = recoverWreck(w, {}, 5);
  assert.equal(r.got, 5);
  assert.deepEqual(r.rest, { iron: 3, crystal: 4 });
  assert.equal(recoverWreck(w, {}, 99).rest, null);
});
