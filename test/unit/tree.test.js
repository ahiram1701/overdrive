import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../js/rng.js';
import { MAX_SHIELDS } from '../../js/state.js';
import { ABILITIES, newAbility } from '../../js/abilities.js';
import {
  SHIPS, baseStats, applyShipTree, abilityMods, treeCost, treeOf, shipProfile,
  shipLvls, PROFILE_KEYS, ABILITY_TREE, TREE_COSTS,
} from '../../js/upgrades.js';

const fakeRun = () => ({
  rng: makeRng(1), stats: baseStats(), cards: {}, synergies: new Set(),
  shields: 0, dashCharges: 1, blockedLane: null, luck: 1, player: { lane: 0 }, lastStand: false,
});
const MAX = { a: 3, b: 3, c: 3 };

test('cada nave con el árbol al máximo respeta las invariantes del juego', () => {
  for (const s of SHIPS) {
    const r = fakeRun();
    s.apply(r);
    applyShipTree(r, MAX);
    assert.ok(r.shields <= MAX_SHIELDS, `${s.id}: ${r.shields} escudos`);
    assert.ok(r.stats.dashRecharge > 0 && r.stats.laneTime > 0 && r.stats.odRate > 0, s.id);
    assert.equal(r.lastStand, true);
    const a = newAbility(s.ability, abilityMods(s, MAX));
    assert.ok(a.cd > 0 && a.cd < ABILITIES[s.ability].cd, `${s.id}: la recarga baja`);
    assert.equal(a.mut, ABILITY_TREE[s.ability].mut);
  }
});

test('los niveles se compran en orden y el nivel 3 es el último', () => {
  for (const b of ['a', 'b', 'c']) {
    for (let lvl = 0; lvl < 3; lvl++) assert.equal(treeCost(b, lvl), TREE_COSTS[b][lvl]);
    assert.equal(treeCost(b, 3), null);
    assert.ok(TREE_COSTS[b][0] < TREE_COSTS[b][1] && TREE_COSTS[b][1] < TREE_COSTS[b][2]);
  }
});

test('cada habilidad tiene rama propia con nivel 2 y mutación', () => {
  for (const s of SHIPS) {
    const t = ABILITY_TREE[s.ability];
    assert.ok(t && t.lvl2 && t.lvl3 && t.mut, s.id);
    const tree = treeOf(s, ABILITIES[s.ability].name, ABILITIES[s.ability].icon);
    assert.deepEqual(tree.map((b) => b.key), ['a', 'b', 'c']);
    assert.ok(tree.every((b) => b.nodes.length === 3));
  }
});

test('shipProfile: 6 barras en [0,1] y mejorar nunca baja una barra', () => {
  for (const s of SHIPS) {
    const base = shipProfile(s.id);
    const full = shipProfile(s.id, MAX);
    assert.deepEqual(Object.keys(base), PROFILE_KEYS);
    for (const k of PROFILE_KEYS) {
      assert.ok(base[k] >= 0 && base[k] <= 1 && full[k] >= 0 && full[k] <= 1, `${s.id} ${k}`);
      assert.ok(full[k] >= base[k] - 1e-9, `${s.id} ${k} baja al mejorar`);
    }
  }
  // las naves se distinguen: no hay dos con el mismo perfil
  const profiles = SHIPS.map((s) => JSON.stringify(shipProfile(s.id)));
  assert.equal(new Set(profiles).size, SHIPS.length);
});

test('shipLvls rellena los niveles que falten', () => {
  assert.deepEqual(shipLvls({}, 'viper'), { a: 0, b: 0, c: 0 });
  assert.deepEqual(shipLvls({ viper: { a: 2 } }, 'viper'), { a: 2, b: 0, c: 0 });
  assert.deepEqual(shipLvls(undefined, 'x'), { a: 0, b: 0, c: 0 });
});
