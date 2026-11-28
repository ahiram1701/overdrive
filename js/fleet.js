// GALAXIA · FLOTA, TRIPULACIÓN Y SEGURO: en qué gastar SIEMPRE (todo escala sin techo). Módulo puro.
//
// CARGUEROS: naves tuyas que comercian solas en una ruta (de tu base a un sistema que elijas). Cada salto
// que das ellos hacen un viaje: ganan más cuanto más lejos y peligrosa es la ruta... y pueden perderse.
// Con SEGURO, si se pierden te devuelven parte. Se mejoran sin fin (más bodega = más ganancia).
// TRIPULACIÓN: especialistas que contratas y subes de nivel sin fin; cobran un sueldo por salto.
// SEGURO de tu nave: una póliza por saltos que rebaja el remolque si te derriban.
import { hashString } from './rng.js';

const r100 = (n) => Math.round(n / 100) * 100;
const r50 = (n) => Math.round(n / 50) * 50;

// ---------- CARGUEROS ----------
export const FREIGHTER_NAMES = ['Mula', 'Tortuga', 'Ballena', 'Buey', 'Camello', 'Hormiga', 'Elefante', 'Albatros', 'Morsa', 'Bisonte', 'Yak', 'Llama'];
export const freighterCost = (owned) => r100(9000 * Math.pow(1.7, owned)); // el siguiente carguero, cada vez más caro
export const freighterUpCost = (lvl) => r50(2200 * Math.pow(1.45, lvl - 1)); // subir de nivel: sin techo
export const BANK_MAX = 30; // como mucho, 30 viajes de ganancias sin recoger
// lo que gana un viaje: crece con su nivel y con el peligro de la ruta
export const tripIncome = (lvl, danger) => Math.round((60 + 30 * lvl) * (1 + 0.18 * danger));
// probabilidad de perderlo en un viaje (los de nivel alto se defienden mejor)
export const lossChance = (lvl, danger) => Math.max(0, Math.min(0.2, 0.004 + 0.009 * danger - 0.002 * lvl));
export const INSURE_BACK = 0.6; // con seguro, si se pierde, te devuelven el 60 % de lo invertido
export const insureCost = (f) => r50(250 + 0.04 * (f.invested || 0)); // póliza por 10 viajes
export const INSURE_TRIPS = 10;

export function fleetOf(save) {
  return (save.galaxyFleet ||= { ships: [], seq: 0, crew: {}, insure: 0 });
}
export function buyFreighter(save, home) {
  const F = fleetOf(save), g = save.galaxy, c = freighterCost(F.ships.length);
  if (g.credits < c) return null;
  g.credits -= c;
  const f = { id: ++F.seq, name: `${FREIGHTER_NAMES[(F.seq - 1) % FREIGHTER_NAMES.length]} ${Math.floor((F.seq - 1) / FREIGHTER_NAMES.length) + 1}`, lvl: 1, to: home, bank: 0, trips: 0, invested: c, ins: 0 };
  F.ships.push(f);
  return f;
}
export function upgradeFreighter(save, id) {
  const f = fleetOf(save).ships.find((x) => x.id === id), g = save.galaxy;
  if (!f) return false;
  const c = freighterUpCost(f.lvl);
  if (g.credits < c) return false;
  g.credits -= c;
  f.lvl++;
  f.invested += c;
  return true;
}
export function insureFreighter(save, id) {
  const f = fleetOf(save).ships.find((x) => x.id === id), g = save.galaxy;
  if (!f) return false;
  const c = insureCost(f);
  if (g.credits < c) return false;
  g.credits -= c;
  f.ins += INSURE_TRIPS;
  return true;
}
export function routeFreighter(save, id, sys) {
  const f = fleetOf(save).ships.find((x) => x.id === id);
  if (!f) return false;
  f.to = sys;
  return true;
}
// UN SALTO tuyo = un viaje de cada carguero. Determinista (por salto y carguero). Devuelve las noticias.
export function tickFleet(save, gal, jumps) {
  const F = fleetOf(save), out = [];
  for (const f of [...F.ships]) {
    const d = gal[f.to]?.danger ?? 0;
    const roll = (hashString(`fleet-${f.id}-${jumps}`) % 10000) / 10000;
    if (roll < lossChance(f.lvl, d)) {
      F.ships = F.ships.filter((x) => x !== f);
      const back = f.ins > 0 ? Math.round(f.invested * INSURE_BACK) : 0;
      save.galaxy.credits += back + f.bank; // lo que había ganado ya estaba en la cuenta
      out.push(back ? `🚢 Piratas hunden tu carguero ${f.name}: el seguro te paga ${back} 💰` : `🚢 Piratas hunden tu carguero ${f.name} (sin seguro)`);
      continue;
    }
    if (f.ins > 0) f.ins--;
    f.trips++;
    if (f.bank < tripIncome(f.lvl, d) * BANK_MAX) f.bank += tripIncome(f.lvl, d);
  }
  return out;
}
// al atracar en tu base: cobras lo que ganaron
export function collectFleet(save) {
  const F = fleetOf(save);
  let got = 0;
  for (const f of F.ships) { got += f.bank; f.bank = 0; }
  save.galaxy.credits += got;
  return got;
}

