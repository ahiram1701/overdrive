// Mundo: biomas, generación procedural de tramos, obstáculos, monedas, bifurcaciones y jefe.
import { G, LANES, LANE_W, VIEW, clamp } from './state.js';
import { fx } from './fx.js';
import { sfx } from './audio.js';
import { project } from './render.js';
import { playerBox } from './player.js';
import { isActive } from './abilities.js';
import { trackSpeed } from './pacing.js';
import { BOSSES, BOSS_BY_ID, bossFor, phaseOf, attackCooldown, makeElite, bossHp } from './bosses.js';
import { onNearMiss, onBreak, onHit, onCoin, onFork, onFinish, onJumpOver, onCore, bossDefeated, bossEscaped, addScore, hunterEscaped, progress } from './game.js';

export const BIOMES = [
  { id: 'neon', name: 'NEÓN URBANO', sky: ['#0b0221', '#6a1182'], ground: '#0d0221', road: ['#1c0638', '#12042a'], line: '#ff2bd6', edge: '#00e5ff', obs: '#ff2bd6', obs2: '#00e5ff', accent: '#ffe600', music: 0 },
  { id: 'lava', name: 'TÚNEL DE LAVA', sky: ['#140000', '#b32400'], ground: '#1a0400', road: ['#2c0900', '#1e0500'], line: '#ff6a00', edge: '#ffcc00', obs: '#ff3b1f', obs2: '#ffcc00', accent: '#ff9500', music: 1 },
  { id: 'glitch', name: 'VACÍO GLITCH', sky: ['#000000', '#00431d'], ground: '#000a04', road: ['#03200f', '#011207'], line: '#39ff14', edge: '#00ffaa', obs: '#39ff14', obs2: '#ff00ff', accent: '#ffffff', music: 2 },
  { id: 'hyper', name: 'HIPERESPACIO', sky: ['#000010', '#16287a'], ground: '#00020c', road: ['#081238', '#050b26'], line: '#7df9ff', edge: '#ffffff', obs: '#4d7cff', obs2: '#ffffff', accent: '#7df9ff', music: 3 },
];

export const FORK_REWARDS = {
  riesgo: { icon: '☠️', label: 'RIESGO', color: '#ff9500', desc: 'x2 puntos · más caos' },
  tienda: { icon: '🛒', label: 'TIENDA', color: '#5ac8fa', desc: 'gasta monedas' },
  cofre: { icon: '🎁', label: 'COFRE', color: '#bf5af2', desc: '¿qué habrá?' },
  escudo: { icon: '🛡️', label: 'ESCUDO', color: '#30d158', desc: '+1 escudo' },
  monedas: { icon: '🪙', label: 'MONEDAS', color: '#ffd60a', desc: 'lluvia de oro' },
  epica: { icon: '🃏', label: 'CARTA+', color: '#ff6ac1', desc: 'cartas raras' },
};

const TALL = 99;
// altura a la que el salto doble pasa por encima de un muro
export const JUMP_OVER = 1.9;
export const RAMP_BOOST = 1.6; // multiplicador del salto al pasar por una rampa
const FORCED = G.debug && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('pattern') : null;
const DIM = {
  // y1 = TALL: lo que se esquiva cambiando de carril (o deslizándose) no se puede saltar, ni con Salto doble
  // need = cómo se esquiva (lo lee el bot de los tests E2E: así los obstáculos nuevos traen su propia solución)
  wall: { w: 0.9, y0: 0, y1: TALL, depth: 0.8, need: 'lane' },
  barrier: { w: 0.92, y0: 0, y1: 0.5, depth: 0.35, need: 'jump' },
  overhead: { w: 0.96, y0: 0.45, y1: TALL, depth: 0.35, need: 'slide' },
  laserLow: { w: 3, y0: 0, y1: 0.35, depth: 0.05, all: true, need: 'jump' },
  laserHigh: { w: 3, y0: 0.45, y1: TALL, depth: 0.05, all: true, need: 'slide' },
  mine: { w: 0.5, y0: 0, y1: 0.35, depth: 0.5, need: 'lane' },
  mover: { w: 0.9, y0: 0, y1: TALL, depth: 0.8, need: 'lane' },
  // F6: mecánicas de bioma
  lava: { w: 0.95, y0: 0, y1: 0.3, depth: 0.05, need: 'lane' },   // río de lava a lo largo de un carril (con len)
  glitch: { w: 0.9, y0: 0, y1: TALL, depth: 0.8, need: 'lane' },  // muro que salta de carril una vez
  shot: { w: 0.6, y0: 0, y1: 0.5, depth: 0.6, need: 'lane' },
  core: { w: 0.8, y0: 0, y1: 1.2, depth: 0.8 },
  coin: { w: 0.5, y0: 0, y1: 0.5, depth: 0 },
  fork: { w: 0.95, y0: 0, y1: 2.2, depth: 0.3 },
  finish: { w: 3.2, y0: 0, y1: 2.6, depth: 0.3, all: true },
  // F4: obstáculos con comportamiento y elementos de movimiento
  crusher: { w: 0.9, y0: 0, y1: TALL, depth: 0.8, need: 'lane' },  // pinzas que se cierran
  roller: { w: 0.92, y0: 0, y1: 0.5, depth: 0.5, need: 'jump' },  // rodillo que rueda hacia ti
  dropper: { w: 0.96, y0: 0.45, y1: TALL, depth: 0.35, need: 'slide' }, // barra que cae del techo
  rail: { w: 0.5, y0: 0, y1: 0.5, depth: 0.2, need: 'jump' },   // la PUNTA del riel; el resto se recorre
  portal: { w: 0.9, y0: 0, y1: 2, depth: 0.1 },                   // te cambia de carril
  ramp: { w: 0.9, y0: 0, y1: 0.6, depth: 3 },                     // te lanza por los aires
  drone: { w: 0.7, y0: 0.6, y1: 1.4, depth: 0.5 },                // diana: rómpela con DASH o láser
};

