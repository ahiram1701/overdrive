// GALAXIA: lógica del MAPA (pura, se testea en Node): qué insignias lleva cada sistema, cuánto cuesta
// una ruta y dónde poner los nombres para que no se pisen. El dibujo y los gestos, en ui.js.
import { tollFor } from './market.js';

// colores del peligro (0..6) y significado de cada insignia (orden = prioridad)
export const DANGER_COLORS = ['#30d158', '#7df9ff', '#ffe600', '#ff9f0a', '#ff6a00', '#ff2d55', '#bf5af2'];
export const dangerColor = (d) => DANGER_COLORS[Math.max(0, Math.min(6, d))];
export const BADGES = {
  story: { icon: '📖', layer: 'obj', name: 'Objetivo de la historia' },
  mission: { icon: '📋', layer: 'obj', name: 'Misión aceptada' },
  bounty: { icon: '🎯', layer: 'obj', name: 'Recompensa (cazar a un pirata)' },
  war: { icon: '⚔️', layer: 'evt', name: 'Ofensiva pirata: defiéndelo' },
  swarm: { icon: '🐝', layer: 'evt', name: 'Infectado por el enjambre' },
  pirate: { icon: '🏴‍☠️', layer: 'fac', name: 'Sistema pirata (base): libéralo' },
  outpost: { icon: '🏗️', layer: 'fac', name: 'Tu puesto avanzado' },
  home: { icon: '🏠', layer: 'fac', name: 'Tu estación base' },
};
export const BADGE_KEYS = Object.keys(BADGES);
export const LAYERS = { obj: '📋 Objetivos', fac: '🏳️ Facciones', evt: '⚡ Sucesos', dng: '☠ Peligro' };
export const MAX_BADGES = 4;

// ctx = { story: sys|null, missions: [sys], bounty: sys|null, war: sys|null, swarm: [sys], pirates: Set, outposts: Set, home }
export function badgesFor(id, ctx, layers = {}) {
  const on = (k) => layers[BADGES[k].layer] !== false;
  const has = {
    story: ctx.story === id,
    mission: ctx.missions?.includes(id),
    bounty: ctx.bounty === id,
    war: ctx.war === id,
    swarm: ctx.swarm?.includes(id),
    pirate: ctx.pirates?.has(id),
    outpost: ctx.outposts?.has(id),
    home: ctx.home === id,
  };
  const all = BADGE_KEYS.filter((k) => has[k] && on(k));
  return { shown: all.slice(0, MAX_BADGES), more: Math.max(0, all.length - MAX_BADGES) };
}

// peaje total de una ruta [desde, …, hasta] (el Salto Mk 6+ lo abarata, como al saltar)
export function routeToll(gal, path, jumpLvl = 0) {
  const k = Math.max(0.25, 1 - 0.15 * Math.max(0, jumpLvl - 5));
  return path.slice(1).reduce((a, id) => a + Math.round(tollFor(gal[id].danger) * k), 0);
}

// Coloca los nombres: debajo del nodo; si pisa a otro, encima; si tampoco cabe, se oculta (salvo
// los importantes: donde estás y el elegido). nodes = [{ id, x, y, name, keep }], u = unidades por px.
// measure(texto) = ancho real en px con la fuente del mapa (cada sistema operativo la dibuja distinta);
// sin él, una estimación generosa.
export function placeLabels(nodes, u, font = 11, measure = null) {
  const fs = font * u, out = [], boxes = [];
  const box = (x, y, w) => ({ x0: x - w / 2, x1: x + w / 2, y0: y - fs, y1: y + fs * 0.25 });
  const hits = (b) => boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
  // primero los importantes, para que nunca se oculten
  const order = [...nodes].sort((a, b) => (b.keep ? 1 : 0) - (a.keep ? 1 : 0));
  for (const n of order) {
    const w = (measure ? measure(n.name) : n.name.length * font * 0.72) * u + fs * 0.5;
    const below = { x: n.x, y: n.y + 26 * u };
    const above = { x: n.x, y: n.y - 18 * u };
    let pos = null;
    for (const c of [below, above]) if (!hits(box(c.x, c.y, w))) { pos = c; break; }
    if (!pos && n.keep) pos = below;
    if (pos) boxes.push(box(pos.x, pos.y, w));
    out.push({ id: n.id, x: pos?.x ?? n.x, y: pos?.y ?? n.y, hidden: !pos, box: pos ? box(pos.x, pos.y, w) : null });
  }
  return out;
}
