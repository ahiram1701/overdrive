import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  genFloor, genRoom, newRun, updateRun, roomOf, botInput, locked, keptPiezas, chargeLine, hitsWall, canSee, nearestTarget, useAbility, dash, wallFaces, camBack, doorTouch, takeOffer, botOffer, useCons, blocksSight, tileAt, fwd,
  COLS, ROWS, MID_C, MID_R, OPP, LAST_FLOOR, themeOf, ENEMY, DOOR_TILE,
} from '../../js/pecio.js';

const DT = 1 / 30;
// una sala vacía de paredes con el jugador en el centro y los enemigos que se le pongan
function arena(s, ...enemies) {
  const room = roomOf(s);
  room.tiles = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (__, c) => (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 ? '#' : '.')));
  room.type = 'combat';
  room.wake = 0;
  room.cleared = false;
  room.enemies = enemies.map(([kind, x, y, extra = {}], i) => ({ id: `t${i}`, kind, x, y, ang: Math.PI, hp: ENEMY[kind].hp, max: ENEMY[kind].hp, r: ENEMY[kind].r, cd: 0, charge: 0, aim: null, fuse: null, stun: 0, hitT: 0, alive: true, ...extra }));
  Object.assign(s.player, { x: MID_C + 0.5, y: MID_R + 0.5, ang: 0, fireCd: 99, inv: 0 });
  return room;
}
const run = (s, sec, input = { x: 0, y: 0 }) => { const ev = []; for (let t = 0; t < sec; t += DT) ev.push(...updateRun(s, DT, input)); return ev; };

test('plantas: deterministas, todas las salas alcanzables, una entrada y una salida lejos', () => {
  for (let seed = 1; seed <= 30; seed++) {
    for (const depth of [1, 5, 9]) {
      const f = genFloor(seed, depth), g = genFloor(seed, depth);
      assert.deepEqual(Object.keys(f.rooms), Object.keys(g.rooms), 'misma semilla, misma planta');
      const ids = Object.keys(f.rooms);
      const normal = ids.filter((id) => !f.rooms[id].hidden);
      assert.ok(normal.length >= 6 && normal.length <= 9);
      assert.ok(ids.length - normal.length <= 1, 'como mucho una sala oculta');
      assert.equal(ids.filter((id) => f.rooms[id].type === 'exit').length, 1);
      assert.equal(f.rooms[f.start].type, 'start');
      const seen = new Set([f.start]), q = [f.start];
      while (q.length) for (const n of Object.values(f.rooms[q.shift()].doors)) if (!seen.has(n)) { seen.add(n); q.push(n); }
      assert.equal(seen.size, ids.length);
      for (const r of Object.values(f.rooms)) for (const [k, n] of Object.entries(r.doors)) assert.equal(f.rooms[n].doors[OPP[k]], r.id);
      assert.ok(ids.filter((id) => f.rooms[id].type === 'combat').length >= 2, 'al menos 2 salas de combate');
    }
  }
  assert.equal(themeOf(1).id, 'carga');
  assert.equal(themeOf(5).id, 'medica');
  assert.equal(themeOf(9).id, 'reactor');
});

test('salas: la cruz central siempre libre y los enemigos sobre suelo, lejos de las puertas', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const f = genFloor(seed, 4);
    for (const id of Object.keys(f.rooms)) {
      const r = genRoom(f, id);
      assert.equal(r.tiles.length, ROWS);
      assert.equal(r.tiles[0].length, COLS);
      for (let c = 1; c < COLS - 1; c++) assert.ok(!['#', 'P', 'M', 'E'].includes(r.tiles[MID_R][c]), `fila central libre en ${id}`);
      for (let rr = 1; rr < ROWS - 1; rr++) assert.ok(!['#', 'P', 'M', 'E'].includes(r.tiles[rr][MID_C]), `columna central libre en ${id}`);
      for (const e of r.enemies) {
        assert.equal(r.tiles[Math.floor(e.y)][Math.floor(e.x)], '.');
        for (const [dc, dr] of Object.values(DOOR_TILE)) assert.ok(Math.abs(dc - Math.floor(e.x)) + Math.abs(dr - Math.floor(e.y)) >= 3);
      }
      if (r.type === 'traps') assert.equal(r.enemies.length, 0, 'las trampas no se cierran');
    }
  }
});

