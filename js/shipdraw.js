// Dibuja una nave 3D (malla + pintura + emblema) en un canvas 2D. Lo usan la partida y el hangar.
import { MESHES, projectMesh, rotate } from './mesh3d.js';

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---------- Emblemas ----------
// Trazos dentro de un círculo de radio GLYPH_R (y hacia abajo = hacia la cola). Son texto SVG: el
// hangar los usa igual en sus botones (<svg><path d>) y la nave en el canvas (Path2D).
export const GLYPH_R = 1.1;
const GLYPHS = {
  bolt: 'M0.25-1L-0.6 0.15H-0.05L-0.3 1L0.6-0.2H0.05Z',
  star: (() => {
    const p = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.42 : 1;
      p.push(`${(Math.cos(a) * r).toFixed(3)} ${(Math.sin(a) * r).toFixed(3)}`);
    }
    return `M${p.join('L')}Z`;
  })(),
  flame: 'M0-1C0.5-0.4 0.85 0 0.65 0.5C0.5 0.85 0.25 1 0 1C-0.25 1-0.55 0.85-0.65 0.5C-0.85 0-0.35-0.2-0.2-0.6C0-0.3 0.12-0.45 0-1Z',
  skull: 'M0-0.9C0.55-0.9 0.8-0.5 0.8-0.1C0.8 0.25 0.6 0.4 0.45 0.45V0.85H-0.45V0.45C-0.6 0.4-0.8 0.25-0.8-0.1C-0.8-0.5-0.55-0.9 0-0.9Z'
    + 'M-0.45-0.12A0.2 0.2 0 1 0-0.05-0.12A0.2 0.2 0 1 0-0.45-0.12Z M0.05-0.12A0.2 0.2 0 1 0 0.45-0.12A0.2 0.2 0 1 0 0.05-0.12Z',
  eye: 'M-1 0Q0-0.85 1 0Q0 0.85-1 0Z M-0.32 0A0.32 0.32 0 1 0 0.32 0A0.32 0.32 0 1 0-0.32 0Z',
  crown: 'M-0.85 0.55L-0.85-0.45L-0.42 0L0-0.85L0.42 0L0.85-0.45L0.85 0.55Z',
  tribal: 'M-1 0.3Q-0.5-0.9 0-0.2Q0.5-0.9 1 0.3Q0.5-0.3 0 0.55Q-0.5-0.3-1 0.3Z',
  // corona de laurel: dos ramas en arco y una estrella en el centro
  laurel: 'M-0.15 0.9Q-0.95 0.55-0.85-0.35Q-0.62 0.45-0.05 0.72Z M0.15 0.9Q0.95 0.55 0.85-0.35Q0.62 0.45 0.05 0.72Z'
    + 'M0-0.55L0.14-0.2L0.5-0.2L0.21 0.02L0.32 0.38L0-0.16L-0.32 0.38L-0.21 0.02L-0.5-0.2L-0.14-0.2Z',
};

