// PECIOS: el 4.º juego de OVERDRIVE. Roguelite de acción en TIEMPO REAL, sala a sala: tu nave vuela por
// pecios y estaciones abandonadas (en 3D, con la cámara detrás) y dispara sola al enemigo más cercano.
// Módulo puro (se testea en Node): generación de plantas y salas, física sobre la cuadrícula de la sala,
// enemigos con su aviso visible, y un bot. Las posiciones van en CASILLAS (la casilla c,r ocupa
// [c, c+1) × [r, r+1)); el ángulo 0 mira "arriba" (fila 0) y crece hacia la derecha.
import { makeRng, hashString } from './rng.js';
import { genItem, applyGear, itemPower, slotFor, currentFor, CONS_KEYS, BAG_MAX } from './pecioLoot.js';

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
// SUCESOS DE PLANTA (a veces, desde la planta 2): cambian las reglas de toda la planta
export const EVENTS = {
  blackout: { icon: '🔦', name: 'APAGÓN', desc: 'solo ves lo que tienes cerca' },
  invasion: { icon: '👾', name: 'INVASIÓN', desc: 'más enemigos en cada sala, y más 🔩' },
  lowgrav: { icon: '🪐', name: 'GRAVEDAD BAJA', desc: 'derrapas más y el esquive llega más lejos' },
  gold: { icon: '💰', name: 'FIEBRE DEL ORO', desc: 'todas las 🔩 valen el doble' },
};
export const themeOf = (depth) => THEMES[Math.floor((depth - 1) / 3) % THEMES.length];

// Enemigos: siempre avisan (la torreta marca su láser, la bomba parpadea, el escudo enseña su frente)
export const ENEMY = {
  drone: { name: 'Dron', hp: 4, dmg: 1, speed: 2.3, r: 0.32, color: '#ff2bd6', piezas: 1, desc: 'te persigue y te embiste' },
  turret: { name: 'Torreta', hp: 6, dmg: 2, speed: 0, r: 0.38, color: '#00e5ff', piezas: 2, desc: 'fija: marca su láser en rojo y dispara al momento siguiente; apártate de la línea' },
  bomb: { name: 'Bomba', hp: 2, dmg: 2, speed: 2.5, r: 0.3, color: '#ff9f0a', piezas: 1, desc: 'corre hacia ti, parpadea y estalla alrededor' },
  shield: { name: 'Escudo', hp: 6, dmg: 1, speed: 1.3, r: 0.4, color: '#30d158', piezas: 2, desc: 'para los disparos de frente y gira despacio: rodéalo' },
  mimic: { name: 'Mímico', hp: 10, dmg: 2, speed: 2.7, r: 0.42, color: '#ffcc00', piezas: 6, desc: 'un cofre con dientes: muerde fuerte, pero suelta buen botín' },
  sniper: { name: 'Francotirador', hp: 5, dmg: 2, speed: 1.6, r: 0.32, color: '#7df9ff', piezas: 2, desc: 'de lejos: su mira te sigue y se fija un instante antes de disparar', from: 2 },
  summoner: { name: 'Invocador', hp: 6, dmg: 1, speed: 1.8, r: 0.34, color: '#bf5af2', piezas: 3, desc: 'huye y llama drones: a por él primero', from: 4 },
  charger: { name: 'Cargador', hp: 7, dmg: 2, speed: 1.5, r: 0.38, color: '#ff6a00', piezas: 2, desc: 'golpea el suelo y suelta una onda en anillo: sáltala con 💨', from: 3 },
  roller: { name: 'Mina rodante', hp: 3, dmg: 2, speed: 2.4, r: 0.28, color: '#ff2d55', piezas: 1, desc: 'rueda pegada a las paredes y estalla al tocarte', from: 2 },
  node: { name: 'Nodo médico', hp: 7, dmg: 1, speed: 2.8, r: 0.27, color: '#7dffb0', piezas: 1, desc: 'gira alrededor de la reina del Enjambre y la cura' },
  boss: { name: 'Jefe', hp: 0, dmg: 2, speed: 1.1, r: 0.85, color: '#ff2d55', piezas: 0, desc: 'cada 3 plantas, en la sala de la salida', boss: true },
};

// JEFES: uno cada 3 plantas, en la sala de la salida (la escotilla aparece al vencerlo). Por fases: a la mitad
// de vida cambian. En el modo sin fin vuelven, cada vuelta más duros.
export const BOSSES = {
  guardian: { name: 'GUARDIÁN DE CARGA', hp: 60, r: 0.85, color: '#ff9f0a', piezas: 40, tip: 'marca una franja y embiste: apártate y, si se estrella contra la pared, recibe el doble' },
  swarm: { name: 'ENJAMBRE MÉDICO', hp: 55, r: 0.6, color: '#30d158', piezas: 40, tip: 'sus nodos la curan: acaba con ellos primero (a la mitad, se divide)' },
  core: { name: 'NÚCLEO DEL REACTOR', hp: 90, r: 0.95, color: '#ff2d55', piezas: 50, tip: 'marca casillas en rojo y luego arden: sal de ellas (a la mitad, electrifica el suelo)' },
};
export const BOSS_ORDER = ['guardian', 'swarm', 'core'];
export const isBossFloor = (depth) => depth % 3 === 0;
BOSSES.excavator = { name: 'EXCAVADORA', hp: 85, r: 0.8, color: '#c8743a', piezas: 55, tip: 'se hunde y sale debajo de ti: aléjate de las casillas marcadas; al salir queda aturdida' };
BOSSES.phantom = { name: 'FANTASMA DE LA ESTACIÓN', hp: 70, r: 0.6, color: '#bfe9ff', piezas: 55, tip: 'invisible: solo se ve su sombra y cuando ataca (ahí es vulnerable)' };
BOSSES.fusion = { name: 'FUSIÓN', hp: 55, r: 0.75, color: '#ffe600', piezas: 60, tip: 'dos núcleos: si cae uno y el otro sigue entero, revive. Tumba los dos casi a la vez' };
export const BOSS_ALT = ['excavator', 'phantom', 'fusion'];
// planta 3, 6, 9: los de siempre; en el sin fin, cada vuelta alterna con los nuevos de su ambiente
export const bossOf = (depth) => {
  const i = (depth / 3 - 1) % BOSS_ORDER.length, lap = Math.floor((depth / 3 - 1) / BOSS_ORDER.length);
  return lap % 2 === 1 ? BOSS_ALT[i] : BOSS_ORDER[i];
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
  hidden: { icon: '💎', name: 'Sala oculta' },
  boss: { icon: '💀', name: 'Jefe' },
  waves: { icon: '🌊', name: 'Oleadas' },
  challenge: { icon: '⏱️', name: 'Desafío' },
  maze: { icon: '🌀', name: 'Laberinto' },
};
// salas que se cierran hasta limpiarlas
const LOCKS = new Set(['combat', 'exit', 'boss', 'waves', 'challenge']);

// Losas: . suelo · # pared · P pozo (si caes, daño y vuelves a la puerta; el ESQUIVE lo salta) · M mina
// · E suelo eléctrico (a ratos) · D puerta · C cofre (con llave) · T terminal de la tienda · A altar · X escotilla
// · K pared agrietada (una puerta oculta: se rompe con el esquive) · S interruptor (apaga el suelo eléctrico) · s apagado
const BLOCK = new Set(['#', 'C', 'T', 'A', 'K']); // macizo para todos (y tapa la vista)
const SIGHT = new Set(['#', 'C', 'T', 'A', 'D', 'K']);
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
  rooms[exit].type = isBossFloor(depth) ? 'boss' : 'exit'; // cada 3 plantas, la salida la guarda un jefe
  const rest = rng.shuffle(ids.filter((id) => id !== '2,2' && id !== exit));
  const specials = ['treasure', 'traps'];
  if (depth >= 2) specials.push('shop');
  if (rng.chance(0.5)) specials.push('shrine');
  // salas especiales, más cuanto más hondo
  if (depth >= 2 && rng.chance(0.5)) specials.push('waves');
  if (depth >= 3 && rng.chance(0.45)) specials.push('challenge');
  if (rng.chance(0.4)) specials.push('maze');
  // el tesoro, siempre; las demás especiales, en orden al azar (si no, las últimas de la lista casi nunca salían).
  // Siempre quedan al menos 2 salas de combate.
  const order = [specials[0], ...rng.shuffle(specials.slice(1))];
  for (const t of order) if (rest.length > 2) rooms[rest.shift()].type = t;
  // SALA OCULTA: pegada a una sala normal, tras una pared agrietada (no cuenta para el camino a la salida)
  if (rng.chance(Math.min(0.85, 0.45 + depth * 0.05))) {
    const hosts = rng.shuffle(ids.filter((id) => id !== exit));
    let done = false;
    for (const hid of hosts) {
      if (done) break;
      const h = rooms[hid];
      for (const k of rng.shuffle([...DIR_KEYS])) {
        const x = h.x + DIRS[k].dx, y = h.y + DIRS[k].dy, nid = `${x},${y}`;
        if (x < 0 || y < 0 || x > 4 || y > 4 || rooms[nid]) continue;
        rooms[nid] = { id: nid, x, y, doors: { [OPP[k]]: hid }, type: 'hidden', hidden: true };
        h.doors[k] = nid;
        h.secret = k; // la puerta que da a la oculta empieza como pared agrietada
        done = true;
        break;
      }
    }
  }
  const event = depth >= 2 && rng.chance(0.35) ? rng.pick(Object.keys(EVENTS)) : null;
  return { seed, depth, theme: themeOf(depth), rooms, start: '2,2', exit, event };
}

