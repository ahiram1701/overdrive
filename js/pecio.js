// PECIOS: el 4.º juego de OVERDRIVE. Roguelite de acción en TIEMPO REAL, sala a sala: tu nave vuela por
// pecios y estaciones abandonadas (en 3D, con la cámara detrás) y dispara sola al enemigo más cercano.
// Módulo puro (se testea en Node): generación de plantas y salas, física sobre la cuadrícula de la sala,
// enemigos con su aviso visible, y un bot. Las posiciones van en CASILLAS (la casilla c,r ocupa
// [c, c+1) × [r, r+1)); el ángulo 0 mira "arriba" (fila 0) y crece hacia la derecha.
import { makeRng, hashString } from './rng.js';

export const COLS = 9, ROWS = 11;
export const MID_C = 4, MID_R = 5;
export const DIRS = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };
export const DIR_KEYS = Object.keys(DIRS);
export const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
export const LAST_FLOOR = 9;

// Tres ambientes, de 3 plantas cada uno
export const THEMES = [
  { id: 'carga', name: 'PECIO DE CARGA', floor: '#140f1f', wall: '#5ac8fa', accent: '#ffcc00', fog: '#07040f', mix: { drone: 5, turret: 2, bomb: 2, shield: 1 } },
  { id: 'medica', name: 'ESTACIÓN MÉDICA', floor: '#0b1714', wall: '#30d158', accent: '#7dffb0', fog: '#020a07', mix: { drone: 3, turret: 3, bomb: 2, shield: 2 } },
  { id: 'reactor', name: 'REACTOR', floor: '#1a0907', wall: '#ff6a00', accent: '#ff2d55', fog: '#0c0302', mix: { drone: 3, turret: 2, bomb: 3, shield: 3 } },
];
export const themeOf = (depth) => THEMES[Math.floor((depth - 1) / 3) % THEMES.length];

// Enemigos: siempre avisan (la torreta marca su láser, la bomba parpadea, el escudo enseña su frente)
export const ENEMY = {
  drone: { name: 'Dron', hp: 4, dmg: 1, speed: 2.3, r: 0.32, color: '#ff2bd6', piezas: 1, desc: 'te persigue y te embiste' },
  turret: { name: 'Torreta', hp: 6, dmg: 2, speed: 0, r: 0.38, color: '#00e5ff', piezas: 2, desc: 'fija: marca su láser en rojo y dispara al momento siguiente; apártate de la línea' },
  bomb: { name: 'Bomba', hp: 2, dmg: 2, speed: 2.5, r: 0.3, color: '#ff9f0a', piezas: 1, desc: 'corre hacia ti, parpadea y estalla alrededor' },
  shield: { name: 'Escudo', hp: 6, dmg: 1, speed: 1.3, r: 0.4, color: '#30d158', piezas: 2, desc: 'para los disparos de frente y gira despacio: rodéalo' },
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

// Losas: . suelo · # pared · P pozo (si caes, daño y vuelves a la puerta; el ESQUIVE lo salta) · M mina
// · E suelo eléctrico (a ratos) · D puerta · C cofre (con llave) · T terminal de la tienda · A altar · X escotilla
const BLOCK = new Set(['#', 'C', 'T', 'A']); // macizo para todos (y tapa la vista)
const SIGHT = new Set(['#', 'C', 'T', 'A', 'D']);
export const blocksSight = (t) => SIGHT.has(t);

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

export const DOOR_TILE = { up: [MID_C, 0], down: [MID_C, ROWS - 1], left: [0, MID_R], right: [COLS - 1, MID_R] };

// Una sala: losas y enemigos. La cruz central (fila MID_R y columna MID_C) siempre queda libre: así
// todas las puertas se comunican siempre, haya lo que haya en la sala.
export function genRoom(floor, id) {
  const room = floor.rooms[id], depth = floor.depth;
  const rng = makeRng(hashString(`room-${floor.seed}-${depth}-${id}`));
  const t = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (__, c) => (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 ? '#' : '.')));
  for (const k of Object.keys(room.doors)) { const [c, r] = DOOR_TILE[k]; t[r][c] = 'D'; }
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
    for (let i = 0, n = 4 + depth; i < n; i++) { const p = free(); if (p) t[p[1]][p[0]] = rng.chance(0.3) ? 'P' : 'E'; }
  }
  if (type === 'treasure') t[2][2] = 'C';
  if (type === 'shop') t[2][2] = 'T';
  if (type === 'shrine') t[2][COLS - 3] = 'A';
  if (type === 'exit') t[MID_R][MID_C] = 'X';
  // enemigos (lejos de las puertas: al entrar nunca te tocan de golpe)
  const enemies = [];
  const nE = type === 'combat' ? Math.min(6, 2 + Math.floor(depth / 2) + rng.int(0, 1)) : type === 'exit' ? Math.min(5, 2 + Math.floor(depth / 3)) : 0;
  const mix = Object.entries(floor.theme.mix).map(([k, w]) => ({ k, w }));
  for (let i = 0; i < nE; i++) {
    let p = null;
    for (let j = 0; j < 60 && !p; j++) {
      const c = rng.int(1, COLS - 2), r = rng.int(2, ROWS - 3);
      const nearDoor = Object.values(DOOR_TILE).some(([dc, dr]) => Math.abs(dc - c) + Math.abs(dr - r) < 3);
      if (t[r][c] === '.' && !nearDoor && !enemies.some((e) => Math.floor(e.x) === c && Math.floor(e.y) === r) && !(c === MID_C && r === MID_R)) p = [c, r];
    }
    if (!p) continue;
    const kind = rng.weighted(mix).k, E = ENEMY[kind];
    const hp = E.hp + 2 * Math.floor((depth - 1) / 3);
    enemies.push({ id: `${id}-${i}`, kind, x: p[0] + 0.5, y: p[1] + 0.5, ang: Math.PI, hp, max: hp, r: E.r, cd: rng.range(0.4, 1.4), charge: 0, aim: null, fuse: null, stun: 0, hitT: 0, alive: true });
  }
  return { id, type, tiles: t, enemies, cleared: !enemies.length, opened: false, used: false, wake: 0, flow: null, flowT: 0 };
}

