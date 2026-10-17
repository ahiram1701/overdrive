// Misiones diarias: 3 retos al día (uno fácil, uno medio y uno difícil), iguales para todos
// porque se eligen con una semilla basada en la fecha. Dan gemas al completarse.
// Módulo puro: sin DOM, para poder testearlo en Node.
import { save } from './save.js';
import { makeRng, hashString, todayKey } from './rng.js';

export const GEMS = { easy: 15, medium: 25, hard: 40 };

// mode 'sum' = se acumula durante el día; 'best' = hay que lograrlo en una sola partida
export const POOL = [
  { kind: 'perfect', mode: 'sum', diff: 'easy', n: 15, text: 'Haz 15 near-miss PERFECTOS' },
  { kind: 'near', mode: 'sum', diff: 'easy', n: 60, text: 'Haz 60 near-miss' },
  { kind: 'coins', mode: 'sum', diff: 'easy', n: 200, text: 'Recoge 200 monedas' },
  { kind: 'od', mode: 'sum', diff: 'easy', n: 3, text: 'Activa el OVERDRIVE 3 veces' },
  { kind: 'section', mode: 'best', diff: 'easy', n: 4, text: 'Llega al tramo 4' },
  { kind: 'speed', mode: 'best', diff: 'easy', n: 800, text: 'Alcanza 800 km/h' },
  { kind: 'mult', mode: 'best', diff: 'easy', n: 30, text: 'Llega a x30 de combo' },
  { kind: 'daily', mode: 'sum', diff: 'easy', n: 1, text: 'Juega el reto diario' },
  { kind: 'arenaKills', mode: 'sum', diff: 'easy', n: 300, text: 'Elimina 300 enemigos en la ARENA' },

  { kind: 'perfect', mode: 'sum', diff: 'medium', n: 25, text: 'Haz 25 near-miss PERFECTOS' },
  { kind: 'near', mode: 'sum', diff: 'medium', n: 100, text: 'Haz 100 near-miss' },
  { kind: 'boss', mode: 'sum', diff: 'medium', n: 1, text: 'Derrota a un jefe' },
  { kind: 'coins', mode: 'sum', diff: 'medium', n: 400, text: 'Recoge 400 monedas' },
  { kind: 'od', mode: 'sum', diff: 'medium', n: 6, text: 'Activa el OVERDRIVE 6 veces' },
  { kind: 'section', mode: 'best', diff: 'medium', n: 6, text: 'Llega al tramo 6' },
  { kind: 'speed', mode: 'best', diff: 'medium', n: 1000, text: 'Alcanza 1000 km/h' },
  { kind: 'mult', mode: 'best', diff: 'medium', n: 50, text: 'Llega a x50 de combo' },
  { kind: 'synergy', mode: 'sum', diff: 'medium', n: 1, text: 'Activa una sinergia' },
  { kind: 'hunter', mode: 'sum', diff: 'medium', n: 2, text: 'Escapa del Cazador 2 veces' },
  { kind: 'arenaTime', mode: 'best', diff: 'medium', n: 300, text: 'Sobrevive 5 minutos en la ARENA' },

  { kind: 'perfect', mode: 'sum', diff: 'hard', n: 40, text: 'Haz 40 near-miss PERFECTOS' },
  { kind: 'boss', mode: 'sum', diff: 'hard', n: 2, text: 'Derrota a 2 jefes' },
  { kind: 'bossNoShield', mode: 'sum', diff: 'hard', n: 1, text: 'Derrota a un jefe sin escudos' },
  { kind: 'section', mode: 'best', diff: 'hard', n: 8, text: 'Llega al tramo 8' },
  { kind: 'speed', mode: 'best', diff: 'hard', n: 1600, text: 'Alcanza 1600 km/h' },
  { kind: 'mult', mode: 'best', diff: 'hard', n: 99, text: 'Llega a x99 de combo' },
  { kind: 'od', mode: 'sum', diff: 'hard', n: 10, text: 'Activa el OVERDRIVE 10 veces' },
];

// Las 3 misiones de un día: una de cada dificultad y de tipos distintos.
export function pickMissions(key) {
  const rng = makeRng(hashString('missions-' + key));
  const out = [];
  for (const diff of ['easy', 'medium', 'hard']) {
    const opts = POOL.filter((m) => m.diff === diff && !out.some((o) => o.kind === m.kind));
    const m = rng.pick(opts);
    out.push({ ...m, gems: GEMS[diff], progress: 0, done: false });
  }
  return out;
}

function ensure(key) {
  if (!save.missions || save.missions.key !== key) save.missions = { key, list: pickMissions(key) };
  return save.missions.list;
}

export const missions = {
  today(key = todayKey()) {
    return ensure(key);
  },

  // Registra progreso. Devuelve las misiones que se acaban de completar (ya pagadas en gemas).
  track(kind, value = 1, key = todayKey()) {
    const done = [];
    for (const m of ensure(key)) {
      if (m.done || m.kind !== kind) continue;
      m.progress = m.mode === 'sum' ? m.progress + value : Math.max(m.progress, value);
      if (m.progress >= m.n) {
        m.progress = m.n;
        m.done = true;
        save.gems += m.gems;
        done.push(m);
      }
    }
    return done;
  },
};
