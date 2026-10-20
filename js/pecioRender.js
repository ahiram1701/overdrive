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
import { COLS, ROWS, ROOM_TYPES, roomOf, locked, chargeLine, energyOn, fwd, angDiff, wallFaces, camBack, openDoors, BOSSES, ELITE } from './pecio.js';
import { RARITY, CONS, itemIcon } from './pecioLoot.js';

// dentro del pecio hay TECHO: las paredes llegan hasta él y la cámara va por el pasillo, detrás de la nave
const DOOR_H = 1.3, WALL_H = 2.1, SHIP_Y = 0.38, NEAR = 0.08, BACK = 2.3, CAM_Y = 1.3;
const ENEMY_LOOK = {
  drone: { mesh: 'raptor', pal: { hull: '#100010', edge: '#ff2bd6', glow: '#ff2d55' }, y: 0.4 },
  turret: { mesh: 'titan', pal: { hull: '#00141a', edge: '#00e5ff', glow: '#ff2d55' }, y: 0.32 },
  bomb: { mesh: 'nova', pal: { hull: '#1a0a00', edge: '#ff9f0a', glow: '#ffe600' }, y: 0.3 },
  shield: { mesh: 'brick', pal: { hull: '#0b2a14', edge: '#30d158', glow: '#7dffb0' }, y: 0.36 },
  mimic: { mesh: 'kaiju', pal: { hull: '#2a1a00', edge: '#ffcc00', glow: '#ff2d55' }, y: 0.36 },
  node: { mesh: 'nova', pal: { hull: '#03140a', edge: '#7dffb0', glow: '#30d158' }, y: 0.5 },
  sniper: { mesh: 'spectra', pal: { hull: '#00141a', edge: '#7df9ff', glow: '#ff2d55' }, y: 0.42 },
  summoner: { mesh: 'manta', pal: { hull: '#14001f', edge: '#bf5af2', glow: '#ff2bd6' }, y: 0.5 },
  charger: { mesh: 'brick', pal: { hull: '#1f0a00', edge: '#ff6a00', glow: '#ffe600' }, y: 0.36 },
  roller: { mesh: 'nova', pal: { hull: '#1a0004', edge: '#ff2d55', glow: '#ffe600' }, y: 0.28 },
};
// los jefes: una malla grande cada uno
const BOSS_LOOK = {
  guardian: { mesh: 'titan', pal: { hull: '#1f1000', edge: '#ff9f0a', glow: '#ffe600' }, y: 0.6 },
  swarm: { mesh: 'kaiju', pal: { hull: '#03140a', edge: '#30d158', glow: '#bf5af2' }, y: 0.7 },
  core: { mesh: 'nova', pal: { hull: '#1a0004', edge: '#ff2d55', glow: '#ffe600' }, y: 0.85 },
  excavator: { mesh: 'titan', pal: { hull: '#1a0e06', edge: '#c8743a', glow: '#ffe600' }, y: 0.55 },
  phantom: { mesh: 'ghost', pal: { hull: '#0a1420', edge: '#bfe9ff', glow: '#ffffff' }, y: 0.6 },
  fusion: { mesh: 'nova', pal: { hull: '#1a1400', edge: '#ffe600', glow: '#ff2d55' }, y: 0.8 },
};

