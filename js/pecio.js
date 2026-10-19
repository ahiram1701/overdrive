// PECIOS: el 4.º juego de OVERDRIVE. Roguelite por turnos en cuadrícula, sala a sala: tu nave entra en
// pecios y estaciones abandonadas. Cada paso tuyo es un turno de los enemigos. Módulo puro (se testea
// en Node): generación de plantas y salas, turnos, enemigos con su intención visible, y un bot.
import { makeRng, hashString } from './rng.js';

export const COLS = 9, ROWS = 11;
export const MID_C = 4, MID_R = 5;
export const DIRS = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };
export const DIR_KEYS = Object.keys(DIRS);
export const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
export const LAST_FLOOR = 9;

// Tres ambientes, de 3 plantas cada uno
export const THEMES = [
  { id: 'carga', name: 'PECIO DE CARGA', floor: '#140f1f', wall: '#5ac8fa', accent: '#ffcc00', mix: { drone: 5, turret: 2, bomb: 2, shield: 1 } },
  { id: 'medica', name: 'ESTACIÓN MÉDICA', floor: '#0b1714', wall: '#30d158', accent: '#7dffb0', mix: { drone: 3, turret: 3, bomb: 2, shield: 2 } },
  { id: 'reactor', name: 'REACTOR', floor: '#1a0907', wall: '#ff6a00', accent: '#ff2d55', mix: { drone: 3, turret: 2, bomb: 3, shield: 3 } },
];
export const themeOf = (depth) => THEMES[Math.floor((depth - 1) / 3) % THEMES.length];

// Enemigos: siempre se ve lo que van a hacer (flecha, línea marcada o cuenta atrás)
export const ENEMY = {
  drone: { name: 'Dron', hp: 2, dmg: 1, color: '#ff2bd6', shape: 'tri', piezas: 1, desc: 'te persigue y te golpea al lado' },
  turret: { name: 'Torreta', hp: 3, dmg: 2, color: '#00e5ff', shape: 'eye', piezas: 2, desc: 'fija: marca su línea y dispara al turno siguiente' },
  bomb: { name: 'Bomba', hp: 1, dmg: 3, color: '#ff9f0a', shape: 'hex', piezas: 1, desc: 'se acerca, se arma y estalla a los 2 turnos' },
  shield: { name: 'Escudo', hp: 3, dmg: 1, color: '#30d158', shape: 'square', piezas: 2, desc: 'para los disparos de frente: acércate y golpéalo (es lento)' },
};
export const ENEMY_KEYS = Object.keys(ENEMY);

export const ROOM_TYPES = {
  start: { icon: '🏁', name: 'Entrada' },
  combat: { icon: '⚔️', name: 'Combate' },
  treasure: { icon: '🎁', name: 'Tesoro' },
  traps: { icon: '⚠️', name: 'Trampas' },
  shop: { icon: '🛒', name: 'Tienda' },
  shrine: { icon: '✨', name: 'Altar' },
  exit: { icon: '🚪', name: 'Salida' },
};
// salas que se cierran hasta limpiarlas
const LOCKS = new Set(['combat', 'exit']);

// Losas: . suelo · # pared · P pozo (no se pisa; los disparos pasan) · M mina · E suelo eléctrico (1 de daño
// si acabas el turno encima) · D puerta · C cofre (con llave) · T terminal de la tienda · A altar · X escotilla (bajar)
const SOLID = new Set(['#', 'P', 'C', 'T', 'A']);
export const passable = (t) => !SOLID.has(t);

