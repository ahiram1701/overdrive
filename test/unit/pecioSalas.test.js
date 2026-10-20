import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genFloor, genRoom, newRun, updateRun, roomOf, angTo, ENEMY, COLS, ROWS, MID_C, MID_R, DIRS } from '../../js/pecio.js';

const DT = 1 / 30;
const run = (s, sec, input = { x: 0, y: 0 }) => { const ev = []; for (let t = 0; t < sec && !s.offer && !s.over; t += DT) ev.push(...updateRun(s, DT, input)); return ev; };
function arena(s, ...foes) {
  const room = roomOf(s);
  room.tiles = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (__, c) => (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 ? '#' : '.')));
  Object.assign(room, { type: 'combat', wake: 0, cleared: false, pickups: [] });
  room.enemies = foes.map(([kind, x, y, extra = {}], i) => ({ id: `t${i}`, kind, x, y, ang: 0, hp: ENEMY[kind].hp, max: ENEMY[kind].hp, r: ENEMY[kind].r, cd: 0, charge: 0, aim: null, fuse: null, stun: 0, hitT: 0, alive: true, dir: 0, ...extra }));
  Object.assign(s.player, { x: MID_C + 0.5, y: MID_R + 0.5, ang: 0, fireCd: 99, inv: 0 });
  return room;
}

test('Francotirador: su mira te sigue mientras carga y se fija el último instante (si te mueves después, falla)', () => {
  const s = newRun(1, { hp: 20 });
  const room = arena(s, ['sniper', MID_C + 0.5, 1.5]);
  run(s, 0.05);
  const e = room.enemies[0];
  assert.ok(e.charge > 0, 'cargando');
  // te mueves al principio: la mira te sigue
  s.player.x = 2.5;
  run(s, 0.3);
  assert.ok(Math.abs(e.aim - angTo(e, s.player)) < 0.05, 'te sigue');
  // ya fijada (último 0,4 s): si te apartas, falla
  run(s, 0.7);
  assert.ok(e.charge <= 0.4 && e.charge > 0);
  const hp = s.player.hp;
  s.player.x = 6.5;
  run(s, 0.6);
  assert.equal(s.player.hp, hp, 'falla');
});

test('Invocador: avisa y llama drones (como mucho 3 a la vez) y se aleja si te acercas', () => {
  const s = newRun(2, { hp: 50 });
  const room = arena(s, ['summoner', MID_C + 0.5, 3.5]);
  const ev = run(s, 1.2);
  assert.ok(ev.some((e) => e.type === 'spawn'));
  const drones = () => room.enemies.filter((e) => e.alive && e.kind === 'drone').length;
  assert.equal(drones(), 2);
  for (const d of room.enemies) if (d.kind === 'drone') d.stun = 99;
  run(s, 6);
  assert.ok(drones() <= 3, 'tope');
  const sum = room.enemies[0];
  const d0 = Math.hypot(sum.x - s.player.x, sum.y - s.player.y);
  assert.ok(d0 > 3, 'mantiene la distancia');
});

test('Cargador: marca el anillo, golpea y la onda te alcanza; con el esquive, la saltas', () => {
  let s = newRun(3, { hp: 20 });
  arena(s, ['charger', MID_C + 0.5, MID_R - 1.4]);
  let hp = s.player.hp;
  const ev = run(s, 1.6);
  assert.ok(ev.some((e) => e.type === 'shockwave'));
  assert.ok(s.player.hp < hp, 'la onda duele');
  // con esquive en el momento justo, nada
  s = newRun(3, { hp: 20 });
  const room = arena(s, ['charger', MID_C + 0.5, MID_R - 1.4]);
  run(s, 0.05);
  const e = room.enemies[0];
  assert.ok(e.charge > 0);
  hp = s.player.hp;
  for (let t = 0; t < 1.6; t += DT) { if (e.wave && !s.player.dashT) s.player.inv = 0.5; updateRun(s, DT, { x: 0, y: 0 }); }
  assert.equal(s.player.hp, hp);
  assert.ok(room.enemies.length === 1);
});