const ACT_DODGE = '#ff3b6b'; // mismo magenta que "esquiva" en render.js
const TARGET_COL = '#30d158'; // verde = objetivo / impulso

// velocidad real (con overdrive): los umbrales de reacción se miden en TIEMPO, no en metros,
// porque la velocidad no tiene tope y una distancia fija se vuelve imposible al final
export const runSpeed = (r = G.run) => r.speed * (r.odTime > 0 ? 1.5 : 1);

// tiempo en el aire de un salto con los stats actuales (la gravedad baja del hiperespacio lo alarga)
export const airtime = (r) => (2 * r.stats.jumpV) / r.stats.gravity;

// SET PIECES: secuencias guionizadas de patrones, anunciadas al llegar a ellas
export const SCRIPTS = {
  tunel: { name: 'TÚNEL', sub: 'rieles y portales', rows: ['railRun', 'portalSwap', 'over3', 'railRun', 'portalSwap'] },
  estampida: { name: 'ESTAMPIDA', sub: '¡salta los rodillos!', rows: ['rollers', 'rollers', 'rollers', 'rollers', 'rollers'] },
  meteoritos: { name: 'LLUVIA DE MINAS', sub: 'cambia de carril sin parar', rows: ['mines', 'mines', 'mines', 'mines', 'mines', 'mines'] },
  gusano: { name: 'AGUJERO DE GUSANO', sub: 'el mundo gira', rows: ['coinArc', 'portalSwap', 'coinArc', 'portalSwap', 'coinArc'], spin: true },
};

export const allowedLanes = (r) => LANES.filter((l) => l !== r.blockedLane);
// lo que no es un obstáculo: premios, objetivos y elementos de movimiento
const NOT_OBSTACLE = new Set(['coin', 'fork', 'finish', 'core', 'portal', 'ramp', 'drone']);
const isObstacle = (o) => !NOT_OBSTACLE.has(o.type);

function add(type, lane, z, extra = {}) {
  const d = DIM[type];
  const o = {
    type, lane, x: d.all ? 0 : lane * LANE_W, z,
    w: d.w, y0: d.y0, y1: d.y1, depth: d.depth, all: !!d.all,
    need: d.need || null,
    alive: true, rzPrev: Infinity, t: 0, vz: 0, y: 0.3,
    ...extra,
  };
  G.run.objects.push(o);
  return o;
}

// ---------- Patrones ----------
// distancia a la que un rodillo empieza a rodar (desde ahí se le ve venir ~1,5 s)
const ROLL_AT = 55;