// ---------- Generación ----------
export function genFloor(seed, depth) {
  const rng = makeRng(hashString(`pecio-${seed}-${depth}`));
  const n = Math.min(9, 6 + Math.floor((depth - 1) / 2) + rng.int(0, 1));
  const cells = new Map([['2,2', { x: 2, y: 2 }]]);
  let guard = 0;
  while (cells.size < n && guard++ < 500) {
    const from = rng.pick([...cells.values()]);
    const d = DIRS[rng.pick(DIR_KEYS)];
    const x = from.x + d.dx, y = from.y + d.dy;
    if (x < 0 || y < 0 || x > 4 || y > 4 || cells.has(`${x},${y}`)) continue;
    const near = DIR_KEYS.filter((k) => cells.has(`${x + DIRS[k].dx},${y + DIRS[k].dy}`)).length;
    if (near > 2) continue; // sin bloques compactos: pasillos de salas
    cells.set(`${x},${y}`, { x, y });
  }
  const rooms = {};
  for (const [id, c] of cells) {
    const doors = {};
    for (const k of DIR_KEYS) {
      const nid = `${c.x + DIRS[k].dx},${c.y + DIRS[k].dy}`;
      if (cells.has(nid)) doors[k] = nid;
    }
    rooms[id] = { id, x: c.x, y: c.y, doors, type: 'combat' };
  }
  // distancias desde la entrada: la salida, la sala más lejana
  const dist = { '2,2': 0 }, q = ['2,2'];
  while (q.length) {
    const id = q.shift();
    for (const nid of Object.values(rooms[id].doors)) if (dist[nid] === undefined) { dist[nid] = dist[id] + 1; q.push(nid); }
  }
  const ids = Object.keys(rooms).sort();
  const exit = ids.reduce((a, b) => (dist[b] > dist[a] ? b : a), '2,2');
  rooms['2,2'].type = 'start';
  rooms[exit].type = 'exit';
  const rest = rng.shuffle(ids.filter((id) => id !== '2,2' && id !== exit));
  const specials = ['treasure', 'traps'];
  if (depth >= 2) specials.push('shop');
  if (rng.chance(0.5)) specials.push('shrine');
  // siempre quedan al menos 2 salas de combate
  for (const t of specials) if (rest.length > 2) rooms[rest.shift()].type = t;
  return { seed, depth, theme: themeOf(depth), rooms, start: '2,2', exit };
}

// Una sala: losas y enemigos. La cruz central (fila MID_R y columna MID_C) siempre queda libre: así
// todas las puertas se comunican siempre, haya lo que haya en la sala.
export function genRoom(floor, id) {
  const room = floor.rooms[id], depth = floor.depth;
  const rng = makeRng(hashString(`room-${floor.seed}-${depth}-${id}`));
  const t = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (__, c) => (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 ? '#' : '.')));
  const doorAt = { up: [MID_C, 0], down: [MID_C, ROWS - 1], left: [0, MID_R], right: [COLS - 1, MID_R] };
  for (const k of Object.keys(room.doors)) { const [c, r] = doorAt[k]; t[r][c] = 'D'; }
  const onCross = (c, r) => c === MID_C || r === MID_R;
  const free = () => {
    for (let i = 0; i < 80; i++) {
      const c = rng.int(1, COLS - 2), r = rng.int(1, ROWS - 2);
      if (t[r][c] === '.' && !onCross(c, r)) return [c, r];
    }
    return null;
  };
  const type = room.type;
  if (type === 'combat' || type === 'exit') {
    for (let i = 0, n = rng.int(2, 5); i < n; i++) { const p = free(); if (p) t[p[1]][p[0]] = rng.chance(0.6) ? '#' : 'P'; }
  }
  if (type === 'traps') {
    for (let i = 0, n = 5 + Math.min(4, depth); i < n; i++) { const p = free(); if (p) t[p[1]][p[0]] = 'M'; }
    for (let i = 0, n = 4 + depth; i < n; i++) { const p = free(); if (p) t[p[1]][p[0]] = 'E'; }
  }
  if (type === 'treasure') t[2][2] = 'C';
  if (type === 'shop') t[2][2] = 'T';
  if (type === 'shrine') t[2][COLS - 3] = 'A';
  if (type === 'exit') t[MID_R][MID_C] = 'X';
  // enemigos
  const enemies = [];
  const nE = type === 'combat' ? Math.min(6, 2 + Math.floor(depth / 2) + rng.int(0, 1)) : type === 'exit' ? Math.min(5, 2 + Math.floor(depth / 3)) : 0;
  const mix = Object.entries(floor.theme.mix).map(([k, w]) => ({ k, w }));
  for (let i = 0; i < nE; i++) {
    let p = null;
    for (let j = 0; j < 60 && !p; j++) {
      const c = rng.int(1, COLS - 2), r = rng.int(2, ROWS - 3);
      const nearDoor = Object.values(doorAt).some(([dc, dr]) => Math.abs(dc - c) + Math.abs(dr - r) < 3);
      if (t[r][c] === '.' && !nearDoor && !enemies.some((e) => e.x === c && e.y === r) && !(c === MID_C && r === MID_R)) p = [c, r];
    }
    if (!p) continue;
    const kind = rng.weighted(mix).k, E = ENEMY[kind];
    const hp = E.hp + Math.floor((depth - 1) / 3);
    enemies.push({ id: `${id}-${i}`, kind, x: p[0], y: p[1], hp, max: hp, facing: 'down', fuse: null, charge: null, cd: rng.int(0, 1), stun: 0, alive: true });
  }
  return { id, type, tiles: t, enemies, cleared: !enemies.length, opened: false, used: false };
}

