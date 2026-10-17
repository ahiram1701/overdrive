// Progresión a largo plazo: rango de piloto (XP), logros y colección. Módulo puro (testeable en Node):
// recibe el objeto de guardado para no depender del DOM ni de localStorage.

// ---------- Rango de piloto ----------
export const MAX_RANK = 30;

export function xpForRun(res) {
  return Math.floor(res.dist / 50 + res.near * 2 + res.section * 15 + res.bosses * 80 + (res.missionsDone || 0) * 40);
}

// XP necesaria para pasar del rango `rank` al siguiente
export const xpToNext = (rank) => Math.round(150 * Math.pow(rank, 1.4));

// gemas al alcanzar cada rango (la suma de los 30 rangos queda en ~1350 gemas)
export const rankGems = (rank) => 15 + rank * 2;

export function rankOf(xp) {
  let rank = 1, rest = xp;
  while (rank < MAX_RANK && rest >= xpToNext(rank)) {
    rest -= xpToNext(rank);
    rank++;
  }
  return { rank, into: rank >= MAX_RANK ? 0 : rest, need: rank >= MAX_RANK ? 0 : xpToNext(rank) };
}

// Suma XP y paga los rangos ganados. Devuelve [{ rank, gems }] (vacío si no se subió).
export function addXp(save, xp) {
  const before = rankOf(save.xp).rank;
  save.xp += Math.max(0, Math.floor(xp));
  const after = rankOf(save.xp).rank;
  const ups = [];
  for (let r = before + 1; r <= after; r++) {
    const gems = rankGems(r);
    save.gems += gems;
    ups.push({ rank: r, gems });
  }
  return ups;
}

