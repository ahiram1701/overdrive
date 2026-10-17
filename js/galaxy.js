// GALAXIA: la galaxia procedural (pura, determinista). ~30 sistemas unidos por puertas de salto.
// El peligro es la distancia en saltos a ORIGEN; lejos hay mejor mineral... y más piratas.
import { makeRng, hashString } from './rng.js';
import { ORES } from './galaxyData.js';

export const GALAXY_SEED = 7;
export const N_SYSTEMS = 30;

const SYL = ['ka', 'ri', 'on', 'ze', 'tal', 'mor', 'vex', 'lu', 'dra', 'sen', 'qua', 'nim', 'or', 'phe', 'zan', 'tu', 'ix', 'bel', 'cor', 'ya'];
const STARS = [
  { kind: 'amarilla', color: '#ffcc66' }, { kind: 'roja', color: '#ff6b4a' }, { kind: 'azul', color: '#8ec5ff' },
  { kind: 'blanca', color: '#f2f2ff' }, { kind: 'violeta', color: '#c58cff' },
];
// mineral principal según el peligro: más lejos, más valioso
export const oreForDanger = (d) => (d <= 1 ? 'iron' : d <= 3 ? 'crystal' : d <= 5 ? 'plasma' : 'dark');

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
    for (const k of Object.keys(ORES)) {
      const local = k === s.ore ? 0.75 : 1;
      s.prices[k] = Math.round(ORES[k].price * local * r.range(0.85, 1.35));
    }
    s.pirates = s.id === 0 ? 0 : Math.min(6, s.danger);
    s.boss = s.danger >= 4 && r.next() < 0.5;
  }
  return sys;
}

// salto necesario para entrar en un sistema (los dos primeros anillos, libres)
export const jumpNeeded = (sys) => Math.max(0, sys.danger - 1);
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