test('movimiento: arriba avanza, a los lados gira, y nunca atraviesas paredes ni bloques', () => {
  const s = newRun(3, { hp: 99 });
  const room = arena(s);
  room.tiles[2][MID_C] = '#';
  const y0 = s.player.y;
  run(s, 0.5, { x: 0, y: -1 });
  assert.ok(s.player.y < y0 - 0.8, 'avanza hacia la fila 0');
  // sigue empujando contra el bloque: se queda delante, sin meterse
  run(s, 3, { x: 0, y: -1 });
  assert.ok(!hitsWall(room, s.player.x, s.player.y, s.player.r));
  assert.ok(s.player.y >= 3 + s.player.r - 1e-6, 'para en el bloque');
  // girar
  const a0 = s.player.ang;
  run(s, 0.3, { x: 1, y: 0 });
  assert.ok(s.player.ang > a0 + 0.5);
  // contra la pared de la sala en todas direcciones, mucho rato
  for (let k = 0; k < 12; k++) { run(s, 0.4, { x: 0.3, y: -1 }); assert.ok(!hitsWall(room, s.player.x, s.player.y, s.player.r)); }
});

test('disparo automático: solo al que se ve, y daña', () => {
  const s = newRun(4, { hp: 99 });
  const room = arena(s, ['drone', MID_C + 0.5, 2.5, { cd: 99 }]);
  room.enemies[0].stun = 99; // quieto para el test
  s.player.fireCd = 0;
  assert.equal(nearestTarget(s), room.enemies[0]);
  run(s, 1);
  assert.ok(room.enemies[0].hp < ENEMY.drone.hp, 'le dio');
  // con una pared en medio no se ve: no se dispara
  room.tiles[4][MID_C] = '#';
  room.enemies[0].hp = ENEMY.drone.hp;
  assert.equal(canSee(room, s.player, room.enemies[0]), false);
  assert.equal(nearestTarget(s), null);
  run(s, 1);
  assert.equal(room.enemies[0].hp, ENEMY.drone.hp);
});

test('enemigos: torreta avisa y falla si te apartas, bomba estalla alrededor, escudo para lo de frente, dron embiste', () => {
  // TORRETA: marca la línea antes de disparar; si te apartas, no te da
  let s = newRun(5, { hp: 20 });
  let room = arena(s, ['turret', MID_C + 0.5, 1.5]);
  run(s, 0.1);
  const tur = room.enemies[0];
  assert.ok(tur.charge > 0 && chargeLine(room, tur), 'apuntando');
  let hp = s.player.hp;
  run(s, 0.4, { x: 0, y: 0 });
  s.player.x += 1.5; // fuera de la línea
  run(s, 0.6);
  assert.equal(s.player.hp, hp, 'te apartaste: falla');
  // si te quedas en la línea, te da
  s = newRun(5, { hp: 20 });
  arena(s, ['turret', MID_C + 0.5, 1.5]);
  hp = s.player.hp;
  run(s, 1.2);
  assert.equal(s.player.hp, hp - ENEMY.turret.dmg);
  // BOMBA: corre hacia ti, se arma y estalla; te alcanza si sigues cerca
  s = newRun(6, { hp: 20 });
  room = arena(s, ['bomb', MID_C + 0.5, MID_R - 2.5]);
  hp = s.player.hp;
  const ev = run(s, 2.5);
  assert.ok(ev.some((e) => e.type === 'armed'));
  assert.ok(ev.some((e) => e.type === 'boom'));
  assert.equal(room.enemies[0].alive, false);
  assert.ok(ev.some((e) => e.type === 'hurt' && e.src === 'bomba' && e.dmg === ENEMY.bomb.dmg), 'te alcanzó');
  assert.equal(s.player.hp, hp - ENEMY.bomb.dmg + 1, 'y al quedar la sala limpia, +1 ❤️');
  // ESCUDO: de frente rebota; por la espalda le entra
  s = newRun(7, { hp: 99 });
  room = arena(s, ['shield', MID_C + 0.5, 2.5, { ang: Math.PI, stun: 99 }]); // mira hacia ti (abajo)
  s.player.fireCd = 0;
  let evs = run(s, 1);
  assert.ok(evs.some((e) => e.type === 'blocked'));
  assert.equal(room.enemies[0].hp, ENEMY.shield.hp);
  room.enemies[0].ang = 0; // de espaldas
  run(s, 1);
  assert.ok(room.enemies[0].hp < ENEMY.shield.hp);
  // DRON: te persigue y te embiste
  s = newRun(8, { hp: 20 });
  arena(s, ['drone', MID_C + 0.5, 2.5]);
  hp = s.player.hp;
  run(s, 2.5);
  assert.ok(s.player.hp < hp);
});