const PATTERNS = {
  wall1(r, z, L, rng) { add('wall', rng.pick(L), z); return 'lane'; },
  wall2(r, z, L, rng) {
    const open = rng.pick(L);
    for (const l of L) if (l !== open) add('wall', l, z);
    return 'lane';
  },
  gate(r, z, L, rng) {
    const open = rng.pick(L);
    for (const l of L) if (l !== open) add('wall', l, z, { gate: true });
    return 'lane';
  },
  barrier3(r, z, L) { for (const l of L) add('barrier', l, z); return 'jump'; },
  over3(r, z, L) { for (const l of L) add('overhead', l, z); return 'slide'; },
  mixed(r, z, L, rng) {
    const kinds = rng.shuffle(['wall', 'barrier', 'overhead']);
    LANES.forEach((l, i) => { if (L.includes(l)) add(kinds[i], l, z); });
    return 'mixed';
  },
  laserLow(r, z) { add('laserLow', 0, z); return 'jump'; },
  laserHigh(r, z) { add('laserHigh', 0, z); return 'slide'; },
  mines(r, z, L, rng) {
    const lanes = rng.shuffle([...L]).slice(0, Math.max(1, L.length - 1));
    lanes.forEach((l, i) => add('mine', l, z + i * 1.5));
    return 'lane';
  },
  mover(r, z, L, rng) {
    const l = rng.pick(L);
    add('mover', l, z, { target: l, moveT: 0.3 });
    return 'lane';
  },
  // ---- F4 ----
  pinch(r, z, L, rng) { add('crusher', rng.pick(L), z); return 'lane'; },
  rollers(r, z, L, rng) {
    const lanes = rng.shuffle([...L]).slice(0, rng.int(1, L.length));
    // rueda hacia ti más rápido que la pista. Espera quieto y arranca a ROLL_AT metros; nace un
    // poco más lejos (Δ = ROLL_AT·vz/(spd+vz)) para LLEGAR justo cuando llegaría una barrera fija
    // en z. Antes se calculaba como si arrancara a VIEW metros, pero al empezar un tramo las filas
    // nacen más cerca: el rodillo llegaba tarde, encima de la fila siguiente.
    const vz = 7, spd = trackSpeed(z, r.stats.speedMult);
    const zr = z + (ROLL_AT * vz) / (spd + vz);
    for (const l of lanes) add('roller', l, zr, { vz, rollAt: ROLL_AT });
    return 'jump';
  },
  dropRow(r, z, L) { for (const l of L) add('dropper', l, z); return 'slide'; },
  // muros en dos carriles y un portal en el hueco que te manda a otro carril; la fila
  // siguiente solo deja libre ese carril de destino: el portal es el camino
  portalSwap(r, z, L, rng) {
    if (L.length < 3) return PATTERNS.wall2(r, z, L, rng);
    const open = rng.pick(L);
    const dest = rng.pick(L.filter((l) => l !== open));
    for (const l of L) if (l !== open) add('wall', l, z);
    add('portal', open, z, { dest });
    const spd = trackSpeed(z, r.stats.speedMult);
    const z2 = z + Math.max(8, spd * 0.45);
    for (const l of L) if (l !== dest) add('wall', l, z2);
    r.extraGap = z2 - z + Math.max(9, spd * 0.5);
    return 'lane';
  },
  // rampa en un carril con un arco de monedas por el aire; todos los carriles tienen barrera
  rampJump(r, z, L, rng) {
    const l = rng.pick(L);
    const spd = trackSpeed(z, r.stats.speedMult);
    add('ramp', l, z);
    const zb = z + spd * 0.35;
    for (const l2 of L) add('barrier', l2, zb);
    const vy = r.stats.jumpV * RAMP_BOOST, g = r.stats.gravity;
    for (let t = 0.12; t < (2 * vy) / g - 0.1; t += 0.09) add('coin', l, z + spd * t, { y: 0.35 + vy * t - (g / 2) * t * t });
    r.extraGap = spd * ((2 * vy) / g + 0.25);
    return 'jump';
  },
  // riel largo: hay que subir saltando su punta; los otros carriles se cierran mientras dura
  railRun(r, z, L, rng) {
    const l = rng.pick(L);
    const spd = trackSpeed(z, r.stats.speedMult);
    const len = Math.max(25, spd * 0.9);
    add('rail', l, z, { len });
    for (const k of [0.4, 0.75]) for (const l2 of L) if (l2 !== l) add('wall', l2, z + len * k);
    for (let d = 3; d < len - 2; d += 2.5) add('coin', l, z + d, { y: 0.85 });
    r.extraGap = len + Math.max(9, spd * 0.5);
    return 'jump';
  },
  // ---- F6: mecánicas de bioma ----
  // LAVA: un río de lava recorre un carril; hay que estar fuera de él mientras dura
  lavaFlow(r, z, L, rng) {
    if (L.length < 2) return PATTERNS.wall1(r, z, L, rng);
    const l = rng.pick(L);
    const spd = trackSpeed(z, r.stats.speedMult);
    const len = Math.max(20, spd * 1.1);
    add('lava', l, z, { len });
    const free = L.filter((x) => x !== l);
    coinLine(rng.pick(free), z + 3, z + len - 3);
    r.extraGap = len + Math.max(9, spd * 0.4);
    return 'lane';
  },
  // GLITCH: un muro que salta de carril una vez; su fantasma marca el destino antes
  glitchWall(r, z, L, rng) {
    if (L.length < 2) return PATTERNS.wall1(r, z, L, rng);
    const from = rng.pick(L);
    const to = rng.pick(L.filter((l) => l !== from));
    add('glitch', from, z, { to, jumped: false });
    return 'lane';
  },
  // NEÓN: cortina de láser bajo y, justo detrás, una alta (salta y luego deslízate)
  laserDuo(r, z) {
    const spd = trackSpeed(z, r.stats.speedMult);
    add('laserLow', 0, z);
    const z2 = z + spd * (airtime(r) + 0.2);
    add('laserHigh', 0, z2);
    r.extraGap = z2 - z + spd * 0.66;
    return 'slide';
  },
  droneLine(r, z, L, rng) {
    const l = rng.pick(L);
    for (let k = 0; k < 3; k++) add('drone', l, z + k * 6);
    return 'lane';
  },
  coinArc(r, z, L, rng) {
    const l = rng.pick(L);
    add('barrier', l, z);
    coinArc(l, z);
    return 'lane';
  },
};

const WEIGHTS = {
  intro: { wall1: 3, wall2: 2, barrier3: 1.5, over3: 1.5, coinArc: 1.2 },
  neon: { wall1: 2.5, wall2: 2.5, barrier3: 2, over3: 2, mixed: 1.5, gate: 1.5, coinArc: 1, pinch: 1, rampJump: 1, railRun: 1, droneLine: 0.8, laserDuo: 1.5 },
  lava: { mines: 3, laserLow: 2.5, laserHigh: 2, wall1: 1.5, mixed: 1, barrier3: 1, rollers: 2, rampJump: 1, dropRow: 1, lavaFlow: 2.5 },
  glitch: { mover: 3, wall2: 2, mixed: 2, laserHigh: 1, mines: 1, wall1: 1, portalSwap: 2, pinch: 1.5, railRun: 1, droneLine: 1, glitchWall: 3 },
  hyper: { wall2: 2, gate: 2, mixed: 2.5, laserLow: 1.5, laserHigh: 1.5, mover: 1.5, mines: 1, railRun: 1.5, portalSwap: 1.5, rollers: 1, dropRow: 1, rampJump: 1.2, droneLine: 1 },
  boss: { wall1: 3, mines: 2 },
};

function coinLine(lane, z0, z1, y = 0.3) {
  for (let z = z0; z < z1; z += 2.2) add('coin', lane, z, { y });
}

function coinArc(lane, z) {
  for (let dz = -3.6; dz <= 3.6; dz += 1.2) {
    add('coin', lane, z + dz, { y: 0.35 + 1.15 * (1 - (dz / 3.9) ** 2) });
  }
}