// ---------- Partida ----------
// ship = { hp, ability } (de la nave del hangar)
export function newRun(seed, ship = {}) {
  const floor = genFloor(seed, 1);
  const s = {
    seed, depth: 1, floor, rooms: {}, at: floor.start, time: 0, over: false, won: false,
    rng: makeRng(hashString(`run-${seed}`)),
    player: {
      x: MID_C + 0.5, y: MID_R + 0.5, ang: 0, r: 0.3, hp: ship.hp || 6, max: ship.hp || 6, dmg: 2, rate: 2.4, fireCd: 0.5, range: 8,
      ability: ship.ability || 'nova', abCd: 0, abMax: 10, dashCd: 0, dashT: 0, keys: 0, piezas: 0, shield: 0, inv: 0, boost: 0, ram: 0, speed: 3.4, vel: 0,
    },
    entry: { x: MID_C + 0.5, y: MID_R + 0.5, ang: 0 },
    shots: [], visited: [floor.start], kills: 0, roomsCleared: 0, touch: null,
  };
  s.rooms[floor.start] = genRoom(floor, floor.start);
  return s;
}
export const roomOf = (s, id = s.at) => (s.rooms[id] ||= genRoom(s.floor, id));
export const tileAt = (room, c, r) => (c < 0 || r < 0 || c >= COLS || r >= ROWS ? '#' : room.tiles[r][c]);
export const locked = (room) => LOCKS.has(room.type) && room.enemies.some((e) => e.alive);
// 🔩 que te llevas si caes: más cuanto más hondo llegaste (si sales, todas)
export const keptPiezas = (s) => (s.won ? s.player.piezas : Math.floor(s.player.piezas * Math.min(1, 0.5 + 0.1 * (s.depth - 1))));
export const energyOn = (s) => s.time % 4 < 2.4; // el suelo eléctrico se enciende a ratos
export const fwd = (ang) => ({ x: Math.sin(ang), y: -Math.cos(ang) });
export const angTo = (from, to) => Math.atan2(to.x - from.x, -(to.y - from.y));
export const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Las habilidades ⚡ de cada nave, en tiempo real
export const ABILITY = {
  nova: { name: 'Onda', desc: '3 de daño a todo lo que tengas cerca' },
  chaos: { name: 'Caos', desc: '3 de daño a todo lo que tengas cerca' },
  singularity: { name: 'Singularidad', desc: '3 de daño a todo lo que tengas cerca' },
  laser: { name: 'Rayo', desc: 'rayo de 4 que atraviesa todo lo que tienes delante' },
  hammer: { name: 'Martillo', desc: 'rayo de 4 que atraviesa todo lo que tienes delante' },
  hook: { name: 'Gancho', desc: 'saltas 3 casillas hacia delante' },
  blink: { name: 'Parpadeo', desc: 'saltas 3 casillas hacia delante' },
  bubble: { name: 'Burbuja', desc: 'absorbes los 2 próximos golpes' },
  barrier: { name: 'Barrera', desc: 'recuperas 2 de vida y absorbes un golpe' },
  overclock: { name: 'Sobrecarga', desc: 'disparas el doble de rápido 4 s' },
  ram: { name: 'Ariete', desc: 'embestida: 4 de daño a lo que atravieses' },
  roar: { name: 'Rugido', desc: 'aturdes a todos 2 s' },
  phase: { name: 'Fase', desc: 'intocable 2,5 s' },
};

