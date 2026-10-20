// GALAXIA: datos y reglas puras (nave, mejoras, mineral, sistema, objetivo actual). Se testea en Node.
import { makeRng, hashString } from './rng.js';

// ---------- Mejoras de la nave (5 niveles cada una) ----------
export const UPGRADES = {
  engine: { name: 'Motor', icon: '🚀', desc: 'Más velocidad y giro.', cost: [120, 260, 480, 800, 1300] },
  laser: { name: 'Láser', icon: '🔫', desc: 'Más daño y cadencia: minas y luchas más rápido.', cost: [100, 220, 420, 720, 1150] },
  shield: { name: 'Escudo', icon: '🛡️', desc: 'Más escudo y se regenera antes.', cost: [110, 240, 450, 760, 1200] },
  cargo: { name: 'Bodega', icon: '📦', desc: 'Cabe más mineral en cada viaje.', cost: [90, 200, 380, 650, 1050] },
  jump: { name: 'Salto', icon: '🌀', desc: 'Llegas a sistemas más lejanos (y peligrosos).', cost: [150, 350, 650, 1000, 1500] },
  missile: { name: 'Misiles', icon: '🚀', desc: 'Misiles teledirigidos: fija un blanco y dispara. Más munición y daño.', cost: [200, 380, 620, 950, 1400] },
};
// Niveles 1-5 normales; Mk 6-10 sin techo práctico: cada uno x1,7 de caro y pide materiales
export const BASE_UP = 5;
export const MAX_UP = 10;
export const upgradeCost = (id, lvl) => {
  if (lvl >= MAX_UP) return null;
  const c = UPGRADES[id].cost;
  return lvl < BASE_UP ? c[lvl] : Math.round(c[BASE_UP - 1] * Math.pow(1.7, lvl - BASE_UP + 1) / 10) * 10;
};
// materiales de cada Mk (desde el 6): chatarra, circuitos y, desde el 8, núcleos
export const upgradeMats = (lvl) => (lvl < BASE_UP ? {} : { chatarra: 6 * (lvl - 4), circuitos: 2 * (lvl - 4), ...(lvl >= 7 ? { nucleos: lvl - 6 } : {}) });
// los Mk rinden la mitad que los niveles normales (rendimientos decrecientes)
export const effLvl = (l) => (l <= BASE_UP ? l : BASE_UP + (l - BASE_UP) * 0.5);

// ---------- CHASIS espaciales (Astillero) ----------
// mult: multiplica los stats; slots: huecos de arma (w) y módulo (m); scale: tamaño en pantalla
export const CHASSIS = {
  explorer: { name: 'Explorador', icon: '🛸', cost: 0, desc: 'Equilibrado: el de siempre.', mult: {}, slots: { w: 2, m: 2 }, scale: 1 },
  hauler: { name: 'Carguero', icon: '🚛', cost: 15000, desc: 'Bodega enorme y casco duro, pero lento.', mult: { cargo: 2.2, hull: 1.3, speed: 0.8, turn: 0.8 }, slots: { w: 1, m: 3 }, scale: 1.25 },
  interceptor: { name: 'Interceptor', icon: '🛩️', cost: 22000, desc: 'Rapidísimo y ágil, pero frágil.', mult: { speed: 1.3, turn: 1.3, hull: 0.7, shield: 0.85, cargo: 0.7 }, slots: { w: 3, m: 1 }, scale: 0.85 },
  warship: { name: 'Acorazado', icon: '🛡️', cost: 40000, desc: 'Un muro: casco y escudo enormes, lento.', mult: { hull: 1.7, shield: 1.7, dmg: 1.15, speed: 0.75, turn: 0.75 }, slots: { w: 3, m: 3 }, scale: 1.35 },
  corsair: { name: 'Corsario', icon: '🏴', cost: 60000, desc: '+4 misiles, fija antes y el impulso recarga mucho más rápido.', mult: { speed: 1.1, dmg: 1.1 }, slots: { w: 2, m: 3 }, scale: 1, missiles: 4, lockMul: 1.6, boostCd: 0.6 },
  // solo con la historia (fin del Acto III): no se vende
  errante2: { name: 'Errante Mk II', icon: '🌌', cost: 0, story: true, desc: 'Forjada con el metal vivo de la Señal: lo mejor de todos los chasis.', mult: { speed: 1.2, turn: 1.15, hull: 1.35, shield: 1.35, dmg: 1.2, cargo: 1.4 }, slots: { w: 3, m: 3 }, scale: 1.1, missiles: 2, lockMul: 1.3, boostCd: 0.75 },
};