// ---------- TRIPULACIÓN ----------
export const CREW = {
  pilot: { name: 'Piloto', icon: '🧑‍✈️', desc: 'Más velocidad y giro', stat: 'speed', per: 0.03 },
  gunner: { name: 'Artillera', icon: '🎯', desc: 'Más daño', stat: 'dmg', per: 0.03 },
  engineer: { name: 'Ingeniero', icon: '🔧', desc: 'El escudo se regenera antes y reparar cuesta menos', stat: 'regen', per: 0.04 },
  trader: { name: 'Comerciante', icon: '💼', desc: 'Vendes más caro', stat: 'sell', per: 0.025 },
};
export const CREW_KEYS = Object.keys(CREW);
export const crewCost = (lvl) => r50(1200 * Math.pow(1.5, lvl)); // contratar (lvl 0) o subir: sin techo
export const crewWage = (lvl) => 12 * lvl; // sueldo por salto
// bonus de un puesto: lineal al principio y cada vez menos por nivel (nunca rompe el juego)
export const crewBonus = (lvl, per) => (lvl > 0 ? (per * lvl) / (1 + lvl / 25) : 0);
export function crewMul(save, stat) {
  const crew = fleetOf(save).crew;
  let m = 1;
  for (const k of CREW_KEYS) if (CREW[k].stat === stat && !crew.unpaid) m += crewBonus(crew[k] || 0, CREW[k].per);
  return m;
}
export function hireCrew(save, k) {
  const crew = fleetOf(save).crew, g = save.galaxy, lvl = crew[k] || 0, c = crewCost(lvl);
  if (!CREW[k] || g.credits < c) return false;
  g.credits -= c;
  crew[k] = lvl + 1;
  return true;
}
// los sueldos, en cada salto; si no puedes pagar, ese salto trabajan sin ganas (sin bonus)
export function payCrew(save) {
  const crew = fleetOf(save).crew, g = save.galaxy;
  const total = CREW_KEYS.reduce((a, k) => a + crewWage(crew[k] || 0), 0);
  if (!total) return 0;
  if (g.credits >= total) { g.credits -= total; crew.unpaid = false; return total; }
  crew.unpaid = true;
  return -total;
}

// ---------- SEGURO de tu nave ----------
export const SHIP_INSURE = { trips: 8, cost: (danger) => r50(300 + 90 * Math.max(1, danger)), cut: 0.5 }; // remolque a la mitad
export function insureShip(save, danger) {
  const F = fleetOf(save), g = save.galaxy, c = SHIP_INSURE.cost(danger);
  if (g.credits < c) return false;
  g.credits -= c;
  F.insure = (F.insure || 0) + SHIP_INSURE.trips;
  return true;
}
export const shipInsured = (save) => (fleetOf(save).insure || 0) > 0;