export const DOOR_TILE = { up: [MID_C, 0], down: [MID_C, ROWS - 1], left: [0, MID_R], right: [COLS - 1, MID_R] };

// Una sala: losas y enemigos. La cruz central (fila MID_R y columna MID_C) siempre queda libre: así
// todas las puertas se comunican siempre, haya lo que haya en la sala.
export function genRoom(floor, id) {
  const room = floor.rooms[id], depth = floor.depth;
  const rng = makeRng(hashString(`room-${floor.seed}-${depth}-${id}`));
  const t = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (__, c) => (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 ? '#' : '.')));
  for (const k of Object.keys(room.doors)) {
    const [c, r] = DOOR_TILE[k];
    t[r][c] = room.secret === k && !room.secretOpen ? 'K' : 'D';
  }
  const onCross = (c, r) => c === MID_C || r === MID_R;
  const free = () => {
    for (let i = 0; i < 80; i++) {
      const c = rng.int(1, COLS - 2), r = rng.int(1, ROWS - 2);
      if (t[r][c] === '.' && !onCross(c, r)) return [c, r];
    }
    return null;
  };
  const type = room.type;
  let mazeKey = null;
  if (type === 'combat' || type === 'exit') {
    for (let i = 0, n = rng.int(2, 5); i < n; i++) { const p = free(); if (p) t[p[1]][p[0]] = rng.chance(0.6) ? '#' : 'P'; }
  }
  if (type === 'traps') {
    for (let i = 0, n = 5 + Math.min(4, depth); i < n; i++) { const p = free(); if (p) t[p[1]][p[0]] = 'M'; }
    for (let i = 0, n = 4 + depth; i < n; i++) { const p = free(); if (p) t[p[1]][p[0]] = rng.chance(0.3) ? 'P' : 'E'; }
  }
  if (type === 'maze') {
    for (let r = 2; r < ROWS - 2; r += 2) for (let c = 1; c < COLS - 1; c++) if (!onCross(c, r) && rng.chance(0.62)) t[r][c] = '#';
    for (let c = 2; c < COLS - 2; c += 2) for (let r = 1; r < ROWS - 1; r++) if (!onCross(c, r) && t[r][c] === '.' && rng.chance(0.3)) t[r][c] = '#';
    // lo que haya quedado aislado se tapia: en el laberinto todo se puede alcanzar desde la cruz
    const seen = new Set([`${MID_C},${MID_R}`]), q = [[MID_C, MID_R]];
    while (q.length) {
      const [c, r] = q.shift();
      for (const d of Object.values(DIRS)) {
        const nc = c + d.dx, nr = r + d.dy, k = `${nc},${nr}`;
        if (nc < 1 || nr < 1 || nc > COLS - 2 || nr > ROWS - 2 || seen.has(k) || t[nr][nc] === '#') continue;
        seen.add(k);
        q.push([nc, nr]);
      }
    }
    for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) if (t[r][c] === '.' && !seen.has(`${c},${r}`)) t[r][c] = '#';
    // la llave, en la casilla alcanzable más lejana del centro
    let far = -1;
    for (const k of seen) { const [c, r] = k.split(',').map(Number), d = Math.abs(c - MID_C) + Math.abs(r - MID_R); if (d > far && !onCross(c, r)) { far = d; mazeKey = [c, r]; } }
  }
  if (type === 'traps') { const p = free(); if (p) t[p[1]][p[0]] = 'S'; } // el interruptor que apaga el suelo eléctrico
  if (type === 'treasure' || type === 'hidden') t[2][2] = 'C';
  if (type === 'shop') t[2][2] = 'T';
  if (type === 'shrine') t[2][COLS - 3] = 'A';
  if (type === 'exit') t[MID_R][MID_C] = 'X';
  // enemigos (lejos de las puertas: al entrar nunca te tocan de golpe)
  const enemies = [];
  if (type === 'boss') {
    const kind = bossOf(depth), B = BOSSES[kind], loop = Math.floor((depth - 1) / 9);
    const hp = Math.round(B.hp * (1 + 0.45 * loop + 0.08 * (depth - 3)));
    const pos = kind === 'core' ? { x: MID_C + 0.5, y: MID_R - 0.5 } : kind === 'fusion' ? { x: 2.5, y: 3.5 } : { x: MID_C + 0.5, y: 3 };
    const foes = [{ id: `${id}-boss`, kind: 'boss', boss: kind, x: pos.x, y: pos.y, ang: Math.PI, hp, max: hp, r: B.r, cd: 2, charge: 0, aim: null, fuse: null, stun: 0, hitT: 0, alive: true, dashT: 0, phase: 1 }];
    if (kind === 'fusion') { foes.push({ ...foes[0], id: `${id}-boss2`, x: COLS - 2.5, cd: 3.2 }); foes[0].twin = foes[1].id; foes[1].twin = foes[0].id; }
    if (kind === 'swarm') for (let i = 0; i < 4; i++) foes.push(swarmNode(`${id}-n${i}`, foes[0], (i / 4) * Math.PI * 2, depth));
    return { id, type, tiles: t, enemies: foes, cleared: false, opened: false, used: false, wake: 0, flow: null, flowT: 0, mimic: false, freeChest: false, pickups: [], powerOff: false, ambush: false, stock: null, marks: [], markT: 0 };
  }
  const nE = type === 'combat' ? Math.min(6, 2 + Math.floor(depth / 2) + rng.int(0, 1)) : type === 'exit' ? Math.min(5, 2 + Math.floor(depth / 3))
    : type === 'waves' ? 3 : type === 'challenge' ? Math.min(6, 3 + Math.floor(depth / 3)) : type === 'maze' ? 2 + Math.floor(depth / 4) : 0;
  enemies.push(...placeFoes(rng, t, floor.theme, depth, nE + (floor.event === 'invasion' && nE ? 2 : 0), id, null));
  const extra = {};
  if (type === 'waves') extra.waves = [3 + Math.floor(depth / 3), 4 + Math.floor(depth / 3)]; // las dos oleadas que faltan
  if (type === 'challenge') extra.timer = 15 + depth;
  if (type === 'maze' && mazeKey) extra.keyAt = mazeKey;
  // MÍMICO: algunos cofres de tesoro muerden (cuanto más hondo, más). El de la sala oculta nunca, y se abre sin llave
  const mimic = type === 'treasure' && rng.chance(Math.min(0.4, 0.12 + depth * 0.03));
  // en la sala oculta, además, algo de la mochila en el suelo
  const pickups = type === 'hidden' ? [{ id: `${id}-p0`, kind: 'cons', cons: rng.pick(CONS_KEYS), x: COLS - 2.5, y: ROWS - 3.5 }] : [];
  // laberinto: la llave, en un rincón del fondo (se deja libre su casilla)
  if (extra.keyAt) { const [kc, kr] = extra.keyAt; pickups.push({ id: `${id}-key`, kind: 'key', x: kc + 0.5, y: kr + 0.5 }); }
  return { id, type, tiles: t, enemies, cleared: !enemies.length, opened: false, used: false, wake: 0, flow: null, flowT: 0, mimic, freeChest: type === 'hidden', pickups, powerOff: false, ambush: false, stock: null, ...extra };
}

export const ELITE = {
  fast: { icon: '⚡', name: 'Rápido' },
  armored: { icon: '🛡️', name: 'Blindado' },
  regen: { icon: '✚', name: 'Regenerador' },
  explosive: { icon: '💥', name: 'Explosivo' },
};
export function makeElite(e, trait) {
  e.elite = trait;
  e.speedMul = trait === 'fast' ? 1.5 : 1;
  if (trait === 'armored') { e.hp *= 2; e.max *= 2; }
  e.r *= 1.12;
}

// N enemigos en casillas libres, lejos de las puertas (y de `avoid`, p. ej. el jugador). Los nuevos solo a partir de su planta.
function placeFoes(rng, t, theme, depth, n, id, avoid) {
  const out = [];
  const mix = Object.entries(theme.mix).map(([k, w]) => ({ k, w }));
  for (const [k, E] of Object.entries(ENEMY)) if (E.from && depth >= E.from) mix.push({ k, w: 1 + Math.min(2, (depth - E.from) * 0.3) });
  for (let i = 0; i < n; i++) {
    let p = null;
    for (let j = 0; j < 80 && !p; j++) {
      const c = rng.int(1, COLS - 2), r = rng.int(2, ROWS - 3);
      const nearDoor = Object.values(DOOR_TILE).some(([dc, dr]) => Math.abs(dc - c) + Math.abs(dr - r) < 3);
      const nearAvoid = avoid && Math.hypot(c + 0.5 - avoid.x, r + 0.5 - avoid.y) < 3;
      if (t[r][c] === '.' && !nearDoor && !nearAvoid && !out.some((e) => Math.floor(e.x) === c && Math.floor(e.y) === r) && !(c === MID_C && r === MID_R)) p = [c, r];
    }
    if (!p) continue;
    const kind = rng.weighted(mix).k, E = ENEMY[kind];
    const hp = E.hp + Math.floor((depth - 1) * 1.45); // más vida cuanto más hondo (tu equipo también crece)
    const e = { id: `${id}-${i}`, kind, x: p[0] + 0.5, y: p[1] + 0.5, ang: Math.PI, hp, max: hp, r: E.r, cd: rng.range(0.4, 1.4), charge: 0, aim: null, fuse: null, stun: 0, hitT: 0, alive: true, dir: rng.int(0, 3) };
    // ÉLITE: nombre dorado y un rasgo (más botín)
    if (depth >= 2 && rng.chance(Math.min(0.22, 0.04 + depth * 0.02))) makeElite(e, rng.pick(Object.keys(ELITE)));
    out.push(e);
  }
  return out;
}

