// Campaña: 4 sectores hechos a mano y, después, SECTORES GENERADOS SIN FIN (5, 6, 7…). Módulo puro.
// Cada nivel tiene semilla fija (siempre la misma pista), bioma propio y un número fijo de tramos;
// el último nivel de cada sector es un jefe. Los 4 primeros sectores se abren juntando estrellas;
// los generados, derrotando al jefe del sector anterior (el progreso nunca se atasca).
import { hashString, makeRng } from './rng.js';
import { BOSSES } from './bosses.js';
import { MODS } from './modifiers.js';

// Estrella: { kind, n?, text }. La primera estrella es siempre "superar el nivel".
const S = (kind, n, text) => ({ kind, n, text });

export const SECTORS = [
  {
    id: 's1', num: 1, name: 'DISTRITO NEÓN', biome: 0, need: 0, levels: [
      { id: '1-1', sections: 2, diff: 0, stars: [S('finish', 0, 'Llega a la meta'), S('near', 15, '15 near-miss'), S('noHit', 0, 'Sin perder escudos')], gems: 20 },
      { id: '1-2', sections: 2, diff: 1, stars: [S('finish', 0, 'Llega a la meta'), S('coins', 60, '60 monedas'), S('mult', 15, 'Combo x15')], gems: 25 },
      { id: '1-3', sections: 3, diff: 1, stars: [S('finish', 0, 'Llega a la meta'), S('perfect', 8, '8 near-miss PERFECTOS'), S('noHit', 0, 'Sin perder escudos')], gems: 30 },
      { id: '1-4', sections: 1, diff: 2, boss: 'gusano', stars: [S('boss', 0, 'Derrota al GUSANO'), S('noHit', 0, 'Sin perder escudos'), S('near', 10, '10 near-miss')], gems: 50 },
    ],
  },
  {
    id: 's2', num: 2, name: 'FORJA DE LAVA', biome: 1, need: 6, levels: [
      { id: '2-1', sections: 2, diff: 3, stars: [S('finish', 0, 'Llega a la meta'), S('near', 25, '25 near-miss'), S('coins', 80, '80 monedas')], gems: 30 },
      { id: '2-2', sections: 3, diff: 3, stars: [S('finish', 0, 'Llega a la meta'), S('mult', 25, 'Combo x25'), S('noHit', 0, 'Sin perder escudos')], gems: 35 },
      { id: '2-3', sections: 3, diff: 4, stars: [S('finish', 0, 'Llega a la meta'), S('perfect', 15, '15 PERFECTOS'), S('coins', 120, '120 monedas')], gems: 40 },
      { id: '2-4', sections: 1, diff: 5, boss: 'devorador', stars: [S('boss', 0, 'Derrota al DEVORADOR'), S('noHit', 0, 'Sin perder escudos'), S('perfect', 6, '6 PERFECTOS')], gems: 70 },
    ],
  },
  {
    id: 's3', num: 3, name: 'EL VACÍO', biome: 2, need: 15, levels: [
      { id: '3-1', sections: 2, diff: 5, stars: [S('finish', 0, 'Llega a la meta'), S('near', 35, '35 near-miss'), S('noHit', 0, 'Sin perder escudos')], gems: 40 },
      { id: '3-2', sections: 3, diff: 6, stars: [S('finish', 0, 'Llega a la meta'), S('mult', 35, 'Combo x35'), S('coins', 150, '150 monedas')], gems: 45 },
      { id: '3-3', sections: 3, diff: 7, stars: [S('finish', 0, 'Llega a la meta'), S('perfect', 20, '20 PERFECTOS'), S('noHit', 0, 'Sin perder escudos')], gems: 50 },
      { id: '3-4', sections: 1, diff: 8, boss: 'ojo', stars: [S('boss', 0, 'Derrota al OJO'), S('noHit', 0, 'Sin perder escudos'), S('near', 20, '20 near-miss')], gems: 90 },
    ],
  },
  {
    id: 's4', num: 4, name: 'HIPERESPACIO', biome: 3, need: 26, levels: [
      { id: '4-1', sections: 3, diff: 8, stars: [S('finish', 0, 'Llega a la meta'), S('near', 50, '50 near-miss'), S('coins', 180, '180 monedas')], gems: 50 },
      { id: '4-2', sections: 3, diff: 9, stars: [S('finish', 0, 'Llega a la meta'), S('mult', 50, 'Combo x50'), S('noHit', 0, 'Sin perder escudos')], gems: 55 },
      { id: '4-3', sections: 4, diff: 10, stars: [S('finish', 0, 'Llega a la meta'), S('perfect', 30, '30 PERFECTOS'), S('mult', 60, 'Combo x60')], gems: 60 },
      { id: '4-4', sections: 1, diff: 11, boss: 'censor', stars: [S('boss', 0, 'Derrota al CENSOR'), S('noHit', 0, 'Sin perder escudos'), S('perfect', 10, '10 PERFECTOS')], gems: 120 },
    ],
  },
];

