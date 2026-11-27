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
import { repOf, lvlAtLeast } from './factions.js';

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
  laser2: { slot: 'w', icon: '🔫', name: 'Láser doble', desc: 'Disparas dos rayos a la vez.', cost: { credits: 1300, chatarra: 8, circuitos: 2 } },
  flak: { slot: 'w', icon: '💥', name: 'Metralla', desc: 'Cada disparo se abre en abanico de 3.', cost: { credits: 1700, chatarra: 12, circuitos: 4 } },
  plasma: { slot: 'w', icon: '🟣', name: 'Cañón de plasma', desc: 'Cada 3er disparo es una bola que hace x3 de daño.', cost: { credits: 2500, chatarra: 10, nucleos: 2 } },
  turret: { slot: 'w', icon: '🗼', name: 'Torreta automática', desc: 'Dispara sola al pirata más cercano.', cost: { credits: 3100, circuitos: 8, nucleos: 2 } },
  rail: { slot: 'w', icon: '🎯', name: 'Cañón de riel', desc: 'Cada 4º disparo es un proyectil que atraviesa a todos (×2 de daño).', cost: { credits: 3600, circuitos: 6, nucleos: 2 } },
  burst: { slot: 'w', icon: '🎆', name: 'Flak de área', desc: 'Tus disparos estallan: dañan también a los de alrededor.', cost: { credits: 3400, chatarra: 14, circuitos: 4 } },
  beam: { slot: 'w', icon: '〰️', name: 'Haz continuo', desc: 'Disparas un 45% más rápido, cada tiro un 25% más flojo (y calienta menos).', cost: { credits: 2800, circuitos: 6 } },
  ion: { slot: 'w', icon: '🔵', name: 'Cañón iónico', desc: 'Triple contra escudos de élite y atraviesa el escudo frontal de las fragatas.', cost: { credits: 3100, circuitos: 5, artefactos: 1 } },
  // módulos
  reactive: { slot: 'm', icon: '🛡️', name: 'Escudo reactivo', desc: 'El escudo se regenera un 60% más rápido.', cost: { credits: 1100, chatarra: 6, circuitos: 2 } },
  bigmag: { slot: 'm', icon: '🧲', name: 'Imán grande', desc: 'Atraes mineral y botín desde el doble de lejos.', cost: { credits: 800, chatarra: 8 } },
  warpdrv: { slot: 'm', icon: '🌀', name: 'Motor de curvatura', desc: 'El impulso recarga un 35% antes.', cost: { credits: 1500, circuitos: 4, artefactos: 1 } },
  hold: { slot: 'm', icon: '📦', name: 'Bodega extra', desc: '+15 de bodega.', cost: { credits: 1300, chatarra: 10 } },
  rapid: { slot: 'm', icon: '🚀', name: 'Lanzamisiles rápido', desc: '+2 misiles y vuelan un 30% más rápido.', cost: { credits: 2100, circuitos: 4, nucleos: 1 } },
  // de FACCIÓN: solo con su reputación (Amigo o Aliado)
  ligaHold: { slot: 'm', faction: 'liga', minLvl: 'amigo', icon: '⛏️', name: 'Bodega de la Liga', desc: '+30 de bodega y el mineral se vende un 6% más.', cost: { credits: 3400, chatarra: 12 } },
  ligaHull: { slot: 'm', faction: 'liga', minLvl: 'aliado', icon: '🪨', name: 'Blindaje de roca', desc: '+35% de casco.', cost: { credits: 5900, chatarra: 16, nucleos: 2 } },
  coalShield: { slot: 'm', faction: 'coal', minLvl: 'amigo', icon: '☀️', name: 'Escudo solar', desc: '+30% de escudo y se regenera un 30% más rápido.', cost: { credits: 3400, circuitos: 6 } },
  coalLance: { slot: 'w', faction: 'coal', minLvl: 'aliado', icon: '🔆', name: 'Lanza solar', desc: '+20% de daño del láser.', cost: { credits: 5900, circuitos: 8, nucleos: 2 } },
  pirBoost: { slot: 'm', faction: 'pir', minLvl: 'amigo', icon: '💨', name: 'Inyector pirata', desc: 'El impulso recarga un 40% antes.', cost: { credits: 3100, chatarra: 10, circuitos: 3 } },
  pirTeeth: { slot: 'w', faction: 'pir', minLvl: 'aliado', icon: '🦷', name: 'Dientes de sierra', desc: '+30% de daño, pero −10% de escudo.', cost: { credits: 5600, chatarra: 14, nucleos: 2 } },
};
// ¿tu reputación con su facción te deja fabricarla?
export const gearAllowed = (save, id) => !GEAR[id]?.faction || lvlAtLeast(repOf(save, GEAR[id].faction), GEAR[id].minLvl);

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
  if (!it || owns(save, id) || !gearAllowed(save, id)) return false;
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

