import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRun, updateRun, roomOf, dash, assistAim, angOf, comboMul, COMBO_T, AIM_ASSIST, COLS, ROWS, MID_C, MID_R, ENEMY } from '../../js/pecio.js';
import { emit, stepParts, MAX_PARTS } from '../../js/pecioFx.js';

const DT = 1 / 30;
function arena(s, ...enemies) {
  const room = roomOf(s);
  room.tiles = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (__, c) => (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 ? '#' : '.')));
  room.type = 'combat';
  room.wake = 0;
  room.cleared = false;
  room.enemies = enemies.map(([kind, x, y, extra = {}], i) => ({ id: `t${i}`, kind, x, y, ang: Math.PI, hp: ENEMY[kind].hp, max: ENEMY[kind].hp, r: ENEMY[kind].r, cd: 99, charge: 0, aim: null, fuse: null, stun: 99, hitT: 0, alive: true, ...extra }));
  Object.assign(s.player, { x: MID_C + 0.5, y: MID_R + 0.5, ang: 0, fireCd: 0, inv: 0 });
  return room;
}
const run = (s, sec, input) => { const ev = []; for (let t = 0; t < sec; t += DT) ev.push(...updateRun(s, DT, input)); return ev; };
const T = (o) => ({ abs: true, x: 0, y: 0, ax: 0, ay: 0, fire: false, ...o });

test('twin-stick: el stick izquierdo mueve en la dirección del mapa y la nave mira hacia donde apuntas', () => {
  const s = newRun(3, { hp: 99 });
  arena(s);
  const x0 = s.player.x;
  run(s, 0.4, T({ x: 1 })); // a la derecha (este)
  assert.ok(s.player.x > x0 + 0.5, 'va al este sin tener que girar antes');
  run(s, 0.4, T({ ax: 0, ay: 1 })); // apunta al sur
  assert.ok(Math.abs(Math.cos(s.player.ang - Math.PI)) > 0.95, 'mira al sur');
  assert.equal(angOf(0, -1), 0);
});

test('twin-stick: solo dispara si aprietas, y hacia donde apuntas', () => {
  const s = newRun(4, { hp: 99 });
  arena(s);
  run(s, 0.5, T({ ax: 1 }));
  assert.equal(s.shots.length, 0, 'sin apretar no dispara');
  run(s, 0.2, T({ ax: 1, fire: true }));
  assert.ok(s.shots.length > 0);
  assert.ok(s.shots.every((b) => b.vx > 0), 'las balas van al este');
});

test('ayuda de puntería: corrige hacia un enemigo dentro del cono, no fuera', () => {
  const s = newRun(5, { hp: 99 });
  const room = arena(s, ['drone', MID_C + 0.5 + 3, MID_R + 0.5 - 0.4]);
  const east = angOf(1, 0);
  const a = assistAim(s, room, east);
  assert.notEqual(a, east, 'se corrige');
  assert.ok(Math.abs(a - east) < AIM_ASSIST + 0.01);
  assert.equal(assistAim(s, room, angOf(-1, 0)), angOf(-1, 0), 'apuntando al otro lado, recto');
  // y le da
  run(s, 1, T({ ax: 1, fire: true }));
  assert.ok(room.enemies[0].hp < ENEMY.drone.hp);
});

test('disparo automático (Ajustes): sin apuntar, dispara solo al más cercano', () => {
  const s = newRun(6, { hp: 99 });
  const room = arena(s, ['drone', MID_C + 0.5, 2.5]);
  run(s, 1, T({ auto: true }));
  assert.ok(room.enemies[0].hp < ENEMY.drone.hp);
});

test('esquive con twin-stick: va hacia donde te mueves, no hacia donde apuntas', () => {
  const s = newRun(7, { hp: 99 });
  arena(s);
  run(s, 0.3, T({ x: -1, ax: 1 })); // vas al oeste mirando al este
  const x0 = s.player.x;
  dash(s);
  run(s, 0.2, T({ x: -1, ax: 1 }));
  assert.ok(s.player.x < x0 - 1, 'el esquive va al oeste');
});

test('combo: bajas encadenadas suben las 🔩 hasta +50 % y caduca a los 2,5 s', () => {
  assert.equal(comboMul(1), 1);
  assert.equal(comboMul(3), 1.1);
  assert.equal(comboMul(50), 1.5);
  const s = newRun(8, { hp: 99 });
  arena(s, ['drone', MID_C + 0.5, MID_R - 1, { hp: 1 }], ['drone', MID_C + 0.5, 2.5, { hp: 1 }]);
  const ev = run(s, 1.5, T({ ay: -1, fire: true }));
  const kills = ev.filter((e) => e.type === 'kill');
  assert.equal(kills.length, 2);
  assert.equal(kills[1].combo, 2);
  assert.ok(kills[1].last, 'la última baja de la sala lo sabe (cámara lenta)');
  run(s, COMBO_T + 0.2, T({}));
  assert.equal(s.combo, null);
});

test('partículas: nunca más de MAX_PARTS y desaparecen solas', () => {
  const s = {};
  for (let i = 0; i < 50; i++) emit(s, 1, 1, 20, { life: 0.3 });
  assert.equal(s.parts.length, MAX_PARTS);
  for (let i = 0; i < 30; i++) stepParts(s, 0.05);
  assert.equal(s.parts.length, 0);
});
