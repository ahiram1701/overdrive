// GALAXIA: dibujo pseudo-3D con la cámara detrás de la nave. Todo se ordena por profundidad.
import { G } from './state.js';
import { save } from './save.js';
import { fx } from './fx.js';
import { getCtx } from './render.js';
import { drawShip } from './shipdraw.js';
import { equipped, emblemOpts } from './cosmetics.js';
import { trailFx } from './cosfx.js';
import { project, projectDir, norm, sub, scale, basis, dist } from './space3d.js';
import { ORES } from './galaxyData.js';
import { shipDef } from './spaceGame.js';

// estrellas "en el infinito" (solo giran con la cámara) y polvo cercano (da sensación de velocidad)
const STARS = [];
for (let i = 0; i < 520; i++) {
  const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
  STARS.push({ d: { x: r * Math.cos(a), y: u, z: r * Math.sin(a) }, b: 0.3 + Math.random() * 0.7, s: Math.random() < 0.08 ? 2 : 1 });
}
const DUST = Array.from({ length: 90 }, () => ({ x: (Math.random() - 0.5) * 160, y: (Math.random() - 0.5) * 100, z: (Math.random() - 0.5) * 160 }));

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Malla de la estación: anillo de 12 segmentos + eje central (caras con su normal)
function stationFaces(st) {
  const faces = [];
  const N = 12, R = st.r, w = st.r * 0.22, h = st.r * 0.18;
  const rot = (p) => {
    const c = Math.cos(st.spin), s = Math.sin(st.spin);
    return { x: st.pos.x + p.x * c + p.z * s, y: st.pos.y + p.y, z: st.pos.z - p.x * s + p.z * c };
  };
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
    const P = (a, r, y) => rot({ x: Math.cos(a) * r, y, z: Math.sin(a) * r });
    // cara exterior y superior del anillo
    faces.push({ pts: [P(a0, R + w, -h), P(a1, R + w, -h), P(a1, R + w, h), P(a0, R + w, h)], col: i % 3 === 0 ? '#ffe600' : '#7d8597' });
    faces.push({ pts: [P(a0, R - w, h), P(a1, R - w, h), P(a1, R + w, h), P(a0, R + w, h)], col: '#a7b0bf' });
    // radios cada 3 segmentos
    if (i % 3 === 0) faces.push({ pts: [P(a0, 4, -2), P(a0 + 0.08, 4, 2), P(a0 + 0.04, R - w, 2), P(a0 - 0.04, R - w, -2)], col: '#59606e' });
  }
  // eje
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2, a1 = ((i + 1) / 6) * Math.PI * 2;
    const P = (a, y) => rot({ x: Math.cos(a) * 7, y, z: Math.sin(a) * 7 });
    faces.push({ pts: [P(a0, -R * 0.5), P(a1, -R * 0.5), P(a1, R * 0.5), P(a0, R * 0.5)], col: i % 2 ? '#00e5ff' : '#4b5363' });
  }
  return faces;
}