// Cada nave del hangar vuela distinto en la Galaxia (multiplicadores sobre las mejoras)
export const GAL_PROFILE = {
  viper: {},
  brick: { speed: 0.9, turn: 0.9, shield: 1.1, hull: 1.3 },
  ghost: { speed: 1.1, turn: 1.15, shield: 0.9, hull: 0.85 },
  nova: { dmg: 1.15 },
  kaiju: { speed: 0.9, turn: 0.85, shield: 1.2, hull: 1.25, dmg: 1.1 },
  raptor: { speed: 1.05, turn: 1.1, shield: 0.9, hull: 0.9, dmg: 1.15 },
  comet: { speed: 1.1, turn: 1.05, hull: 0.95, dmg: 0.95, cargo: 1.2 },
  manta: { speed: 0.95, shield: 1.35, regen: 1.3 },
  spectra: { speed: 1.2, turn: 1.1, hull: 0.85 },
  titan: { speed: 0.85, turn: 0.85, hull: 1.5, dmg: 1.1 },
  falcon: { speed: 1.05, turn: 1.1, shield: 1.25, regen: 1.2 },
  chimera: { speed: 1.05, dmg: 1.2, hull: 0.9 },
  wanderer: { speed: 1.1, turn: 1.1, dmg: 1.1, shield: 1.1, hull: 1.1, cargo: 1.1 },
  centella: { speed: 1.25, turn: 1.15, hull: 0.85 },
  gladiador: { speed: 0.9, hull: 1.35, shield: 1.2, dmg: 1.1 },
  carronero: { cargo: 1.4, speed: 1.05, dmg: 0.95 },
};
export const GAL_KEYS = [['speed', 'VELOCIDAD'], ['turn', 'GIRO'], ['dmg', 'DAÑO'], ['shield', 'ESCUDO'], ['hull', 'CASCO'], ['cargo', 'BODEGA']];

// Stats de vuelo según los niveles (y la nave)
export function shipStats(up, shipId = 'viper', chassisId = 'explorer') {
  const l = (k) => effLvl(up[k] || 0);
  const ch = CHASSIS[chassisId] || CHASSIS.explorer;
  const m = (k) => (GAL_PROFILE[shipId]?.[k] ?? 1) * (ch.mult[k] ?? 1);
  return {
    speed: (90 + l('engine') * 16) * m('speed'),
    boost: 2.3,
    turn: (1.9 + l('engine') * 0.12) * m('turn'),
    dmg: (10 + l('laser') * 6) * m('dmg'),
    fireCd: Math.max(0.09, 0.2 - l('laser') * 0.022),
    shield: Math.round((60 + l('shield') * 30) * m('shield')),
    regen: (6 + l('shield') * 2.5) * m('regen'),
    hull: Math.round(100 * m('hull')),
    cargo: Math.round((20 + l('cargo') * 15) * m('cargo')),
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
export const repairCost = (hull, max) => Math.ceil((max - hull) * 1.8); // mantenimiento: reparar no es gratis

// ---------- Sistema ----------
// El primer sistema, ORIGEN: un sol, 3 planetas, un cinturón de asteroides y una estación.
// Unidades ≈ metros; la nave va a ~90 m/s.
export function makeSystem(seed = 1, def = {}) {
  const rng = makeRng(hashString(`sys-${seed}`));
  const sun = { pos: { x: 0, y: 0, z: 0 }, r: 260, color: def.sunColor || '#ffcc66' };
  // PUERTAS DE SALTO: en el borde del sistema, en la dirección del vecino en el mapa galáctico
  const gates = (def.gates || []).map((g) => ({ to: g.to, name: g.name, pos: { x: Math.cos(g.ang) * 2100, y: 0, z: Math.sin(g.ang) * 2100 }, r: 46, ang: g.ang }));
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
  return { seed, name: def.name || 'ORIGEN', sun, planets, station, asteroids, beltR, gates, ore, danger: def.danger || 0 };
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

// ---------- Acelerador ----------
// MUESCA en el 0: entrar es fácil (de −12% a +15%) y salir pide pasar de ±22%, para que el dedo
// no se escape del "parado" sin querer. v y el resultado van de −0.4 a 1.
export const THR_IN = [-0.12, 0.15];
export const THR_OUT = 0.22;
export function snapThrottle(v, wasZero) {
  if (wasZero) return Math.abs(v) > THR_OUT ? v : 0;
  return v > THR_IN[0] && v < THR_IN[1] ? 0 : v;
}
