// PECIOS · variedad y tensión: plantillas de sala, trampas nuevas, escotilla peligrosa, jefes al azar,
// enemigos nuevos, salas de élite, presión (racha e inundación) y críticos
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  genFloor, genRoom, newRun, updateRun, roomOf, bossFor, BOSS_POOL, CURSES, CURSE_REWARD, LAYOUTS, FLOOD_AT, ENEMY, ELITE,
  COLS, ROWS, MID_C, MID_R, DIRS, DOOR_TILE, gainPiezas, hasTrait,
} from '../../js/pecio.js';

const DT = 1 / 30;
const run = (s, sec, input = { x: 0, y: 0 }) => { const ev = []; for (let t = 0; t < sec && !s.offer && !s.over && !s.choice; t += DT) ev.push(...updateRun(s, DT, input)); return ev; };
function arena(s, ...foes) {
  const room = roomOf(s);
  room.tiles = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (__, c) => (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 ? '#' : '.')));
  Object.assign(room, { type: 'combat', wake: 0, cleared: false, pickups: [], mimic: false, opened: false, freeChest: false, sweep: null, t: 0 });
  room.enemies = foes.map(([kind, x, y, extra = {}], i) => ({ id: `t${i}`, kind, x, y, ang: 0, hp: ENEMY[kind].hp, max: ENEMY[kind].hp, r: ENEMY[kind].r, cd: 0, charge: 0, aim: null, fuse: null, stun: 0, hitT: 0, alive: true, ...extra }));
  s.floor.event = null;
  Object.assign(s.player, { x: MID_C + 0.5, y: MID_R + 0.5, ang: 0, fireCd: 99, inv: 0 });
  return room;
}
// desde el centro, ¿se llega a todas las puertas (andando, sin pisar paredes)?
function doorsReachable(room) {
  const solid = (k) => ['#', 'C', 'T', 'A', 'K'].includes(k);
  const seen = new Set([`${MID_C},${MID_R}`]), q = [[MID_C, MID_R]];
  while (q.length) {
    const [c, r] = q.shift();
    for (const d of Object.values(DIRS)) {
      const nc = c + d.dx, nr = r + d.dy, k = `${nc},${nr}`;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS || seen.has(k) || solid(room.tiles[nr][nc])) continue;
      seen.add(k); q.push([nc, nr]);
    }
  }
  return Object.keys(room.doors || {}).filter((k) => k !== room.secret).every((k) => seen.has(DOOR_TILE[k].join(',')));
}

test('plantillas: muchas formas de sala, deterministas, y la cruz central siempre libre', () => {
  const used = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    for (let depth = 1; depth <= 9; depth++) {
      const f = genFloor(seed, depth);
      for (const id of Object.keys(f.rooms)) {
        const a = genRoom(f, id), b = genRoom(f, id);
        assert.deepEqual(a.tiles, b.tiles, 'la misma semilla, la misma sala');
        if (a.layout) used.add(a.layout);
        for (let c = 1; c < COLS - 1; c++) assert.ok(!['#', 'P'].includes(a.tiles[MID_R][c]) || a.tiles[MID_R][c] === 'X', `fila central libre (${a.layout})`);
        for (let r = 1; r < ROWS - 1; r++) assert.ok(!['#', 'P'].includes(a.tiles[r][MID_C]), `columna central libre (${a.layout})`);
        assert.ok(doorsReachable({ ...a, doors: f.rooms[id].doors, secret: f.rooms[id].secret }), `semilla ${seed}, planta ${depth}, sala ${id}: puertas alcanzables`);
      }
    }
  }
  assert.ok(used.size >= LAYOUTS.length - 1, `salen casi todas las plantillas (${used.size}/${LAYOUTS.length})`);
});

