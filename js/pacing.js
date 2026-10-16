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
