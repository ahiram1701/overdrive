// Dibuja una nave 3D (malla + pintura) en un canvas 2D. Lo usan la partida y el hangar.
import { MESHES, projectMesh } from './mesh3d.js';

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// pal = { hull, edge, glow } (colores hex). opts: alpha, line (grosor), squash (aplastar en vertical)
export function drawShip(ctx, meshId, pal, x, y, size, rot, opts = {}) {
  const mesh = MESHES[meshId] || MESHES.viper;
  const faces = projectMesh(mesh, rot, x, y, size);
  const [hr, hg, hb] = rgb(pal.hull);
  const [er, eg, eb] = rgb(pal.edge);
  const squash = opts.squash ?? 1;
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
  }
  ctx.restore();
}
