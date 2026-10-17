import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../js/rng.js';
import {
  WEAPONS, PASSIVES, EVOLUTIONS, SHIP_WEAPON, SHIP_ARENA, ENEMIES, waveAt, offerUpgrades, applyUpgrade, canEvolve, xpNeed,
  passiveStats, arenaRewards, MAX_WEAPONS, MAX_LVL,
} from '../../js/arenaData.js';
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