// ---------- Partida ----------
// ship = { hp, ability } (de la nave del hangar)
export function newRun(seed, ship = {}) {
  const floor = genFloor(seed, 1);
  const s = {
    luck: ship.luck || 0, endless: false, choice: null, bosses: 0,
    seed, depth: 1, floor, rooms: {}, at: floor.start, time: 0, over: false, won: false,
    rng: makeRng(hashString(`run-${seed}`)),
    player: {
      x: MID_C + 0.5, y: MID_R + 0.5, ang: 0, r: 0.3, hp: ship.hp || 6, max: ship.hp || 6, baseMax: ship.hp || 6, bonusMax: 0, bonusDmg: ship.bonusDmg || 0, dmg: 2, rate: 2.4, fireCd: 0.5, range: 8,
      ability: ship.ability || 'nova', abCd: 0, abMax: 10, dashCd: 0, dashMax: 1.1, dashT: 0, keys: ship.keys || 0, piezas: 0, shield: 0, inv: 0, boost: 0, ram: 0, speed: 3.4, vel: 0,
      gear: { weapon: null, plating: null, mod1: null, mod2: null }, bag: { kit: 0, emp: 0, warp: 0, ...(ship.bag || {}) }, bagMax: ship.bagMax || BAG_MAX, killsLeech: 0,
    },
    entry: { x: MID_C + 0.5, y: MID_R + 0.5, ang: 0 },
    shots: [], visited: [floor.start], kills: 0, roomsCleared: 0, touch: null, offer: null, found: 0, best: null,
  };
  // lo que traigas de la bóveda (un objeto guardado de la partida anterior) ya va puesto
  for (const it of ship.gear || []) s.player.gear[slotFor(s.player, it)] = it;
  applyGear(s.player);
  s.player.hp = s.player.max;
  s.rooms[floor.start] = genRoom(floor, floor.start);
  return s;
}
export const roomOf = (s, id = s.at) => (s.rooms[id] ||= genRoom(s.floor, id));
export const tileAt = (room, c, r) => (c < 0 || r < 0 || c >= COLS || r >= ROWS ? '#' : room.tiles[r][c]);
export const locked = (room) => (LOCKS.has(room.type) || room.ambush) && room.enemies.some((e) => e.alive);
// 🔩 que te llevas si caes: más cuanto más hondo llegaste (si sales, todas)
export const keptPiezas = (s) => (s.won || s.endless ? s.player.piezas : Math.floor(s.player.piezas * Math.min(1, 0.5 + 0.1 * (s.depth - 1))));
export const energyOn = (s, room = null) => !room?.powerOff && s.time % 4 < 2.4; // el suelo eléctrico se enciende a ratos (si nadie lo ha apagado)
// puertas de una sala que se pueden usar (la de la sala oculta no existe hasta que rompes la pared)
export const openDoors = (s, id) => {
  const r = s.floor.rooms[id], out = {};
  for (const [k, v] of Object.entries(r.doors)) if (!(r.secret === k && !r.secretOpen)) out[k] = v;
  return out;
};
// 🔩 que ganas (con el Imán y el Escáner, algo más)
export function gainPiezas(s, n) {
  const m = s.player.mods || {};
  const ev = s.floor?.event, mul = ev === 'gold' ? 2 : ev === 'invasion' ? 1.5 : 1;
  const g = Math.max(1, Math.round(n * mul * (1 + ((m.magnet || 0) + (m.scanner || 0)) / 100)));
  s.player.piezas += g;
  s.found += g;
  return g;
}
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
  surge: { name: 'Estela', desc: 'acelerón largo e intocable: 4 de daño a lo que atravieses' },
  quake: { name: 'Terremoto', desc: '2 de daño y aturde 1,5 s a todo lo cercano' },
  salvage: { name: 'Desguace', desc: 'trae a tus pies todo lo del suelo y aturde a los cercanos' },
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
    if (d < bd && !e.hidden && canSee(room, p, e)) { bd = d; best = e; }
  }
  return best;
}

// ---------- Un paso de simulación ----------
// input = { x: giro (-1 izquierda … 1 derecha), y: avance (-1 adelante … 1 atrás) }. Devuelve eventos
// para el sonido y los efectos.
export function updateRun(s, dt, input = { x: 0, y: 0 }) {
  if (s.over || s.offer || s.choice) return []; // con un objeto en la mano (o eligiendo en la planta 9), la partida espera
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
    breakCrack(s, room, p, p.r + 0.15, ev); // embestir una pared agrietada la rompe
    if (p.dashT <= 0) { p.ram = 0; for (const e of room.enemies) e.rammed = false; }
  } else {
    p.ang += Math.max(-1, Math.min(1, input.x || 0)) * 3.4 * dt;
    const want = -Math.max(-1, Math.min(1, input.y || 0)) * (input.y > 0 ? 0.5 : 1);
    p.vel += (want - p.vel) * Math.min(1, dt * (s.floor.event === 'lowgrav' ? 2.5 : 10)); // gravedad baja: derrapas
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
      // apunta ADELANTADO a lo que se mueve (si no, lo rápido se escapa siempre de las balas)
      const lead = d2(p, t) / 13;
      const ahead = { x: t.x + (t.vx || 0) * lead, y: t.y + (t.vy || 0) * lead };
      const a = angTo(p, canSee(room, p, ahead) ? ahead : t); // si el punto adelantado queda tras una pared, directo a él
      for (const da of p.weapon === 'spread' ? [-0.22, 0, 0.22] : [0]) {
        const f = fwd(a + da);
        s.shots.push({ x: p.x + f.x * 0.35, y: p.y + f.y * 0.35, vx: f.x * 13, vy: f.y * 13, dmg: p.dmg, life: 1.2, pierce: p.weapon === 'pierce', blast: p.weapon === 'blast', bounces: p.bounces || 0, hit: [] });
      }
      p.fireCd = 1 / (p.rate * (p.boost > 0 ? 2 : 1));
      ev.push({ type: 'fire' });
    } else p.fireCd = 0;
  }
  updateShots(s, room, dt, ev);
  if (room.wake <= 0) updateEnemies(s, room, dt, ev);
  // DESAFÍO: el reloj corre desde que entras; si se acaba antes de limpiarla, adiós premio
  if (room.type === 'challenge' && !room.cleared && room.timer > 0 && room.wake <= 0) {
    room.timer -= dt;
    if (room.timer <= 0) { room.timer = 0; ev.push({ type: 'challengeFail' }); }
  }
  // OLEADAS: al caer una, llega la siguiente (lejos de ti)
  if (!room.cleared && room.waves?.length && !room.enemies.some((e) => e.alive)) {
    const n = room.waves.shift();
    room.enemies.push(...placeFoes(s.rng, room.tiles, s.floor.theme, s.depth, n, `${room.id}-w${room.waves.length}`, p));
    room.wake = 0.8;
    room.flow = null;
    ev.push({ type: 'wave', left: room.waves.length });
  }
  // ¿sala limpia?
  if (!room.cleared && !room.enemies.some((e) => e.alive)) {
    if (room.type === 'waves') { room.pickups.push({ id: `${room.id}-rw`, kind: 'item', item: genItem(s.rng, s.depth, { bonus: 1 }), x: MID_C + 0.5, y: MID_R + 0.5 }); ev.push({ type: 'reward', what: 'waves' }); }
    if (room.type === 'challenge' && room.timer > 0) { room.pickups.push({ id: `${room.id}-rc`, kind: 'item', item: genItem(s.rng, s.depth, { bonus: 2, minTier: 1 }), x: MID_C + 0.5, y: MID_R + 0.5 }); ev.push({ type: 'reward', what: 'challenge' }); }
    room.cleared = true;
    s.roomsCleared++;
    p.hp = Math.min(p.max, p.hp + 1); // los drones de reparación de la sala te arreglan un poco
    ev.push({ type: 'cleared' });
    if (s.rng.chance(0.4 + (p.mods?.keyring || 0) / 100)) { p.keys++; ev.push({ type: 'key' }); }
  }
  return ev;
}

