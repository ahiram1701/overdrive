// Render pseudo-3D en Canvas 2D: escala = focal / profundidad (como los arcades clásicos).
import { G, LANE_W, VIEW, clamp } from './state.js';
import { fx } from './fx.js';
import { BIOMES, FORK_REWARDS, bossRz, HUNTER_RZ, runSpeed } from './world.js';
import { SHIPS } from './upgrades.js';
import { isActive } from './abilities.js';
import { drawShip } from './shipdraw.js';
import { equipped, emblemOpts } from './cosmetics.js';
import { trailFx } from './cosfx.js';
import { save } from './save.js';

const CAM_H = 3;
const CAM_D = 6;
const NEAR = -CAM_D + 0.6;

let canvas, ctx, vignette;
let focal = 700, focalBase = 700, horizon = 300, camX = 0, curve = 0;
let menuDist = 0, menuT = 0;
let fpsAcc = 0, fpsFrames = 0, fps = 0;

const stars = Array.from({ length: 90 }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random(), k: 0.5 + Math.random() }));
const skyStars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 1.6 + 0.4 }));

export function initRender(c) {
  canvas = c;
  ctx = c.getContext('2d', { alpha: false });
  resize();
  addEventListener('resize', resize);
}

export function resize() {
  G.dpr = Math.min(devicePixelRatio || 1, 2);
  G.W = innerWidth;
  G.H = innerHeight;
  canvas.width = Math.round(G.W * G.dpr);
  canvas.height = Math.round(G.H * G.dpr);
  focalBase = Math.min(G.H * 0.9, G.W * 2.4);
  vignette = document.createElement('canvas');
  vignette.width = canvas.width;
  vignette.height = canvas.height;
  const v = vignette.getContext('2d');
  const g = v.createRadialGradient(canvas.width / 2, canvas.height * 0.55, canvas.height * 0.25, canvas.width / 2, canvas.height * 0.55, canvas.height * 0.85);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.65)');
  v.fillStyle = g;
  v.fillRect(0, 0, canvas.width, canvas.height);
}

export function project(x, y, rz) {
  const d = rz + CAM_D;
  if (d < 0.4) return null;
  const s = focal / d;
  const cx = x + curve * rz * rz;
  return { x: G.W / 2 + (cx - camX) * s, y: horizon + (CAM_H - y) * s, s };
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------- Cielo y suelo ----------
function drawSky(b, t) {
  const W = G.W, H = G.H;
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, b.sky[0]);
  g.addColorStop(1, b.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, horizon + 2);

  if (b.id === 'neon') {
    const cx = W / 2 - camX * 20, cy = horizon - H * 0.02, R = Math.min(W, H) * 0.24;
    const sg = ctx.createLinearGradient(0, cy - R, 0, cy);
    sg.addColorStop(0, '#ffe600');
    sg.addColorStop(1, '#ff2bd6');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = b.sky[1];
    for (let i = 0; i < 6; i++) {
      const yy = cy - R * 0.08 - i * R * 0.13;
      ctx.fillRect(cx - R, yy, R * 2, 2 + (5 - i) * 1.4);
    }
  } else if (b.id === 'hyper' || b.id === 'glitch') {
    ctx.fillStyle = b.id === 'hyper' ? '#fff' : '#39ff14';
    for (const s of skyStars) {
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + s.x * 30));
      ctx.fillRect(s.x * W, s.y * horizon, s.s, s.s);
    }
    ctx.globalAlpha = 1;
    if (b.id === 'hyper') {
      ctx.fillStyle = 'rgba(125,249,255,.18)';
      ctx.beginPath();
      ctx.ellipse(W / 2, horizon, W * 0.5, H * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (b.id === 'lava') {
    const lg = ctx.createRadialGradient(W / 2, horizon, 0, W / 2, horizon, W * 0.7);
    lg.addColorStop(0, 'rgba(255,180,0,.55)');
    lg.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, W, horizon);
  }
}

function polyline(x, y, z0, z1, step) {
  ctx.beginPath();
  let first = true;
  for (let z = z1; z >= z0; z -= step) {
    const p = project(x, y, z);
    if (!p) continue;
    if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y);
  }
  const p = project(x, y, z0);
  if (p) ctx.lineTo(p.x, p.y);
}

function quad(xa, xb, za, zb, y = 0) {
  const a = project(xa, y, za), b = project(xb, y, za), c = project(xb, y, zb), d = project(xa, y, zb);
  if (!a || !b || !c || !d) return false;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  return true;
}

