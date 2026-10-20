import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genFloor, newRun, updateRun, roomOf, nearestTarget, makeElite, gainPiezas, EVENTS, ENEMY, COLS, ROWS, MID_C, MID_R, dash } from '../../js/pecio.js';

const DT = 1 / 30;
const run = (s, sec, input = { x: 0, y: 0 }) => { const ev = []; for (let t = 0; t < sec && !s.offer && !s.over && !s.choice; t += DT) ev.push(...updateRun(s, DT, input)); return ev; };
function bossRoom(depth, hp = 60) {
  const s = newRun(11, { hp });
  s.depth = depth;
  s.floor = genFloor(11, depth);
  s.floor.event = null;
  s.rooms = {};
  s.at = Object.keys(s.floor.rooms).find((k) => s.floor.rooms[k].type === 'boss');
  const room = roomOf(s);
  Object.assign(s.player, { x: MID_C + 0.5, y: ROWS - 2.5, ang: 0, fireCd: 99, inv: 0 });
  return { s, room, bosses: room.enemies.filter((e) => e.kind === 'boss') };
}
function arena(s, ...foes) {
  const room = roomOf(s);
  room.tiles = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (__, c) => (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 ? '#' : '.')));
  Object.assign(room, { type: 'combat', wake: 0, cleared: false, pickups: [] });
  room.enemies = foes.map(([kind, x, y, extra = {}], i) => ({ id: `t${i}`, kind, x, y, ang: 0, hp: ENEMY[kind].hp, max: ENEMY[kind].hp, r: ENEMY[kind].r, cd: 0, charge: 0, aim: null, fuse: null, stun: 0, hitT: 0, alive: true, ...extra }));
  Object.assign(s.player, { x: MID_C + 0.5, y: MID_R + 0.5, ang: 0, fireCd: 99, inv: 0 });
  return room;
}

test('Excavadora: se hunde (no se le puede apuntar), marca tus casillas y sale ahí aturdida', () => {
  const { s, room, bosses: [b] } = bossRoom(12);
  assert.equal(b.boss, 'excavator');
  b.cd = 0;
  run(s, 0.1);
  assert.ok(b.hidden, 'bajo tierra');
  assert.equal(nearestTarget(s), null, 'no se le apunta');
  assert.ok(room.marks.length >= 4 && room.markT > 0);
  const [c, r] = room.marks[0];
  Object.assign(s.player, { x: c + 0.5, y: r + 0.5, inv: 0 });
  const hp = s.player.hp;
  run(s, 1.2);
  assert.ok(!b.hidden && b.stun > 0, 'sale aturdida');
  assert.ok(s.player.hp < hp, 'si te quedas encima, duele');
});

test('Fantasma: invisible e invulnerable; aparece, marca su línea (ahí se le puede dar) y vuelve a esfumarse', () => {
  const { s, bosses: [b] } = bossRoom(15);
  assert.equal(b.boss, 'phantom');
  b.cd = 5;
  run(s, 0.1);
  assert.ok(b.hidden);
  const h0 = b.hp;
  s.player.fireCd = 0;
  run(s, 0.5);
  assert.equal(b.hp, h0, 'oculto: las balas no le hacen nada');
  b.cd = 0;
  run(s, 0.1);
  assert.ok(!b.hidden && b.charge > 0, 'visible mientras apunta');
  assert.ok(nearestTarget(s) === b);
});

test('Fusión: si cae un núcleo y el otro sigue, revive; tumbando los dos a la vez, cae el jefe', () => {
  const { s, room, bosses } = bossRoom(18);
  assert.equal(bosses.length, 2);
  assert.ok(bosses.every((b) => b.boss === 'fusion'));
  const [a, b] = bosses;
  for (const x of bosses) x.cd = 99;
  // solo uno: revive al rato
  a.hp = 1;
  s.player.fireCd = 0;
  Object.assign(s.player, { x: a.x, y: a.y + 3 });
  let ev = run(s, 1);
  assert.ok(ev.some((e) => e.type === 'fusionDown'));
  assert.equal(a.alive, false);
  s.player.fireCd = 99;
  ev = run(s, 4.5);
  assert.ok(ev.some((e) => e.type === 'fusionUp'));
  assert.ok(a.alive && a.hp === Math.round(a.max * 0.5));
  // los dos a la vez
  a.hp = 1; b.hp = 1;
  Object.assign(b, { x: a.x + 0.6, y: a.y });
  s.player.fireCd = 0;
  Object.assign(s.player, { x: a.x, y: a.y + 2.6 });
  ev = run(s, 2.5);
  assert.ok(ev.some((e) => e.type === 'bossDown'), 'cae el jefe');
  assert.equal(room.tiles[MID_R][MID_C], 'X');
});

test('élites: rápidos, blindados (doble vida), regeneradores y explosivos; sueltan más', () => {
  const e = { kind: 'drone', hp: 4, max: 4, r: 0.32 };
  makeElite(e, 'armored');
  assert.equal(e.max, 8);
  const f = { kind: 'drone', hp: 4, max: 4, r: 0.32 };
  makeElite(f, 'fast');
  assert.equal(f.speedMul, 1.5);
  // regenerador
  let s = newRun(1, { hp: 99 });
  let room = arena(s, ['drone', 2.5, 2.5, { stun: 99 }]);
  makeElite(room.enemies[0], 'regen');
  room.enemies[0].hp = 1;
  run(s, 2);
  assert.ok(room.enemies[0].hp > 1.5);
  // explosivo: al morir, estalla
  s = newRun(2, { hp: 20 });
  room = arena(s, ['drone', MID_C + 0.5, MID_R - 0.9, { stun: 99, hp: 1 }]);
  makeElite(room.enemies[0], 'explosive');
  s.player.fireCd = 0;
  const hp = s.player.hp;
  const ev = run(s, 0.4);
  assert.ok(ev.some((x) => x.type === 'boom'));
  assert.ok(s.player.hp < hp);
  // aparecen más hondo
  let elites = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const fl = genFloor(seed, 8), sr = newRun(seed, {});
    sr.floor = fl; sr.rooms = {};
    for (const id of Object.keys(fl.rooms)) elites += roomOf(sr, id).enemies.filter((x) => x.elite).length;
  }
  assert.ok(elites > 10, `élites en la planta 8 (${elites})`);
});

test('sucesos de planta: apagón, invasión, gravedad baja y fiebre del oro', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 80; seed++) for (const d of [2, 5, 8]) { const ev = genFloor(seed, d).event; if (ev) seen.add(ev); }
  assert.deepEqual([...seen].sort(), Object.keys(EVENTS).sort());
  assert.equal(genFloor(3, 1).event, null, 'nunca en la planta 1');
  // fiebre del oro: el doble de 🔩
  const s = newRun(3, {});
  s.floor.event = null;
  const a = gainPiezas(s, 10);
  s.floor.event = 'gold';
  assert.equal(gainPiezas(s, 10), a * 2);
  // gravedad baja: esquive más largo
  s.floor.event = 'lowgrav';
  s.player.dashCd = 0;
  dash(s);
  assert.ok(s.player.dashT > 0.3);
});
