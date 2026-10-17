// GALAXIA: lógica de vuelo, minería, estación y reaparición. Vista pseudo-3D detrás de la nave.
// Relajado: si te destruyen, te remolcan a la estación (pierdes la carga, no la partida).
import { G } from './state.js';
import { makeRng } from './rng.js';
import { save, persist } from './save.js';
import { fx } from './fx.js';
import { sfx, music, musicStart, musicStop, musicDuck } from './audio.js';
import { basis, add, sub, scale, norm, dist, chaseCam, angleTo, lookAngles, project } from './space3d.js';
import { shipStats, makeSystem, makeAsteroid, cargoCount, ORES, UPGRADES, upgradeCost, repairCost, objective } from './galaxyData.js';
import { SHIPS } from './upgrades.js';
import { progress } from './game.js';
import { ui } from './ui.js';

const S = () => G.space;
const DOCK_R = 150;
const MAGNET_R = 75;

const gal = () => save.galaxy;
const stats = () => shipStats(gal().up);

// ---------- Inicio ----------
export function newSpace() {
  const forced = G.debug ? new URLSearchParams(location.search).get('seed') : null;
  const sys = makeSystem(1, { name: 'ORIGEN' });
  const st = stats();
  const s = {
    sys, rng: makeRng(forced !== null ? Number(forced) >>> 0 : (Math.random() * 2 ** 32) >>> 0),
    ship: { pos: { ...sys.station.pos }, yaw: 0, pitch: 0, roll: 0, shield: st.shield, hull: gal().hull ?? st.hull, boostT: 0, boostCd: 0, fireT: 0, hitT: 9, side: 1 },
    input: { x: 0, y: 0 }, firing: false, bolts: [], ores: [], cam: null, t: 0, canDock: false, fullWarned: false,
    objective: null, target: null,
  };
  undockPose(s);
  G.space = s;
  G.run = null;
  G.mode = 'galaxy';
  G.timeWarp = 1;
  fx.clear();
  ui.hideAll();
  ui.showSpaceHUD(true);
  music.biome = 3;
  music.intensity = 0;
  musicStart();
  if (!gal().started) {
    gal().started = true;
    persist();
    fx.banner('🌌 BIENVENIDO A ORIGEN', 'arrastra para virar · tu nave avanza sola', '#7df9ff', true);
  }
  progress('galaxy');
}

// colocarse fuera de la estación, mirando hacia fuera del sol: el cinturón está más allá
function undockPose(s) {
  const st = s.sys.station.pos;
  const out = norm({ x: st.x, y: 0, z: st.z });
  s.ship.pos = add(st, scale(out, DOCK_R * 0.9));
  s.ship.yaw = lookAngles(s.ship.pos, add(s.ship.pos, out)).yaw;
  s.ship.pitch = 0;
  s.cam = null;
}

// ---------- Acciones ----------
export function spaceBoost() {
  const s = S();
  if (!s || G.mode !== 'galaxy' || s.ship.boostCd > 0) return;
  s.ship.boostT = 1.6;
  s.ship.boostCd = 3.5;
  sfx.dash();
  fx.vibe(20);
}

export function dock() {
  const s = S();
  if (!s || G.mode !== 'galaxy' || !s.canDock) return;
  G.mode = 'station';
  musicDuck(true);
  sfx.chest();
  gal().hull = s.ship.hull;
  persist();
  ui.showStation(s);
  progress('dock');
}

export function undock() {
  const s = S();
  if (!s || G.mode !== 'station') return;
  undockPose(s);
  s.ship.shield = stats().shield;
  G.mode = 'galaxy';
  musicDuck(false);
  ui.hideAll();
  ui.showSpaceHUD(true);
}

export function sellAll() {
  const s = S(), g = gal();
  let got = 0;
  for (const [k, n] of Object.entries(g.cargo)) {
    got += n * ORES[k].price;
    g.cargo[k] = 0;
  }
  if (!got) return 0;
  g.credits += got;
  g.sold = true;
  g.earned = (g.earned || 0) + got;
  progress('galaxyCredits', got);
  sfx.chest();
  persist();
  void s;
  return got;
}

export function buyUpgrade(id) {
  const g = gal();
  const lvl = g.up[id] || 0;
  const c = upgradeCost(id, lvl);
  if (c === null || g.credits < c) return false;
  g.credits -= c;
  g.up[id] = lvl + 1;
  progress('galaxyUpgrade');
  sfx.milestone();
  persist();
  return true;
}

export function repair() {
  const s = S(), g = gal(), st = stats();
  const c = repairCost(s.ship.hull, st.hull);
  if (!c || g.credits < c) return false;
  g.credits -= c;
  s.ship.hull = st.hull;
  g.hull = st.hull;
  persist();
  return true;
}

