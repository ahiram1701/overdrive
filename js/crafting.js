// GALAXIA: materiales y fabricación (taller de la estación). Módulo puro (se testea en Node).
// Los materiales salen de combatir y explorar; con ellos y créditos se fabrican armas y módulos
// que se montan en 2 huecos de arma y 2 de módulo.

export const MATS = {
  chatarra: { icon: '🔩', name: 'Chatarra', desc: 'De cualquier pirata o pecio.' },
  circuitos: { icon: '🔌', name: 'Circuitos', desc: 'De interceptores y drones.' },
  nucleos: { icon: '⚛️', name: 'Núcleos', desc: 'De bases, jefes y piratas buscados.' },
  artefactos: { icon: '🗿', name: 'Artefactos', desc: 'Al descubrir puntos de interés y en la historia.' },
};

export const SLOTS = { w: 2, m: 2 };

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

export function canCraft(save, id) {
  const it = GEAR[id];
  if (!it || owns(save, id)) return false;
  return Object.entries(it.cost).every(([k, n]) => (k === 'credits' ? save.galaxy.credits >= n : matOf(save, k) >= n));
}

export function craft(save, id) {
  if (!canCraft(save, id)) return false;
  for (const [k, n] of Object.entries(GEAR[id].cost)) {
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
  if (slot.length >= SLOTS[it.slot]) slot.pop();
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
