// PECIOS: el botín. Objetos con rareza (arma, blindaje y 2 módulos), consumibles y lo que cada cosa le hace
// a tu nave. Módulo puro (se testea en Node).

export const RARITY = [
  { id: 'common', name: 'Común', color: '#c8d6e5' },
  { id: 'rare', name: 'Raro', color: '#0a84ff' },
  { id: 'epic', name: 'Épico', color: '#bf5af2' },
  { id: 'legendary', name: 'Legendario', color: '#ffcc00' },
];

// Armas: cambian tu disparo automático
export const WEAPONS = {
  spread: { icon: '🔱', name: 'Abanico', desc: 'dispara 3 balas en abanico' },
  pierce: { icon: '🗡️', name: 'Perforador', desc: 'las balas atraviesan a los enemigos' },
  bounce: { icon: '🪃', name: 'Rebote', desc: 'las balas rebotan en las paredes' },
  blast: { icon: '💥', name: 'Estallido', desc: 'cada impacto daña también alrededor' },
  rapid: { icon: '🔥', name: 'Ráfaga', desc: 'dispara mucho más rápido' },
};
// Módulos: efectos pasivos (dos ranuras)
export const MODULES = {
  leech: { icon: '🩸', name: 'Sanguijuela', desc: (v) => `+1 ❤️ cada ${v} bajas`, val: [8, 6, 5, 4] },
  keyring: { icon: '🗝️', name: 'Llavero', desc: (v) => `+${v} % de llave al limpiar una sala`, val: [15, 25, 35, 50] },
  scanner: { icon: '🔍', name: 'Escáner', desc: (v) => `ves mímicos y paredes agrietadas · +${v} % 🔩`, val: [0, 10, 20, 30] },
  magnet: { icon: '🧲', name: 'Imán', desc: (v) => `+${v} % de 🔩`, val: [20, 35, 50, 75] },
  reflex: { icon: '💨', name: 'Reflejos', desc: (v) => `esquive ${v} % antes`, val: [15, 25, 35, 50] },
  overcharge: { icon: '🔋', name: 'Sobrecarga', desc: (v) => `habilidad ${v} % antes`, val: [15, 25, 35, 45] },
};
export const SLOTS = ['weapon', 'plating', 'mod1', 'mod2'];
export const SLOT_NAME = { weapon: 'Arma', plating: 'Blindaje', mod1: 'Módulo 1', mod2: 'Módulo 2' };

// Consumibles: se llevan en la mochila (3 de cada como mucho) y se usan con su botón
export const CONS = {
  kit: { icon: '🧰', name: 'Kit de reparación', desc: '+3 ❤️' },
  emp: { icon: '📡', name: 'Pulso EMP', desc: 'aturde a todos los de la sala 3 s' },
  warp: { icon: '🌀', name: 'Teletransporte', desc: 'vuelves a la entrada de la planta' },
};
export const CONS_KEYS = Object.keys(CONS);
export const BAG_MAX = 3;

// Rareza según la planta (más hondo, mejor) y un empujón (cofres, mímicos, cajas: bonus 1-2)
export function rollTier(rng, depth, bonus = 0) {
  const d = Math.max(1, depth);
  const w = [Math.max(12, 66 - 6 * d), 26 + 2 * d, 6 + 2.4 * d, 0.8 + 0.7 * d];
  for (let i = 0; i < bonus; i++) { w[3] += w[0] * 0.06; w[2] += w[0] * 0.2; w[1] += w[0] * 0.34; w[0] *= 0.4; }
  let r = rng.next() * w.reduce((a, b) => a + b, 0);
  for (let t = 0; t < 4; t++) if ((r -= w[t]) <= 0) return t;
  return 3;
}

