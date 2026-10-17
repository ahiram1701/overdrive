// Campaña: 4 sectores x 4 niveles con 3 estrellas cada uno. Módulo puro (recibe el guardado).
// Cada nivel tiene semilla fija (siempre la misma pista), bioma propio y un número fijo de tramos;
// el último nivel de cada sector es un jefe. Los sectores se abren juntando estrellas.

// Estrella: { kind, n?, text }. La primera estrella es siempre "superar el nivel".
const S = (kind, n, text) => ({ kind, n, text });

export const SECTORS = [
  {
    id: 's1', name: 'DISTRITO NEÓN', biome: 0, need: 0, levels: [
      { id: '1-1', sections: 2, diff: 0, stars: [S('finish', 0, 'Llega a la meta'), S('near', 15, '15 near-miss'), S('noHit', 0, 'Sin perder escudos')], gems: 20 },
      { id: '1-2', sections: 2, diff: 1, stars: [S('finish', 0, 'Llega a la meta'), S('coins', 60, '60 monedas'), S('mult', 15, 'Combo x15')], gems: 25 },
      { id: '1-3', sections: 3, diff: 1, stars: [S('finish', 0, 'Llega a la meta'), S('perfect', 8, '8 near-miss PERFECTOS'), S('noHit', 0, 'Sin perder escudos')], gems: 30 },
      { id: '1-4', sections: 1, diff: 2, boss: 'gusano', stars: [S('boss', 0, 'Derrota al GUSANO'), S('noHit', 0, 'Sin perder escudos'), S('near', 10, '10 near-miss')], gems: 50 },
    ],
  },
  {
    id: 's2', name: 'FORJA DE LAVA', biome: 1, need: 6, levels: [
      { id: '2-1', sections: 2, diff: 3, stars: [S('finish', 0, 'Llega a la meta'), S('near', 25, '25 near-miss'), S('coins', 80, '80 monedas')], gems: 30 },
      { id: '2-2', sections: 3, diff: 3, stars: [S('finish', 0, 'Llega a la meta'), S('mult', 25, 'Combo x25'), S('noHit', 0, 'Sin perder escudos')], gems: 35 },
      { id: '2-3', sections: 3, diff: 4, stars: [S('finish', 0, 'Llega a la meta'), S('perfect', 15, '15 PERFECTOS'), S('coins', 120, '120 monedas')], gems: 40 },
      { id: '2-4', sections: 1, diff: 5, boss: 'devorador', stars: [S('boss', 0, 'Derrota al DEVORADOR'), S('noHit', 0, 'Sin perder escudos'), S('perfect', 6, '6 PERFECTOS')], gems: 70 },
    ],
  },
  {
    id: 's3', name: 'EL VACÍO', biome: 2, need: 15, levels: [
      { id: '3-1', sections: 2, diff: 5, stars: [S('finish', 0, 'Llega a la meta'), S('near', 35, '35 near-miss'), S('noHit', 0, 'Sin perder escudos')], gems: 40 },
      { id: '3-2', sections: 3, diff: 6, stars: [S('finish', 0, 'Llega a la meta'), S('mult', 35, 'Combo x35'), S('coins', 150, '150 monedas')], gems: 45 },
      { id: '3-3', sections: 3, diff: 7, stars: [S('finish', 0, 'Llega a la meta'), S('perfect', 20, '20 PERFECTOS'), S('noHit', 0, 'Sin perder escudos')], gems: 50 },
      { id: '3-4', sections: 1, diff: 8, boss: 'ojo', stars: [S('boss', 0, 'Derrota al OJO'), S('noHit', 0, 'Sin perder escudos'), S('near', 20, '20 near-miss')], gems: 90 },
    ],
  },
  {
    id: 's4', name: 'HIPERESPACIO', biome: 3, need: 26, levels: [
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

const camp = (save) => save.campaign;
export const starsOf = (save, id) => camp(save)[id] || [false, false, false];
export const starCount = (stars) => stars.filter(Boolean).length;
export const totalStars = (save) => LEVELS.reduce((n, l) => n + starCount(starsOf(save, l.id)), 0);
export const isPassed = (save, id) => !!starsOf(save, id)[0];

export const isSectorOpen = (save, sectorId) => totalStars(save) >= SECTORS.find((s) => s.id === sectorId).need;

// Un nivel se puede jugar si su sector está abierto y el anterior del sector está superado
export function isLevelOpen(save, id) {
  const lv = LEVEL_BY_ID[id];
  const sec = SECTORS.find((s) => s.id === lv.sector);
  if (!isSectorOpen(save, sec.id)) return false;
  const i = sec.levels.findIndex((l) => l.id === id);
  return i === 0 || isPassed(save, sec.levels[i - 1].id);
}

// Guarda el resultado (cada estrella se queda con su mejor valor) y paga las gemas del nivel la
// primera vez que se supera. Devuelve { stars, newStars, gems }.
export function recordResult(save, id, stars) {
  const prev = starsOf(save, id);
  const merged = prev.map((s, i) => s || !!stars[i]);
  const newStars = merged.filter((s, i) => s && !prev[i]).length;
  let gems = 0;
  if (merged[0] && !prev[0]) gems += LEVEL_BY_ID[id].gems;
  gems += newStars * 5; // cada estrella nueva, un pequeño extra
  save.gems += gems;
  camp(save)[id] = merged;
  return { stars: merged, newStars, gems };
}

export function nextLevel(id) {
  const i = LEVELS.findIndex((l) => l.id === id);
  return LEVELS[i + 1] || null;
}
