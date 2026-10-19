// PECIOS en 3D: la sala con la cámara detrás de tu nave. Motor propio (como la Galaxia): polígonos del
// mundo → espacio de cámara → recorte contra el plano cercano → proyección → orden del pintor (de lejos a
// cerca). Solo se dibuja la sala en la que estás, así el coste está acotado.
// Mundo: X = columna, Z = −fila (la fila 0 queda "delante" con el ángulo 0), Y = altura. 1 casilla = 1.
import { G } from './state.js';
import { save } from './save.js';
import { fx } from './fx.js';
import { getCtx } from './render.js';
import { drawShip } from './shipdraw.js';
import { equipped, emblemOpts } from './cosmetics.js';
import { makeCam } from './space3d.js';
import { drawMesh3D } from './spaceRender.js';
import { COLS, ROWS, ROOM_TYPES, roomOf, locked, chargeLine, energyOn, fwd, angDiff, blocksSight, tileAt } from './pecio.js';

// dentro del pecio hay TECHO: las paredes llegan hasta él y la cámara va por el pasillo, detrás de la nave
const WALL_H = 2.1, SHIP_Y = 0.38, NEAR = 0.08, BACK = 2.3, CAM_Y = 1.3;
const ENEMY_LOOK = {
  drone: { mesh: 'raptor', pal: { hull: '#100010', edge: '#ff2bd6', glow: '#ff2d55' }, y: 0.4 },
  turret: { mesh: 'titan', pal: { hull: '#00141a', edge: '#00e5ff', glow: '#ff2d55' }, y: 0.32 },
  bomb: { mesh: 'nova', pal: { hull: '#1a0a00', edge: '#ff9f0a', glow: '#ffe600' }, y: 0.3 },
  shield: { mesh: 'brick', pal: { hull: '#0b2a14', edge: '#30d158', glow: '#7dffb0' }, y: 0.36 },
};

// ---------- Cámara de persecución (sin alabeo ni cabeceo): se acerca si una pared se mete en medio ----------
function updateCam(s, dt, W, H) {
  const p = s.player;
  const c = (s.cam ||= { yaw: p.ang, back: BACK });
  if (s.camSnap) { c.yaw = p.ang; c.back = BACK; s.camSnap = false; }
  c.yaw += angDiff(p.ang, c.yaw) * Math.min(1, dt * 5);
  const room = roomOf(s), b = fwd(c.yaw);
  let back = BACK;
  for (let t = 0.1; t <= BACK; t += 0.1) {
    if (blocksSight(tileAt(room, Math.floor(p.x - b.x * t), Math.floor(p.y - b.y * t)))) { back = Math.max(0.45, t - 0.3); break; }
  }
  c.back += (back - c.back) * Math.min(1, dt * (back < c.back ? 20 : 4));
  const pos = { x: p.x - b.x * c.back, y: CAM_Y, z: -(p.y - b.y * c.back) };
  // bien inclinada hacia abajo: la sala llena la pantalla y la nave queda en el tercio inferior
  // casi horizontal, y el centro de la proyección algo más abajo (h·1.15): la nave en el tercio inferior
  return makeCam(pos, c.yaw, -0.14, W, H * 1.15, 1.25);
}

