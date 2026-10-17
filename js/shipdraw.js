// Dibuja una nave 3D (malla + pintura + emblema) en un canvas 2D. Lo usan la partida y el hangar.
import { MESHES, projectMesh, rotate } from './mesh3d.js';

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---------- Emblemas ----------
// Trazos en [-1, 1] (y hacia abajo = hacia la cola). Son texto SVG: el hangar los usa igual en
// sus botones (<svg><path d>) y la nave en el canvas (Path2D), así que se ven idénticos.
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
  crown: 'M-0.9 0.6L-0.9-0.5L-0.45 0L0-0.85L0.45 0L0.9-0.5L0.9 0.6Z',
  tribal: 'M-1 0.3Q-0.5-0.9 0-0.2Q0.5-0.9 1 0.3Q0.5-0.3 0 0.55Q-0.5-0.3-1 0.3Z',
};

// Silueta de la nave vista desde arriba (envolvente convexa de x/z), con el morro hacia arriba
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
  const k = 1.9 / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
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
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const crossV = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Emblema sobre un ala (triángulo punta / ala / lomo): un marco local en 3D (centro, eje a lo ancho
// y eje hacia el morro) que se proyecta y se usa como transformación afín del trazo.
function drawDecal(ctx, mesh, tri, rot, x, y, size, focal, squash, color, alpha, id) {
  const p = path2d(id);
  if (!p) return;
  const [A, B, C] = tri.map((i) => mesh.v[i]);
  const c = [0, 1, 2].map((k) => A[k] * 0.25 + B[k] * 0.42 + C[k] * 0.33);
  let n = norm(crossV(sub(B, A), sub(C, A)));
  if (n[1] < 0) n = n.map((k) => -k); // la cara de ARRIBA del ala
  let u = norm(sub(B, C));
  if (u[0] < 0) u = u.map((k) => -k); // siempre hacia la derecha: el emblema no sale en espejo
  const v = norm(crossV(n, u)); // en el plano del ala, hacia el morro
  const s = Math.min(Math.hypot(...sub(B, C)), Math.hypot(...sub(A, C))) * 0.36;
  // de cara a la cámara (que está en z = -focal)?
  const cr = rotate(c, rot), nr = rotate(n, rot);
  if (nr[0] * -cr[0] + nr[1] * -cr[1] + nr[2] * (-focal - cr[2]) <= 0) return;
  const proj = (q) => {
    const r = rotate(q, rot);
    const k = focal / (focal + r[2]);
    return [x + r[0] * size * k, y + (-r[1] * size * k) * squash];
  };
  const P0 = proj(c);
  const PU = proj(c.map((k, i) => k + u[i] * s));
  const PV = proj(c.map((k, i) => k + v[i] * s));
  ctx.save();
  ctx.globalAlpha = alpha * 0.92;
  // (x, y) del trazo -> P0 + x·(PU-P0) - y·(PV-P0): la y del SVG va hacia la cola
  ctx.transform(PU[0] - P0[0], PU[1] - P0[1], -(PV[0] - P0[0]), -(PV[1] - P0[1]), P0[0], P0[1]);
  ctx.fillStyle = color;
  ctx.fill(p, 'evenodd');
  ctx.restore();
}

// pal = { hull, edge, glow } (colores hex). opts: alpha, line (grosor), squash (aplastar en
// vertical), emblem (id), emblemColor
export function drawShip(ctx, meshId, pal, x, y, size, rot, opts = {}) {
  const mesh = MESHES[meshId] || MESHES.viper;
  const faces = projectMesh(mesh, rot, x, y, size);
  const [hr, hg, hb] = rgb(pal.hull);
  const [er, eg, eb] = rgb(pal.edge);
  const squash = opts.squash ?? 1;
  const decal = (vi) => opts.emblem && mesh.decals.find((d) => d[0] === vi[0] && d[1] === vi[1] && d[2] === vi[2]);
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.lineJoin = 'round';
  ctx.lineWidth = opts.line ?? Math.max(1.2, size * 0.025);
  for (const f of faces) {
    ctx.beginPath();
    f.pts.forEach(([px, py], i) => {
      const yy = y + (py - y) * squash;
      if (i) ctx.lineTo(px, yy); else ctx.moveTo(px, yy);
    });
    ctx.closePath();
    const k = f.shade;
    if (f.role === 'glow') ctx.fillStyle = pal.glow;
    else if (f.role === 'edge') ctx.fillStyle = `rgb(${er * k * 0.8 | 0},${eg * k * 0.8 | 0},${eb * k * 0.8 | 0})`;
    else {
      // casco: el color base más un toque del borde según la luz
      const m = 0.25 * k;
      ctx.fillStyle = `rgb(${hr + (er - hr) * m * k | 0},${hg + (eg - hg) * m * k | 0},${hb + (eb - hb) * m * k | 0})`;
    }
    ctx.fill();
    ctx.strokeStyle = `rgba(${er},${eg},${eb},${0.55 + 0.45 * k})`;
    ctx.stroke();
    // el emblema justo después de su cara: así lo que esté delante lo tapa (orden del pintor)
    const d = decal(f.vi);
    if (d) drawDecal(ctx, mesh, d, rot, x, y, size, 4, squash, opts.emblemColor || pal.glow, ctx.globalAlpha, opts.emblem);
  }
  ctx.restore();
}