function genRow(r) {
  const rng = r.rng;
  const z = r.genZ;
  const L = allowedLanes(r);
  const key = r.boss ? 'boss' : r.section === 0 ? 'intro' : r.biome.id;
  const pats = Object.entries(WEIGHTS[key]).map(([id, w]) => ({ id, w }));
  // CAMPO MINADO: las minas pesan mucho más (fuera de la intro y del jefe)
  if (r.mods.has('mines') && key !== 'intro' && key !== 'boss') pats.push({ id: 'mines', w: 4 });
  let pat = rng.weighted(pats).id;
  // ?debug&pattern=nombre: una de cada dos filas usa ese patrón (para testear cada uno con el bot)
  if (FORCED && PATTERNS[FORCED] && key !== 'boss' && (r.forceToggle = !r.forceToggle)) pat = FORCED;
  // set piece en curso: su guion manda (sin tirar del RNG, así la pista sigue siendo determinista)
  if (r.script && r.script.i < r.script.rows.length) {
    if (r.script.i === 0) r.script.z0 = z;
    pat = r.script.rows[r.script.i++];
    if (r.script.i === r.script.rows.length) r.script.z1 = z + 60;
  }
  r.extraGap = 0;
  const kind = PATTERNS[pat](r, z, L, rng);

  // velocidad de referencia en esta distancia (no la del momento): el overdrive no cambia la pista
  const spd = trackSpeed(z, r.stats.speedMult);
  let tGap = 0.95 - clamp(r.section / 9, 0, 1) * 0.42;
  if (r.risk) tGap *= 0.8;
  if (r.mods.has('greed')) tGap *= 0.85; // AVARICIA: filas más juntas
  if (r.boss) tGap *= 1.7;
  if (r.section === 0) tGap *= 1.15;
  let gap = Math.max(9, spd * tGap);
  // tras un salto hay que poder aterrizar y volver a saltar: depende del tiempo de vuelo real
  if (kind === 'jump' || kind === 'mixed') gap = Math.max(gap, spd * Math.max(0.78, airtime(r) + 0.15));
  if (kind === 'slide') gap = Math.max(gap, spd * 0.66);
  gap = Math.max(gap, r.extraGap); // patrones largos (riel, portal, rampa) reservan su espacio

  // los patrones largos ya traen sus monedas y su propia fila: nada genérico encima
  if (r.extraGap) {
    r.genZ += gap;
    return;
  }

  let coinLane = null;
  if (kind === 'jump' && rng.chance(0.5)) coinArc(rng.pick(L), z);
  else if (rng.chance(0.45)) {
    coinLane = rng.pick(L);
    coinLine(coinLane, z + 3, z + gap - 3);
  }

  // fila extra encadenada en tramos avanzados; nunca encima de la hilera de monedas,
  // que si no te guiaría directa contra el muro
  if (kind === 'lane' && r.section >= 3 && rng.chance(Math.min(0.35, (r.section - 2) * 0.07)) && (gap * 0.5) / spd > 0.3) {
    const wl = L.filter((l) => l !== coinLane);
    add('wall', rng.pick(wl.length ? wl : L), z + gap * 0.5);
  }
  r.genZ += gap;
}

function placeFork(r) {
  const L = allowedLanes(r);
  const rng = r.rng;
  const pool = rng.shuffle(Object.keys(FORK_REWARDS));
  const z = r.genZ + 14;
  r.forkRewards = {};
  for (const l of L) {
    coinLine(l, r.genZ, z - 2, 0.3);
  }
  L.forEach((l, i) => {
    const reward = pool[i];
    r.forkRewards[l] = reward;
    add('fork', l, z, { reward });
  });
  r.forkPlaced = true;
  r.forkDone = false;
  r.genHold = true;
}

// CAMPAÑA: tras el último tramo de un nivel no hay bifurcación, sino la línea de meta
function placeFinish(r) {
  const z = r.genZ + 14;
  for (const l of allowedLanes(r)) coinLine(l, r.genZ, z - 2, 0.3);
  add('finish', 0, z);
  r.finishZ = z;
  r.genHold = true;
}

// ---------- Destrucción ----------
export function screenOf(o) {
  const rz = Math.max(0.3, o.z - G.run.dist);
  return project(o.x, (o.y0 + Math.min(o.y1, 2)) / 2, rz); // y1 puede ser TALL: usar la altura visible
}

export function breakObj(o, cause = 'dash') {
  if (!o.alive) return;
  o.alive = false;
  const r = G.run;
  const sp = screenOf(o);
  const col = o.type === 'barrier' || o.type === 'mine' ? r.biome.obs2 : r.biome.obs;
  if (sp) {
    fx.burst(sp.x, sp.y, 26, col, 520, 6, 0.7, 700);
    fx.burst(sp.x, sp.y, 10, '#fff', 300, 3, 0.4, 0);
    fx.ring(sp.x, sp.y, col, 140 * Math.min(2, sp.s / 60), 0.35, 8);
  }
  sfx.brk();
  fx.shake(7);
  fx.hitstop(0.035);
  fx.vibe(15);
  // un golpe que absorbe el escudo es solo visual: ni puntos, ni combo, ni overdrive, ni cadena
  if (cause === 'shield') return;
  onBreak(o, cause, sp);
  if (r.stats.explosive && cause !== 'chain' && cause !== 'sweep') {
    if (sp) fx.ring(sp.x, sp.y, '#ff9f0a', 420, 0.5, 18);
    for (const o2 of r.objects) {
      if (o2.alive && isObstacle(o2) && Math.abs(o2.z - o.z) < 9 && o2 !== o) breakObj(o2, 'chain');
    }
  }
}

