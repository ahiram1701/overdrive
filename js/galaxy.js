// GALAXIA: la galaxia procedural (pura, determinista). ~30 sistemas unidos por puertas de salto.
// El peligro es la distancia en saltos a ORIGEN; lejos hay mejor mineral... y más piratas.
import { makeRng, hashString } from './rng.js';
import { ORES, BASE_ORES } from './galaxyData.js';

export const GALAXY_SEED = 7;
export const N_SYSTEMS = 30;
// SISTEMAS OCULTOS: tras un agujero de gusano junto a los sistemas más lejanos. Piden Salto Mk 6-10
export const HIDDEN_N = 5;
export const isHidden = (s) => !!s?.hidden;
export const mainSystems = (gal) => gal.filter((s) => !s.hidden);

const SYL = ['ka', 'ri', 'on', 'ze', 'tal', 'mor', 'vex', 'lu', 'dra', 'sen', 'qua', 'nim', 'or', 'phe', 'zan', 'tu', 'ix', 'bel', 'cor', 'ya'];
const STARS = [
  { kind: 'amarilla', color: '#ffcc66' }, { kind: 'roja', color: '#ff6b4a' }, { kind: 'azul', color: '#8ec5ff' },
  { kind: 'blanca', color: '#f2f2ff' }, { kind: 'violeta', color: '#c58cff' },
];
// mineral principal según el peligro: más lejos, más valioso
export const oreForDanger = (d) => (d <= 1 ? 'iron' : d <= 3 ? 'crystal' : d <= 5 ? 'plasma' : 'dark');
// en los sectores lejanos, además, los minerales nuevos
export const sectorOre = (d) => (d >= 14 ? 'void' : d >= 9 ? 'exotic' : oreForDanger(d));
// precios de lo que no es de la galaxia de siempre (minerales lejanos y mercancías), con su propio azar
function extraPrices(s, seed, k = 1) {
  const r = makeRng(hashString(`xprice-${seed}-${s.id}`));
  for (const o of Object.keys(ORES)) if (s.prices[o] == null) s.prices[o] = Math.round(ORES[o].price * r.range(0.85, 1.3) * k);
}

function nameOf(rng) {
  const n = 2 + (rng.next() < 0.35 ? 1 : 0);
  let s = '';
  for (let i = 0; i < n; i++) s += rng.pick(SYL);
  return s.toUpperCase();
}

export function genGalaxy(seed = GALAXY_SEED) {
  const rng = makeRng(hashString(`galaxy-${seed}`));
  const sys = [{ id: 0, name: 'ORIGEN', x: 500, y: 500 }];
  // posiciones con separación mínima
  let guard = 0;
  while (sys.length < N_SYSTEMS && guard++ < 5000) {
    const x = rng.range(60, 940), y = rng.range(60, 940);
    if (sys.every((s) => Math.hypot(s.x - x, s.y - y) > 105)) sys.push({ id: sys.length, name: nameOf(rng), x, y });
  }
  // conexiones: árbol de expansión mínima (siempre conexa) + algunos atajos cortos
  const edges = new Set();
  const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const inTree = new Set([0]);
  while (inTree.size < sys.length) {
    let best = null;
    for (const a of inTree) {
      for (const b of sys) {
        if (inTree.has(b.id)) continue;
        const d = Math.hypot(sys[a].x - b.x, sys[a].y - b.y);
        if (!best || d < best.d) best = { a, b: b.id, d };
      }
    }
    edges.add(key(best.a, best.b));
    inTree.add(best.b);
  }
  for (const a of sys) {
    const near = sys.filter((b) => b.id !== a.id).sort((p, q) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(a.x - q.x, a.y - q.y));
    if (rng.next() < 0.5) edges.add(key(a.id, near[1].id));
  }
  for (const s of sys) s.links = [];
  for (const e of edges) {
    const [a, b] = e.split('-').map(Number);
    sys[a].links.push(b);
    sys[b].links.push(a);
  }
  // peligro = saltos desde ORIGEN
  const danger = new Array(sys.length).fill(Infinity);
  danger[0] = 0;
  const q = [0];
  while (q.length) {
    const a = q.shift();
    for (const b of sys[a].links) if (danger[b] === Infinity) { danger[b] = danger[a] + 1; q.push(b); }
  }
  for (const s of sys) {
    const r = makeRng(hashString(`sys-def-${seed}-${s.id}`));
    s.danger = danger[s.id];
    s.links.sort((a, b) => a - b);
    s.star = s.id === 0 ? STARS[0] : r.pick(STARS);
    s.ore = s.id === 0 ? 'iron' : oreForDanger(s.danger);
    s.planets = s.id === 0 ? 3 : r.int(1, 4);
    // precios de compra en esta estación: lo que abunda aquí se paga menos
    s.prices = {};
    for (const k of BASE_ORES) {
      const local = k === s.ore ? 0.75 : 1;
      s.prices[k] = Math.round(ORES[k].price * local * r.range(0.85, 1.35));
    }
    s.pirates = s.id === 0 ? 0 : Math.min(6, s.danger);
    s.boss = s.danger >= 4 && r.next() < 0.5;
  }
  addHidden(sys, seed);
  for (const s of sys) extraPrices(s, seed);
  return sys;
}
function addHidden(sys, seed) {
  const rng = makeRng(hashString(`hidden-${seed}`));
  const hosts = [...sys].sort((a, b) => b.danger - a.danger || a.id - b.id).slice(0, HIDDEN_N);
  const names = new Set(sys.map((s) => s.name));
  hosts.forEach((h, i) => {
    let name = nameOf(rng);
    while (names.has(name)) name = nameOf(rng);
    names.add(name);
    const a = rng.range(0, Math.PI * 2), clamp = (v) => Math.max(30, Math.min(970, v));
    const s = { id: sys.length, name, x: clamp(h.x + Math.cos(a) * 95), y: clamp(h.y + Math.sin(a) * 95), links: [h.id], hidden: true, wormhole: h.id };
    h.links.push(s.id);
    s.danger = 7 + i; // Salto Mk 6, 7, 8, 9 y 10
    s.star = { kind: 'violeta', color: '#c58cff' };
    s.ore = 'dark';
    s.planets = rng.int(2, 4);
    s.prices = {};
    for (const k of BASE_ORES) s.prices[k] = Math.round(ORES[k].price * (k === 'dark' ? 0.7 : 1.2) * rng.range(0.9, 1.3));
    s.pirates = 6;
    s.boss = true;
    sys.push(s);
  });
}

