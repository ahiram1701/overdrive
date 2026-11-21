// Curva de velocidad del juego. Módulo puro (testeable en Node).
//
// La pista se GENERA por distancia, así que su ritmo no puede depender del tiempo vivido:
// con overdrive (o cualquier cosa que cambie tu velocidad) llegas antes a cada punto y, si el
// generador usara la velocidad del momento, la pista sería otra. Por eso el generador usa la
// velocidad "de referencia" que tendrías en esa distancia sin overdrive: misma semilla, misma pista.

// velocidad base (sin multiplicadores) a los t segundos
export const baseSpeed = (t) => 28 + 95 * (1 - Math.exp(-t / 140)) + t * 0.08;

// distancia recorrida a velocidad base en t segundos (integral de baseSpeed)
export const baseDist = (t) => 123 * t - 95 * 140 * (1 - Math.exp(-t / 140)) + 0.04 * t * t;

// inversa de baseDist (bisección: monótona creciente)
export function timeAtDist(d) {
  if (d <= 0) return 0;
  let lo = 0, hi = 60;
  while (baseDist(hi) < d) hi *= 2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (baseDist(mid) < d) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// velocidad de referencia en la distancia d con un multiplicador de velocidad (cartas como Nitro)
export const trackSpeed = (d, speedMult = 1) => baseSpeed(timeAtDist(d / speedMult)) * speedMult;

// PRESIÓN: a partir del tramo 9 la pista ya no se aprieta más por sí sola; cada 3 tramos se suma un nivel
// de presión (filas más juntas, más sucesos y biomas sin orden fijo), con tope para que siga siendo justa
export const PRESSURE_FROM = 9;
export const PRESSURE_MAX = 6;
export const pressureOf = (section) => (section < PRESSURE_FROM ? 0 : Math.min(PRESSURE_MAX, 1 + Math.floor((section - PRESSURE_FROM) / 3)));
export const pressureGap = (p) => 1 - 0.035 * p; // ×0,79 con la presión al máximo
export const pressureEvent = (p) => Math.min(0.9, 0.6 + 0.05 * p);
// tras tres vueltas de biomas, el orden cambia en cada vuelta (determinista por el tramo)
export function biomeIndex(section, n) {
  if (section < n * 3) return section % n;
  const lap = Math.floor(section / n), k = section % n;
  return (k * (lap % 2 ? n - 1 : 1) + lap * 2) % n;
}