// ---------- Partida ----------
// ship = { hp, ability } (de la nave del hangar)
export function newRun(seed, ship = {}) {
  const floor = genFloor(seed, 1);
  const s = {
    seed, depth: 1, floor, rooms: {}, at: floor.start, turn: 0, over: false, won: false,
    rng: makeRng(hashString(`turns-${seed}`)),
    player: {
      x: MID_C, y: MID_R, hp: ship.hp || 6, max: ship.hp || 6, dmg: 2, shotDmg: 2, shotCd: 0, shotMax: 3,
      ability: ship.ability || 'nova', abCd: 0, abMax: 8, keys: 0, piezas: 0, facing: 'up', shield: 0, inv: 0, extra: 0, ram: false,
    },
    visited: [floor.start], kills: 0, roomsCleared: 0,
  };
  s.rooms[floor.start] = genRoom(floor, floor.start);
  return s;
}
export const roomOf = (s, id = s.at) => (s.rooms[id] ||= genRoom(s.floor, id));
export const tileAt = (room, x, y) => (x < 0 || y < 0 || x >= COLS || y >= ROWS ? '#' : room.tiles[y][x]);
export const enemyAt = (room, x, y) => room.enemies.find((e) => e.alive && e.x === x && e.y === y);
export const locked = (room) => LOCKS.has(room.type) && room.enemies.some((e) => e.alive);
// 🔩 que te llevas si caes: más cuanto más hondo llegaste (si sales, todas)
export const keptPiezas = (s) => (s.won ? s.player.piezas : Math.floor(s.player.piezas * Math.min(1, 0.5 + 0.1 * (s.depth - 1))));

// Las habilidades ⚡ de cada nave, por turnos
export const ABILITY = {
  nova: { name: 'Onda', desc: '2 de daño a todo lo que tengas alrededor' },
  chaos: { name: 'Caos', desc: '2 de daño a todo lo que tengas alrededor' },
  singularity: { name: 'Singularidad', desc: '2 de daño a todo lo que tengas alrededor' },
  laser: { name: 'Rayo', desc: 'disparo de 3 que atraviesa a todos' },
  hammer: { name: 'Martillo', desc: 'disparo de 3 que atraviesa a todos' },
  hook: { name: 'Gancho', desc: 'saltas 3 casillas hacia donde miras' },
  blink: { name: 'Parpadeo', desc: 'saltas 3 casillas hacia donde miras' },
  bubble: { name: 'Burbuja', desc: 'absorbes los 2 próximos golpes' },
  barrier: { name: 'Barrera', desc: 'recuperas 2 de vida y absorbes un golpe' },
  overclock: { name: 'Sobrecarga', desc: 'dos acciones seguidas: los enemigos no se mueven' },
  ram: { name: 'Ariete', desc: 'tu próximo golpe hace 3 y empuja' },
  roar: { name: 'Rugido', desc: 'aturdes a todos 2 turnos' },
  phase: { name: 'Fase', desc: 'intocable 2 turnos' },
};

