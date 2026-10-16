// Render pseudo-3D en Canvas 2D: escala = focal / profundidad (como los arcades clásicos).
import { G, LANE_W, VIEW, clamp } from './state.js';
import { fx } from './fx.js';
import { BIOMES, FORK_REWARDS, bossRz } from './world.js';
import { SHIPS } from './upgrades.js';
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

function drawObj(o, rz, b, t) {
  const fog = clamp((VIEW - rz) / 25, 0, 1);
  ctx.globalAlpha = fog;
  switch (o.type) {
    case 'wall':
    case 'mover': {
      let x = o.x;
      if (o.gate) x += Math.sign(o.x || 1) * clamp((rz - 10) / 25, 0, 1) * 1.6;
      const f = neonBox(x, o.y0, o.y1, rz, o.w, o.depth, b.obs);
      if (f) {
        ctx.strokeStyle = hexA(b.obs, 0.6);
        ctx.lineWidth = Math.max(1, f.s * 0.025);
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
      const f = neonBox(o.x, o.y0, o.y1, rz, o.w, o.depth, b.obs2, 0.6);
      if (f) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(f.x, f.y, f.w, f.h);
        ctx.clip();
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        const st = Math.max(6, f.h * 0.7);
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
      break;
    }
    case 'overhead': {
      const f = neonBox(o.x, o.y0, o.y0 + 0.4, rz, o.w, o.depth, b.obs2, 0.5);
      if (f) {
        const top = project(o.x, 3, rz);
        ctx.strokeStyle = hexA(b.obs2, 0.7);
        ctx.lineWidth = Math.max(1, f.s * 0.03);
        ctx.beginPath();
        ctx.moveTo(f.x + f.w * 0.15, f.y); ctx.lineTo(f.x + f.w * 0.15, top.y);
        ctx.moveTo(f.x + f.w * 0.85, f.y); ctx.lineTo(f.x + f.w * 0.85, top.y);
        ctx.stroke();
      }
      break;
    }
    case 'laserLow':
    case 'laserHigh': {
      const ys = o.type === 'laserLow' ? [0.2] : [0.6, 0.95, 1.3];
      const flick = 0.75 + Math.random() * 0.25;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const y of ys) {
        const a = project(-1.6, y, rz), c = project(1.6, y, rz);
        if (!a || !c) continue;
        ctx.globalAlpha = fog * flick;
        ctx.strokeStyle = hexA(b.obs, 0.35);
        ctx.lineWidth = Math.max(4, a.s * 0.16);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = Math.max(1.5, a.s * 0.04);
        ctx.stroke();
      }
      ctx.restore();
      for (const ex of [-1.6, 1.6]) neonBox(ex, 0, ys[ys.length - 1] + 0.25, rz, 0.15, 0.15, b.obs, 0.8);
      break;
    }
    case 'mine': {
      const p = project(o.x, 0.2, rz);
      if (!p) break;
      const R = 0.22 * p.s;
      const pulse = 0.5 + 0.5 * Math.sin(t * 12 + o.z);
      ctx.fillStyle = '#220';
      ctx.strokeStyle = b.obs;
      ctx.lineWidth = Math.max(1, R * 0.15);
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + t * 2;
        const rr = i % 2 ? R : R * 1.45;
        ctx.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = `rgba(255,40,40,${0.5 + pulse * 0.5})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R * 0.45, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'shot': {
      const p = project(o.x, o.tall ? 0.65 : 0.25, rz);
      if (!p) break;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const R = 0.3 * p.s;
      ctx.fillStyle = 'rgba(255,120,0,.35)';
      ctx.beginPath();
      if (o.tall) ctx.ellipse(p.x, p.y, R * 1.3, R * 2.6, 0, 0, Math.PI * 2);
      else ctx.arc(p.x, p.y, R * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd60a';
      ctx.beginPath();
      if (o.tall) ctx.ellipse(p.x, p.y, R * 0.7, R * 1.9, 0, 0, Math.PI * 2);
      else ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'core': {
      const p = project(o.x, 0.6, rz);
      if (!p) break;
      const R = 0.42 * p.s * (1 + 0.12 * Math.sin(t * 14));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,45,85,.35)';
      ctx.beginPath(); ctx.arc(p.x, p.y, R * 1.7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff2d55';
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(p.x, p.y, R * 0.45, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = `italic 900 ${Math.max(10, Math.round(R * 0.9))}px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillText('DASH!', p.x, p.y - R * 1.9);
      break;
    }
    case 'coin': {
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

function drawBoss(b, t) {
  const r = G.run, bo = r.boss;
  const rz = bossRz();
  const p = project(bo.x, 3.4, rz);
  if (!p) return;
  const S = 4.2 * p.s * (bo.dying ? 1 + (2 - bo.dying) * 0.3 : 1);
  ctx.save();
  ctx.translate(p.x, p.y + Math.sin(t * 3) * S * 0.1);
  // tentáculos
  ctx.strokeStyle = b.obs;
  ctx.lineWidth = Math.max(2, S * 0.08);
  for (let i = 0; i < 6; i++) {
    const a = (i / 5 - 0.5) * 1.6;
    ctx.beginPath();
    ctx.moveTo(Math.sin(a) * S * 0.5, S * 0.3);
    for (let k = 1; k <= 6; k++) {
      ctx.lineTo(Math.sin(a) * S * (0.5 + k * 0.12) + Math.sin(t * 5 + k + i) * S * 0.08, S * (0.3 + k * 0.17));
    }
    ctx.stroke();
  }
  // cuerpo
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    ctx.lineTo(Math.cos(a) * S * 0.65, Math.sin(a) * S * 0.55);
  }
  ctx.closePath();
  ctx.fillStyle = bo.flash > 0 ? `rgba(255,255,255,${0.4 + bo.flash * 0.6})` : 'rgba(10,0,20,.9)';
  ctx.fill();
  ctx.lineWidth = Math.max(2, S * 0.06);
  ctx.strokeStyle = b.obs;
  ctx.stroke();
  // ojo que mira al jugador
  const ex = clamp((G.player.x - bo.x) * 0.12, -0.15, 0.15) * S;
  ctx.fillStyle = '#ff2d55';
  ctx.beginPath(); ctx.ellipse(0, 0, S * 0.28, S * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(ex, S * 0.03, S * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function shipColor() {
  const r = G.run;
  if (r && r.odTime > 0) return `hsl(${(G.realTime * 600) % 360},100%,60%)`;
  return (SHIPS.find((s) => s.id === save.ship) || SHIPS[0]).color;
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

  const drawShape = (ox, oy, alpha, c) => {
    ctx.globalAlpha = alpha;
    const x = sp.x + ox, y = sp.y + oy;
    const bank = tilt * 0.12 * s;
    ctx.beginPath();
    ctx.moveTo(x + tilt * 0.12 * s, y - 0.5 * s * sq);
    ctx.lineTo(x + 0.42 * s, y + 0.1 * s * sq - bank);
    ctx.lineTo(x + 0.12 * s, y + 0.04 * s * sq);
    ctx.lineTo(x, y + 0.12 * s * sq);
    ctx.lineTo(x - 0.12 * s, y + 0.04 * s * sq);
    ctx.lineTo(x - 0.42 * s, y + 0.1 * s * sq + bank);
    ctx.closePath();
    ctx.fillStyle = 'rgba(5,5,20,.92)';
    ctx.fill();
    ctx.lineWidth = Math.max(2, s * 0.035);
    ctx.strokeStyle = c;
    ctx.stroke();
  };

  if (p && p.dash > 0) {
    for (let i = 3; i >= 1; i--) drawShape(0, i * s * 0.12, 0.25 / i, '#9ff');
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
  if (!blink) drawShape(0, 0, 1, col);
  ctx.globalAlpha = 1;

  if (r && r.shields > 0) {
    ctx.strokeStyle = 'rgba(48,209,88,.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y - 0.15 * s, s * 0.55, s * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (r && (G.mode === 'play')) {
    fx.spark(sp.x + (Math.random() - 0.5) * s * 0.15, sp.y + 0.15 * s, (Math.random() - 0.5) * 40, 200 + r.speed * 4, r.odTime > 0 ? col : '#ff9a3c', s * 0.05, 0.25);
  }
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

  drawSky(b, t);
  drawGround(b, dist, t);
  drawSpeedLines(b, speed, dt);
  if (r && r.boss) drawBoss(b, t);

  if (r) {
    const list = [];
    for (const o of r.objects) {
      if (!o.alive) continue;
      const rz = o.z - r.dist;
      if (rz > VIEW || rz < NEAR + 0.5) continue;
      list.push([rz, o]);
    }
    list.sort((a, c) => c[0] - a[0]);
    let drewPlayer = false;
    for (const [rz, o] of list) {
      if (!drewPlayer && rz < -0.2) { drawPlayer(); drewPlayer = true; }
      drawObj(o, rz, b, t);
    }
    if (!drewPlayer) drawPlayer();
  } else {
    drawPlayer();
  }

  fx.draw(ctx);
  ctx.restore();

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
