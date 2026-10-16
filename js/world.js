// Mundo: biomas, generación procedural de tramos, obstáculos, monedas, bifurcaciones y jefe.
import { G, LANES, LANE_W, VIEW, clamp } from './state.js';
import { fx } from './fx.js';
import { sfx } from './audio.js';
import { project } from './render.js';
import { playerBox } from './player.js';
import { isActive } from './abilities.js';
import { trackSpeed } from './pacing.js';
import { onNearMiss, onBreak, onHit, onCoin, onFork, onCore, bossDefeated, bossEscaped, addScore, hunterEscaped } from './game.js';

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
  shot: { w: 0.6, y0: 0, y1: 0.5, depth: 0.6, need: 'lane' },
  core: { w: 0.8, y0: 0, y1: 1.2, depth: 0.8 },
  coin: { w: 0.5, y0: 0, y1: 0.5, depth: 0 },
  fork: { w: 0.95, y0: 0, y1: 2.2, depth: 0.3 },
};

const ACT_DODGE = '#ff3b6b'; // mismo magenta que "esquiva" en render.js

// velocidad real (con overdrive): los umbrales de reacción se miden en TIEMPO, no en metros,
// porque la velocidad no tiene tope y una distancia fija se vuelve imposible al final
export const runSpeed = (r = G.run) => r.speed * (r.odTime > 0 ? 1.5 : 1);

export const allowedLanes = (r) => LANES.filter((l) => l !== r.blockedLane);
const isObstacle = (o) => o.type !== 'coin' && o.type !== 'fork' && o.type !== 'core';

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
  coinArc(r, z, L, rng) {
    const l = rng.pick(L);
    add('barrier', l, z);
    coinArc(l, z);
    return 'lane';
  },
};

const WEIGHTS = {
  intro: { wall1: 3, wall2: 2, barrier3: 1.5, over3: 1.5, coinArc: 1.2 },
  neon: { wall1: 2.5, wall2: 2.5, barrier3: 2, over3: 2, mixed: 1.5, gate: 1.5, coinArc: 1 },
  lava: { mines: 3, laserLow: 2.5, laserHigh: 2, wall1: 1.5, mixed: 1, barrier3: 1 },
  glitch: { mover: 3, wall2: 2, mixed: 2, laserHigh: 1, mines: 1, wall1: 1 },
  hyper: { wall2: 2, gate: 2, mixed: 2.5, laserLow: 1.5, laserHigh: 1.5, mover: 1.5, mines: 1 },
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
  const pat = rng.weighted(pats).id;
  const kind = PATTERNS[pat](r, z, L, rng);

  // velocidad de referencia en esta distancia (no la del momento): el overdrive no cambia la pista
  const spd = trackSpeed(z, r.stats.speedMult);
  let tGap = 0.95 - clamp(r.section / 9, 0, 1) * 0.42;
  if (r.risk) tGap *= 0.8;
  if (r.boss) tGap *= 1.7;
  if (r.section === 0) tGap *= 1.15;
  let gap = Math.max(9, spd * tGap);
  if (kind === 'jump' || kind === 'mixed') gap = Math.max(gap, spd * 0.78);
  if (kind === 'slide') gap = Math.max(gap, spd * 0.66);

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
  if (r.stats.explosive && cause !== 'chain') {
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
      breakObj(o, 'chain');
      n++;
    }
  }
  return n;
}

