import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../js/rng.js';
import {
  WEAPONS, PASSIVES, EVOLUTIONS, SHIP_WEAPON, SHIP_ARENA, ENEMIES, waveAt, offerUpgrades, applyUpgrade, canEvolve, xpNeed,
  passiveStats, arenaRewards, MAX_WEAPONS, MAX_LVL,
  ARENA_MAPS, MAP_KEYS, mapUnlocked, mapFeatures, ARENA_BOSSES, BOSS_ATTACKS, bossOf,
} from '../../js/arenaData.js';
import { loadFrom } from '../../js/save.js';
import { SHIPS } from '../../js/upgrades.js';

test('cada nave tiene arma inicial y perfil de arena; cada arma, su evolución', () => {
  for (const s of SHIPS) {
    assert.ok(WEAPONS[SHIP_WEAPON[s.id]], s.id);
    assert.ok(SHIP_ARENA[s.id].hp > 0);
  }
  for (const id of Object.keys(WEAPONS)) {
    assert.ok(EVOLUTIONS[id], id);
    assert.ok(PASSIVES[EVOLUTIONS[id].needs], `${id}: su pasiva existe`);
    for (let n = 1; n <= MAX_LVL; n++) assert.ok(WEAPONS[id].lvl(n).dmg > 0);
  }
});

test('oleadas: deterministas y cada vez más duras', () => {
  assert.deepEqual(waveAt(90), waveAt(90));
  assert.ok(waveAt(300).rate > waveAt(30).rate);
  assert.ok(waveAt(500).hpMul > waveAt(60).hpMul);
  assert.ok(waveAt(500).weights.length > waveAt(10).weights.length, 'aparecen tipos nuevos');
  for (const w of waveAt(600).weights) assert.ok(ENEMIES[w.id]);
});

test('ofertas: 3 distintas, respetan los huecos y la evolución sale cuando toca', () => {
  const st = { weapons: { blaster: 1 }, passives: {}, evolved: {} };
  const offers = offerUpgrades(st, makeRng(1));
  assert.equal(offers.length, 3);
  assert.equal(new Set(offers.map((o) => o.kind + o.id)).size, 3);
  // con 4 armas, no se ofrece una quinta
  const full = { weapons: { blaster: 2, shotgun: 1, beam: 1, pulse: 1 }, passives: {}, evolved: {} };
  for (let i = 0; i < 20; i++) {
    for (const o of offerUpgrades(full, makeRng(i))) if (o.kind === 'weapon') assert.ok(full.weapons[o.id], 'solo sube las que tienes');
  }
  assert.equal(Object.keys(full.weapons).length, MAX_WEAPONS);
  // evolución: arma al 5 + su pasiva
  const evo = { weapons: { blaster: 5 }, passives: { haste: 1 }, evolved: {} };
  assert.ok(canEvolve(evo, 'blaster'));
  assert.equal(offerUpgrades(evo, makeRng(3))[0].kind, 'evolve');
  applyUpgrade(evo, { kind: 'evolve', id: 'blaster' });
  assert.ok(evo.evolved.blaster);
  assert.equal(canEvolve(evo, 'blaster'), false);
  // todo al máximo: cura
  const maxed = { weapons: Object.fromEntries(Object.keys(WEAPONS).slice(0, 4).map((k) => [k, 5])), passives: Object.fromEntries(Object.keys(PASSIVES).slice(0, 4).map((k) => [k, 5])), evolved: Object.fromEntries(Object.keys(WEAPONS).map((k) => [k, true])) };
  assert.deepEqual(offerUpgrades(maxed, makeRng(1)).map((o) => o.kind), ['heal']);
});

test('XP, pasivas y recompensas', () => {
  for (let l = 1; l < 40; l++) assert.ok(xpNeed(l + 1) > xpNeed(l));
  assert.ok(xpNeed(1) <= 8, 'el primer nivel llega enseguida');
  const p = passiveStats({ might: 2, haste: 3, vitality: 1 });
  assert.ok(Math.abs(p.might - 1.24) < 1e-9);
  assert.ok(p.haste < 1);
  assert.equal(p.maxHp, 20);
  const r = arenaRewards({ time: 600, kills: 800, bosses: 2, won: true });
  assert.ok(r.gems > arenaRewards({ time: 60, kills: 50, bosses: 0, won: false }).gems);
});

test('mapas: 4, se abren con logros y sus peligros son deterministas y no tocan el centro', () => {
  assert.equal(MAP_KEYS.length, 4);
  const s = loadFrom(null);
  assert.deepEqual(MAP_KEYS.filter((id) => mapUnlocked(s, id)), ['grid']);
  s.arena.best = 300;
  assert.ok(mapUnlocked(s, 'belt') && !mapUnlocked(s, 'forge'));
  s.arena.bossBest = 1;
  s.arena.wins = 1;
  assert.ok(MAP_KEYS.every((id) => mapUnlocked(s, id)));
  for (const id of MAP_KEYS) {
    const f1 = mapFeatures(id, makeRng(7)), f2 = mapFeatures(id, makeRng(7));
    assert.deepEqual(f1, f2, `${id}: misma semilla, mismo mapa`);
    for (const k of f1.rocks) {
      assert.ok(Math.hypot(k.x, k.y) - k.r > 100, 'el centro, libre de rocas');
      assert.ok(Math.hypot(k.x, k.y) + k.r < ARENA_MAPS[id].radius, 'rocas dentro del mapa');
    }
    for (const p of f1.pools) assert.ok(Math.hypot(p.x, p.y) >= 220, 'sin lava donde empiezas');
    for (const b of ARENA_MAPS[id].bosses) assert.ok(ARENA_BOSSES[b], b);
  }
  assert.equal(mapFeatures('grid', makeRng(1)).rocks.length, 0, 'la Rejilla sigue igual');
});

test('jefes de la arena: 2 fases con ataques conocidos; cada mapa trae los suyos', () => {
  assert.equal(Object.keys(ARENA_BOSSES).length, 5);
  for (const [id, b] of Object.entries(ARENA_BOSSES)) {
    assert.equal(b.phases.length, 2, id);
    for (const ph of b.phases) for (const k of ph) assert.ok(BOSS_ATTACKS[k], `${id}: ${k}`);
    assert.ok(b.phases[1].length >= b.phases[0].length, `${id}: la fase 2 no tiene menos ataques`);
  }
  assert.equal(bossOf('belt', 0), 'colmena');
  assert.equal(bossOf('belt', 1), 'coloso');
});