// ---------- Turnos ----------
// action = { type: 'move'|'shoot'|'wait'|'ability'|'buy'|'shrine', dir?, item?, pick? }. Devuelve eventos
// para el dibujo y el sonido. Si la acción no gasta turno (chocar con una pared, puerta cerrada…), no se
// mueve nadie más.
export function act(s, action) {
  if (s.over) return [];
  const ev = [], p = s.player, room = roomOf(s);
  let spent = false;
  if (action.type === 'move') {
    const d = DIRS[action.dir];
    p.facing = action.dir;
    const nx = p.x + d.dx, ny = p.y + d.dy, t = tileAt(room, nx, ny), foe = enemyAt(room, nx, ny);
    if (foe) {
      hitEnemy(s, foe, p.ram ? 3 : p.dmg, action.dir, ev);
      if (p.ram && foe.alive) push(room, foe, action.dir);
      p.ram = false;
      spent = true;
    } else if (t === 'D') {
      if (locked(room)) ev.push({ type: 'locked' });
      else return enterRoom(s, action.dir, ev);
    } else if (t === 'C') {
      if (room.opened) ev.push({ type: 'empty' });
      else if (p.keys < 1) ev.push({ type: 'needKey' });
      else {
        p.keys--;
        room.opened = true;
        const gain = 5 + s.depth * 2;
        p.piezas += gain;
        p.hp = Math.min(p.max, p.hp + 1);
        ev.push({ type: 'chest', piezas: gain });
        spent = true;
      }
    } else if (t === 'T') ev.push({ type: 'shop' });
    else if (t === 'A') ev.push({ type: room.used ? 'empty' : 'shrine' });
    else if (passable(t)) {
      p.x = nx;
      p.y = ny;
      ev.push({ type: 'step' });
      if (t === 'M') {
        room.tiles[ny][nx] = '.';
        hurt(s, 2, ev, 'mina');
        ev.push({ type: 'boom', x: nx, y: ny, r: 0 });
      }
      if (t === 'X') return descend(s, ev);
      spent = true;
    } else ev.push({ type: 'bump' });
  } else if (action.type === 'shoot') {
    if (p.shotCd > 0) return [{ type: 'cooldown' }];
    p.facing = action.dir;
    shoot(s, room, action.dir, p.shotDmg, false, ev);
    p.shotCd = p.shotMax;
    spent = true;
  } else if (action.type === 'wait') {
    ev.push({ type: 'wait' });
    spent = true;
  } else if (action.type === 'ability') {
    if (p.abCd > 0) return [{ type: 'cooldown' }];
    useAbility(s, room, ev);
    p.abCd = p.abMax;
    spent = true;
  } else if (action.type === 'buy') {
    return buy(s, action.item);
  } else if (action.type === 'shrine') {
    return pray(s, room, action.pick);
  }
  if (!spent) return ev;
  s.turn++;
  if (p.extra > 0) p.extra--;
  else enemyPhase(s, room, ev);
  // fin del turno: suelo eléctrico, recargas y ¿sala limpia?
  if (!s.over && tileAt(room, p.x, p.y) === 'E') hurt(s, 1, ev, 'electricidad');
  p.shotCd = Math.max(0, p.shotCd - 1);
  p.abCd = Math.max(0, p.abCd - 1);
  p.inv = Math.max(0, p.inv - 1);
  if (!room.cleared && !room.enemies.some((e) => e.alive)) {
    room.cleared = true;
    s.roomsCleared++;
    p.hp = Math.min(p.max, p.hp + 1); // los drones de reparación de la sala te arreglan un poco
    ev.push({ type: 'cleared' });
    if (s.rng.chance(0.4)) { p.keys++; ev.push({ type: 'key' }); }
  }
  return ev;
}

function push(room, e, dir) {
  const d = DIRS[dir], nx = e.x + d.dx, ny = e.y + d.dy;
  if (passable(tileAt(room, nx, ny)) && tileAt(room, nx, ny) !== 'D' && !enemyAt(room, nx, ny)) { e.x = nx; e.y = ny; }
}

