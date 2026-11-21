// GALAXIA: INCURSIÓN DIARIA. Módulo puro (se testea en Node).
// Un sector sellado, el mismo para todos cada día (semilla del día): 10 oleadas cada vez más duras,
// con jefes en la 5 y la 10. Puntúa con la RACHA y el tiempo, da medallas 🥉🥈🥇 y paga créditos y,
// una vez al día por medalla nueva, GEMAS: la Galaxia también alimenta la progresión común.
import { makeRng, hashString } from './rng.js';

export const WAVES = 10;
export const ARENA_R = 900; // radio del sector sellado
export const WAVE_PAUSE = 3; // segundos entre oleadas
export const MEDALS = [
  { id: 'bronze', icon: '🥉', name: 'Bronce', waves: 4, gems: 10 },
  { id: 'silver', icon: '🥈', name: 'Plata', waves: 7, gems: 20 },
  { id: 'gold', icon: '🥇', name: 'Oro', waves: 10, gems: 40 },
];
export const medalFor = (waves) => [...MEDALS].reverse().find((m) => waves >= m.waves) || null;
export const medalRank = (id) => MEDALS.findIndex((m) => m.id === id);

// Las oleadas del día: cuántos, de qué peligro y si hay jefe (determinista por la fecha)
export function wavesFor(day) {
  const rng = makeRng(hashString(`incursion-${day}`));
  const kinds = ['fighter', 'interceptor', 'drone', 'bomber', 'corvette', 'minelayer', 'stalker'];
  const theme = rng.pick(kinds.slice(1)); // cada día, un tipo protagonista
  return Array.from({ length: WAVES }, (_, i) => {
    const w = i + 1;
    const danger = Math.min(6, 1 + Math.floor(w / 2));
    const n = 2 + w + (w >= 8 ? 1 : 0);
    const list = Array.from({ length: n }, () => (rng.next() < 0.35 ? theme : rng.pick(kinds.slice(0, 2 + Math.min(5, Math.floor(w / 2))))));
    return { wave: w, danger, list, boss: w === 5 || w === 10 };
  });
}
export const themeOf = (day) => {
  const counts = {};
  for (const w of wavesFor(day)) for (const k of w.list) counts[k] = (counts[k] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
};

// Puntos: cada baja vale más con la racha y en oleadas altas; acabar rápido suma
export const killScore = (wave, streakMul, boss = false) => Math.round((boss ? 1500 : 100 + 20 * wave) * streakMul);
export const waveBonus = (wave, secs) => Math.round(250 * wave * Math.max(0.3, 1 - secs / 90));
export const creditsFor = (score) => Math.round(score / 8);

// Resultado del día: guarda la mejor marca y da las gemas de las medallas NUEVAS de hoy
export function recordRun(rec, day, waves, score) {
  const r = rec && rec.day === day ? { ...rec } : { day, best: 0, waves: 0, medal: null };
  const medal = medalFor(waves);
  let gems = 0;
  if (medal && medalRank(medal.id) > medalRank(r.medal)) {
    for (const m of MEDALS) if (medalRank(m.id) > medalRank(r.medal) && medalRank(m.id) <= medalRank(medal.id)) gems += m.gems;
    r.medal = medal.id;
  }
  const isBest = score > r.best;
  r.best = Math.max(r.best, score);
  r.waves = Math.max(r.waves, waves);
  return { rec: r, gems, medal, isBest };
}
