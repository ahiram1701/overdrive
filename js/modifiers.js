// Modificadores: reglas que cambian la partida a cambio de más puntos y gemas. Módulo puro.
// Se desbloquean poco a poco con el rango (siempre hay uno nuevo a la vista) y cada día hay una
// "mutación" con dos de ellos y la misma pista para todos.
import { hashString, makeRng } from './rng.js';

// score: multiplicador de puntos. apply(r) cambia la partida al empezar; el resto de reglas las
// leen world.js / game.js con r.mods.has(id).
export const MODS = [
  { id: 'turbo', name: 'Turbo', icon: '🚀', score: 1.3, rank: 1, desc: '+25% de velocidad', apply: (r) => { r.stats.speedMult *= 1.25; } },
  { id: 'chaos', name: 'Caos', icon: '🌀', score: 1.3, rank: 2, desc: 'Un evento en cada tramo' },
  { id: 'mines', name: 'Campo minado', icon: '💣', score: 1.25, rank: 3, desc: 'Muchas más minas en la pista' },
  { id: 'glass', name: 'Cristal', icon: '🥂', score: 1.6, rank: 4, desc: 'Sin escudos. Ni uno.', apply: (r) => { r.shieldCap = 0; } },
  { id: 'bosses', name: 'Jefazos', icon: '👾', score: 1.5, rank: 5, desc: 'Un jefe cada 2 tramos' },
  { id: 'hunter', name: 'Cazador voraz', icon: '🎯', score: 1.3, rank: 6, desc: 'El Cazador sale con 1 s quieto' },
  { id: 'greed', name: 'Avaricia', icon: '🤑', score: 1.2, rank: 8, desc: 'Monedas x2, pero filas más juntas', apply: (r) => { r.stats.coinValue *= 2; } },
  { id: 'lowgrav', name: 'Ingravidez', icon: '🪐', score: 1.15, rank: 10, desc: 'Gravedad baja todo el rato', apply: (r) => { r.stats.gravity *= 0.6; r.stats.jumpV *= 0.78; } },
  { id: 'fragile', name: 'Frágil', icon: '🩹', score: 1.2, rank: 12, desc: 'Como mucho 1 escudo', apply: (r) => { r.shieldCap = Math.min(r.shieldCap ?? 1, 1); } },
  { id: 'nodash', name: 'Sin DASH', icon: '🚫', score: 1.3, rank: 14, desc: 'El DASH no existe', apply: (r) => { r.noDash = true; r.stats.dashMax = 0; r.dashCharges = 0; } },
  { id: 'fog', name: 'Niebla', icon: '🌫️', score: 1.4, rank: 16, desc: 'Solo ves lo que tienes cerca' },
  { id: 'upside', name: 'Al revés', icon: '🙃', score: 1.3, rank: 18, desc: 'El mundo boca abajo' },
];
export const MOD_BY_ID = Object.fromEntries(MODS.map((m) => [m.id, m]));

// Pareja de modificadores que se anulan (Cristal ya no tiene escudos: Frágil no añade nada)
const CLASH = [['glass', 'fragile']];

export const modsUnlocked = (rank) => MODS.filter((m) => rank >= m.rank);

// Limpia una selección: ids válidos, desbloqueados y sin choques
export function cleanMods(ids, rank = Infinity) {
  const out = [];
  for (const id of ids || []) {
    const m = MOD_BY_ID[id];
    if (!m || rank < m.rank || out.includes(id)) continue;
    if (CLASH.some(([a, b]) => (id === a && out.includes(b)) || (id === b && out.includes(a)))) continue;
    out.push(id);
  }
  return out;
}

// Multiplicador de puntos: el producto de todos
export const modScore = (ids) => ids.reduce((k, id) => k * (MOD_BY_ID[id]?.score || 1), 1);
// Las gemas ya suben con los puntos (raíz cuadrada); el extra directo es la mitad y con tope x3
export const modGems = (ids) => Math.min(3, 1 + (modScore(ids) - 1) * 0.5);

// Activa cuando se pulsa un modificador en el panel (quita lo que choque con él)
export function toggleMod(ids, id) {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  const rival = CLASH.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []));
  return [...ids.filter((x) => !rival.includes(x)), id];
}

// MUTACIÓN DEL DÍA: dos modificadores sacados de la fecha (los mismos para todos; da igual el rango)
export function mutationOf(dayKey) {
  const rng = makeRng(hashString('mut-' + dayKey));
  const pool = [...MODS];
  const out = [];
  while (out.length < 2) {
    const m = pool.splice(rng.int(0, pool.length - 1), 1)[0];
    if (cleanMods([...out, m.id]).length === out.length + 1) out.push(m.id);
  }
  return out;
}
