// ARENA: datos y reglas puras (armas, mejoras, enemigos, oleadas). Se testea en Node.
// Un modo "survivors": vista cenital, la nave dispara sola, oleadas enormes y subir de nivel
// eligiendo 1 de 3 mejoras. Unidades del mundo ≈ píxeles a zoom 1.

export const ARENA_TIME = 600; // sobrevive 10:00 (el jefe final sale al llegar)
export const BOSS_TIMES = [300, 600];
export const MAX_WEAPONS = 4;
export const MAX_PASSIVES = 4;
export const MAX_LVL = 5;

// ---------- Armas ----------
// cd: recarga (s); dmg: daño base; cada nivel mejora según `lvl(n)` (n = 1..5)
export const WEAPONS = {
  blaster: { name: 'Blásteres', icon: '🔫', desc: 'Disparos rápidos al enemigo más cercano.', cd: 0.45, dmg: 12, lvl: (n) => ({ shots: Math.min(4, 1 + Math.floor(n / 2)), dmg: 12 + n * 3 }) },
  shotgun: { name: 'Escopeta', icon: '💥', desc: 'Abanico de perdigones a corta distancia.', cd: 1.1, dmg: 9, lvl: (n) => ({ shots: 5 + n, dmg: 9 + n * 2 }) },
  beam: { name: 'Lanza', icon: '⚡', desc: 'Un rayo que atraviesa todo en línea recta.', cd: 1.4, dmg: 22, lvl: (n) => ({ dmg: 22 + n * 7, width: 10 + n * 2 }) },
  pulse: { name: 'Pulso', icon: '💫', desc: 'Ondas de energía a tu alrededor.', cd: 0.9, dmg: 10, lvl: (n) => ({ dmg: 10 + n * 3, radius: 80 + n * 14 }) },
  flame: { name: 'Lanzallamas', icon: '🔥', desc: 'Cono de fuego continuo hacia delante.', cd: 0.12, dmg: 3, lvl: (n) => ({ dmg: 3 + n * 0.8, range: 110 + n * 12 }) },
  missile: { name: 'Misiles', icon: '🚀', desc: 'Misiles teledirigidos que explotan.', cd: 1.6, dmg: 20, lvl: (n) => ({ shots: Math.min(4, n), dmg: 20 + n * 4 }) },
  orbs: { name: 'Orbes', icon: '🔮', desc: 'Orbes que giran a tu alrededor.', cd: 0, dmg: 8, lvl: (n) => ({ count: 1 + n, dmg: 8 + n * 2 }) },
};

// Arma inicial de cada nave
export const SHIP_WEAPON = { viper: 'blaster', brick: 'shotgun', ghost: 'beam', nova: 'pulse', kaiju: 'flame', raptor: 'missile', comet: 'orbs' };

// Lo que cada nave cambia en la arena (vida, velocidad)
export const SHIP_ARENA = {
  viper: { hp: 100, speed: 1 },
  brick: { hp: 150, speed: 0.85 },
  ghost: { hp: 80, speed: 1.15 },
  nova: { hp: 100, speed: 1 },
  kaiju: { hp: 140, speed: 0.9 },
  raptor: { hp: 90, speed: 1.05 },
  comet: { hp: 100, speed: 1.1 },
};

// ---------- Pasivas ----------
export const PASSIVES = {
  speed: { name: 'Propulsor', icon: '👟', desc: '+10% de velocidad.' },
  magnet: { name: 'Imán', icon: '🧲', desc: '+35% de radio de recogida.' },
  haste: { name: 'Cadencia', icon: '⏱️', desc: 'Las armas recargan un 8% más rápido.' },
  might: { name: 'Potencia', icon: '💪', desc: '+12% de daño.' },
  vitality: { name: 'Blindaje', icon: '❤️', desc: '+20 de vida máxima y te cura.' },
  area: { name: 'Amplitud', icon: '🌀', desc: '+12% de tamaño de las armas.' },
  armor: { name: 'Coraza', icon: '🛡️', desc: 'Recibes 1 de daño menos por golpe.' },
  regen: { name: 'Regeneración', icon: '✚', desc: 'Recuperas 0,5 de vida por segundo.' },
};

// Bonus de las pasivas según su nivel
export function passiveStats(passives) {
  const n = (id) => passives[id] || 0;
  return {
    speed: 1 + 0.1 * n('speed'),
    magnet: 1 + 0.35 * n('magnet'),
    haste: Math.pow(0.92, n('haste')),
    might: 1 + 0.12 * n('might'),
    maxHp: 20 * n('vitality'),
    area: 1 + 0.12 * n('area'),
    armor: n('armor'),
    regen: 0.5 * n('regen'),
  };
}

// ---------- Evoluciones: arma al nivel 5 + su pasiva = una versión brutal ----------
export const EVOLUTIONS = {
  blaster: { needs: 'haste', name: 'Tormenta', icon: '🌩️', desc: 'Ráfagas que atraviesan a todos.' },
  shotgun: { needs: 'might', name: 'Cañón de plasma', icon: '☄️', desc: 'Perdigones enormes que perforan.' },
  beam: { needs: 'area', name: 'Lanza solar', icon: '🌞', desc: 'Tres rayos gigantes a la vez.' },
  pulse: { needs: 'vitality', name: 'Supernova', icon: '🌟', desc: 'Ondas enormes que te curan al dar.' },
  flame: { needs: 'area', name: 'Infierno', icon: '🌋', desc: 'Fuego en los cuatro sentidos.' },
  missile: { needs: 'haste', name: 'Enjambre', icon: '🐝', desc: 'Lluvia constante de misiles.' },
  orbs: { needs: 'speed', name: 'Anillo de Saturno', icon: '🪐', desc: 'Ocho orbes que giran más rápido y lejos.' },
};