// Silueta de la nave vista desde arriba (envolvente convexa de x/z), con el morro hacia arriba y
// escalada por su punto más lejano: así cabe en el mismo círculo que los demás emblemas
function silhouette(meshId) {
  const pts = MESHES[meshId].v.map(([x, , z]) => [x, -z]);
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => {
    const h = [];
    for (const p of list) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  const hull = [...half(pts), ...half([...pts].reverse())];
  const xs = hull.map((p) => p[0]), ys = hull.map((p) => p[1]);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const k = 1 / Math.max(...hull.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  return `M${hull.map(([x, y]) => `${((x - cx) * k).toFixed(3)} ${((y - cy) * k).toFixed(3)}`).join('L')}Z`;
}

// Texto SVG del emblema (null = sin emblema)
export function emblemPath(id) {
  if (!id || id === 'none') return null;
  if (id.startsWith('sil-')) return MESHES[id.slice(4)] ? silhouette(id.slice(4)) : null;
  return GLYPHS[id] || null;
}

const pathCache = new Map();
function path2d(id) {
  if (!pathCache.has(id)) {
    const d = emblemPath(id);
    pathCache.set(id, d && typeof Path2D !== 'undefined' ? new Path2D(d) : null);
  }
  return pathCache.get(id);
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const crossV = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Marco del emblema sobre un triángulo de la malla. Pura (se testea en Node).
// c = INCENTRO (el punto más alejado de los tres lados) y s tal que el círculo del emblema
// (radio s·GLYPH_R) quepa dentro del círculo inscrito con margen: nunca se sale de la cara.
// v = "arriba" del emblema (hacia el morro; en caras verticales, hacia arriba); u = su derecha.
// flip: la otra cara del triángulo (para la aleta, que se ve por los dos lados).
export function decalFrame(mesh, tri, flip = false) {
  const [A, B, C] = tri.map((i) => mesh.v[i]);
  const a = Math.hypot(...sub(B, C)), b = Math.hypot(...sub(C, A)), cc = Math.hypot(...sub(A, B));
  const per = a + b + cc;
  const c = [0, 1, 2].map((k) => (a * A[k] + b * B[k] + cc * C[k]) / per);
  const area2 = Math.hypot(...crossV(sub(B, A), sub(C, A)));
  const inr = area2 / per; // radio inscrito = área / semiperímetro
  let n = norm(crossV(sub(B, A), sub(C, A)));
  // cara de ARRIBA (o, en la aleta vertical, hacia la derecha)
  if (Math.abs(n[1]) >= 0.5 ? n[1] < 0 : n[0] < 0) n = n.map((k) => -k);
  if (flip) n = n.map((k) => -k);
  const pref = Math.abs(n[1]) < 0.5 ? [0, 1, 0] : [0, 0, 1];
  const v = norm(sub(pref, n.map((k) => k * dot(pref, n))));
  // coordenadas a izquierdas (x derecha, y arriba, z hacia el fondo): derecha = n × v
  const u = norm(crossV(n, v));
  return { c, n, u, v, s: (inr * 0.8) / GLYPH_R, inr };
}

// Emblema sobre una cara: marco local proyectado como transformación afín del trazo, recortado
// al triángulo proyectado (con perspectiva, ni un píxel fuera de la cara)
function drawDecal(ctx, mesh, tri, clipPts, rot, x, y, size, focal, squash, color, alpha, id, twoSided) {
  const p = path2d(id);
  if (!p) return;
  let fr = decalFrame(mesh, tri);
  // de cara a la cámara (que está en z = -focal)?
  const facing = (f) => {
    const cr = rotate(f.c, rot), nr = rotate(f.n, rot);
    return nr[0] * -cr[0] + nr[1] * -cr[1] + nr[2] * (-focal - cr[2]) > 0;
  };
  if (!facing(fr)) {
    if (!twoSided) return;
    fr = decalFrame(mesh, tri, true);
  }
  const { c, u, v, s } = fr;
  const proj = (q) => {
    const r = rotate(q, rot);
    const k = focal / (focal + r[2]);
    return [x + r[0] * size * k, y + (-r[1] * size * k) * squash];
  };
  const P0 = proj(c);
  const PU = proj(c.map((k, i) => k + u[i] * s));
  const PV = proj(c.map((k, i) => k + v[i] * s));
  ctx.save();
  ctx.beginPath();
  clipPts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.clip();
  ctx.globalAlpha = alpha * 0.92;
  // (x, y) del trazo -> P0 + x·(PU-P0) - y·(PV-P0): la y del SVG va hacia la cola
  ctx.transform(PU[0] - P0[0], PU[1] - P0[1], -(PV[0] - P0[0]), -(PV[1] - P0[1]), P0[0], P0[1]);
  ctx.fillStyle = color;
  ctx.fill(p, 'evenodd');
  ctx.restore();
}

// Color del casco de una cara según el patrón de la pintura (pura). fi = índice de la cara,
// cen = su centro en la malla, zr = [zmin, zmax] de la malla.
export function hullColor(pal, fi, cen, zr) {
  if (!pal.pattern || !pal.alt) return pal.hull;
  if (pal.pattern === 'stripes') return fi % 2 ? pal.alt : pal.hull;
  if (pal.pattern === 'split') return cen[0] < -0.01 ? pal.alt : pal.hull;
  if (pal.pattern === 'fade') {
    const k = Math.max(0, Math.min(1, (cen[2] - zr[0]) / (zr[1] - zr[0] || 1)));
    const [ar, ag, ab] = rgb(pal.hull), [br, bg, bb] = rgb(pal.alt);
    const h = (q) => Math.round(q).toString(16).padStart(2, '0');
    return `#${h(ar + (br - ar) * k)}${h(ag + (bg - ag) * k)}${h(ab + (bb - ab) * k)}`;
  }
  return pal.hull;
}

const zRange = new Map();
function zrOf(mesh) {
  if (!zRange.has(mesh)) zRange.set(mesh, [Math.min(...mesh.v.map((p) => p[2])), Math.max(...mesh.v.map((p) => p[2]))]);
  return zRange.get(mesh);
}

// pal = { hull, edge, glow, pattern?, alt? } (colores hex). opts: alpha, line (grosor), squash
// (aplastar en vertical), emblem (id), emblemAt ('alas' | 'ala' | 'cola'), emblemColor
export function drawShip(ctx, meshId, pal, x, y, size, rot, opts = {}) {
  const mesh = MESHES[meshId] || MESHES.viper;
  const faces = projectMesh(mesh, rot, x, y, size);
  const [er, eg, eb] = rgb(pal.edge);
  const squash = opts.squash ?? 1;
  const decals = opts.emblem && opts.emblem !== 'none' ? mesh.decalSets[opts.emblemAt] || mesh.decalSets.alas : [];
  const same = (d, vi) => d[0] === vi[0] && d[1] === vi[1] && d[2] === vi[2];
  const zr = zrOf(mesh);
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.lineJoin = 'round';
  ctx.lineWidth = opts.line ?? Math.max(1.2, size * 0.025);
  for (const f of faces) {
    const pts = f.pts.map(([px, py]) => [px, y + (py - y) * squash]);
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    const k = f.shade;
    if (f.role === 'glow') ctx.fillStyle = pal.glow;
    else if (f.role === 'edge') ctx.fillStyle = `rgb(${er * k * 0.8 | 0},${eg * k * 0.8 | 0},${eb * k * 0.8 | 0})`;
    else {
      // casco: su color (según el patrón) más un toque del borde según la luz
      const cen = [0, 1, 2].map((q) => (mesh.v[f.vi[0]][q] + mesh.v[f.vi[1]][q] + mesh.v[f.vi[2]][q]) / 3);
      const [hr, hg, hb] = rgb(hullColor(pal, f.fi, cen, zr));
      const m = 0.25 * k;
      ctx.fillStyle = `rgb(${hr + (er - hr) * m * k | 0},${hg + (eg - hg) * m * k | 0},${hb + (eb - hb) * m * k | 0})`;
    }
    ctx.fill();
    ctx.strokeStyle = `rgba(${er},${eg},${eb},${0.55 + 0.45 * k})`;
    ctx.stroke();
    // el emblema justo después de su cara: así lo que esté delante lo tapa (orden del pintor)
    const d = decals.find((dd) => same(dd, f.vi));
    if (d) {
      const two = mesh.twoSided.some((t) => same(t, d));
      drawDecal(ctx, mesh, d, pts, rot, x, y, size, 4, squash, opts.emblemColor || pal.glow, ctx.globalAlpha, opts.emblem, two);
    }
  }
  ctx.restore();
}
