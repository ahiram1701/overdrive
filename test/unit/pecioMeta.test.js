// PECIOS · entre partidas: taller en 3 ramas (lo que desbloquea), cargamentos, profundidad, tienda y desguace, inmersión del día
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../js/rng.js';
import {
  newRun, updateRun, roomOf, genFloor, genRoom, takeOffer, buy, shopCost, shopStock, foeMods, pecioRewards, heatReward, HEAT_RULES, HEAT_MAX,
  LOADOUTS, WORKSHOP, WORKSHOP_BRANCHES, workshopShip, dailySeed, COLS, ROWS, MID_C, MID_R,
} from '../../js/pecio.js';
import { genItem, applyGear, scrapValue, BASE_SETS, BASE_UNIQUES, SLOTS } from '../../js/pecioLoot.js';

const DT = 1 / 30;
const LOCKED = workshopShip({}).pool;

test('taller: 3 ramas; sin desbloquear, el botín solo trae lo básico', () => {
  assert.deepEqual(WORKSHOP_BRANCHES.map((b) => b.id), ['hull', 'arsenal', 'map']);
  for (const b of WORKSHOP_BRANCHES) assert.ok(WORKSHOP.filter((w) => w.branch === b.id).length >= 4, `rama ${b.id} con nodos`);
  assert.deepEqual(LOCKED, { cannon: false, platings: false, sets: false, uniques: false, hatch: false, traps: false, elite: false, radar: false });
  const rng = makeRng(4);
  for (let i = 0; i < 1500; i++) {
    const it = genItem(rng, 9, { bonus: 2, pool: LOCKED });
    assert.notEqual(it.kind, 'cannon');
    assert.ok(!it.affix);
    if (it.slot === 'plating') assert.equal(it.kind, 'plating');
    if (it.set) assert.ok(BASE_SETS.includes(it.set));
    if (it.unique) assert.ok(BASE_UNIQUES.includes(it.unique));
  }
  // todo desbloqueado: sale de todo
  const all = workshopShip(Object.fromEntries(WORKSHOP.map((w) => [w.id, 9]))).pool;
  assert.ok(Object.values(all).every(Boolean));
  const seen = new Set();
  for (let i = 0; i < 1500; i++) { const it = genItem(rng, 9, { bonus: 2, pool: all }); seen.add(it.kind); }
  assert.ok(seen.has('cannon') && seen.has('reflect'));
  assert.ok(Math.abs(workshopShip({ arsCrit: 2 }).crit - 0.16) < 1e-9);
});

test('cartografía: sin desbloquear, ni escotilla ☠️, ni trampas, ni salas de élite', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const s = newRun(seed, { hp: 6, pool: LOCKED });
    for (let d = 1; d <= 6; d++) {
      const f = genFloor(seed, d);
      Object.assign(f, { pool: LOCKED, heat: 0 });
      for (const r of Object.values(f.rooms)) if (r.type === 'elite') r.type = 'combat';
      for (const id of Object.keys(f.rooms)) {
        const room = genRoom(f, id);
        assert.ok(!room.tiles.flat().some((k) => ['Y', 'J', '<', '>', '^', 'v'].includes(k)), `sin escotilla ☠️ ni trampas nuevas (${room.layout})`);
        assert.ok(!room.sweep);
      }
    }
    assert.ok(!Object.values(s.floor.rooms).some((r) => r.type === 'elite'));
  }
});

test('cargamentos: cada uno da piezas válidas y empieza puesto', () => {
  for (const [id, L] of Object.entries(LOADOUTS)) {
    const gear = L.gear();
    assert.ok(gear.length >= 1, id);
    const s = newRun(1, { hp: 6, gear, keys: L.keys || 0, piezas: L.piezas || 0 });
    for (const it of gear) assert.ok(Object.values(s.player.gear).includes(it), `${id}: ${it.kind} puesto`);
    assert.ok(SLOTS.some((k) => s.player.gear[k]));
    if (L.piezas) assert.equal(s.player.piezas, L.piezas);
  }
  assert.equal(LOADOUTS.assault.cost, 0);
});