// ---------- Colisiones ----------
// ¿la losa frena a quien se mueve? (el jugador pisa pozos —y cae— y cruza puertas abiertas)
function solidFor(room, t, who) {
  if (BLOCK.has(t)) return true;
  if (t === 'D') return who !== 'player' || locked(room);
  if (who !== 'player' && (t === 'P' || t === 'X')) return true;
  return false;
}
// ¿un círculo en (x, y) toca alguna losa maciza?
export function hitsWall(room, x, y, r, who = 'player') {
  for (let c = Math.floor(x - r); c <= Math.floor(x + r); c++) {
    for (let rr = Math.floor(y - r); rr <= Math.floor(y + r); rr++) {
      if (!solidFor(room, tileAt(room, c, rr), who)) continue;
      const nx = Math.max(c, Math.min(x, c + 1)), ny = Math.max(rr, Math.min(y, rr + 1));
      if ((x - nx) ** 2 + (y - ny) ** 2 < r * r) return true;
    }
  }
  return false;
}
// mueve un círculo deslizando por las paredes (primero x, luego y; en pasos cortos para no atravesar)
export function moveCircle(room, e, dx, dy, who = 'player') {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.2));
  let hit = false;
  for (let i = 0; i < n; i++) {
    if (!hitsWall(room, e.x + dx / n, e.y, e.r, who)) e.x += dx / n; else hit = true;
    if (!hitsWall(room, e.x, e.y + dy / n, e.r, who)) e.y += dy / n; else hit = true;
  }
  return hit;
}
// línea de visión: nada macizo entre los dos puntos (los pozos y las minas no tapan)
// Recorrido EXACTO de las casillas que cruza el segmento (DDA): si no, una esquina se cuela entre dos
// muestras y la nave "ve" a quien sus balas no pueden alcanzar.
export function canSee(room, a, b) {
  let c = Math.floor(a.x), r = Math.floor(a.y);
  const ce = Math.floor(b.x), re = Math.floor(b.y), dx = b.x - a.x, dy = b.y - a.y;
  const sc = Math.sign(dx), sr = Math.sign(dy);
  const tdx = sc ? Math.abs(1 / dx) : Infinity, tdy = sr ? Math.abs(1 / dy) : Infinity;
  let tx = sc > 0 ? (c + 1 - a.x) * tdx : sc < 0 ? (a.x - c) * tdx : Infinity;
  let ty = sr > 0 ? (r + 1 - a.y) * tdy : sr < 0 ? (a.y - r) * tdy : Infinity;
  for (let i = 0; i < 64 && (c !== ce || r !== re); i++) {
    if (tx < ty) { c += sc; tx += tdx; } else { r += sr; ty += tdy; }
    if ((c !== ce || r !== re) && blocksSight(tileAt(room, c, r))) return false;
  }
  return true;
}
// hasta dónde llega un rayo (para el láser de la torreta y el rayo de tu habilidad)
export function rayEnd(room, from, ang, max = 14) {
  const f = fwd(ang);
  let t = 0;
  while (t < max) {
    const x = from.x + f.x * t, y = from.y + f.y * t;
    if (blocksSight(tileAt(room, Math.floor(x), Math.floor(y)))) break;
    t += 0.1;
  }
  return { x: from.x + f.x * t, y: from.y + f.y * t };
}
// distancia de un punto a un segmento
function segDist(p, a, b) {
  const vx = b.x - a.x, vy = b.y - a.y, L = vx * vx + vy * vy || 1;
  const k = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L));
  return Math.hypot(p.x - a.x - vx * k, p.y - a.y - vy * k);
}

// El enemigo vivo más cercano que se ve (el disparo automático va a por él)
export function nearestTarget(s, room = roomOf(s)) {
  const p = s.player;
  let best = null, bd = p.range;
  for (const e of room.enemies) {
    if (!e.alive) continue;
    const d = d2(p, e);
    if (d < bd && canSee(room, p, e)) { bd = d; best = e; }
  }
  return best;
}

// ---------- Un paso de simulación ----------
// input = { x: giro (-1 izquierda … 1 derecha), y: avance (-1 adelante … 1 atrás) }. Devuelve eventos
// para el sonido y los efectos.
export function updateRun(s, dt, input = { x: 0, y: 0 }) {
  if (s.over) return [];
  const ev = [], p = s.player, room = roomOf(s);
  s.time += dt;
  room.wake = Math.max(0, room.wake - dt);
  for (const k of ['inv', 'abCd', 'dashCd', 'boost']) p[k] = Math.max(0, p[k] - dt);
  // MOVIMIENTO: el joystick hacia arriba avanza, a los lados gira (hacia atrás, marcha atrás lenta)
  if (p.dashT > 0) {
    p.dashT -= dt;
    const f = fwd(p.ang);
    moveCircle(room, p, f.x * 9 * dt, f.y * 9 * dt);
    if (p.ram > 0) for (const e of room.enemies) if (e.alive && !e.rammed && d2(p, e) < p.r + e.r + 0.15) { e.rammed = true; hitEnemy(s, room, e, 4, ev); }
    if (p.dashT <= 0) { p.ram = 0; for (const e of room.enemies) e.rammed = false; }
  } else {
    p.ang += Math.max(-1, Math.min(1, input.x || 0)) * 3.4 * dt;
    const want = -Math.max(-1, Math.min(1, input.y || 0)) * (input.y > 0 ? 0.5 : 1);
    p.vel += (want - p.vel) * Math.min(1, dt * 10);
    const f = fwd(p.ang);
    moveCircle(room, p, f.x * p.speed * p.vel * dt, f.y * p.speed * p.vel * dt);
    doorFunnel(room, p, dt);
  }
  floorEffects(s, room, ev);
  if (s.over) return ev;
  if (interact(s, room, ev)) return ev;
  // DISPARO AUTOMÁTICO al más cercano que se vea
  p.fireCd -= dt;
  if (p.fireCd <= 0) {
    const t = nearestTarget(s, room);
    if (t) {
      const a = angTo(p, t), f = fwd(a);
      s.shots.push({ x: p.x + f.x * 0.35, y: p.y + f.y * 0.35, vx: f.x * 13, vy: f.y * 13, dmg: p.dmg, life: 1.2 });
      p.fireCd = 1 / (p.rate * (p.boost > 0 ? 2 : 1));
      ev.push({ type: 'fire' });
    } else p.fireCd = 0;
  }
  updateShots(s, room, dt, ev);
  if (room.wake <= 0) updateEnemies(s, room, dt, ev);
  // ¿sala limpia?
  if (!room.cleared && !room.enemies.some((e) => e.alive)) {
    room.cleared = true;
    s.roomsCleared++;
    p.hp = Math.min(p.max, p.hp + 1); // los drones de reparación de la sala te arreglan un poco
    ev.push({ type: 'cleared' });
    if (s.rng.chance(0.4)) { p.keys++; ev.push({ type: 'key' }); }
  }
  return ev;
}

