// GALAXIA: RIESGO de verdad. Módulo puro (se testea en Node).
// - DIFICULTAD (en Ajustes): Relajado (te remolcan gratis y con el casco nuevo), Piloto (por defecto:
//   pagas el remolque, vuelves con medio casco y tu carga queda en un PECIO PROPIO donde caíste) y
//   Veterano (además pierdes materiales y los piratas pegan y aguantan más).
// - PECIO PROPIO: recupéralo antes de unos saltos o lo saquean.
// - BOTÍN JUGOSO: con mucha carga valiosa, al llegar a un sistema te pueden esperar.
// - PRIMA DE BÚSQUEDA: cada ⭐ paga más por cada pirata. Ser buscado es una apuesta.

export const DIFFS = {
  relaxed: { icon: '🌙', name: 'Relajado', desc: 'Si te destruyen, te remolcan gratis con la nave reparada. Solo pierdes la carga.' },
  pilot: { icon: '🚀', name: 'Piloto', desc: 'Pagas el remolque, vuelves con medio casco y tu carga queda en tu pecio: ve a por ella.' },
  veteran: { icon: '☠️', name: 'Veterano', desc: 'Como Piloto, pero el remolque es más caro, pierdes materiales y los piratas son más duros.' },
};
export const DIFF_KEYS = Object.keys(DIFFS);
export const diffOf = (g) => (DIFFS[g?.difficulty] ? g.difficulty : 'pilot');
export const nextDiff = (d) => DIFF_KEYS[(DIFF_KEYS.indexOf(d) + 1) % DIFF_KEYS.length];

// Remolque: un porcentaje de lo que llevas, con tope según el peligro del sistema
export function towFee(credits, danger, diff) {
  if (diff === 'relaxed') return 0;
  const vet = diff === 'veteran';
  const pct = vet ? 0.25 : 0.15, cap = vet ? 650 + 500 * danger : 400 + 320 * danger; // (los premios crecen ahora igual que la amenaza)
  return Math.max(0, Math.round(Math.min(credits * pct, cap)));
}
export const respawnHull = (diff) => ({ relaxed: 1, pilot: 0.5, veteran: 0.35 })[diff] ?? 0.5;
export const pirateMul = (diff) => (diff === 'veteran' ? 1.25 : 1);
// Veterano: un material de cada tipo que tengas
export function matsLost(mats, diff) {
  if (diff !== 'veteran') return {};
  return Object.fromEntries(Object.entries(mats || {}).filter(([, n]) => n > 0).map(([k]) => [k, 1]));
}

// ---------- Pecio propio ----------
export const WRECK_JUMPS = 3;
export const WRECK_R = 30; // a esta distancia lo recuperas
export function makeWreck(sys, pos, cargo, jumps) {
  const c = Object.fromEntries(Object.entries(cargo || {}).filter(([, n]) => n > 0));
  if (!Object.keys(c).length) return null; // sin carga no hay nada que recuperar
  return { sys, pos: { ...pos }, cargo: c, until: jumps + WRECK_JUMPS };
}
export const wreckExpired = (w, jumps) => !!w && jumps > w.until;
export const wreckJumpsLeft = (w, jumps) => (w ? Math.max(0, w.until - jumps) : 0);
// Recoger el pecio: lo que quepa en la bodega; lo que no, se queda en el pecio (rest; null si ya no queda nada)
export function recoverWreck(w, cargo, space) {
  let left = space, got = 0;
  const out = { ...cargo }, rest = {};
  for (const [k, n] of Object.entries(w.cargo)) {
    const take = Math.min(n, left);
    out[k] = (out[k] || 0) + take;
    left -= take;
    got += take;
    if (n > take) rest[k] = n - take;
  }
  return { cargo: out, got, rest: Object.keys(rest).length ? rest : null };
}

// ---------- Botín jugoso ----------
// Probabilidad de emboscada al llegar según lo que vale tu carga y el peligro del sistema
export function juicyChance(value, danger) {
  if (danger < 1 || value < 400) return 0;
  return Math.min(0.4, (value - 400) / 5000 + 0.03 * danger);
}

// ---------- Prima de búsqueda ----------
export const wantedBonus = (stars) => 1 + 0.12 * Math.max(0, stars);