test('Mina rodante: sigue las paredes girando al chocar y estalla al tocarte', () => {
  const s = newRun(4, { hp: 20 });
  const room = arena(s, ['roller', 1.5, 1.5, { dir: 1 }]);
  Object.assign(s.player, { x: MID_C + 0.5, y: ROWS - 2.5 });
  const dirs = new Set();
  for (let t = 0; t < 6; t += DT) { updateRun(s, DT, { x: 0, y: 0 }); dirs.add(room.enemies[0].dir); }
  assert.ok(dirs.size >= 2, 'gira en las esquinas');
  // al tocarte, estalla
  const e = room.enemies[0];
  Object.assign(e, { x: s.player.x + 0.5, y: s.player.y, alive: true });
  const hp = s.player.hp;
  const ev = run(s, 0.2);
  assert.equal(e.alive, false);
  assert.ok(ev.some((x) => x.type === 'boom'));
  assert.ok(s.player.hp < hp);
});

test('Oleadas: al limpiar una llega la siguiente, y tras la tercera, un premio', () => {
  const s = newRun(5, { hp: 99 });
  const room = arena(s, ['drone', 2.5, 2.5]);
  room.type = 'waves';
  room.waves = [2, 2];
  room.enemies[0].alive = false;
  let ev = run(s, 0.1);
  assert.ok(ev.some((e) => e.type === 'wave'));
  assert.equal(room.waves.length, 1);
  for (const e of room.enemies) e.alive = false;
  run(s, 0.1);
  assert.equal(room.waves.length, 0);
  for (const e of room.enemies) e.alive = false;
  ev = run(s, 0.1);
  assert.ok(ev.some((e) => e.type === 'reward' && e.what === 'waves'));
  assert.ok(room.pickups.some((p) => p.kind === 'item'));
  assert.ok(room.cleared);
});

test('Desafío: límpiala a tiempo y hay premio; si se acaba el reloj, nada', () => {
  let s = newRun(6, { hp: 99 });
  let room = arena(s, ['drone', 2.5, 2.5, { stun: 99 }]);
  Object.assign(room, { type: 'challenge', timer: 5 });
  run(s, 1);
  room.enemies[0].alive = false;
  let ev = run(s, 0.1);
  assert.ok(ev.some((e) => e.type === 'reward' && e.what === 'challenge'));
  assert.ok(room.pickups.some((p) => p.kind === 'item' && p.item.tier >= 1));
  s = newRun(6, { hp: 99 });
  room = arena(s, ['drone', 2.5, 2.5, { stun: 99 }]);
  Object.assign(room, { type: 'challenge', timer: 1 });
  ev = run(s, 1.5);
  assert.ok(ev.some((e) => e.type === 'challengeFail'));
  room.enemies[0].alive = false;
  ev = run(s, 0.1);
  assert.ok(!ev.some((e) => e.type === 'reward'));
  assert.equal(room.pickups.length, 0);
});

test('Laberinto: todo se alcanza desde el centro, y la llave del fondo se recoge', () => {
  let mazes = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const f = genFloor(seed, 4);
    for (const id of Object.keys(f.rooms)) {
      if (f.rooms[id].type !== 'maze') continue;
      mazes++;
      const r = genRoom(f, id);
      const seen = new Set([`${MID_C},${MID_R}`]), q = [[MID_C, MID_R]];
      while (q.length) {
        const [c, rr] = q.shift();
        for (const d of Object.values(DIRS)) {
          const nc = c + d.dx, nr = rr + d.dy, k = `${nc},${nr}`;
          if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS || seen.has(k) || r.tiles[nr][nc] === '#') continue;
          seen.add(k); q.push([nc, nr]);
        }
      }
      for (let rr = 1; rr < ROWS - 1; rr++) for (let c = 1; c < COLS - 1; c++) if (r.tiles[rr][c] !== '#') assert.ok(seen.has(`${c},${rr}`), `${seed}/${id}: casilla aislada ${c},${rr}`);
      const key = r.pickups.find((p) => p.kind === 'key');
      assert.ok(key && seen.has(`${Math.floor(key.x)},${Math.floor(key.y)}`), 'llave alcanzable');
      for (const e of r.enemies) assert.ok(seen.has(`${Math.floor(e.x)},${Math.floor(e.y)}`), 'enemigos alcanzables');
    }
  }
  assert.ok(mazes > 5, `hay laberintos (${mazes})`);
  // recoger la llave
  const s = newRun(7, { hp: 9 });
  const room = arena(s);
  room.pickups.push({ id: 'k', kind: 'key', x: s.player.x, y: s.player.y - 0.3 });
  const k0 = s.player.keys;
  const ev = run(s, 0.1);
  assert.equal(s.player.keys, k0 + 1);
  assert.ok(ev.some((e) => e.type === 'key'));
});
