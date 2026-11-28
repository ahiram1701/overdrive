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
  // SECTORES LEJANOS: por el peligro serían todos piratas; ahí hay de todo (más piratas cuanto más lejos)
  if (sys.sec) {
    const ring = Math.max(Math.abs(sys.sec[0]), Math.abs(sys.sec[1]));
    const pir = Math.min(0.6, 0.18 + 0.07 * ring);
    return r < pir ? 'pir' : r < pir + (1 - pir) / 2 ? 'liga' : 'coal';
  }
  if (sys.danger >= 5 || (sys.danger === 4 && r < 0.3)) return 'pir';
  return r < 0.5 ? 'liga' : 'coal';
}
export const piratesHeld = (gal, territory) => gal.filter((s) => !s.hidden && ownerOf(s, territory) === 'pir');
export const liberatedCount = (territory) => Object.keys(territory || {}).length;
export const pirateSystemsTotal = (gal) => gal.filter((s) => !s.hidden && ownerOf(s, {}) === 'pir').length;

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
  const far = gal.filter((s) => s.id && !s.hidden && !s.sec && s.danger >= 2);
  const out = [];
  for (let i = 0; i < 3 && far.length; i++) {
    const s = rng.pick(far);
    const level = Math.min(5, 1 + Math.floor(s.danger / 2) + (rng.next() < 0.3 ? 1 : 0));
    const id = `b-${sysId}-${seq}-${i}`;
    if (done[id]) continue;
    const trait = rng.pick(Object.keys(TRAITS));
    out.push({
      id, name: `${rng.pick(NAMES)} ${rng.pick(EPITHETS)}`, level, trait, sys: s.id, from: sysId,
      reward: 600 + level * 430, moves: 0, // solo créditos
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
  return { ...b, level: b.level + 1, reward: Math.round(b.reward * 1.25) };
}

export const hopsTo = (gal, a, b) => (route(gal, a, b)?.length ?? 99) - 1;

// ---------- CAMPAÑAS DE FACCIÓN: 5 encargos seguidos y, al final, su chasis exclusivo ----------
export const CAMP_LEN = 5;
export const CAMPAIGNS = {
  liga: { who: 'brak', need: 10, chassis: 'minero', kinds: ['sell', 'dock', 'kill', 'reach', 'base'], title: 'Contratos de la Liga' },
  coal: { who: 'ilen', need: 10, chassis: 'centinela', kinds: ['kill', 'scan', 'reach', 'dock', 'base'], title: 'Patrulla de la Coalición' },
  pir: { who: 'vex', need: 10, chassis: 'saqueador', kinds: ['reach', 'kill', 'scan', 'sell', 'base'], title: 'Trabajos de Vex' },
};
const CAMP_TEXT = {
  reach: (n) => `Lleva un mensaje a la baliza de ${n}`,
  scan: (n) => `Escanea la anomalía de ${n}`,
  dock: (n) => `Entrega un cargamento en la estación de ${n}`,
  sell: (n, k) => `Vende ${k} de mineral en ${n}`,
  kill: (n, k) => `Abate ${k} piratas en ${n}`,
  base: (n) => `Destruye la base pirata de ${n}`,
};
// el encargo i (0-4) de la facción f: determinista; cada vez más lejos y más duro
export function campaignStep(gal, f, i) {
  const C = CAMPAIGNS[f], kind = C.kinds[i % C.kinds.length];
  const rng = makeRng(hashString(`camp-${f}-${i}`));
  const want = Math.min(Math.max(...gal.filter((s) => !s.hidden && !s.sec).map((s) => s.danger)), 1 + i);
  // donde hay que atracar o vender, nunca en un sistema pirata (no te dejan); las bases, solo en los piratas
  const okSys = (s) => s.id !== 0 && !s.hidden && !s.sec && (['dock', 'sell'].includes(kind) ? ownerOf(s) !== 'pir' : kind === 'base' ? ownerOf(s) === 'pir' : true);
  const pool = gal.filter(okSys);
  const near = pool.filter((s) => s.danger === want);
  const sys = rng.pick(near.length ? near : pool).id;
  const n = kind === 'kill' ? 4 + 2 * i : kind === 'sell' ? 10 + 5 * i : 1;
  return { f, i, kind, sys, n, text: CAMP_TEXT[kind](gal[sys].name, n), reward: { credits: 1750 + 1050 * i, mats: { chatarra: 4 + 2 * i, ...(i >= 3 ? { nucleos: i - 2 } : {}) } }, last: i === CAMP_LEN - 1 };
}
export const campState = (save) => { save.factionCamp ||= {}; return save.factionCamp; };
export const campStep = (save, f) => campState(save)[f] || 0;
export const campDone = (save, f) => campStep(save, f) >= CAMP_LEN;
// ¿se te abre? Liga y Coalición, desde Amigo; la de Vex, con algo de reputación pirata o si alguna vez elegiste ir por tu cuenta
export function campOpen(save, f) {
  if (f === 'pir') return repOf(save, 'pir') >= CAMPAIGNS.pir.need || Object.values(save.story?.choices || {}).includes('free');
  return repOf(save, f) >= CAMPAIGNS[f].need;
}
export function acceptCampaign(save, f) {
  if (!CAMPAIGNS[f] || !campOpen(save, f) || campDone(save, f)) return false;
  const st = campState(save);
  // cada campaña guarda su avance a medias: cambiar de una a otra no lo pierde
  st.prog = { ...(st.prog || {}) };
  if (st.active) st.prog[st.active] = st.n || 0;
  st.active = f;
  st.n = st.prog[f] || 0;
  return true;
}
export const activeCampaign = (save, gal) => { const f = campState(save).active; return f && !campDone(save, f) ? campaignStep(gal, f, campStep(save, f)) : null; };
// un suceso de la galaxia (los mismos que la historia): devuelve el encargo si se acaba de completar
export function campaignEvent(save, gal, ev) {
  const step = activeCampaign(save, gal);
  if (!step || step.kind !== ev.type || step.sys !== ev.sys) return null;
  const st = campState(save);
  st.n = (st.n || 0) + Math.max(1, ev.amount || 1);
  if (st.n < step.n) return null;
  st[step.f] = campStep(save, step.f) + 1;
  st.n = 0;
  if (campDone(save, step.f)) st.active = null;
  return step;
}