// rompe la pared agrietada que toques (dentro de `reach`): aparece la puerta a la sala oculta
function breakCrack(s, room, at, reach, ev) {
  for (const k of DIR_KEYS) {
    const [c, r] = DOOR_TILE[k];
    if (tileAt(room, c, r) !== 'K') continue;
    const nx = Math.max(c, Math.min(at.x, c + 1)), ny = Math.max(r, Math.min(at.y, r + 1));
    if (Math.hypot(at.x - nx, at.y - ny) > reach) continue;
    room.tiles[r][c] = 'D';
    s.floor.rooms[s.at].secretOpen = true;
    ev.push({ type: 'secret', x: c + 0.5, y: r + 0.5 });
  }
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
  } else if (t === 'E' && energyOn(s, room) && p.dashT <= 0) hurt(s, 1, ev, 'electricidad');
  else if (t === 'S' && Math.hypot(p.x - c - 0.5, p.y - r - 0.5) < 0.5) { room.tiles[r][c] = 's'; room.powerOff = true; ev.push({ type: 'switch' }); }
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
  // RECOGIDAS: objetos (eliges si te lo pones) y consumibles (a la mochila)
  for (const pk of room.pickups) {
    const d = Math.hypot(p.x - pk.x, p.y - pk.y);
    if (pk.cool) { if (d > 0.9) pk.cool = false; continue; }
    if (d > 0.65) continue;
    if (pk.kind === 'item') { s.offer = { item: pk.item, pk }; ev.push({ type: 'offer' }); return true; }
    if (pk.kind === 'key') { p.keys++; room.pickups = room.pickups.filter((x) => x !== pk); ev.push({ type: 'key' }); return false; }
    if (p.bag[pk.cons] >= p.bagMax) { pk.cool = true; ev.push({ type: 'bagFull', cons: pk.cons }); continue; }
    p.bag[pk.cons]++;
    room.pickups = room.pickups.filter((x) => x !== pk);
    ev.push({ type: 'pickup', cons: pk.cons });
    return false;
  }
  for (let c = c0 - 1; c <= c0 + 1; c++) {
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      const t = tileAt(room, c, r);
      if (!['C', 'T', 'A', 'D', 'K'].includes(t) || Math.hypot(p.x - c - 0.5, p.y - r - 0.5) > 0.95) continue;
      if (t === 'D' && !locked(room)) continue; // una puerta abierta no se queja (se cruza)
      if (s.touch) return false;
      s.touch = { x: c + 0.5, y: r + 0.5 };
      if (t === 'D') ev.push({ type: 'locked' });
      else if (t === 'K') ev.push({ type: 'crack' });
      else if (t === 'C') {
        if (room.opened) ev.push({ type: 'empty' });
        else if (room.mimic) {
          // ¡MÍMICO! El cofre despierta y muerde: la sala se cierra hasta que lo venzas
          room.mimic = false;
          room.opened = true;
          room.tiles[r][c] = '.';
          const hp = ENEMY.mimic.hp + 3 * Math.floor((s.depth - 1) / 3);
          room.enemies.push({ id: `${room.id}-mimic`, kind: 'mimic', x: c + 0.5, y: r + 0.5, ang: angTo({ x: c + 0.5, y: r + 0.5 }, p), hp, max: hp, r: ENEMY.mimic.r, cd: 0.8, charge: 0, aim: null, fuse: null, stun: 0, hitT: 0, alive: true });
          room.ambush = true;
          room.cleared = false;
          room.flow = null;
          ev.push({ type: 'mimic', x: c + 0.5, y: r + 0.5 });
          return true;
        } else if (!room.freeChest && p.keys < 1) ev.push({ type: 'needKey' });
        else {
          if (!room.freeChest) p.keys--;
          room.opened = true;
          const gain = gainPiezas(s, 5 + s.depth * 2);
          p.hp = Math.min(p.max, p.hp + 1);
          ev.push({ type: 'chest', piezas: gain });
          // y un objeto (los cofres dan mejor botín)
          s.offer = { item: genItem(s.rng, s.depth, { bonus: (room.freeChest ? 2 : 1) + (s.luck >= 3 ? 1 : 0) }), pk: null };
          ev.push({ type: 'offer' });
          return true;
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
      if (blocksSight(tileAt(room, Math.floor(b.x), Math.floor(b.y)))) {
        // REBOTE: vuelve por el eje con el que chocó
        if (b.bounces > 0) {
          const px = b.x - (b.vx * dt) / n, py = b.y - (b.vy * dt) / n;
          if (blocksSight(tileAt(room, Math.floor(b.x), Math.floor(py)))) b.vx = -b.vx;
          if (blocksSight(tileAt(room, Math.floor(px), Math.floor(b.y)))) b.vy = -b.vy;
          b.x = px; b.y = py; b.bounces--; b.hit = [];
          continue;
        }
        b.life = 0; ev.push({ type: 'spark', x: b.x, y: b.y }); break;
      }
      const e = room.enemies.find((o) => o.alive && !o.hidden && !b.hit.includes(o.id) && Math.hypot(o.x - b.x, o.y - b.y) < o.r + 0.08);
      if (!e) continue;
      if (b.pierce) b.hit.push(e.id); else b.life = 0; // PERFORADOR: sigue su camino
      // ESCUDO: lo que le llega de frente rebota
      const f = fwd(e.ang), sp = Math.hypot(b.vx, b.vy) || 1;
      if (e.kind === 'shield' && (b.vx * f.x + b.vy * f.y) / sp < -0.35) { ev.push({ type: 'blocked', id: e.id, x: b.x, y: b.y }); b.life = 0; }
      else {
        hitEnemy(s, room, e, b.dmg, ev);
        // ESTALLIDO: también a los de alrededor
        if (b.blast) {
          ev.push({ type: 'boom', x: e.x, y: e.y, r: 0.9, mine: true });
          for (const o of room.enemies) if (o.alive && o !== e && d2(o, e) < 0.9 + o.r) hitEnemy(s, room, o, Math.ceil(b.dmg / 2), ev);
        }
      }
    }
    b.life -= dt;
  }
  s.shots = s.shots.filter((b) => b.life > 0);
}

function hitEnemy(s, room, e, dmg, ev) {
  if (!e.alive) return;
  if (e.kind === 'boss' && e.boss === 'guardian' && e.stun > 0) dmg *= 2; // estrellado contra la pared: vulnerable
  if (e.hidden) return;
  e.hp -= dmg;
  e.hitT = 0.12;
  ev.push({ type: 'hit', id: e.id, dmg, x: e.x, y: e.y });
  if (e.hp > 0) return;
  e.alive = false;
  if (e.boss === 'fusion') {
    const twin = room.enemies.find((o) => o.id === e.twin);
    if (twin && twin.alive) { e.downT = 4; ev.push({ type: 'fusionDown' }); return; } // revive si su gemelo no cae a tiempo
    for (const o of room.enemies) if (o.boss === 'fusion') o.downT = 0;
  }
  s.kills++;
  const gain = gainPiezas(s, ENEMY[e.kind].piezas + Math.floor(s.depth / 3));
  ev.push({ type: 'kill', id: e.id, kind: e.kind, piezas: gain, x: e.x, y: e.y });
  const p = s.player;
  // SANGUIJUELA: cada N bajas, +1 ❤️
  if (p.mods?.leech) { p.killsLeech++; if (p.killsLeech >= p.mods.leech) { p.killsLeech = 0; if (p.hp < p.max) { p.hp++; ev.push({ type: 'leech' }); } } }
  // BOTÍN: el mímico siempre suelta un objeto bueno; los demás, a veces un objeto o algo para la mochila
  const drop = (pk) => { const at = safeSpot(room, e); room.pickups.push({ id: `${e.id}-d`, ...at, ...pk }); ev.push({ type: 'drop', kind: pk.kind, ...at }); };
  if (e.kind === 'boss') {
    // JEFE VENCIDO: botín épico o mejor, sus 🔩, y la escotilla para bajar (los nodos caen con su reina)
    for (const o of room.enemies) if (o.kind === 'node') o.alive = false;
    room.tiles[MID_R][MID_C] = 'X';
    s.bosses++;
    gainPiezas(s, BOSSES[e.boss].piezas);
    drop({ kind: 'item', item: genItem(s.rng, s.depth, { bonus: 2, minTier: 2 }) });
    ev.push({ type: 'bossDown', boss: e.boss, name: BOSSES[e.boss].name });
  } else if (e.kind === 'mimic') drop({ kind: 'item', item: genItem(s.rng, s.depth, { bonus: 2, minTier: 1 }) });
  else if (e.kind === 'node') { /* los nodos no sueltan nada */ } else if (e.elite && s.rng.chance(0.4)) drop({ kind: 'item', item: genItem(s.rng, s.depth, { bonus: 1 }) });
  else if (s.rng.chance(0.05 + 0.02 * s.luck)) drop({ kind: 'item', item: genItem(s.rng, s.depth, { bonus: s.luck >= 2 ? 1 : 0 }) });
  else if (s.rng.chance(0.07)) drop({ kind: 'cons', cons: s.rng.pick(CONS_KEYS) });
  if (e.elite) gainPiezas(s, ENEMY[e.kind].piezas + 2);
  if (e.elite === 'explosive') { // al morir, estalla alrededor
    ev.push({ type: 'boom', x: e.x, y: e.y, r: 1.6 });
    if (d2(e, s.player) < 1.6) hurt(s, 2, ev, 'élite explosivo');
  }
  if (e.kind === 'bomb' && e.fuse !== null) explode(s, room, e, ev);
}