function hitEnemy(s, e, dmg, fromDir, ev, ranged = false) {
  // ESCUDO: los disparos de frente rebotan (cuerpo a cuerpo, sí le entra)
  if (ranged && e.kind === 'shield' && fromDir === OPP[e.facing]) { ev.push({ type: 'blocked', id: e.id }); return; }
  e.hp -= dmg;
  ev.push({ type: 'hit', id: e.id, dmg });
  if (e.hp > 0) return;
  e.alive = false;
  s.kills++;
  const gain = ENEMY[e.kind].piezas + Math.floor(s.depth / 3);
  s.player.piezas += gain;
  ev.push({ type: 'kill', id: e.id, piezas: gain, x: e.x, y: e.y });
}

function hurt(s, dmg, ev, src) {
  const p = s.player;
  if (p.inv > 0) { ev.push({ type: 'dodge' }); return; }
  if (p.shield > 0) { p.shield--; ev.push({ type: 'absorb' }); return; }
  p.hp -= dmg;
  ev.push({ type: 'hurt', dmg, src });
  if (p.hp <= 0) { p.hp = 0; s.over = true; ev.push({ type: 'dead' }); }
}

// disparo en línea recta: pasa por pozos y suelo; lo para una pared, una puerta o (si no atraviesa) el primero
function shoot(s, room, dir, dmg, pierce, ev) {
  const d = DIRS[dir], p = s.player;
  let x = p.x, y = p.y;
  const path = [];
  for (;;) {
    x += d.dx;
    y += d.dy;
    const t = tileAt(room, x, y);
    if (t === '#' || t === 'D' || t === 'C' || t === 'T' || t === 'A') break;
    path.push([x, y]);
    const foe = enemyAt(room, x, y);
    if (foe) { hitEnemy(s, foe, dmg, dir, ev, true); if (!pierce) break; }
  }
  ev.push({ type: 'shot', dir, path });
}

function useAbility(s, room, ev) {
  const p = s.player, id = p.ability;
  ev.push({ type: 'ability', id });
  if (['nova', 'chaos', 'singularity'].includes(id)) {
    for (const e of room.enemies) if (e.alive && Math.abs(e.x - p.x) <= 1 && Math.abs(e.y - p.y) <= 1) hitEnemy(s, e, 2, null, ev);
  } else if (id === 'laser' || id === 'hammer') shoot(s, room, p.facing, 3, true, ev);
  else if (id === 'hook' || id === 'blink') {
    const d = DIRS[p.facing];
    for (let i = 0; i < 3; i++) {
      const nx = p.x + d.dx, ny = p.y + d.dy, t = tileAt(room, nx, ny);
      if (!passable(t) || t === 'D' || enemyAt(room, nx, ny)) break;
      p.x = nx;
      p.y = ny;
    }
  } else if (id === 'bubble') p.shield = 2;
  else if (id === 'barrier') { p.hp = Math.min(p.max, p.hp + 2); p.shield = Math.max(p.shield, 1); }
  else if (id === 'overclock') p.extra = 1;
  else if (id === 'ram') p.ram = true;
  else if (id === 'roar') { for (const e of room.enemies) if (e.alive) e.stun = 2; }
  else p.inv = 3; // fase (y cualquier otra): intocable 2 turnos
}

// ---------- Enemigos ----------
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
// paso hacia ti (o el mejor que pueda dar): por el eje con más distancia primero
function stepToward(room, e, p) {
  const opts = [];
  const dx = Math.sign(p.x - e.x), dy = Math.sign(p.y - e.y);
  const big = Math.abs(p.x - e.x) >= Math.abs(p.y - e.y);
  if (big && dx) opts.push(dx > 0 ? 'right' : 'left');
  if (dy) opts.push(dy > 0 ? 'down' : 'up');
  if (!big && dx) opts.push(dx > 0 ? 'right' : 'left');
  for (const k of opts) {
    const nx = e.x + DIRS[k].dx, ny = e.y + DIRS[k].dy, t = tileAt(room, nx, ny);
    if (!passable(t) || t === 'D' || t === 'X' || enemyAt(room, nx, ny) || (nx === p.x && ny === p.y)) continue;
    e.x = nx;
    e.y = ny;
    e.facing = k;
    return k;
  }
  return null;
}
const facingTo = (e, p) => (Math.abs(p.x - e.x) >= Math.abs(p.y - e.y) ? (p.x > e.x ? 'right' : 'left') : p.y > e.y ? 'down' : 'up');
// ¿línea recta despejada (sin paredes) entre la torreta y tú? Devuelve la dirección
function lineTo(room, e, p) {
  if (e.x !== p.x && e.y !== p.y) return null;
  const dir = facingTo(e, p), d = DIRS[dir];
  let x = e.x, y = e.y;
  for (;;) {
    x += d.dx;
    y += d.dy;
    if (x === p.x && y === p.y) return dir;
    const t = tileAt(room, x, y);
    if (t === '#' || t === 'D' || t === 'C' || t === 'T' || t === 'A') return null;
  }
}