// pozos, minas y suelo eléctrico, según la losa que pisas
function floorEffects(s, room, ev) {
  const p = s.player, c = Math.floor(p.x), r = Math.floor(p.y), t = tileAt(room, c, r);
  if (t === 'P' && p.dashT <= 0) {
    ev.push({ type: 'fall' });
    hurt(s, 1, ev, 'pozo', true);
    Object.assign(p, { x: s.entry.x, y: s.entry.y, ang: s.entry.ang, vel: 0 });
  } else if (t === 'M' && Math.hypot(p.x - c - 0.5, p.y - r - 0.5) < 0.45) {
    room.tiles[r][c] = '.';
    ev.push({ type: 'boom', x: c + 0.5, y: r + 0.5, r: 0.6 });
    hurt(s, 2, ev, 'mina');
  } else if (t === 'E' && energyOn(s) && p.dashT <= 0) hurt(s, 1, ev, 'electricidad');
}

// cofre, tienda, altar, puertas y escotilla: se activan al tocarlos (una vez, hasta que te alejes)
function interact(s, room, ev) {
  const p = s.player;
  if (s.touch && Math.hypot(p.x - s.touch.x, p.y - s.touch.y) > 1.3) s.touch = null;
  const c0 = Math.floor(p.x), r0 = Math.floor(p.y);
  // puerta abierta: la cruzas en cuanto tocas el hueco (no hace falta meter el centro de la nave en la losa)
  const through = doorTouch(room, p);
  if (through) { enterRoom(s, through, ev); return true; }
  if (tileAt(room, c0, r0) === 'X' && Math.hypot(p.x - c0 - 0.5, p.y - r0 - 0.5) < 0.45 && !locked(room)) { descend(s, ev); return true; }
  for (let c = c0 - 1; c <= c0 + 1; c++) {
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      const t = tileAt(room, c, r);
      if (!['C', 'T', 'A', 'D'].includes(t) || Math.hypot(p.x - c - 0.5, p.y - r - 0.5) > 0.95) continue;
      if (t === 'D' && !locked(room)) continue; // una puerta abierta no se queja (se cruza)
      if (s.touch) return false;
      s.touch = { x: c + 0.5, y: r + 0.5 };
      if (t === 'D') ev.push({ type: 'locked' });
      else if (t === 'C') {
        if (room.opened) ev.push({ type: 'empty' });
        else if (p.keys < 1) ev.push({ type: 'needKey' });
        else {
          p.keys--;
          room.opened = true;
          const gain = 5 + s.depth * 2;
          p.piezas += gain;
          p.hp = Math.min(p.max, p.hp + 1);
          ev.push({ type: 'chest', piezas: gain });
        }
      } else if (t === 'T') ev.push({ type: 'shop' });
      else ev.push({ type: room.used ? 'empty' : 'shrine' });
      return false;
    }
  }
  return false;
}

// ¿Tocas el hueco de una puerta ABIERTA? Tu círculo la roza y estás dentro de su anchura (no contra el marco)
export function doorTouch(room, p) {
  if (locked(room)) return null;
  for (const k of DIR_KEYS) {
    const [c, r] = DOOR_TILE[k];
    if (tileAt(room, c, r) !== 'D') continue;
    const nx = Math.max(c, Math.min(p.x, c + 1)), ny = Math.max(r, Math.min(p.y, r + 1));
    if (Math.hypot(p.x - nx, p.y - ny) > p.r + 0.05) continue;
    const across = k === 'up' || k === 'down' ? Math.abs(p.x - c - 0.5) : Math.abs(p.y - r - 0.5);
    if (across < 0.5) return k;
  }
  return null;
}
// EMBUDO: si vas hacia una puerta abierta y estás cerca, la nave se desliza hacia su eje (así no rozas el marco)
function doorFunnel(room, p, dt) {
  if (p.vel < 0.2 || locked(room)) return;
  const f = fwd(p.ang);
  for (const k of DIR_KEYS) {
    const [c, r] = DOOR_TILE[k];
    if (tileAt(room, c, r) !== 'D') continue;
    const dx = c + 0.5 - p.x, dy = r + 0.5 - p.y, d = Math.hypot(dx, dy);
    if (d > 1.6) continue;
    // lejos: si miras hacia la puerta; ya cerca: basta con ir hacia su pared (aunque llegues torcido)
    const towardWall = { up: -f.y, down: f.y, left: -f.x, right: f.x }[k];
    if (d > 1.1 ? (f.x * dx + f.y * dy) / d < 0.5 : towardWall < 0.3) continue;
    const step = 2.5 * dt;
    if (k === 'up' || k === 'down') moveCircle(room, p, Math.max(-step, Math.min(step, dx)), 0);
    else moveCircle(room, p, 0, Math.max(-step, Math.min(step, dy)));
  }
}