// donde se puede dejar algo en el suelo: si cae en un pozo, una mina o suelo eléctrico, a la casilla segura más cercana
function safeSpot(room, at) {
  const ok = (c, r) => tileAt(room, c, r) === '.';
  const c0 = Math.floor(at.x), r0 = Math.floor(at.y);
  if (ok(c0, r0)) return { x: at.x, y: at.y };
  let best = null;
  for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) {
    if (!ok(c, r)) continue;
    const d = Math.hypot(c + 0.5 - at.x, r + 0.5 - at.y);
    if (!best || d < best.d) best = { d, x: c + 0.5, y: r + 0.5 };
  }
  return best ? { x: best.x, y: best.y } : { x: MID_C + 0.5, y: MID_R + 0.5 };
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
  // casillas marcadas por el Núcleo: arden al acabar el aviso
  if (room.markT > 0) {
    room.markT -= dt;
    if (room.markT <= 0) {
      const pc = Math.floor(p.x), pr = Math.floor(p.y);
      ev.push({ type: 'pulse', marks: room.marks });
      if (room.marks.some(([c, r]) => c === pc && r === pr)) hurt(s, 2, ev, 'núcleo');
      room.marks = [];
    }
  }
  room.flowT -= dt;
  if (!room.flow || room.flowT <= 0) { room.flow = flowField(room, p); room.flowT = 0.3; }
  for (const e of room.enemies) {
    e.px = e.x; e.py = e.y;
    if (e.alive && e.elite === 'regen') e.hp = Math.min(e.max, e.hp + 0.6 * dt);
    // FUSIÓN: el núcleo apagado vuelve si su gemelo aguanta
    if (!e.alive && e.downT > 0) {
      e.downT -= dt;
      if (e.downT <= 0) { e.alive = true; e.hp = Math.round(e.max * 0.5); ev.push({ type: 'fusionUp', x: e.x, y: e.y }); }
    }
  }
  for (const e of room.enemies) {
    if (!e.alive || s.over) continue;
    e.hitT = Math.max(0, e.hitT - dt);
    if (e.stun > 0) { e.stun -= dt; continue; }
    e.cd -= dt;
    const E = ENEMY[e.kind], dist = d2(e, p);
    if (e.kind === 'boss') { updateBoss(s, room, e, dt, ev); continue; }
    if (e.kind === 'sniper' || e.kind === 'summoner' || e.kind === 'charger' || e.kind === 'roller') { updateNewFoe(s, room, e, dt, ev, dist); continue; }
    if (e.kind === 'node') { updateNode(s, room, e, dt, ev); continue; }
    if (e.kind === 'drone' || e.kind === 'shield' || e.kind === 'mimic') {
      const want = chaseDir(room, e, p);
      // el escudo gira despacio: por eso se le puede rodear
      e.ang += Math.max(-1, Math.min(1, angDiff(want, e.ang) / 0.2)) * (e.kind === 'shield' ? 1.3 : 6) * dt;
      const f = fwd(e.kind === 'shield' ? e.ang : want);
      if (dist > p.r + e.r + 0.05) moveCircle(room, e, f.x * E.speed * (e.speedMul || 1) * dt, f.y * E.speed * (e.speedMul || 1) * dt, 'enemy');
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
        moveCircle(room, e, f.x * E.speed * (e.speedMul || 1) * dt, f.y * E.speed * (e.speedMul || 1) * dt, 'enemy');
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
  // su velocidad (para que tu disparo automático los adelante)
  for (const e of room.enemies) if (e.alive && dt > 0) { e.vx = (e.x - e.px) / dt; e.vy = (e.y - e.py) / dt; }
  // que no se apilen
  const live = room.enemies.filter((e) => e.alive && e.kind !== 'turret');
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j], d = d2(a, b), m = a.r + b.r;
      if (d > 0 && d < m) { const k = (m - d) / 2 / d; moveCircle(room, a, (a.x - b.x) * k, (a.y - b.y) * k, 'enemy'); moveCircle(room, b, (b.x - a.x) * k, (b.y - a.y) * k, 'enemy'); }
    }
  }
}