function enemyPhase(s, room, ev) {
  const p = s.player;
  for (const e of room.enemies) {
    if (!e.alive || s.over) continue;
    if (e.stun > 0) { e.stun--; continue; }
    if (e.kind === 'drone') {
      if (dist(e, p) === 1) { e.facing = facingTo(e, p); ev.push({ type: 'attack', id: e.id }); hurt(s, ENEMY.drone.dmg, ev, 'dron'); } else stepToward(room, e, p);
    } else if (e.kind === 'shield') {
      // LENTO: solo actúa (se gira, golpea o avanza) un turno de cada dos
      if (s.turn % 2 === 0) {
        e.facing = facingTo(e, p);
        if (dist(e, p) === 1) { ev.push({ type: 'attack', id: e.id }); hurt(s, ENEMY.shield.dmg, ev, 'escudo'); } else stepToward(room, e, p);
      }
    } else if (e.kind === 'bomb') {
      if (e.fuse !== null) {
        e.fuse--;
        if (e.fuse <= 0) {
          e.alive = false;
          ev.push({ type: 'boom', x: e.x, y: e.y, r: 1 });
          if (Math.abs(e.x - p.x) <= 1 && Math.abs(e.y - p.y) <= 1) hurt(s, ENEMY.bomb.dmg, ev, 'bomba');
          for (const o of room.enemies) if (o.alive && o !== e && Math.abs(o.x - e.x) <= 1 && Math.abs(o.y - e.y) <= 1) hitEnemy(s, o, 2, null, ev);
        }
      } else if (dist(e, p) <= 1) { e.fuse = 2; ev.push({ type: 'armed', id: e.id }); } else stepToward(room, e, p);
    } else if (e.kind === 'turret') {
      if (e.charge) {
        // dispara por la línea marcada el turno anterior: si te has apartado, falla
        const dir = e.charge, d = DIRS[dir];
        let x = e.x, y = e.y;
        const path = [];
        for (;;) {
          x += d.dx;
          y += d.dy;
          const t = tileAt(room, x, y);
          if (t === '#' || t === 'D' || t === 'C' || t === 'T' || t === 'A') break;
          path.push([x, y]);
          if (x === p.x && y === p.y) { hurt(s, ENEMY.turret.dmg, ev, 'torreta'); break; }
        }
        ev.push({ type: 'eshot', id: e.id, path });
        e.charge = null;
        e.cd = 1;
      } else if (e.cd > 0) e.cd--;
      else {
        const dir = lineTo(room, e, p);
        if (dir) { e.charge = dir; e.facing = dir; ev.push({ type: 'aim', id: e.id }); }
      }
    }
  }
}

// casillas que una torreta va a barrer el turno que viene (para dibujarlas)
export function chargeLine(room, e) {
  if (!e.charge) return [];
  const d = DIRS[e.charge], out = [];
  let x = e.x, y = e.y;
  for (;;) {
    x += d.dx;
    y += d.dy;
    const t = tileAt(room, x, y);
    if (t === '#' || t === 'D' || t === 'C' || t === 'T' || t === 'A') break;
    out.push([x, y]);
  }
  return out;
}

// ---------- Salas y plantas ----------
function enterRoom(s, dir, ev) {
  const from = s.floor.rooms[s.at], to = from.doors[dir];
  if (!to) return ev;
  s.at = to;
  const room = roomOf(s);
  const entry = { up: [MID_C, ROWS - 2], down: [MID_C, 1], left: [COLS - 2, MID_R], right: [1, MID_R] }[dir];
  s.player.x = entry[0];
  s.player.y = entry[1];
  if (!s.visited.includes(to)) s.visited.push(to);
  ev.push({ type: 'room', id: to, roomType: room.type });
  if (locked(room)) ev.push({ type: 'shut' });
  return ev;
}

