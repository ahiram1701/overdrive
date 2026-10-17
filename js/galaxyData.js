// GALAXIA: datos y reglas puras (nave, mejoras, mineral, sistema, objetivo actual). Se testea en Node.
import { makeRng, hashString } from './rng.js';

// ---------- Mejoras de la nave (5 niveles cada una) ----------
export const UPGRADES = {
  engine: { name: 'Motor', icon: '🚀', desc: 'Más velocidad y giro.', cost: [120, 260, 480, 800, 1300] },
  laser: { name: 'Láser', icon: '🔫', desc: 'Más daño y cadencia: minas y luchas más rápido.', cost: [100, 220, 420, 720, 1150] },
  shield: { name: 'Escudo', icon: '🛡️', desc: 'Más escudo y se regenera antes.', cost: [110, 240, 450, 760, 1200] },
  cargo: { name: 'Bodega', icon: '📦', desc: 'Cabe más mineral en cada viaje.', cost: [90, 200, 380, 650, 1050] },
};
export const MAX_UP = 5;
export const upgradeCost = (id, lvl) => (lvl >= MAX_UP ? null : UPGRADES[id].cost[lvl]);

// Stats de vuelo según los niveles
export function shipStats(up) {
  const l = (k) => up[k] || 0;
  return {
    speed: 90 + l('engine') * 16,
    boost: 2.3,
    turn: 1.9 + l('engine') * 0.12,
    dmg: 10 + l('laser') * 6,
    fireCd: Math.max(0.09, 0.2 - l('laser') * 0.022),
    shield: 60 + l('shield') * 30,
    regen: 6 + l('shield') * 2.5,
    hull: 100,
    cargo: 20 + l('cargo') * 15,
  };
}

// ---------- Mineral ----------
export const ORES = {
  iron: { name: 'Hierro', icon: '⛏️', color: '#b8c2cc', price: 8 },
  crystal: { name: 'Cristal', icon: '💎', color: '#7df9ff', price: 18 },
  plasma: { name: 'Plasma', icon: '🔥', color: '#ff6a00', price: 32 },
  dark: { name: 'Materia oscura', icon: '🌑', color: '#bf5af2', price: 60 },
};
export const cargoCount = (cargo) => Object.values(cargo).reduce((a, b) => a + b, 0);
export const cargoValue = (cargo, prices = {}) => Object.entries(cargo).reduce((s, [k, n]) => s + n * (prices[k] ?? ORES[k].price), 0);
export const repairCost = (hull, max) => Math.ceil((max - hull) * 1.2);

// ---------- Sistema ----------
// El primer sistema, ORIGEN: un sol, 3 planetas, un cinturón de asteroides y una estación.
// Unidades ≈ metros; la nave va a ~90 m/s.
export function makeSystem(seed = 1, def = {}) {
  const rng = makeRng(hashString(`sys-${seed}`));
  const sun = { pos: { x: 0, y: 0, z: 0 }, r: 260, color: def.sunColor || '#ffcc66' };
  const planets = [];
  const colors = [['#4fc3f7', '#0d47a1'], ['#ff8a65', '#6d1b00'], ['#aed581', '#1b5e20'], ['#ce93d8', '#4a148c']];
  for (let i = 0; i < (def.planets ?? 3); i++) {
    const R = 900 + i * 650, a = rng.range(0, Math.PI * 2);
    const [c1, c2] = colors[i % colors.length];
    planets.push({ pos: { x: Math.cos(a) * R, y: rng.range(-80, 80), z: Math.sin(a) * R }, r: rng.range(70, 140), c1, c2, rings: rng.chance(0.4) });
  }
  // estación junto al primer planeta
  const p0 = planets[0].pos;
  const station = { pos: { x: p0.x + 260, y: p0.y + 40, z: p0.z + 120 }, r: 34, spin: 0 };
  // cinturón: un anillo de asteroides algo más allá
  const beltR = def.beltR ?? 1350, ore = def.ore || 'iron';
  const asteroids = [];
  for (let i = 0; i < (def.asteroids ?? 80); i++) {
    const a = rng.range(0, Math.PI * 2), R = beltR + rng.range(-130, 130);
    asteroids.push(makeAsteroid(rng, { x: Math.cos(a) * R, y: rng.range(-60, 60), z: Math.sin(a) * R }, rng.range(9, 22), ore));
  }
  return { seed, name: def.name || 'ORIGEN', sun, planets, station, asteroids, beltR };
}

// Asteroide con contorno irregular (se dibuja como polígono que gira)
export function makeAsteroid(rng, pos, r, ore) {
  const n = 7 + Math.floor(rng.next() * 4);
  const shape = Array.from({ length: n }, () => 0.72 + rng.next() * 0.38);
  return { pos, r, hp: r * 2.2, max: r * 2.2, ore, shape, rot: rng.range(0, 6.28), spin: rng.range(-0.6, 0.6), alive: true };
}

// ---------- Objetivo actual ("siguiente paso") ----------
// Decide qué decirle al jugador y adónde apunta la brújula. st: { cargo, cargoMax, credits, up, docked, sold }
export function objective(st) {
  const n = cargoCount(st.cargo);
  if (n >= st.cargoMax) return { kind: 'sell', text: 'Bodega llena: vende el mineral en la estación' };
  if (n > 0 && n >= st.cargoMax * 0.6) return { kind: 'sell', text: 'Vuelve a la estación a vender' };
  const cheapest = Math.min(...Object.keys(UPGRADES).map((k) => upgradeCost(k, st.up[k] || 0) ?? Infinity));
  if (st.sold && st.credits >= cheapest) return { kind: 'upgrade', text: 'Tienes créditos: mejora tu nave en la estación' };
  return { kind: 'mine', text: n ? 'Sigue minando en el cinturón' : 'Dispara a los asteroides del cinturón para minar' };
}