// ---------- Jefes ----------
function swarmNode(id, queen, a, depth) {
  const hp = ENEMY.node.hp + Math.floor(depth / 3);
  return { id, kind: 'node', queen: queen.id, orbit: a, x: queen.x + Math.cos(a) * 1.5, y: queen.y + Math.sin(a) * 1.5, ang: 0, hp, max: hp, r: ENEMY.node.r, cd: 0.6, charge: 0, aim: null, fuse: null, stun: 0, hitT: 0, alive: true };
}
// un enemigo de apoyo que llama el jefe (como mucho 3 a la vez)
function summon(s, room, kind, x, y) {
  if (room.enemies.filter((o) => o.alive && o.kind === kind).length >= 3) return;
  const E = ENEMY[kind];
  for (let i = 0; i < 8; i++) {
    const a = s.rng.next() * Math.PI * 2, nx = x + Math.cos(a) * 1.4, ny = y + Math.sin(a) * 1.4;
    if (hitsWall(room, nx, ny, E.r, 'enemy')) continue;
    room.enemies.push({ id: `${room.id}-s${room.enemies.length}`, kind, x: nx, y: ny, ang: 0, hp: E.hp, max: E.hp, r: E.r, cd: 0.8, charge: 0, aim: null, fuse: null, stun: 0, hitT: 0, alive: true });
    return;
  }
}
// cerca del jugador: golpe de contacto (con su pausa)
function touchHurt(s, e, dmg, ev) {
  const p = s.player;
  if (d2(e, p) < p.r + e.r + 0.08 && e.cd <= 0) { hurt(s, dmg, ev, e.kind === 'boss' ? e.boss : e.kind); e.cd = 1; ev.push({ type: 'attack', id: e.id }); }
}
function updateBoss(s, room, e, dt, ev) {
  const p = s.player, B = BOSSES[e.boss];
  if (e.phase === 1 && e.hp <= e.max / 2) { e.phase = 2; ev.push({ type: 'phase', boss: e.boss, name: B.name }); enterPhase2(s, room, e, ev); }
  const p2 = e.phase === 2;
  if (e.boss === 'guardian') {
    if (e.dashT > 0) {
      // EMBESTIDA por la franja marcada: si se estrella contra la pared, se queda aturdido (y recibe el doble)
      e.dashT -= dt;
      const f = fwd(e.aim);
      const hit = moveCircle(room, e, f.x * 8.5 * dt, f.y * 8.5 * dt, 'enemy');
      if (!e.hitP && d2(e, p) < p.r + e.r + 0.1) { e.hitP = true; hurt(s, 2, ev, 'guardian'); }
      if (hit || e.dashT <= 0) {
        e.dashT = 0;
        if (hit) { e.stun = 2.2; ev.push({ type: 'boom', x: e.x, y: e.y, r: 1.2 }); ev.push({ type: 'slam' }); }
      }
      return;
    }
    if (e.charge > 0) { e.charge -= dt; if (e.charge <= 0) { e.dashT = 1.6; e.hitP = false; } return; }
    e.cd -= dt;
    const want = chaseDir(room, e, p), f = fwd(want);
    e.ang += angDiff(want, e.ang) * Math.min(1, dt * 3);
    if (d2(e, p) > p.r + e.r + 0.1) moveCircle(room, e, f.x * 0.9 * dt, f.y * 0.9 * dt, 'enemy');
    touchHurt(s, e, 1, ev);
    if (e.cd <= 0 && canSee(room, e, p)) {
      e.aim = angTo(e, p);
      e.ang = e.aim;
      e.charge = p2 ? 0.95 : 1.25;
      e.cd = p2 ? 2.8 : 3.8;
      ev.push({ type: 'aim', id: e.id });
      if (p2) { summon(s, room, 'drone', e.x, e.y); summon(s, room, 'drone', e.x, e.y); }
    }
  } else if (e.boss === 'swarm') {
    // la REINA: se mantiene a distancia y se cura con cada nodo vivo
    const nodes = room.enemies.filter((o) => o.alive && o.kind === 'node' && o.queen === e.id).length;
    e.hp = Math.min(e.max, e.hp + nodes * 0.55 * dt);
    const dist = d2(e, p), want = angTo(e, p);
    e.ang += angDiff(want, e.ang) * Math.min(1, dt * 3);
    const away = dist < 3 ? -1 : dist > 4.5 ? 1 : 0, f = fwd(want);
    if (away) moveCircle(room, e, f.x * 1.6 * away * dt, f.y * 1.6 * away * dt, 'enemy');
    touchHurt(s, e, 2, ev);
    e.cd -= dt;
    if (e.cd <= 0) { // vuelve a soltar un nodo si le faltan
      e.cd = p2 ? 3 : 4.5;
      if (nodes < (p2 ? 6 : 4)) { room.enemies.push(swarmNode(`${e.id}-r${room.enemies.length}`, e, s.rng.next() * 6.28, s.depth)); ev.push({ type: 'spawn', x: e.x, y: e.y }); }
    }
  } else if (e.boss === 'excavator') {
    // EXCAVADORA: camina hacia ti; luego se HUNDE, marca las casillas bajo tus pies y SALE ahí (aturdida un momento)
    if (e.emergeT > 0) {
      e.emergeT -= dt;
      if (e.emergeT <= 0) { e.hidden = false; e.x = e.tx; e.y = e.ty; e.stun = 1.2; ev.push({ type: 'boom', x: e.x, y: e.y, r: 1.5 }); }
      return;
    }
    e.cd -= dt;
    const want = chaseDir(room, e, p), f = fwd(want);
    e.ang += angDiff(want, e.ang) * Math.min(1, dt * 3);
    if (d2(e, p) > p.r + e.r + 0.1) moveCircle(room, e, f.x * 1.2 * dt, f.y * 1.2 * dt, 'enemy');
    touchHurt(s, e, 1, ev);
    if (e.cd <= 0) {
      e.cd = p2 ? 3 : 4.2;
      e.hidden = true;
      const pc = Math.floor(p.x), pr = Math.floor(p.y);
      room.marks = [];
      for (let r = pr - 1; r <= pr + 1; r++) for (let c = pc - 1; c <= pc + 1; c++) if (tileAt(room, c, r) === '.' || tileAt(room, c, r) === 'E') room.marks.push([c, r]);
      // en fase 2 caen además rocas en casillas sueltas
      if (p2) for (let i = 0; i < 6; i++) { const c = s.rng.int(1, COLS - 2), r = s.rng.int(1, ROWS - 2); if (tileAt(room, c, r) === '.') room.marks.push([c, r]); }
      room.markT = 1.05;
      e.emergeT = 1.05;
      e.tx = pc + 0.5; e.ty = pr + 0.5;
      ev.push({ type: 'dig', x: e.x, y: e.y });
    }
  } else if (e.boss === 'phantom') {
    // FANTASMA: invisible; aparece junto a ti, marca su línea (visible y vulnerable) y dispara; luego se esfuma
    e.cd -= dt;
    if (e.charge > 0) {
      e.charge -= dt;
      if (e.charge <= 0) {
        for (const da of p2 ? [-0.35, 0, 0.35] : [0]) {
          const end = rayEnd(room, e, e.aim + da);
          ev.push({ type: 'eshot', id: e.id, from: { x: e.x, y: e.y }, to: end });
          if (segDist(p, e, end) < p.r + 0.12) hurt(s, 2, ev, 'phantom');
        }
        e.showT = 0.6;
      }
      return;
    }
    if (e.showT > 0) { e.showT -= dt; if (e.showT <= 0) e.hidden = true; return; }
    e.hidden = true;
    if (e.cd <= 0) {
      e.cd = p2 ? 2.4 : 3.2;
      for (let i = 0; i < 20; i++) { // reaparece a 3–4 casillas de ti
        const a = s.rng.next() * Math.PI * 2, nx = p.x + Math.cos(a) * 3.4, ny = p.y + Math.sin(a) * 3.4;
        if (!hitsWall(room, nx, ny, e.r, 'enemy')) { e.x = nx; e.y = ny; break; }
      }
      e.hidden = false;
      e.aim = angTo(e, p);
      e.ang = e.aim;
      e.charge = p2 ? 0.75 : 1;
      ev.push({ type: 'aim', id: e.id });
    }
  } else if (e.boss === 'fusion') {
    // FUSIÓN: cada núcleo marca un anillo a su alrededor (por turnos con su gemelo)
    touchHurt(s, e, 1, ev);
    e.ang += dt * 0.8;
    e.cd -= dt;
    if (e.cd <= 0 && room.markT <= 0) {
      e.cd = p2 ? 2.6 : 3.6;
      const c0 = Math.floor(e.x), r0 = Math.floor(e.y), R = p2 ? [1, 2, 3] : [2];
      room.marks = [];
      for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) {
        const ring = Math.max(Math.abs(c - c0), Math.abs(r - r0));
        if (R.includes(ring) && (room.tiles[r][c] === '.' || room.tiles[r][c] === 'E')) room.marks.push([c, r]);
      }
      room.markT = 1.1;
      ev.push({ type: 'aim', id: e.id });
    }
  } else if (e.boss === 'core') {
    // el NÚCLEO no se mueve: marca casillas y, al rato, arden
    touchHurt(s, e, 1, ev);
    e.ang += dt * 0.6;
    if (room.markT > 0) return;
    e.cd -= dt;
    if (e.cd > 0) return;
    e.cd = p2 ? 2.1 : 2.9;
    room.marks = coreMarks(s, room, e);
    room.markT = p2 ? 0.85 : 1.1;
    ev.push({ type: 'aim', id: e.id });
  }
}
function enterPhase2(s, room, e, ev) {
  if (e.boss === 'swarm') { // se DIVIDE: tres nodos más
    for (let i = 0; i < 3; i++) room.enemies.push(swarmNode(`${e.id}-x${i}`, e, (i / 3) * Math.PI * 2 + 0.5, s.depth));
    ev.push({ type: 'spawn', x: e.x, y: e.y });
  } else if (e.boss === 'core') { // ELECTRIFICA parte del suelo
    let n = 0;
    for (let i = 0; i < 80 && n < 9; i++) {
      const c = s.rng.int(1, COLS - 2), r = s.rng.int(1, ROWS - 2);
      if (room.tiles[r][c] !== '.' || c === MID_C || r === MID_R || Math.hypot(c + 0.5 - e.x, r + 0.5 - e.y) < 1.5) continue;
      room.tiles[r][c] = 'E';
      n++;
    }
  }
}
// las casillas que va a quemar el Núcleo: un anillo, una cruz o las de alrededor de ti (por turnos)
function coreMarks(s, room, e) {
  const c0 = Math.floor(e.x), r0 = Math.floor(e.y), p = s.player, out = [];
  e.pattern = ((e.pattern || 0) + 1) % 3;
  const ok = (c, r) => c > 0 && r > 0 && c < COLS - 1 && r < ROWS - 1 && (room.tiles[r][c] === '.' || room.tiles[r][c] === 'E');
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      const dc = Math.abs(c - c0), dr = Math.abs(r - r0), ring = Math.max(dc, dr);
      const hit = e.pattern === 0 ? ring === 2 || ring === 4 : e.pattern === 1 ? (c === c0 || r === r0) && ring > 0 : Math.abs(c - Math.floor(p.x)) <= 1 && Math.abs(r - Math.floor(p.y)) <= 1;
      if (hit && ok(c, r)) out.push([c, r]);
    }
  }
  return out;
}
// los NODOS del enjambre giran alrededor de su reina y te muerden si te acercas
function updateNode(s, room, e, dt, ev) {
  const q = room.enemies.find((o) => o.id === e.queen && o.alive);
  if (!q) { e.alive = false; return; }
  // nunca dentro de una pared (nacen en su órbita, que puede caer fuera de la sala): vuelve con su reina
  if (hitsWall(room, e.x, e.y, e.r, 'enemy')) { e.x = q.x; e.y = q.y; }
  e.orbit += dt * 1.3;
  const tx = q.x + Math.cos(e.orbit) * 1.5, ty = q.y + Math.sin(e.orbit) * 1.5;
  // si estás cerca, se lanzan a por ti
  const p = s.player, chase = d2(e, p) < 1.25;
  const gx = chase ? p.x : tx, gy = chase ? p.y : ty, dx = gx - e.x, dy = gy - e.y, d = Math.hypot(dx, dy) || 1;
  const sp = Math.min(d, ENEMY.node.speed * dt);
  moveCircle(room, e, (dx / d) * sp, (dy / d) * sp, 'enemy');
  touchHurt(s, e, 1, ev);
}

