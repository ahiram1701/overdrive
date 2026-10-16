// Estado global compartido entre módulos.
export const LANE_W = 1;      // ancho de carril en unidades de mundo
export const VIEW = 150;      // distancia de dibujado
export const LANES = [-1, 0, 1];
export const MAX_SHIELDS = 3; // los escudos son un colchón, no un modo automático
export const addShields = (r, n) => { r.shields = Math.min(MAX_SHIELDS, r.shields + n); };

export const G = {
  mode: 'menu',               // menu | play | dying | dead | cards | shop | chest | paused
  run: null,
  player: null,
  W: 0, H: 0, dpr: 1,
  slowmo: 0, slowScale: 1,
  hitstop: 0,
  realTime: 0,
  debug: typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug'),
};

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

export function fmt(n) {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
  let u = -1;
  while (n >= 1000 && u < units.length - 1) { n /= 1000; u++; }
  return (n >= 100 ? n.toFixed(0) : n.toFixed(1)) + units[u];
}