test('pinchos a ritmo (con aviso), cinta que arrastra y láser que barre', () => {
  const s = newRun(1, { hp: 9 });
  const room = arena(s);
  room.tiles[MID_R - 2][MID_C] = 'J';
  Object.assign(s.player, { x: MID_C + 0.5, y: MID_R - 1.5 });
  s.time = (MID_C + MID_R - 2) % 2 ? 1.3 : 0.1; // salen ya (las casillas alternas van desfasadas 1,2 s)
  let ev = run(s, 0.1);
  assert.ok(ev.some((e) => e.type === 'hurt' && e.src === 'pinchos'));
  // cinta
  const s2 = newRun(2, { hp: 9 });
  const r2 = arena(s2);
  for (let c = 1; c < COLS - 1; c++) r2.tiles[2][c] = '>';
  Object.assign(s2.player, { x: 2.5, y: 2.5 });
  run(s2, 1);
  assert.ok(s2.player.x > 3.8, 'la cinta te lleva');
  // láser que barre
  const s3 = newRun(3, { hp: 9 });
  const r3 = arena(s3, ['drone', 1.5, 1.5, { stun: 99, hp: 99, max: 99 }]);
  r3.sweep = { x: MID_C + 0.5, y: MID_R + 0.5, ang: Math.PI / 2 - 0.3, len: 3.6, spd: 1 };
  Object.assign(s3.player, { x: MID_C + 2.5, y: MID_R + 0.5 });
  ev = run(s3, 1);
  assert.ok(ev.some((e) => e.type === 'hurt' && e.src === 'láser'));
});

test('escotilla PELIGROSA: maldición en la planta siguiente, que paga ×1,5 y la Fragilidad pega más', () => {
  const f = genFloor(4, 1);
  const exit = genRoom(f, f.exit);
  assert.equal(exit.tiles[MID_R][MID_C], 'X');
  assert.equal(exit.tiles[MID_R + 2][MID_C + 2], 'Y');
  const s = newRun(4, { hp: 9 });
  const room = arena(s);
  room.tiles[MID_R + 2][MID_C + 2] = 'Y';
  room.cleared = true;
  Object.assign(s.player, { x: MID_C + 2.5, y: MID_R + 2.5 });
  const ev = run(s, 0.1);
  const fl = ev.find((e) => e.type === 'floor');
  assert.ok(fl && fl.curse in CURSES, 'baja con maldición');
  assert.equal(s.depth, 2);
  s.floor.event = null;
  const p0 = s.player.piezas;
  gainPiezas(s, 10);
  assert.equal(s.player.piezas - p0, Math.round(10 * CURSE_REWARD));
  s.floor.curse = 'fragile';
  const r2 = arena(s, ['drone', MID_C + 0.5, MID_R - 0.4, { hp: 99, max: 99, cd: 0 }]);
  const hp0 = s.player.hp;
  run(s, 0.5);
  assert.equal(hp0 - s.player.hp, 2, 'frágil: el dron quita 2');
  assert.ok(r2);
  // la segura no maldice
  const s2 = newRun(5, { hp: 9 });
  const room2 = arena(s2);
  room2.tiles[MID_R][MID_C] = 'X';
  room2.cleared = true;
  const ev2 = run(s2, 0.1);
  assert.equal(ev2.find((e) => e.type === 'floor').curse, null);
});

test('jefes al azar: cada partida baraja los 6 y no repite hasta agotarlos', () => {
  const order = [3, 6, 9, 12, 15, 18].map((d) => bossFor(7, d));
  assert.equal(new Set(order).size, 6);
  assert.deepEqual(order, [3, 6, 9, 12, 15, 18].map((d) => bossFor(7, d)), 'determinista');
  assert.ok(BOSS_POOL.every((b) => order.includes(b)));
  const firsts = new Set(Array.from({ length: 20 }, (_, i) => bossFor(i + 1, 3)));
  assert.ok(firsts.size >= 4, 'el de la planta 3 cambia de una partida a otra');
  assert.equal(genFloor(7, 3).boss, bossFor(7, 3));
});