// del mundo (casillas) al espacio de cámara
const toCam = (cam, x, y, z) => {
  const dx = x - cam.pos.x, dy = y - cam.pos.y, dz = z - cam.pos.z;
  return { x: dx * cam.r.x + dy * cam.r.y + dz * cam.r.z, y: dx * cam.u.x + dy * cam.u.y + dz * cam.u.z, z: dx * cam.f.x + dy * cam.f.y + dz * cam.f.z };
};
const scr = (cam, q) => ({ x: cam.w / 2 + (q.x * cam.focal) / q.z, y: cam.h / 2 - (q.y * cam.focal) / q.z });
// recorte de un polígono contra z = NEAR (Sutherland–Hodgman con un solo plano)
function clip(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], ain = a.z >= NEAR, bin = b.z >= NEAR;
    if (ain) out.push(a);
    if (ain !== bin) { const k = (NEAR - a.z) / (b.z - a.z); out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: NEAR }); }
  }
  return out;
}
// un polígono del mundo (lista de [x, y, z]) a la lista de dibujo
function poly(cam, list, pts, fill, stroke, lw = 1, extra) {
  const c = clip(pts.map(([x, y, z]) => toCam(cam, x, y, z)));
  if (c.length < 3) return;
  let z = 0;
  for (const q of c) z += q.z;
  // `bias`: las calcomanías (luces, minas, franjas) se ordenan justo delante de la superficie que tienen debajo
  list.push({ z: z / c.length - (extra?.bias || 0), pts: c.map((q) => scr(cam, q)), fill, stroke, lw, ...extra });
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
// niebla: el color se apaga hacia el del ambiente con la distancia
function fog(hex, fogHex, z) {
  const k = Math.max(0, Math.min(0.85, (z - 3) / 9));
  const a = parseInt(hex.slice(1), 16), b = parseInt(fogHex.slice(1), 16);
  const m = (s) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt)).toString(16).padStart(2, '0');
  return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
}
const ring = (x, y, z, r, n = 16) => Array.from({ length: n }, (_, i) => [x + Math.cos((i / n) * Math.PI * 2) * r, y, z + Math.sin((i / n) * Math.PI * 2) * r]);