function updateShots(s, room, dt, ev) {
  for (const b of s.shots) {
    const n = 3;
    for (let i = 0; i < n && b.life > 0; i++) {
      b.x += (b.vx * dt) / n;
      b.y += (b.vy * dt) / n;
      if (blocksSight(tileAt(room, Math.floor(b.x), Math.floor(b.y)))) { b.life = 0; ev.push({ type: 'spark', x: b.x, y: b.y }); break; }
      const e = room.enemies.find((o) => o.alive && Math.hypot(o.x - b.x, o.y - b.y) < o.r + 0.08);
      if (!e) continue;
      b.life = 0;
      // ESCUDO: lo que le llega de frente rebota
      const f = fwd(e.ang), sp = Math.hypot(b.vx, b.vy) || 1;
      if (e.kind === 'shield' && (b.vx * f.x + b.vy * f.y) / sp < -0.35) ev.push({ type: 'blocked', id: e.id, x: b.x, y: b.y });
      else hitEnemy(s, room, e, b.dmg, ev);
    }
    b.life -= dt;
  }
  s.shots = s.shots.filter((b) => b.life > 0);
}

function hitEnemy(s, room, e, dmg, ev) {
  if (!e.alive) return;
  e.hp -= dmg;
  e.hitT = 0.12;
  ev.push({ type: 'hit', id: e.id, dmg, x: e.x, y: e.y });
  if (e.hp > 0) return;
  e.alive = false;
  s.kills++;
  const gain = ENEMY[e.kind].piezas + Math.floor(s.depth / 3);
  s.player.piezas += gain;
  ev.push({ type: 'kill', id: e.id, kind: e.kind, piezas: gain, x: e.x, y: e.y });
  if (e.kind === 'bomb' && e.fuse !== null) explode(s, room, e, ev);
}

function hurt(s, dmg, ev, src, force = false) {
  const p = s.player;
  if (!force && (p.inv > 0 || p.dashT > 0)) return;
  if (p.shield > 0 && !force) { p.shield--; p.inv = 0.5; ev.push({ type: 'absorb' }); return; }
  p.hp -= dmg;
  p.inv = 0.9;
  ev.push({ type: 'hurt', dmg, src });
  if (p.hp <= 0) { p.hp = 0; s.over = true; ev.push({ type: 'dead' }); }
}

function explode(s, room, e, ev) {
  e.alive = false;
  ev.push({ type: 'boom', x: e.x, y: e.y, r: 1.7 });
  if (d2(e, s.player) < 1.7) hurt(s, ENEMY.bomb.dmg, ev, 'bomba');
  for (const o of room.enemies) if (o.alive && o !== e && d2(o, e) < 1.7) hitEnemy(s, room, o, 3, ev);
}

// Mapa de distancias hasta ti (los enemigos rodean obstáculos siguiéndolo)
function flowField(room, p) {
  const dist = new Int16Array(COLS * ROWS).fill(-1), q = [];
  const k0 = Math.floor(p.y) * COLS + Math.floor(p.x);
  dist[k0] = 0;
  q.push(k0);
  while (q.length) {
    const k = q.shift(), c = k % COLS, r = (k - c) / COLS;
    for (const d of Object.values(DIRS)) {
      const nc = c + d.dx, nr = r + d.dy, nk = nr * COLS + nc;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS || dist[nk] >= 0 || solidFor(room, room.tiles[nr][nc], 'enemy')) continue;
      dist[nk] = dist[k] + 1;
      q.push(nk);
    }
  }
  return dist;
}
// hacia dónde ir para acercarte a ti: directo si te ve; si no, por el mapa de distancias
function chaseDir(room, e, p) {
  if (canSee(room, e, p)) return angTo(e, p);
  const c = Math.floor(e.x), r = Math.floor(e.y), f = room.flow;
  let best = null, bd = f[r * COLS + c] >= 0 ? f[r * COLS + c] : 999;
  for (const d of Object.values(DIRS)) {
    const v = f[(r + d.dy) * COLS + c + d.dx];
    if (v >= 0 && v < bd && r + d.dy >= 0 && r + d.dy < ROWS) { bd = v; best = { x: c + d.dx + 0.5, y: r + d.dy + 0.5 }; }
  }
  return best ? angTo(e, best) : angTo(e, p);
}