// Rompe todo obstáculo por delante (en los 3 carriles) hasta rzMax. Devuelve cuántos.
export function sweep(rzMax) {
  const r = G.run;
  let n = 0;
  for (const o of r.objects) {
    if (!o.alive || !isObstacle(o)) continue;
    const rz = o.z - r.dist;
    if (rz > 0 && rz < rzMax) {
      breakObj(o, 'sweep');
      n++;
    }
  }
  return n;
}

// LÁSER: rompe lo primero que haya en tu carril (y si es el núcleo del jefe, le hace daño)
// pierce = cuántos obstáculos atraviesa cada rayo; triple = un rayo por cada carril
export function fireLaser(pierce = 1, triple = false) {
  const r = G.run;
  const xs = triple ? allowedLanes(r).map((l) => l * LANE_W) : [G.player.x * LANE_W];
  const rays = [];
  let hits = 0;
  for (const px of xs) {
    const targets = r.objects
      .filter((o) => o.alive && (isObstacle(o) || (o.type === 'core' && !o.shield) || o.type === 'drone') && o.z - r.dist > 0 && o.z - r.dist < VIEW && (o.all || Math.abs(o.x - px) < 0.6))
      .sort((a, b) => a.z - b.z)
      .slice(0, pierce);
    rays.push({ x: px, rz: targets.length ? targets[targets.length - 1].z - r.dist : VIEW });
    for (const o of targets) {
      if (!o.alive) continue;
      if (o.type === 'core') onCore(o);
      else breakObj(o, 'dash');
      hits++;
    }
  }
  r.beam = { t: 0.18, rays };
  return hits;
}

export function quake() {
  const r = G.run, p = G.player;
  const range = Math.max(9, runSpeed(r) * 0.18) * (r.synergies.has('meteoro') ? 2 : 1);
  const px = p.x * LANE_W;
  const sp = project(px, 0, 1.5);
  if (sp) {
    fx.ring(sp.x, sp.y, r.biome.accent, 260, 0.4, 14);
    fx.shake(10);
  }
  let n = 0;
  for (const o of r.objects) {
    if (!o.alive || !isObstacle(o)) continue;
    const rz = o.z - r.dist;
    if (rz > 0 && rz < range && (o.all || Math.abs(o.x - px) < 0.8)) {
      breakObj(o, 'quake');
      n++;
    }
  }
  if (n && r.synergies.has('meteoro')) addScore(500 * n, '+METEORO', sp?.x, (sp?.y ?? 0) - 40, '#ff9f0a');
}

// ---------- Elementos de movimiento (F4) ----------
function teleport(dest) {
  const r = G.run, p = G.player;
  if (dest === r.blockedLane) return;
  const from = project(p.x * LANE_W, 0.4, 0);
  p.lane = dest;
  p.x = dest;
  const to = project(p.x * LANE_W, 0.4, 0);
  if (from) fx.ring(from.x, from.y, '#bf5af2', 140, 0.35, 10);
  if (to) {
    fx.ring(to.x, to.y, '#bf5af2', 200, 0.4, 12);
    fx.burst(to.x, to.y, 24, '#bf5af2', 420, 4, 0.5, 0);
  }
  r.portals = (r.portals || 0) + 1;
  fx.flash('#bf5af2', 0.25);
  sfx.dash();
  addScore(150, '🌀 PORTAL', to?.x, (to?.y ?? 0) - 40, '#bf5af2');
}

function onRamp() {
  const r = G.run, p = G.player;
  r.ramps = (r.ramps || 0) + 1;
  p.vy = r.stats.jumpV * RAMP_BOOST;
  p.air = true;
  p.jumps = 1;
  p.slide = 0;
  p.grind = null;
  const sp = project(p.x * LANE_W, 0.4, 0);
  if (sp) fx.burst(sp.x, sp.y, 20, TARGET_COL, 380, 4, 0.5, 300);
  fx.shake(6);
  sfx.jump();
  addScore(200, '🚀 ¡RAMPA!', sp?.x, (sp?.y ?? 0) - 50, TARGET_COL);
}

// Riel bajo la nave en esta distancia (o null)
export function railUnder(px, dist) {
  for (const o of G.run.objects) {
    if (o.alive && o.type === 'rail' && Math.abs(o.x - px * LANE_W) < 0.35 && dist >= o.z && dist <= o.z + o.len) return o;
  }
  return null;
}

