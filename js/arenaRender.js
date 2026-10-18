// ARENA: dibujo cenital. Rejilla neón infinita, enemigos con sprites de brillo precalculados
// (dibujar cientos con shadowBlur hundiría los fps), la nave equipada vista desde arriba y efectos.
import { G } from './state.js';
import { save } from './save.js';
import { fx } from './fx.js';
import { getCtx } from './render.js';
import { drawShip } from './shipdraw.js';
import { equipped, emblemOpts, DEFAULT_SHOT } from './cosmetics.js';
import { trailFx, auraFx } from './cosfx.js';
import { zoomOf, maxHp, lavaScale, holePos } from './arena.js';

// ---------- Sprites ----------
const sprites = new Map();
function shapePath(c, shape, r) {
  c.beginPath();
  switch (shape) {
    case 'tri': c.moveTo(r, 0); c.lineTo(-r * 0.8, r * 0.75); c.lineTo(-r * 0.8, -r * 0.75); break;
    case 'dart': c.moveTo(r, 0); c.lineTo(-r, r * 0.6); c.lineTo(-r * 0.4, 0); c.lineTo(-r, -r * 0.6); break;
    case 'arrow': c.moveTo(r, 0); c.lineTo(0, r); c.lineTo(-r * 0.6, r * 0.4); c.lineTo(-r * 0.6, -r * 0.4); c.lineTo(0, -r); break;
    case 'eye': c.ellipse(0, 0, r, r * 0.65, 0, 0, Math.PI * 2); break;
    case 'hex': for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } break;
    case 'square': c.rect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5); break;
    case 'boss': for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, k = i % 2 ? 0.72 : 1; c.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k); } break;
    // jefes de la arena
    case 'colossus': for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.moveTo(r * 1.15, 0); c.lineTo(r * 0.7, r * 0.3); c.lineTo(r * 0.7, -r * 0.3); break;
    case 'hive': for (const [hx, hy] of [[0, 0], [0.55, 0.32], [-0.55, 0.32], [0, -0.64], [0.55, -0.32], [-0.55, -0.32], [0, 0.64]]) { c.moveTo(hx * r + r * 0.34, hy * r); for (let i = 1; i <= 6; i++) { const a = (i / 6) * Math.PI * 2; c.lineTo(hx * r + Math.cos(a) * r * 0.34, hy * r + Math.sin(a) * r * 0.34); } } break;
    case 'weaver': for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, k = i % 2 ? 0.35 : 1; c.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k); } break;
    case 'core': c.arc(0, 0, r, 0, Math.PI * 2); c.moveTo(r * 0.6, 0); c.arc(0, 0, r * 0.6, 0, Math.PI * 2, true); break;
    case 'maw': c.arc(0, 0, r, 0.55, Math.PI * 2 - 0.55); c.lineTo(r * 0.15, 0); break;
    default: c.arc(0, 0, r, 0, Math.PI * 2);
  }
  c.closePath();
}
// sprite con brillo, una vez por (forma, color, tamaño)
function sprite(shape, color, r) {
  const k = `${shape}|${color}|${Math.round(r)}`;
  let s = sprites.get(k);
  if (s) return s;
  const pad = r * 0.9 + 8, size = Math.ceil((r + pad) * 2);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d');
  c.translate(size / 2, size / 2);
  c.shadowColor = color;
  c.shadowBlur = r * 0.8 + 6;
  shapePath(c, shape, r);
  c.fillStyle = 'rgba(10,4,24,.9)';
  c.fill();
  c.lineWidth = Math.max(2, r * 0.16);
  c.strokeStyle = color;
  c.stroke();
  c.shadowBlur = 0;
  shapePath(c, shape, r * 0.45);
  c.fillStyle = color;
  c.globalAlpha = 0.55;
  c.fill();
  s = { cv, size };
  sprites.set(k, s);
  return s;
}

