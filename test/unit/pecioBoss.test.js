import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  genFloor, newRun, updateRun, roomOf, isBossFloor, bossOf, BOSSES, chooseExit, keptPiezas, WORKSHOP, workshopCost, workshopLevel, workshopShip,
  COLS, ROWS, MID_C, MID_R, LAST_FLOOR,
} from '../../js/pecio.js';

const DT = 1 / 30;
const run = (s, sec, input = { x: 0, y: 0 }) => { const ev = []; for (let t = 0; t < sec && !s.offer && !s.choice && !s.over; t += DT) ev.push(...updateRun(s, DT, input)); return ev; };
// a la sala del jefe de una planta concreta
function bossRoom(depth, hp = 50) {
  const s = newRun(11, { hp });
  s.depth = depth;
  s.floor = genFloor(11, depth);
  s.rooms = {};
  s.at = Object.keys(s.floor.rooms).find((k) => s.floor.rooms[k].type === 'boss');
  const room = roomOf(s);
  Object.assign(s.player, { x: MID_C + 0.5, y: ROWS - 2.5, ang: 0, fireCd: 99, inv: 0 });
  return { s, room, boss: room.enemies.find((e) => e.kind === 'boss') };
}

test('jefes: uno cada 3 plantas, en la sala de la salida, y van rotando (también en el sin fin)', () => {
  for (const d of [1, 2, 4, 5, 7, 8, 10]) assert.equal(isBossFloor(d), false);
  assert.deepEqual([3, 6, 9, 12, 15, 18].map(bossOf), ['guardian', 'swarm', 'core', 'guardian', 'swarm', 'core']);
  for (const d of [3, 6, 9, 12]) {
    const f = genFloor(5, d);
    const ids = Object.keys(f.rooms);
    assert.equal(ids.filter((id) => f.rooms[id].type === 'boss').length, 1);
    assert.equal(f.rooms[f.exit].type, 'boss');
  }
  // más duros en la segunda vuelta
  assert.ok(bossRoom(12).boss.max > bossRoom(3).boss.max * 1.3);
  // sin escotilla hasta vencerlo
  const { room } = bossRoom(3);
  assert.notEqual(room.tiles[MID_R][MID_C], 'X');
});

test('Guardián: avisa con su franja antes de embestir; contra la pared queda aturdido y recibe el doble', () => {
  const { s, room, boss } = bossRoom(3);
  boss.cd = 0;
  run(s, 0.1);
  assert.ok(boss.charge > 0 && boss.aim !== null, 'marca la franja');
  run(s, 1.4); // embiste
  assert.ok(boss.dashT > 0 || boss.stun > 0);
  // forzar el choque: en marcha hacia la pared de arriba
  Object.assign(boss, { x: MID_C + 0.5, y: 2, aim: 0, dashT: 1, charge: 0, stun: 0 });
  Object.assign(s.player, { x: 1.5, y: ROWS - 2.5 });
  const ev = run(s, 0.6);
  assert.ok(ev.some((e) => e.type === 'slam'));
  assert.ok(boss.stun > 0);
  // vulnerable: el doble de daño
  const hp0 = boss.hp;
  s.player.fireCd = 0;
  Object.assign(s.player, { x: boss.x, y: boss.y + 3 });
  run(s, 0.25);
  assert.ok(hp0 - boss.hp >= 2 * s.player.dmg, `recibe el doble (${hp0 - boss.hp})`);
  assert.ok(room.enemies.length >= 1);
});

test('Enjambre: la reina se cura mientras haya nodos; a la mitad se divide', () => {
  const { s, room, boss } = bossRoom(6);
  const nodes = () => room.enemies.filter((e) => e.alive && e.kind === 'node');
  assert.equal(nodes().length, 4);
  boss.hp = boss.max - 10;
  run(s, 2);
  assert.ok(boss.hp > boss.max - 10, 'se cura');
  for (const n of nodes()) n.alive = false;
  boss.cd = 99;
  const h = boss.hp;
  run(s, 2);
  assert.ok(boss.hp <= h + 1e-9, 'sin nodos, no se cura');
  boss.hp = Math.floor(boss.max / 2) - 1;
  const ev = run(s, 0.1);
  assert.ok(ev.some((e) => e.type === 'phase'));
  assert.equal(nodes().length, 3, 'fase 2: se divide');
});