function descend(s, ev) {
  s.depth++;
  s.player.piezas += 3 + s.depth;
  if (s.depth > LAST_FLOOR) {
    s.won = true;
    s.over = true;
    ev.push({ type: 'win' });
    return ev;
  }
  s.floor = genFloor(s.seed, s.depth);
  s.rooms = {};
  s.at = s.floor.start;
  s.visited = [s.at];
  roomOf(s);
  s.player.x = MID_C;
  s.player.y = MID_R;
  s.player.hp = Math.min(s.player.max, s.player.hp + 1);
  ev.push({ type: 'floor', depth: s.depth, theme: s.floor.theme.name });
  return ev;
}

// TIENDA (🔩 de la partida) y ALTAR
export const shopCost = (s, item) => ({ repair: 6 + s.depth, key: 8 + s.depth }[item]);
function buy(s, item) {
  const c = shopCost(s, item), p = s.player;
  if (!c || p.piezas < c) return [{ type: 'poor' }];
  if (item === 'repair' && p.hp >= p.max) return [{ type: 'full' }];
  p.piezas -= c;
  if (item === 'repair') p.hp = Math.min(p.max, p.hp + 3);
  if (item === 'key') p.keys++;
  return [{ type: 'bought', item }];
}
function pray(s, room, pick) {
  if (room.type !== 'shrine' || room.used) return [{ type: 'empty' }];
  room.used = true;
  const p = s.player;
  if (pick === 'hp') { p.max += 2; p.hp += 2; } else p.shotDmg += 1;
  return [{ type: 'blessed', pick }];
}