// ---------- Cámara de persecución (sin alabeo ni cabeceo): se acerca si una pared se mete en medio ----------
function updateCam(s, dt, W, H) {
  const p = s.player;
  const c = (s.cam ||= { yaw: p.ang, back: BACK });
  if (s.camSnap) { c.yaw = p.ang; c.back = BACK; s.camSnap = false; }
  c.yaw += angDiff(p.ang, c.yaw) * Math.min(1, dt * 5);
  const room = roomOf(s), b = fwd(c.yaw);
  // si algo se mete en medio, la cámara se acerca AL MOMENTO (si fuera suave, unos fotogramas estaría dentro de la pared); se aleja despacio
  const want = camBack(room, p, c.yaw, BACK);
  c.back = want < c.back ? want : c.back + (want - c.back) * Math.min(1, dt * 4);
  // pegada a una pared la cámara se acerca: entonces sube y mira más abajo, así la nave sigue a la vista
  const k = Math.max(0, (BACK - c.back) / BACK);
  const pos = { x: p.x - b.x * c.back, y: CAM_Y + k * 0.6, z: -(p.y - b.y * c.back) };
  // casi horizontal, y el centro de la proyección algo más abajo (h·1.15): la nave en el tercio inferior
  return makeCam(pos, c.yaw, -0.14 - k * 0.75, W, H * 1.15, 1.25);
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
  // fondo del mismo tono que la pared en la niebla: si el recorte junto a la cámara deja algún píxel, parece sombra y no un hueco
  ctx.fillStyle = th.fog;
  ctx.fillRect(-20, -20, W + 40, H + 40);
  const shut = locked(room), on = energyOn(s, room), scan = !!s.player.mods?.hasScanner;

  // SUELO (siempre debajo de todo: se dibuja primero, de lejos a cerca)
  const ground = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const k = room.tiles[r][c];
      if (k === '#') continue;
      if (k === 'C' || k === 'T' || k === 'A') { // bajo el bloque no se ve el suelo, pero el techo de encima sí
        poly(cam, ground, [[c, WALL_H, -r - 1], [c + 1, WALL_H, -r - 1], [c + 1, WALL_H, -r], [c, WALL_H, -r]], null, hexA(th.wall, 0.1), 1, { base: shade(th.fog, 10) });
        continue;
      }
      const q = [[c, 0, -r], [c + 1, 0, -r], [c + 1, 0, -r - 1], [c, 0, -r - 1]];
      const base = (r + c) % 2 ? th.floor : shade(th.floor, 9);
      if (k === 'P') poly(cam, ground, q, '#000', 'rgba(255,255,255,.18)', 1);
      else if (k === 'S' || k === 's') poly(cam, ground, q, k === 'S' ? `rgba(255,230,0,${0.25 + 0.15 * Math.sin(t * 5)})` : 'rgba(255,255,255,.05)', k === 'S' ? '#ffe600' : 'rgba(255,255,255,.2)', 2, { base, glyph: k === 'S' ? '🔌' : null, gsize: 20 });
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
      const f = fwd(e.aim), w = e.kind === 'boss' ? e.r : 0.14, nx = -f.y * w, ny = f.x * w;
      poly(cam, ground, [[ln.from.x + nx, 0.02, -(ln.from.y + ny)], [ln.to.x + nx, 0.02, -(ln.to.y + ny)], [ln.to.x - nx, 0.02, -(ln.to.y - ny)], [ln.from.x - nx, 0.02, -(ln.from.y - ny)]],
        `rgba(255,45,85,${0.4 + 0.3 * Math.sin(t * 22)})`, null);
    }
    if (e.kind === 'charger' && e.charge > 0) poly(cam, ground, ring(e.x, 0.02, -e.y, 3.4, 24), null, `rgba(255,106,0,${0.45 + 0.4 * Math.sin(t * 24)})`, 2.5);
    if (e.kind === 'charger' && e.wave) poly(cam, ground, ring(e.x, 0.03, -e.y, e.wave.r, 28), null, '#ffb340', 6);
    if (e.kind === 'bomb' && e.fuse !== null) poly(cam, ground, ring(e.x, 0.02, -e.y, 1.7, 20), 'rgba(255,159,10,.14)', `rgba(255,159,10,${0.5 + 0.4 * Math.sin(t * 30)})`, 2);
  }
  if (room.markT > 0) {
    const k = 1 - room.markT / 1.1;
    for (const [c, r] of room.marks) poly(cam, ground, [[c + 0.06, 0.02, -r - 0.06], [c + 0.94, 0.02, -r - 0.06], [c + 0.94, 0.02, -r - 0.94], [c + 0.06, 0.02, -r - 0.94]], `rgba(255,45,85,${0.25 + 0.45 * k + 0.15 * Math.sin(t * 25)})`, '#ff2d55', 1.5);
  }
  ground.sort((a, b) => b.z - a.z);
  drawPolys(ctx, ground, th);

  // PAREDES, OBJETOS Y ENTIDADES, en ORDEN DE CASILLAS: cada cosa pertenece a una casilla y se dibuja de la casilla más
  // lejana a la más cercana según su distancia "en manzanas" a la de la cámara. Un rayo que sale de la cámara cruza las
  // casillas con esa distancia siempre creciente, así que lo cercano se pinta siempre después (y encima) de lo lejano.
  // (Ordenar por la profundidad media de cada polígono fallaba: abría "ventanas" en paredes cercanas.)
  const list = [];
  const cc = Math.floor(cam.pos.x), cr = Math.floor(-cam.pos.z);
  const ord = (c, r) => Math.abs(c - cc) + Math.abs(r - cr);
  const ordAt = (x, y) => ord(Math.floor(x), Math.floor(y));
  // cara trasera (mira hacia fuera de la cámara): no se dibuja nunca
  const facing = (nx, nz, x, z) => nx * (cam.pos.x - x) + nz * (cam.pos.z - z) > 0;
  for (const f of wallFaces(room, shut)) {
    const [ax, az] = f.a, [bx, bz] = f.b;
    if (!facing(f.n[0], f.n[1], ax, az)) continue;
    const o = ord(f.c, f.r), col = f.door ? '#3a0010' : f.crack ? '#16131c' : '#0d0a18';
    const edge = f.door ? '#ff2d55' : f.crack ? (scan ? `rgba(255,204,0,${0.6 + 0.4 * Math.sin(t * 6)})` : '#8e8e93') : th.wall;
    poly(cam, list, [[ax, 0, az], [bx, 0, bz], [bx, WALL_H, bz], [ax, WALL_H, az]], col, f.crack ? th.wall : edge, 1.4, { fogc: true, o });
    if (f.crack) {
      // grietas: un zigzag por la cara
      const P = (k, y) => [ax + (bx - ax) * k, y, az + (bz - az) * k];
      poly(cam, list, [P(0.5, 0.15), P(0.38, 0.6), P(0.6, 0.95), P(0.42, 1.4), P(0.55, 1.85), P(0.58, 1.85), P(0.46, 1.4), P(0.64, 0.95), P(0.42, 0.6), P(0.54, 0.15)], null, edge, scan ? 2.5 : 1.6, { o, bias: 0.3 });
    }
    // franja de neón: va justo después de su cara (misma casilla, algo más cerca)
    poly(cam, list, [[ax, 0.42, az], [bx, 0.42, bz], [bx, 0.5, bz], [ax, 0.5, az]], hexA(edge, 0.7), null, 1, { bias: 0.25, o });
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const k = room.tiles[r][c], o = ord(c, r);
      if (k === 'D' && !shut) {
        // PUERTA ABIERTA: dintel hasta el techo y, al fondo, el portal de salida (nunca se ve el vacío de fuera)
        const side = r === 0 ? 'up' : r === ROWS - 1 ? 'down' : c === 0 ? 'left' : 'right';
        const across = side === 'up' || side === 'down';
        const inner = { up: -r - 1, down: -r, left: c + 1, right: c }[side], outer = { up: -r, down: -r - 1, left: c, right: c + 1 }[side];
        const n = { up: [0, -1], down: [0, 1], left: [1, 0], right: [-1, 0] }[side]; // hacia dentro de la sala
        const at = (e, y, k2) => (across ? [c + k2, y, e] : [e, y, -r - k2]); // punto del borde e, a la altura y (k2: 0→1 a lo largo)
        const pin = at(inner, 0, 0);
        if (!facing(n[0], n[1], pin[0], pin[2])) continue;
        const edge = th.wall;
        poly(cam, list, [at(outer, 0, 0), at(outer, 0, 1), at(outer, DOOR_H, 1), at(outer, DOOR_H, 0)], '#04160b', `rgba(48,209,88,${0.6 + 0.3 * Math.sin(t * 3)})`, 2.5, { glyph: '🚪', gsize: 18, o, bias: -0.5 });
        if (cam.pos.y < DOOR_H) poly(cam, list, [at(inner, DOOR_H, 0), at(inner, DOOR_H, 1), at(outer, DOOR_H, 1), at(outer, DOOR_H, 0)], '#0a0814', hexA(edge, 0.6), 1, { fogc: true, o, bias: -0.25 });
        poly(cam, list, [at(inner, DOOR_H, 0), at(inner, DOOR_H, 1), at(inner, WALL_H, 1), at(inner, WALL_H, 0)], '#0d0a18', edge, 1.4, { fogc: true, o });
      } else if (k === 'C' || k === 'T' || k === 'A') {
        // cofre, terminal y altar: un bloque bajo con su icono encima (solo sus caras de frente)
        const h = 0.55, x0 = c + 0.15, x1 = c + 0.85, z0 = -r - 0.15, z1 = -r - 0.85;
        const edge = k === 'C' ? '#ffcc00' : k === 'T' ? '#7df9ff' : '#bf5af2', col = '#141020';
        if (facing(0, 1, x0, z0)) poly(cam, list, [[x0, 0, z0], [x1, 0, z0], [x1, h, z0], [x0, h, z0]], col, edge, 1.5, { o });
        if (facing(0, -1, x0, z1)) poly(cam, list, [[x1, 0, z1], [x0, 0, z1], [x0, h, z1], [x1, h, z1]], col, edge, 1.5, { o });
        if (facing(-1, 0, x0, z0)) poly(cam, list, [[x0, 0, z1], [x0, 0, z0], [x0, h, z0], [x0, h, z1]], col, edge, 1.5, { o });
        if (facing(1, 0, x1, z0)) poly(cam, list, [[x1, 0, z0], [x1, 0, z1], [x1, h, z1], [x1, h, z0]], col, edge, 1.5, { o });
        poly(cam, list, [[x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1]], shade(col, 14), edge, 1.5, { o, bias: 0.2 });
        const g = k === 'C' ? (room.opened ? '📭' : room.mimic && scan ? '😈' : room.freeChest ? '💎' : '🎁') : k === 'T' ? '🛒' : room.used ? '🕯️' : '✨';
        point(cam, list, c + 0.5, h + 0.35, -r - 0.5, (q) => glyph(ctx, g, q.x, q.y + Math.sin(t * 3) * 2, Math.max(10, q.s * 0.5)), o, -1);
      }
    }
  }
  // ENEMIGOS: mallas 3D de verdad, con su vida y su aviso
  for (const e of room.enemies) {
    if (!e.alive) continue;
    const L = e.kind === 'boss' ? BOSS_LOOK[e.boss] : ENEMY_LOOK[e.kind], pos = { x: e.x, y: L.y + (e.kind === 'drone' ? Math.sin(t * 4 + e.x) * 0.06 : 0), z: -e.y };
    const blink = e.kind === 'bomb' && e.fuse !== null && Math.floor(t * 14) % 2 === 0;
    const wake = room.wake > 0;
    if (e.hidden) {
      if (e.boss === 'excavator') poly(cam, list, ring(e.x, 0.03, -e.y, 0.7 + 0.1 * Math.sin(t * 9), 14), 'rgba(200,116,58,.25)', '#c8743a', 2, { o: ordAt(e.x, e.y) });
      else poly(cam, list, ring(e.x, 0.02, -e.y, e.r, 14), 'rgba(0,0,0,.5)', 'rgba(191,233,255,.25)', 1, { o: ordAt(e.x, e.y) });
      continue;
    }
    // ÉLITE: anillo dorado en el suelo
    if (e.elite) poly(cam, list, ring(e.x, 0.02, -e.y, e.r + 0.12, 14), 'rgba(255,214,10,.12)', '#ffd60a', 2, { o: ordAt(e.x, e.y), bias: -0.5 });
    point(cam, list, pos.x, pos.y, pos.z, (q) => {
      if (wake) ctx.globalAlpha = 0.45;
      if (e.boss === 'phantom') ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 12); // a medio materializar
      // el NÚCLEO: una esfera de energía que late detrás de su malla
      if (e.kind === 'boss' && e.boss === 'core') {
        const R = q.s * e.r * (0.85 + 0.06 * Math.sin(t * 6)), g = ctx.createRadialGradient(q.x, q.y, R * 0.1, q.x, q.y, R);
        g.addColorStop(0, 'rgba(255,230,0,.95)');
        g.addColorStop(0.45, 'rgba(255,45,85,.75)');
        g.addColorStop(1, 'rgba(255,45,85,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(q.x, q.y, R, 0, Math.PI * 2); ctx.fill();
      }
      drawMesh3D(ctx, cam, L.mesh, pos, e.kind === 'boss' && e.boss === 'core' ? t * 0.8 : e.ang, e.kind === 'turret' || e.kind === 'boss' ? 0 : -0.1, e.r * (e.kind === 'boss' ? 1.15 : 1.25), L.pal, e.hitT > 0 || blink, NEAR);
      ctx.globalAlpha = 1;
      if (e.elite) glyph(ctx, `👑${ELITE[e.elite].icon}`, q.x, q.y - q.s * 0.62, Math.max(11, q.s * 0.3));
      if (e.burnT > 0) glyph(ctx, '🔥', q.x + q.s * 0.3, q.y - q.s * 0.3, Math.max(10, q.s * 0.26));
      if (e.stun > 0) glyph(ctx, '💫', q.x, q.y - q.s * 0.55, Math.max(10, q.s * 0.3));
      if (e.charge > 0) glyph(ctx, '❗', q.x, q.y - q.s * 0.6, Math.max(12, q.s * 0.4));
      if (e.summonT > 0) glyph(ctx, '✨', q.x, q.y - q.s * 0.6, Math.max(12, q.s * (0.35 + 0.15 * Math.sin(t * 20))));
      // vida: puntitos si tiene poca; una barrita si tiene mucha (los jefes, su barra grande abajo)
      if (e.kind !== 'boss') {
        const n = e.max, w = Math.max(2, Math.min(5, q.s * 0.05));
        if (n <= 12) {
          for (let i = 0; i < n; i++) {
            ctx.fillStyle = i < e.hp ? '#ff2d55' : 'rgba(255,255,255,.2)';
            ctx.fillRect(q.x - (n * (w + 1)) / 2 + i * (w + 1), q.y - q.s * 0.45, w, 3);
          }
        } else {
          const bw = Math.max(24, q.s * 0.7);
          ctx.fillStyle = 'rgba(255,255,255,.2)';
          ctx.fillRect(q.x - bw / 2, q.y - q.s * 0.45, bw, 3);
          ctx.fillStyle = '#ff2d55';
          ctx.fillRect(q.x - bw / 2, q.y - q.s * 0.45, (bw * Math.max(0, e.hp)) / e.max, 3);
        }
      }
    }, ordAt(e.x, e.y));
    // ESCUDO: la placa de su frente (los disparos que le llegan por ahí rebotan)
    if (e.kind === 'shield') {
      const f = fwd(e.ang), cx = e.x + f.x * 0.48, cy = e.y + f.y * 0.48, nx = -f.y * 0.42, ny = f.x * 0.42;
      poly(cam, list, [[cx + nx, 0.08, -(cy + ny)], [cx - nx, 0.08, -(cy - ny)], [cx - nx, 0.72, -(cy - ny)], [cx + nx, 0.72, -(cy + ny)]], 'rgba(48,209,88,.28)', '#7dffb0', 2.5, { o: ordAt(e.x, e.y) });
    }
  }
  // BOTÍN EN EL SUELO: objetos (con el color de su rareza y, los buenos, un haz de luz) y consumibles
  for (const pk of room.pickups || []) {
    const col = pk.kind === 'item' ? RARITY[pk.item.tier].color : pk.kind === 'key' ? '#ffcc00' : '#7df9ff', o = ordAt(pk.x, pk.y);
    poly(cam, list, ring(pk.x, 0.015, -pk.y, 0.32, 14), hexA(col, 0.18), col, 2, { o, bias: -0.6 }); // (el suelo ya está pintado: va en la lista, detrás de lo de su casilla)
    if (pk.kind === 'item' && pk.item.tier >= 2) {
      const w = 0.08;
      poly(cam, list, [[pk.x - w, 0, -pk.y], [pk.x + w, 0, -pk.y], [pk.x + w, WALL_H, -pk.y], [pk.x - w, WALL_H, -pk.y]], hexA(col, 0.22 + 0.1 * Math.sin(t * 4)), null, 1, { o, bias: 0.1 });
    }
    const g = pk.kind === 'item' ? itemIcon(pk.item) : pk.kind === 'key' ? '🗝️' : CONS[pk.cons].icon;
    point(cam, list, pk.x, 0.45 + Math.sin(t * 3 + pk.x) * 0.06, -pk.y, (q) => glyph(ctx, g, q.x, q.y, Math.max(12, q.s * 0.42)), o);
  }
  // TUS BALAS
  for (const b of s.shots) {
    point(cam, list, b.x, SHIP_Y, -b.y, (q) => {
      ctx.fillStyle = '#7df9ff';
      ctx.shadowColor = '#7df9ff';
      ctx.shadowBlur = save.settings.fx === false ? 0 : 10;
      ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(2, q.s * 0.07), 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }, ordAt(b.x, b.y));
  }
  // ÓRBITA: tus orbes (mismas posiciones que la lógica)
  for (let i = 0; i < (p.orbs || 0); i++) {
    const a = (s.orbA || 0) + (i / p.orbs) * Math.PI * 2, ox = p.x + Math.cos(a) * 1.05, oy = p.y + Math.sin(a) * 1.05;
    point(cam, list, ox, SHIP_Y, -oy, (q) => {
      const R = Math.min(10, Math.max(3, q.s * 0.12)), g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, R * 2);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#bf5af2'); g.addColorStop(1, 'rgba(191,90,242,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(q.x, q.y, R * 2, 0, Math.PI * 2); ctx.fill();
    }, ordAt(ox, oy));
  }
  // SEÑUELO: un fantasma de tu nave donde esquivaste
  if (s.decoy) {
    const d = s.decoy;
    point(cam, list, d.x, SHIP_Y, -d.y, (q) => {
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 14);
      glyph(ctx, '👻', q.x, q.y, Math.max(14, q.s * 0.5));
      ctx.globalAlpha = 1;
    }, ordAt(d.x, d.y));
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
    }, ordAt(p.x, p.y));
  }
  list.sort((a, b) => b.o - a.o || b.z - a.z);
  drawPolys(ctx, list, th);

  // DESTELLOS: disparos de las torretas, rayos, explosiones
  ctx.globalCompositeOperation = 'lighter';
  for (const f of s.flashes || []) {
    const a = Math.max(0, f.t / f.max);
    if (f.kind === 'eshot' || f.kind === 'beam' || f.kind === 'arc') {
      const seg = clipSeg(toCam(cam, f.from.x, SHIP_Y, -f.from.y), toCam(cam, f.to.x, SHIP_Y, -f.to.y));
      if (!seg) continue;
      const P0 = scr(cam, seg[0]), P1 = scr(cam, seg[1]);
      ctx.strokeStyle = f.kind === 'eshot' ? `rgba(255,45,85,${a})` : f.kind === 'arc' ? `rgba(160,200,255,${a})` : `rgba(255,230,0,${a})`;
      ctx.lineWidth = f.kind === 'eshot' ? 5 : f.kind === 'arc' ? 3 : 9;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(P0.x, P0.y); ctx.lineTo(P1.x, P1.y); ctx.stroke();
    } else if (f.kind === 'tile') {
      const c = clip([[f.c, 0.03, -f.r], [f.c + 1, 0.03, -f.r], [f.c + 1, 0.03, -f.r - 1], [f.c, 0.03, -f.r - 1]].map(([x, y, z]) => toCam(cam, x, y, z)));
      if (c.length < 3) continue;
      ctx.fillStyle = `rgba(255,120,40,${a * 0.8})`;
      ctx.beginPath();
      c.forEach((q, i) => { const P = scr(cam, q); if (i) ctx.lineTo(P.x, P.y); else ctx.moveTo(P.x, P.y); });
      ctx.closePath(); ctx.fill();
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
  // APAGÓN: solo se ve cerca de tu nave
  if (s.floor.event === 'blackout') {
    const ps = toCam(cam, p.x, SHIP_Y, -p.y);
    if (ps.z > NEAR) {
      const P = scr(cam, ps), R = Math.min(W, H) * 0.42;
      const g = ctx.createRadialGradient(P.x, P.y, R * 0.25, P.x, P.y, R);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,.93)');
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
  }
  // fundido al cruzar una puerta
  if (s.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, s.fade / 0.25)})`; ctx.fillRect(-20, -20, W + 40, H + 40); }
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  // RAYOS DE CURACIÓN: de cada nodo a su reina (si los matas, deja de curarse)
  ctx.globalCompositeOperation = 'lighter';
  for (const n of room.enemies) {
    if (!n.alive || n.kind !== 'node') continue;
    const q = room.enemies.find((o) => o.id === n.queen && o.alive);
    if (!q) continue;
    const seg = clipSeg(toCam(cam, n.x, 0.5, -n.y), toCam(cam, q.x, 0.7, -q.y));
    if (!seg) continue;
    const P0 = scr(cam, seg[0]), P1 = scr(cam, seg[1]);
    ctx.strokeStyle = `rgba(125,255,176,${0.35 + 0.25 * Math.sin(t * 8 + n.orbit)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(P0.x, P0.y); ctx.lineTo(P1.x, P1.y); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  bossBar(ctx, room, W, H, t);
  roomBar(ctx, room, W, H, t);
  minimap(ctx, s, W);
  fx.draw(ctx);
  fx.drawTexts(ctx, 0);
  // el cartel y los avisos, ARRIBA pero por debajo de la barra (vidas, llaves) y del minimapa; abajo están los botones
  const L = textLayout(s, H);
  fx.drawBanners(ctx, W, H, { bannerY: L.bannerY, noticeY: L.noticeY, stack: true, backdrop: true });
}

// Dónde empieza el hueco libre bajo la barra de arriba (se mide de vez en cuando: leer el DOM en cada fotograma es caro)
const MINIMAP_BOTTOM = 64 + 5 * 18 + 4;
export function textLayout(s, H) {
  const now = G.realTime;
  if (!s.hudBottom || now - (s.hudT || 0) > 0.5) {
    s.hudT = now;
    const el = typeof document !== 'undefined' && document.querySelector('#pecioHud .pc-top');
    s.hudBottom = el ? el.getBoundingClientRect().bottom : 110;
  }
  const top = Math.max(s.hudBottom, MINIMAP_BOTTOM) + 12;
  const bannerY = Math.min(top + 26, H * 0.42);
  return { top, bannerY, noticeY: bannerY + 60 };
}

// un punto del mundo como "entidad" ordenable: se dibuja con su función cuando le toca
// (o: orden de su casilla; bias: dentro de la casilla, algo más cerca que su z real)
function point(cam, list, x, y, z, fn, o, bias = 0) {
  const q = toCam(cam, x, y, z);
  if (q.z < NEAR * 2) return;
  const P = scr(cam, q);
  if (P.x < -200 || P.x > cam.w + 200 || P.y < -200 || P.y > cam.h + 200) return;
  list.push({ z: q.z + bias, o, fn: () => fn({ ...P, s: cam.focal / q.z }) });
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
    if (d.glyph) { let x = 0, y = 0; for (const q of d.pts) { x += q.x; y += q.y; } glyph(ctx, d.glyph, x / d.pts.length, y / d.pts.length, d.gsize || 22); }
  }
}