// ---------- Resolución al cruzar el plano del jugador ----------
function resolve(o) {
  const r = G.run, p = G.player;
  const pb = playerBox();
  if (o.type === 'finish') return onFinish();
  if (o.type === 'fork') {
    if (!r.forkDone) {
      r.forkDone = true;
      for (const f of r.objects) if (f.type === 'fork') f.alive = false;
      onFork(r.forkRewards[Math.round(p.x)] ?? 'monedas');
    }
    return;
  }
  // PORTAL: si lo cruzas, te cambia al carril de destino
  if (o.type === 'portal') {
    if (Math.abs(pb.x - o.x) < 0.5) teleport(o.dest);
    return;
  }
  // RAMPA: pasar por ella en el suelo te lanza por los aires
  if (o.type === 'ramp') {
    if (Math.abs(pb.x - o.x) < 0.5 && !p.air) onRamp();
    return;
  }
  // DIANA: no hace daño; con DASH, overdrive o habilidad que rompe, se revienta
  if (o.type === 'drone') {
    const powered = p.dash > 0 || r.odTime > 0 || isActive(r.ability, 'ram');
    if (Math.abs(pb.x - o.x) < o.w / 2 + pb.hw && powered) breakObj(o, 'dash');
    return;
  }
  const hx = Math.abs(pb.x - o.x) < o.w / 2 + pb.hw;
  const hy = pb.y1 > o.y0 && pb.y0 < o.y1;
  // ARIETE: rompe todo lo que toca, como el dash
  const powered = p.dash > 0 || r.odTime > 0 || isActive(r.ability, 'ram');

  // NÚCLEO: tocarlo SIEMPRE daña al jefe (con DASH, overdrive o Ariete, doble). El blindado del
  // Censor solo cede a una embestida. Margen generoso: se pasa "por" el núcleo, no hay que clavarlo.
  if (o.type === 'core') {
    if (Math.abs(pb.x - o.x) < o.w / 2 + pb.hw + 0.15) onCore(o, powered);
    return;
  }
  // SALTO DOBLE: en el segundo salto, por encima de 1,9 m, se pasa por encima de muros y móviles
  if (hx && hy && p.jumps >= 2 && pb.y0 > JUMP_OVER && (o.type === 'wall' || o.type === 'mover')) return onJumpOver(o);
  if (hx && hy) {
    if (powered) return breakObj(o, 'dash');
    // FASE: intangible; atravesar algo cuenta como PERFECTO. Los disparos del Cazador sí te dan.
    if (isActive(r.ability, 'phase') && !o.hunter) return onNearMiss(o, true);
    if (p.invuln > 0 && !o.hunter) return;
    return onHit(o);
  }
  if (o.hunter) hunterDodged();
  if (p.dash > 0 && r.stats.wideDash) return breakObj(o, 'dash');

  const since = r.time - p.lastAction;
  const win = r.stats.nearWin;
  if (hx && !hy) {
    onNearMiss(o, since < 0.3 * win);
  } else if (!o.all) {
    const gap = Math.abs(pb.x - o.x) - (o.w / 2 + pb.hw);
    if (gap < 0.45 * win && since < 0.6 * win) onNearMiss(o, since < 0.28 * win);
  }
}

// ---------- Jefe ----------
// 5 jefes con forma y ataques propios (datos en bosses.js) y una segunda fase al 50% de vida.
const BOSS_RZ = 42;
export const BOSS_NAMES = BOSSES.map((b) => b.name);
const FORCED_BOSS = G.debug && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('boss') : null;

export function spawnBoss(r) {
  const lv = r.camp?.level;
  let def = BOSS_BY_ID[lv?.boss] || BOSS_BY_ID[FORCED_BOSS] || bossFor(Math.floor(r.section / 3));
  if (lv?.elite) def = makeElite(def, lv.elite.attack);
  const hp = bossHp(r.section, !!def.elite);
  r.boss = {
    def, id: def.id, name: def.name, hp, max: hp, phase: 0, calm: 1.5,
    x: 0, tx: 0, t: 0, coreT: 3, moveT: 1.2, escapeT: 45, flash: 0, timers: {}, beam: null,
  };
  if (r.hunter) r.hunter.leaving = true; // el jefe ya mete presión de sobra
  sfx.alarm();
  fx.banner('⚠ JEFE ⚠', def.name, def.color, true);
}

export const bossRz = () => BOSS_RZ + Math.sin(G.run.boss.t * 1.3) * 4;

// Carriles a los que atacar dejando siempre uno libre... y que ese carril sea SEGURO: sin nada que
// esquivar de carril en la pista mientras llega el ataque. Si no hay ninguno seguro, no se ataca
// (antes el rayo podía marcar los dos laterales con un muro en el central: no había salida).
// ¿Carril sin nada que esquivar de carril de aquí a `horizon` metros? Cuenta los peligros largos
// (lava) que ya empezaron: lo que importa es dónde ACABAN, no dónde empiezan.
function laneClear(r, l, horizon) {
  return !r.objects.some((o) => o.alive && o.need === 'lane' && (o.all || Math.abs(o.x - l * LANE_W) < 0.75)
    && o.z + (o.len || 0) - r.dist > -1 && o.z - r.dist < horizon);
}

function attackLanes(r, n) {
  const L = allowedLanes(r);
  const horizon = runSpeed(r) * 1.6;
  const safe = L.filter((l) => laneClear(r, l, horizon));
  if (!safe.length) return [];
  const free = r.aiRng.pick(safe);
  return r.aiRng.shuffle(L.filter((l) => l !== free)).slice(0, Math.min(n, L.length - 1));
}

const ATTACKS = {
  shots(r) {
    const L = allowedLanes(r);
    const lane = r.aiRng.chance(0.55) ? G.player.lane : r.aiRng.pick(L);
    const tall = r.aiRng.chance(0.35);
    add('shot', lane, r.dist + bossRz(), { vz: 16 + r.section, y1: tall ? TALL : 0.5, tall });
  },
  // lluvia de muros que caen desde el jefe hacia ti (siempre queda un carril)
  wallRain(r) {
    for (const l of attackLanes(r, 2)) add('wall', l, r.dist + bossRz(), { vz: 10 });
  },
  // rayo: marca carriles en el suelo y dispara al poco (hay tiempo de apartarse al ver la marca)
  beam(r, b) {
    const lanes = attackLanes(r, r.aiRng.chance(0.5) ? 2 : 1);
    if (lanes.length) b.beam = { lanes, t: 0.75 };
  },
  mines(r) {
    for (const l of attackLanes(r, 2)) add('mine', l, r.dist + bossRz(), { vz: 6 });
  },
  // succión: si llevas un rato sin moverte, te arrastra un carril hacia el suyo (nunca contra algo)
  suction(r, b) {
    const p = G.player;
    const target = p.lane + Math.sign(Math.round(b.x) - p.lane);
    if (target === p.lane || target === r.blockedLane || r.time - p.lastAction < 0.6) return;
    const blocked = r.objects.some((o) => o.alive && o.need === 'lane' && (o.all || Math.abs(o.x - target) < 0.75) && o.z - r.dist > -1 && o.z - r.dist < runSpeed(r) * 0.7);
    if (blocked) return;
    p.lane = target;
    fx.notice('🌀 ¡SUCCIÓN!', b.def.color);
    sfx.slide();
  },
  // ráfaga: disparos bajos en todos los carriles menos uno
  barrage(r) {
    for (const l of attackLanes(r, 2)) add('shot', l, r.dist + bossRz(), { vz: 14 + r.section, y1: 0.5, tall: false });
  },
  drones(r) {
    for (const l of attackLanes(r, 2)) add('drone', l, r.dist + bossRz());
  },
};