// Un objeto al azar (slot opcional para forzar uno; minTier para "al menos raro")
export function genItem(rng, depth, { bonus = 0, slot = null, minTier = 0 } = {}) {
  const tier = Math.max(minTier, rollTier(rng, depth, bonus));
  const sl = slot || rng.weighted([{ k: 'weapon', w: 4 }, { k: 'plating', w: 3 }, { k: 'mod', w: 4 }]).k;
  const id = `it${Math.floor(rng.next() * 1e9).toString(36)}`;
  if (sl === 'weapon') {
    const kind = rng.pick(Object.keys(WEAPONS));
    const dmg = kind === 'spread' || kind === 'rapid' ? Math.max(0, tier - 1) : tier;
    const rate = { rapid: 1.4 + 0.1 * tier, pierce: 0.85, blast: 0.8, bounce: 0.95, spread: 0.9 }[kind];
    return { id, slot: 'weapon', kind, tier, dmg, rate, bounces: kind === 'bounce' ? 1 + Math.min(2, tier) : 0 };
  }
  if (sl === 'plating') return { id, slot: 'plating', kind: 'plating', tier, hp: 1 + tier, shield: tier >= 2 ? tier - 1 : 0 };
  const kind = rng.pick(Object.keys(MODULES));
  return { id, slot: 'mod', kind, tier, val: MODULES[kind].val[tier] };
}

export const itemIcon = (it) => (it.slot === 'weapon' ? WEAPONS[it.kind].icon : it.slot === 'plating' ? '🛡️' : MODULES[it.kind].icon);
export const itemName = (it) => (it.slot === 'weapon' ? WEAPONS[it.kind].name : it.slot === 'plating' ? 'Blindaje' : MODULES[it.kind].name);
// Lo que hace, en líneas cortas (para la pantalla de comparar)
export function itemLines(it) {
  if (!it) return [];
  if (it.slot === 'weapon') {
    const out = [WEAPONS[it.kind].desc];
    if (it.dmg) out.push(`+${it.dmg} de daño`);
    if (it.rate !== 1) out.push(`cadencia ×${it.rate.toFixed(2).replace(/0$/, '')}`);
    if (it.bounces) out.push(`rebota ${it.bounces} ${it.bounces > 1 ? 'veces' : 'vez'}`);
    return out;
  }
  if (it.slot === 'plating') return [`+${it.hp} ❤️ de vida máxima`, ...(it.shield ? [`🫧 ${it.shield} de escudo al entrar en cada sala`] : [])];
  return [MODULES[it.kind].desc(it.val)];
}
// Para comparar (y para que el bot elija): cuanto más raro, mejor
export const itemPower = (it) => (it ? 10 + it.tier * 10 + (it.dmg || 0) + (it.hp || 0) : 0);

// Recalcula lo que da tu equipo (y las bendiciones del altar) sobre las bases de tu nave
export function applyGear(p) {
  const g = p.gear, w = g.weapon, pl = g.plating;
  p.max = Math.max(1, p.baseMax + (p.bonusMax || 0) + (pl ? pl.hp : 0));
  p.hp = Math.min(p.hp, p.max);
  p.dmg = 2 + (p.bonusDmg || 0) + (w ? w.dmg : 0);
  p.rate = 2.4 * (w ? w.rate : 1);
  p.weapon = w ? w.kind : 'basic';
  p.bounces = w ? w.bounces : 0;
  const m = { leech: 0, keyring: 0, scanner: 0, magnet: 0, reflex: 0, overcharge: 0, hasScanner: false };
  for (const it of [g.mod1, g.mod2]) {
    if (!it) continue;
    if (it.kind === 'leech') m.leech = m.leech ? Math.min(m.leech, it.val) - 1 : it.val; // dos sanguijuelas: aún más a menudo
    else m[it.kind] += it.val;
    if (it.kind === 'scanner') m.hasScanner = true;
  }
  m.reflex = Math.min(70, m.reflex);
  m.overcharge = Math.min(65, m.overcharge);
  p.mods = m;
  p.dashMax = 1.1 * (1 - m.reflex / 100);
  p.abMax = 10 * (1 - m.overcharge / 100);
  p.roomShield = pl ? pl.shield : 0;
}

// ¿En qué ranura entra? (los módulos: la libre, o la que elijas)
export function slotFor(p, it, prefer = null) {
  if (it.slot !== 'mod') return it.slot;
  if (prefer) return prefer;
  return !p.gear.mod1 ? 'mod1' : !p.gear.mod2 ? 'mod2' : 'mod1';
}
// Con qué lo comparas
export function currentFor(p, it) {
  if (it.slot !== 'mod') return p.gear[it.slot];
  if (!p.gear.mod1 || !p.gear.mod2) return null;
  return itemPower(p.gear.mod1) <= itemPower(p.gear.mod2) ? p.gear.mod1 : p.gear.mod2;
}
