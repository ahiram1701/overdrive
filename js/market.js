// GALAXIA: mercado con oferta y demanda, y consumibles de vuelo. Módulo puro (se testea en Node).
// Cada estación recuerda cuánto de cada mineral le has vendido: cuanto más vendes, menos paga
// (las 10 primeras a precio completo; luego −2% por unidad, hasta −60%), y se recupera con el tiempo.
// Así no castiga las ventas pequeñas, sino vaciar la bodega siempre en el mismo sitio.

export const SAT_FREE = 10; // unidades que una estación compra sin bajar el precio
export const SAT_PER_UNIT = 0.02;
export const SAT_MAX = 0.6;
export const RECOVER_SECS = 20; // cada 20 s de vuelo, una unidad menos de saturación

const mk = (save) => (save.galaxyMarket ||= {});
export const saturation = (save, sys, ore) => mk(save)[sys]?.[ore] || 0;
export const priceFactor = (units) => 1 - Math.min(SAT_MAX, Math.max(0, units - SAT_FREE) * SAT_PER_UNIT);
// precio de UNA unidad ahora mismo
export const unitPrice = (save, sys, ore, base) => Math.max(1, Math.round(base * priceFactor(saturation(save, sys, ore))));

// Lo que pagan por n unidades: cada una un poco menos que la anterior
export function sellValue(save, sys, ore, n, base) {
  const s0 = saturation(save, sys, ore);
  let total = 0;
  for (let i = 0; i < n; i++) total += Math.max(1, base * priceFactor(s0 + i));
  return Math.round(total);
}

export function recordSale(save, sys, ore, n) {
  const m = mk(save);
  m[sys] ||= {};
  m[sys][ore] = Math.min(SAT_FREE + SAT_MAX / SAT_PER_UNIT, (m[sys][ore] || 0) + n);
}

// el mercado se recupera mientras vuelas (rate: el Mercado propio de un puesto lo dobla)
export function recoverMarket(save, dt, rate = 1) {
  const m = mk(save), k = (dt / RECOVER_SECS) * rate;
  for (const sys of Object.keys(m)) {
    for (const ore of Object.keys(m[sys])) {
      m[sys][ore] -= k;
      if (m[sys][ore] <= 0) delete m[sys][ore];
    }
    if (!Object.keys(m[sys]).length) delete m[sys];
  }
}

// ---------- Mantenimiento ----------
export const MISSILE_PRICE = 40;
// peaje de una puerta de salto, según el peligro del destino
export const tollFor = (danger) => 25 + 15 * danger;

// ---------- Consumibles de vuelo (se compran en las estaciones) ----------
export const ITEM_MAX = 5;
export const ITEMS = {
  repair: { icon: '🧰', name: 'Kit de reparación', desc: '+40% de casco al momento.', cost: 300 },
  shield: { icon: '🔋', name: 'Escudo de emergencia', desc: 'El escudo, lleno al instante.', cost: 250 },
  mines: { icon: '💣', name: 'Minas', desc: 'Sueltas 3 minas detrás: estallan si un pirata se acerca.', cost: 200 },
  decoy: { icon: '🎈', name: 'Señuelo', desc: 'Los piratas persiguen al señuelo durante 6 s.', cost: 350 },
  beacon: { icon: '🏠', name: 'Baliza de retorno', desc: 'Saltas a tu estación base desde donde estés.', cost: 600 },
};
export const ITEM_KEYS = Object.keys(ITEMS);
const inv = (save) => (save.galaxyItems ||= {});
export const itemCount = (save, id) => inv(save)[id] || 0;

export function buyItem(save, id, disc = 1) {
  const it = ITEMS[id];
  const cost = it && Math.round(it.cost * disc);
  if (!it || itemCount(save, id) >= ITEM_MAX || save.galaxy.credits < cost) return false;
  save.galaxy.credits -= cost;
  inv(save)[id] = itemCount(save, id) + 1;
  return true;
}
// gasta uno (el efecto lo aplica el juego)
export function takeItem(save, id) {
  if (itemCount(save, id) <= 0) return false;
  inv(save)[id]--;
  return true;
}