function drawGround(b, dist, t) {
  const W = G.W, H = G.H;
  ctx.fillStyle = b.ground;
  ctx.fillRect(0, horizon, W, H - horizon);

  // rejilla lateral
  ctx.strokeStyle = hexA(b.line, 0.35);
  ctx.lineWidth = 1;
  for (const x of [-3, -4.5, -7, -11, -17, 3, 4.5, 7, 11, 17]) {
    polyline(x, 0, NEAR, VIEW, 10);
    ctx.stroke();
  }
  const STEP = 3;
  const off = dist % STEP;
  for (let z = VIEW - off; z > NEAR; z -= STEP * 2) {
    const a = project(-20, 0, z), c = project(20, 0, z);
    if (!a || !c) continue;
    ctx.globalAlpha = clamp(1 - z / VIEW, 0, 1) * 0.5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // carretera por franjas
  const r = G.run;
  for (let z = VIEW - off; z > NEAR; z -= STEP) {
    const za = Math.max(NEAR, z - STEP);
    const idx = Math.floor((dist + z) / STEP);
    if (quad(-1.5, 1.5, z, za)) {
      ctx.fillStyle = b.road[idx & 1];
      ctx.fill();
    }
    if (r && r.blockedLane !== null) {
      const lx = r.blockedLane * LANE_W;
      if (quad(lx - 0.5, lx + 0.5, z, za, 0.01)) {
        ctx.fillStyle = `hsl(${15 + 10 * Math.sin(t * 6 + idx)},100%,${40 + (idx & 1) * 10}%)`;
        ctx.fill();
      }
    }
    if (idx % 2 === 0) {
      ctx.strokeStyle = hexA(b.line, 0.7);
      ctx.lineWidth = 2;
      for (const lx of [-0.5, 0.5]) {
        const p1 = project(lx, 0, z), p2 = project(lx, 0, za);
        if (!p1 || !p2) continue;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  }

  // bordes con brillo
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const ex of [-1.5, 1.5]) {
    ctx.strokeStyle = hexA(b.edge, 0.25);
    ctx.lineWidth = 9;
    polyline(ex, 0, NEAR, VIEW, 6);
    ctx.stroke();
    ctx.strokeStyle = b.edge;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.restore();

  // postes laterales
  const POST = 12;
  const poff = dist % POST;
  for (let z = VIEW - poff; z > NEAR + 1; z -= POST) {
    const fog = clamp((VIEW - z) / 30, 0, 1);
    for (const px of [-2.3, 2.3]) {
      const top = project(px, 2.6, z), bot = project(px, 0, z);
      if (!top || !bot) continue;
      ctx.globalAlpha = fog;
      ctx.fillStyle = b.accent;
      const w = Math.max(1.5, 0.08 * bot.s);
      ctx.fillRect(top.x - w / 2, top.y, w, bot.y - top.y);
      ctx.fillStyle = hexA(b.accent, 0.3);
      ctx.fillRect(top.x - w * 2, top.y, w * 4, w * 1.5);
    }
  }
  ctx.globalAlpha = 1;

  // niebla del horizonte para esconder la aparición de objetos
  const fg = ctx.createLinearGradient(0, horizon - 2, 0, horizon + H * 0.08);
  fg.addColorStop(0, b.sky[1]);
  fg.addColorStop(1, hexA(b.sky[1].length === 7 ? b.sky[1] : '#000000', 0));
  ctx.fillStyle = fg;
  ctx.fillRect(0, horizon - 2, W, H * 0.08 + 2);
}

function drawSpeedLines(b, speed, dt) {
  const k = clamp((speed - 45) / 110, 0, 1);
  const hyper = b.id === 'hyper';
  if (k <= 0 && !hyper) return;
  const n = Math.floor((hyper ? 40 : 0) + k * 50);
  const cx = G.W / 2, cy = horizon;
  const R = Math.hypot(G.W, G.H) * 0.7;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = hyper ? '#bff' : '#fff';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < n; i++) {
    const s = stars[i];
    s.r += dt * (0.3 + speed / 70) * s.k * (s.r + 0.08);
    if (s.r > 1.2) { s.r = Math.random() * 0.1; s.a = Math.random() * Math.PI * 2; }
    const len = 0.04 + speed / 1500;
    const c = Math.cos(s.a), sn = Math.sin(s.a);
    ctx.globalAlpha = Math.min(1, s.r * 2) * (hyper ? 0.8 : 0.45 * k + 0.1);
    ctx.beginPath();
    ctx.moveTo(cx + c * s.r * R, cy + sn * s.r * R);
    ctx.lineTo(cx + c * (s.r + len) * R, cy + sn * (s.r + len) * R);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- Objetos ----------
function neonBox(x, y0, y1, rz, w, depth, col, fill = 0.35) {
  const fl = project(x - w / 2, y1, rz), fr = project(x + w / 2, y0, rz);
  const bl = project(x - w / 2, y1, rz + depth), br = project(x + w / 2, y1, rz + depth);
  if (!fl || !fr || !bl || !br) return null;
  // cara superior
  ctx.fillStyle = hexA(col, 0.55);
  ctx.beginPath();
  ctx.moveTo(fl.x, fl.y);
  ctx.lineTo(fr.x, fl.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.closePath();
  ctx.fill();
  // lateral visible
  const side = x - w / 2 > camX ? -1 : x + w / 2 < camX ? 1 : 0;
  if (side) {
    const sx = side < 0 ? x - w / 2 : x + w / 2;
    const ft = project(sx, y1, rz), fb = project(sx, y0, rz), bt = project(sx, y1, rz + depth), bb = project(sx, y0, rz + depth);
    if (ft && fb && bt && bb) {
      ctx.fillStyle = hexA(col, 0.25);
      ctx.beginPath();
      ctx.moveTo(ft.x, ft.y);
      ctx.lineTo(fb.x, fb.y);
      ctx.lineTo(bb.x, bb.y);
      ctx.lineTo(bt.x, bt.y);
      ctx.closePath();
      ctx.fill();
    }
  }
  // cara frontal
  const fw = fr.x - fl.x, fh = fr.y - fl.y;
  ctx.fillStyle = `rgba(0,0,0,${0.55})`;
  ctx.fillRect(fl.x, fl.y, fw, fh);
  ctx.fillStyle = hexA(col, fill);
  ctx.fillRect(fl.x, fl.y, fw, fh);
  ctx.lineWidth = Math.max(1.5, fl.s * 0.05);
  ctx.strokeStyle = col;
  ctx.strokeRect(fl.x, fl.y, fw, fh);
  return { x: fl.x, y: fl.y, w: fw, h: fh, s: fl.s };
}

// Código de colores por ACCIÓN, igual en todos los biomas:
// magenta = cambia de carril · amarillo ▲ = salta · cian ▼ = deslízate.
const ACT = { dodge: '#ff3b6b', jump: '#ffd60a', slide: '#00e5ff' };
// Regla: el CUERPO dice qué es (rojo = peligro, verde = objetivo, dorado = premio)
// y el CHEVRÓN dice qué hacer. El dorado queda reservado a las monedas.
const HAZARD = '#ff2d6f';
const TARGET = '#30d158';
const WALL_DRAW_H = 2.1; // los muros no se pueden saltar: se dibujan más altos que el salto

// Orbe de peligro con picos giratorios y núcleo oscuro con brillo pulsante.
function spikeOrb(x, y, R, col, rot, pulse) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = hexA(col, 0.3);
  ctx.beginPath();
  ctx.arc(x, y, R * 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#1a0008';
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(1.5, R * 0.16);
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rot;
    const rr = i % 2 ? R * 0.8 : R * 1.35;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = hexA(col, 0.55 + pulse * 0.45);
  ctx.beginPath();
  ctx.arc(x, y, R * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

// Chevrones animados que señalan hacia dónde esquivar (dir -1 = arriba, 1 = abajo).
function chevrons(cx, cy, size, dir, color, t, n = 2) {
  const base = ctx.globalAlpha;
  const ph = (t * 2.2) % 1;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.22);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const k = (i + ph) / n;
    const y = cy + dir * (k - 0.5) * size * 1.3;
    ctx.globalAlpha = base * (1 - k * 0.75);
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.5, y - dir * size * 0.3);
    ctx.lineTo(cx, y + dir * size * 0.2);
    ctx.lineTo(cx + size * 0.5, y - dir * size * 0.3);
    ctx.stroke();
  }
  ctx.restore();
}

function hazardStripes(f) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(f.x, f.y, f.w, f.h);
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  const st = Math.max(5, f.h * 0.7);
  for (let i = -2; i < f.w / st + 2; i++) {
    ctx.beginPath();
    ctx.moveTo(f.x + i * st * 2, f.y + f.h);
    ctx.lineTo(f.x + i * st * 2 + st, f.y + f.h);
    ctx.lineTo(f.x + i * st * 2 + st * 2, f.y);
    ctx.lineTo(f.x + i * st * 2 + st, f.y);
    ctx.fill();
  }
  ctx.restore();
}

function drawObj(o, rz, b, t) {
  const fog = clamp((VIEW - rz) / 25, 0, 1);
  ctx.globalAlpha = fog;
  switch (o.type) {
    case 'wall':
    case 'mover': {
      let x = o.x;
      // la puerta termina de cerrarse ~0.4 s antes del impacto, a cualquier velocidad
      if (o.gate) x += Math.sign(o.x || 1) * clamp((rz / runSpeed() - 0.4) / 0.5, 0, 1) * 1.6;
      const f = neonBox(x, o.y0, Math.min(o.y1, WALL_DRAW_H), rz, o.w, o.depth, ACT.dodge, 0.45);
      if (f) {
        ctx.strokeStyle = hexA(ACT.dodge, 0.7);
        ctx.lineWidth = Math.max(1, f.s * 0.03);
        ctx.beginPath();
        ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + f.w, f.y + f.h);
        ctx.moveTo(f.x + f.w, f.y); ctx.lineTo(f.x, f.y + f.h);
        ctx.stroke();
        if (o.type === 'mover' && Math.abs(o.target * LANE_W - o.x) > 0.05) {
          ctx.fillStyle = '#fff';
          ctx.font = `900 ${Math.round(f.h * 0.5)}px system-ui`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(o.target * LANE_W > o.x ? '▶' : '◀', f.x + f.w / 2, f.y + f.h / 2);
        }
      }
      break;
    }
    case 'barrier': {
      const f = neonBox(o.x, o.y0, o.y1, rz, o.w, o.depth, ACT.jump, 0.6);
      if (f) {
        hazardStripes(f);
        const c = project(o.x, 0.95, rz);
        if (c) chevrons(c.x, c.y, 0.3 * c.s, -1, ACT.jump, t);
      }
      break;
    }
    case 'overhead': {
      // barra fina colgada del techo con el hueco de debajo libre y marcado
      if (quad(o.x - o.w / 2, o.x + o.w / 2, rz, rz + 0.5, 0.01)) {
        ctx.fillStyle = hexA(ACT.slide, 0.28);
        ctx.fill();
      }
      const f = neonBox(o.x, 0.47, 0.72, rz, o.w, o.depth, ACT.slide, 0.6);
      if (f) {
        hazardStripes(f);
        // cortina rayada hasta el techo: por encima tampoco se pasa (no se puede saltar)
        const top = project(o.x - o.w / 2, WALL_DRAW_H + 0.4, rz);
        // sin marco ni rayas uniformes: un degradado que se desvanece, para no parecer una pared
        const cw = f.w, chh = f.y - top.y;
        const g = ctx.createLinearGradient(0, f.y, 0, top.y);
        g.addColorStop(0, hexA(ACT.slide, 0.28));
        g.addColorStop(1, hexA(ACT.slide, 0));
        ctx.fillStyle = g;
        ctx.fillRect(f.x, top.y, cw, chh);
        // cables de los que cuelga la barra
        ctx.strokeStyle = hexA(ACT.slide, 0.8);
        ctx.lineWidth = Math.max(1, f.s * 0.02);
        ctx.beginPath();
        ctx.moveTo(f.x + cw * 0.1, f.y); ctx.lineTo(f.x + cw * 0.1, top.y);
        ctx.moveTo(f.x + cw * 0.9, f.y); ctx.lineTo(f.x + cw * 0.9, top.y);
        ctx.stroke();
        const c = project(o.x, 0.3, rz);
        if (c) chevrons(c.x, c.y - 0.06 * c.s, 0.32 * c.s, 1, ACT.slide, t);
      }
      break;
    }
    case 'laserLow':
    case 'laserHigh': {
      const low = o.type === 'laserLow';
      const col = low ? ACT.jump : ACT.slide;
      const ys = low ? [0.2] : [0.6, 0.95, 1.3, 1.7, 2.1];
      const flick = 0.75 + Math.random() * 0.25;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const y of ys) {
        const a = project(-1.6, y, rz), c = project(1.6, y, rz);
        if (!a || !c) continue;
        ctx.globalAlpha = fog * flick;
        ctx.strokeStyle = hexA(col, 0.4);
        ctx.lineWidth = Math.max(4, a.s * 0.16);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = Math.max(1.5, a.s * 0.04);
        ctx.stroke();
      }
      ctx.restore();
      for (const ex of [-1.6, 1.6]) neonBox(ex, 0, ys[ys.length - 1] + 0.25, rz, 0.15, 0.15, col, 0.8);
      for (const lx of [-1, 0, 1]) {
        const c = project(lx, low ? 0.6 : 0.3, rz);
        if (c) chevrons(c.x, c.y, 0.22 * c.s, low ? -1 : 1, col, t);
      }
      break;
    }
    case 'mine': {
      // peligro = cuerpo oscuro con picos rojos; el chevrón amarillo dice "salta"
      const p = project(o.x, 0.2, rz);
      if (!p) break;
      const R = 0.22 * p.s;
      spikeOrb(p.x, p.y, R, HAZARD, t * 2, 0.5 + 0.5 * Math.sin(t * 12 + o.z));
      const c = project(o.x, 0.75, rz);
      if (c) chevrons(c.x, c.y, 0.22 * c.s, -1, ACT.jump, t);
      break;
    }
    case 'shot': {
      // disparos (jefe y Cazador): orbe rojo-magenta con picos y estela. Nada que ver con una moneda.
      const p = project(o.x, o.tall ? 0.65 : 0.25, rz);
      if (!p) break;
      const R = 0.3 * p.s;
      const tail = project(o.x, o.tall ? 0.65 : 0.25, rz + 2.5);
      if (tail) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(tail.x, tail.y, p.x, p.y);
        g.addColorStop(0, hexA(HAZARD, 0));
        g.addColorStop(1, hexA(HAZARD, 0.55));
        ctx.strokeStyle = g;
        ctx.lineWidth = R * (o.tall ? 1.6 : 1.3);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();
      }
      if (o.tall) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(0.75, 2);
        spikeOrb(0, 0, R, HAZARD, t * 6, 1);
        ctx.restore();
      } else {
        spikeOrb(p.x, p.y, R, HAZARD, t * 6, 1);
        const c = project(o.x, 0.85, rz);
        if (c) chevrons(c.x, c.y, 0.22 * c.s, -1, '#ffffff', t);
      }
      break;
    }
    case 'core': {
      // objetivo del DASH: verde = "ve a por él"
      const p = project(o.x, 0.6, rz);
      if (!p) break;
      const R = 0.42 * p.s * (1 + 0.12 * Math.sin(t * 14));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = hexA(TARGET, 0.35);
      ctx.beginPath(); ctx.arc(p.x, p.y, R * 1.7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = TARGET;
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(p.x, p.y, R * 0.45, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = TARGET;
      ctx.lineWidth = Math.max(1.5, R * 0.08);
      ctx.beginPath();
      ctx.arc(p.x, p.y, R * (1.9 + 0.2 * Math.sin(t * 8)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `italic 900 ${Math.max(10, Math.round(R * 0.9))}px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillText(o.shield ? 'SOLO DASH' : 'DASH!', p.x, p.y - R * 2.2);
      if (o.shield) {
        // núcleo blindado (EL CENSOR): el láser rebota, hay que embestirlo
        ctx.strokeStyle = '#5ac8fa';
        ctx.lineWidth = Math.max(2, R * 0.12);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + t;
          ctx.lineTo(p.x + Math.cos(a) * R * 1.45, p.y + Math.sin(a) * R * 1.45);
        }
        ctx.closePath();
        ctx.stroke();
      }
      break;
    }
    case 'coin': {
      // la ÚNICA cosa dorada y brillante de la pista
      const p = project(o.x, o.y, rz);
      if (!p) break;
      const R = 0.2 * p.s;
      const sx = Math.abs(Math.cos(t * 5 + o.z * 0.3));
      ctx.fillStyle = '#ffcc00';
      ctx.strokeStyle = '#fff6b0';
      ctx.lineWidth = Math.max(1, R * 0.18);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - R);
      ctx.lineTo(p.x + R * 0.8 * sx + 0.5, p.y);
      ctx.lineTo(p.x, p.y + R);
      ctx.lineTo(p.x - R * 0.8 * sx - 0.5, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // destello en cruz que aparece y desaparece
      const gl = Math.max(0, Math.sin(t * 4 + o.z));
      if (gl > 0.3) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha *= gl;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = Math.max(1, R * 0.12);
        const L = R * 0.9 * gl;
        const gx = p.x + R * 0.25, gy = p.y - R * 0.35;
        ctx.beginPath();
        ctx.moveTo(gx - L, gy); ctx.lineTo(gx + L, gy);
        ctx.moveTo(gx, gy - L); ctx.lineTo(gx, gy + L);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    // ---- F6 ----
    case 'lava': {
      // río de lava a lo largo de un carril: rojo burbujeante (peligro), se esquiva cambiando de carril
      const z0 = Math.max(rz, NEAR + 0.6), z1 = Math.min(rz + o.len, VIEW);
      for (let z = z0; z < z1; z += 3) {
        if (!quad(o.x - 0.47, o.x + 0.47, Math.min(z + 3, z1), z, 0.02)) continue;
        const k = 0.5 + 0.5 * Math.sin(t * 6 + z * 0.4);
        ctx.fillStyle = `rgba(255,${60 + 70 * k | 0},20,${0.75 * clamp((VIEW - z) / 25, 0, 1)})`;
        ctx.fill();
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,200,60,.6)';
      ctx.lineWidth = 2;
      for (const ex of [-0.47, 0.47]) {
        polyline(o.x + ex, 0.02, z0, z1, 4);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'glitch': {
      // muro que salta de carril: su fantasma parpadea en el destino antes del salto
      if (!o.jumped && rz < runSpeed() * 1.6) {
        ctx.globalAlpha = fog * (Math.floor(t * 16) % 2 ? 0.45 : 0.2);
        neonBox(o.to * LANE_W, 0, WALL_DRAW_H, rz, o.w, o.depth, '#39ff14', 0.15);
        ctx.globalAlpha = fog;
      }
      const jitter = o.jumped ? 0 : (Math.random() - 0.5) * 0.06;
      const f = neonBox(o.x + jitter, 0, WALL_DRAW_H, rz, o.w, o.depth, ACT.dodge, 0.45);
      if (f) {
        ctx.fillStyle = 'rgba(57,255,20,.35)';
        for (let i = 0; i < 3; i++) ctx.fillRect(f.x, f.y + Math.random() * f.h, f.w, Math.max(1, f.h * 0.04));
      }
      break;
    }
    // ---- F4 ----
    case 'crusher': {
      // dos mandíbulas que se cierran sobre el carril y terminan ~0,4 s antes del impacto
      const open = clamp((rz / runSpeed() - 0.4) / 0.6, 0, 1);
      const half = o.w / 2;
      for (const side of [-1, 1]) {
        const x = o.x + side * (half / 2 + open * 0.45);
        const f = neonBox(x, 0, WALL_DRAW_H, rz, half, o.depth, ACT.dodge, 0.5);
        if (f) {
          ctx.fillStyle = '#fff';
          ctx.font = `900 ${Math.round(f.h * 0.22)}px system-ui`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(side < 0 ? '▶' : '◀', f.x + f.w / 2, f.y + f.h / 2);
        }
      }
      break;
    }
    case 'roller': {
      // rodillo que rueda hacia ti (más rápido que la pista): amarillo, salta
      const f = neonBox(o.x, 0, o.y1, rz, o.w, o.depth, ACT.jump, 0.55);
      if (f) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(f.x, f.y, f.w, f.h);
        ctx.clip();
        ctx.strokeStyle = 'rgba(0,0,0,.6)';
        ctx.lineWidth = Math.max(2, f.h * 0.18);
        const ph = (o.t * 9) % 1;
        for (let i = -1; i < 4; i++) {
          const y = f.y + ((i + ph) / 3) * f.h;
          ctx.beginPath(); ctx.moveTo(f.x, y); ctx.lineTo(f.x + f.w, y); ctx.stroke();
        }
        ctx.restore();
        const c = project(o.x, 0.95, rz);
        if (c) chevrons(c.x, c.y, 0.3 * c.s, -1, ACT.jump, t, 3);
      }
      break;
    }
    case 'dropper': {
      // barra que baja del techo justo antes de llegar: cian, deslízate
      const down = clamp(1 - (rz / runSpeed() - 0.3) / 0.6, 0, 1);
      const y0 = 0.47 + (1 - down) * 1.9;
      const f = neonBox(o.x, y0, y0 + 0.25, rz, o.w, o.depth, ACT.slide, 0.6);
      if (f) {
        hazardStripes(f);
        const c = project(o.x, 0.3, rz);
        if (c) chevrons(c.x, c.y - 0.06 * c.s, 0.32 * c.s, 1, ACT.slide, t);
      }
      break;
    }
    case 'rail': {
      // riel: punta a la altura de una barrera (súbete saltando) y raíl largo por delante
      const z0 = Math.max(rz, NEAR + 0.6), z1 = Math.min(rz + o.len, VIEW);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexA('#ffffff', 0.35);
      ctx.lineWidth = 8;
      polyline(o.x, 0.5, z0, z1, 3);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = hexA('#ffffff', 0.5);
      ctx.lineWidth = 1.5;
      for (let z = Math.ceil(z0 / 4) * 4; z < z1; z += 4) {
        const a = project(o.x, 0.5, z), bot = project(o.x, 0, z);
        if (a && bot) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(bot.x, bot.y); ctx.stroke(); }
      }
      if (rz > NEAR + 0.6) {
        neonBox(o.x, 0, 0.5, rz, 0.5, 0.3, ACT.jump, 0.7);
        const c = project(o.x, 0.95, rz);
        if (c) chevrons(c.x, c.y, 0.24 * c.s, -1, ACT.jump, t);
      }
      break;
    }
    case 'portal': {
      const p = project(o.x, 0.9, rz);
      if (!p) break;
      const R = 0.55 * p.s;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = hexA('#bf5af2', 0.8 - i * 0.22);
        ctx.lineWidth = Math.max(2, R * 0.12);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, R * (1 - i * 0.22), R * 1.4 * (1 - i * 0.22), t * (2 + i), 0, Math.PI * 1.6);
        ctx.stroke();
      }
      ctx.restore();
      const d = project(o.dest * LANE_W, 0.9, rz);
      if (d) {
        ctx.fillStyle = '#fff';
        ctx.font = `900 ${Math.max(10, Math.round(R * 0.7))}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(o.dest > o.lane ? '➜' : '⬅', p.x, p.y);
      }
      break;
    }
    case 'ramp': {
      // rampa verde: te lanza por los aires
      const a = project(o.x - 0.45, 0, rz), br = project(o.x + 0.45, 0, rz);
      const c = project(o.x + 0.45, 0.6, rz + o.depth), d = project(o.x - 0.45, 0.6, rz + o.depth);
      if (!a || !br || !c || !d) break;
      ctx.fillStyle = hexA(TARGET, 0.35);
      ctx.strokeStyle = TARGET;
      ctx.lineWidth = Math.max(1.5, a.s * 0.03);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(br.x, br.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      const m = project(o.x, 0.5, rz + o.depth * 0.5);
      if (m) chevrons(m.x, m.y, 0.3 * m.s, -1, TARGET, t, 3);
      break;
    }
    case 'drone': {
      // diana verde flotante: rómpela con DASH, láser u overdrive
      const p = project(o.x, 1 + Math.sin(t * 4 + o.z) * 0.1, rz);
      if (!p) break;
      const S = 0.32 * p.s;
      ctx.strokeStyle = TARGET;
      ctx.lineWidth = Math.max(1.5, S * 0.14);
      ctx.fillStyle = hexA(TARGET, 0.25);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - S); ctx.lineTo(p.x + S, p.y); ctx.lineTo(p.x, p.y + S); ctx.lineTo(p.x - S, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x, p.y, S * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.max(9, Math.round(S * 0.8))}px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillText('🎯', p.x, p.y - S * 1.5);
      break;
    }
    case 'finish': {
      // META: arco a cuadros sobre los 3 carriles
      const l = project(-1.6 * LANE_W, 0, rz), rr = project(1.6 * LANE_W, 2.6, rz);
      if (!l || !rr) break;
      const w = rr.x - l.x, h = l.y - rr.y;
      const pw = Math.max(3, w * 0.025), bh = h * 0.22, n = 16, cw = w / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < 2; j++) {
          ctx.fillStyle = (i + j) % 2 ? '#fff' : '#111';
          ctx.fillRect(l.x + i * cw, rr.y + j * bh / 2, cw + 0.5, bh / 2 + 0.5);
        }
      }
      ctx.fillStyle = '#ffe600';
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 20;
      ctx.fillRect(l.x - pw, rr.y, pw, h);
      ctx.fillRect(rr.x, rr.y, pw, h);
      ctx.shadowBlur = 0;
      ctx.fillStyle = hexA('#ffe600', 0.12);
      ctx.fillRect(l.x, rr.y + bh, w, h - bh);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffe600';
      ctx.font = `italic 900 ${Math.round(h * 0.18)}px system-ui`;
      ctx.fillText('META', l.x + w / 2, rr.y + bh + h * 0.2);
      break;
    }
    case 'fork': {
      const info = FORK_REWARDS[o.reward];
      const l = project(o.x - 0.47, 0, rz), rr = project(o.x + 0.47, 2.2, rz);
      if (!l || !rr) break;
      const w = rr.x - l.x, h = l.y - rr.y;
      ctx.fillStyle = hexA(info.color, 0.14);
      ctx.fillRect(l.x, rr.y, w, h);
      ctx.fillStyle = info.color;
      const pw = Math.max(2, w * 0.07);
      ctx.fillRect(l.x, rr.y, pw, h);
      ctx.fillRect(rr.x - pw, rr.y, pw, h);
      ctx.fillRect(l.x, rr.y, w, h * 0.3);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${Math.round(h * 0.2)}px system-ui`;
      ctx.fillText(info.icon, l.x + w / 2, rr.y + h * 0.5);
      ctx.fillStyle = '#000';
      ctx.font = `italic 900 ${Math.round(Math.min(h * 0.14, w / 6))}px system-ui`;
      ctx.fillText(info.label, l.x + w / 2, rr.y + h * 0.15);
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${Math.round(Math.min(h * 0.075, w / 10))}px system-ui`;
      ctx.fillText(info.desc, l.x + w / 2, rr.y + h * 0.72);
      break;
    }
  }
  ctx.globalAlpha = 1;
}

