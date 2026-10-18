// GALAXIA: facciones, reputación, territorio y cazarrecompensas. Módulo puro (se testea en Node).
import { makeRng, hashString } from './rng.js';
import { route } from './galaxy.js';

// ---------- Facciones ----------
export const FACTIONS = {
  liga: { name: 'Liga Minera', icon: '⛏️', color: '#30d158', desc: 'Mineros y transportistas. Pagan mejor el mineral.' },
  coal: { name: 'Coalición Solar', icon: '☀️', color: '#00e5ff', desc: 'Patrullas y científicos. Defienden las rutas.' },
  pir: { name: 'Piratas del Vacío', icon: '☠️', color: '#ff2d55', desc: 'Dueños de lo lejano. Sus estaciones no te dejan atracar.' },
};
export const ALLIES = ['liga', 'coal'];

// Dueño de un sistema: ORIGEN es de la Coalición; lo lejano, pirata; el resto se reparte.
// `territory` guarda los sistemas que has liberado (y a quién se los diste).
export function ownerOf(sys, territory = {}) {
  if (territory[sys.id]) return territory[sys.id];
  if (sys.id === 0) return 'coal';
  const r = makeRng(hashString(`own-${sys.id}`)).next();
  if (sys.danger >= 5 || (sys.danger === 4 && r < 0.3)) return 'pir';
  return r < 0.5 ? 'liga' : 'coal';
}
export const piratesHeld = (gal, territory) => gal.filter((s) => ownerOf(s, territory) === 'pir');
export const liberatedCount = (territory) => Object.keys(territory || {}).length;
export const pirateSystemsTotal = (gal) => gal.filter((s) => ownerOf(s, {}) === 'pir').length;

// ---------- Reputación (−100…100) ----------
export const REP_LEVELS = [
  { id: 'hostil', name: 'Hostil', min: -100, sell: 0.9, disc: 1 },
  { id: 'neutral', name: 'Neutral', min: -30, sell: 1, disc: 1 },
  { id: 'amigo', name: 'Amigo', min: 20, sell: 1.05, disc: 0.95 },
  { id: 'aliado', name: 'Aliado', min: 60, sell: 1.12, disc: 0.9 },
];
export const repOf = (save, f) => save.factionRep?.[f] || 0;
export const repLevel = (rep) => [...REP_LEVELS].reverse().find((l) => rep >= l.min);
export function addRep(save, f, n) {
  if (!FACTIONS[f]) return 0;
  const before = repLevel(repOf(save, f)).id;
  save.factionRep[f] = Math.max(-100, Math.min(100, repOf(save, f) + n));
  return repLevel(repOf(save, f)).id !== before ? repLevel(repOf(save, f)) : null; // nivel nuevo
}
// A quién va un sistema liberado: a la facción aliada con la que te llevas mejor
export const bestAlly = (save) => (repOf(save, 'liga') > repOf(save, 'coal') ? 'liga' : 'coal');

// Liberar un sistema pirata: destruir su base y LIBERATE_KILLS piratas
export const LIBERATE_KILLS = 4;

// ---------- Tienda de facción (con créditos, a partir de Amigo) ----------
export const FACTION_SHOP = [
  { id: 'f-liga', faction: 'liga', minLvl: 'amigo', cost: 2000 },
  { id: 'f-coal', faction: 'coal', minLvl: 'amigo', cost: 2000 },
  { id: 'f-liga-e', faction: 'liga', minLvl: 'aliado', cost: 3500 },
  { id: 'f-coal-e', faction: 'coal', minLvl: 'aliado', cost: 3500 },
];
const LVL_ORDER = REP_LEVELS.map((l) => l.id);
export const lvlAtLeast = (rep, id) => LVL_ORDER.indexOf(repLevel(rep).id) >= LVL_ORDER.indexOf(id);

// ---------- Cazarrecompensas ----------
const NAMES = ['Vex', 'Mara', 'Kolt', 'Ysra', 'Draven', 'Nix', 'Tarek', 'Sable', 'Orla', 'Brann', 'Quill', 'Zeta'];
const EPITHETS = ['el Rojo', 'la Sombra', 'Mil Caras', 'el Carnicero', 'la Víbora', 'Ojo de Plata', 'el Errante', 'la Tormenta'];
export const TRAITS = {
  escurridizo: { icon: '💨', name: 'Escurridizo', desc: 'rápido y huye antes' },
  blindado: { icon: '🛡️', name: 'Blindado', desc: '+60% de vida' },
  enjambre: { icon: '🐝', name: 'Enjambre', desc: 'va con drones' },
  artillero: { icon: '🎯', name: 'Artillero', desc: 'dispara más fuerte' },
};

// 3 carteles de SE BUSCA en la estación `sysId` (deterministas por tablón)
export function bountyBoard(gal, sysId, seq, done = {}) {
  const rng = makeRng(hashString(`bounty-${sysId}-${seq}`));
  const far = gal.filter((s) => s.id && s.danger >= 2);
  const out = [];
  for (let i = 0; i < 3 && far.length; i++) {
    const s = rng.pick(far);
    const level = Math.min(5, 1 + Math.floor(s.danger / 2) + (rng.next() < 0.3 ? 1 : 0));
    const id = `b-${sysId}-${seq}-${i}`;
    if (done[id]) continue;
    const trait = rng.pick(Object.keys(TRAITS));
    out.push({
      id, name: `${rng.pick(NAMES)} ${rng.pick(EPITHETS)}`, level, trait, sys: s.id, from: sysId,
      reward: 300 + level * 250, gems: 5 + level * 3, moves: 0,
    });
  }
  return out;
}

// El objetivo se mueve a un sistema vecino cada 3 saltos tuyos (determinista)
export function moveBounty(gal, b, jumpN) {
  if (jumpN % 3 !== 0) return b.sys;
  const links = gal[b.sys].links.filter((l) => l !== 0);
  if (!links.length) return b.sys;
  return links[makeRng(hashString(`bmove-${b.id}-${jumpN}`)).int(0, links.length - 1)];
}

// Ficha de combate del objetivo (vida, velocidad, daño) según nivel y rasgo
export function bountyStats(b) {
  const hp = (180 + b.level * 90) * (b.trait === 'blindado' ? 1.6 : 1);
  return {
    hp, speed: (95 + b.level * 6) * (b.trait === 'escurridizo' ? 1.35 : 1), turn: 1.6,
    dmg: (7 + b.level * 2) * (b.trait === 'artillero' ? 1.5 : 1), size: 9, drones: b.trait === 'enjambre' ? 4 : 0,
  };
}

// Si te destruye, sube de nivel y paga más (némesis)
export function nemesisUp(b) {
  if (b.level >= 6) return b;
  return { ...b, level: b.level + 1, reward: Math.round(b.reward * 1.25), gems: b.gems + 3 };
}

export const hopsTo = (gal, a, b) => (route(gal, a, b)?.length ?? 99) - 1;