// ---------- Logros ----------
// mode 'sum' = acumulado de por vida; 'best' = en una sola partida. tier = premio en gemas.
const T = { bronze: 20, silver: 40, gold: 80 };
export const ACHIEVEMENTS = [
  { id: 'near100', kind: 'near', mode: 'sum', n: 100, tier: 'bronze', name: 'Rozador', desc: '100 near-miss' },
  { id: 'near1k', kind: 'near', mode: 'sum', n: 1000, tier: 'silver', name: 'Al filo', desc: '1.000 near-miss' },
  { id: 'near5k', kind: 'near', mode: 'sum', n: 5000, tier: 'gold', name: 'Milímetro', desc: '5.000 near-miss' },
  { id: 'perf50', kind: 'perfect', mode: 'sum', n: 50, tier: 'bronze', name: 'Reflejos', desc: '50 near-miss PERFECTOS' },
  { id: 'perf500', kind: 'perfect', mode: 'sum', n: 500, tier: 'gold', name: 'Precisión quirúrgica', desc: '500 near-miss PERFECTOS' },
  { id: 'boss1', kind: 'boss', mode: 'sum', n: 1, tier: 'bronze', name: 'Cazajefes', desc: 'Derrota a tu primer jefe' },
  { id: 'boss10', kind: 'boss', mode: 'sum', n: 10, tier: 'silver', name: 'Verdugo', desc: 'Derrota a 10 jefes' },
  { id: 'boss50', kind: 'boss', mode: 'sum', n: 50, tier: 'gold', name: 'Exterminador', desc: 'Derrota a 50 jefes' },
  { id: 'bossNaked', kind: 'bossNoShield', mode: 'sum', n: 1, tier: 'silver', name: 'Sin red', desc: 'Derrota a un jefe sin escudos' },
  { id: 'coins1k', kind: 'coins', mode: 'sum', n: 1000, tier: 'bronze', name: 'Hucha', desc: '1.000 monedas' },
  { id: 'coins10k', kind: 'coins', mode: 'sum', n: 10000, tier: 'silver', name: 'Tesorero', desc: '10.000 monedas' },
  { id: 'od10', kind: 'od', mode: 'sum', n: 10, tier: 'bronze', name: 'Sobrecalentado', desc: 'OVERDRIVE 10 veces' },
  { id: 'od100', kind: 'od', mode: 'sum', n: 100, tier: 'silver', name: 'Fusión del núcleo', desc: 'OVERDRIVE 100 veces' },
  { id: 'syn1', kind: 'synergy', mode: 'sum', n: 1, tier: 'bronze', name: 'Química', desc: 'Activa una sinergia' },
  { id: 'syn10', kind: 'synergy', mode: 'sum', n: 10, tier: 'silver', name: 'Alquimista', desc: 'Activa 10 sinergias' },
  { id: 'hunter1', kind: 'hunter', mode: 'sum', n: 1, tier: 'bronze', name: 'Presa escurridiza', desc: 'Escapa del Cazador' },
  { id: 'hunter10', kind: 'hunter', mode: 'sum', n: 10, tier: 'silver', name: 'Fantasma', desc: 'Escapa del Cazador 10 veces' },
  { id: 'sec5', kind: 'section', mode: 'best', n: 5, tier: 'bronze', name: 'Explorador', desc: 'Llega al tramo 5' },
  { id: 'sec10', kind: 'section', mode: 'best', n: 10, tier: 'silver', name: 'Veterano', desc: 'Llega al tramo 10' },
  { id: 'sec15', kind: 'section', mode: 'best', n: 15, tier: 'gold', name: 'Leyenda', desc: 'Llega al tramo 15' },
  { id: 'mach1', kind: 'speed', mode: 'best', n: 1235, tier: 'bronze', name: 'Barrera del sonido', desc: 'Alcanza MACH 1' },
  { id: 'mach2', kind: 'speed', mode: 'best', n: 2470, tier: 'gold', name: 'Hipersónico', desc: 'Alcanza MACH 2' },
  { id: 'mult50', kind: 'mult', mode: 'best', n: 50, tier: 'silver', name: 'Imparable', desc: 'Combo x50' },
  { id: 'mult99', kind: 'mult', mode: 'best', n: 99, tier: 'gold', name: 'Máximo', desc: 'Combo x99' },
  { id: 'ab50', kind: 'ability', mode: 'sum', n: 50, tier: 'bronze', name: 'Manos rápidas', desc: 'Usa 50 habilidades' },
  { id: 'ab500', kind: 'ability', mode: 'sum', n: 500, tier: 'silver', name: 'Especialista', desc: 'Usa 500 habilidades' },
  { id: 'runs10', kind: 'runs', mode: 'sum', n: 10, tier: 'bronze', name: 'Calentando motores', desc: 'Juega 10 partidas' },
  { id: 'runs100', kind: 'runs', mode: 'sum', n: 100, tier: 'silver', name: 'Adicto', desc: 'Juega 100 partidas' },
  { id: 'cards50', kind: 'cards', mode: 'sum', n: 50, tier: 'bronze', name: 'Coleccionista', desc: 'Elige 50 cartas' },
  { id: 'score1m', kind: 'score', mode: 'best', n: 1e6, tier: 'silver', name: 'Millonario', desc: '1 millón de puntos en una partida' },
  { id: 'score100m', kind: 'score', mode: 'best', n: 1e8, tier: 'gold', name: 'Astronómico', desc: '100 millones de puntos en una partida' },
  { id: 'camp1', kind: 'level', mode: 'sum', n: 1, tier: 'bronze', name: 'Recluta', desc: 'Supera tu primer nivel de campaña' },
  { id: 'camp16', kind: 'level', mode: 'sum', n: 16, tier: 'silver', name: 'Veterano', desc: 'Supera 16 niveles de campaña' },
  { id: 'stars48', kind: 'stars', mode: 'best', n: 48, tier: 'gold', name: 'Constelación', desc: 'Consigue las 48 estrellas de la campaña' },
  { id: 'mods3', kind: 'modsRun', mode: 'best', n: 3, tier: 'bronze', name: 'Mutante', desc: 'Llega al tramo 4 con 3 modificadores' },
  { id: 'mods6', kind: 'modsRun', mode: 'best', n: 6, tier: 'gold', name: 'Masoquista', desc: 'Llega al tramo 4 con 6 modificadores' },
  { id: 'mut7', kind: 'mutation', mode: 'sum', n: 7, tier: 'silver', name: 'Experimento', desc: 'Juega 7 mutaciones del día' },
];
export const ACH_GEMS = T;

// Registra progreso de logros. Devuelve los recién desbloqueados (ya pagados en gemas).
export function trackAch(save, kind, value = 1) {
  const done = [];
  for (const a of ACHIEVEMENTS) {
    if (a.kind !== kind) continue;
    const st = save.ach[a.id] || (save.ach[a.id] = { p: 0, done: false });
    if (st.done) continue;
    st.p = a.mode === 'sum' ? st.p + value : Math.max(st.p, value);
    if (st.p >= a.n) {
      st.p = a.n;
      st.done = true;
      save.gems += T[a.tier];
      done.push(a);
    }
  }
  return done;
}

export const achCount = (save) => ACHIEVEMENTS.filter((a) => save.ach[a.id]?.done).length;

// ---------- Colección ----------
// save.codex = { cards: { id: veces }, syn: { id: veces }, bosses: { nombre: veces } }
export function codexAdd(save, group, id) {
  const g = save.codex[group] || (save.codex[group] = {});
  const first = !g[id];
  g[id] = (g[id] || 0) + 1;
  return first;
}