// ---------- Los enemigos nuevos ----------
// se aleja si estás cerca, se acerca si estás lejos (para los que pelean a distancia)
function keepRange(room, e, p, dt, near, far, speed) {
  const dist = d2(e, p);
  const away = dist < near ? -1 : dist > far ? 1 : 0;
  if (!away) return;
  const want = away > 0 ? chaseDir(room, e, p) : angTo(p, e), f = fwd(want);
  moveCircle(room, e, f.x * speed * dt, f.y * speed * dt, 'enemy');
}
function updateNewFoe(s, room, e, dt, ev, dist) {
  const p = s.player, E = ENEMY[e.kind];
  if (e.kind === 'sniper') {
    // FRANCOTIRADOR: su mira te SIGUE mientras carga y se queda FIJA el último 0,4 s; entonces dispara por ella
    if (e.charge > 0) {
      e.charge -= dt;
      if (e.charge > 0.4) { e.aim = angTo(e, p); e.ang = e.aim; }
      if (e.charge <= 0) {
        const end = rayEnd(room, e, e.aim);
        ev.push({ type: 'eshot', id: e.id, from: { x: e.x, y: e.y }, to: end });
        if (segDist(p, e, end) < p.r + 0.1) hurt(s, E.dmg, ev, 'francotirador');
        e.cd = 2.2;
      }
      return;
    }
    keepRange(room, e, p, dt, 4, 7, E.speed * (e.speedMul || 1));
    e.ang += angDiff(angTo(e, p), e.ang) * Math.min(1, dt * 4);
    if (e.cd <= 0 && dist < 10 && canSee(room, e, p)) { e.aim = angTo(e, p); e.charge = 1.3; ev.push({ type: 'aim', id: e.id }); }
  } else if (e.kind === 'summoner') {
    // INVOCADOR: huye y llama drones (avisa brillando antes)
    keepRange(room, e, p, dt, 4.5, 8, E.speed * (e.speedMul || 1));
    e.ang = angTo(e, p);
    if (e.summonT > 0) {
      e.summonT -= dt;
      if (e.summonT <= 0) { summon(s, room, 'drone', e.x, e.y); summon(s, room, 'drone', e.x, e.y); ev.push({ type: 'spawn', x: e.x, y: e.y }); e.cd = 4.5; }
    } else if (e.cd <= 0) e.summonT = 0.8;
  } else if (e.kind === 'charger') {
    // CARGADOR: se acerca, carga (aviso: el anillo que va a barrer) y golpea el suelo: onda que crece
    if (e.wave) {
      e.wave.r += 5.5 * dt;
      if (!e.wave.hit && Math.abs(d2(e, p) - e.wave.r) < p.r + 0.3) { e.wave.hit = true; hurt(s, E.dmg, ev, 'cargador'); }
      if (e.wave.r > e.wave.max) { e.wave = null; e.cd = 2.2; }
      return;
    }
    if (e.charge > 0) { e.charge -= dt; if (e.charge <= 0) { e.wave = { r: 0.3, max: 3.4, hit: false }; ev.push({ type: 'shockwave', x: e.x, y: e.y }); } return; }
    const want = chaseDir(room, e, p), f = fwd(want);
    e.ang = want;
    if (dist > 2.2) moveCircle(room, e, f.x * E.speed * (e.speedMul || 1) * dt, f.y * E.speed * (e.speedMul || 1) * dt, 'enemy');
    else if (e.cd <= 0) { e.charge = 0.75; ev.push({ type: 'aim', id: e.id }); }
  } else if (e.kind === 'roller') {
    // MINA RODANTE: rueda en línea recta y, al chocar, gira a la derecha (sigue las paredes); estalla al tocarte
    const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    const f = fwd(dirs[e.dir || 0]);
    if (moveCircle(room, e, f.x * E.speed * (e.speedMul || 1) * dt, f.y * E.speed * (e.speedMul || 1) * dt, 'enemy')) e.dir = ((e.dir || 0) + 1) % 4;
    e.ang += dt * 8;
    if (dist < p.r + e.r + 0.1) {
      e.alive = false;
      ev.push({ type: 'boom', x: e.x, y: e.y, r: 1.2 });
      hurt(s, E.dmg, ev, 'mina rodante');
      for (const o of room.enemies) if (o.alive && o !== e && d2(o, e) < 1.2) hitEnemy(s, room, o, 2, ev);
    }
  }
}

// La línea que va a barrer una torreta que está apuntando (para dibujarla)
export const chargeLine = (room, e) => (e.charge > 0 && e.aim !== null ? { from: { x: e.x, y: e.y }, to: rayEnd(room, e, e.aim) } : null);

// ---------- Geometría para el dibujo 3D (pura: así se puede testear) ----------
// Mundo del dibujo: x = columna, z = −fila. Caras de pared visibles: una por cada lado de una losa maciza
// (pared, o puerta cerrada) que da a una losa libre, puesta EN el borde que comparten; n = normal hacia la libre.
export function wallFaces(room, shut = locked(room)) {
  const isWall = (c, r) => { const k = tileAt(room, c, r); return k === '#' || k === 'K' || (k === 'D' && shut); };
  const out = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!isWall(c, r)) continue;
      const door = room.tiles[r][c] === 'D', crack = room.tiles[r][c] === 'K', x0 = c, x1 = c + 1, zN = -r, zS = -r - 1; // zN: borde con la fila r−1; zS: con la r+1
      if (r + 1 < ROWS && !isWall(c, r + 1)) out.push({ c, r, door, crack, a: [x1, zS], b: [x0, zS], n: [0, -1] });
      if (r - 1 >= 0 && !isWall(c, r - 1)) out.push({ c, r, door, crack, a: [x0, zN], b: [x1, zN], n: [0, 1] });
      if (c - 1 >= 0 && !isWall(c - 1, r)) out.push({ c, r, door, crack, a: [x0, zS], b: [x0, zN], n: [-1, 0] });
      if (c + 1 < COLS && !isWall(c + 1, r)) out.push({ c, r, door, crack, a: [x1, zN], b: [x1, zS], n: [1, 0] });
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
  p.dashT = s.floor.event === 'lowgrav' ? 0.32 : 0.22;
  p.dashCd = p.dashMax || 1.1;
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
    breakCrack(s, room, p, 2.3, ev);
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
  else if (id === 'surge') { p.ram = 1; p.dashT = 0.6; p.dashCd = 0.6; }
  else if (id === 'quake') {
    ev.push({ type: 'boom', x: p.x, y: p.y, r: 3.2, mine: true });
    for (const e of room.enemies) if (e.alive && d2(e, p) < 3.2) { hitEnemy(s, room, e, 2, ev); e.stun = Math.max(e.stun, 1.5); }
    breakCrack(s, room, p, 2, ev);
  } else if (id === 'salvage') {
    for (const pk of room.pickups) { pk.x = p.x + (s.rng.next() - 0.5) * 0.4; pk.y = p.y + 0.7; pk.cool = false; }
    for (const e of room.enemies) if (e.alive && d2(e, p) < 2.5) e.stun = Math.max(e.stun, 1.2);
  }
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
  s.player.shield = Math.max(s.player.shield, s.player.roomShield || 0);
  s.shots = [];
  s.touch = null;
  if (!s.visited.includes(to)) s.visited.push(to);
  ev.push({ type: 'room', id: to, roomType: room.type, dir });
  if (locked(room)) ev.push({ type: 'shut' });
}

