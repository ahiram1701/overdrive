// CARRERAS: copas de 3 pistas contra 3 rivales IA y contra tu propio fantasma.
// Reglas puras (pistas, rivales, posiciones, puntos, fantasma) + la simulación de los rivales.
// En carrera chocar no mata: frena (como en un juego de carreras), así la carrera siempre acaba.
import { hashString, makeRng } from './rng.js';
import { trackSpeed } from './pacing.js';

// ---------- Copas y pistas ----------
// len: segundos de pista a la velocidad de referencia; diff: tramo equivalente (dificultad);
// skill: 0..1, lo bien que esquivan los rivales; pace: su ritmo respecto al tuyo
export const CUPS = [
  { id: 'c1', name: 'COPA NEÓN', color: '#ff2bd6', skill: 0.82, pace: 0.99, tracks: [
    { id: 'c1-1', name: 'Bulevar', biome: 0, len: 45, diff: 1 },
    { id: 'c1-2', name: 'Autopista rosa', biome: 0, len: 50, diff: 2 },
    { id: 'c1-3', name: 'Paso elevado', biome: 3, len: 55, diff: 3 },
  ] },
  { id: 'c2', name: 'COPA MAGMA', color: '#ff9500', skill: 0.88, pace: 1.02, tracks: [
    { id: 'c2-1', name: 'Fundición', biome: 1, len: 55, diff: 4 },
    { id: 'c2-2', name: 'Río de lava', biome: 1, len: 60, diff: 5 },
    { id: 'c2-3', name: 'El crisol', biome: 2, len: 65, diff: 6 },
  ] },
  { id: 'c3', name: 'COPA VACÍO', color: '#39ff14', skill: 0.93, pace: 1.05, tracks: [
    { id: 'c3-1', name: 'Fallo del sistema', biome: 2, len: 60, diff: 7 },
    { id: 'c3-2', name: 'Hiperenlace', biome: 3, len: 65, diff: 8 },
    { id: 'c3-3', name: 'Singularidad', biome: 3, len: 70, diff: 9 },
  ] },
];
export const TRACK_BY_ID = Object.fromEntries(CUPS.flatMap((c) => c.tracks.map((t, i) => [t.id, { ...t, cup: c.id, idx: i }])));
export const CUP_BY_ID = Object.fromEntries(CUPS.map((c) => [c.id, c]));

export const POINTS = [10, 6, 3, 1];
export const MEDALS = ['🥇', '🥈', '🥉'];

// Una copa se abre con cualquier medalla en la anterior
export const isCupOpen = (save, cupId) => {
  const i = CUPS.findIndex((c) => c.id === cupId);
  return i === 0 || save.raceCups[CUPS[i - 1].id] !== undefined;
};

// ---------- Rivales ----------
// personalidad: rammer (busca tu carril y empuja), clean (limpio y regular), turbo (acelerones)
export const RIVALS = [
  { name: 'BRUTO', color: '#ff6a00', mesh: 'brick', kind: 'rammer' },
  { name: 'SEDA', color: '#5affd9', mesh: 'ghost', kind: 'clean' },
  { name: 'CHISPA', color: '#ffe600', mesh: 'raptor', kind: 'turbo' },
];

export function makeRivals(cup, seed) {
  const rng = makeRng(hashString(`rivals-${seed}`));
  return RIVALS.map((d, i) => ({
    // salen por delante: hay que adelantarlos (y así se les ve correr)
    ...d, i, z: 14 - i * 5, lane: [-1, 0, 1][i], x: [-1, 0, 1][i], y: 0, vy: 0,
    skill: Math.min(0.98, cup.skill + (d.kind === 'clean' ? 0.04 : d.kind === 'rammer' ? -0.04 : 0)),
    pace: cup.pace * (1 + rng.range(-0.015, 0.015)), slowT: 0, boostT: 0, boostCd: rng.range(5, 9), bumpCd: 0,
    finishT: null, passed: new Set(), flash: 0,
  }));
}

