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
  // ANOMALÍAS (desde el peligro 2): cada una hace algo al escanearla
  derelict: { icon: '🏚️', name: 'Estación abandonada', color: '#ff9f0a', from: 2, effect: 'ambush', lore: ['Una estación minera vacía. Las luces se encienden al acercarte.'] },
  relic: { icon: '🗿', name: 'Reliquia antigua', color: '#ffd60a', from: 3, effect: 'gear', lore: ['Un artefacto de otra era, todavía caliente.'] },
  nebula: { icon: '🌫️', name: 'Nebulosa', color: '#64d2ff', from: 2, effect: 'ore', lore: ['Gas brillante cargado de mineral oscuro.'] },
  beacon: { icon: '📻', name: 'Baliza antigua', color: '#30d158', from: 1, effect: 'credits', lore: ['Una baliza de socorro de hace siglos con un cofre de recompensa.'] },
};
// 40 líneas del ATLAS: cada descubrimiento nuevo cuenta la siguiente (no se repiten hasta agotarlas)
export const LORE = [
  'Un pliegue del espacio que zumba en todas las frecuencias.', 'La luz se curva aquí como si algo enorme durmiera.', 'Ecos de un salto que nunca terminó.',
  'Restos de un carguero de la primera ola de colonos.', 'Una nave de guerra partida en dos. El reactor aún late.', 'Un yate de lujo, vacío, con la música todavía sonando.',
  'Una baliza repite coordenadas de un sistema que no existe.', 'Un mensaje en bucle: "No sigáis al sol rojo".', 'Risas grabadas, de hace trescientos años.',
  'Un mundo de diamante que refleja las estrellas.', 'Océanos de mercurio con mareas violentas.', 'Un planeta que gira al revés que todos los demás.',
  'Una cápsula de escape con un diario: "día 412, aún nadie".', 'Grafitis de mineros en un asteroide: "Brak estuvo aquí".', 'Un campo de minas de una guerra que nadie recuerda.',
  'Un satélite que sigue enviando el parte del tiempo de un planeta muerto.', 'Hielo con burbujas de aire de otra galaxia.', 'Un muelle de carga flotando solo, con su grúa todavía girando.',
  'Cristales que cantan cuando pasa una nave.', 'Un cementerio de cascos ordenados en filas perfectas.', 'Huellas de motor que dibujan una espiral imposible.',
  'Un faro apagado. En su bitácora, una sola palabra: "Devorador".', 'Una colonia de algas que brilla al ritmo de tu escudo.', 'Polvo dorado que se pega al casco y no se va.',
  'Un tablero de ajedrez flotando, con la partida a medias.', 'La firma de una nave de la Coalición… de dentro de diez años.', 'Un asteroide hueco con un jardín dentro.',
  'Mapas estelares grabados en hueso.', 'Un enjambre de drones dormidos, en formación de abeja.', 'Un reloj que marca la hora de la última vez que alguien pasó.',
  'El eco de una canción pirata, en bucle, desde hace un siglo.', 'Un portal sellado con el emblema de la Liga.', 'Lluvia de meteoritos que cae siempre en el mismo sitio.',
  'Una estación médica con todas las camas hechas.', 'Una estrella que parpadea en código.', 'Un casco gigantesco con marcas de dientes.',
  'Burbujas de vacío que hacen que el tiempo vaya más lento.', 'Una flota fantasma, sin tripulación, en patrulla eterna.', 'El primer mensaje de la Señal, grabado en piedra.',
  'Nada. Absolutamente nada. Y eso, aquí, da miedo.',
];
// el texto de un descubrimiento (los antiguos guardan el suyo; los nuevos, su número en el Atlas)
export const loreOf = (atlas, poi) => (typeof atlas?.[poi.id] === 'number' ? LORE[(atlas[poi.id] - 1) % LORE.length] : poi.lore);
export const SCAN_TIME = 3; // segundos cerca para escanear
export const SCAN_R = 140;

// PdI de un sistema (deterministas): 1-3, más en los sistemas lejanos
export function poisOf(gal, sysId) {
  const s = gal[sysId];
  const rng = makeRng(hashString(`poi-${sysId}`));
  const n = sysId === 0 ? 1 : Math.min(3, 1 + Math.floor(s.danger / 2) + (rng.next() < 0.4 ? 1 : 0));
  const kinds = Object.keys(POI_KINDS).filter((k) => !POI_KINDS[k].from || s.danger >= POI_KINDS[k].from);
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
  { n: 3, id: 'scanner', name: 'Escáner de largo alcance', desc: 'Escaneas desde el doble de lejos y en la mitad de tiempo.' },
  { n: 8, id: 'alien', name: 'Blindaje alienígena', desc: '+40 de escudo.' },
  { n: 15, id: 'oracle', name: 'Ojo del oráculo', desc: 'Los piratas sueltan el doble de créditos.' },
  { n: 22, id: 'cartographer', name: 'Cartógrafo', desc: 'Todas las estaciones te pagan el mineral un 10% más.' },
  { n: 30, id: 'salvager', name: 'Rastreador', desc: 'Cada descubrimiento da 2 materiales más.' },
  { n: 40, id: 'legend', name: 'Leyenda del vacío', desc: '+10% de daño y +10% de casco.' },
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

// CONTRATOS: cada oferta tiene nivel ★ / ★★ / ★★★. Los altos llevan condiciones (contrarreloj en saltos,
// sin daño en el casco) y pagan ×2,5 / ×5. Si fallas una condición, el contrato se pierde.
export const TIER_MUL = [0, 1, 2.5, 5];
export const CONTRACT_MODS = { timed: { icon: '⏱️', name: 'contrarreloj' }, clean: { icon: '🛡️', name: 'sin daño en el casco' } };
export const tierOf = (r) => (r < 0.5 ? 1 : r < 0.83 ? 2 : 3);
export const modsFor = (tier, r) => (tier === 1 ? [] : tier === 2 ? [r < 0.5 ? 'timed' : 'clean'] : ['timed', 'clean']);
// ¿Se acabó el plazo? (deadline se fija al aceptarlo)
export const contractExpired = (m, jumps) => !!m.mods?.includes('timed') && m.deadline != null && jumps > m.deadline;

// Ofertas del tablón de la estación `sysId`. seq cambia al aceptar/cumplir (tablón nuevo).
// visited: sistemas visitados; jumpLvl: para no ofrecer destinos inalcanzables.
export function boardFor(gal, sysId, seq, { jumpLvl = 0, discovered = {} } = {}) {
  const rng = makeRng(hashString(`board-${sysId}-${seq}`));
  const reach = gal.filter((s) => !s.hidden).filter((s) => {
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
    if (!m) continue;
    const tier = tierOf(rng.next()), mods = modsFor(tier, rng.next());
    const hops = kind === 'escort' ? 0 : (route(gal, sysId, m.sys)?.length || 1) - 1;
    const jumps = hops * 2 + 2; // ida y vuelta, y un poco de margen
    const cond = mods.map((k) => (k === 'timed' ? `⏱️ ${jumps} saltos` : '🛡️ sin daño en el casco')).join(' · ');
    const base = m.reward + Math.round(m.reward / 60) * 60;
    out.push({ ...m, text: `${'★'.repeat(tier)} ${m.text}${cond ? ` · ${cond}` : ''}`, tier, mods, jumps,
      reward: Math.round((base * TIER_MUL[tier]) / 10) * 10, id: `${sysId}-${seq}-${kind}`, from: sysId, progress: 0 });
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