let fpsAcc = 0, fpsFrames = 0, fps = 0;
export function renderSpace(dt) {
  const ctx = getCtx();
  const s = G.space;
  if (!ctx || !s || !s.cam) return;
  const W = G.W, H = G.H, cam = s.cam;
  cam.w = W; cam.h = H;
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#04020d');
  bg.addColorStop(1, '#0b0420');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // estrellas
  for (const st of STARS) {
    const p = projectDir(cam, st.d);
    if (!p || p.x < -2 || p.x > W + 2 || p.y < -2 || p.y > H + 2) continue;
    ctx.fillStyle = `rgba(255,255,255,${st.b})`;
    ctx.fillRect(p.x, p.y, st.s, st.s);
  }

  const sh = s.ship;
  const boosting = sh.boostT > 0;
  // polvo espacial: puntos fijos en el mundo alrededor de la nave (se envuelven); con impulso, estelas
  const f = basis(sh.yaw, sh.pitch).f;
  ctx.strokeStyle = boosting ? 'rgba(125,249,255,.55)' : 'rgba(200,210,255,.35)';
  ctx.fillStyle = 'rgba(200,210,255,.45)';
  ctx.lineWidth = 1.2;
  for (const d of DUST) {
    // posición envuelta en una caja de 160 m centrada en la nave
    const wrap = (v, c, size) => c + ((((v - c) % size) + size * 1.5) % size) - size / 2;
    const wp = { x: wrap(d.x, sh.pos.x, 160), y: wrap(d.y, sh.pos.y, 100), z: wrap(d.z, sh.pos.z, 160) };
    const p = project(cam, wp);
    if (!p) continue;
    if (boosting) {
      const q = project(cam, sub(wp, scale(f, 6)));
      if (q) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
    } else ctx.fillRect(p.x, p.y, Math.min(2.5, p.s * 0.4), Math.min(2.5, p.s * 0.4));
  }

  const draws = [];
  const sun = s.sys.sun;
  const sunP = project(cam, sun.pos, 1);

  // sol: halo enorme
  if (sunP) {
    draws.push({ z: sunP.z, fn: () => {
      const R = sun.r * sunP.s;
      const g = ctx.createRadialGradient(sunP.x, sunP.y, 0, sunP.x, sunP.y, R * 3);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.18, sun.color);
      g.addColorStop(0.35, hexA(sun.color, 0.35));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sunP.x, sunP.y, R * 3, 0, Math.PI * 2);
      ctx.fill();
    } });
  }

  // planetas: iluminados desde el sol
  for (const pl of s.sys.planets) {
    const p = project(cam, pl.pos, 1);
    if (!p) continue;
    const R = pl.r * p.s;
    if (R < 0.8 || p.x < -R * 3 || p.x > W + R * 3 || p.y < -R * 3 || p.y > H + R * 3) continue;
    draws.push({ z: p.z, fn: () => {
      // dirección de la luz en pantalla
      const toSun = sunP ? norm({ x: sunP.x - p.x, y: sunP.y - p.y, z: 0 }) : { x: -0.6, y: -0.6 };
      const g = ctx.createRadialGradient(p.x + toSun.x * R * 0.45, p.y + toSun.y * R * 0.45, R * 0.1, p.x, p.y, R * 1.05);
      g.addColorStop(0, pl.c1);
      g.addColorStop(0.7, pl.c2);
      g.addColorStop(1, '#020108');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hexA(pl.c1, 0.4);
      ctx.lineWidth = Math.max(1, R * 0.03);
      ctx.stroke();
      if (pl.rings) {
        ctx.strokeStyle = hexA(pl.c1, 0.55);
        ctx.lineWidth = Math.max(1, R * 0.08);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, R * 1.9, R * 0.45, -0.25, 0, Math.PI * 2);
        ctx.stroke();
      }
    } });
  }

  // estación: malla 3D que gira
  const stP = project(cam, s.sys.station.pos, 1);
  if (stP) {
    draws.push({ z: stP.z, fn: () => {
      const faces = stationFaces(s.sys.station).map((fc) => {
        const pts = fc.pts.map((q) => project(cam, q, 0.5));
        if (pts.some((q) => !q)) return null;
        return { pts, z: pts.reduce((a, q) => a + q.z, 0) / pts.length, col: fc.col };
      }).filter(Boolean).sort((a, b) => b.z - a.z);
      for (const fc of faces) {
        ctx.fillStyle = fc.col;
        ctx.beginPath();
        fc.pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,229,255,.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // luces de atraque
      if (s.canDock && Math.floor(G.realTime * 4) % 2) {
        ctx.fillStyle = '#30d158';
        ctx.beginPath();
        ctx.arc(stP.x, stP.y, Math.max(3, s.sys.station.r * stP.s * 0.15), 0, Math.PI * 2);
        ctx.fill();
      }
    } });
  }

  // asteroides: contorno irregular que gira
  for (const a of s.sys.asteroids) {
    const p = project(cam, a.pos, 1);
    if (!p) continue;
    const R = a.r * p.s;
    if (R < 0.6 || p.x < -R * 2 || p.x > W + R * 2 || p.y < -R * 2 || p.y > H + R * 2) continue;
    draws.push({ z: p.z, fn: () => {
      ctx.beginPath();
      a.shape.forEach((k, i) => {
        const ang = a.rot + (i / a.shape.length) * Math.PI * 2;
        const x = p.x + Math.cos(ang) * R * k, y = p.y + Math.sin(ang) * R * k;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.closePath();
      const g = ctx.createRadialGradient(p.x - R * 0.3, p.y - R * 0.3, R * 0.1, p.x, p.y, R);
      g.addColorStop(0, a.flash > 0 ? '#ffffff' : '#8d8478');
      g.addColorStop(1, '#2a2520');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = hexA(ORES[a.ore].color, 0.5);
      ctx.lineWidth = Math.max(1, R * 0.06);
      ctx.stroke();
    } });
  }

  // mineral suelto
  for (const o of s.ores) {
    const p = project(cam, o.pos, 1);
    if (!p) continue;
    draws.push({ z: p.z, fn: () => {
      const r = Math.max(2.5, 1.6 * p.s);
      ctx.fillStyle = ORES[o.ore].color;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x + r * 0.7, p.y); ctx.lineTo(p.x, p.y + r); ctx.lineTo(p.x - r * 0.7, p.y);
      ctx.fill();
    } });
  }

  // tus disparos
  for (const bo of s.bolts) {
    const p = project(cam, bo.pos, 1), q = project(cam, sub(bo.pos, scale(norm(bo.vel), 14)), 1);
    if (!p || !q) continue;
    draws.push({ z: p.z, fn: () => {
      ctx.strokeStyle = '#7df9ff';
      ctx.lineWidth = Math.max(1.5, p.s * 0.8);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    } });
  }

  // tu nave: vista desde detrás, alabeando al virar
  const shp = project(cam, sh.pos, 0.5);
  if (shp) {
    draws.push({ z: shp.z, fn: () => {
      const eq = equipped(save, save.ship);
      const pal = eq.palette, def = shipDef();
      const size = Math.max(18, shp.s * 4.2);
      trailFx(fx, ctx, eq.trail.id, shp.x, shp.y + size * 0.15, size * 1.2, boosting ? '#7df9ff' : pal.glow, boosting ? 120 : 40, G.realTime);
      drawShip(ctx, def.id, { ...pal, edge: pal.edge || def.color }, shp.x, shp.y, size,
        { pitch: -0.32, roll: sh.roll, yaw: 0 }, { line: 1.6, ...emblemOpts(eq) });
    } });
  }

  draws.sort((a, b) => b.z - a.z);
  for (const d of draws) d.fn();

  // brújula: flecha hacia el objetivo actual
  if (s.target) {
    const tp = project(cam, s.target, 1);
    const onScreen = tp && tp.x > 30 && tp.x < W - 30 && tp.y > 90 && tp.y < H - 120;
    const dd = Math.round(dist(s.target, sh.pos));
    ctx.fillStyle = '#ffe600';
    ctx.strokeStyle = '#ffe600';
    ctx.font = 'italic 900 12px system-ui';
    ctx.textAlign = 'center';
    if (onScreen) {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillText(`${dd} m`, tp.x, tp.y - 22);
    } else {
      // dirección del objetivo respecto a la cámara (aunque esté detrás)
      const rel = sub(s.target, cam.pos);
      const x = rel.x * cam.r.x + rel.y * cam.r.y + rel.z * cam.r.z;
      const y = rel.x * cam.u.x + rel.y * cam.u.y + rel.z * cam.u.z;
      const ang = Math.atan2(-y, x);
      const R = Math.min(W, H) * 0.36;
      const ax = W / 2 + Math.cos(ang) * R, ay = H * 0.52 + Math.sin(ang) * R;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(-8, 10); ctx.lineTo(-3, 0); ctx.lineTo(-8, -10);
      ctx.fill();
      ctx.restore();
      ctx.fillText(`${dd} m`, ax, ay - 16);
    }
  }

  fx.draw(ctx);
  fx.drawTexts(ctx, 0);
  fx.drawBanners(ctx, W, H);

  if (G.debug) {
    fpsAcc += dt; fpsFrames++;
    if (fpsAcc > 0.5) { fps = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; }
    ctx.fillStyle = '#0f0';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${fps} fps · asteroides ${s.sys.asteroids.length}`, 8, H - 8);
  }
}