export const LEVELS = SECTORS.flatMap((s) => s.levels.map((l) => ({ ...l, sector: s.id, biome: s.biome, sectorName: s.name })));
export const LEVEL_BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));
export const MAX_STARS = LEVELS.length * 3;

// stats de la partida: { finished, bossDefeated, near, perfect, coins, maxMult, hits }
export function levelStars(level, st) {
  return level.stars.map((s) => {
    switch (s.kind) {
      case 'finish': return !!st.finished;
      case 'boss': return !!st.bossDefeated;
      case 'noHit': return !!(st.finished || st.bossDefeated) && st.hits === 0;
      case 'near': return st.near >= s.n;
      case 'perfect': return st.perfect >= s.n;
      case 'coins': return st.coins >= s.n;
      case 'mult': return st.maxMult >= s.n;
      default: return false;
    }
  });
}

// ---------- Sectores generados ----------
// nombre + género (m, f, fp = femenino plural) y adjetivos con sus tres formas
const PREFIX = [['NEBULOSA', 'f'], ['CINTURÓN', 'm'], ['ABISMO', 'm'], ['CORONA', 'f'], ['FRONTERA', 'f'], ['TORMENTA', 'f'],
  ['RUINAS', 'fp'], ['VÓRTICE', 'm'], ['ARRECIFE', 'm'], ['DESIERTO', 'm'], ['CATEDRAL', 'f'], ['LABERINTO', 'm']];
const SUFFIX = [['ROTO', 'ROTA', 'ROTAS'], ['DE CRISTAL'], ['ESCARLATA', 'ESCARLATA', 'ESCARLATAS'], ['SILENCIOSO', 'SILENCIOSA', 'SILENCIOSAS'],
  ['DE PLASMA'], ['OLVIDADO', 'OLVIDADA', 'OLVIDADAS'], ['INFINITO', 'INFINITA', 'INFINITAS'], ['MAGNÉTICO', 'MAGNÉTICA', 'MAGNÉTICAS'],
  ['SOLAR', 'SOLAR', 'SOLARES'], ['FANTASMA'], ['BINARIO', 'BINARIA', 'BINARIAS'], ['SALVAJE', 'SALVAJE', 'SALVAJES']];
const nameOf = (rng) => {
  const [noun, g] = rng.pick(PREFIX), adj = rng.pick(SUFFIX);
  return `${noun} ${adj[{ m: 0, f: 1, fp: 2 }[g]] ?? adj[0]}`;
};
// En la campaña no tienen sentido Jefazos (cada nivel ya dice si hay jefe)
const CAMP_MODS = MODS.filter((m) => m.id !== 'bosses').map((m) => m.id);
export const FIXED_SECTORS = SECTORS.length;
export const ELITE_FROM = 6; // a partir de aquí, un sector de cada dos acaba en un JEFE ÉLITE

const genCache = new Map();
function genSector(n) {
  const rng = makeRng(hashString('sector-' + n));
  const name = nameOf(rng);
  const biome = rng.int(0, 3);
  // la mitad de los sectores mezclan dos biomas, alternando por tramo
  const biome2 = rng.chance(0.5) ? (biome + 1 + rng.int(0, 2)) % 4 : null;
  const base = 11 + (n - 4) * 1.5;
  const id = `s${n}`;
  const star = (kind, k) => {
    const N = { near: Math.round(20 + n * 4), perfect: Math.round(6 + n * 1.5), coins: Math.round(60 + n * 12), mult: Math.min(99, Math.round(15 + n * 4)) }[kind];
    const text = { near: `${N} near-miss`, perfect: `${N} PERFECTOS`, coins: `${N} monedas`, mult: `Combo x${N}`, noHit: 'Sin perder escudos' }[kind];
    return { kind, n: kind === 'noHit' ? 0 : N, text, k };
  };
  const extras = ['near', 'perfect', 'coins', 'mult', 'noHit'];
  const levels = [];
  for (let k = 1; k <= 3; k++) {
    const pool = rng.shuffle([...extras]);
    const mods = rng.shuffle([...CAMP_MODS]).slice(0, rng.chance(0.4 + Math.min(0.4, n * 0.02)) ? 2 : 1);
    levels.push({
      id: `${n}-${k}`, sections: rng.int(2, Math.min(5, 2 + Math.floor(n / 4))), diff: Math.round(base + (k - 1) * 0.5),
      mods: cleanPair(mods), stars: [{ kind: 'finish', n: 0, text: 'Llega a la meta' }, star(pool[0]), star(pool[1])], gems: 40 + n * 5,
    });
  }
  const boss = rng.pick(BOSSES);
  const lv4 = { id: `${n}-4`, sections: 1, diff: Math.round(base + 1.5), boss: boss.id, gems: 80 + n * 10, mods: [] };
  if (n >= ELITE_FROM && n % 2 === 0) {
    // ÉLITE: sus ataques de la fase 2 desde el principio + uno de otro jefe, y +50% de vida
    const partner = rng.pick(BOSSES.filter((b) => b.id !== boss.id));
    const extra = partner.phases[1].filter((a) => !boss.phases[1].includes(a));
    lv4.elite = { partner: partner.id, attack: extra.length ? rng.pick(extra) : null };
  }
  lv4.stars = [{ kind: 'boss', n: 0, text: `Derrota al jefe ${lv4.elite ? 'ÉLITE ' : ''}${boss.name}` }, star('noHit'), star(rng.pick(['near', 'perfect']))];
  levels.push(lv4);
  return { id, num: n, name, biome, biome2, generated: true, levels };
}