function updateEnemies(s, room, dt, ev) {
  const p = s.player;
  room.flowT -= dt;
  if (!room.flow || room.flowT <= 0) { room.flow = flowField(room, p); room.flowT = 0.3; }
  for (const e of room.enemies) {
    if (!e.alive || s.over) continue;
    e.hitT = Math.max(0, e.hitT - dt);
    if (e.stun > 0) { e.stun -= dt; continue; }
    e.cd -= dt;
    const E = ENEMY[e.kind], dist = d2(e, p);
    if (e.kind === 'drone' || e.kind === 'shield') {
      const want = chaseDir(room, e, p);
      // el escudo gira despacio: por eso se le puede rodear
      e.ang += Math.max(-1, Math.min(1, angDiff(want, e.ang) / 0.2)) * (e.kind === 'shield' ? 1.3 : 6) * dt;
      const f = fwd(e.kind === 'shield' ? e.ang : want);
      if (dist > p.r + e.r + 0.05) moveCircle(room, e, f.x * E.speed * dt, f.y * E.speed * dt, 'enemy');
      if (dist < p.r + e.r + 0.12 && e.cd <= 0) {
        ev.push({ type: 'attack', id: e.id });
        hurt(s, E.dmg, ev, e.kind);
        e.cd = 1;
        if (e.kind === 'drone') { const b = fwd(angTo(p, e)); moveCircle(room, e, b.x * 0.7, b.y * 0.7, 'enemy'); }
      }
    } else if (e.kind === 'bomb') {
      if (e.fuse !== null) {
        e.fuse -= dt;
        if (e.fuse <= 0) explode(s, room, e, ev);
      } else if (dist < 1.25) { e.fuse = 0.85; ev.push({ type: 'armed', id: e.id }); } else {
        const want = chaseDir(room, e, p), f = fwd(want);
        e.ang = want;
        moveCircle(room, e, f.x * E.speed * dt, f.y * E.speed * dt, 'enemy');
      }
    } else if (e.kind === 'turret') {
      if (e.charge > 0) {
        // dispara por la línea marcada: si te has apartado, falla
        e.charge -= dt;
        if (e.charge <= 0) {
          const end = rayEnd(room, e, e.aim);
          ev.push({ type: 'eshot', id: e.id, from: { x: e.x, y: e.y }, to: end });
          if (segDist(p, e, end) < p.r + 0.12) hurt(s, E.dmg, ev, 'torreta');
          e.cd = 1.6;
        }
      } else {
        e.ang += angDiff(angTo(e, p), e.ang) * Math.min(1, dt * 4);
        if (e.cd <= 0 && dist < 9 && canSee(room, e, p)) { e.aim = angTo(e, p); e.ang = e.aim; e.charge = 0.85; ev.push({ type: 'aim', id: e.id }); }
      }
    }
  }
  // que no se apilen
  const live = room.enemies.filter((e) => e.alive && e.kind !== 'turret');
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j], d = d2(a, b), m = a.r + b.r;
      if (d > 0 && d < m) { const k = (m - d) / 2 / d; moveCircle(room, a, (a.x - b.x) * k, (a.y - b.y) * k, 'enemy'); moveCircle(room, b, (b.x - a.x) * k, (b.y - a.y) * k, 'enemy'); }
    }
  }
}

// La línea que va a barrer una torreta que está apuntando (para dibujarla)
export const chargeLine = (room, e) => (e.charge > 0 && e.aim !== null ? { from: { x: e.x, y: e.y }, to: rayEnd(room, e, e.aim) } : null);

// ---------- Geometría para el dibujo 3D (pura: así se puede testear) ----------
// Mundo del dibujo: x = columna, z = −fila. Caras de pared visibles: una por cada lado de una losa maciza
// (pared, o puerta cerrada) que da a una losa libre, puesta EN el borde que comparten; n = normal hacia la libre.
export function wallFaces(room, shut = locked(room)) {
  const isWall = (c, r) => { const k = tileAt(room, c, r); return k === '#' || (k === 'D' && shut); };
  const out = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!isWall(c, r)) continue;
      const door = room.tiles[r][c] === 'D', x0 = c, x1 = c + 1, zN = -r, zS = -r - 1; // zN: borde con la fila r−1; zS: con la r+1
      if (r + 1 < ROWS && !isWall(c, r + 1)) out.push({ c, r, door, a: [x1, zS], b: [x0, zS], n: [0, -1] });
      if (r - 1 >= 0 && !isWall(c, r - 1)) out.push({ c, r, door, a: [x0, zN], b: [x1, zN], n: [0, 1] });
      if (c - 1 >= 0 && !isWall(c - 1, r)) out.push({ c, r, door, a: [x0, zS], b: [x0, zN], n: [-1, 0] });
      if (c + 1 < COLS && !isWall(c + 1, r)) out.push({ c, r, door, a: [x1, zN], b: [x1, zS], n: [1, 0] });
    }
  }
  return out;
}
// ¿un círculo toca algo que tapa la vista (pared, puerta, cofre…)?
function touchesSight(room, x, y, rad) {
  for (let c = Math.floor(x - rad); c <= Math.floor(x + rad); c++) {
    for (let r = Math.floor(y - rad); r <= Math.floor(y + rad); r++) {
      if (!blocksSight(tileAt(room, c, r))) continue;
      const nx = Math.max(c, Math.min(x, c + 1)), ny = Math.max(r, Math.min(y, r + 1));
      if ((x - nx) ** 2 + (y - ny) ** 2 < rad * rad) return true;
    }
  }
  return false;
}
// Hasta dónde puede ir la cámara detrás de la nave sin tocar nada: la cámara tiene "cuerpo" (radio rad), así
// nunca se mete en una pared ni queda tan pegada que el plano cercano la recorte y abra un hueco.
export function camBack(room, p, ang, max = 2.3, rad = 0.2) {
  const b = fwd(ang);
  for (let t = 0.05; t <= max + 1e-9; t += 0.05) if (touchesSight(room, p.x - b.x * t, p.y - b.y * t, rad)) return Math.max(0, t - 0.05);
  return max;
}