// salto necesario para entrar en un sistema (los dos primeros anillos, libres)
// (más allá del núcleo, el Salto Mk 10 basta para todo: lo que sigue creciendo es la amenaza)
export const jumpNeeded = (sys) => Math.min(10, Math.max(0, sys.danger - 1));
export const canJump = (sys, jumpLvl) => jumpLvl >= jumpNeeded(sys);

// Ruta más corta (en saltos) de a a b
export function route(gal, a, b) {
  const prev = new Map([[a, null]]);
  const q = [a];
  while (q.length) {
    const x = q.shift();
    if (x === b) break;
    for (const y of gal[x].links) if (!prev.has(y)) { prev.set(y, x); q.push(y); }
  }
  if (!prev.has(b)) return null;
  const path = [];
  for (let x = b; x !== null; x = prev.get(x)) path.unshift(x);
  return path;
}

// Sistemas que ves en el mapa: los visitados y sus vecinos (el resto, niebla)
export function known(gal, visited) {
  const out = new Set(visited);
  for (const id of visited) for (const n of gal[id].links) out.add(n);
  return out;
}

// ---------- GALAXIA INFINITA: SECTORES ----------
// La galaxia de siempre es el sector (0, 0). Alrededor hay una rejilla SIN FIN de sectores de 1000×1000,
// cada uno con 18-26 sistemas, generado de forma determinista con (semilla, sx, sy) la primera vez que llegas
// cerca de su borde. Los ids siguen siendo posiciones del array (todo `GAL[id]` sigue valiendo): el orden en
// que se generaron se guarda (save.galaxy.sectors) para reconstruir exactamente lo mismo al cargar.
// Cuanto más lejos de ORIGEN (anillo = max(|sx|, |sy|)), más peligro... y mejores precios.
export const SECTOR = 1000;
export const EDGE = 170; // a esta distancia del borde de un sector, ya se genera el de al lado
const SECTOR_NAMES = ['Brazo', 'Nube', 'Cúmulo', 'Deriva', 'Velo', 'Abismo', 'Corona', 'Marea', 'Frontera', 'Yermo', 'Espiral', 'Grieta'];
export const ringOf = (sx, sy) => Math.max(Math.abs(sx), Math.abs(sy));
export const secOf = (s) => s.sec || [0, 0];
export const secKey = (sx, sy) => `${sx},${sy}`;
export const isCore = (s) => !s.sec;
// nombre del sector (el núcleo es "Núcleo de Origen")
export function sectorName(seed, sx, sy) {
  if (!sx && !sy) return 'Núcleo de Origen';
  const r = makeRng(hashString(`secname-${seed}-${sx}-${sy}`));
  const w = r.pick(SECTOR_NAMES), nm = nameOf(r);
  return `${w} de ${nm[0]}${nm.slice(1).toLowerCase()}`;
}
export const sectorDanger = (ring, local) => 2 + 3 * ring + local;

