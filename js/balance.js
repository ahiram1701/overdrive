// Balance: topes, rendimientos decrecientes y ritmo del OVERDRIVE. Módulo puro.
// Medido con el bot (test/e2e/balance.spec.js): ninguna build debe vivir invulnerable.

// Topes de las stats de una partida, vengan de la nave, el árbol, las cartas o las sinergias
export const CAPS = { odRate: 1.5, odDur: 7, dashMax: 3, dashRechargeMin: 2.4 };

// Ritmo del OVERDRIVE: lo que carga cada acción se multiplica por OD_GAIN; al acabar, la barra
// se "recalienta" OD_COOL segundos y no carga (corta el encadenar overdrive tras overdrive)
export const OD_GAIN = 0.25;
export const OD_COOL = 5;

export function capStats(r) {
  const s = r.stats;
  s.odRate = Math.min(CAPS.odRate, s.odRate);
  s.odDur = Math.min(CAPS.odDur, s.odDur);
  // sin DASH (modificador) el tope no lo devuelve
  s.dashMax = Math.min(CAPS.dashMax, s.dashMax);
  s.dashRecharge = Math.max(CAPS.dashRechargeMin, s.dashRecharge);
  r.dashCharges = Math.min(r.dashCharges, s.dashMax);
}

// Rendimientos decrecientes: lo que da la n-ésima copia de una carta (n empieza en 1)
export const stackValue = (steps, n) => steps[Math.max(0, Math.min(n, steps.length) - 1)];
export const STACKS = {
  cargador: [0.35, 0.25, 0.15], // +odRate
  odplus: [2, 1.5, 1], //          +odDur (s)
  recarga: [0.8, 0.85, 0.9], //    ×dashRecharge
};

// VAMPIRO: cada escudo pide más near-miss que el anterior (12, 18, 24…)
export const vampireNeed = (got) => 12 + got * 6;
