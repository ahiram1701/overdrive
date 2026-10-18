// GALAXIA: dibujo pseudo-3D con la cámara detrás de la nave. Todo se ordena por profundidad.
import { G } from './state.js';
import { save } from './save.js';
import { fx } from './fx.js';
import { getCtx } from './render.js';
import { drawShip } from './shipdraw.js';
import { equipped, emblemOpts, DEFAULT_SHOT } from './cosmetics.js';
import { trailFx, auraFx } from './cosfx.js';
import { project, projectDir, norm, sub, scale, basis, dist } from './space3d.js';
import { ORES } from './galaxyData.js';
import { shipDef, GAL, turretPos, CHASSIS } from './spaceGame.js';
import { MESHES } from './mesh3d.js';
import { canJump, jumpNeeded } from './galaxy.js';
import { POI_KINDS, SCAN_TIME } from './galaxyMissions.js';

// estrellas "en el infinito" (solo giran con la cámara) y polvo cercano (da sensación de velocidad)
import { makeRng, hashString } from './rng.js';
import { EVENTS } from './galaxyEvents.js';

// NEBULOSAS: nubes de fondo por sistema, con el color de su estrella. Se pintan una vez en canvas
// pequeños y luego solo se estiran (barato en el móvil).
let neb = null;
function nebulaFor(sysId, starColor) {
  if (neb && neb.sys === sysId) return neb.blobs;
  const rng = makeRng(hashString(`neb-${sysId}`));
  const cols = [starColor, '#bf5af2', '#00e5ff', '#ff2bd6', '#30d158'];
  const blobs = [];
  for (let i = 0; i < 6; i++) {
    const th = rng.range(0, Math.PI * 2), ph = rng.range(-0.6, 0.6);
    const dir = { x: Math.cos(ph) * Math.sin(th), y: Math.sin(ph), z: Math.cos(ph) * Math.cos(th) };
    const col = i < 3 ? starColor : rng.pick(cols);
    let img = null;
    if (typeof document !== 'undefined') {
      img = document.createElement('canvas');
      img.width = img.height = 128;
      const c = img.getContext('2d');
      for (let k = 0; k < 7; k++) {
        const x = 64 + rng.range(-28, 28), y = 64 + rng.range(-28, 28), r = rng.range(24, 60);
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, hexA(col, 0.32));
        g.addColorStop(1, hexA(col, 0));
        c.fillStyle = g;
        c.fillRect(0, 0, 128, 128);
      }
    }
    blobs.push({ dir, ang: rng.range(0.35, 0.75), img, rot: rng.range(0, Math.PI) });
  }
  neb = { sys: sysId, blobs };
  return blobs;
}

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
    faces.push({ pts: [P(a0, R + w, -h), P(a1, R + w, -h), P(a1, R + w, h), P(a0, R + w, h)], col: i % 3 === 0 ? st.accent || '#ffe600' : '#7d8597' });
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