// ---------- Dibujo ----------
let fpsAcc = 0, fpsFrames = 0, fps = 0;
export function renderArena(dt) {
  const ctx = getCtx();
  const a = G.arena;
  if (!ctx || !a) return;
  const W = G.W, H = G.H, z = zoomOf();
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  const M = a.M;
  ctx.fillStyle = M.bg;
  ctx.fillRect(0, 0, W, H);

  const shk = a.shake + fx.shakeAmt;
  const ox = shk ? (Math.random() - 0.5) * shk : 0, oy = shk ? (Math.random() - 0.5) * shk : 0;
  // mundo -> pantalla
  const sx = (x) => W / 2 + (x - a.x) * z + ox;
  const sy = (y) => H / 2 + (y - a.y) * z + oy;

  // rejilla neón que se desplaza con la cámara
  const step = 80 * z;
  const gx = ((-a.x * z) % step + step) % step, gy = ((-a.y * z) % step + step) % step;
  ctx.lineWidth = 1;
  ctx.strokeStyle = M.grid;
  ctx.beginPath();
  for (let x = gx + (W / 2) % step - step; x < W + step; x += step) { ctx.moveTo(x + ox, 0); ctx.lineTo(x + ox, H); }
  for (let y = gy + (H / 2) % step - step; y < H + step; y += step) { ctx.moveTo(0, y + oy); ctx.lineTo(W, y + oy); }
  ctx.stroke();
  // halo bajo la nave
  const halo = ctx.createRadialGradient(sx(a.x), sy(a.y), 0, sx(a.x), sy(a.y), 260 * z);
  halo.addColorStop(0, 'rgba(0,229,255,0.10)');
  halo.addColorStop(1, 'rgba(0,229,255,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  const onScreen = (x, y, r) => sx(x) > -r && sx(x) < W + r && sy(y) > -r && sy(y) < H + r;

  // MAPA: lava (repetida en mosaico), agujeros negros, rocas y el borde de los mapas cerrados
  if (a.feat.pools.length) {
    const T = M.tile, L = lavaScale(a), vr = Math.hypot(W, H) / 2 / z + 140;
    for (let tx = Math.floor((a.x - vr) / T); tx <= Math.floor((a.x + vr) / T); tx++) {
      for (let ty = Math.floor((a.y - vr) / T); ty <= Math.floor((a.y + vr) / T); ty++) {
        for (const p of a.feat.pools) {
          const x = p.x + tx * T, y = p.y + ty * T, r = p.r * L.k;
          if (!onScreen(x, y, r * z)) continue;
          const g = ctx.createRadialGradient(sx(x), sy(y), 0, sx(x), sy(y), r * z);
          g.addColorStop(0, L.k > 1 ? 'rgba(255,230,120,.85)' : 'rgba(255,150,30,.7)');
          g.addColorStop(0.7, 'rgba(255,60,0,.4)');
          g.addColorStop(1, 'rgba(255,40,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(sx(x), sy(y), r * z, 0, Math.PI * 2);
          ctx.fill();
          // borde claro: se ve de un vistazo dónde quema
          ctx.strokeStyle = L.k > 1 ? 'rgba(255,230,120,.9)' : 'rgba(255,106,0,.75)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(sx(x), sy(y), r * z * 0.92, 0, Math.PI * 2);
          ctx.stroke();
          if (L.warn) {
            ctx.strokeStyle = `rgba(255,214,10,${0.4 + 0.4 * Math.sin(G.realTime * 18)})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sx(x), sy(y), p.r * 1.6 * z, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    }
  }
  for (const h of a.feat.holes) {
    const c = holePos(a, h), x = sx(c.x), y = sy(c.y);
    if (!onScreen(c.x, c.y, 600 * z)) continue;
    const g = ctx.createRadialGradient(x, y, h.r * z * 0.6, x, y, 300 * z);
    g.addColorStop(0, 'rgba(191,90,242,.35)');
    g.addColorStop(1, 'rgba(191,90,242,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, 300 * z, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(x, y, h.r * z, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#bf5af2';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x, y, h.r * z * (1.3 + i * 0.5), G.realTime * (2 - i * 0.5) + i, G.realTime * (2 - i * 0.5) + i + 2.2);
      ctx.stroke();
    }
  }
  for (const k of a.feat.rocks) {
    if (!onScreen(k.x, k.y, k.r * z)) continue;
    const x = sx(k.x), y = sy(k.y), r = k.r * z;
    ctx.fillStyle = '#1c2230';
    ctx.strokeStyle = 'rgba(125,249,255,.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * Math.PI * 2, kk = 0.82 + 0.18 * Math.sin(i * 2.7 + k.r);
      ctx.lineTo(x + Math.cos(ang) * r * kk, y + Math.sin(ang) * r * kk);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  if (M.radius) {
    ctx.save();
    ctx.strokeStyle = M.grid.replace(/[\d.]+\)$/, '0.8)');
    ctx.lineWidth = 6;
    ctx.setLineDash([24, 14]);
    ctx.beginPath();
    ctx.arc(sx(0), sy(0), M.radius * z, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // anillo del jefe: pared de energía que no deja salir
  if (a.ring) {
    ctx.save();
    ctx.strokeStyle = a.ring.color;
    ctx.shadowColor = a.ring.color;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 4 + Math.sin(G.realTime * 8) * 1.5;
    ctx.setLineDash([18, 10]);
    ctx.lineDashOffset = -G.realTime * 60;
    ctx.beginPath();
    ctx.arc(sx(a.ring.x), sy(a.ring.y), a.ring.r * z, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ondas (pulso, estallido, explosiones)
  for (const r of a.rings) {
    const k = 1 - r.t / r.max;
    ctx.strokeStyle = r.color;
    ctx.globalAlpha = Math.max(0, r.t / r.max);
    ctx.lineWidth = 6 * (1 - k) + 1;
    ctx.beginPath();
    ctx.arc(sx(r.x), sy(r.y), r.r * z * (0.4 + 0.6 * k), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // gemas de XP y cofres
  ctx.fillStyle = '#7df9ff';
  for (const g of a.gems) {
    if (!onScreen(g.x, g.y, 10)) continue;
    const s = (g.v >= 5 ? 7 : 4.5) * z;
    const x = sx(g.x), y = sy(g.y);
    ctx.beginPath();
    ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.7, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.7, y);
    ctx.fill();
  }
  for (const c of a.chests) {
    const x = sx(c.x), y = sy(c.y);
    ctx.font = `${Math.round(26 * z)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎁', x, y + Math.sin(G.realTime * 5) * 3);
  }

  // balas enemigas: rojo intenso, siempre distinguibles de tus disparos
  ctx.fillStyle = '#ff2d55';
  for (const b of a.ebullets) {
    if (!onScreen(b.x, b.y, 10)) continue;
    ctx.beginPath();
    ctx.arc(sx(b.x), sy(b.y), b.r * z, 0, Math.PI * 2);
    ctx.fill();
    if (b.mine) { // mina: parpadea
      ctx.strokeStyle = `rgba(255,214,10,${0.5 + 0.5 * Math.sin(G.realTime * 12)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx(b.x), sy(b.y), b.r * z * 1.8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // enemigos
  let boss = null;
  for (const e of a.enemies) {
    if (e.boss) boss = e;
    const R = e.r * z;
    if (!onScreen(e.x, e.y, R * 2)) continue;
    const sp = sprite(e.def.shape, e.def.color, e.r);
    const ang = Math.atan2(a.y - e.y, a.x - e.x);
    const x = sx(e.x), y = sy(e.y), d = sp.size * z;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(e.boss ? G.realTime * 0.6 : ang);
    if (e.state === 'aim') ctx.globalAlpha = 0.6 + 0.4 * Math.sin(G.realTime * 40);
    ctx.drawImage(sp.cv, -d / 2, -d / 2, d, d);
    ctx.restore();
    if (e.flash > 0) {
      ctx.fillStyle = e.crit > 0 ? 'rgba(255,230,0,0.85)' : 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(x, y, R * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    if (e.elite) {
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, R * 1.35, 0, Math.PI * 2);
      ctx.stroke();
    }
    // el embestidor avisa con una línea hacia donde va a cargar
    if (e.state === 'aim') {
      ctx.strokeStyle = 'rgba(255,106,0,.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + e.dx * 260 * z, y + e.dy * 260 * z);
      ctx.stroke();
    }
  }

  // jefe: láseres de la Tejedora y escudo de la Colmena
  if (boss?.nLasers) {
    for (let i = 0; i < boss.nLasers; i++) {
      const ang = boss.spin + (i / boss.nLasers) * Math.PI * 2;
      ctx.strokeStyle = boss.lasersOn ? 'rgba(0,229,255,.85)' : 'rgba(0,229,255,.25)';
      ctx.lineWidth = (boss.lasersOn ? 14 : 3) * z;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx(boss.x), sy(boss.y));
      ctx.lineTo(sx(boss.x + Math.cos(ang) * 560), sy(boss.y + Math.sin(ang) * 560));
      ctx.stroke();
    }
  }
  if (boss?.shield) {
    ctx.strokeStyle = 'rgba(255,204,0,.8)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx(boss.x), sy(boss.y), boss.r * z * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // tus disparos
  ctx.globalCompositeOperation = 'lighter';
  const shotCol = equipped(save, save.ship).shot.color || DEFAULT_SHOT;
  for (const b of a.bullets) {
    if (!onScreen(b.x, b.y, 12)) continue;
    const col = b.kind === 'missile' || b.kind === 'mine' ? '#ff9f0a' : b.kind === 'pellet' ? '#ffe600' : b.kind === 'boomer' ? '#7dffb0' : b.kind === 'saw' ? '#c8d6e5' : b.kind === 'drone' ? '#64d2ff' : shotCol;
    ctx.fillStyle = col;
    if (b.kind === 'saw') {
      // sierra: rueda dentada que gira
      ctx.save();
      ctx.translate(sx(b.x), sy(b.y));
      ctx.rotate(b.spin);
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2, k = i % 2 ? 0.7 : 1;
        ctx.lineTo(Math.cos(ang) * b.r * z * k, Math.sin(ang) * b.r * z * k);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      continue;
    }
    ctx.beginPath();
    ctx.arc(sx(b.x), sy(b.y), b.r * z, 0, Math.PI * 2);
    ctx.fill();
    if (b.kind === 'missile') {
      ctx.strokeStyle = 'rgba(255,159,10,.5)';
      ctx.lineWidth = 3 * z;
      ctx.beginPath();
      ctx.moveTo(sx(b.x), sy(b.y));
      ctx.lineTo(sx(b.x - b.vx * 0.05), sy(b.y - b.vy * 0.05));
      ctx.stroke();
    }
  }
  for (const b of a.beams) {
    ctx.strokeStyle = `rgba(125,249,255,${(b.t / 0.15).toFixed(2)})`;
    ctx.lineWidth = b.w * 2 * z;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx(b.x), sy(b.y));
    ctx.lineTo(sx(b.x + Math.cos(b.ang) * b.len), sy(b.y + Math.sin(b.ang) * b.len));
    ctx.stroke();
  }
  if (a.flames) {
    for (const d of a.flames.dirs) {
      const g = ctx.createRadialGradient(sx(a.x), sy(a.y), 0, sx(a.x), sy(a.y), a.flames.range * z);
      g.addColorStop(0, 'rgba(255,200,40,.55)');
      g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sx(a.x), sy(a.y));
      ctx.arc(sx(a.x), sy(a.y), a.flames.range * z, d - 0.45, d + 0.45);
      ctx.closePath();
      ctx.fill();
    }
  }
  // ARCO: rayos quebrados entre enemigos
  if (a.arcs.length) {
    ctx.strokeStyle = 'rgba(180,240,255,.95)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (const r of a.arcs) {
      const x1 = sx(r.x1), y1 = sy(r.y1), x2 = sx(r.x2), y2 = sy(r.y2);
      ctx.moveTo(x1, y1);
      for (let k = 1; k < 4; k++) ctx.lineTo(x1 + (x2 - x1) * (k / 4) + (Math.random() - 0.5) * 14, y1 + (y2 - y1) * (k / 4) + (Math.random() - 0.5) * 14);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
  }
  // MORTERO: el proyectil en el aire y la diana donde caerá
  for (const sh of a.shells) {
    const k = sh.t / sh.max, x = sx(sh.x0 + (sh.x - sh.x0) * k), y = sy(sh.y0 + (sh.y - sh.y0) * k) - Math.sin(k * Math.PI) * 90 * z;
    ctx.strokeStyle = 'rgba(255,159,10,.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx(sh.x), sy(sh.y), sh.r * z * (1 - k * 0.3), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ff9f0a';
    ctx.beginPath();
    ctx.arc(x, y, 7 * z, 0, Math.PI * 2);
    ctx.fill();
  }
  // DRONES
  if (a.drones) {
    ctx.fillStyle = '#64d2ff';
    for (const d of a.drones) {
      ctx.beginPath();
      ctx.moveTo(sx(d.x), sy(d.y) - 8 * z);
      ctx.lineTo(sx(d.x) + 7 * z, sy(d.y) + 6 * z);
      ctx.lineTo(sx(d.x) - 7 * z, sy(d.y) + 6 * z);
      ctx.fill();
    }
  }
  if (a.orbs) {
    ctx.fillStyle = '#bf5af2';
    for (const o of a.orbs) {
      ctx.beginPath();
      ctx.arc(sx(o.x), sy(o.y), 9 * z, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';

  // la nave: la equipada, vista desde arriba, con su pintura, emblema y estela
  if (!(a.over && !a.won)) {
    const eq = equipped(save, save.ship);
    const pal = eq.palette;
    const x = sx(a.x), y = sy(a.y);
    trailFx(fx, ctx, eq.trail.id, x - Math.cos(a.face) * 14 * z, y - Math.sin(a.face) * 14 * z, 40 * z, pal.glow, 40, G.realTime);
    auraFx(ctx, eq.aura.id, x, y, 36 * z, G.realTime);
    const blink = a.iframes > 0 && Math.floor(G.realTime * 20) % 2 === 0;
    ctx.globalAlpha = a.phaseT > 0 ? 0.4 : blink ? 0.45 : 1;
    drawShip(ctx, a.ship.id, { ...pal, edge: a.ramT > 0 ? '#ff9f0a' : pal.edge || a.ship.color }, x, y, 30 * z,
      { pitch: -Math.PI / 2, yaw: a.face + Math.PI / 2 }, { line: 1.5, ...emblemOpts(eq) });
    ctx.globalAlpha = 1;
    if (a.ramT > 0 || a.dashT > 0) {
      ctx.strokeStyle = a.ramT > 0 ? 'rgba(255,159,10,.7)' : 'rgba(125,249,255,.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 26 * z, 0, Math.PI * 2);
      ctx.stroke();
    }
    // vida bajo la nave
    const k = Math.max(0, a.hp / maxHp(a));
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(x - 22, y + 26 * z, 44, 5);
    ctx.fillStyle = k > 0.35 ? '#30d158' : '#ff2d55';
    ctx.fillRect(x - 22, y + 26 * z, 44 * k, 5);
  }

  // cámara lenta de la SOBRECARGA: tinte azul
  if (a.slowT > 0) {
    ctx.fillStyle = 'rgba(0,229,255,0.07)';
    ctx.fillRect(0, 0, W, H);
  }

  // jefe: barra arriba y flecha si está fuera de pantalla
  if (boss) {
    const bw = Math.min(W * 0.7, 360), bx = (W - bw) / 2, by = 64;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(bx - 2, by - 2, bw + 4, 14);
    ctx.fillStyle = boss.def.color;
    ctx.fillRect(bx, by, bw * Math.max(0, boss.hp / boss.max), 10);
    ctx.fillStyle = '#fff';
    ctx.font = 'italic 900 13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${boss.name}${boss.p2 ? ' · FASE 2' : ''}${boss.shield ? ' · 🛡️' : ''}`, W / 2, by + 28);
    const x = sx(boss.x), y = sy(boss.y);
    if (x < 0 || x > W || y < 0 || y > H) {
      const ang = Math.atan2(y - H / 2, x - W / 2);
      const ex = W / 2 + Math.cos(ang) * (Math.min(W, H) / 2 - 30), ey = H / 2 + Math.sin(ang) * (Math.min(W, H) / 2 - 30);
      ctx.fillStyle = boss.def.color;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(-8, 9); ctx.lineTo(-8, -9);
      ctx.fill();
      ctx.restore();
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
    ctx.fillText(`${fps} fps · enemigos ${a.enemies.length} · balas ${a.bullets.length}`, 8, H - 8);
  }
}