export function renderPecio(dt) {
  const ctx = getCtx(), s = G.pecio;
  if (!ctx || !s) return;
  const W = G.W, H = G.H, th = s.floor.theme, room = roomOf(s), p = s.player, t = G.realTime;
  const cam = updateCam(s, dt, W, H);
  const shk = fx.shakeAmt;
  ctx.setTransform(G.dpr, 0, 0, G.dpr, shk ? (Math.random() - 0.5) * shk * G.dpr : 0, shk ? (Math.random() - 0.5) * shk * G.dpr : 0);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#000');
  bg.addColorStop(0.45, th.fog);
  bg.addColorStop(1, hexA(th.wall, 0.12));
  ctx.fillStyle = bg;
  ctx.fillRect(-20, -20, W + 40, H + 40);
  const shut = locked(room), on = energyOn(s);

  // SUELO (siempre debajo de todo: se dibuja primero, de lejos a cerca)
  const ground = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const k = room.tiles[r][c];
      if (k === '#' || k === 'C' || k === 'T' || k === 'A') continue;
      const q = [[c, 0, -r], [c + 1, 0, -r], [c + 1, 0, -r - 1], [c, 0, -r - 1]];
      const base = (r + c) % 2 ? th.floor : shade(th.floor, 9);
      if (k === 'P') poly(cam, ground, q, '#000', 'rgba(255,255,255,.18)', 1);
      else if (k === 'E') poly(cam, ground, q, on ? `rgba(255,230,0,${0.28 + 0.18 * Math.sin(t * 10 + c + r)})` : null, on ? '#ffe600' : 'rgba(255,230,0,.3)', 1, { base });
      else if (k === 'D') poly(cam, ground, q, shut ? 'rgba(255,45,85,.35)' : 'rgba(48,209,88,.3)', shut ? '#ff2d55' : '#30d158', 1.5, { base });
      else if (k === 'X') poly(cam, ground, q, hexA(th.accent, 0.25), th.accent, 2.5, { base, glyph: shut ? '🔒' : '⬇️' });
      else poly(cam, ground, q, null, hexA(th.wall, 0.12), 1, { base });
      if (k === 'M') poly(cam, ground, ring(c + 0.5, 0.01, -r - 0.5, 0.16, 8), Math.floor(t * 3) % 2 ? '#ff2d55' : '#7a0018', null, 1, { bias: 0.05 });
      // TECHO (con paneles de luz): nunca se cruza en pantalla con el suelo, así que va en la misma pasada
      const hc = WALL_H;
      poly(cam, ground, [[c, hc, -r - 1], [c + 1, hc, -r - 1], [c + 1, hc, -r], [c, hc, -r]], null, hexA(th.wall, 0.1), 1, { base: shade(th.fog, 10) });
      if ((c * 7 + r * 3) % 5 === 0) poly(cam, ground, [[c + 0.3, hc - 0.01, -r - 0.7], [c + 0.7, hc - 0.01, -r - 0.7], [c + 0.7, hc - 0.01, -r - 0.3], [c + 0.3, hc - 0.01, -r - 0.3]], hexA(th.accent, 0.55), null, 1, { bias: 0.05 });
    }
  }
  // sombra de la nave
  poly(cam, ground, ring(p.x, 0.005, -p.y, 0.32, 12), 'rgba(0,0,0,.45)', null);
  // AVISOS en el suelo: el láser que va a disparar una torreta y la zona de una bomba armada
  for (const e of room.enemies) {
    if (!e.alive) continue;
    const ln = chargeLine(room, e);
    if (ln) {
      const f = fwd(e.aim), w = 0.14, nx = -f.y * w, ny = f.x * w;
      poly(cam, ground, [[ln.from.x + nx, 0.02, -(ln.from.y + ny)], [ln.to.x + nx, 0.02, -(ln.to.y + ny)], [ln.to.x - nx, 0.02, -(ln.to.y - ny)], [ln.from.x - nx, 0.02, -(ln.from.y - ny)]],
        `rgba(255,45,85,${0.4 + 0.3 * Math.sin(t * 22)})`, null);
    }
    if (e.kind === 'bomb' && e.fuse !== null) poly(cam, ground, ring(e.x, 0.02, -e.y, 1.7, 20), 'rgba(255,159,10,.14)', `rgba(255,159,10,${0.5 + 0.4 * Math.sin(t * 30)})`, 2);
  }
  ground.sort((a, b) => b.z - a.z);
  drawPolys(ctx, ground, th);

  // PAREDES, OBJETOS Y ENTIDADES (ordenados por distancia)
  const list = [];
  const isWall = (c, r) => { const k = tileAt(room, c, r); return k === '#' || (k === 'D' && shut); };
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const k = room.tiles[r][c];
      const wall = k === '#', door = k === 'D' && shut;
      if (wall || door) {
        const h = WALL_H, col = door ? '#3a0010' : '#0d0a18', edge = door ? '#ff2d55' : th.wall;
        const x0 = c, x1 = c + 1, z0 = -r, z1 = -r - 1;
        // solo las caras que dan a una casilla libre (las demás no se ven nunca), con su franja de neón
        const face = (ax, az, bx, bz) => {
          poly(cam, list, [[ax, 0, az], [bx, 0, bz], [bx, h, bz], [ax, h, az]], col, edge, 1.4, { fogc: true });
          poly(cam, list, [[ax, 0.42, az], [bx, 0.42, bz], [bx, 0.5, bz], [ax, 0.5, az]], hexA(edge, 0.7), null, 1, { bias: 0.25 });
        };
        if (r + 1 < ROWS && !isWall(c, r + 1)) face(x0, z0, x1, z0);
        if (r - 1 >= 0 && !isWall(c, r - 1)) face(x1, z1, x0, z1);
        if (c - 1 >= 0 && !isWall(c - 1, r)) face(x0, z1, x0, z0);
        if (c + 1 < COLS && !isWall(c + 1, r)) face(x1, z0, x1, z1);
      } else if (k === 'C' || k === 'T' || k === 'A') {
        // cofre, terminal y altar: un bloque bajo con su icono encima
        const h = 0.55, x0 = c + 0.15, x1 = c + 0.85, z0 = -r - 0.15, z1 = -r - 0.85;
        const edge = k === 'C' ? '#ffcc00' : k === 'T' ? '#7df9ff' : '#bf5af2', col = '#141020';
        poly(cam, list, [[x0, 0, z0], [x1, 0, z0], [x1, h, z0], [x0, h, z0]], col, edge, 1.5);
        poly(cam, list, [[x1, 0, z1], [x0, 0, z1], [x0, h, z1], [x1, h, z1]], col, edge, 1.5);
        poly(cam, list, [[x0, 0, z1], [x0, 0, z0], [x0, h, z0], [x0, h, z1]], col, edge, 1.5);
        poly(cam, list, [[x1, 0, z0], [x1, 0, z1], [x1, h, z1], [x1, h, z0]], col, edge, 1.5);
        poly(cam, list, [[x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1]], shade(col, 14), edge, 1.5);
        const g = k === 'C' ? (room.opened ? '📭' : '🎁') : k === 'T' ? '🛒' : room.used ? '🕯️' : '✨';
        point(cam, list, c + 0.5, h + 0.35, -r - 0.5, (q) => glyph(ctx, g, q.x, q.y + Math.sin(t * 3) * 2, Math.max(10, q.s * 0.5)));
      }
    }
  }
  // ENEMIGOS: mallas 3D de verdad, con su vida y su aviso
  for (const e of room.enemies) {
    if (!e.alive) continue;
    const L = ENEMY_LOOK[e.kind], pos = { x: e.x, y: L.y + (e.kind === 'drone' ? Math.sin(t * 4 + e.x) * 0.06 : 0), z: -e.y };
    const blink = e.kind === 'bomb' && e.fuse !== null && Math.floor(t * 14) % 2 === 0;
    const wake = room.wake > 0;
    point(cam, list, pos.x, pos.y, pos.z, (q) => {
      if (wake) ctx.globalAlpha = 0.45;
      drawMesh3D(ctx, cam, L.mesh, pos, e.ang, e.kind === 'turret' ? 0 : -0.1, e.r * 1.25, L.pal, e.hitT > 0 || blink, NEAR);
      ctx.globalAlpha = 1;
      if (e.stun > 0) glyph(ctx, '💫', q.x, q.y - q.s * 0.55, Math.max(10, q.s * 0.3));
      if (e.charge > 0) glyph(ctx, '❗', q.x, q.y - q.s * 0.6, Math.max(12, q.s * 0.4));
      // vida
      const n = e.max, w = Math.max(2, Math.min(5, q.s * 0.05));
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i < e.hp ? '#ff2d55' : 'rgba(255,255,255,.2)';
        ctx.fillRect(q.x - (n * (w + 1)) / 2 + i * (w + 1), q.y - q.s * 0.45, w, 3);
      }
    });
    // ESCUDO: la placa de su frente (los disparos que le llegan por ahí rebotan)
    if (e.kind === 'shield') {
      const f = fwd(e.ang), cx = e.x + f.x * 0.48, cy = e.y + f.y * 0.48, nx = -f.y * 0.42, ny = f.x * 0.42;
      poly(cam, list, [[cx + nx, 0.08, -(cy + ny)], [cx - nx, 0.08, -(cy - ny)], [cx - nx, 0.72, -(cy - ny)], [cx + nx, 0.72, -(cy + ny)]], 'rgba(48,209,88,.28)', '#7dffb0', 2.5);
    }
  }
  // TUS BALAS
  for (const b of s.shots) {
    point(cam, list, b.x, SHIP_Y, -b.y, (q) => {
      ctx.fillStyle = '#7df9ff';
      ctx.shadowColor = '#7df9ff';
      ctx.shadowBlur = save.settings.fx === false ? 0 : 10;
      ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(2, q.s * 0.07), 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    });
  }
  // TU NAVE (vista desde atrás: se inclina al girar)
  const lk = equipped(save, save.ship), pal = lk.palette;
  if (G.mode !== 'pecioEnd' || s.won) {
    point(cam, list, p.x, SHIP_Y, -p.y, (q) => {
      const size = q.s * 0.62, yaw = angDiff(p.ang, s.cam.yaw);
      if (p.inv > 0 && p.dashT <= 0 && Math.floor(t * 16) % 2) ctx.globalAlpha = 0.45;
      drawShip(ctx, save.ship, { ...pal, edge: pal.edge || s.ship?.color || '#00e5ff' }, q.x, q.y, size, { pitch: -0.5, roll: -(s.turnIn || 0) * 0.5, yaw }, { line: 1.4, ...emblemOpts(lk) });
      ctx.globalAlpha = 1;
      if (p.shield > 0 || p.dashT > 0) {
        ctx.strokeStyle = p.dashT > 0 ? 'rgba(255,255,255,.7)' : 'rgba(125,249,255,.75)';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(q.x, q.y, size * 0.95, size * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
      }
    });
  }
  list.sort((a, b) => b.z - a.z);
  drawPolys(ctx, list, th);

  // DESTELLOS: disparos de las torretas, rayos, explosiones
  ctx.globalCompositeOperation = 'lighter';
  for (const f of s.flashes || []) {
    const a = Math.max(0, f.t / f.max);
    if (f.kind === 'eshot' || f.kind === 'beam') {
      const seg = clipSeg(toCam(cam, f.from.x, SHIP_Y, -f.from.y), toCam(cam, f.to.x, SHIP_Y, -f.to.y));
      if (!seg) continue;
      const P0 = scr(cam, seg[0]), P1 = scr(cam, seg[1]);
      ctx.strokeStyle = f.kind === 'eshot' ? `rgba(255,45,85,${a})` : `rgba(255,230,0,${a})`;
      ctx.lineWidth = f.kind === 'eshot' ? 5 : 9;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(P0.x, P0.y); ctx.lineTo(P1.x, P1.y); ctx.stroke();
    } else if (f.kind === 'boom') {
      if (toCam(cam, f.x, 0, -f.y).z < 1) continue; // pegada a la cámara taparía media pantalla
      const c = clip(ring(f.x, 0.05, -f.y, (f.r || 0.5) * (0.5 + (1 - a) * 0.7), 18).map(([x, y, z]) => toCam(cam, x, y, z)));
      if (c.length < 3) continue;
      ctx.strokeStyle = `rgba(255,159,10,${a})`;
      ctx.fillStyle = `rgba(255,120,0,${a * 0.25})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      c.forEach((q, i) => { const P = scr(cam, q); if (i) ctx.lineTo(P.x, P.y); else ctx.moveTo(P.x, P.y); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  // fundido al cruzar una puerta
  if (s.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, s.fade / 0.25)})`; ctx.fillRect(-20, -20, W + 40, H + 40); }
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  minimap(ctx, s, W);
  fx.draw(ctx);
  fx.drawTexts(ctx, 0);
  fx.drawBanners(ctx, W, H);
}

// un punto del mundo como "entidad" ordenable: se dibuja con su función cuando le toca
function point(cam, list, x, y, z, fn) {
  const q = toCam(cam, x, y, z);
  if (q.z < NEAR * 2) return;
  const P = scr(cam, q);
  if (P.x < -200 || P.x > cam.w + 200 || P.y < -200 || P.y > cam.h + 200) return;
  list.push({ z: q.z, fn: () => fn({ ...P, s: cam.focal / q.z }) });
}
function clipSeg(a, b) {
  if (a.z < NEAR && b.z < NEAR) return null;
  const cut = (p, o) => { const k = (NEAR - p.z) / (o.z - p.z); return { x: p.x + (o.x - p.x) * k, y: p.y + (o.y - p.y) * k, z: NEAR }; };
  return [a.z < NEAR ? cut(a, b) : a, b.z < NEAR ? cut(b, a) : b];
}
function drawPolys(ctx, list, th) {
  ctx.lineJoin = 'round';
  for (const d of list) {
    if (d.fn) { d.fn(); continue; }
    ctx.beginPath();
    d.pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    if (d.base) { ctx.fillStyle = fog(d.base, th.fog, d.z); ctx.fill(); }
    if (d.fill) { ctx.fillStyle = d.fogc ? fog(d.fill, th.fog, d.z) : d.fill; ctx.fill(); }
    if (d.stroke) { ctx.strokeStyle = d.stroke; ctx.lineWidth = d.lw; ctx.globalAlpha = Math.max(0.25, 1 - Math.max(0, d.z - 4) / 12); ctx.stroke(); ctx.globalAlpha = 1; }
    if (d.glyph) { let x = 0, y = 0; for (const q of d.pts) { x += q.x; y += q.y; } glyph(ctx, d.glyph, x / d.pts.length, y / d.pts.length, 22); }
  }
}

// MINIMAPA: salas vistas (con su icono), las conocidas por una puerta y dónde estás
function minimap(ctx, s, W) {
  const cell = 15, gap = 3, size = 5 * (cell + gap), x0 = W - size - 12, y0 = 64;
  const rooms = s.floor.rooms;
  const known = new Set(s.visited);
  for (const id of s.visited) for (const n of Object.values(rooms[id].doors)) known.add(n);
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fillRect(x0 - 4, y0 - 4, size + 5, size + 5);
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
  ctx.fillStyle = '#fff';
  ctx.fillText(ch, x, y);
}
