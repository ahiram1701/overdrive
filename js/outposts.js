// GALAXIA: puestos avanzados. Módulo puro (se testea en Node).
// En un sistema que liberaste puedes fundar tu propio puesto (una estación tuya) y ampliarlo con
// módulos de 3 niveles. Todo con créditos: es el gran sumidero de la Galaxia a largo plazo.

export const FOUND_COST = 20000;
export const MOD_MAX = 3;
export const MODULES = {
  workshop: { icon: '🔧', name: 'Taller', desc: (l) => `Fabricar y subir equipo aquí sale un ${10 + 10 * l}% más barato.`, costs: [8000, 14000, 22000] },
  storage: { icon: '📦', name: 'Almacén', desc: (l) => `Guarda hasta ${100 * l} de carga y materiales: no se pierden si te destruyen.`, costs: [6000, 11000, 18000] },
  radar: { icon: '📡', name: 'Radar', desc: (l) => `El mapa revela los sistemas a ${l + 1} saltos del puesto y marca los piratas.`, costs: [7000, 13000, 20000] },
  turrets: { icon: '🗼', name: 'Torretas', desc: (l) => `${l * 2} torretas defienden el puesto solas en los asedios.`, costs: [10000, 18000, 30000] },
  market: { icon: '🛒', name: 'Mercado propio', desc: (l) => `Sus precios se recuperan ${l + 1} veces más rápido y pagan un ${5 * l}% más.`, costs: [9000, 16000, 25000] },
};
export const MOD_KEYS = Object.keys(MODULES);

const all = (save) => (save.outposts ||= {});
export const outpostAt = (save, sys) => all(save)[sys] || null;
export const outpostList = (save) => Object.entries(all(save)).map(([sys, o]) => ({ sys: Number(sys), ...o }));
export const modLvl = (save, sys, mod) => outpostAt(save, sys)?.mods?.[mod] || 0;

// Solo en sistemas liberados por ti, y uno por sistema
export const canFound = (save, sys) => !!save.territory?.[sys] && !outpostAt(save, sys);
export function found(save, sys, name = 'Puesto') {
  if (!canFound(save, sys) || save.galaxy.credits < FOUND_COST) return false;
  save.galaxy.credits -= FOUND_COST;
  all(save)[sys] = { name: String(name).replace(/[<>&"]/g, '').slice(0, 16) || 'Puesto', mods: {}, store: { cargo: {}, mats: {} } };
  return true;
}

export const modCost = (save, sys, mod) => {
  const l = modLvl(save, sys, mod);
  return l >= MOD_MAX ? null : MODULES[mod].costs[l];
};
export function upgradeModule(save, sys, mod) {
  const o = outpostAt(save, sys), c = o && modCost(save, sys, mod);
  if (!o || !c || save.galaxy.credits < c) return false;
  save.galaxy.credits -= c;
  o.mods = { ...o.mods, [mod]: modLvl(save, sys, mod) + 1 };
  return true;
}
export const totalModLevels = (save) => outpostList(save).reduce((n, o) => n + Object.values(o.mods || {}).reduce((a, b) => a + b, 0), 0);

// ---------- Almacén ----------
const storeOf = (o) => { o.store ||= { cargo: {}, mats: {} }; o.store.cargo ||= {}; o.store.mats ||= {}; return o.store; };
export const storeUsed = (o) => [...Object.values(storeOf(o).cargo), ...Object.values(storeOf(o).mats)].reduce((a, b) => a + b, 0);
export const storeCap = (save, sys) => 100 * modLvl(save, sys, 'storage');
// mete todo lo que quepa de la bodega y los materiales; devuelve cuánto guardó
export function depositAll(save, sys) {
  const o = outpostAt(save, sys), cap = storeCap(save, sys);
  if (!o || !cap) return 0;
  const st = storeOf(o);
  let room = cap - storeUsed(o), moved = 0;
  const move = (src, dst) => {
    for (const [k, n] of Object.entries(src)) {
      const q = Math.min(n, room);
      if (q <= 0) continue;
      src[k] -= q;
      dst[k] = (dst[k] || 0) + q;
      room -= q;
      moved += q;
    }
  };
  move(save.galaxy.cargo, st.cargo);
  move(save.galaxyMats, st.mats);
  return moved;
}
// saca todo: los materiales siempre; la carga, lo que quepa en la bodega (cargoCap)
export function withdrawAll(save, sys, cargoRoom) {
  const o = outpostAt(save, sys);
  if (!o) return 0;
  const st = storeOf(o);
  let moved = 0, room = cargoRoom;
  for (const [k, n] of Object.entries(st.mats)) { save.galaxyMats[k] = (save.galaxyMats[k] || 0) + n; moved += n; delete st.mats[k]; }
  for (const [k, n] of Object.entries(st.cargo)) {
    const q = Math.min(n, room);
    if (q <= 0) continue;
    save.galaxy.cargo[k] = (save.galaxy.cargo[k] || 0) + q;
    st.cargo[k] -= q;
    if (!st.cargo[k]) delete st.cargo[k];
    room -= q;
    moved += q;
  }
  return moved;
}

// ---------- Efectos en el resto de la Galaxia ----------
// descuento de fabricación si estás atracado en un puesto con taller
export const workshopDisc = (save, sys) => (modLvl(save, sys, 'workshop') ? 1 - (0.1 + 0.1 * modLvl(save, sys, 'workshop')) : 1);
// el mercado de ese sistema se recupera más rápido y paga algo más
export const marketRate = (save, sys) => 1 + modLvl(save, sys, 'market');
export const marketBonus = (save, sys) => 1 + 0.05 * modLvl(save, sys, 'market');
// sistemas que revela el radar (a N saltos de cada puesto con radar)
export function radarSystems(save, gal) {
  const out = new Set();
  for (const o of outpostList(save)) {
    const r = modLvl(save, o.sys, 'radar');
    if (!r) continue;
    let front = [o.sys];
    out.add(o.sys);
    for (let h = 0; h < r + 1; h++) {
      const next = [];
      for (const id of front) for (const l of gal[id].links) if (!out.has(l)) { out.add(l); next.push(l); }
      front = next;
    }
  }
  return out;
}
