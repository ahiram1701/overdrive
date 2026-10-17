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

// ---------- Prestigio ----------
// Al llegar al rango 30 puedes volver al rango 1: subes un nivel de prestigio, ganas un bonus de
// gemas permanente (+5% por nivel, hasta +50%) y premios exclusivos. Los rangos se vuelven a pagar
// y lo desbloqueado por rango NO se pierde (effectiveRank).
export const PRESTIGE_GEMS = 0.05;
export const PRESTIGE_GEMS_MAX = 0.5;
export const PRESTIGE_REWARDS = { 1: 'emblem:laurel', 2: 'palette:harlequin', 3: 'trail:prism', 5: 'frame:gold', 10: 'boom:singularity' };
export const PRESTIGE_EXTRA_GEMS = 200; // a partir del 11 (y en los niveles sin premio), gemas

export const prestigeOf = (save) => save.prestige || 0;
export const canPrestige = (save) => rankOf(save.xp).rank >= MAX_RANK;
export const prestigeBonus = (save) => Math.min(PRESTIGE_GEMS_MAX, prestigeOf(save) * PRESTIGE_GEMS);
// el rango que cuenta para desbloquear cosas: tras un prestigio, todo lo del rango 30 sigue abierto
export const effectiveRank = (save) => (prestigeOf(save) > 0 ? MAX_RANK : rankOf(save.xp).rank);

// Hace el prestigio. Devuelve { level, reward, gems } o null si aún no se puede.
export function doPrestige(save) {
  if (!canPrestige(save)) return null;
  save.prestige = prestigeOf(save) + 1;
  save.xp = 0;
  const reward = PRESTIGE_REWARDS[save.prestige] || null;
  const gems = reward ? 0 : PRESTIGE_EXTRA_GEMS;
  save.gems += gems;
  return { level: save.prestige, reward, gems };
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
  { id: 'sector10', kind: 'sector', mode: 'best', n: 10, tier: 'silver', name: 'Explorador', desc: 'Supera un nivel del sector 10' },
  { id: 'sector25', kind: 'sector', mode: 'best', n: 25, tier: 'gold', name: 'Más allá', desc: 'Supera un nivel del sector 25' },
  { id: 'elite1', kind: 'elite', mode: 'sum', n: 1, tier: 'silver', name: 'Cazaélites', desc: 'Derrota a un jefe ÉLITE' },
  { id: 'prest1', kind: 'prestige', mode: 'best', n: 1, tier: 'silver', name: 'Renacido', desc: 'Haz tu primer prestigio' },
  { id: 'prest5', kind: 'prestige', mode: 'best', n: 5, tier: 'gold', name: 'Leyenda', desc: 'Llega al prestigio 5' },
  { id: 'jump10', kind: 'jumpOver', mode: 'sum', n: 10, tier: 'bronze', name: 'Canguro', desc: 'Salta 10 muros con el salto doble' },
  { id: 'arena5', kind: 'arenaTime', mode: 'best', n: 300, tier: 'silver', name: 'Superviviente', desc: 'Sobrevive 5 minutos en la ARENA' },
  { id: 'arena10', kind: 'arenaTime', mode: 'best', n: 600, tier: 'gold', name: 'Gladiador', desc: 'Sobrevive 10 minutos en la ARENA' },
  { id: 'arenaK', kind: 'arenaKills', mode: 'sum', n: 1000, tier: 'silver', name: 'Exterminio', desc: 'Elimina 1.000 enemigos en la ARENA' },
  { id: 'evolve1', kind: 'evolve', mode: 'sum', n: 1, tier: 'bronze', name: 'Evolución', desc: 'Evoluciona un arma en la ARENA' },
  { id: 'exp1', kind: 'expAct', mode: 'best', n: 1, tier: 'bronze', name: 'Explorador', desc: 'Supera el primer acto de una EXPEDICIÓN' },
  { id: 'exp3', kind: 'expAct', mode: 'best', n: 3, tier: 'gold', name: 'Leyenda del mapa', desc: 'Completa una EXPEDICIÓN entera' },
  { id: 'expEv', kind: 'expEvent', mode: 'sum', n: 15, tier: 'bronze', name: 'Curioso', desc: 'Resuelve 15 eventos de EXPEDICIÓN' },
  { id: 'race1', kind: 'raceWin', mode: 'sum', n: 1, tier: 'bronze', name: 'Primera victoria', desc: 'Gana una carrera' },
  { id: 'race10', kind: 'raceWin', mode: 'sum', n: 10, tier: 'silver', name: 'Piloto', desc: 'Gana 10 carreras' },
  { id: 'cupGold', kind: 'cupGold', mode: 'sum', n: 3, tier: 'gold', name: 'Campeón', desc: 'Gana el oro en 3 copas' },
  { id: 'gal1', kind: 'asteroid', mode: 'sum', n: 50, tier: 'bronze', name: 'Minero', desc: 'Rompe 50 asteroides en la GALAXIA' },
  { id: 'gal2', kind: 'galaxyCredits', mode: 'sum', n: 5000, tier: 'silver', name: 'Magnate', desc: 'Gana 5.000 créditos en la GALAXIA' },
  { id: 'gal3', kind: 'galaxyUpgrade', mode: 'sum', n: 10, tier: 'silver', name: 'Mecánico', desc: 'Compra 10 mejoras para tu nave espacial' },
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