test('Núcleo: marca casillas y arden al rato (si sigues encima, te quema); en fase 2 electrifica el suelo', () => {
  const { s, room, boss } = bossRoom(9);
  boss.cd = 0;
  run(s, 0.1);
  assert.ok(room.marks.length > 0 && room.markT > 0);
  // ponte en una casilla marcada y espera
  const [c, r] = room.marks[0];
  Object.assign(s.player, { x: c + 0.5, y: r + 0.5, inv: 0 });
  const hp0 = s.player.hp;
  const ev = run(s, 1.3);
  assert.ok(ev.some((e) => e.type === 'pulse'));
  assert.ok(s.player.hp < hp0);
  const e0 = room.tiles.flat().filter((t) => t === 'E').length;
  boss.hp = Math.floor(boss.max / 2) - 1;
  run(s, 0.1);
  assert.ok(room.tiles.flat().filter((t) => t === 'E').length > e0, 'suelo electrificado');
});

test('jefe vencido: escotilla, botín épico o mejor y sus 🔩; los nodos caen con la reina', () => {
  const { s, room, boss } = bossRoom(6);
  boss.hp = 1;
  s.player.fireCd = 0;
  Object.assign(s.player, { x: boss.x, y: boss.y + 2.5 });
  const p0 = s.player.piezas;
  // los nodos, quietos y lejos (si no, el disparo automático va a por ellos, que están más cerca)
  for (const n of room.enemies) if (n.kind === 'node') Object.assign(n, { stun: 99, x: 1.5, y: ROWS - 1.6 });
  const ev = run(s, 1.5);
  assert.ok(ev.some((e) => e.type === 'bossDown'));
  assert.equal(room.tiles[MID_R][MID_C], 'X');
  assert.ok(room.enemies.every((e) => !e.alive || e.kind !== 'node'));
  assert.ok(s.player.piezas >= p0 + BOSSES.swarm.piezas);
  const loot = room.pickups.find((x) => x.kind === 'item');
  assert.ok(loot && loot.item.tier >= 2);
  assert.equal(s.bosses, 1);
});

test('planta 9: salir con todo o seguir en el modo sin fin (y entonces ya no pierdes 🔩)', () => {
  const s = newRun(3, { hp: 20 });
  s.depth = LAST_FLOOR;
  const room = roomOf(s);
  room.tiles = room.tiles.map((row) => row.map((t) => (t === 'D' ? '#' : t)));
  room.tiles[MID_R][MID_C] = 'X';
  room.enemies = []; room.type = 'exit';
  Object.assign(s.player, { x: MID_C + 0.5, y: MID_R + 0.5, piezas: 100 });
  const ev = run(s, 0.1);
  assert.ok(ev.some((e) => e.type === 'exitChoice'));
  assert.equal(s.choice, 'exit');
  const t0 = s.time; updateRun(s, 1, { x: 0, y: -1 }); assert.equal(s.time, t0, 'la partida espera');
  // seguir
  const s2 = structuredClone({ ...s, rng: null });
  s2.rng = s.rng;
  const ev2 = chooseExit(s2, 'continue');
  assert.ok(ev2.some((e) => e.type === 'endless'));
  assert.equal(s2.depth, LAST_FLOOR + 1);
  assert.equal(s2.over, false);
  s2.player.piezas = 80;
  assert.equal(keptPiezas(s2), 80, 'en el sin fin te llevas todas');
  // salir
  chooseExit(s, 'leave');
  assert.equal(s.won, true);
  assert.equal(s.over, true);
});

test('taller: niveles, precios que suben, tope y lo que te da al empezar', () => {
  const up = {};
  assert.equal(workshopLevel(up, 'hull'), 0);
  const c1 = workshopCost(up, 'hull');
  up.hull = 1;
  assert.ok(workshopCost(up, 'hull') > c1);
  up.hull = 99;
  assert.equal(workshopLevel(up, 'hull'), WORKSHOP.find((w) => w.id === 'hull').cost.length);
  assert.equal(workshopCost(up, 'hull'), null, 'al máximo');
  const ws = workshopShip({ hull: 3, keys: 2, pack: 2, luck: 1, power: 1 });
  assert.deepEqual([ws.hpBonus, ws.keys, ws.bag.kit, ws.bagMax, ws.luck, ws.bonusDmg], [3, 2, 1, 4, 1, 1]);
  const s = newRun(1, { hp: 6 + ws.hpBonus, ...ws });
  assert.equal(s.player.max, 9);
  assert.equal(s.player.keys, 2);
  assert.equal(s.player.bag.kit, 1);
  assert.equal(s.player.bagMax, 4);
  assert.equal(s.player.dmg, 3);
  assert.ok(COLS > 0);
});