// Malla en el mundo: orientación yaw/pitch, sombreado plano con la luz del sol
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function drawMesh3D(ctx, cam, meshId, pos, yaw, pitch, size, pal, flash) {
  const mesh = MESHES[meshId] || MESHES.viper;
  const b = basis(yaw, pitch);
  const world = mesh.v.map(([x, y, z]) => ({
    x: pos.x + (b.r.x * x + b.u.x * y + b.f.x * z) * size,
    y: pos.y + (b.r.y * x + b.u.y * y + b.f.y * z) * size,
    z: pos.z + (b.r.z * x + b.u.z * y + b.f.z * z) * size,
  }));
  const scr = world.map((w) => project(cam, w, 0.5));
  if (scr.some((q) => !q)) return;
  const light = norm({ x: -pos.x, y: 300 - pos.y, z: -pos.z }); // hacia el sol (en el origen) y algo de arriba
  const [er, eg, eb] = rgb(pal.edge), [hr, hg, hb] = rgb(pal.hull);
  const faces = mesh.f.map(([i, j, k, role]) => {
    const A = world[i], B = world[j], C = world[k];
    const u = sub(B, A), v = sub(C, A);
    const n = norm({ x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x });
    const sh = 0.35 + 0.65 * Math.abs(n.x * light.x + n.y * light.y + n.z * light.z);
    return { pts: [scr[i], scr[j], scr[k]], z: (scr[i].z + scr[j].z + scr[k].z) / 3, sh, role };
  }).sort((p, q) => q.z - p.z);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1;
  for (const f of faces) {
    ctx.beginPath();
    f.pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    if (flash) ctx.fillStyle = '#ffffff';
    else if (f.role === 'glow') ctx.fillStyle = pal.glow;
    else if (f.role === 'edge') ctx.fillStyle = `rgb(${er * f.sh | 0},${eg * f.sh | 0},${eb * f.sh | 0})`;
    else ctx.fillStyle = `rgb(${hr + (er - hr) * 0.2 * f.sh | 0},${hg + (eg - hg) * 0.2 * f.sh | 0},${hb + (eb - hb) * 0.2 * f.sh | 0})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${er},${eg},${eb},.8)`;
    ctx.stroke();
  }
}