// ---------- Daño y reaparición ----------
function hurt(s, dmg) {
  if (G.god) return;
  const sh = s.ship;
  sh.hitT = 0;
  const toShield = Math.min(sh.shield, dmg);
  sh.shield -= toShield;
  sh.hull -= dmg - toShield;
  fx.shake(10);
  fx.flash(toShield >= dmg ? '#7df9ff' : '#f33', 0.3);
  fx.vibe(40);
  sfx.shield();
  if (sh.hull <= 0) respawn(s);
}

// Relajado: te remolcan a la estación; pierdes la carga, no el progreso
function respawn(s) {
  const g = gal();
  for (const k of Object.keys(g.cargo)) g.cargo[k] = 0;
  const st = stats();
  s.ship.hull = st.hull;
  s.ship.shield = st.shield;
  g.hull = st.hull;
  s.ores = [];
  persist();
  undockPose(s);
  fx.banner('💥 NAVE DESTRUIDA', 'te han remolcado a la estación · has perdido la carga', '#ff6b6b', true);
  sfx.die();
}

// ---------- Bucle ----------
export function updateSpace(dt) {
  const s = S();
  if (!s || G.mode !== 'galaxy') return;
  const sh = s.ship, st = stats(), g = gal();
  s.t += dt;
  // virar: el dedo (o las teclas) mueve el morro; la velocidad es automática
  const ix = Math.max(-1, Math.min(1, s.input.x)), iy = Math.max(-1, Math.min(1, s.input.y));
  sh.yaw += ix * st.turn * dt;
  sh.pitch = Math.max(-1.2, Math.min(1.2, sh.pitch - iy * st.turn * 0.8 * dt));
  sh.roll += (-ix * 0.7 - sh.roll) * Math.min(1, dt * 6);
  sh.boostT = Math.max(0, sh.boostT - dt);
  sh.boostCd = Math.max(0, sh.boostCd - dt);
  // al virar fuerte la nave afloja sola (como en un arcade): si no, describe círculos alrededor del objetivo
  const turning = Math.min(1, Math.hypot(ix, iy));
  const speed = st.speed * (sh.boostT > 0 ? st.boost : 1) * (1 - 0.55 * turning);
  sh.speed = speed;
  const b = basis(sh.yaw, sh.pitch);
  sh.pos = add(sh.pos, scale(b.f, speed * dt));
  // escudo: se regenera tras 2 s sin daño
  sh.hitT += dt;
  if (sh.hitT > 2) sh.shield = Math.min(st.shield, sh.shield + st.regen * dt);

  // el sol quema
  const ds = dist(sh.pos, s.sys.sun.pos);
  if (ds < s.sys.sun.r + 60) {
    sh.pos = add(s.sys.sun.pos, scale(norm(sub(sh.pos, s.sys.sun.pos)), s.sys.sun.r + 60));
    hurt(s, 20 * dt * 10);
    fx.notice('🔥 ¡Demasiado cerca del sol!', '#ff9f0a');
  }

  // disparo (con autoapuntado suave hacia lo que tengas delante)
  sh.fireT -= dt;
  if (s.firing && sh.fireT <= 0) {
    sh.fireT = st.fireCd;
    let dir = b.f;
    let best = null, bestA = 0.3;
    for (const a of s.sys.asteroids) {
      if (!a.alive) continue;
      const d = dist(a.pos, sh.pos);
      if (d > 750) continue;
      const ang = angleTo(sh.pos, sh.yaw, sh.pitch, a.pos);
      if (ang < bestA) { bestA = ang; best = a; }
    }
    if (best) dir = norm(sub(best.pos, sh.pos));
    sh.side = -sh.side;
    const from = add(add(sh.pos, scale(b.r, sh.side * 2.2)), scale(b.f, 4));
    s.bolts.push({ pos: from, vel: add(scale(dir, 950), scale(b.f, speed)), life: 0.85, dmg: st.dmg });
    sfx.swish();
  }

  // proyectiles contra asteroides
  for (const bo of s.bolts) {
    bo.life -= dt;
    bo.pos = add(bo.pos, scale(bo.vel, dt));
    for (const a of s.sys.asteroids) {
      if (!a.alive || dist(a.pos, bo.pos) > a.r + 3) continue;
      bo.life = 0;
      a.hp -= bo.dmg;
      a.flash = 0.08;
      const p = s.cam && project(s.cam, bo.pos);
      if (p) fx.burst(p.x, p.y, 5, '#ffd9a0', 160, 2.5, 0.25, 0);
      if (a.hp <= 0) breakAsteroid(s, a);
      break;
    }
  }
  s.bolts = s.bolts.filter((bo) => bo.life > 0);

  // asteroides: giran; chocar con ellos duele y rebota
  for (const a of s.sys.asteroids) {
    if (!a.alive) continue;
    a.rot += a.spin * dt;
    a.flash = Math.max(0, (a.flash || 0) - dt);
    const d = dist(a.pos, sh.pos);
    if (d < a.r + 4) {
      sh.pos = add(a.pos, scale(norm(sub(sh.pos, a.pos)), a.r + 5));
      hurt(s, 12);
    }
  }
  // repoblar el cinturón lejos de ti (siempre hay qué minar)
  const alive = s.sys.asteroids.filter((a) => a.alive);
  if (alive.length < 60) {
    const a = s.rng.range(0, Math.PI * 2), R = s.sys.beltR + s.rng.range(-130, 130);
    const pos = { x: Math.cos(a) * R, y: s.rng.range(-60, 60), z: Math.sin(a) * R };
    if (dist(pos, sh.pos) > 500) s.sys.asteroids.push(makeAsteroid(s.rng, pos, s.rng.range(9, 22), 'iron'));
  }
  s.sys.asteroids = s.sys.asteroids.filter((a) => a.alive);

  // mineral: imán y recogida
  const cap = st.cargo;
  for (const o of s.ores) {
    o.life -= dt;
    o.pos = add(o.pos, scale(o.vel, dt));
    o.vel = scale(o.vel, 1 - Math.min(1, dt * 1.5));
    const d = dist(o.pos, sh.pos);
    if (d < MAGNET_R && cargoCount(g.cargo) < cap) o.vel = add(o.vel, scale(norm(sub(sh.pos, o.pos)), 900 * dt));
    if (d < 9) {
      if (cargoCount(g.cargo) < cap) {
        g.cargo[o.ore] = (g.cargo[o.ore] || 0) + 1;
        o.life = 0;
        sfx.coin(cargoCount(g.cargo) % 12);
        progress('ore');
      } else if (!s.fullWarned) {
        s.fullWarned = true;
        fx.notice('📦 Bodega llena: vuelve a la estación', '#ffe600');
      }
    }
  }
  s.ores = s.ores.filter((o) => o.life > 0);
  if (cargoCount(g.cargo) < cap) s.fullWarned = false;

  // estación: gira y deja atracar si estás cerca
  s.sys.station.spin += dt * 0.25;
  s.canDock = dist(sh.pos, s.sys.station.pos) < DOCK_R;

  // objetivo actual y brújula
  s.objective = objective({ cargo: g.cargo, cargoMax: cap, credits: g.credits, up: g.up, sold: g.sold });
  if (s.objective.kind === 'mine') {
    let best = null, bd = Infinity;
    for (const a of s.sys.asteroids) { const d = dist(a.pos, sh.pos); if (d < bd) { bd = d; best = a; } }
    s.target = best ? best.pos : null;
  } else s.target = s.sys.station.pos;

  s.cam = chaseCam(s.cam, sh, dt, G.W || 375, G.H || 812);
}