test('puertas cerradas hasta limpiar; esquive intocable; habilidades', () => {
  const s = newRun(9, { hp: 20, ability: 'nova' });
  const room = arena(s, ['drone', MID_C + 0.5, MID_R - 1.5, { stun: 99 }], ['drone', MID_C - 0.5, MID_R + 1.5, { stun: 99 }]);
  room.tiles[0][MID_C] = 'D';
  assert.ok(locked(room));
  assert.ok(hitsWall(room, MID_C + 0.5, 0.9, 0.3), 'la puerta cerrada frena');
  // la onda le da a los dos
  useAbility(s);
  assert.ok(room.enemies.every((e) => e.hp < ENEMY.drone.hp));
  assert.ok(s.player.abCd > 0);
  for (const e of room.enemies) e.alive = false;
  const ev = run(s, 0.1);
  assert.ok(ev.some((e) => e.type === 'cleared'));
  assert.equal(locked(room), false);
  // esquive: durante el acelerón nada te hace daño
  const hp = s.player.hp;
  dash(s);
  assert.ok(s.player.dashT > 0);
  assert.deepEqual(dash(s).map((e) => e.type), ['cooldown']);
  assert.equal(s.player.hp, hp);
});

test('el bot vuela solo, baja plantas y nunca se atasca', () => {
  let floors = 0;
  for (let seed = 1; seed <= 24; seed++) {
    const s = newRun(seed, { hp: 6, ability: 'nova' });
    let prog = '', last = 0, i = 0;
    for (; i < 30 * 60 * 20 && !s.over; i++) {
      if (s.offer) takeOffer(s, botOffer(s));
      const inp = botInput(s);
      if (inp.ability) useAbility(s);
      if (inp.dash) dash(s);
      if (inp.cons) useCons(s, inp.cons);
      updateRun(s, DT, inp);
      const pr = `${s.depth}|${s.at}|${s.kills}`;
      if (pr !== prog) { prog = pr; last = i; }
      assert.ok(i - last < 30 * 45, `semilla ${seed}: sin progreso en la sala ${s.at} (planta ${s.depth})`);
    }
    assert.ok(s.over, `semilla ${seed}: la partida termina`);
    floors += s.depth;
  }
  assert.ok(floors / 24 >= 2.5, `de media llega a la planta ${(floors / 24).toFixed(1)}`);
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
});

test('dibujo 3D: cada cara de pared va EN el borde entre su pared y la casilla libre a la que mira', () => {
  for (let seed = 1; seed <= 15; seed++) {
    const f = genFloor(seed, 5);
    for (const id of Object.keys(f.rooms)) {
      const room = genRoom(f, id);
      for (const shut of [true, false]) {
        const faces = wallFaces(room, shut);
        for (const fc of faces) {
          // punto medio de la cara (mundo: x = columna, z = −fila) y medio paso a cada lado de la normal
          const mx = (fc.a[0] + fc.b[0]) / 2, mz = (fc.a[1] + fc.b[1]) / 2;
          const out = [Math.floor(mx + fc.n[0] * 0.5), Math.floor(-(mz + fc.n[1] * 0.5))];
          const inn = [Math.floor(mx - fc.n[0] * 0.5), Math.floor(-(mz - fc.n[1] * 0.5))];
          assert.deepEqual(inn, [fc.c, fc.r], `la cara pertenece a su pared (${id})`);
          const t = room.tiles[out[1]][out[0]];
          assert.ok(t !== '#' && !(t === 'D' && shut), `y mira a una casilla libre (${id} ${out})`);
          // cara de una casilla de ancho
          assert.equal(Math.hypot(fc.a[0] - fc.b[0], fc.a[1] - fc.b[1]), 1);
        }
        // todas las casillas libres junto a una pared tienen su cara: la sala queda cerrada
        const need = [];
        for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) {
          if (room.tiles[r][c] === '#') continue;
          for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (room.tiles[r + dr][c + dc] === '#') need.push(`${c + dc},${r + dr}>${c},${r}`);
        }
        const have = new Set(faces.map((fc) => `${fc.c},${fc.r}>${Math.floor((fc.a[0] + fc.b[0]) / 2 + fc.n[0] * 0.5)},${Math.floor(-((fc.a[1] + fc.b[1]) / 2 + fc.n[1] * 0.5))}`));
        for (const k of need) assert.ok(have.has(k), `falta la cara ${k} en ${id}`);
      }
    }
  }
});