// BARRA DEL JEFE: su nombre y su vida, encima de los botones
// SALAS ESPECIALES: el reloj del desafío y las oleadas que quedan
function roomBar(ctx, room, W, H, t) {
  let txt = null, col = '#fff';
  if (room.type === 'challenge' && !room.cleared) { txt = room.timer > 0 ? `⏱️ ${Math.ceil(room.timer)} s · límpiala a tiempo` : '⏱️ Sin premio: se acabó el tiempo'; col = room.timer > 0 && room.timer < 6 && Math.floor(t * 4) % 2 ? '#ff2d55' : '#ffe600'; }
  else if (room.type === 'waves' && !room.cleared) { txt = `🌊 Oleada ${3 - (room.waves?.length || 0)}/3`; col = '#7df9ff'; }
  if (!txt) return;
  const y = H - 170;
  ctx.font = '900 13px system-ui, sans-serif';
  const w = ctx.measureText(txt).width + 24;
  ctx.fillStyle = 'rgba(0,0,0,.6)';
  ctx.fillRect(W / 2 - w / 2, y - 14, w, 28);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = col;
  ctx.fillText(txt, W / 2, y);
}

function bossBar(ctx, room, W, H, t) {
  const all = room.enemies.filter((e) => e.kind === 'boss' && (e.alive || e.downT > 0));
  const b = all.find((e) => e.alive) || all[0];
  if (!b) return;
  const B = BOSSES[b.boss], w = Math.min(W - 40, 320), x = (W - w) / 2, y = H - 178;
  ctx.fillStyle = 'rgba(0,0,0,.6)';
  ctx.fillRect(x - 6, y - 22, w + 12, 40);
  ctx.font = '900 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = B.color;
  ctx.fillText(`💀 ${B.name}${b.phase === 2 ? ' · FASE 2' : ''}${b.stun > 0 && b.boss === 'guardian' ? ' · ¡VULNERABLE!' : ''}`, W / 2, y - 10);
  if (all.length > 1) { // FUSIÓN: un núcleo por mitad
    all.forEach((c, i) => {
      const bx = x + i * (w / 2 + 4), bw = w / 2 - 4;
      ctx.fillStyle = 'rgba(255,255,255,.15)';
      ctx.fillRect(bx, y, bw, 9);
      ctx.fillStyle = c.alive ? B.color : `rgba(255,230,0,${0.3 + 0.3 * Math.sin(t * 10)})`;
      ctx.fillRect(bx, y, bw * (c.alive ? Math.max(0, c.hp / c.max) : 1 - c.downT / 4), 9);
    });
    return;
  }
  ctx.fillStyle = 'rgba(255,255,255,.15)';
  ctx.fillRect(x, y, w, 9);
  ctx.fillStyle = b.stun > 0 && b.boss === 'guardian' && Math.floor(t * 8) % 2 ? '#ffe600' : B.color;
  ctx.fillRect(x, y, w * Math.max(0, b.hp / b.max), 9);
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.fillRect(x + w / 2 - 1, y - 2, 2, 13); // la mitad: ahí cambia de fase
}

// MINIMAPA: salas vistas (con su icono), las conocidas por una puerta y dónde estás
function minimap(ctx, s, W) {
  const cell = 15, gap = 3, size = 5 * (cell + gap), x0 = W - size - 12, y0 = 64;
  const rooms = s.floor.rooms;
  const known = new Set(s.visited);
  for (const id of s.visited) for (const n of Object.values(openDoors(s, id))) known.add(n);
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