function updateBoss(r, dt) {
  const b = r.boss;
  b.t += dt;
  b.flash = Math.max(0, b.flash - dt * 4);
  if (b.dying) return;
  const L = allowedLanes(r);
  b.moveT -= dt;
  if (b.moveT <= 0) { b.moveT = 0.9 + r.aiRng.next() * 0.8; b.tx = r.aiRng.pick(L); }
  b.x += (b.tx - b.x) * Math.min(1, dt * 3);

  // rayo marcado: al acabar la marca, dispara muy rápido por esos carriles
  if (b.beam) {
    b.beam.t -= dt;
    if (b.beam.t <= 0) {
      for (const l of b.beam.lanes) add('shot', l, r.dist + 22, { vz: 30, y1: TALL, tall: true, beam: true });
      b.beam = null;
      sfx.dash();
      fx.shake(8);
    }
  }

  if (b.calm > 0) {
    b.calm -= dt; // respiro al aparecer y al cambiar de fase
  } else {
    for (const atk of b.def.phases[b.phase]) {
      // con un rayo marcado no se lanza nada más: la marca deja un carril libre y otro ataque
      // podría cerrarlo (pasaba en la fase 2 del Ojo: rayo en dos carriles + disparo al tercero)
      if (b.beam && atk !== 'beam') continue;
      b.timers[atk] = (b.timers[atk] ?? attackCooldown(atk, r.section, b.phase) * 0.5) - dt;
      if (b.timers[atk] <= 0 && !(atk === 'beam' && b.beam)) {
        b.timers[atk] = attackCooldown(atk, r.section, b.phase);
        ATTACKS[atk](r, b);
      }
    }
  }
  b.coreT -= dt;
  if (b.coreT <= 0) {
    b.coreT = 3.4;
    add('core', r.aiRng.pick(L), r.dist + bossRz(), { shield: !!b.def.shieldedCore });
  }
  b.escapeT -= dt;
  if (b.escapeT <= 0) bossEscaped();
}

export function hurtBoss(dmg = 1) {
  const r = G.run, b = r.boss;
  if (!b || b.dying) return;
  b.hp = Math.max(0, b.hp - dmg);
  b.flash = 1;
  const sp = project(b.x, 3.4, bossRz());
  if (sp) {
    fx.burst(sp.x, sp.y, 50, '#fff', 700, 7, 0.8, 300);
    fx.ring(sp.x, sp.y, b.def.color, 300, 0.5, 20);
  }
  fx.shake(18);
  fx.hitstop(0.08);
  fx.flash('#fff', 0.5);
  fx.vibe([40, 30, 40]);
  sfx.boom();
  if (b.hp <= 0) return bossDefeated();
  // FASE 2: a la mitad de vida cambia de ataques, tras un respiro y limpiando lo que había en pista
  if (b.phase === 0 && phaseOf(b.hp, b.max) === 1) {
    b.phase = 1;
    b.calm = 1.2;
    b.beam = null;
    b.timers = {};
    for (const o of r.objects) if (o.alive && o.type === 'shot') o.alive = false;
    fx.banner('¡FASE 2!', `${b.name} se enfurece`, b.def.color, true);
    sfx.alarm();
    progress('bossPhase');
  }
}

// ---------- Cazador: castiga quedarse quieto ----------
// Si pasas unos segundos sin actuar aparece un dron que marca tu carril y dispara.
// Sus disparos quitan escudo sin ventana de invulnerabilidad; esquivar 2 seguidos lo espanta.
export const HUNTER_RZ = 12;
const HUNTER_AIM = 0.5;

const hunterDelay = (r) => (r.mods.has('hunter') ? 1 : Math.max(1.5, 3 - r.hunters * 0.5));

function spawnHunter(r) {
  r.hunters++;
  r.hunter = { x: G.player.x, t: 0, fireT: 0.4, aimT: 0, aimLane: 0, shots: 0, dodged: 0, leaving: false, leaveT: 0 };
  sfx.alarm();
  fx.banner('⚠ CAZADOR', '¡muévete o te caza!', ACT_DODGE, true);
  fx.vibe([40, 40, 40]);
}