test('cámara: nunca dentro de una pared ni pegada a ella (el plano cercano no abre huecos)', () => {
  let n = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const f = genFloor(seed, 4);
    for (const id of Object.keys(f.rooms)) {
      const room = genRoom(f, id);
      for (let k = 0; k < 120; k++) {
        const p = { x: 1 + ((k * 0.618 + seed * 0.37) % 1) * 7, y: 1 + ((k * 0.414 + seed * 0.71) % 1) * 9 };
        if (hitsWall(room, p.x, p.y, 0.3) || room.tiles[Math.floor(p.y)][Math.floor(p.x)] !== '.') continue;
        const ang = k * 0.77;
        const back = camBack(room, p, ang, 2.3);
        const b = fwd(ang), cx = p.x - b.x * back, cy = p.y - b.y * back;
        n++;
        assert.ok(!blocksSight(tileAt(room, Math.floor(cx), Math.floor(cy))), 'no dentro de una pared');
        // a más de 0,15 de cualquier pared o bloque (una puerta abierta no tiene pared que recortar)
        for (let c = Math.floor(cx - 0.15); c <= Math.floor(cx + 0.15); c++) for (let r = Math.floor(cy - 0.15); r <= Math.floor(cy + 0.15); r++) {
          if (!blocksSight(tileAt(room, c, r)) || tileAt(room, c, r) === 'D') continue;
          const nx = Math.max(c, Math.min(cx, c + 1)), ny = Math.max(r, Math.min(cy, r + 1));
          assert.ok(Math.hypot(cx - nx, cy - ny) >= 0.15, `pegada a una pared en ${id}`);
        }
      }
    }
  }
  assert.ok(n > 2000);
});

test('puertas: una abierta nunca dice "limpia la sala"; se cruza aunque llegues descentrado o en diagonal', () => {
  for (const [off, ang] of [[0, 0], [0.35, 0], [-0.35, 0], [0.42, 0], [0.3, -0.45], [-0.3, 0.45], [0.2, 0.15], [-0.6, 0.3]]) {
    const s = newRun(12, { hp: 20 });
    const room = arena(s);
    room.tiles[0][MID_C] = 'D';
    room.cleared = true;
    const from = s.at, up = s.floor.rooms[from].doors.up;
    if (!up) s.floor.rooms[from].doors.up = Object.keys(s.floor.rooms).find((k) => k !== from); // que la puerta lleve a algún sitio
    Object.assign(s.player, { x: MID_C + 0.5 + off, y: 3.2, ang });
    const ev = run(s, 2, { x: 0, y: -1 });
    assert.ok(!ev.some((e) => e.type === 'locked'), `sin aviso falso (desvío ${off}, ángulo ${ang})`);
    assert.notEqual(s.at, from, `cruzó la puerta (desvío ${off}, ángulo ${ang})`);
  }
  // cerrada (quedan enemigos): avisa una sola vez y no se cruza
  const s = newRun(13, { hp: 20 });
  const room = arena(s, ['drone', 1.5, 9.5, { stun: 99 }]);
  room.tiles[0][MID_C] = 'D';
  Object.assign(s.player, { x: MID_C + 0.5, y: 2.5, ang: 0 });
  const ev = run(s, 2, { x: 0, y: -1 });
  assert.equal(ev.filter((e) => e.type === 'locked').length, 1);
  assert.equal(doorTouch(room, s.player), null);
  assert.ok(s.player.y > 1, 'se queda en la sala');
});
