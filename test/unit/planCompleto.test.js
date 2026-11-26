// Lo que faltaba del plan: armas Fragmentador y Acumulador, botín nuevo para todos desde la planta 1,
// jefes en fase 2 con Profundidad 6, y en Galaxia los enemigos nuevos cerca de ORIGEN
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRun, updateRun, roomOf, genFloor, bossOf, ENEMY, COLS, ROWS, MID_C, MID_R, CHARGE_T, LAYOUTS, pickLayout } from '../../js/pecio.js';
import { WEAPONS } from '../../js/pecioLoot.js';
import { makeRng } from '../../js/rng.js';
import { rareKind } from '../../js/galaxyTactics.js';
import { CAMPAIGNS } from '../../js/factions.js';
import { GEAR_HEAT } from '../../js/galaxyCombat.js';

const DT = 1 / 30;
const step = (s, input = { x: 0, y: 0 }) => updateRun(s, DT, input);
function range(weapon) {
  const w = { id: 'w', slot: 'weapon', kind: weapon, tier: 1, dmg: 1, rate: weapon === 'charge' ? 1 : 0.85, bounces: 0, orbs: 0 };
  const s = newRun(3, { hp: 9, gear: [w] });
  const room = roomOf(s);
  room.tiles = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (__, c) => (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 ? '#' : '.')));
  Object.assign(room, { type: 'combat', wake: 0, cleared: false, pickups: [], sweep: null, t: 0 });
  const mk = (i, x, y) => ({ id: `t${i}`, kind: 'turret', x, y, ang: 0, hp: 40, max: 40, r: ENEMY.turret.r, cd: 99, charge: 0, aim: null, fuse: null, stun: 99, hitT: 0, alive: true });
  room.enemies = [mk(0, MID_C + 0.5, 2.5), mk(1, MID_C - 1.5, 1.6), mk(2, MID_C + 2.5, 1.6)];
  s.floor.event = null;
  Object.assign(s.player, { x: MID_C + 0.5, y: MID_R + 1.5, ang: -Math.PI / 2, fireCd: 0, inv: 99, vel: 0 });
  return { s, room };
}

test('Fragmentador: cada bala se parte en dos al impactar', () => {
  assert.ok(WEAPONS.shard && WEAPONS.charge);
  const { s } = range('shard');
  let splits = 0;
  for (let i = 0; i < 60; i++) { step(s); splits = Math.max(splits, s.shots.filter((b) => b.split).length); }
  assert.ok(splits >= 2, `fragmentos: ${splits}`);
});

test('Acumulador: no dispara hasta cargarse (quieto, el doble de rápido) y pega ×3', () => {
  const { s } = range('charge');
  let first = null;
  for (let i = 0; i < 120 && first === null; i++) { step(s); if (s.shots.length) first = i * DT; }
  assert.ok(first !== null && first >= CHARGE_T / 2 - 0.1 && first <= CHARGE_T / 2 + 0.2, `quieto, a los ${first} s`);
  assert.equal(s.shots[0].dmg, s.player.dmg * 3);
  assert.ok(s.shots[0].pierce && s.shots[0].big);
  // moviéndose tarda el doble
  const { s: s2 } = range('charge');
  let t2 = null;
  for (let i = 0; i < 120 && t2 === null; i++) { step(s2, { x: 0, y: 0, throttle: 1 }); s2.player.vel = 1; if (s2.shots.length) t2 = i * DT; }
  assert.ok(t2 > first + 0.3, `en marcha, a los ${t2} s`);
});

test('lo nuevo de Pecios sale desde la planta 1: trampas y el Divisor', () => {
  const rng = makeRng(9);
  const ids = new Set(Array.from({ length: 400 }, () => pickLayout(rng, 1).id));
  assert.ok(ids.has('spikes') && ids.has('electric'), [...ids].join(','));
  assert.ok(LAYOUTS.length >= 18);
  assert.equal(ENEMY.splitter.from, 1);
});

test('Profundidad 6: los jefes empiezan ya en su fase 2', () => {
  const s = newRun(11, { hp: 50, heat: 6 });
  s.depth = 3;
  s.floor = genFloor(11, 3);
  s.floor.boss = bossOf(3);
  s.floor.heat = 6;
  s.rooms = {};
  s.at = Object.keys(s.floor.rooms).find((k) => s.floor.rooms[k].type === 'boss');
  const room = roomOf(s), boss = room.enemies.find((e) => e.kind === 'boss');
  Object.assign(s.player, { x: MID_C + 0.5, y: ROWS - 2.5, fireCd: 99, inv: 99 });
  const ev = [];
  for (let i = 0; i < 90; i++) ev.push(...step(s));
  assert.equal(boss.phase, 2);
  assert.ok(ev.some((e) => e.type === 'phase'));
});

test('Galaxia: el Reparador sale ya en peligro 1, la fragata en 2 y el resto en 3; armas con su calor; campañas antes', () => {
  const at = (d) => new Set(Array.from({ length: 100 }, (_, i) => rareKind(d, 1, i / 100)));
  assert.ok(at(1).has('mender'));
  assert.ok(at(2).has('frigate'));
  for (const k of ['carrier', 'wraith']) assert.ok(at(3).has(k), k);
  assert.ok(!at(0).has('mender'), 'en ORIGEN, nada raro');
  for (const k of ['rail', 'burst', 'ion']) assert.ok(GEAR_HEAT[k] > 0, k);
  for (const f of Object.keys(CAMPAIGNS)) assert.equal(CAMPAIGNS[f].need, 10);
});