// Cristal y Frágil no van juntos (lo mismo que cleanMods, sin depender del rango)
const cleanPair = (ids) => (ids.includes('glass') && ids.includes('fragile') ? ids.filter((x) => x !== 'fragile') : ids);

// Sector n (1, 2, 3…): los 4 primeros, hechos a mano; el resto, generados (siempre iguales)
export function sectorAt(n) {
  if (n <= FIXED_SECTORS) return SECTORS[n - 1];
  if (!genCache.has(n)) genCache.set(n, genSector(n));
  return genCache.get(n);
}

const parseId = (id) => id.split('-').map(Number);

// Nivel por id ('2-3', '17-4'), con los datos de su sector
export function levelById(id) {
  if (LEVEL_BY_ID[id]) return LEVEL_BY_ID[id];
  const [n, k] = parseId(id);
  if (!(n > FIXED_SECTORS) || !(k >= 1 && k <= 4)) return null;
  const sec = sectorAt(n);
  return { ...sec.levels[k - 1], sector: sec.id, num: n, biome: sec.biome, biome2: sec.biome2, sectorName: sec.name };
}

const camp = (save) => save.campaign;
export const starsOf = (save, id) => camp(save)[id] || [false, false, false];
export const starCount = (stars) => stars.filter(Boolean).length;
// todas las estrellas, de los sectores fijos y de los generados
export const totalStars = (save) => Object.values(camp(save)).reduce((n, st) => n + (Array.isArray(st) ? starCount(st) : 0), 0);
export const isPassed = (save, id) => !!starsOf(save, id)[0];

// Los fijos se abren con estrellas; los generados, con el jefe del sector anterior
export function isSectorOpen(save, sectorId) {
  const n = Number(String(sectorId).replace('s', ''));
  if (n <= FIXED_SECTORS) return totalStars(save) >= SECTORS[n - 1].need;
  return isPassed(save, `${n - 1}-4`);
}

// Último sector abierto (los generados se abren de uno en uno)
export function frontier(save) {
  let n = FIXED_SECTORS;
  while (isSectorOpen(save, `s${n + 1}`)) n++;
  return n;
}

// Sectores que enseña el mapa: los abiertos y UNO cerrado más, para ver lo que viene
export const visibleSectors = (save) => Array.from({ length: frontier(save) + 1 }, (_, i) => sectorAt(i + 1));

// Un nivel se puede jugar si su sector está abierto y el anterior del sector está superado
export function isLevelOpen(save, id) {
  const [n, k] = parseId(id);
  if (!levelById(id) || !isSectorOpen(save, `s${n}`)) return false;
  return k === 1 || isPassed(save, `${n}-${k - 1}`);
}

// Guarda el resultado (cada estrella se queda con su mejor valor) y paga las gemas del nivel la
// primera vez que se supera. Devuelve { stars, newStars, gems }.
export function recordResult(save, id, stars) {
  const prev = starsOf(save, id);
  const merged = prev.map((s, i) => s || !!stars[i]);
  const newStars = merged.filter((s, i) => s && !prev[i]).length;
  let gems = 0;
  if (merged[0] && !prev[0]) gems += levelById(id).gems;
  gems += newStars * 5; // cada estrella nueva, un pequeño extra
  save.gems += gems;
  camp(save)[id] = merged;
  return { stars: merged, newStars, gems };
}

// El siguiente nivel siempre existe: tras el 4 de un sector viene el 1 del siguiente
export function nextLevel(id) {
  const [n, k] = parseId(id);
  return levelById(k < 4 ? `${n}-${k + 1}` : `${n + 1}-1`);
}
