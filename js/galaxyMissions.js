// GALAXIA: misiones y descubrimientos. Módulo puro (se testea en Node).
// - Puntos de interés (PdI) en cada sistema: se escanean volando cerca unos segundos -> ATLAS.
// - Tablón de misiones en cada estación: caza, entrega, exploración y escolta.
import { makeRng, hashString } from './rng.js';
import { route } from './galaxy.js';

// ---------- Descubrimientos ----------
export const POI_KINDS = {
  anomaly: { icon: '🌀', name: 'Anomalía', color: '#bf5af2', lore: ['Un pliegue del espacio que zumba en todas las frecuencias.', 'La luz se curva aquí como si algo enorme durmiera.', 'Ecos de un salto que nunca terminó.'] },
  wreck: { icon: '🛸', name: 'Pecio', color: '#8e8e93', lore: ['Restos de un carguero de la primera ola de colonos.', 'Una nave de guerra partida en dos. El reactor aún late.', 'Un yate de lujo, vacío, con la música todavía sonando.'] },
  signal: { icon: '📡', name: 'Señal', color: '#30d158', lore: ['Una baliza repite coordenadas de un sistema que no existe.', 'Un mensaje en bucle: "No sigáis al sol rojo".', 'Risas grabadas, de hace trescientos años.'] },
  planet: { icon: '🪐', name: 'Planeta raro', color: '#ffcc00', lore: ['Un mundo de diamante que refleja las estrellas.', 'Océanos de mercurio con mareas violentas.', 'Un planeta que gira al revés que todos los demás.'] },
};
export const SCAN_TIME = 3; // segundos cerca para escanear
export const SCAN_R = 140;

// PdI de un sistema (deterministas): 1-3, más en los sistemas lejanos
export function poisOf(gal, sysId) {
  const s = gal[sysId];
  const rng = makeRng(hashString(`poi-${sysId}`));
  const n = sysId === 0 ? 1 : Math.min(3, 1 + Math.floor(s.danger / 2) + (rng.next() < 0.4 ? 1 : 0));
  const kinds = Object.keys(POI_KINDS);
  return Array.from({ length: n }, (_, i) => {
    const kind = sysId === 0 && i === 0 ? 'signal' : rng.pick(kinds);
    const a = rng.range(0, Math.PI * 2), R = rng.range(1100, 1900);
    return {
      id: `${sysId}-${i}`, sys: sysId, kind, pos: { x: Math.cos(a) * R, y: rng.range(-220, 220), z: Math.sin(a) * R },
      reward: 60 + s.danger * 45, lore: rng.pick(POI_KINDS[kind].lore),
    };
  });
}

export const allPois = (gal) => gal.flatMap((s) => poisOf(gal, s.id));

// Mejoras únicas por descubrir (el Atlas premia explorar)
export const ATLAS_PERKS = [
  { n: 3, id: 'warp', name: 'Motor de curvatura', desc: 'El impulso recarga un 35% más rápido.' },
  { n: 8, id: 'alien', name: 'Blindaje alienígena', desc: '+40 de escudo.' },
  { n: 15, id: 'oracle', name: 'Ojo del oráculo', desc: 'Los piratas sueltan el doble de créditos.' },
];
export const perksFor = (count) => ATLAS_PERKS.filter((p) => count >= p.n).map((p) => p.id);

// ---------- Misiones ----------
export const MAX_ACTIVE = 3;
export const MISSION_KINDS = {
  hunt: { icon: '🎯', name: 'Caza' },
  deliver: { icon: '📦', name: 'Entrega' },
  scan: { icon: '📡', name: 'Exploración' },
  escort: { icon: '🛡️', name: 'Escolta' },
};

// Ofertas del tablón de la estación `sysId`. seq cambia al aceptar/cumplir (tablón nuevo).
// visited: sistemas visitados; jumpLvl: para no ofrecer destinos inalcanzables.
export function boardFor(gal, sysId, seq, { jumpLvl = 0, discovered = {} } = {}) {
  const rng = makeRng(hashString(`board-${sysId}-${seq}`));
  const reach = gal.filter((s) => {
    const r = route(gal, sysId, s.id);
    return r && r.length - 1 <= 3 && Math.max(0, s.danger - 1) <= jumpLvl;
  });
  const out = [];
  const tries = ['hunt', 'deliver', 'scan', 'escort'];
  rng.shuffle(tries);
  for (const kind of tries) {
    if (out.length >= 3) break;
    let m = null;
    if (kind === 'hunt') {
      const opts = reach.filter((s) => s.pirates > 0);
      if (!opts.length) continue;
      const t = rng.pick(opts);
      const n = rng.int(2, 3 + Math.floor(t.danger / 2));
      m = { kind, sys: t.id, n, text: `Elimina ${n} piratas en ${t.name}`, reward: 90 + n * (30 + t.danger * 20) };
    } else if (kind === 'deliver') {
      const opts = reach.filter((s) => s.id !== sysId);
      if (!opts.length) continue;
      const t = rng.pick(opts);
      const hops = route(gal, sysId, t.id).length - 1;
      m = { kind, sys: t.id, n: 1, text: `Lleva un paquete a la estación de ${t.name}`, reward: 80 + hops * 70 + t.danger * 30 };
    } else if (kind === 'scan') {
      const opts = reach.flatMap((s) => poisOf(gal, s.id)).filter((p) => !discovered[p.id]);
      if (!opts.length) continue;
      const p = rng.pick(opts);
      m = { kind, sys: p.sys, poi: p.id, n: 1, text: `Escanea ${POI_KINDS[p.kind].name.toLowerCase()} en ${gal[p.sys].name}`, reward: 100 + gal[p.sys].danger * 50 };
    } else if (kind === 'escort') {
      if (gal[sysId].links.length === 0) continue;
      const to = rng.pick(gal[sysId].links);
      m = { kind, sys: sysId, gate: to, n: 1, text: `Escolta un carguero hasta la puerta a ${gal[to].name}`, reward: 150 + gal[sysId].danger * 60 };
    }
    // la Galaxia paga solo en créditos (antes también gemas: ahora va todo al premio)
    if (m) out.push({ ...m, reward: m.reward + Math.round(m.reward / 60) * 60, id: `${sysId}-${seq}-${kind}`, from: sysId, progress: 0 });
  }
  return out;
}

// ¿Cumplida? (la entrega se cobra al atracar en el destino)
export const missionDone = (m) => m.progress >= m.n;

// Avanza las misiones con un suceso: { type: 'kill'|'dock'|'scan'|'escort', sys, poi?, gate? }.
// Devuelve las que se acaban de cumplir.
export function advanceMissions(list, ev) {
  const done = [];
  for (const m of list) {
    if (missionDone(m)) continue;
    const hit = (m.kind === 'hunt' && ev.type === 'kill' && ev.sys === m.sys)
      || (m.kind === 'deliver' && ev.type === 'dock' && ev.sys === m.sys)
      || (m.kind === 'scan' && ev.type === 'scan' && ev.poi === m.poi)
      || (m.kind === 'escort' && ev.type === 'escort' && ev.sys === m.sys && ev.gate === m.gate);
    if (!hit) continue;
    m.progress++;
    if (missionDone(m)) done.push(m);
  }
  return done;
}