// ---------- Acciones: esquive y habilidad ----------
export function dash(s) {
  const p = s.player;
  if (s.over || p.dashCd > 0) return [{ type: 'cooldown' }];
  p.dashT = 0.22;
  p.dashCd = 1.1;
  return [{ type: 'dash' }];
}
export function useAbility(s) {
  const p = s.player, room = roomOf(s), id = p.ability, ev = [];
  if (s.over || p.abCd > 0) return [{ type: 'cooldown' }];
  p.abCd = p.abMax;
  ev.push({ type: 'ability', id });
  if (['nova', 'chaos', 'singularity'].includes(id)) {
    ev.push({ type: 'boom', x: p.x, y: p.y, r: 2.3, mine: true });
    for (const e of room.enemies) if (e.alive && d2(e, p) < 2.3) hitEnemy(s, room, e, 3, ev);
  } else if (id === 'laser' || id === 'hammer') {
    const end = rayEnd(room, p, p.ang);
    ev.push({ type: 'beam', from: { x: p.x, y: p.y }, to: end });
    for (const e of room.enemies) if (e.alive && segDist(e, p, end) < e.r + 0.25) hitEnemy(s, room, e, 4, ev);
  } else if (id === 'hook' || id === 'blink') {
    const f = fwd(p.ang);
    for (let i = 0; i < 30; i++) {
      const nx = p.x + f.x * 0.1, ny = p.y + f.y * 0.1;
      if (hitsWall(room, nx, ny, p.r) || tileAt(room, Math.floor(nx), Math.floor(ny)) === 'D') break;
      p.x = nx;
      p.y = ny;
    }
    p.inv = Math.max(p.inv, 0.4);
  } else if (id === 'bubble') p.shield = 2;
  else if (id === 'barrier') { p.hp = Math.min(p.max, p.hp + 2); p.shield = Math.max(p.shield, 1); }
  else if (id === 'overclock') p.boost = 4;
  else if (id === 'ram') { p.ram = 1; p.dashT = 0.45; p.dashCd = 0.6; }
  else if (id === 'roar') { for (const e of room.enemies) if (e.alive) e.stun = 2; }
  else p.inv = 2.5; // fase (y cualquier otra): intocable
  return ev;
}

// ---------- Salas y plantas ----------
const ENTRY = {
  up: { x: MID_C + 0.5, y: ROWS - 1.5, ang: 0 },
  down: { x: MID_C + 0.5, y: 1.5, ang: Math.PI },
  left: { x: COLS - 1.5, y: MID_R + 0.5, ang: -Math.PI / 2 },
  right: { x: 1.5, y: MID_R + 0.5, ang: Math.PI / 2 },
};
function enterRoom(s, dir, ev) {
  const from = s.floor.rooms[s.at], to = from.doors[dir];
  if (!to) return;
  s.at = to;
  const room = roomOf(s);
  room.wake = 0.9; // un respiro al entrar
  room.flow = null;
  s.entry = { ...ENTRY[dir] };
  Object.assign(s.player, { x: s.entry.x, y: s.entry.y, ang: s.entry.ang, vel: 0.4, dashT: 0 });
  s.shots = [];
  s.touch = null;
  if (!s.visited.includes(to)) s.visited.push(to);
  ev.push({ type: 'room', id: to, roomType: room.type, dir });
  if (locked(room)) ev.push({ type: 'shut' });
}

function descend(s, ev) {
  s.depth++;
  s.player.piezas += 3 + s.depth;
  if (s.depth > LAST_FLOOR) {
    s.won = true;
    s.over = true;
    ev.push({ type: 'win' });
    return;
  }
  s.floor = genFloor(s.seed, s.depth);
  s.rooms = {};
  s.at = s.floor.start;
  s.visited = [s.at];
  roomOf(s);
  s.entry = { x: MID_C + 0.5, y: MID_R + 0.5, ang: 0 };
  Object.assign(s.player, { x: s.entry.x, y: s.entry.y, ang: 0, vel: 0, dashT: 0 });
  s.shots = [];
  s.player.hp = Math.min(s.player.max, s.player.hp + 1);
  ev.push({ type: 'floor', depth: s.depth, theme: s.floor.theme.name });
}

// TIENDA (🔩 de la partida) y ALTAR
export const shopCost = (s, item) => ({ repair: 6 + s.depth, key: 8 + s.depth }[item]);
export function buy(s, item) {
  const c = shopCost(s, item), p = s.player;
  if (!c || p.piezas < c) return [{ type: 'poor' }];
  if (item === 'repair' && p.hp >= p.max) return [{ type: 'full' }];
  p.piezas -= c;
  if (item === 'repair') p.hp = Math.min(p.max, p.hp + 3);
  if (item === 'key') p.keys++;
  return [{ type: 'bought', item }];
}
export function pray(s, pick) {
  const room = roomOf(s);
  if (room.type !== 'shrine' || room.used) return [{ type: 'empty' }];
  room.used = true;
  const p = s.player;
  if (pick === 'hp') { p.max += 2; p.hp += 2; } else p.dmg += 1;
  return [{ type: 'blessed', pick }];
}