// LÁSER: rompe lo primero que haya en tu carril (y si es el núcleo del jefe, le hace daño)
export function fireLaser() {
  const r = G.run, px = G.player.x * LANE_W;
  let best = null, bestRz = VIEW;
  for (const o of r.objects) {
    if (!o.alive || !(isObstacle(o) || o.type === 'core')) continue;
    const rz = o.z - r.dist;
    if (rz > 0 && rz < bestRz && (o.all || Math.abs(o.x - px) < 0.6)) {
      best = o;
      bestRz = rz;
    }
  }
  r.beam = { x: px, rz: bestRz, t: 0.18 };
  if (!best) return null;
  if (best.type === 'core') onCore(best);
  else breakObj(best, 'dash');
  return best;
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

// ---------- Resolución al cruzar el plano del jugador ----------
function resolve(o) {
  const r = G.run, p = G.player;
  const pb = playerBox();
  if (o.type === 'fork') {
    if (!r.forkDone) {
      r.forkDone = true;
      for (const f of r.objects) if (f.type === 'fork') f.alive = false;
      onFork(r.forkRewards[Math.round(p.x)] ?? 'monedas');
    }
    return;
  }
  const hx = Math.abs(pb.x - o.x) < o.w / 2 + pb.hw;
  const hy = pb.y1 > o.y0 && pb.y0 < o.y1;
  // ARIETE: rompe todo lo que toca, como el dash
  const powered = p.dash > 0 || r.odTime > 0 || isActive(r.ability, 'ram');

  if (o.type === 'core') {
    if (hx && powered) onCore(o);
    return;
  }
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
const BOSS_RZ = 42;
const BOSS_NAMES = ['GUSANO DE NEÓN', 'OJO DEL VACÍO', 'DEVORADOR', 'EL CENSOR', 'MAMÁ OVNI'];

export function spawnBoss(r) {
  const hp = 3 + Math.floor(r.section / 3);
  r.boss = {
    hp, max: hp, x: 0, tx: 0, t: 0, fireT: 2, coreT: 3, moveT: 1.2, escapeT: 45, flash: 0,
    name: BOSS_NAMES[Math.floor(r.section / 3) % BOSS_NAMES.length],
  };
  if (r.hunter) r.hunter.leaving = true; // el jefe ya mete presión de sobra
  sfx.alarm();
  fx.banner('⚠ JEFE ⚠', r.boss.name, '#ff2d55', true);
}

export const bossRz = () => BOSS_RZ + Math.sin(G.run.boss.t * 1.3) * 4;

function updateBoss(r, dt) {
  const b = r.boss;
  b.t += dt;
  b.flash = Math.max(0, b.flash - dt * 4);
  if (b.dying) return;
  const L = allowedLanes(r);
  b.moveT -= dt;
  if (b.moveT <= 0) { b.moveT = 0.9 + r.aiRng.next() * 0.8; b.tx = r.aiRng.pick(L); }
  b.x += (b.tx - b.x) * Math.min(1, dt * 3);

  b.fireT -= dt;
  if (b.fireT <= 0) {
    b.fireT = Math.max(0.55, 1.35 - r.section * 0.04);
    const lane = r.aiRng.chance(0.55) ? G.player.lane : r.aiRng.pick(L);
    const tall = r.aiRng.chance(0.35);
    add('shot', lane, r.dist + bossRz(), { vz: 16 + r.section, y1: tall ? TALL : 0.5, tall });
  }
  b.coreT -= dt;
  if (b.coreT <= 0) {
    b.coreT = 3.4;
    add('core', r.aiRng.pick(L), r.dist + bossRz());
  }
  b.escapeT -= dt;
  if (b.escapeT <= 0) bossEscaped();
}

export function hurtBoss() {
  const b = G.run.boss;
  if (!b || b.dying) return;
  b.hp--;
  b.flash = 1;
  const sp = project(b.x, 3.4, bossRz());
  if (sp) {
    fx.burst(sp.x, sp.y, 50, '#fff', 700, 7, 0.8, 300);
    fx.ring(sp.x, sp.y, '#ff2d55', 300, 0.5, 20);
  }
  fx.shake(18);
  fx.hitstop(0.08);
  fx.flash('#fff', 0.5);
  fx.vibe([40, 30, 40]);
  sfx.boom();
  if (b.hp <= 0) bossDefeated();
}

// ---------- Cazador: castiga quedarse quieto ----------
// Si pasas unos segundos sin actuar aparece un dron que marca tu carril y dispara.
// Sus disparos quitan escudo sin ventana de invulnerabilidad; esquivar 2 seguidos lo espanta.
export const HUNTER_RZ = 12;
const HUNTER_AIM = 0.5;

const hunterDelay = (r) => Math.max(1.5, 3 - r.hunters * 0.5);

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
    // nunca en el primer tramo: es donde se aprende a jugar
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
    if (r.genZ >= r.sectionEnd) placeFork(r);
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
  const mag = supernova ? 4 : r.stats.magnet;

  for (const o of r.objects) {
    if (!o.alive) continue;
    o.t += dt;
    if (o.vz) o.z -= o.vz * dt;
    const rz = o.z - r.dist;

    // deja de cambiar de carril con ~0.45 s de margen, vaya a la velocidad que vaya
    if (o.type === 'mover' && rz > Math.max(16, runSpeed(r) * 0.45)) {
      o.moveT -= dt;
      if (o.moveT <= 0) {
        o.moveT = 0.55;
        const opts = allowedLanes(r).filter((l) => l !== o.target);
        o.target = r.aiRng.pick(opts);
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
    r.objects = r.objects.filter((o) => o.alive && o.z - r.dist > -10);
  }
  if (p.y < 0) p.y = 0;
}
