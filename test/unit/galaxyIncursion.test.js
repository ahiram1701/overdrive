import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WAVES, MEDALS, medalFor, wavesFor, themeOf, killScore, waveBonus, creditsFor, recordRun } from '../../js/galaxyIncursion.js';
import { ENEMY_KINDS } from '../../js/galaxyEvents.js';

test('incursión: 10 oleadas del día, deterministas, cada vez más duras, jefes en la 5 y la 10', () => {
  const a = wavesFor('2026-11-21'), b = wavesFor('2026-11-21'), c = wavesFor('2026-11-22');
  assert.deepEqual(a, b, 'el mismo día, las mismas oleadas para todos');
  assert.notDeepEqual(a, c, 'otro día, otras');
  assert.equal(a.length, WAVES);
  for (let i = 1; i < a.length; i++) {
    assert.ok(a[i].list.length >= a[i - 1].list.length && a[i].danger >= a[i - 1].danger);
  }
  assert.deepEqual(a.filter((w) => w.boss).map((w) => w.wave), [5, 10]);
  for (const w of a) for (const k of w.list) assert.ok(ENEMY_KINDS[k], `tipo ${k} existe`);
  assert.ok(ENEMY_KINDS[themeOf('2026-11-21')]);
});

test('incursión: puntos, medallas y gemas solo por medalla nueva del día', () => {
  assert.ok(killScore(8, 2) > killScore(1, 1));
  assert.ok(killScore(5, 1, true) > killScore(10, 1));
  assert.ok(waveBonus(3, 10) > waveBonus(3, 80));
  assert.ok(creditsFor(8000) === 1000);
  assert.equal(medalFor(3), null);
  assert.equal(medalFor(4).id, 'bronze');
  assert.equal(medalFor(10).id, 'gold');
  const day = '2026-11-21';
  let r = recordRun(null, day, 4, 3000);
  assert.equal(r.gems, MEDALS[0].gems);
  r = recordRun(r.rec, day, 5, 2000);
  assert.equal(r.gems, 0, 'misma medalla, sin gemas');
  assert.equal(r.rec.best, 3000, 'la mejor marca se queda');
  r = recordRun(r.rec, day, 10, 9000);
  assert.equal(r.gems, MEDALS[1].gems + MEDALS[2].gems, 'plata y oro de golpe');
  assert.ok(r.isBest);
  const tomorrow = recordRun(r.rec, '2026-11-22', 4, 100);
  assert.equal(tomorrow.gems, MEDALS[0].gems, 'otro día, todo de nuevo');
});
