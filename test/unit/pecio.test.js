import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  genFloor, genRoom, newRun, act, roomOf, botAction, locked, keptPiezas, chargeLine, COLS, ROWS, MID_C, MID_R, DIRS, OPP, LAST_FLOOR, themeOf, ENEMY,
} from '../../js/pecio.js';

test('plantas: deterministas, todas las salas alcanzables, una entrada y una salida lejos', () => {
  for (let seed = 1; seed <= 30; seed++) {
    for (const depth of [1, 5, 9]) {
      const f = genFloor(seed, depth), g = genFloor(seed, depth);
      assert.deepEqual(Object.keys(f.rooms), Object.keys(g.rooms), 'misma semilla, misma planta');
      const ids = Object.keys(f.rooms);
      assert.ok(ids.length >= 6 && ids.length <= 9);
      assert.equal(ids.filter((id) => f.rooms[id].type === 'exit').length, 1);
      assert.equal(f.rooms[f.start].type, 'start');
      // alcanzables desde la entrada
      const seen = new Set([f.start]), q = [f.start];
      while (q.length) for (const n of Object.values(f.rooms[q.shift()].doors)) if (!seen.has(n)) { seen.add(n); q.push(n); }
      assert.equal(seen.size, ids.length);
      // las puertas van en los dos sentidos
      for (const r of Object.values(f.rooms)) for (const [k, n] of Object.entries(r.doors)) assert.equal(f.rooms[n].doors[OPP[k]], r.id);
      assert.ok(ids.filter((id) => f.rooms[id].type === 'combat').length >= 2, 'al menos 2 salas de combate');
    }
  }
  assert.equal(themeOf(1).id, 'carga');
  assert.equal(themeOf(5).id, 'medica');
  assert.equal(themeOf(9).id, 'reactor');
});

test('salas: la cruz central siempre libre (todas las puertas se comunican) y los enemigos lejos de las puertas', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const f = genFloor(seed, 4);
    for (const id of Object.keys(f.rooms)) {
      const r = genRoom(f, id);
      assert.equal(r.tiles.length, ROWS);
      assert.equal(r.tiles[0].length, COLS);
      for (let c = 1; c < COLS - 1; c++) assert.ok(!['#', 'P', 'M', 'E'].includes(r.tiles[MID_R][c]), `fila central libre en ${id}`);
      for (let rr = 1; rr < ROWS - 1; rr++) assert.ok(!['#', 'P', 'M', 'E'].includes(r.tiles[rr][MID_C]) || r.tiles[rr][MID_C] === 'X', `columna central libre en ${id}`);
      for (const e of r.enemies) assert.ok(r.tiles[e.y][e.x] === '.');
      if (r.type === 'exit') assert.equal(r.tiles[MID_R][MID_C], 'X');
      if (r.type === 'traps') assert.equal(r.enemies.length, 0, 'las trampas no se cierran');
    }
  }
});

test('turnos: chocar con una pared no gasta turno; moverse sí; las puertas se cierran hasta limpiar', () => {
  const s = newRun(3, { hp: 6 });
  const t0 = s.turn;
  s.player.x = 1; s.player.y = 1;
  assert.deepEqual(act(s, { type: 'move', dir: 'left' }).map((e) => e.type), ['bump']);
  assert.equal(s.turn, t0);
  act(s, { type: 'move', dir: 'down' });
  assert.equal(s.turn, t0 + 1);
  // una sala de combate con enemigos: cerrada
  const room = roomOf(s, Object.keys(s.floor.rooms).find((id) => s.floor.rooms[id].type === 'combat'));
  assert.ok(room.enemies.length > 0 && locked(room));
  for (const e of room.enemies) e.alive = false;
  assert.equal(locked(room), false);
});

test('enemigos: el dron golpea al lado, la torreta avisa antes de disparar, la bomba cuenta 2 y estalla, el escudo para los disparos de frente', () => {
  const s = newRun(5, { hp: 20 });
  const room = roomOf(s);
  room.tiles = room.tiles.map((row) => row.map((t) => (t === 'D' ? '#' : t)));
  const add = (kind, x, y, extra = {}) => { const e = { id: kind, kind, x, y, hp: ENEMY[kind].hp, max: ENEMY[kind].hp, facing: 'down', fuse: null, charge: null, cd: 0, stun: 0, alive: true, ...extra }; room.enemies = [e]; return e; };
  // DRON al lado: te golpea
  s.player.x = 4; s.player.y = 5;
  add('drone', 5, 5);
  let hp = s.player.hp;
  act(s, { type: 'wait' });
  assert.equal(s.player.hp, hp - 1);
  // TORRETA alineada: primero marca la línea, al turno siguiente dispara (si te apartas, falla)
  const tur = add('turret', 4, 1);
  act(s, { type: 'wait' });
  assert.equal(tur.charge, 'down');
  assert.ok(chargeLine(room, tur).some(([x, y]) => x === 4 && y === 5));
  hp = s.player.hp;
  act(s, { type: 'move', dir: 'right' });
  assert.equal(s.player.hp, hp, 'te apartaste: falla');
  // BOMBA: al lado se arma y estalla a los 2 turnos
  s.player.x = 4; s.player.y = 5;
  const bomb = add('bomb', 4, 6);
  act(s, { type: 'wait' });
  assert.equal(bomb.fuse, 2);
  hp = s.player.hp;
  act(s, { type: 'wait' });
  act(s, { type: 'wait' });
  assert.equal(bomb.alive, false);
  assert.equal(s.player.hp, hp - ENEMY.bomb.dmg);
  // ESCUDO: tu disparo de frente rebota; cuerpo a cuerpo le entra
  s.player.x = 4; s.player.y = 5; s.player.shotCd = 0;
  const sh = add('shield', 4, 3, { facing: 'down' });
  const ev = act(s, { type: 'shoot', dir: 'up' });
  assert.ok(ev.some((e) => e.type === 'blocked'));
  assert.equal(sh.hp, ENEMY.shield.hp);
  s.player.x = 4; s.player.y = 4;
  act(s, { type: 'move', dir: 'up' });
  assert.ok(sh.hp < ENEMY.shield.hp);
});

test('el bot (sin trampas) termina las primeras plantas con la nave básica y nunca se atasca', () => {
  let floors = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const s = newRun(seed, { hp: 6, ability: 'nova' });
    let i = 0;
    for (; i < 8000 && !s.over; i++) act(s, botAction(s));
    assert.ok(s.over, `semilla ${seed}: la partida termina (no se atasca)`);
    floors += s.depth;
  }
  assert.ok(floors / 40 >= 3, `de media llega a la planta ${(floors / 40).toFixed(1)}`);
});

test('🔩: si caes te llevas más cuanto más hondo; si sales, todas', () => {
  const s = newRun(1);
  s.player.piezas = 100;
  s.depth = 1;
  assert.equal(keptPiezas(s), 50);
  s.depth = 6;
  assert.equal(keptPiezas(s), 100);
  s.depth = LAST_FLOOR + 1; s.won = true;
  assert.equal(keptPiezas(s), 100);
  assert.ok(DIRS.up && MID_C === 4);
});
