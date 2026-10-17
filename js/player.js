// Nave del jugador: carriles, salto, deslizamiento, dash.
import { G, LANE_W } from './state.js';
import { sfx } from './audio.js';
import { fx } from './fx.js';
import { project } from './render.js';
import { quake, railUnder } from './world.js';
import { isActive } from './abilities.js';

export const RAIL_Y = 0.5; // altura a la que se recorre un riel

export function newPlayer() {
  return { lane: 0, x: 0, y: 0, vy: 0, air: false, jumps: 0, slide: 0, dash: 0, lastAction: 0, tilt: 0, invuln: 0, trailT: 0, grind: null };
}

export function playerBox() {
  const p = G.player;
  const low = p.slide > 0;
  return { x: p.x * LANE_W, hw: 0.3, y0: p.y, y1: p.y + (low ? 0.25 : 0.6) };
}

const inverted = () => G.run.event?.id === 'invert';

export function moveLane(dir) {
  const p = G.player, r = G.run;
  if (inverted()) dir = -dir;
  const target = p.lane + dir;
  if (target < -1 || target > 1 || target === r.blockedLane) {
    fx.shake(4);
    sfx.bump();
    return;
  }
  p.lane = target;
  p.lastAction = r.time;
  sfx.swish();
}

export function jump() {
  if (inverted()) return doSlide();
  doJump();
}

export function slide() {
  if (inverted()) return doJump();
  doSlide();
}

// Destino del GANCHO: el carril del extremo opuesto (desde el centro, el que esté libre).
// null si no hay ninguno válido (p.ej. el Pacto de cristal bloquea el destino).
export function hookTarget() {
  const p = G.player, r = G.run;
  const order = p.lane === -1 ? [1, 0] : p.lane === 1 ? [-1, 0] : [1, -1];
  return order.find((l) => l !== p.lane && l !== r.blockedLane) ?? null;
}

function doJump() {
  const p = G.player, s = G.run.stats;
  if (isActive(G.run.ability, 'ram')) return; // el ARIETE va pegado al suelo
  if (!p.air) {
    p.vy = s.jumpV;
    p.air = true;
    p.jumps = 1;
    p.slide = 0;
    sfx.jump();
  } else if (s.doubleJump && p.jumps < 2) {
    p.vy = s.jumpV * 0.92;
    p.jumps = 2;
    const sp = project(p.x * LANE_W, p.y, 0);
    if (sp) fx.ring(sp.x, sp.y, '#fff', 80, 0.3, 6);
    sfx.dbljump();
  } else return;
  p.lastAction = G.run.time;
}

function doSlide() {
  const p = G.player;
  if (p.air) p.vy = Math.min(p.vy, -G.run.stats.jumpV * 1.5); // caída rápida
  p.slide = 0.6;
  p.lastAction = G.run.time;
  sfx.slide();
}

export function dash() {
  const p = G.player, r = G.run;
  if (p.dash > 0 || r.dashCharges < 1 || r.noDash) {
    if (r.dashCharges < 1) sfx.bump();
    return;
  }
  r.dashCharges -= 1;
  p.dash = r.stats.dashDur;
  p.lastAction = r.time;
  sfx.dash();
  fx.shake(8);
  fx.flash('#9ff', 0.25);
  fx.vibe(25);
}

export function updatePlayer(dt) {
  const p = G.player, r = G.run, s = r.stats;
  const dx = p.lane - p.x;
  p.x += dx * (1 - Math.exp(-dt / (s.laneTime * 0.32)));
  if (Math.abs(dx) < 0.002) p.x = p.lane;
  p.tilt = dx;

  // GRIND: sobre un riel vas a altura fija; saltar o salirte del carril te suelta
  const rail = railUnder(p.x, r.dist);
  if (p.grind && (p.air || rail !== p.grind)) {
    p.grind = null;
    if (!p.air && p.y > 0) { p.air = true; p.vy = 0; }
  }
  if (!p.grind && rail && p.y <= RAIL_Y + 0.08 && (!p.air || p.vy <= 0)) {
    p.grind = rail;
    p.y = RAIL_Y;
    p.vy = 0;
    p.air = false;
    p.jumps = 0;
    sfx.land();
    const sp = project(p.x * LANE_W, RAIL_Y, 0);
    if (sp) fx.burst(sp.x, sp.y, 14, '#ffffff', 300, 3, 0.35, 200);
  }
  if (p.grind) p.y = RAIL_Y;

  if (p.air) {
    p.vy -= s.gravity * dt;
    p.y += p.vy * dt;
    // caer sobre un riel cuenta como aterrizar (se recoge arriba en el siguiente paso)
    if (railUnder(p.x, r.dist) && p.vy < 0 && p.y <= RAIL_Y && p.y > 0) {
      p.y = RAIL_Y;
      p.air = false;
      p.vy = 0;
    }
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      p.air = false;
      p.jumps = 0;
      sfx.land();
      const sp = project(p.x * LANE_W, 0, 0);
      if (sp) fx.burst(sp.x, sp.y, 10, '#fff', 200, 3, 0.3, 400);
      if (s.quake) quake();
    }
  }
  if (p.slide > 0) p.slide -= dt;
  if (p.dash > 0) p.dash -= dt;
  if (p.invuln > 0) p.invuln -= dt;

  if (r.dashCharges < s.dashMax) {
    r.dashCharges = Math.min(s.dashMax, r.dashCharges + dt / s.dashRecharge);
  }
}