test('profundidad: cada nivel endurece algo y paga un 15 % más', () => {
  assert.equal(HEAT_RULES.length, HEAT_MAX);
  assert.equal(heatReward(0), 1);
  assert.ok(Math.abs(heatReward(4) - 1.6) < 1e-9);
  const base = pecioRewards({ depth: 5, rooms: 20, kills: 60, bosses: 1 });
  const hot = pecioRewards({ depth: 5, rooms: 20, kills: 60, bosses: 1, heat: 4 });
  assert.ok(hot.gems > base.gems && hot.xp > base.xp);
  assert.deepEqual(foeMods({ heat: 0 }), { eliteMul: 1, hpMul: 1, speedMul: 1 });
  const m9 = foeMods({ heat: 9 });
  assert.ok(m9.eliteMul === 3 && m9.hpMul > 1 && m9.speedMul > 1);
  // tienda más cara (3) y un corazón menos (10)
  const s0 = newRun(2, { hp: 6 }), s3 = newRun(2, { hp: 6, heat: 3 }), s10 = newRun(2, { hp: 6, heat: 10 });
  assert.ok(shopCost(s3, 'kit') > shopCost(s0, 'kit'));
  assert.equal(s10.player.max, s0.player.max - 1);
  // las gemas cuentan las salas: una partida corta también rinde
  assert.ok(pecioRewards({ depth: 2, rooms: 8 }).gems >= 9);
});

test('profundidad 4: bajar de planta ya no cura', () => {
  const down = (heat) => {
    const s = newRun(3, { hp: 6, heat });
    const room = roomOf(s);
    room.tiles = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (__, c) => (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 ? '#' : '.')));
    room.tiles[MID_R][MID_C] = 'X';
    Object.assign(room, { enemies: [], cleared: true });
    s.player.hp = 3;
    for (let i = 0; i < 5 && s.depth === 1; i++) updateRun(s, DT);
    return s.player.hp;
  };
  assert.equal(down(0), 4);
  assert.equal(down(4), 3);
});

test('tienda: su surtido cambia con la planta (siempre con reparación) y no vende lo que no tiene', () => {
  const stocks = new Set();
  for (let d = 2; d <= 8; d++) {
    const s = newRun(5, { hp: 6 });
    s.depth = d;
    const room = roomOf(s);
    room.type = 'shop';
    room.stock = null;
    const st = shopStock(s);
    assert.equal(st.length, 4);
    assert.equal(st[0], 'repair');
    assert.deepEqual(shopStock(s), st, 'no cambia mientras estás');
    stocks.add(st.join());
    const missing = ['key', 'kit', 'emp', 'warp', 'box'].find((k) => !st.includes(k));
    s.player.piezas = 999;
    assert.deepEqual(buy(s, missing), [{ type: 'empty' }]);
  }
  assert.ok(stocks.size >= 3, 'varía');
});

test('desguace: un objeto que no quieres vale 🔩 (más cuanto mejor)', () => {
  const s = newRun(6, { hp: 6 });
  s.floor.event = null;
  const it = genItem(makeRng(2), 5, { minTier: 2 });
  s.offer = { item: it, alts: [], pk: null };
  const p0 = s.player.piezas;
  const ev = takeOffer(s, 'scrap');
  assert.ok(ev.some((e) => e.type === 'scrap'));
  assert.equal(s.player.piezas - p0, scrapValue(it, s.depth));
  assert.equal(s.offer, null);
  assert.ok(!Object.values(s.player.gear).includes(it));
  assert.ok(scrapValue({ tier: 3 }, 1) > scrapValue({ tier: 0 }, 1));
});

test('inmersión del día: la misma semilla para todos ese día', () => {
  assert.equal(dailySeed('2026-11-24'), dailySeed('2026-11-24'));
  assert.notEqual(dailySeed('2026-11-24'), dailySeed('2026-11-25'));
  const a = newRun(dailySeed('2026-11-24'), { hp: 6, daily: true }), b = newRun(dailySeed('2026-11-24'), { hp: 6, daily: true });
  assert.deepEqual(Object.keys(a.floor.rooms), Object.keys(b.floor.rooms));
  assert.ok(a.daily);
  applyGear(a.player);
});