export function genSector(gal, seed, sx, sy) {
  const key = secKey(sx, sy);
  if (gal.some((s) => s.sec && secKey(...s.sec) === key)) return [];
  const rng = makeRng(hashString(`sector-${seed}-${sx}-${sy}`));
  const ring = ringOf(sx, sy), x0 = sx * SECTOR, y0 = sy * SECTOR;
  const names = new Set(gal.map((s) => s.name));
  const n = rng.int(18, 26), pts = [];
  let guard = 0;
  while (pts.length < n && guard++ < 4000) {
    const x = x0 + rng.range(50, 950), y = y0 + rng.range(50, 950);
    if (pts.every((p) => Math.hypot(p.x - x, p.y - y) > 110)) pts.push({ x, y });
  }
  const base = gal.length;
  const sys = pts.map((p, i) => {
    let name = nameOf(rng);
    while (names.has(name)) name = nameOf(rng);
    names.add(name);
    return { id: base + i, name, x: Math.round(p.x), y: Math.round(p.y), links: [], sec: [sx, sy] };
  });
  // dentro del sector: árbol de expansión mínima + atajos
  const link = (a, b) => { if (a !== b && !a.links.includes(b.id)) { a.links.push(b.id); b.links.push(a.id); } };
  const inTree = [sys[0]];
  while (inTree.length < sys.length) {
    let best = null;
    for (const a of inTree) for (const b of sys) {
      if (inTree.includes(b)) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (!best || d < best.d) best = { a, b, d };
    }
    link(best.a, best.b);
    inTree.push(best.b);
  }
  for (const a of sys) if (rng.next() < 0.45) {
    const near = sys.filter((b) => b !== a).sort((p, q) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(a.x - q.x, a.y - q.y));
    link(a, near[1] || near[0]);
  }
  // PELIGRO: el del anillo + lo lejos que está del lado que mira a ORIGEN (0-4)
  const cx = x0 + 500, cy = y0 + 500, toO = Math.hypot(cx - 500, cy - 500) || 1, ux = (500 - cx) / toO, uy = (500 - cy) / toO;
  for (const s of sys) {
    const r = makeRng(hashString(`sec-def-${seed}-${sx}-${sy}-${s.id - base}`));
    const along = ((s.x - cx) * ux + (s.y - cy) * uy) / 500; // 1 = en el borde hacia Origen, −1 = en el de fuera
    s.danger = sectorDanger(ring, Math.round((1 - along) * 2));
    s.star = r.pick(STARS);
    s.ore = sectorOre(s.danger);
    s.planets = r.int(1, 4);
    // lejos de casa, todo se paga mejor (+8 % por anillo)
    s.prices = {};
    for (const k of Object.keys(ORES)) s.prices[k] = Math.round(ORES[k].price * (k === s.ore ? 0.75 : 1) * r.range(0.85, 1.35) * (1 + 0.08 * ring));
    s.pirates = Math.min(6, s.danger);
    s.boss = r.next() < 0.5;
  }
  gal.push(...sys);
  // con los sectores vecinos que ya existan: 2-3 puertas entre los sistemas más cercanos al borde común
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nk = secKey(sx + dx, sy + dy);
    const other = gal.filter((s) => !s.hidden && (s.sec ? secKey(...s.sec) === nk : nk === '0,0'));
    if (!other.length) continue;
    const pairs = [];
    for (const a of sys) for (const b of other) pairs.push({ a, b, d: Math.hypot(a.x - b.x, a.y - b.y) });
    pairs.sort((p, q) => p.d - q.d || p.a.id - q.a.id || p.b.id - q.b.id);
    const used = new Set(), k = 2 + (hashString(`bridge-${seed}-${[key, nk].sort().join('|')}`) % 2);
    for (const pr of pairs) {
      if (used.size >= k * 2) break;
      if (used.has(pr.a.id) || used.has(pr.b.id)) continue;
      link(pr.a, pr.b);
      used.add(pr.a.id); used.add(pr.b.id);
    }
  }
  for (const s of sys) s.links.sort((a, b) => a - b);
  return sys;
}
// Al llegar a un sistema cerca del borde de su sector, se generan los sectores de ese lado (y la esquina).
// Devuelve las claves de los sectores nuevos, en orden (para guardarlas).
export function expandAround(gal, seed, id) {
  const s = gal[id];
  if (!s || s.hidden) return [];
  const [sx, sy] = secOf(s), lx = s.x - sx * SECTOR, ly = s.y - sy * SECTOR;
  const dxs = [0], dys = [0];
  if (lx < EDGE) dxs.push(-1); else if (lx > SECTOR - EDGE) dxs.push(1);
  if (ly < EDGE) dys.push(-1); else if (ly > SECTOR - EDGE) dys.push(1);
  const out = [];
  for (const dx of dxs) for (const dy of dys) {
    if (!dx && !dy) continue;
    if (genSector(gal, seed, sx + dx, sy + dy).length) out.push([sx + dx, sy + dy]);
  }
  return out;
}
// reconstruye una galaxia guardada: el núcleo y los sectores, en el mismo orden en que se generaron
export function rebuildGalaxy(seed, sectors = []) {
  const gal = genGalaxy(seed);
  for (const [sx, sy] of sectors) genSector(gal, seed, sx, sy);
  return gal;
}