function descend(s, ev) {
  // al bajar de la planta 9 (la primera vez): ¿SALIR con todo o SEGUIR en el modo sin fin?
  if (s.depth === LAST_FLOOR && !s.endless) { s.choice = 'exit'; ev.push({ type: 'exitChoice' }); return; }
  s.depth++;
  gainPiezas(s, 3 + s.depth);
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

// ---------- Botín: ponerte un objeto o dejarlo ----------
// choice: 'equip' | 'mod1' | 'mod2' (en qué ranura de módulo) | 'leave'. Lo que llevabas queda en el suelo.
export function takeOffer(s, choice) {
  const o = s.offer;
  if (!o) return [];
  const p = s.player, room = roomOf(s), ev = [];
  if (o.pk) room.pickups = room.pickups.filter((x) => x !== o.pk);
  // lo que dejas o te quitas queda en el suelo (marcado como descartado: el bot no vuelve a por ello)
  const drop = (item) => room.pickups.push({ id: `${item.id}-f`, kind: 'item', item, x: p.x, y: p.y, cool: true, declined: true });
  if (choice === 'leave') { drop(o.item); ev.push({ type: 'left' }); } else {
    const slot = choice === 'mod1' || choice === 'mod2' ? choice : slotFor(p, o.item);
    const old = p.gear[slot], oldMax = p.max;
    p.gear[slot] = o.item;
    applyGear(p);
    if (p.max > oldMax) p.hp += p.max - oldMax; // un blindaje nuevo trae su vida puesta
    if (old) drop(old);
    if (!s.best || itemPower(o.item) > itemPower(s.best)) s.best = o.item;
    ev.push({ type: 'equip', slot, item: o.item });
  }
  s.offer = null;
  return ev;
}
// (bot) se lo pone si es mejor que lo que lleva en esa ranura
export function botOffer(s) {
  const p = s.player, it = s.offer.item, cur = currentFor(p, it);
  if (itemPower(it) <= itemPower(cur)) return 'leave';
  if (it.slot === 'mod' && p.gear.mod1 && p.gear.mod2) return cur === p.gear.mod1 ? 'mod1' : 'mod2';
  return 'equip';
}

// ---------- Mochila: consumibles ----------
export function useCons(s, k) {
  const p = s.player, room = roomOf(s), ev = [];
  if (s.over || s.offer || !p.bag[k]) return [{ type: 'noCons', cons: k }];
  if (k === 'kit') {
    if (p.hp >= p.max) return [{ type: 'full' }];
    p.hp = Math.min(p.max, p.hp + 3);
  } else if (k === 'emp') {
    for (const e of room.enemies) if (e.alive) { e.stun = Math.max(e.stun, 3); e.charge = 0; }
    ev.push({ type: 'boom', x: p.x, y: p.y, r: 3, mine: true });
  } else if (k === 'warp') {
    // a la entrada de la planta (una salida de emergencia: la sala de la que huyes sigue como estaba)
    s.at = s.floor.start;
    roomOf(s);
    s.entry = { x: MID_C + 0.5, y: MID_R + 0.5, ang: 0 };
    Object.assign(p, { x: s.entry.x, y: s.entry.y, ang: 0, vel: 0, dashT: 0, inv: Math.max(p.inv, 1) });
    s.shots = [];
    s.touch = null;
    ev.push({ type: 'room', id: s.at, roomType: 'start', dir: null });
  }
  p.bag[k]--;
  ev.unshift({ type: 'used', cons: k });
  return ev;
}

// TIENDA (🔩 de la partida) y ALTAR
export const SHOP_ITEMS = ['repair', 'key', 'kit', 'emp', 'warp', 'box'];
export const shopCost = (s, item) => ({ repair: 6 + s.depth, key: 8 + s.depth, kit: 7 + s.depth, emp: 9 + s.depth, warp: 10 + s.depth, box: 28 + 3 * s.depth }[item]);
export function buy(s, item) {
  const c = shopCost(s, item), p = s.player;
  if (!c || p.piezas < c) return [{ type: 'poor' }];
  if (item === 'repair' && p.hp >= p.max) return [{ type: 'full' }];
  if (CONS_KEYS.includes(item) && p.bag[item] >= p.bagMax) return [{ type: 'bagFull', cons: item }];
  p.piezas -= c;
  if (item === 'repair') p.hp = Math.min(p.max, p.hp + 3);
  if (item === 'key') p.keys++;
  if (CONS_KEYS.includes(item)) p.bag[item]++;
  if (item === 'box') { // caja misteriosa: un objeto, al menos raro
    s.offer = { item: genItem(s.rng, s.depth, { bonus: 1, minTier: 1 }), pk: null };
    return [{ type: 'bought', item }, { type: 'offer' }];
  }
  return [{ type: 'bought', item }];
}
// pick: 'hp' (+2 de vida máxima) · 'dmg' (+1 de daño) · 'pact' (PACTO: −1 de vida máxima por un objeto épico o mejor)
export function pray(s, pick) {
  const room = roomOf(s);
  if (room.type !== 'shrine' || room.used) return [{ type: 'empty' }];
  const p = s.player;
  if (pick === 'pact' && p.max <= 3) return [{ type: 'weak' }];
  room.used = true;
  if (pick === 'hp') { p.bonusMax += 2; p.hp += 2; } else if (pick === 'dmg') p.bonusDmg += 1;
  else p.bonusMax -= 1;
  applyGear(p);
  const ev = [{ type: 'blessed', pick }];
  if (pick === 'pact') { s.offer = { item: genItem(s.rng, s.depth, { bonus: 2, minTier: 2 }), pk: null }; ev.push({ type: 'offer' }); }
  return ev;
}

// ---------- Bot (tests y demostración) ----------
// Vuela solo (el disparo ya es automático): se aparta de láseres y bombas, busca ver al enemigo más
// cercano a buena distancia, rodea al escudo, abre cofres con llave y va a la sala sin ver o a la salida.
export function botInput(s) {
  const p = s.player, room = roomOf(s), shut = locked(room);
  // fuera de una sala cerrada, lo que no ves ni puedes alcanzar no te importa (p. ej. tras un muro del laberinto)
  const foes = room.enemies.filter((e) => e.alive && !e.hidden && (shut || canSee(room, p, e) || pathNext(room, p, [[Math.floor(e.x), Math.floor(e.y)]], () => false)));
  const avoid = (c, r) => ['M', 'P'].includes(tileAt(room, c, r)) || tileAt(room, c, r) === 'E';
  const threat = (x, y) => foes.some((e) => (e.kind === 'bomb' && (e.fuse !== null || d2(e, { x, y }) < 1.6) && d2(e, { x, y }) < 2.1)
    || (e.kind === 'charger' && (e.charge > 0 || e.wave) && d2(e, { x, y }) < 3.7)
    || (e.kind === 'roller' && d2(e, { x, y }) < 1.4)
    || ((e.kind === 'turret' || e.kind === 'boss' || e.kind === 'sniper') && e.charge > 0 && e.aim !== null && segDist({ x, y }, e, rayEnd(room, e, e.aim)) < 0.65 + (e.kind === 'boss' ? e.r : 0))
    || (e.kind === 'boss' && e.dashT > 0 && d2(e, { x, y }) < 2.2))
    || (room.markT > 0 && room.marks.some(([c, r]) => c === Math.floor(x) && r === Math.floor(y)));
  const out = { x: 0, y: 0 };
  if (foes.length && p.abCd <= 0 && foes.filter((e) => d2(e, p) < 2.2).length >= 2) out.ability = true;
  if (p.hp <= 2 && p.bag?.kit) out.cons = 'kit';
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
    if (best) return { ...steer(p, { x: best.c + 0.5, y: best.r + 0.5 }), dash: p.dashCd <= 0 && foes.some((e) => (e.kind === 'turret' || e.kind === 'boss') && e.charge > 0 && e.charge < 0.3) };
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
  // sala limpia: lo que haya en el suelo, el cofre (si hay llave), la salida, o la siguiente sala sin ver
  let goal = null;
  const pk = room.pickups.find((x) => !x.cool && !x.declined && (x.kind === 'item' || x.kind === 'key' || p.bag[x.cons] < p.bagMax));
  if (pk) {
    if (d2(p, pk) < 1.2) return steer(p, pk, true);
    const st = pathNext(room, p, [[Math.floor(pk.x), Math.floor(pk.y)]], avoid) || pathNext(room, p, [[Math.floor(pk.x), Math.floor(pk.y)]], () => false);
    if (st) return steer(p, st);
  }
  const hasChest = (room.type === 'treasure' || room.type === 'hidden') && !room.opened && (p.keys || room.freeChest);
  if (hasChest) goal = [[2, 3], [3, 2], [1, 2], [2, 1]];
  else if (room.type === 'exit' || room.type === 'boss') goal = [[MID_C, MID_R]];
  else {
    const want = routeToTarget(s);
    if (want) goal = [DOOR_TILE[want]];
  }
  if (!goal) return out;
  if (hasChest && d2(p, { x: 2.5, y: 2.5 }) < 1.4) return steer(p, { x: 2.5, y: 2.5 }, true);
  const step = pathNext(room, p, goal, avoid) || pathNext(room, p, goal, () => false);
  return step ? steer(p, step) : out;
}
// gira hacia el punto y avanza (más despacio si aún mira hacia otro lado)
function steer(p, to, final = false) {
  const diff = angDiff(angTo(p, to), p.ang), a = Math.abs(diff);
  // muy cerca, sigue avanzando despacio mientras gira (si no, da vueltas encima del objetivo sin llegar)
  const close = final && Math.hypot(to.x - p.x, to.y - p.y) < 1.3; // solo con la meta final (no con cada paso del camino)
  return { x: Math.max(-1, Math.min(1, diff * 2.5)), y: a < 0.45 ? -1 : a < 1.2 || close ? -0.35 : 0 };
}
// siguiente puerta hacia la sala sin visitar más cercana (o hacia la salida)
function routeToTarget(s) {
  const prev = { [s.at]: null }, q = [s.at];
  let goal = null;
  while (q.length) {
    const id = q.shift();
    if (id !== s.at && !s.visited.includes(id)) { goal = id; break; }
    for (const nid of Object.values(openDoors(s, id))) if (!(nid in prev)) { prev[nid] = id; q.push(nid); }
  }
  if (!goal) goal = s.floor.exit;
  if (goal === s.at) return null;
  let id = goal;
  if (!(id in prev)) return null;
  while (prev[id] !== s.at && prev[id] !== null) id = prev[id];
  return Object.entries(openDoors(s, s.at)).find(([, v]) => v === id)?.[0] || null;
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

// ---------- Planta 9: salir o seguir ----------
// 'leave': sales con todo (victoria). 'continue': MODO SIN FIN (ya cuenta como victoria; caer ya no te quita 🔩)
export function chooseExit(s, pick) {
  if (s.choice !== 'exit') return [];
  s.choice = null;
  s.cleared9 = true;
  const ev = [{ type: 'cleared9' }];
  if (pick === 'leave') { s.won = true; s.over = true; ev.push({ type: 'win' }); return ev; }
  s.endless = true;
  ev.push({ type: 'endless' });
  descend(s, ev);
  return ev;
}

// ---------- El TALLER de Pecios (mejoras para siempre, con 🔩) ----------
export const WORKSHOP = [
  { id: 'hull', icon: '❤️', name: 'Casco reforzado', desc: (l) => `empiezas con +${l} de vida máxima`, cost: [40, 80, 140, 220, 320] },
  { id: 'keys', icon: '🗝️', name: 'Llavero', desc: (l) => `empiezas con ${l} llave${l > 1 ? 's' : ''}`, cost: [60, 150] },
  { id: 'pack', icon: '🎒', name: 'Mochila', desc: (l) => (l >= 2 ? 'empiezas con un kit y caben 4 de cada' : 'empiezas con un kit de reparación'), cost: [50, 160] },
  { id: 'luck', icon: '🍀', name: 'Olfato', desc: (l) => `más botín de los enemigos${l >= 2 ? ' y mejor' : ''}${l >= 3 ? '; cofres aún mejores' : ''}`, cost: [80, 170, 300] },
  { id: 'power', icon: '⚡', name: 'Calibración', desc: (l) => `+${l} de daño del disparo`, cost: [120, 280] },
];
export const workshopLevel = (up, id) => Math.min(up?.[id] || 0, WORKSHOP.find((w) => w.id === id).cost.length);
export const workshopCost = (up, id) => WORKSHOP.find((w) => w.id === id).cost[workshopLevel(up, id)] ?? null;
// lo que el taller le da a la nave al empezar
export function workshopShip(up = {}) {
  const L = (id) => workshopLevel(up, id);
  return { hpBonus: L('hull'), keys: L('keys'), bag: L('pack') ? { kit: 1 } : {}, bagMax: L('pack') >= 2 ? BAG_MAX + 1 : BAG_MAX, luck: L('luck'), bonusDmg: L('power') };
}