// Avanza a los rivales. env = { objects, time, dist, playerLane, playerZ, laneTime } (sin tocar el RNG
// de la pista: los rivales usan el suyo). Devuelve eventos: [{ type: 'bump'|'crash'|'finish', rival }]
export function stepRivals(rivals, env, dt, rng, finishZ) {
  const out = [];
  for (const rv of rivals) {
    if (rv.finishT !== null) { rv.z += trackSpeed(rv.z, 1) * rv.pace * dt; continue; }
    rv.slowT = Math.max(0, rv.slowT - dt);
    rv.bumpCd = Math.max(0, rv.bumpCd - dt);
    rv.flash = Math.max(0, rv.flash - dt);
    // acelerones del TURBO
    if (rv.kind === 'turbo') {
      rv.boostCd -= dt;
      if (rv.boostCd <= 0) { rv.boostT = 1.8; rv.boostCd = rng.range(7, 11); }
    }
    rv.boostT = Math.max(0, rv.boostT - dt);
    // tirón elástico: ni se escapan para siempre ni se quedan tirados
    const gap = rv.z - env.playerZ;
    const band = gap > 70 ? 0.95 : gap < -50 ? 1.07 : 1;
    const speed = trackSpeed(Math.max(0, rv.z), 1) * rv.pace * band * (rv.slowT > 0 ? 0.45 : 1) * (rv.boostT > 0 ? 1.3 : 1);
    rv.z += speed * dt;
    // salto/deslizamiento visual
    rv.vy -= 30 * dt;
    rv.y = Math.max(0, rv.y + rv.vy * dt);
    if (rv.y === 0) rv.vy = 0;
    // obstáculos que cruza: con probabilidad `skill` los esquiva (cambia de carril, salta…)
    for (const o of env.objects) {
      if (!o.alive || !o.need || rv.passed.has(o)) continue;
      const rz = o.z - rv.z;
      // decidir un poco antes de llegar
      if (rz < 6 && rz > -1 && (o.all || Math.abs(o.x - rv.x) < 0.75)) {
        rv.passed.add(o);
        if (rng.next() < rv.skill) {
          if (o.need === 'jump') rv.vy = 9;
          else if (o.need === 'lane') {
            const free = [-1, 0, 1].filter((l) => l !== rv.lane && !env.objects.some((q) => q.alive && q.need === 'lane' && Math.abs(q.z - o.z) < 4 && (q.all || Math.abs(q.x - l) < 0.75)));
            if (free.length) rv.lane = free[Math.floor(rng.next() * free.length)];
          }
        } else {
          rv.slowT = 0.9;
          rv.flash = 0.4;
          out.push({ type: 'crash', rival: rv });
        }
      }
    }
    // el EMBESTIDOR busca tu carril cuando te tiene cerca
    if (rv.kind === 'rammer' && Math.abs(gap) < 6 && rv.lane !== env.playerLane && rng.next() < dt * 1.5) {
      rv.lane += Math.sign(env.playerLane - rv.lane);
    }
    rv.x += (rv.lane - rv.x) * Math.min(1, dt / env.laneTime * 0.5);
    // choque lateral/trasero con el jugador
    if (rv.bumpCd <= 0 && Math.abs(rv.x - env.playerX) < 0.7 && Math.abs(gap) < 1.6) {
      rv.bumpCd = 1;
      out.push({ type: 'bump', rival: rv });
    }
    if (rv.z >= finishZ && rv.finishT === null) {
      rv.finishT = env.time;
      out.push({ type: 'finish', rival: rv });
    }
  }
  return out;
}

// Tiempo estimado de llegada de un rival que aún no ha llegado (cuando acabas tú)
export function estimateFinish(rv, finishZ, time) {
  if (rv.finishT !== null) return rv.finishT;
  const left = Math.max(0, finishZ - rv.z);
  return time + left / (trackSpeed(Math.max(0, rv.z), 1) * rv.pace);
}

// Clasificación: por tiempo de llegada (los que han llegado) o por distancia (los que no)
export function standings(list) {
  return [...list].sort((a, b) => {
    if (a.finishT !== null && b.finishT !== null) return a.finishT - b.finishT;
    if (a.finishT !== null) return -1;
    if (b.finishT !== null) return 1;
    return b.z - a.z;
  });
}

// ---------- Fantasma ----------
// Muestras cada 0,1 s: [distancia·10, x·100, y·100] en enteros (pesa poco en localStorage)
export const GHOST_DT = 0.1;
export const encodeSample = (dist, x, y) => [Math.round(dist * 10), Math.round(x * 100), Math.round(y * 100)];

export function ghostAt(ghost, t) {
  if (!ghost || !ghost.d.length) return null;
  const f = t / GHOST_DT;
  const i = Math.min(ghost.d.length - 1, Math.floor(f));
  const j = Math.min(ghost.d.length - 1, i + 1);
  const k = Math.min(1, f - i);
  const a = ghost.d[i], b = ghost.d[j];
  const lerp = (p, q) => p + (q - p) * k;
  return { z: lerp(a[0], b[0]) / 10, x: lerp(a[1], b[1]) / 100, y: lerp(a[2], b[2]) / 100, done: f >= ghost.d.length - 1 };
}

// Puntos de la copa tras una carrera: order = ['you', 0, 1, 2] (índices de rival) en orden de llegada
export function addPoints(table, order) {
  const t = { ...table };
  order.forEach((who, pos) => { t[who] = (t[who] || 0) + POINTS[pos]; });
  return t;
}

// Medalla de la copa (0 oro, 1 plata, 2 bronce, null nada) según la tabla final
export function cupMedal(table) {
  const sorted = Object.entries(table).sort((a, b) => b[1] - a[1]);
  const pos = sorted.findIndex(([k]) => k === 'you');
  return pos <= 2 ? pos : null;
}