test('enemigos nuevos: divisor, sanador, saltador y minador', () => {
  // divisor: se parte en dos drones pequeños
  const s = newRun(6, { hp: 99 });
  const room = arena(s, ['splitter', MID_C + 0.5, MID_R - 2.5, { stun: 99, hp: 1, max: 1 }]);
  s.player.fireCd = 0;
  run(s, 0.6);
  assert.equal(room.enemies.filter((e) => e.small && e.alive).length, 2);
  // sanador
  const s2 = newRun(7, { hp: 99 });
  const r2 = arena(s2, ['healer', 2.5, 1.5, { cd: 0 }], ['drone', 2.5, 2.5, { stun: 99, hp: 2, max: 10 }]);
  const ev2 = run(s2, 0.3);
  assert.ok(ev2.some((e) => e.type === 'heal'));
  assert.ok(r2.enemies[1].hp > 2);
  // saltador: marca y aparece junto a ti
  const s3 = newRun(8, { hp: 99 });
  const r3 = arena(s3, ['jumper', 1.5, 1.5, { cd: 0 }]);
  run(s3, 0.2);
  assert.ok(r3.enemies[0].jump, 'avisa antes');
  run(s3, 1);
  assert.ok(Math.hypot(r3.enemies[0].x - s3.player.x, r3.enemies[0].y - s3.player.y) < 1.5, 'aparece a tu lado');
  // minador
  const s4 = newRun(9, { hp: 99 });
  const r4 = arena(s4, ['miner', 2.5, 2.5, { cd: 0 }]);
  run(s4, 3);
  assert.ok(r4.tiles.flat().includes('M'), 'deja minas');
});

test('sala de élite: todos con dos rasgos y premio al limpiarla', () => {
  let found = null;
  for (let seed = 1; seed < 80 && !found; seed++) {
    for (let d = 3; d <= 9 && !found; d++) {
      const f = genFloor(seed, d);
      const id = Object.keys(f.rooms).find((k) => f.rooms[k].type === 'elite');
      if (id) found = genRoom(f, id);
    }
  }
  assert.ok(found, 'sale alguna sala de élite');
  for (const e of found.enemies) {
    assert.equal(e.traits.length, 2);
    assert.notEqual(e.traits[0], e.traits[1]);
    assert.ok(e.traits.every((t) => t in ELITE && hasTrait(e, t)));
  }
});

test('presión: limpiar deprisa encadena racha; demorarse inunda la sala', () => {
  const s = newRun(10, { hp: 99 });
  arena(s, ['drone', MID_C + 0.5, MID_R - 2.5, { stun: 99, hp: 2, max: 2 }]);
  s.player.fireCd = 0;
  const ev = run(s, 2);
  assert.ok(ev.some((e) => e.type === 'fast' && e.streak === 1));
  // inundación
  const s2 = newRun(11, { hp: 999 });
  const r2 = arena(s2, ['turret', 1.5, 1.5, { stun: 999, hp: 999, max: 999 }]);
  s2.player.fireCd = 999;
  const n0 = r2.enemies.length;
  const ev2 = run(s2, FLOOD_AT + 1);
  assert.ok(ev2.some((e) => e.type === 'flood'));
  assert.ok(r2.enemies.length > n0);
});

test('críticos: a veces el doble, y el impacto lo dice', () => {
  const s = newRun(12, { hp: 99 });
  arena(s, ['drone', MID_C + 0.5, MID_R - 2.5, { stun: 999, hp: 9999, max: 9999 }]);
  s.player.crit = 0.5;
  const hits = [];
  for (let i = 0; i < 300; i++) { s.player.fireCd = Math.min(s.player.fireCd, 0); hits.push(...updateRun(s, DT).filter((e) => e.type === 'hit')); }
  const crits = hits.filter((h) => h.crit), plain = hits.filter((h) => !h.crit);
  assert.ok(crits.length > 5 && plain.length > 5);
  assert.equal(crits[0].dmg, plain[0].dmg * 2);
});