let fpsAcc = 0, fpsFrames = 0, fps = 0;
const KIND_PAL = {
  fighter: { hull: '#1a0505', edge: '#ff375f', glow: '#ff9f0a' },
  interceptor: { hull: '#1a0a00', edge: '#ffb340', glow: '#ffe600' },
  bomber: { hull: '#14000c', edge: '#ff2bd6', glow: '#ff375f' },
  drone: { hull: '#100010', edge: '#ff6bd5', glow: '#ff2d55' },
};

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

  // nebulosas
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const b of nebulaFor(s.sysId, s.sys.sun.color)) {
    if (!b.img) continue;
    const p = projectDir(cam, b.dir);
    if (!p) continue;
    const R = Math.tan(b.ang) * cam.focal;
    if (p.x < -R || p.x > W + R || p.y < -R || p.y > H + R) continue;
    ctx.drawImage(b.img, p.x - R, p.y - R, R * 2, R * 2);
  }
  ctx.restore();

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
      // atmósfera brillante
      const at = ctx.createRadialGradient(p.x, p.y, R * 0.95, p.x, p.y, R * 1.28);
      at.addColorStop(0, hexA(pl.c1, 0.45));
      at.addColorStop(1, hexA(pl.c1, 0));
      ctx.fillStyle = at;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R * 1.28, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createRadialGradient(p.x + toSun.x * R * 0.45, p.y + toSun.y * R * 0.45, R * 0.1, p.x, p.y, R * 1.05);
      g.addColorStop(0, pl.c1);
      g.addColorStop(0.7, pl.c2);
      g.addColorStop(1, '#020108');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
      ctx.fill();
      if (R > 6) {
        ctx.save();
        ctx.clip();
        // bandas de nubes
        ctx.globalAlpha = 0.22;
        for (let i = -3; i <= 3; i++) {
          ctx.fillStyle = i % 2 ? pl.c1 : pl.c2;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y + i * R * 0.27 + Math.sin(G.realTime * 0.2 + i) * R * 0.03, R * 1.1, R * 0.07, -0.18, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        // lado nocturno
        const lg = ctx.createLinearGradient(p.x + toSun.x * R, p.y + toSun.y * R, p.x - toSun.x * R, p.y - toSun.y * R);
        lg.addColorStop(0, 'rgba(0,0,0,0)');
        lg.addColorStop(0.5, 'rgba(0,0,0,0.1)');
        lg.addColorStop(1, 'rgba(0,0,8,0.8)');
        ctx.fillStyle = lg;
        ctx.fillRect(p.x - R, p.y - R, R * 2, R * 2);
        ctx.restore();
      }
      ctx.strokeStyle = hexA(pl.c1, 0.4);
      ctx.lineWidth = Math.max(1, R * 0.03);
      ctx.beginPath();
      ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
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

  // TU PUESTO AVANZADO: la misma estructura, en verde, con su nombre
  if (s.outpost) {
    const op = { ...s.outpost, accent: '#30d158' };
    const c = project(cam, op.pos, 1);
    if (c) draws.push({ z: c.z, fn: () => {
      const faces = stationFaces(op).map((fc) => {
        const pts = fc.pts.map((q) => project(cam, q, 0.5));
        return pts.some((q) => !q) ? null : { pts, z: pts.reduce((a, q) => a + q.z, 0) / pts.length, col: fc.col };
      }).filter(Boolean).sort((a, b) => b.z - a.z);
      for (const fc of faces) {
        ctx.fillStyle = fc.col;
        ctx.beginPath();
        fc.pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(48,209,88,.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.fillStyle = '#30d158';
      ctx.font = 'italic 900 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`🏗️ ${op.name}`, c.x, c.y - op.r * c.s * 1.6 - 8);
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

  // PIRATAS: mallas 3D de verdad, con su barra de vida
  for (const pr of s.pirates) {
    const p = project(cam, pr.pos, 1);
    if (!p || p.x < -80 || p.x > W + 80 || p.y < -80 || p.y > H + 80) continue;
    draws.push({ z: p.z, fn: () => {
      const size = pr.size || (pr.boss ? 13 : 6);
      const pal = pr.pal || (pr.boss ? { hull: '#2a0008', edge: '#ff2d55', glow: '#ffe600' } : KIND_PAL[pr.kind] || KIND_PAL.fighter);
      drawMesh3D(ctx, cam, pr.mesh, pr.pos, pr.yaw, pr.pitch, size, pal, pr.flash > 0);
      // escudo de la Reina (mientras la protegen sus drones)
      if (pr.shield) {
        ctx.strokeStyle = 'rgba(255,214,10,.75)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(18, p.s * size * 1.9), 0, Math.PI * 2);
        ctx.stroke();
      }
      // corchetes rojos de objetivo: siempre se ve dónde está cada pirata, aunque esté lejos
      const R = Math.max(14, p.s * size * 1.3), c = R * 0.45;
      ctx.strokeStyle = pr.boss ? '#ffe600' : '#ff2d55';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.moveTo(p.x + sx * R, p.y + sy * (R - c));
        ctx.lineTo(p.x + sx * R, p.y + sy * R);
        ctx.lineTo(p.x + sx * (R - c), p.y + sy * R);
      }
      ctx.stroke();
      if (p.z < 900) {
        const bw = Math.max(18, Math.min(60, p.s * size * 3));
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.fillRect(p.x - bw / 2, p.y - p.s * size * 1.4 - 8, bw, 4);
        ctx.fillStyle = '#ff2d55';
        ctx.fillRect(p.x - bw / 2, p.y - p.s * size * 1.4 - 8, bw * Math.max(0, pr.hp / pr.max), 4);
        if (pr.boss || pr.name) {
          ctx.fillStyle = pr.name ? '#ff9f0a' : '#ffe600';
          ctx.font = 'italic 900 11px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(pr.name ? (pr.story ? pr.name : `🎯 ${pr.name}`) : '☠ JEFE PIRATA', p.x, p.y - p.s * size * 1.4 - 14);
        }
      }
    } });
  }
  // balas enemigas: rojas, siempre distintas de las tuyas
  for (const bo of s.ebolts) {
    const p = project(cam, bo.pos, 1), q = project(cam, sub(bo.pos, scale(norm(bo.vel), 12)), 1);
    if (!p || !q) continue;
    draws.push({ z: p.z, fn: () => {
      ctx.strokeStyle = '#ff2d55';
      ctx.lineWidth = Math.max(2, p.s * 1.2);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    } });
  }
  // botín (créditos)
  for (const l of s.loot) {
    const p = project(cam, l.pos, 1);
    if (!p) continue;
    draws.push({ z: p.z, fn: () => {
      ctx.font = `${Math.max(14, Math.min(40, p.s * 9))}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💰', p.x, p.y);
    } });
  }
  // PUERTAS DE SALTO: anillos con el nombre del destino (y un candado si tu Salto no da)
  for (const gt of s.sys.gates) {
    const c = project(cam, gt.pos, 1);
    if (!c) continue;
    const open = canJump(GAL[gt.to], save.galaxy.up.jump || 0);
    const col = open ? '#7df9ff' : '#ff9f0a';
    // el anillo mira hacia el centro del sistema
    const n = norm(gt.pos), side = norm({ x: -n.z, y: 0, z: n.x });
    draws.push({ z: c.z, fn: () => {
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(2, c.s * 4);
      ctx.shadowColor = col;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const q = project(cam, { x: gt.pos.x + side.x * Math.cos(a) * gt.r, y: gt.pos.y + Math.sin(a) * gt.r, z: gt.pos.z + side.z * Math.cos(a) * gt.r }, 1);
        if (!q) continue;
        if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = col;
      ctx.font = 'italic 900 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`🌀 ${gt.name}${open ? '' : ` · 🔒 Salto ${jumpNeeded(GAL[gt.to])}`}`, c.x, c.y - gt.r * c.s - 10);
    } });
  }

  // PUNTOS DE INTERÉS: se ven de lejos (marcador) y se escanean volando cerca
  for (const poi of s.pois || []) {
    const p = project(cam, poi.pos, 1);
    if (!p) continue;
    const found = !!save.galaxyAtlas[poi.id];
    const K = POI_KINDS[poi.kind];
    draws.push({ z: p.z, fn: () => {
      // con tope: de cerca no debe tapar la pantalla
      const R = Math.min(70, Math.max(10, 26 * p.s));
      const t = G.realTime;
      ctx.save();
      if (poi.kind === 'anomaly') {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
          ctx.strokeStyle = `rgba(191,90,242,${0.5 - i * 0.1})`;
          ctx.lineWidth = Math.max(1.5, R * 0.12);
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, R * (1 - i * 0.2), R * (0.5 - i * 0.08), t * (0.8 + i * 0.4), 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (poi.kind === 'wreck') {
        drawMesh3D(ctx, cam, 'brick', poi.pos, t * 0.2, 0.6, 9, { hull: '#2a2a2e', edge: '#8e8e93', glow: '#3a3a3a' }, false);
      } else if (poi.kind === 'signal') {
        ctx.fillStyle = Math.floor(t * 3) % 2 ? '#30d158' : '#0b3d1a';
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(4, R * 0.25), 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 3; i++) {
          const k = ((t * 0.8 + i / 3) % 1);
          ctx.strokeStyle = `rgba(48,209,88,${1 - k})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, R * (0.4 + k * 1.4), 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {
        const g = ctx.createRadialGradient(p.x - R * 0.3, p.y - R * 0.3, R * 0.1, p.x, p.y, R);
        g.addColorStop(0, '#fff6c0');
        g.addColorStop(0.6, '#ffcc00');
        g.addColorStop(1, '#3a2a00');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // marcador: icono y distancia (si aún no está en el ATLAS)
      if (!found) {
        ctx.fillStyle = K.color;
        ctx.font = 'italic 900 12px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`${K.icon} ${K.name} · ${Math.round(dist(poi.pos, sh.pos))} m`, p.x, p.y - R - 10);
        if (s.scanning === poi) {
          ctx.strokeStyle = '#ffe600';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, R + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, s.scanT / SCAN_TIME));
          ctx.stroke();
          ctx.fillStyle = '#ffe600';
          ctx.fillText('ESCANEANDO…', p.x, p.y + R + 22);
        }
      }
    } });
  }
  // CARGUERO de la escolta
  if (s.freighter) {
    const fr = s.freighter;
    const p = project(cam, fr.pos, 1);
    if (p) {
      draws.push({ z: p.z, fn: () => {
        drawMesh3D(ctx, cam, 'brick', fr.pos, fr.yaw || 0, 0, 12, { hull: '#0b2a14', edge: '#30d158', glow: '#ffe600' }, fr.flash > 0);
        const bw = Math.max(30, Math.min(80, p.s * 40));
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.fillRect(p.x - bw / 2, p.y - p.s * 18 - 10, bw, 5);
        ctx.fillStyle = '#30d158';
        ctx.fillRect(p.x - bw / 2, p.y - p.s * 18 - 10, bw * Math.max(0, fr.hp / fr.max), 5);
        ctx.fillStyle = '#30d158';
        ctx.font = 'italic 900 11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('🛡️ CARGUERO', p.x, p.y - p.s * 18 - 16);
      } });
    }
  }

  // MINAS y SEÑUELO (consumibles)
  for (const m of s.mines || []) {
    const p = project(cam, m.pos, 1);
    if (p) draws.push({ z: p.z, fn: () => {
      const r = Math.max(3, p.s * 4);
      ctx.fillStyle = m.arm > 0 || Math.floor(G.realTime * 4) % 2 ? '#ff9f0a' : '#ff2d55';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    } });
  }
  if (s.decoy) {
    const p = project(cam, s.decoy.pos, 1);
    if (p) draws.push({ z: p.z, fn: () => {
      const def = shipDef(), size = Math.max(14, p.s * 4.2);
      ctx.globalAlpha = 0.45 + 0.25 * Math.sin(G.realTime * 10);
      drawShip(ctx, def.id, { hull: '#000', edge: '#ffe600', glow: '#ffe600' }, p.x, p.y, size, { pitch: -0.32, roll: 0, yaw: 0 }, { line: 1.5 });
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffe600';
      ctx.font = 'italic 900 11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('🎈 SEÑUELO', p.x, p.y - size);
    } });
  }
  // BALIZA de la historia
  if (s.storyMarker) {
    const p = project(cam, s.storyMarker, 1);
    if (p) draws.push({ z: p.z, fn: () => {
      const t = G.realTime, R = Math.max(8, p.s * 14);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.7 + i / 3) % 1;
        ctx.strokeStyle = `rgba(191,90,242,${1 - k})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, R * (0.5 + k * 2), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = '#e8d0ff';
      ctx.beginPath(); ctx.arc(p.x, p.y, R * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#bf5af2';
      ctx.font = 'italic 900 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`📡 BALIZA${s.markerT > 0 ? ` ${Math.round((s.markerT / 2) * 100)}%` : ''}`, p.x, p.y - R * 2.6);
    } });
  }
  // EL DEVORADOR DE ESTRELLAS
  if (s.devourer) {
    const d = s.devourer, p = project(cam, d.pos, 1);
    if (p) draws.push({ z: p.z, fn: () => {
      const R = d.r * p.s, t = G.realTime;
      ctx.save();
      // púas
      ctx.fillStyle = d.flash > 0 ? '#ffffff' : '#2a0a3a';
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2 + d.spin;
        const k = i % 2 ? 1.0 : 1.35 + 0.08 * Math.sin(t * 3 + i);
        ctx[i ? 'lineTo' : 'moveTo'](p.x + Math.cos(a) * R * k, p.y + Math.sin(a) * R * k);
      }
      ctx.fill();
      const g = ctx.createRadialGradient(p.x - R * 0.3, p.y - R * 0.3, R * 0.1, p.x, p.y, R);
      g.addColorStop(0, d.phase > 1 ? '#ff9f0a' : d.color ? '#7a0a1e' : '#5a1a7a');
      g.addColorStop(0.6, '#1a0428');
      g.addColorStop(1, '#05010d');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2); ctx.fill();
      // núcleo al descubierto
      if (d.phase > 1) {
        ctx.globalCompositeOperation = 'lighter';
        const c = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R * 0.55);
        c.addColorStop(0, `rgba(255,230,0,${0.7 + 0.3 * Math.sin(t * 8)})`);
        c.addColorStop(1, 'rgba(255,45,85,0)');
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(p.x, p.y, R * 0.55, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    } });
    for (const e of d.eyes) {
      if (!e.alive) continue;
      const q = project(cam, e.pos, 1);
      if (q) draws.push({ z: q.z - 1, fn: () => {
        const R = Math.max(5, 12 * q.s);
        ctx.fillStyle = e.flash > 0 ? '#fff' : '#ff2d55';
        ctx.shadowColor = '#ff2d55';
        ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.ellipse(q.x, q.y, R, R * 0.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(q.x, q.y, R * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.fillRect(q.x - R, q.y + R, R * 2, 3);
        ctx.fillStyle = '#ff2d55';
        ctx.fillRect(q.x - R, q.y + R, R * 2 * (e.hp / e.max), 3);
      } });
    }
  }
  // BASE PIRATA: anillo con torretas y vida
  if (s.base) {
    const b = s.base, p = project(cam, b.pos, 1);
    if (p) {
      draws.push({ z: p.z, fn: () => {
        drawMesh3D(ctx, cam, 'titan', b.pos, b.spin, 0, b.r * 0.8, { hull: '#1a0008', edge: '#ff2d55', glow: '#ff9f0a' }, b.flash > 0);
        ctx.strokeStyle = '#ff2d55';
        ctx.lineWidth = Math.max(2, p.s * 3);
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const a = (i / 24) * Math.PI * 2 + b.spin;
          const q = project(cam, { x: b.pos.x + Math.cos(a) * b.r, y: b.pos.y + 8, z: b.pos.z + Math.sin(a) * b.r }, 1);
          if (q) { if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
        }
        ctx.stroke();
        for (const t of b.turrets) {
          const q = project(cam, turretPos(b, t), 1);
          if (!q) continue;
          ctx.fillStyle = t.cd < 0.3 ? '#ffe600' : '#ff9f0a';
          ctx.beginPath();
          ctx.arc(q.x, q.y, Math.max(2.5, q.s * 4), 0, Math.PI * 2);
          ctx.fill();
        }
        const bw = Math.max(40, Math.min(120, p.s * 80));
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.fillRect(p.x - bw / 2, p.y - p.s * 50 - 12, bw, 5);
        ctx.fillStyle = '#ff2d55';
        ctx.fillRect(p.x - bw / 2, p.y - p.s * 50 - 12, bw * Math.max(0, b.hp / b.max), 5);
        ctx.fillStyle = '#ff2d55';
        ctx.font = 'italic 900 12px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('🏴‍☠️ BASE PIRATA', p.x, p.y - p.s * 50 - 18);
      } });
    }
  }
  // SUCESOS: cápsula, convoy y agujero de gusano
  const ev = s.event;
  if (ev && !ev.done) {
    const label = (p, text, col, dy) => { ctx.fillStyle = col; ctx.font = 'italic 900 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(text, p.x, p.y - dy); };
    if (ev.kind === 'rescue' && !ev.held) {
      const p = project(cam, ev.pod.pos, 1);
      if (p) draws.push({ z: p.z, fn: () => {
        const R = Math.max(5, p.s * 6), k = 0.5 + 0.5 * Math.sin(G.realTime * 6);
        ctx.fillStyle = '#e8fff0';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, R, R * 0.6, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(48,209,88,${0.4 + 0.6 * k})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, R * (1.6 + k), 0, Math.PI * 2); ctx.stroke();
        label(p, `🆘 CÁPSULA · ${Math.round(dist(ev.pod.pos, sh.pos))} m`, '#30d158', R * 2.8);
      } });
    } else if (ev.kind === 'convoy') {
      for (const [i, c] of ev.ships.entries()) {
        const p = project(cam, c.pos, 1);
        if (p) draws.push({ z: p.z, fn: () => {
          drawMesh3D(ctx, cam, 'brick', c.pos, c.yaw, 0, 11, { hull: '#0b2a14', edge: '#ffe600', glow: '#30d158' }, false);
          if (!i) label(p, '🚚 CONVOY MERCANTE', '#ffe600', p.s * 16 + 10);
        } });
      }
    } else if (ev.kind === 'wormhole') {
      const p = project(cam, ev.pos, 1);
      if (p) draws.push({ z: p.z, fn: () => {
        const R = Math.max(12, p.s * 40), t = G.realTime;
        ctx.save();
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
        g.addColorStop(0, '#000'); g.addColorStop(0.55, 'rgba(20,0,40,.9)'); g.addColorStop(1, 'rgba(191,90,242,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
          ctx.strokeStyle = `rgba(${i % 2 ? '125,249,255' : '191,90,242'},${0.6 - i * 0.08})`;
          ctx.lineWidth = Math.max(1.5, R * 0.05);
          ctx.beginPath();
          ctx.arc(p.x, p.y, R * (0.5 + i * 0.12), t * (2 + i) + i, t * (2 + i) + i + 2.2);
          ctx.stroke();
        }
        ctx.restore();
        label(p, `${EVENTS.wormhole.icon} AGUJERO DE GUSANO`, '#bf5af2', R + 10);
      } });
    }
  }
  // MISILES: los tuyos (blancos, con humo) y los del bombardero (rojos, parpadean)
  for (const [list, col] of [[s.missiles, '#ffffff'], [s.emissiles, '#ff2d55']]) {
    for (const m of list) {
      const p = project(cam, m.pos, 1), q = project(cam, sub(m.pos, scale(norm(m.vel), 22)), 1);
      if (!p || !q) continue;
      draws.push({ z: p.z, fn: () => {
        ctx.strokeStyle = 'rgba(200,200,220,.35)';
        ctx.lineWidth = Math.max(2, p.s * 2.5);
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        ctx.fillStyle = col === '#ff2d55' && Math.floor(G.realTime * 10) % 2 ? '#ffe600' : col;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2.5, p.s * 1.6), 0, Math.PI * 2); ctx.fill();
      } });
    }
  }
  // ONDAS EXPANSIVAS y chispas
  for (const b of s.blasts) {
    const p = project(cam, b.pos, 1);
    if (!p) continue;
    const k = b.t / b.max;
    draws.push({ z: p.z, fn: () => {
      const r = Math.max(3, b.R * Math.sqrt(k) * p.s);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (k < 0.35) {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - k / 0.35)})`);
        g.addColorStop(0.5, hexA(b.col, 0.6 * (1 - k / 0.35)));
        g.addColorStop(1, hexA(b.col, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = hexA(b.col, 0.85 * (1 - k));
      ctx.lineWidth = Math.max(1.5, r * 0.08 * (1 - k) + 1);
      ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.92, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    } });
  }
  for (const sp of s.sparks) {
    const p = project(cam, sp.pos, 1);
    if (!p) continue;
    draws.push({ z: p.z, fn: () => {
      ctx.fillStyle = sp.col;
      const r = Math.max(1.2, p.s * 0.8);
      ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    } });
  }

  // tus disparos (con el color elegido en el hangar)
  const shotCol = equipped(save, save.ship).shot.color || DEFAULT_SHOT;
  for (const bo of s.bolts) {
    const p = project(cam, bo.pos, 1), q = project(cam, sub(bo.pos, scale(norm(bo.vel), 14)), 1);
    if (!p || !q) continue;
    draws.push({ z: p.z, fn: () => {
      if (bo.plasma) {
        ctx.fillStyle = '#bf5af2';
        ctx.shadowColor = '#bf5af2';
        ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(4, p.s * 4), 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        return;
      }
      ctx.strokeStyle = shotCol;
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
      const size = Math.max(18, shp.s * 4.2) * (CHASSIS[save.galaxy.chassis]?.scale ?? 1);
      // ESTELA 3D: cinta en el mundo, con el color del motor
      if (s.trail.length > 2) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        let prev = null;
        for (let i = 0; i < s.trail.length; i++) {
          // los puntos pegados a la cámara se saltan: su escala se dispara
          const q = project(cam, s.trail[i], 9);
          if (q && prev) {
            const k = 1 - i / s.trail.length;
            ctx.strokeStyle = hexA(boosting ? '#7df9ff' : pal.glow, 0.55 * k);
            ctx.lineWidth = Math.min(size * 0.25, Math.max(1, q.s * 2.2 * k));
            ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
          prev = q;
        }
        ctx.restore();
      }
      trailFx(fx, ctx, eq.trail.id, shp.x, shp.y + size * 0.15, size * 1.2, boosting ? '#7df9ff' : pal.glow, boosting ? 120 : 40, G.realTime);
      auraFx(ctx, eq.aura.id, shp.x, shp.y, size * 0.9, G.realTime);
      // TONEL: una vuelta completa
      const spin = sh.barrelT > 0 ? sh.barrelDir * Math.PI * 2 * (1 - sh.barrelT / 0.55) : 0;
      drawShip(ctx, def.id, { ...pal, edge: pal.edge || def.color }, shp.x, shp.y, size,
        { pitch: -0.32, roll: sh.roll + spin, yaw: 0 }, { line: 1.6, ...emblemOpts(eq) });
      // ESCUDO: brilla al recibir
      if (sh.shieldFx > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(125,249,255,${Math.min(1, sh.shieldFx * 2)})`;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([size * 0.18, size * 0.1]);
        ctx.lineDashOffset = -G.realTime * 60;
        ctx.shadowColor = '#7df9ff';
        ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.ellipse(shp.x, shp.y, size * 0.95, size * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    } });
  }

  draws.sort((a, b) => b.z - a.z);
  for (const d of draws) d.fn();

  // SALTO: túnel de hiperespacio
  if (s.jumpT > 0) {
    const k = 1 - s.jumpT / 1.1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2 + i * 0.37;
      const r0 = 30 + ((G.realTime * 900 + i * 53) % 400), r1 = r0 + 60 + k * 200;
      ctx.strokeStyle = i % 3 ? 'rgba(125,249,255,.6)' : 'rgba(191,90,242,.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0);
      ctx.lineTo(W / 2 + Math.cos(a) * r1, H / 2 + Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = `rgba(255,255,255,${Math.max(0, k - 0.7) * 3})`;
    ctx.fillRect(0, 0, W, H);
  }

  // brújula: flecha hacia el objetivo actual
  if (s.target && s.jumpT <= 0) {
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

  // vida del DEVORADOR arriba, como en un jefe de verdad
  if (s.devourer) {
    const d = s.devourer, w = Math.min(320, W - 110), x = (W - 70 - w) / 2, y = 132; // bajo el objetivo, aunque ocupe 2 líneas
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(x, y, w, 10);
    ctx.fillStyle = d.phase === 1 ? '#7a5cff' : d.phase === 2 ? '#ff9f0a' : '#ff2d55';
    ctx.fillRect(x, y, w * Math.max(0, d.hp / d.max), 10);
    ctx.fillStyle = '#fff';
    ctx.font = 'italic 900 12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`🌑 ${d.name || 'EL DEVORADOR DE ESTRELLAS'} · ${d.phase === 1 ? `ojos ${d.eyes.filter((e) => e.alive).length}/${d.eyes.length}` : d.phase === 2 ? 'NÚCLEO' : 'FURIA'}`, x + w / 2, y - 6);
  }

  // VISOR DE MISIL: rombo que se cierra sobre el blanco; rojo = FIJADO
  if (s.lock?.ref) {
    const tp = project(cam, s.lock.ref.pos, 1);
    if (tp) {
      const k = Math.min(1, s.lock.t / 0.6), R = 34 - 16 * k;
      ctx.save();
      ctx.translate(tp.x, tp.y);
      ctx.rotate(Math.PI / 4 + (s.lock.locked ? 0 : G.realTime * 3));
      ctx.strokeStyle = s.lock.locked ? '#ff2d55' : '#ffe600';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-R, -R, R * 2, R * 2);
      ctx.restore();
      if (s.lock.locked) {
        ctx.fillStyle = '#ff2d55';
        ctx.font = 'italic 900 12px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('🚀 FIJADO', tp.x, tp.y + 34);
      }
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