function breakAsteroid(s, a) {
  a.alive = false;
  const p = s.cam && project(s.cam, a.pos);
  if (p) {
    fx.burst(p.x, p.y, 18, '#c9b8a0', 320, 4, 0.5, 0);
    fx.burst(p.x, p.y, 8, ORES[a.ore].color, 240, 3, 0.6, 0);
  }
  sfx.brk();
  fx.shake(4);
  // los grandes se parten en dos
  if (a.r > 14) {
    for (let i = 0; i < 2; i++) {
      const off = { x: s.rng.range(-1, 1), y: s.rng.range(-1, 1), z: s.rng.range(-1, 1) };
      s.sys.asteroids.push(makeAsteroid(s.rng, add(a.pos, scale(norm(off), a.r * 0.6)), a.r * 0.55, a.ore));
    }
  }
  const n = Math.max(1, Math.round(a.r / 6));
  for (let i = 0; i < n; i++) {
    const v = { x: s.rng.range(-1, 1), y: s.rng.range(-1, 1), z: s.rng.range(-1, 1) };
    s.ores.push({ pos: { ...a.pos }, vel: scale(norm(v), s.rng.range(20, 50)), ore: a.ore, life: 40 });
  }
  progress('asteroid');
}

export const shipDef = () => SHIPS.find((x) => x.id === save.ship) || SHIPS[0];
export { UPGRADES, upgradeCost, repairCost, stats as spaceStats };

export function leaveSpace() {
  const s = S();
  if (s) gal().hull = s.ship.hull;
  persist();
  musicStop();
  G.space = null;
}
