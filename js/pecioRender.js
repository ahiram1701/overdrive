// PECIOS: dibujo de la sala (casillas, enemigos con su intención, tu nave), destellos y minimapa.
import { G } from './state.js';
import { save } from './save.js';
import { fx } from './fx.js';
import { getCtx } from './render.js';
import { drawShip } from './shipdraw.js';
import { equipped, emblemOpts } from './cosmetics.js';
import { sprite } from './arenaRender.js';
import { COLS, ROWS, DIRS, ENEMY, ROOM_TYPES, roomOf, locked, chargeLine } from './pecio.js';
import { pecioLayout } from './pecioGame.js';

const YAW = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };

export function renderPecio(dt) {
  const ctx = getCtx(), s = G.pecio;
  if (!ctx || !s) return;
  const W = G.W, H = G.H, th = s.floor.theme, room = roomOf(s);
  const { T, ox, oy } = pecioLayout(W, H);
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  ctx.fillStyle = '#05030b';
  ctx.fillRect(0, 0, W, H);
  const shk = fx.shakeAmt, jx = shk ? (Math.random() - 0.5) * shk : 0, jy = shk ? (Math.random() - 0.5) * shk : 0;
  const X = (c) => ox + c * T + jx, Y = (r) => oy + r * T + jy;
  const t = G.realTime;
  const shut = locked(room);

  // CASILLAS
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const k = room.tiles[r][c], x = X(c), y = Y(r);
      if (k === '#') {
        ctx.fillStyle = '#0d0a18';
        ctx.fillRect(x, y, T, T);
        ctx.strokeStyle = th.wall;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 2, y + 2, T - 4, T - 4);
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.fillStyle = (r + c) % 2 ? th.floor : shade(th.floor, 8);
      ctx.fillRect(x, y, T, T);
      if (k === 'P') { // pozo
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(x + T / 2, y + T / 2, T * 0.42, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.stroke();
      } else if (k === 'M') { // mina
        ctx.fillStyle = Math.floor(t * 3) % 2 ? '#ff2d55' : '#7a0018';
        ctx.beginPath(); ctx.arc(x + T / 2, y + T / 2, T * 0.17, 0, Math.PI * 2); ctx.fill();
      } else if (k === 'E') { // suelo eléctrico
        ctx.strokeStyle = `rgba(255,230,0,${0.35 + 0.3 * Math.sin(t * 8 + c + r)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) { ctx.moveTo(x + 4, y + 6 + i * (T - 12) / 3); ctx.lineTo(x + T - 4, y + 6 + i * (T - 12) / 3); }
        ctx.stroke();
      } else if (k === 'D') { // puerta: verde abierta, roja cerrada
        ctx.fillStyle = shut ? 'rgba(255,45,85,.55)' : 'rgba(48,209,88,.45)';
        ctx.fillRect(x + 3, y + 3, T - 6, T - 6);
        glyph(ctx, shut ? '🔒' : '🚪', x + T / 2, y + T / 2, T * 0.5);
      } else if (k === 'C') glyph(ctx, room.opened ? '📭' : '🎁', x + T / 2, y + T / 2, T * 0.62);
      else if (k === 'T') glyph(ctx, '🛒', x + T / 2, y + T / 2, T * 0.62);
      else if (k === 'A') glyph(ctx, room.used ? '🕯️' : '✨', x + T / 2, y + T / 2, T * 0.62);
      else if (k === 'X') { // escotilla: bajar
        ctx.strokeStyle = th.accent;
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 5, y + 5, T - 10, T - 10);
        glyph(ctx, '⬇️', x + T / 2, y + T / 2, T * 0.5);
      }
    }
  }

  // INTENCIÓN de las torretas: la línea que van a barrer (roja), antes de disparar
  for (const e of room.enemies) {
    if (!e.alive || !e.charge) continue;
    ctx.fillStyle = `rgba(255,45,85,${0.25 + 0.2 * Math.sin(t * 14)})`;
    for (const [c, r] of chargeLine(room, e)) ctx.fillRect(X(c) + 2, Y(r) + 2, T - 4, T - 4);
  }
  // APUNTAR: tus 4 líneas de tiro
  if (s.aim) {
    ctx.fillStyle = 'rgba(125,249,255,.14)';
    for (const k of Object.keys(DIRS)) {
      let c = s.player.x, r = s.player.y;
      for (;;) {
        c += DIRS[k].dx; r += DIRS[k].dy;
        const tile = room.tiles[r]?.[c];
        if (!tile || tile === '#' || tile === 'D') break;
        ctx.fillRect(X(c) + 3, Y(r) + 3, T - 6, T - 6);
      }
    }
  }

  // ENEMIGOS (con su intención: flecha, cuenta atrás o escudo)
  for (const e of room.enemies) {
    if (!e.alive) continue;
    const E = ENEMY[e.kind], cx = X(e.x) + T / 2, cy = Y(e.y) + T / 2;
    const sp = sprite(E.shape, E.color, 16), d = (sp.cv.width * T * 0.34) / 16; // el lienzo incluye el halo: la figura ocupa ~2/3 de la casilla
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(YAW[e.facing] - Math.PI / 2);
    if (e.stun) ctx.globalAlpha = 0.5;
    ctx.drawImage(sp.cv, -d / 2, -d / 2, d, d);
    ctx.restore();
    // escudo: barra en su lado de frente
    if (e.kind === 'shield') {
      const f = DIRS[e.facing];
      ctx.strokeStyle = '#7dffb0';
      ctx.lineWidth = 4;
      ctx.beginPath();
      if (f.dx) { ctx.moveTo(cx + f.dx * T * 0.42, cy - T * 0.32); ctx.lineTo(cx + f.dx * T * 0.42, cy + T * 0.32); } else { ctx.moveTo(cx - T * 0.32, cy + f.dy * T * 0.42); ctx.lineTo(cx + T * 0.32, cy + f.dy * T * 0.42); }
      ctx.stroke();
    }
    if (e.kind === 'bomb' && e.fuse !== null) glyph(ctx, e.fuse > 1 ? '2️⃣' : '1️⃣', cx + T * 0.3, cy - T * 0.32, T * 0.38);
    if (e.kind === 'turret' && e.charge) glyph(ctx, '❗', cx, cy - T * 0.42, T * 0.36);
    if (e.stun) glyph(ctx, '💫', cx, cy - T * 0.4, T * 0.3);
    // vida
    for (let i = 0; i < e.max; i++) {
      ctx.fillStyle = i < e.hp ? '#ff2d55' : 'rgba(255,255,255,.18)';
      ctx.fillRect(cx - (e.max * 5) / 2 + i * 5, cy + T * 0.36, 4, 3);
    }
  }

  // TU NAVE (desliza de la casilla anterior a la nueva)
  const p = s.player, k = s.moveT > 0 && s.from ? s.moveT / 0.12 : 0;
  const px = X((s.from ? s.from.x : p.x) * k + p.x * (1 - k)) + T / 2, py = Y((s.from ? s.from.y : p.y) * k + p.y * (1 - k)) + T / 2;
  if (G.mode !== 'pecioEnd' || s.won) {
    const lk = equipped(save, save.ship), pal = lk.palette;
    if (p.shield > 0 || p.inv > 0) {
      ctx.strokeStyle = 'rgba(125,249,255,.7)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(px, py, T * 0.48, 0, Math.PI * 2); ctx.stroke();
    }
    drawShip(ctx, save.ship, { ...pal, edge: pal.edge || s.ship.color }, px, py, T * 0.78, { pitch: -Math.PI / 2, yaw: YAW[p.facing] }, { line: 1.3, ...emblemOpts(lk) });
  }

  // DESTELLOS: tus disparos (cian), los suyos (rojo), explosiones
  ctx.globalCompositeOperation = 'lighter';
  for (const f of s.flashes) {
    const a = Math.max(0, f.t / f.max);
    if (f.kind === 'shot' || f.kind === 'eshot') {
      if (!f.path.length) continue;
      ctx.strokeStyle = f.kind === 'shot' ? `rgba(125,249,255,${a})` : `rgba(255,45,85,${a})`;
      ctx.lineWidth = T * 0.16;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const [c0, r0] = f.path[0], [c1, r1] = f.path[f.path.length - 1];
      ctx.moveTo(X(c0) + T / 2, Y(r0) + T / 2);
      ctx.lineTo(X(c1) + T / 2, Y(r1) + T / 2);
      ctx.stroke();
    } else if (f.kind === 'boom') {
      ctx.strokeStyle = `rgba(255,159,10,${a})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(X(f.x) + T / 2, Y(f.y) + T / 2, T * (0.4 + f.r + (1 - a) * 0.5), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';

  minimap(ctx, s, W);
  fx.draw(ctx);
  fx.drawTexts(ctx, 0);
  fx.drawBanners(ctx, W, H);
  void dt;
}

// MINIMAPA: salas vistas (con su icono), las conocidas por una puerta y dónde estás
function minimap(ctx, s, W) {
  const cell = 15, gap = 3, size = 5 * (cell + gap), x0 = W - size - 12, y0 = 64;
  const rooms = s.floor.rooms;
  const known = new Set(s.visited);
  for (const id of s.visited) for (const n of Object.values(rooms[id].doors)) known.add(n);
  for (const id of known) {
    const r = rooms[id], x = x0 + r.x * (cell + gap), y = y0 + r.y * (cell + gap), seen = s.visited.includes(id);
    ctx.fillStyle = id === s.at ? s.floor.theme.accent : seen ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.08)';
    ctx.fillRect(x, y, cell, cell);
    if (seen && r.type !== 'combat' && r.type !== 'start') glyph(ctx, ROOM_TYPES[r.type].icon, x + cell / 2, y + cell / 2, cell * 0.75);
  }
}

function glyph(ctx, ch, x, y, size) {
  ctx.font = `${Math.round(size)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, x, y);
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt)).toString(16).padStart(2, '0');
  return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
}
