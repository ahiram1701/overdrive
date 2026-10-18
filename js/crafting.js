// GALAXIA: materiales y fabricación (taller de la estación). Módulo puro (se testea en Node).
// Los materiales salen de combatir y explorar; con ellos y créditos se fabrican armas y módulos
// que se montan en 2 huecos de arma y 2 de módulo.

export const MATS = {
  chatarra: { icon: '🔩', name: 'Chatarra', desc: 'De cualquier pirata o pecio.' },
  circuitos: { icon: '🔌', name: 'Circuitos', desc: 'De interceptores y drones.' },
  nucleos: { icon: '⚛️', name: 'Núcleos', desc: 'De bases, jefes y piratas buscados.' },
  artefactos: { icon: '🗿', name: 'Artefactos', desc: 'Al descubrir puntos de interés y en la historia.' },
};

import { CHASSIS } from './galaxyData.js';

export const SLOTS = { w: 2, m: 2 }; // los del Explorador; cada chasis tiene los suyos
export const slotsOf = (save) => (CHASSIS[save.galaxy?.chassis] || CHASSIS.explorer).slots;
// si el chasis nuevo tiene menos huecos, se desmonta lo que sobra
export function fitSlots(save) {
  const g = gear(save), sl = slotsOf(save);
  g.w = g.w.slice(0, sl.w);
  g.m = g.m.slice(0, sl.m);
}

// ---------- Niveles del equipo (1-5) ----------
export const GEAR_MAX = 5;
export const gearLvl = (save, id) => (owns(save, id) ? gear(save).lvl?.[id] || 1 : 0);
export function gearUpCost(id, lvl) {
  if (lvl >= GEAR_MAX) return null;
  const c = GEAR[id].cost;
  return { credits: Math.round(c.credits * 0.6 * lvl / 10) * 10, chatarra: 4 * lvl, circuitos: 2 * lvl, ...(lvl >= 3 ? { nucleos: lvl - 2 } : {}) };
}
export function canUpgradeGear(save, id, disc = 1) {
  const c = gearUpCost(id, gearLvl(save, id));
  return !!c && owns(save, id) && Object.entries(discCost(c, disc)).every(([k, n]) => (k === 'credits' ? save.galaxy.credits >= n : matOf(save, k) >= n));
}
export function upgradeGear(save, id, disc = 1) {
  if (!canUpgradeGear(save, id, disc)) return false;
  const l = gearLvl(save, id);
  for (const [k, n] of Object.entries(discCost(gearUpCost(id, l), disc))) {
    if (k === 'credits') save.galaxy.credits -= n;
    else save.galaxyMats[k] -= n;
  }
  gear(save).lvl = { ...gear(save).lvl, [id]: l + 1 };
  return true;
}
// cuánto más rinde una pieza por nivel (1 = base)
export const gearBoost = (save, id) => 1 + 0.12 * (gearLvl(save, id) - 1);

export const GEAR = {
  // armas
  laser2: { slot: 'w', icon: '🔫', name: 'Láser doble', desc: 'Disparas dos rayos a la vez.', cost: { credits: 900, chatarra: 8, circuitos: 2 } },
  flak: { slot: 'w', icon: '💥', name: 'Metralla', desc: 'Cada disparo se abre en abanico de 3.', cost: { credits: 1200, chatarra: 12, circuitos: 4 } },
  plasma: { slot: 'w', icon: '🟣', name: 'Cañón de plasma', desc: 'Cada 3er disparo es una bola que hace x3 de daño.', cost: { credits: 1800, chatarra: 10, nucleos: 2 } },
  turret: { slot: 'w', icon: '🗼', name: 'Torreta automática', desc: 'Dispara sola al pirata más cercano.', cost: { credits: 2200, circuitos: 8, nucleos: 2 } },
  // módulos
  reactive: { slot: 'm', icon: '🛡️', name: 'Escudo reactivo', desc: 'El escudo se regenera un 60% más rápido.', cost: { credits: 800, chatarra: 6, circuitos: 2 } },
  bigmag: { slot: 'm', icon: '🧲', name: 'Imán grande', desc: 'Atraes mineral y botín desde el doble de lejos.', cost: { credits: 600, chatarra: 8 } },
  warpdrv: { slot: 'm', icon: '🌀', name: 'Motor de curvatura', desc: 'El impulso recarga un 35% antes.', cost: { credits: 1100, circuitos: 4, artefactos: 1 } },
  hold: { slot: 'm', icon: '📦', name: 'Bodega extra', desc: '+15 de bodega.', cost: { credits: 900, chatarra: 10 } },
  rapid: { slot: 'm', icon: '🚀', name: 'Lanzamisiles rápido', desc: '+2 misiles y vuelan un 30% más rápido.', cost: { credits: 1500, circuitos: 4, nucleos: 1 } },
};

export const matOf = (save, k) => save.galaxyMats?.[k] || 0;
export const addMat = (save, k, n = 1) => { save.galaxyMats[k] = matOf(save, k) + n; return n; };
export const gear = (save) => {
  const g = save.galaxyGear;
  g.owned ||= {};
  g.w ||= [];
  g.m ||= [];
  return g;
};
export const owns = (save, id) => !!gear(save).owned[id];
export const equippedGear = (save) => [...gear(save).w, ...gear(save).m];
export const hasGear = (save, id) => equippedGear(save).includes(id);

// disc: descuento en créditos (el Taller de un puesto avanzado)
export const discCost = (c, disc = 1) => Object.fromEntries(Object.entries(c).map(([k, n]) => [k, k === 'credits' ? Math.round(n * disc) : n]));
export function canCraft(save, id, disc = 1) {
  const it = GEAR[id];
  if (!it || owns(save, id)) return false;
  return Object.entries(discCost(it.cost, disc)).every(([k, n]) => (k === 'credits' ? save.galaxy.credits >= n : matOf(save, k) >= n));
}

export function craft(save, id, disc = 1) {
  if (!canCraft(save, id, disc)) return false;
  for (const [k, n] of Object.entries(discCost(GEAR[id].cost, disc))) {
    if (k === 'credits') save.galaxy.credits -= n;
    else save.galaxyMats[k] -= n;
  }
  gear(save).owned[id] = true;
  equipGear(save, id); // si hay hueco libre, se monta
  return true;
}

// Monta o desmonta: si ya está puesto, se quita; si no, va al primer hueco libre (o sustituye al último)
export function equipGear(save, id) {
  const it = GEAR[id];
  if (!it || !owns(save, id)) return false;
  const g = gear(save), slot = g[it.slot];
  const i = slot.indexOf(id);
  if (i >= 0) { slot.splice(i, 1); return false; }
  if (slot.length >= slotsOf(save)[it.slot]) slot.pop();
  if (!slotsOf(save)[it.slot]) return false;
  slot.push(id);
  return true;
}

// Lo que suelta cada enemigo (determinista por tipo)
export function dropsOf(kind, { boss = false, bounty = false, base = false } = {}) {
  if (base) return { chatarra: 6, nucleos: 2 };
  if (boss || bounty) return { chatarra: 4, nucleos: 1 };
  if (kind === 'interceptor' || kind === 'drone') return { chatarra: 1, circuitos: 1 };
  if (kind === 'bomber') return { chatarra: 3, circuitos: 1 };
  return { chatarra: 2 };
}
