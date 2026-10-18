import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../js/rng.js';
import { loadFrom } from '../../js/save.js';
import {
  CUPS, TRACK_BY_ID, makeRivals, stepRivals, standings, addPoints, cupMedal, encodeSample, ghostAt, GHOST_DT, isCupOpen, estimateFinish,
  ttTargets, ttMedal, rivalAdapt,
} from '../../js/race.js';

test('5 copas de 3 pistas, ids únicos y cada vez más difíciles', () => {
  assert.equal(CUPS.length, 5);
  assert.equal(Object.keys(TRACK_BY_ID).length, 15);
  for (let i = 1; i < CUPS.length; i++) {
    assert.ok(CUPS[i].skill > CUPS[i - 1].skill);
    assert.ok(CUPS[i].pace >= CUPS[i - 1].pace);
  }
});

test('clasificación: primero los que llegan (por tiempo), luego por distancia', () => {
  const o = standings([
    { who: 'a', finishT: null, z: 900 }, { who: 'b', finishT: 50, z: 1000 }, { who: 'c', finishT: 48, z: 1000 }, { who: 'd', finishT: null, z: 950 },
  ]);
  assert.deepEqual(o.map((x) => x.who), ['c', 'b', 'd', 'a']);
});

test('puntos de copa y medalla', () => {
  let t = addPoints({}, ['you', '0', '1', '2']);
  t = addPoints(t, ['0', 'you', '2', '1']);
  assert.equal(t.you, 16);
  assert.equal(t['0'], 16);
  t = addPoints(t, ['2', '1', '0', 'you']);
  assert.ok(cupMedal(t) !== null && cupMedal(t) <= 2);
  assert.equal(cupMedal({ you: 1, 0: 30, 1: 20, 2: 10 }), null, 'último: sin medalla');
  assert.equal(cupMedal({ you: 30, 0: 3, 1: 2, 2: 1 }), 0);
});

test('fantasma: se codifica en enteros y se interpola', () => {
  const ghost = { t: 1, d: [encodeSample(0, 0, 0), encodeSample(10, 1, 0.5), encodeSample(20, 1, 0)] };
  for (const s of ghost.d) for (const v of s) assert.ok(Number.isInteger(v));
  const g = ghostAt(ghost, GHOST_DT * 0.5);
  assert.ok(Math.abs(g.z - 5) < 1e-9);
  assert.ok(Math.abs(g.x - 0.5) < 1e-9);
  assert.equal(ghostAt(ghost, 99).done, true);
  assert.equal(ghostAt(null, 1), null);
});

test('rivales: deterministas con su semilla, avanzan y llegan a la meta', () => {
  const sim = () => {
    const rivals = makeRivals(CUPS[0], 5);
    const rng = makeRng(9);
    const objects = [];
    for (let z = 30; z < 1500; z += 25) objects.push({ alive: true, need: z % 50 ? 'jump' : 'lane', x: (z / 25) % 3 - 1, z });
    let t = 0;
    while (t < 120 && rivals.some((r) => r.finishT === null)) {
      stepRivals(rivals, { objects, time: t, playerZ: rivals[0].z, playerLane: 5, playerX: 9, laneTime: 0.11 }, 1 / 30, rng, 1400);
      t += 1 / 30;
    }
    return rivals.map((r) => r.finishT && +r.finishT.toFixed(3));
  };
  const a = sim();
  assert.deepEqual(a, sim());
  assert.ok(a.every((x) => x > 0), 'todos llegan');
});

test('estimación de llegada y apertura de copas', () => {
  const rv = makeRivals(CUPS[0], 1)[0];
  rv.z = 900;
  assert.ok(estimateFinish(rv, 1000, 30) > 30);
  const s = loadFrom(null);
  assert.ok(isCupOpen(s, 'c1'));
  assert.equal(isCupOpen(s, 'c2'), false);
  s.raceCups.c1 = 2;
  assert.ok(isCupOpen(s, 'c2'), 'un bronce abre la siguiente');
  assert.equal(loadFrom(JSON.stringify(s)).raceCups.c1, 2, 'persiste');
});

test('contrarreloj: tres tiempos objetivo; la medalla depende de tu tiempo', () => {
  const t = TRACK_BY_ID['c1-1'];
  const [g, sv, b] = ttTargets(t);
  assert.ok(g < sv && sv < b);
  assert.equal(ttMedal(t, g - 0.1), 0);
  assert.equal(ttMedal(t, sv), 1);
  assert.equal(ttMedal(t, b), 2);
  assert.equal(ttMedal(t, b + 0.1), null);
});

test('rivales que se adaptan: si eres rápido aprietan, si no aflojan (±3 %)', () => {
  const t = TRACK_BY_ID['c2-1'];
  assert.equal(rivalAdapt(t, undefined), 1);
  assert.ok(rivalAdapt(t, t.len * 0.9) > 1);
  assert.ok(rivalAdapt(t, t.len * 1.2) < 1);
  assert.equal(rivalAdapt(t, 1), 1.03);
  assert.equal(rivalAdapt(t, 999), 0.97);
  const cup = CUPS[1];
  const base = makeRivals(cup, 7), fast = makeRivals(cup, 7, 1.03);
  base.forEach((r, i) => assert.ok(Math.abs(fast[i].pace / r.pace - 1.03) < 1e-9));
});