function updateHunter(r, dt) {
  const p = G.player;
  if (!r.hunter) {
    // nunca en el primer tramo (es donde se aprende) ni en una carrera (ya hay rivales)
    if (r.race) return;
    if (r.section >= 1 && !r.boss && r.odTime <= 0 && r.time - p.lastAction > hunterDelay(r)) spawnHunter(r);
    return;
  }
  const h = r.hunter;
  h.t += dt;
  if (h.leaving) {
    h.leaveT += dt;
    if (h.leaveT > 1) r.hunter = null;
    return;
  }
  h.x += (p.x - h.x) * Math.min(1, dt * 2.5); // sigue tu carril con retraso
  if (h.aimT > 0) {
    h.aimT -= dt;
    if (h.aimT <= 0) {
      h.shots++;
      add('shot', h.aimLane, r.dist + HUNTER_RZ, { vz: 6, hunter: true });
      sfx.dash();
      h.fireT = Math.max(0.55, 1.1 - 0.1 * h.shots);
    }
  } else if ((h.fireT -= dt) <= 0) {
    // solo se apunta si tienes adónde ir: un carril vecino libre durante el aviso y el disparo
    // (si no, con lava al lado no habría salida). Si no lo hay, se espera un momento.
    // (con margen: el carril de escape no debe cerrarse justo después, p. ej. al empezar un riel)
    const horizon = runSpeed(r) * (HUNTER_AIM + 1.6);
    const escape = allowedLanes(r).some((l) => Math.abs(l - p.lane) === 1 && l !== r.blockedLane && laneClear(r, l, horizon));
    if (!escape) {
      h.fireT = 0.15;
      return;
    }
    h.aimLane = p.lane;
    h.aimT = HUNTER_AIM;
    fx.notice('¡MUÉVETE!', ACT_DODGE);
    sfx.bump();
  }
}

// un disparo del Cazador ha pasado sin darte
function hunterDodged() {
  const h = G.run.hunter;
  if (!h || h.leaving) return;
  if (++h.dodged >= 2) {
    h.leaving = true;
    hunterEscaped();
  }
}

// ---------- Bucle del mundo ----------
export function updateWorld(dt) {
  const r = G.run;
  while (!r.genHold && r.genZ < r.dist + VIEW + 10) {
    if (r.genZ >= r.sectionEnd) ((r.camp && r.camp.left <= 0) || r.exp || r.race ? placeFinish : placeFork)(r);
    else genRow(r);
  }

  if (r.event?.id === 'coinrain') {
    r.rainAcc += r.speed * dt;
    while (r.rainAcc > 2.4) {
      r.rainAcc -= 2.4;
      for (const l of allowedLanes(r)) add('coin', l, r.dist + VIEW - 30, { y: 0.3 });
    }
  }

  if (r.boss) updateBoss(r, dt);
  updateHunter(r, dt);

  const p = G.player;
  const pb = playerBox();
  const supernova = r.odTime > 0 && r.synergies.has('supernova');
  const mag = supernova || r.event?.id === 'magstorm' ? 4 : r.stats.magnet;

  for (const o of r.objects) {
    if (!o.alive) continue;
    o.t += dt;
    if (o.vz && !(o.rollAt && o.z - r.dist > o.rollAt)) o.z -= o.vz * dt; // los rodillos esperan hasta ROLL_AT
    const rz = o.z - r.dist;

    // deja de cambiar de carril con ~0.45 s de margen, vaya a la velocidad que vaya
    // GLITCH: salta de carril de golpe a ~0,9 s del impacto (su fantasma lo avisa antes)
    if (o.type === 'glitch' && !o.jumped && rz < runSpeed(r) * 0.9) {
      o.jumped = true;
      const sp = screenOf(o);
      if (sp) fx.burst(sp.x, sp.y, 14, '#39ff14', 300, 4, 0.3, 0);
      o.lane = o.to;
      o.x = o.to * LANE_W;
      sfx.bump();
    }
    // LAVA: quema mientras estés dentro del río y en el suelo (saltar por encima vale)
    if (o.type === 'lava' && rz <= 0 && rz + o.len > 0 && Math.abs(pb.x - o.x) < 0.5 && pb.y0 < o.y1) {
      const powered = p.dash > 0 || r.odTime > 0 || isActive(r.ability, 'ram') || isActive(r.ability, 'phase');
      if (!powered && p.invuln <= 0 && !G.god) onHit(o);
    }
    if (o.type === 'mover') {
      // lejos cambia de carril; cerca deja de elegir, pero TERMINA el movimiento que llevaba
      // (antes se congelaba a medio camino y tapaba dos carriles a la vez)
      if (rz > Math.max(16, runSpeed(r) * 0.45)) {
        o.moveT -= dt;
        if (o.moveT <= 0) {
          o.moveT = 0.55;
          const opts = allowedLanes(r).filter((l) => l !== o.target);
          o.target = r.aiRng.pick(opts);
        }
      }
      o.x += (o.target * LANE_W - o.x) * Math.min(1, dt * 10);
      o.lane = o.target;
    }

    if (o.type === 'coin') {
      if (mag > 0 && rz < Math.max(6 + mag * 5, runSpeed(r) * (0.15 + mag * 0.1)) && rz > -1 && Math.abs(o.x - pb.x) < 0.6 + mag * 0.9) o.mag = true;
      if (o.mag) {
        const k = Math.min(1, dt * 14);
        o.x += (pb.x - o.x) * k;
        o.y += (pb.y0 + 0.3 - o.y) * k;
        o.z -= r.speed * dt * 0.9;
      }
      const rz2 = o.z - r.dist;
      if (o.rzPrev > -0.9 && rz2 < 0.9 && Math.abs(o.x - pb.x) < 0.55 && o.y > pb.y0 - 0.35 && o.y < pb.y1 + 0.55) {
        o.alive = false;
        onCoin(o);
      }
      o.rzPrev = rz2;
      continue;
    }

    if (o.rzPrev > 0 && rz <= 0) resolve(o);
    o.rzPrev = rz;
  }

  // limpieza
  if (r.objects.length > 40) {
    r.objects = r.objects.filter((o) => o.alive && o.z + (o.len || 0) - r.dist > -10); // un riel vive hasta su final
  }
  if (p.y < 0) p.y = 0;
}