export const canEvolve = (st, id) => (st.weapons[id] || 0) >= MAX_LVL && !st.evolved[id] && (st.passives[EVOLUTIONS[id].needs] || 0) >= 1;

// ---------- Ofertas al subir de nivel ----------
// st = { weapons: {id: lvl}, passives: {id: lvl}, evolved: {id: true} }. Devuelve hasta 3 opciones
// { kind: 'weapon'|'passive'|'evolve'|'heal', id, lvl }. La evolución, si se puede, siempre sale.
export function offerUpgrades(st, rng, n = 3) {
  const pool = [];
  for (const id of Object.keys(WEAPONS)) {
    const l = st.weapons[id] || 0;
    if (l >= MAX_LVL) continue;
    if (!l && Object.keys(st.weapons).length >= MAX_WEAPONS) continue;
    pool.push({ kind: 'weapon', id, lvl: l + 1, w: l ? 3 : 1.5 });
  }
  for (const id of Object.keys(PASSIVES)) {
    const l = st.passives[id] || 0;
    if (l >= MAX_LVL) continue;
    if (!l && Object.keys(st.passives).length >= MAX_PASSIVES) continue;
    pool.push({ kind: 'passive', id, lvl: l + 1, w: l ? 2.5 : 1.5 });
  }
  const out = [];
  for (const id of Object.keys(EVOLUTIONS)) if (canEvolve(st, id) && out.length < 1) out.push({ kind: 'evolve', id, lvl: MAX_LVL });
  while (out.length < n && pool.length) {
    const it = rng.weighted(pool);
    pool.splice(pool.indexOf(it), 1);
    out.push({ kind: it.kind, id: it.id, lvl: it.lvl });
  }
  // con todo al máximo, curarse
  if (!out.length) out.push({ kind: 'heal', id: 'heal', lvl: 1 });
  return out;
}

export function applyUpgrade(st, up) {
  if (up.kind === 'weapon') st.weapons[up.id] = (st.weapons[up.id] || 0) + 1;
  else if (up.kind === 'passive') st.passives[up.id] = (st.passives[up.id] || 0) + 1;
  else if (up.kind === 'evolve') st.evolved[up.id] = true;
}

// XP para pasar del nivel l al siguiente: sube rápido al principio (dopamina) y luego se estira
export const xpNeed = (l) => Math.round(2 + l * 2.5 + Math.pow(l, 1.3));

// ---------- Enemigos ----------
// hp, speed (u/s), dmg (por toque), r (radio), xp (valor de su gema)
export const ENEMIES = {
  chaser: { name: 'Perseguidor', hp: 12, speed: 78, dmg: 8, r: 13, xp: 1, color: '#ff2bd6', shape: 'tri' },
  swarm: { name: 'Enjambre', hp: 6, speed: 125, dmg: 5, r: 9, xp: 1, color: '#ffcc00', shape: 'dart' },
  dasher: { name: 'Embestidor', hp: 26, speed: 70, dmg: 10, r: 15, xp: 2, color: '#ff6a00', shape: 'arrow' },
  shooter: { name: 'Tirador', hp: 22, speed: 60, dmg: 6, r: 14, xp: 2, color: '#00e5ff', shape: 'eye' },
  tank: { name: 'Tanque', hp: 120, speed: 40, dmg: 18, r: 26, xp: 5, color: '#30d158', shape: 'hex' },
  splitter: { name: 'Divisor', hp: 40, speed: 62, dmg: 10, r: 19, xp: 3, color: '#bf5af2', shape: 'square' },
  mini: { name: 'Fragmento', hp: 10, speed: 95, dmg: 6, r: 10, xp: 1, color: '#bf5af2', shape: 'square' },
};

// Director de oleadas: cuántos enemigos por segundo, de qué tipos y lo fuertes que son, según el
// minuto. Determinista. hpMul sube con el tiempo para que tu build tenga siempre algo que romper.
export function waveAt(t) {
  const m = t / 60;
  const rate = 2.2 + m * 1.5 + Math.pow(m, 1.5) * 0.3;
  const weights = [{ id: 'chaser', w: 10 }];
  if (m >= 0.5) weights.push({ id: 'swarm', w: 4 + m });
  if (m >= 1.5) weights.push({ id: 'dasher', w: 3 + m * 0.5 });
  if (m >= 2.5) weights.push({ id: 'shooter', w: 2.5 + m * 0.3 });
  if (m >= 3.5) weights.push({ id: 'splitter', w: 2 + m * 0.3 });
  if (m >= 4.5) weights.push({ id: 'tank', w: 1.5 + m * 0.3 });
  return { rate, weights, hpMul: 1 + m * 0.28 + Math.pow(m, 2) * 0.022, cap: Math.round(90 + m * 30) };
}

// ¿Toca élite? Uno por minuto (más vida, más grande, suelta un cofre con una mejora gratis)
export const ELITE_EVERY = 60;

// Recompensas al acabar: gemas y XP de rango
export function arenaRewards({ time, kills, bosses, won }) {
  return {
    gems: Math.floor(time / 20) + Math.floor(kills / 40) + bosses * 10 + (won ? 40 : 0),
    xp: Math.floor(time * 3 + kills * 0.6 + bosses * 120),
  };
}