// ---------- Bot (tests y demostración) ----------
// Vuela solo (el disparo ya es automático): se aparta de láseres y bombas, busca ver al enemigo más
// cercano a buena distancia, rodea al escudo, abre cofres con llave y va a la sala sin ver o a la salida.
export function botInput(s) {
  const p = s.player, room = roomOf(s), foes = room.enemies.filter((e) => e.alive);
  const avoid = (c, r) => ['M', 'P'].includes(tileAt(room, c, r)) || tileAt(room, c, r) === 'E';
  const threat = (x, y) => foes.some((e) => (e.kind === 'bomb' && (e.fuse !== null || d2(e, { x, y }) < 1.6) && d2(e, { x, y }) < 2.1)
    || (e.kind === 'turret' && e.charge > 0 && segDist({ x, y }, e, rayEnd(room, e, e.aim)) < 0.65));
  const out = { x: 0, y: 0 };
  if (foes.length && p.abCd <= 0 && foes.filter((e) => d2(e, p) < 2.2).length >= 2) out.ability = true;
  // en peligro: a la casilla vecina más segura
  if (threat(p.x, p.y)) {
    const c0 = Math.floor(p.x), r0 = Math.floor(p.y);
    let best = null;
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        const c = c0 + dc, r = r0 + dr, t = tileAt(room, c, r);
        if ((!dc && !dr) || solidFor(room, t, 'enemy') || t === 'D' || avoid(c, r) || threat(c + 0.5, r + 0.5)) continue;
        if (dc && dr && (solidFor(room, tileAt(room, c0 + dc, r0), 'enemy') || solidFor(room, tileAt(room, c0, r0 + dr), 'enemy'))) continue;
        const score = foes.reduce((m, e) => Math.min(m, d2(e, { x: c + 0.5, y: r + 0.5 })), 99);
        if (!best || score > best.score) best = { c, r, score };
      }
    }
    if (best) return { ...steer(p, { x: best.c + 0.5, y: best.r + 0.5 }), dash: p.dashCd <= 0 && foes.some((e) => e.kind === 'turret' && e.charge > 0 && e.charge < 0.3) };
  }
  if (foes.length) {
    const t = foes.reduce((a, b) => (d2(b, p) < d2(a, p) ? b : a));
    const sees = canSee(room, p, t), dist = d2(p, t);
    let goal = { x: t.x, y: t.y };
    if (t.kind === 'shield') { const f = fwd(t.ang); goal = { x: t.x - f.x * 1.6, y: t.y - f.y * 1.6 }; } // a su espalda
    else if (sees && dist < 5.5 && dist > 2) return { ...out, x: Math.max(-1, Math.min(1, angDiff(angTo(p, t), p.ang) * 2)), y: 0 };
    else if (sees && dist <= 2 && t.kind !== 'turret') goal = { x: p.x + (p.x - t.x) * 2, y: p.y + (p.y - t.y) * 2 }; // se aleja
    const step = pathNext(room, p, [[Math.floor(goal.x), Math.floor(goal.y)]], avoid) || pathNext(room, p, [[Math.floor(t.x), Math.floor(t.y)]], avoid) || pathNext(room, p, [[Math.floor(t.x), Math.floor(t.y)]], () => false);
    return { ...out, ...steer(p, step || t) };
  }
  // sala limpia: cofre (si hay llave), salida, o la siguiente sala sin ver
  let goal = null;
  if (room.type === 'treasure' && !room.opened && p.keys) goal = [[2, 3], [3, 2], [1, 2], [2, 1]];
  else if (room.type === 'exit') goal = [[MID_C, MID_R]];
  else {
    const want = routeToTarget(s);
    if (want) goal = [DOOR_TILE[want]];
  }
  if (!goal) return out;
  if (room.type === 'treasure' && !room.opened && p.keys && d2(p, { x: 2.5, y: 2.5 }) < 1.4) return steer(p, { x: 2.5, y: 2.5 });
  const step = pathNext(room, p, goal, avoid) || pathNext(room, p, goal, () => false);
  return step ? steer(p, step) : out;
}
// gira hacia el punto y avanza (más despacio si aún mira hacia otro lado)
function steer(p, to) {
  const diff = angDiff(angTo(p, to), p.ang), a = Math.abs(diff);
  return { x: Math.max(-1, Math.min(1, diff * 2.5)), y: a < 0.45 ? -1 : a < 1.2 ? -0.35 : 0 };
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
  let id = goal;
  if (!(id in prev)) return null;
  while (prev[id] !== s.at && prev[id] !== null) id = prev[id];
  return Object.entries(rooms[s.at].doors).find(([, v]) => v === id)?.[0] || null;
}
// BFS por casillas: el centro de la siguiente casilla hacia alguna meta (o la meta si ya estás al lado)
function pathNext(room, p, goals, avoid) {
  const c0 = Math.floor(p.x), r0 = Math.floor(p.y), key = (c, r) => r * COLS + c;
  const isGoal = (c, r) => goals.some(([gc, gr]) => gc === c && gr === r);
  if (isGoal(c0, r0)) { const [gc, gr] = goals.find(([a, b]) => a === c0 && b === r0); return { x: gc + 0.5, y: gr + 0.5 }; }
  const parent = new Map([[key(c0, r0), null]]), q = [[c0, r0]];
  while (q.length) {
    const [c, r] = q.shift();
    for (const d of Object.values(DIRS)) {
      const nc = c + d.dx, nr = r + d.dy, kk = key(nc, nr);
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS || parent.has(kk)) continue;
      const t = tileAt(room, nc, nr), goal = isGoal(nc, nr);
      if (solidFor(room, t, 'player') || (!goal && (t === 'D' || avoid(nc, nr)))) continue;
      parent.set(kk, [c, r]);
      if (goal) {
        let cur = [nc, nr];
        while (parent.get(key(cur[0], cur[1]))[0] !== c0 || parent.get(key(cur[0], cur[1]))[1] !== r0) cur = parent.get(key(cur[0], cur[1]));
        return { x: cur[0] + 0.5, y: cur[1] + 0.5 };
      }
      q.push([nc, nr]);
    }
  }
  return null;
}