// ---------- Bot (tests y demostración) ----------
// Juega solo: limpia la sala (dispara si está alineado, si no se acerca y golpea), evita minas y suelo
// eléctrico, abre cofres con llave y luego va a la siguiente sala sin visitar o a la salida.
export function botAction(s) {
  const p = s.player, room = roomOf(s);
  const foes = room.enemies.filter((e) => e.alive);
  const avoid = (x, y) => ['M', 'E'].includes(tileAt(room, x, y));
  // huir de una bomba armada o de la línea de una torreta
  const danger = (x, y) => foes.some((e) => (e.kind === 'bomb' && e.fuse !== null && Math.abs(e.x - x) <= 1 && Math.abs(e.y - y) <= 1)
    || (e.kind === 'turret' && chargeLine(room, e).some(([cx, cy]) => cx === x && cy === y)));
  // al lado de algo que se puede golpear y con vida de sobra: golpéalo
  if (p.hp > 3) {
    for (const k of DIR_KEYS) {
      const f = enemyAt(room, p.x + DIRS[k].dx, p.y + DIRS[k].dy);
      if (f && !(f.kind === 'bomb' && f.fuse !== null)) return { type: 'move', dir: k };
    }
  }
  if (danger(p.x, p.y)) {
    for (const k of DIR_KEYS) {
      const nx = p.x + DIRS[k].dx, ny = p.y + DIRS[k].dy, t = tileAt(room, nx, ny);
      if (passable(t) && t !== 'D' && !enemyAt(room, nx, ny) && !danger(nx, ny) && !avoid(nx, ny)) return { type: 'move', dir: k };
    }
  }
  if (foes.length) {
    // al lado de algo que se puede golpear: golpéalo (a un escudo, solo si no te mira)
    for (const k of DIR_KEYS) {
      const f = enemyAt(room, p.x + DIRS[k].dx, p.y + DIRS[k].dy);
      if (f && !(f.kind === 'bomb' && f.fuse !== null)) return { type: 'move', dir: k };
    }
    // en línea con algo y con el disparo listo
    if (p.shotCd === 0) {
      for (const k of DIR_KEYS) {
        let x = p.x, y = p.y;
        for (;;) {
          x += DIRS[k].dx; y += DIRS[k].dy;
          const t = tileAt(room, x, y);
          if (t === '#' || t === 'D' || t === 'C' || t === 'T' || t === 'A') break;
          const f = enemyAt(room, x, y);
          if (f) { if (!(f.kind === 'shield' && k === OPP[f.facing])) return { type: 'shoot', dir: k }; break; }
        }
      }
    }
    if (p.abCd === 0 && foes.filter((e) => Math.abs(e.x - p.x) <= 1 && Math.abs(e.y - p.y) <= 1).length >= 2) return { type: 'ability' };
    // al objetivo más cercano
    const target = foes.reduce((a, b) => (dist(b, p) < dist(a, p) ? b : a));
    const goals = [[target.x, target.y]];
    const step = pathStep(room, p, goals, (x, y) => avoid(x, y) || danger(x, y), true) || pathStep(room, p, goals, () => false, true);
    return step ? { type: 'move', dir: step } : { type: 'wait' };
  }
  // sala limpia: cofre (si hay llave), salida, o la siguiente sala sin ver
  if (room.type === 'treasure' && !room.opened && p.keys) { const st = pathStep(room, p, [[2, 2]], avoid, true); if (st) return { type: 'move', dir: st }; }
  if (room.type === 'exit') { const st = pathStep(room, p, [[MID_C, MID_R]], avoid) || pathStep(room, p, [[MID_C, MID_R]], () => false); if (st) return { type: 'move', dir: st }; }
  const fr = s.floor.rooms[s.at];
  const doorAt = { up: [MID_C, 0], down: [MID_C, ROWS - 1], left: [0, MID_R], right: [COLS - 1, MID_R] };
  const want = routeToTarget(s);
  if (want && fr.doors[want]) { const st = pathStep(room, p, [doorAt[want]], avoid) || pathStep(room, p, [doorAt[want]], () => false); if (st) return { type: 'move', dir: st }; }
  return { type: 'wait' };
}
// siguiente puerta hacia la sala sin visitar más cercana (o hacia la salida)
function routeToTarget(s) {
  const rooms = s.floor.rooms, prev = { [s.at]: null }, q = [s.at];
  let goal = null;
  while (q.length) {
    const id = q.shift();
    if (id !== s.at && !s.visited.includes(id)) { goal = id; break; }
    for (const nid of Object.values(rooms[id].doors)) if (!(nid in prev)) { prev[nid] = id; q.push(nid); }
  }
  if (!goal) goal = s.floor.exit;
  if (goal === s.at) return null;
  // vuelve hasta el primer paso
  let id = goal;
  if (!(id in prev)) return null;
  while (prev[id] !== s.at && prev[id] !== null) id = prev[id];
  return Object.entries(rooms[s.at].doors).find(([, v]) => v === id)?.[0] || null;
}
// BFS dentro de la sala: primer paso hacia alguna de las metas (bump = vale llegar al lado si la meta es sólida)
function pathStep(room, p, goals, avoid, bump = false) {
  const key = (x, y) => y * COLS + x;
  const parent = new Map([[key(p.x, p.y), null]]), q = [[p.x, p.y]];
  const isGoal = (x, y) => goals.some(([gx, gy]) => gx === x && gy === y);
  while (q.length) {
    const [x, y] = q.shift();
    for (const k of DIR_KEYS) {
      const nx = x + DIRS[k].dx, ny = y + DIRS[k].dy, kk = key(nx, ny);
      if (parent.has(kk)) continue;
      const t = tileAt(room, nx, ny), goal = isGoal(nx, ny);
      if (!goal && (!passable(t) || enemyAt(room, nx, ny) || avoid(nx, ny))) continue;
      if (goal && !bump && (!passable(t) || enemyAt(room, nx, ny))) continue;
      parent.set(kk, { x, y, k });
      if (goal) {
        // vuelve hasta el primer paso desde donde estás
        let cur = parent.get(kk);
        let first = cur.k;
        while (cur && !(cur.x === p.x && cur.y === p.y)) {
          const up = parent.get(key(cur.x, cur.y));
          first = up.k;
          cur = up;
        }
        return first;
      }
      if (t === 'D') continue; // no se cruza una puerta de camino
      q.push([nx, ny]);
    }
  }
  return null;
}