// ---------- CHIPS: botín con rareza y afijos (élites, jefes y sistemas ocultos los sueltan) ----------
// Se llevan hasta 2 montados (aparte de las armas y módulos); el resto se desguaza por créditos y chatarra.
export const CHIP_TIERS = [
  { id: 'common', name: 'Común', color: '#c8d6e5', n: 1 },
  { id: 'rare', name: 'Raro', color: '#0a84ff', n: 2 },
  { id: 'epic', name: 'Épico', color: '#bf5af2', n: 2 },
  { id: 'legendary', name: 'Legendario', color: '#ffcc00', n: 3 },
];
export const AFFIX = {
  dmg: { icon: '🔫', name: 'daño', unit: '%', base: 4, step: 3 },
  shield: { icon: '🛡️', name: 'escudo', unit: '%', base: 5, step: 4 },
  hull: { icon: '🧱', name: 'casco', unit: '%', base: 5, step: 4 },
  cargo: { icon: '📦', name: 'bodega', unit: '', base: 4, step: 3 },
  cool: { icon: '❄️', name: 'menos calor', unit: '%', base: 5, step: 4 },
  bounty: { icon: '💰', name: 'créditos por baja', unit: '%', base: 5, step: 4 },
  missile: { icon: '🚀', name: 'misiles', unit: '', base: 1, step: 0.6 },
  regen: { icon: '💚', name: 'regeneración', unit: '%', base: 8, step: 6 },
};
export const CHIP_MAX = 2;
export const CHIP_BAG = 12;
// un chip nuevo: la rareza sube con el peligro (y con `bonus`: jefes y sistemas ocultos)
export function genChip(rng, danger, bonus = 0) {
  const r = rng.next() - bonus * 0.18 - danger * 0.03;
  const tier = r < 0.06 ? 3 : r < 0.25 ? 2 : r < 0.6 ? 1 : 0;
  const keys = rng.shuffle(Object.keys(AFFIX)).slice(0, CHIP_TIERS[tier].n);
  const affixes = keys.map((k) => ({ k, v: Math.round((AFFIX[k].base + AFFIX[k].step * (tier + rng.range(0, 1.5))) * 10) / 10 }));
  for (const a of affixes) if (AFFIX[a.k].unit === '') a.v = Math.max(1, Math.round(a.v));
  return { id: `ch${Math.floor(rng.next() * 1e9).toString(36)}`, tier, affixes };
}
export const chipText = (c) => c.affixes.map((a) => `${AFFIX[a.k].icon} +${a.v}${AFFIX[a.k].unit} ${AFFIX[a.k].name}`).join(' · ');
export const chipValue = (c) => ({ credits: 150 + 220 * c.tier, chatarra: 2 + 2 * c.tier });
export const chips = (save) => { save.galaxyChips ||= { bag: [], on: [] }; return save.galaxyChips; };
// suma de los afijos de los chips montados
export function chipBonus(save) {
  const C = chips(save), out = {};
  for (const c of C.bag) if (C.on.includes(c.id)) for (const a of c.affixes) out[a.k] = (out[a.k] || 0) + a.v;
  return out;
}
export function addChip(save, c) {
  const C = chips(save);
  if (C.bag.length >= CHIP_BAG) return false;
  C.bag.push(c);
  return true;
}
export function toggleChip(save, id) {
  const C = chips(save);
  if (C.on.includes(id)) { C.on = C.on.filter((x) => x !== id); return false; }
  if (!C.bag.some((c) => c.id === id)) return false;
  if (C.on.length >= CHIP_MAX) C.on.shift();
  C.on.push(id);
  return true;
}
export function scrapChip(save, id) {
  const C = chips(save), c = C.bag.find((x) => x.id === id);
  if (!c) return null;
  C.bag = C.bag.filter((x) => x !== c);
  C.on = C.on.filter((x) => x !== id);
  const v = chipValue(c);
  save.galaxy.credits += v.credits;
  addMat(save, 'chatarra', v.chatarra);
  return v;
}
