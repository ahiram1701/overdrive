import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genGalaxy, route } from '../../js/galaxy.js';
import { poisOf, allPois, POI_KINDS, boardFor, advanceMissions, missionDone, perksFor, ATLAS_PERKS, MAX_ACTIVE } from '../../js/galaxyMissions.js';

const GAL = genGalaxy();

test('puntos de interés: deterministas, de tipos válidos y más en lo lejano', () => {
  assert.deepEqual(poisOf(GAL, 5), poisOf(GAL, 5));
  const all = allPois(GAL);
  assert.equal(new Set(all.map((p) => p.id)).size, all.length);
  for (const p of all) assert.ok(POI_KINDS[p.kind] && p.reward > 0 && p.lore);
  const far = GAL.filter((s) => s.danger >= 4).map((s) => poisOf(GAL, s.id).length);
  assert.ok(Math.max(...far) >= 2);
  assert.equal(poisOf(GAL, 0)[0].kind, 'signal', 'ORIGEN enseña a escanear con una señal');
});

test('tablón: hasta 3 ofertas distintas, alcanzables y con recompensa', () => {
  for (const sys of [0, 4, 10]) {
    const b = boardFor(GAL, sys, 0, { jumpLvl: 1 });
    assert.ok(b.length >= 1 && b.length <= 3);
    assert.equal(new Set(b.map((m) => m.kind)).size, b.length);
    for (const m of b) {
      assert.ok(m.reward > 0 && m.gems >= 1);
      const r = route(GAL, sys, m.sys);
      assert.ok(r && r.length - 1 <= 3, 'destino a 3 saltos como mucho');
      assert.ok(m.sys === sys || Math.max(0, GAL[m.sys].danger - 1) <= 1, 'alcanzable con tu Salto (o en este mismo sistema)');
    }
    assert.deepEqual(boardFor(GAL, sys, 0, { jumpLvl: 1 }), b, 'determinista');
  }
  assert.ok(MAX_ACTIVE === 3);
});

test('misiones avanzan con sus sucesos (y solo con ellos)', () => {
  const list = [
    { kind: 'hunt', sys: 4, n: 2, progress: 0 },
    { kind: 'deliver', sys: 7, n: 1, progress: 0 },
    { kind: 'scan', sys: 2, poi: '2-0', n: 1, progress: 0 },
    { kind: 'escort', sys: 0, gate: 4, n: 1, progress: 0 },
  ];
  assert.deepEqual(advanceMissions(list, { type: 'kill', sys: 9 }), []);
  assert.deepEqual(advanceMissions(list, { type: 'kill', sys: 4 }), []);
  assert.equal(advanceMissions(list, { type: 'kill', sys: 4 })[0].kind, 'hunt');
  assert.equal(advanceMissions(list, { type: 'dock', sys: 7 })[0].kind, 'deliver');
  assert.equal(advanceMissions(list, { type: 'scan', poi: '2-0' })[0].kind, 'scan');
  assert.deepEqual(advanceMissions(list, { type: 'escort', sys: 0, gate: 9 }), []);
  assert.equal(advanceMissions(list, { type: 'escort', sys: 0, gate: 4 })[0].kind, 'escort');
  assert.ok(list.every(missionDone));
});

test('mejoras únicas del ATLAS por número de descubrimientos', () => {
  assert.deepEqual(perksFor(0), []);
  assert.deepEqual(perksFor(ATLAS_PERKS[0].n), [ATLAS_PERKS[0].id]);
  assert.equal(perksFor(99).length, ATLAS_PERKS.length);
});