// Cazador: dron con ojo rojo que flota delante. Antes de cada disparo marca tu carril en el suelo.
function drawHunter(t) {
  const r = G.run, h = r.hunter;
  const out = h.leaving ? h.leaveT : 0;
  const rz = HUNTER_RZ + out * 40;
  const blink = Math.floor(t * 14) % 2 === 0;

  if (h.aimT > 0 && !h.leaving) {
    const lx = h.aimLane * LANE_W;
    if (quad(lx - 0.48, lx + 0.48, -1, rz, 0.02)) {
      ctx.fillStyle = hexA(ACT.dodge, blink ? 0.45 : 0.2);
      ctx.fill();
    }
    const a = project(h.x * LANE_W, 2.3, rz), c = project(lx, 0.3, 0);
    if (a && c) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexA(ACT.dodge, 0.8);
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  const p = project(h.x * LANE_W, 2.3 + Math.sin(t * 5) * 0.12 + out * 2, rz);
  if (!p) return;
  const S = 0.85 * p.s;
  ctx.save();
  ctx.globalAlpha = 1 - Math.min(1, out);
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.sin(t * 3) * 0.15);
  ctx.beginPath();
  ctx.moveTo(0, -S);
  ctx.lineTo(S * 0.9, 0);
  ctx.lineTo(0, S * 0.7);
  ctx.lineTo(-S * 0.9, 0);
  ctx.closePath();
  ctx.fillStyle = 'rgba(8,0,12,.35)'; // translúcido: no debe tapar la pista que viene
  ctx.fill();
  ctx.lineWidth = Math.max(2, S * 0.1);
  ctx.strokeStyle = ACT.dodge;
  ctx.stroke();
  // rotores
  ctx.strokeStyle = hexA('#ffffff', 0.6);
  ctx.lineWidth = Math.max(1, S * 0.06);
  for (const sx of [-1, 1]) {
    const w = S * 0.55 * Math.abs(Math.cos(t * 40 + sx));
    ctx.beginPath();
    ctx.moveTo(sx * S * 0.9 - w, -S * 0.15);
    ctx.lineTo(sx * S * 0.9 + w, -S * 0.15);
    ctx.stroke();
  }
  const ex = Math.max(-0.25, Math.min(0.25, (G.player.x - h.x) * 0.3)) * S;
  ctx.fillStyle = h.aimT > 0 && blink ? '#fff' : '#ff2d55';
  ctx.beginPath();
  ctx.arc(ex, 0, S * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBoss(b, t) {
  const r = G.run, bo = r.boss;
  const col = bo.def ? bo.def.color : b.obs;
  const shape = bo.def ? bo.def.shape : 'worm';
  const rz = bossRz();

  // marca del rayo en el suelo: apártate de esos carriles
  if (bo.beam) {
    const blink = Math.floor(t * 14) % 2 === 0;
    for (const l of bo.beam.lanes) {
      if (quad(l * LANE_W - 0.48, l * LANE_W + 0.48, -1, rz, 0.02)) {
        ctx.fillStyle = hexA(HAZARD, blink ? 0.5 : 0.22);
        ctx.fill();
      }
    }
  }

  const p = project(bo.x, 3.4, rz);
  if (!p) return;
  const S = 4.2 * p.s * (bo.dying ? 1 + (2 - bo.dying) * 0.3 : 1);
  const body = bo.flash > 0 ? `rgba(255,255,255,${0.4 + bo.flash * 0.6})` : 'rgba(10,0,20,.9)';
  const enraged = bo.phase === 1;
  ctx.save();
  ctx.translate(p.x, p.y + Math.sin(t * 3) * S * 0.1);
  if (enraged) ctx.translate((Math.random() - 0.5) * S * 0.03, 0); // en fase 2 tiembla
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(2, S * 0.06);
  ctx.fillStyle = body;
  const eye = (cx, cy, rx, ry) => {
    const ex = clamp((G.player.x - bo.x) * 0.12, -0.15, 0.15) * S;
    ctx.fillStyle = enraged ? '#ff2d55' : col;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx + ex, cy + ry * 0.15, Math.min(rx, ry) * 0.45, 0, Math.PI * 2); ctx.fill();
  };

  switch (shape) {
    case 'eye': {
      // OJO DEL VACÍO: un ojo enorme con párpados
      ctx.beginPath(); ctx.ellipse(0, 0, S * 0.75, S * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + t;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * S * 0.78, Math.sin(a) * S * 0.52);
        ctx.lineTo(Math.cos(a) * S * 0.98, Math.sin(a) * S * 0.7);
        ctx.stroke();
      }
      eye(0, 0, S * 0.42, S * 0.36);
      break;
    }
    case 'maw': {
      // DEVORADOR: una boca con dientes que se abre y se cierra
      const open = 0.25 + 0.2 * Math.sin(t * 4);
      ctx.beginPath(); ctx.arc(0, 0, S * 0.7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1a0008';
      ctx.beginPath(); ctx.ellipse(0, S * 0.15, S * 0.5, S * open, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      for (let i = -3; i <= 3; i++) {
        for (const dir of [-1, 1]) {
          const y0 = S * 0.15 + dir * S * open;
          ctx.beginPath();
          ctx.moveTo(i * S * 0.13 - S * 0.05, y0);
          ctx.lineTo(i * S * 0.13 + S * 0.05, y0);
          ctx.lineTo(i * S * 0.13, y0 - dir * S * 0.12);
          ctx.fill();
        }
      }
      eye(-S * 0.3, -S * 0.38, S * 0.11, S * 0.09);
      eye(S * 0.3, -S * 0.38, S * 0.11, S * 0.09);
      break;
    }
    case 'cube': {
      // EL CENSOR: un cubo que gira con una franja de censura
      ctx.rotate(Math.sin(t * 0.8) * 0.3 + t * 0.4);
      ctx.beginPath(); ctx.rect(-S * 0.55, -S * 0.55, S * 1.1, S * 1.1); ctx.fill(); ctx.stroke();
      ctx.strokeRect(-S * 0.38, -S * 0.38, S * 0.76, S * 0.76);
      ctx.fillStyle = '#000';
      ctx.fillRect(-S * 0.6, -S * 0.1, S * 1.2, S * 0.2);
      ctx.fillStyle = col;
      ctx.font = `900 ${Math.round(S * 0.14)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CENSURADO', 0, 0);
      break;
    }
    case 'ufo': {
      // MAMÁ OVNI: platillo con cúpula y luces
      ctx.beginPath(); ctx.ellipse(0, S * 0.1, S * 0.9, S * 0.28, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, -S * 0.05, S * 0.4, S * 0.35, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = Math.floor(t * 8 + i) % 2 ? col : '#fff';
        ctx.beginPath(); ctx.arc((i - 3) * S * 0.24, S * 0.18, S * 0.05, 0, Math.PI * 2); ctx.fill();
      }
      eye(0, -S * 0.15, S * 0.16, S * 0.13);
      // haz de abducción
      ctx.fillStyle = hexA(col, 0.12);
      ctx.beginPath();
      ctx.moveTo(-S * 0.3, S * 0.3); ctx.lineTo(S * 0.3, S * 0.3); ctx.lineTo(S * 0.7, S * 1.4); ctx.lineTo(-S * 0.7, S * 1.4);
      ctx.fill();
      break;
    }
    default: {
      // GUSANO DE NEÓN: cuerpo hexagonal con tentáculos
      for (let i = 0; i < 6; i++) {
        const a = (i / 5 - 0.5) * 1.6;
        ctx.beginPath();
        ctx.moveTo(Math.sin(a) * S * 0.5, S * 0.3);
        for (let k = 1; k <= 6; k++) {
          ctx.lineTo(Math.sin(a) * S * (0.5 + k * 0.12) + Math.sin(t * 5 + k + i) * S * 0.08, S * (0.3 + k * 0.17));
        }
        ctx.stroke();
      }
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        ctx.lineTo(Math.cos(a) * S * 0.65, Math.sin(a) * S * 0.55);
      }
      ctx.closePath();
      ctx.fillStyle = body;
      ctx.fill();
      ctx.stroke();
      eye(0, 0, S * 0.28, S * 0.2);
    }
  }
  ctx.restore();
}

// hsl(h, 100%, 60%) en hex (drawShip mezcla colores en RGB)
function hueHex(h) {
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = 0.6 - 0.4 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const curShip = () => SHIPS.find((s) => s.id === save.ship) || SHIPS[0];

// color del borde: el de la pintura, o el de la nave; en OVERDRIVE, arcoíris
function shipColor() {
  const r = G.run;
  if (r && r.odTime > 0) return hueHex((G.realTime * 600) % 360);
  return equipped(save, save.ship).palette.edge || curShip().color;
}

// Rayo del LÁSER: de la nave al primer obstáculo de su carril
function drawBeam(beam) {
  const k = Math.max(0, beam.t / 0.18);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const b of beam.rays) {
    const a = project(b.x, 0.4, 0), c = project(b.x, 0.4, Math.min(b.rz, VIEW));
    if (!a || !c) continue;
    ctx.strokeStyle = `rgba(255,159,10,${0.45 * k})`;
    ctx.lineWidth = 0.35 * a.s * k;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${k})`;
    ctx.lineWidth = 0.08 * a.s;
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer() {
  const p = G.player;
  const r = G.run;
  if (p && p.dead) return;
  const px = p ? p.x * LANE_W : Math.sin(menuT * 0.8) * 0.8;
  const py = p ? p.y : 0.15 + Math.sin(menuT * 3) * 0.05;
  const tilt = p ? p.tilt : Math.cos(menuT * 0.8) * 0.3;
  const sh = project(px, 0, 0);
  const sp = project(px, py + 0.15, 0);
  if (!sp || !sh) return;
  const s = sp.s;
  const col = shipColor();
  const low = p && p.slide > 0;
  const sq = low ? 0.55 : 1;

  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.beginPath();
  ctx.ellipse(sh.x, sh.y, s * 0.4 * (1 - Math.min(0.5, py * 0.3)), s * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  // nave 3D vista desde detrás y arriba; se inclina al cambiar de carril y se aplasta al deslizarse
  const eq = equipped(save, save.ship);
  const pal = eq.palette;
  const drawShape = (ox, oy, alpha, c, withEmblem = false) => {
    drawShip(ctx, curShip().id, { ...pal, edge: c }, sp.x + ox, sp.y + oy - 0.08 * s, s * 0.44,
      { pitch: -0.62, roll: -tilt * 0.55, yaw: tilt * 0.12 }, { alpha, squash: sq, line: Math.max(1.5, s * 0.022), ...(withEmblem ? emblemOpts(eq) : {}) });
  };

  if (p && p.dash > 0) {
    for (let i = 3; i >= 1; i--) drawShape(0, i * s * 0.12, 0.25 / i, '#99ffff');
  }

  // llama del motor
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const fl = (0.25 + Math.random() * 0.15 + (r ? Math.min(0.4, r.speed / 300) : 0)) * s;
  ctx.fillStyle = r && r.odTime > 0 ? col : 'rgba(255,140,40,.8)';
  ctx.beginPath();
  ctx.moveTo(sp.x - 0.1 * s, sp.y + 0.08 * s * sq);
  ctx.lineTo(sp.x, sp.y + 0.12 * s * sq + fl);
  ctx.lineTo(sp.x + 0.1 * s, sp.y + 0.08 * s * sq);
  ctx.fill();
  ctx.restore();

  const blink = p && p.invuln > 0 && Math.floor(G.realTime * 20) % 2 === 0;
  const ab = r && r.ability;
  const phase = isActive(ab, 'phase');
  // FASE: nave casi transparente; ARIETE: nave al rojo con escudo frontal; SOBRECARGA: estela cian
  if (!blink) drawShape(0, 0, phase ? 0.35 : 1, isActive(ab, 'ram') ? '#ff9f0a' : col, true);
  if (ab && ab.active > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const k = 0.6 + 0.4 * Math.sin(G.realTime * 18);
    if (phase) {
      ctx.strokeStyle = `rgba(224,224,255,${0.5 * k})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y - 0.15 * s, s * 0.6, s * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (isActive(ab, 'ram')) {
      ctx.fillStyle = `rgba(255,159,10,${0.35 * k})`;
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y - 0.45 * s, s * 0.55, s * 0.2, 0, Math.PI, 0);
      ctx.fill();
    } else if (isActive(ab, 'overclock')) {
      for (let i = 1; i <= 4; i++) drawShape(0, i * s * 0.1, 0.12, '#00e5ff');
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  if (r && r.shields > 0) {
    ctx.strokeStyle = 'rgba(48,209,88,.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y - 0.15 * s, s * 0.55, s * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (r && (G.mode === 'play' || G.mode === 'won')) trailFx(fx, ctx, eq.trail.id, sp.x, sp.y, s, r.odTime > 0 ? col : pal.glow, r.speed, G.realTime);
}

// ---------- Frame ----------
export function render(dt) {
  const W = G.W, H = G.H;
  const r = G.run;
  const t = G.realTime;
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);

  const b = r ? r.biome : BIOMES[Math.floor(t / 8) % BIOMES.length];
  let speed;
  if (r) speed = r.speed * (r.odTime > 0 ? 1.5 : 1);
  else { menuT += dt; speed = 55; menuDist += speed * dt; }
  const dist = r ? r.dist : menuDist;

  const sn = clamp((speed - 28) / 140, 0, 1.4);
  const dashPunch = G.player && G.player.dash > 0 ? 0.12 : 0;
  focal = focalBase / (1 + sn * 0.28 + dashPunch);
  horizon = H * 0.36;
  const targetCam = G.player ? G.player.x * LANE_W * 0.55 : 0;
  camX += (targetCam - camX) * Math.min(1, dt * 8);
  curve = r ? r.curve : Math.sin(t * 0.3) * 0.00035;

  ctx.save();
  const shk = fx.shakeAmt;
  if (shk) ctx.translate((Math.random() - 0.5) * shk, (Math.random() - 0.5) * shk);
  if (r && r.event?.id === 'flip') {
    ctx.translate(0, H);
    ctx.scale(1, -1);
  }
  // AGUJERO DE GUSANO: la vista gira mientras dura el set piece
  const sc = r && r.script;
  if (sc && sc.spin && sc.z0 !== undefined && r.dist >= sc.z0 && (sc.z1 === undefined || r.dist <= sc.z1)) {
    ctx.translate(W / 2, H * 0.6);
    ctx.rotate(Math.sin(t * 0.7) * 0.32);
    ctx.translate(-W / 2, -H * 0.6);
  }

  drawSky(b, t);
  drawGround(b, dist, t);
  drawSpeedLines(b, speed, dt);
  if (r && r.boss) drawBoss(b, t);
  if (r && r.hunter) drawHunter(t);
  if (r && r.beam) drawBeam(r.beam);

  if (r) {
    const list = [];
    for (const o of r.objects) {
      if (!o.alive) continue;
      const rz = o.z - r.dist;
      if (rz > VIEW || rz + (o.len || 0) < NEAR + 0.5) continue; // un riel se dibuja mientras quede tramo
      // orden de dibujo: un riel por su extremo lejano (si no, taparía la nave al recorrerlo)
      list.push([o.type === 'rail' ? rz + o.len : rz, o, rz]);
    }
    list.sort((a, c) => c[0] - a[0]);
    let drewPlayer = false;
    for (const [key, o, rz] of list) {
      if (!drewPlayer && key < -0.2) { drawPlayer(); drewPlayer = true; }
      drawObj(o, rz, b, t);
    }
    if (!drewPlayer) drawPlayer();
  } else {
    drawPlayer();
  }

  fx.draw(ctx);
  ctx.restore();

  // APAGÓN: solo se ve la zona cercana a la nave
  if (r && r.event?.id === 'blackout') {
    const g = ctx.createRadialGradient(W / 2, H * 0.78, H * 0.12, W / 2, H * 0.7, H * 0.55);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.94)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  fx.drawTexts(ctx, r && r.event?.id === 'flip' ? H : 0);

  // post-proceso
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const blur = save.settings.fx ? clamp((speed - 70) / 120, 0, 0.5) + (r && r.odTime > 0 ? 0.25 : 0) : 0;
  if (blur > 0.01) {
    const z = 0.02 + blur * 0.03;
    ctx.globalAlpha = 0.12 + blur * 0.25;
    ctx.drawImage(canvas, -canvas.width * z / 2, -canvas.height * z / 2, canvas.width * (1 + z), canvas.height * (1 + z));
    ctx.globalAlpha = 1;
  }
  if (b.id === 'glitch' && save.settings.fx && Math.random() < 0.07) {
    for (let i = 0; i < 3; i++) {
      const y = Math.random() * canvas.height, h = Math.random() * 30 * G.dpr + 4;
      const off = (Math.random() - 0.5) * 60 * G.dpr;
      ctx.drawImage(canvas, 0, y, canvas.width, h, off, y, canvas.width, h);
    }
  }
  ctx.drawImage(vignette, 0, 0);
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);

  if (r && r.odTime > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `hsla(${(t * 300) % 360},100%,50%,.09)`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (fx.flashA > 0) {
    ctx.globalAlpha = Math.min(1, fx.flashA);
    ctx.fillStyle = fx.flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  if (r && r.boss && !r.boss.dying) {
    const bo = r.boss;
    const bw = Math.min(W * 0.7, 360), bx = (W - bw) / 2, by = 92;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(bx - 2, by - 2, bw + 4, 14);
    ctx.fillStyle = '#ff2d55';
    ctx.fillRect(bx, by, bw * (bo.hp / bo.max), 10);
    ctx.fillStyle = '#fff';
    ctx.font = 'italic 900 13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${bo.name}  ·  ${Math.ceil(bo.escapeT)}s`, W / 2, by + 28);
  }

  fx.drawBanners(ctx, W, H);

  if (G.debug) {
    fpsAcc += dt; fpsFrames++;
    if (fpsAcc > 0.5) { fps = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; }
    ctx.fillStyle = '#0f0';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${fps} fps · obj ${r ? r.objects.length : 0}`, 8, H - 8);
  }
}
