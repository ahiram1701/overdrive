// GALAXIA · variedad: enemigos nuevos, armas con comportamiento, chips con afijos y contratos nuevos
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../js/rng.js';
import { genGalaxy } from '../../js/galaxy.js';
import { ENEMY_KINDS } from '../../js/galaxyEvents.js';
import { rareKind, stalkerVisible, attackTarget } from '../../js/galaxyTactics.js';
import { GEAR, genChip, chipBonus, addChip, toggleChip, scrapChip, chips, CHIP_MAX, CHIP_BAG, CHIP_TIERS, AFFIX, chipText } from '../../js/crafting.js';
import { boardFor, advanceMissions, MISSION_KINDS } from '../../js/galaxyMissions.js';
import { loadFrom } from '../../js/save.js';

const gal = genGalaxy();

test('enemigos nuevos: portanaves, fragata, tirador fantasma y reparador; salen lejos de ORIGEN', () => {
  for (const k of ['carrier', 'frigate', 'wraith', 'mender']) assert.ok(ENEMY_KINDS[k], k);
  const seen = new Set();
  const rng = makeRng(3);
  for (let i = 0; i < 4000; i++) { const k = rareKind(6, 1, rng.next()); if (k) seen.add(k); }
  for (const k of ['carrier', 'frigate', 'wraith', 'mender']) assert.ok(seen.has(k), `sale ${k}`);
  for (let i = 0; i < 500; i++) assert.ok(!['carrier', 'frigate', 'wraith'].includes(rareKind(1, 1, rng.next())), 'cerca de ORIGEN, no');
  // el tirador fantasma: invisible salvo de cerca o mientras apunta
  assert.ok(!stalkerVisible({ kind: 'wraith' }, 900));
  assert.ok(stalkerVisible({ kind: 'wraith', aimT: 0.5 }, 900));
  // se quedan lejos: si te acercas, se apartan
  const me = { pos: { x: 0, y: 0, z: 0 }, f: { x: 0, y: 0, z: 1 }, r: { x: 1, y: 0, z: 0 } };
  const p = { kind: 'carrier', pos: { x: 0, y: 0, z: 200 } };
  const to = attackTarget(p, me, 200);
  assert.ok(to.z > 200, 'se aleja');
});

test('armas con comportamiento: riel, flak de área, haz e iónico', () => {
  for (const k of ['rail', 'burst', 'beam', 'ion']) assert.equal(GEAR[k]?.slot, 'w', k);
});

test('chips: rareza según el peligro, afijos, 2 montados como mucho, bolsa limitada y desguace', () => {
  const rng = makeRng(9);
  const tiers = [0, 0, 0, 0];
  for (let i = 0; i < 2000; i++) {
    const c = genChip(rng, 6, 1);
    tiers[c.tier]++;
    assert.equal(c.affixes.length, CHIP_TIERS[c.tier].n);
    assert.equal(new Set(c.affixes.map((a) => a.k)).size, c.affixes.length, 'sin afijos repetidos');
    for (const a of c.affixes) assert.ok(AFFIX[a.k] && a.v > 0);
    assert.ok(chipText(c).length > 0);
  }
  assert.ok(tiers[3] > 0 && tiers[0] > 0, 'hay de todo');
  const low = [0, 0, 0, 0];
  for (let i = 0; i < 2000; i++) low[genChip(rng, 0, 0).tier]++;
  assert.ok(low[3] < tiers[3], 'lejos, mejores');
  const s = loadFrom(null);
  const a = { id: 'a', tier: 1, affixes: [{ k: 'dmg', v: 10 }, { k: 'cargo', v: 6 }] };
  const b = { id: 'b', tier: 0, affixes: [{ k: 'dmg', v: 5 }] };
  const c = { id: 'c', tier: 0, affixes: [{ k: 'hull', v: 8 }] };
  for (const x of [a, b, c]) assert.ok(addChip(s, x));
  toggleChip(s, 'a'); toggleChip(s, 'b');
  assert.deepEqual(chipBonus(s), { dmg: 15, cargo: 6 });
  toggleChip(s, 'c');
  assert.equal(chips(s).on.length, CHIP_MAX, 'como mucho 2');
  const cr = s.galaxy.credits;
  assert.ok(scrapChip(s, 'c'));
  assert.ok(s.galaxy.credits > cr);
  assert.ok(!chips(s).on.includes('c'));
  for (let i = 0; i < CHIP_BAG + 3; i++) addChip(s, { id: `x${i}`, tier: 0, affixes: [] });
  assert.equal(chips(s).bag.length, CHIP_BAG);
});

test('contratos nuevos: rescate (3 cápsulas) y asesinato; los tablones los ofrecen', () => {
  assert.ok(MISSION_KINDS.rescue && MISSION_KINDS.hit);
  const kinds = new Set();
  for (let seq = 0; seq < 60; seq++) for (const m of boardFor(gal, 0, seq, { jumpLvl: 5 })) kinds.add(m.kind);
  assert.ok(kinds.has('rescue') && kinds.has('hit'));
  const list = [{ id: 'r', kind: 'rescue', sys: 3, n: 3, progress: 0 }, { id: 'h', kind: 'hit', sys: 4, n: 1, progress: 0 }];
  assert.equal(advanceMissions(list, { type: 'rescue', sys: 3 }).length, 0);
  advanceMissions(list, { type: 'rescue', sys: 3 });
  assert.equal(advanceMissions(list, { type: 'rescue', sys: 3 })[0].id, 'r');
  assert.equal(advanceMissions(list, { type: 'hit', id: 'otro' }).length, 0);
  assert.equal(advanceMissions(list, { type: 'hit', id: 'h' })[0].id, 'h');
});
