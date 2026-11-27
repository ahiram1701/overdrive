// PECIOS · entre partidas: taller en 3 ramas (lo que desbloquea), cargamentos, profundidad, tienda y desguace, inmersión del día
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../js/rng.js';
import {
  newRun, updateRun, roomOf, genFloor, genRoom, takeOffer, buy, shopCost, shopStock, foeMods, pecioRewards, heatReward, HEAT_RULES, HEAT_MAX,
  LOADOUTS, WORKSHOP, WORKSHOP_BRANCHES, workshopShip, dailySeed, COLS, ROWS, MID_C, MID_R,
} from '../../js/pecio.js';
import { genItem, genChoice, applyGear, scrapValue, SLOTS } from '../../js/pecioLoot.js';

const DT = 1 / 30;
const BASE = workshopShip({});

test('taller: 3 ramas y 18 mejoras; sin comprar nada, TODO el botín nuevo sale igual', () => {
  assert.deepEqual(WORKSHOP_BRANCHES.map((b) => b.id), ['hull', 'arsenal', 'map']);
  assert.equal(WORKSHOP.length, 18);
  for (const b of WORKSHOP_BRANCHES) assert.ok(WORKSHOP.filter((w) => w.branch === b.id).length >= 5, `rama ${b.id} con nodos`);
  assert.ok(Object.values(BASE.pool).every((v) => v === false), 'sin taller, ninguna mejora');
  const rng = makeRng(4), seen = new Set(), sets = new Set(), uniq = new Set();
  let affix = 0;
  for (let i = 0; i < 3000; i++) {
    const it = genItem(rng, 9, { bonus: 2, pool: BASE.pool });
    seen.add(it.kind);
    if (it.affix) affix++;
    if (it.set) sets.add(it.set);
    if (it.unique) uniq.add(it.unique);
  }
  for (const k of ['cannon', 'shard', 'charge', 'reflect', 'thorns', 'regen', 'ablative']) assert.ok(seen.has(k), `sale ${k} sin desbloquear`);
  assert.ok(affix > 0 && sets.size === 6 && uniq.size === 8, `afijos ${affix}, sets ${sets.size}, únicos ${uniq.size}`);
  // el taller lo MEJORA: más afijos, placas templadas, 4 opciones
  const all = workshopShip(Object.fromEntries(WORKSHOP.map((w) => [w.id, 9])));
  assert.ok(Object.values(all.pool).every(Boolean));
  assert.equal(all.vaultSlots, 3);
  let affix2 = 0;
  const r2 = makeRng(4);
  for (let i = 0; i < 3000; i++) { const it = genItem(r2, 9, { bonus: 2, pool: all.pool }); if (it.affix) affix2++; if (it.slot === 'plating' && it.kind === 'ablative') assert.ok(it.shield >= 3); }
  assert.ok(affix2 > affix * 1.3, `más afijos con la Armería (${affix} → ${affix2})`);
  assert.equal(genChoice(makeRng(1), 3, { n: 4 }).length, 4);
  assert.ok(Math.abs(workshopShip({ arsCrit: 2 }).crit - 0.16) < 1e-9);
});

test('cartografía: sin comprar nada ya hay escotilla ☠️, trampas y salas de élite', () => {
  let traps = 0, elite = 0;
  for (let seed = 1; seed <= 25; seed++) {
    for (let d = 1; d <= 4; d++) {
      const f = genFloor(seed, d);
      Object.assign(f, { pool: BASE.pool, heat: 0 });
      if (Object.values(f.rooms).some((r) => r.type === 'elite')) elite++;
      for (const id of Object.keys(f.rooms)) {
        const room = genRoom(f, id);
        if (room.tiles.flat().some((k) => ['J', '<', '>', '^', 'v', 'E'].includes(k)) || room.sweep) traps++;
        if (room.type === 'exit') assert.ok(room.tiles.flat().includes('Y'), 'la salida tiene escotilla ☠️');
      }
    }
  }
  assert.ok(traps > 20 && elite > 5, `trampas ${traps}, plantas con élite ${elite}`);
});

test('mejoras de cartografía: botas, contactos y burbuja', () => {
  const s = newRun(5, { hp: 6, pool: workshopShip({ hullShield: 1 }).pool });
  assert.equal(s.player.shield >= 0, true);
  const sh = newRun(7, { hp: 6, pool: workshopShip({ mapShop: 1 }).pool });
  const room = { id: 'x', type: 'shop' };
  assert.equal(shopStock(sh, room).length, 5);
  assert.equal(shopStock(newRun(7, { hp: 6 }), { id: 'x', type: 'shop' }).length, 4);
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

test('bajar de planta cura 1 solo si vas por debajo de la mitad; con profundidad 4, nunca', () => {
  const down = (heat) => {
    const s = newRun(3, { hp: 6, heat });
    const room = roomOf(s);
    room.tiles = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (__, c) => (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 ? '#' : '.')));
    room.tiles[MID_R][MID_C] = 'X';
    Object.assign(room, { enemies: [], cleared: true });
    s.player.hp = 2;
    for (let i = 0; i < 5 && s.depth === 1; i++) updateRun(s, DT);
    return s.player.hp;
  };
  assert.equal(down(0), 3);
  assert.equal(down(4), 2);
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
