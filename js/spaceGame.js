// GALAXIA: lógica de vuelo, minería, combate, comercio, saltos y reaparición. Pseudo-3D detrás de la nave.
// Relajado: si te destruyen, te remolcan a tu estación base (pierdes la carga, no la partida), y
// junto a las estaciones hay zona segura (los piratas no entran).
import { G } from './state.js';
import { makeRng } from './rng.js';
import { save, persist } from './save.js';
import { fx } from './fx.js';
import { sfx, music, musicStart, musicStop, musicDuck } from './audio.js';
import { basis, add, sub, scale, norm, dist, chaseCam, angleTo, lookAngles, angDiff, project } from './space3d.js';
import { shipStats, makeSystem, makeAsteroid, cargoCount, ORES, UPGRADES, upgradeCost, repairCost, objective } from './galaxyData.js';
import { genGalaxy, canJump, jumpNeeded, route } from './galaxy.js';
import { poisOf, POI_KINDS, SCAN_TIME, SCAN_R, perksFor, ATLAS_PERKS, boardFor, advanceMissions, MAX_ACTIVE, MISSION_KINDS } from './galaxyMissions.js';
import { addXp } from './progress.js';
import { SHIPS } from './upgrades.js';
import { progress } from './game.js';
import { ui } from './ui.js';

const S = () => G.space;
const DOCK_R = 150;
const SAFE_R = 380; // zona segura alrededor de la estación
const MAGNET_R = 75;
export const GAL = genGalaxy();

const gal = () => save.galaxy;
// stats de la nave: mejoras del taller + mejoras únicas del ATLAS
export const atlasCount = () => Object.keys(save.galaxyAtlas).length;
const perks = () => perksFor(atlasCount());
const stats = () => {
  const st = shipStats(gal().up, save.ship);
  if (perks().includes('alien')) st.shield += 40;
  return st;
};

// ---------- Inicio y sistemas ----------
export function newSpace() {
  const forced = G.debug ? new URLSearchParams(location.search).get('seed') : null;
  const g = gal();
  if (!g.visited?.length) g.visited = [0];
  const st = stats();
  const s = {
    rng: makeRng(forced !== null ? Number(forced) >>> 0 : (Math.random() * 2 ** 32) >>> 0),
    ship: { pos: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, roll: 0, shield: st.shield, hull: g.hull ?? st.hull, boostT: 0, boostCd: 0, fireT: 0, hitT: 9, side: 1 },
    input: { x: 0, y: 0 }, firing: false, bolts: [], ebolts: [], ores: [], loot: [], pirates: [], cam: null, t: 0, canDock: false, fullWarned: false,
    objective: null, target: null, heat: 0, overheat: false, jumpT: 0, pirateT: 30, routeTo: null,
  };
  G.space = s;
  enterSystem(s, g.sys ?? 0, null);
  G.run = null;
  G.mode = 'galaxy';
  G.timeWarp = 1;
  fx.clear();
  ui.hideAll();
  ui.showSpaceHUD(true);
  music.intensity = 0;
  musicStart();
  if (!g.started) {
    g.started = true;
    persist();
    fx.banner('🌌 BIENVENIDO A ORIGEN', 'arrastra para virar · tu nave avanza sola', '#7df9ff', true);
  }
  progress('galaxy');
}

// Construye el sistema `id`. Si vienes de `fromId`, apareces junto a la puerta que lleva de vuelta.
function enterSystem(s, id, fromId) {
  const def = GAL[id];
  const gates = def.links.map((to) => ({ to, name: GAL[to].name, ang: Math.atan2(GAL[to].y - def.y, GAL[to].x - def.x) }));
  s.sysId = id;
  s.sys = makeSystem(id + 1, { name: def.name, sunColor: def.star.color, planets: def.planets, ore: def.ore, gates, danger: def.danger, asteroids: id === 0 ? 80 : 70 });
  s.pirates = [];
  s.ebolts = [];
  s.bolts = [];
  s.ores = [];
  s.loot = [];
  s.pirateT = 25;
  s.pois = poisOf(GAL, id);
  s.scanT = 0;
  s.freighter = null;
  const g = gal();
  g.sys = id;
  if (!g.visited.includes(id)) {
    g.visited.push(id);
    progress('systems', g.visited.length);
    if (fromId !== null) fx.banner(`🌌 ${def.name}`, `sistema nuevo · peligro ${'☠'.repeat(def.danger) || 'ninguno'}`, def.star.color, true);
  } else if (fromId !== null) fx.banner(`🌌 ${def.name}`, `peligro ${'☠'.repeat(def.danger) || 'ninguno'}`, def.star.color);
  music.biome = Math.min(3, def.danger);
  // piratas: los que tocan al llegar (ORIGEN es seguro)
  for (let i = 0; i < def.pirates; i++) spawnPirate(s, false);
  if (def.boss && !save.galaxyBoss[id]) spawnPirate(s, true);
  if (fromId !== null) {
    const back = s.sys.gates.find((gt) => gt.to === fromId);
    const inward = norm(scale(back.pos, -1));
    s.ship.pos = add(back.pos, scale(inward, 90));
    s.ship.yaw = lookAngles(s.ship.pos, add(s.ship.pos, inward)).yaw;
    s.ship.pitch = 0;
    s.cam = null;
  } else undockPose(s);
  persist();
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

// ---------- Piratas ----------
function spawnPirate(s, boss) {
  const def = GAL[s.sysId];
  const d = def.danger;
  const a = s.rng.range(0, Math.PI * 2), R = s.rng.range(700, 1300);
  const pos = { x: Math.cos(a) * R, y: s.rng.range(-120, 120), z: Math.sin(a) * R };
  if (dist(pos, s.sys.station.pos) < SAFE_R + 200) pos.x += 600;
  const hp = boss ? 400 + d * 120 : 30 + d * 14;
  s.pirates.push({
    pos, yaw: s.rng.range(-3, 3), pitch: 0, hp, max: hp, boss, alive: true, flash: 0, state: 'attack', t: 0,
    speed: (boss ? 70 : 85) + d * 7, turn: boss ? 1.1 : 1.7, fireCd: s.rng.range(1, 2), dmg: (boss ? 9 : 5) + d * 1.6,
    mesh: boss ? 'kaiju' : s.rng.pick(['raptor', 'viper', 'comet']), off: { x: s.rng.range(-1, 1), y: s.rng.range(-0.4, 0.4), z: s.rng.range(-1, 1) },
  });
  if (boss) fx.notice(`☠ Hay un JEFE PIRATA en ${def.name}`, '#ff2d55');
}

function updatePirates(s, dt) {
  const sh = s.ship, st = s.sys.station.pos;
  for (const p of s.pirates) {
    if (!p.alive) continue;
    p.t += dt;
    p.flash = Math.max(0, p.flash - dt);
    const d = dist(p.pos, sh.pos);
    const playerSafe = dist(sh.pos, st) < SAFE_R;
    // estados: atacar (pasada), evadir tras cruzarse, huir con poca vida, merodear si estás a salvo
    if (!p.boss && p.hp < p.max * 0.25 && p.state !== 'flee') { p.state = 'flee'; p.t = 0; }
    if (p.state === 'attack' && d < 70) { p.state = 'evade'; p.t = 0; }
    if (p.state === 'evade' && p.t > 1.4) p.state = 'attack';
    if (playerSafe && p.state === 'attack') p.state = 'patrol';
    if (p.state === 'patrol' && !playerSafe) p.state = 'attack';
    let target;
    const fr = s.freighter;
    if (p.raider && fr && fr.hp > 0) {
      target = fr.pos;
      p.state = 'attack';
    } else if (p.state === 'attack') {
      // apunta a donde vas a estar (te adelanta un poco)
      target = add(sh.pos, scale(basis(sh.yaw, sh.pitch).f, (sh.speed || 90) * Math.min(1, d / 400)));
    } else if (p.state === 'evade') target = add(p.pos, scale(norm(add(p.off, basis(p.yaw, p.pitch).f)), 300));
    else if (p.state === 'flee') target = add(p.pos, scale(norm(sub(p.pos, sh.pos)), 500));
    else target = add(st, scale(norm(sub(p.pos, st)), SAFE_R + 260)); // ronda fuera de la zona segura
    const want = lookAngles(p.pos, target);
    p.yaw += Math.max(-p.turn * dt, Math.min(p.turn * dt, angDiff(want.yaw, p.yaw)));
    p.pitch += Math.max(-p.turn * dt, Math.min(p.turn * dt, want.pitch - p.pitch));
    p.pitch = Math.max(-1.1, Math.min(1.1, p.pitch));
    const f = basis(p.yaw, p.pitch).f;
    p.pos = add(p.pos, scale(f, p.speed * (p.state === 'flee' ? 1.3 : 1) * dt));
    // nunca dentro de la zona segura
    const ds = dist(p.pos, st);
    if (ds < SAFE_R) p.pos = add(st, scale(norm(sub(p.pos, st)), SAFE_R));
    // disparo: alineado contigo y a tiro
    p.fireCd -= dt;
    const aim = p.raider && s.freighter ? s.freighter.pos : sh.pos;
    const dAim = dist(p.pos, aim);
    if (p.state === 'attack' && dAim < 520 && p.fireCd <= 0 && angleTo(p.pos, p.yaw, p.pitch, aim) < (p.boss ? 0.35 : 0.18) && (p.raider || !playerSafe)) {
      p.fireCd = p.boss ? 0.9 : Math.max(0.5, 1.2 - GAL[s.sysId].danger * 0.08);
      const dirs = p.boss ? [-0.12, 0, 0.12] : [0];
      for (const off of dirs) {
        const b = basis(p.yaw + off, p.pitch);
        s.ebolts.push({ pos: add(p.pos, scale(b.f, 6)), vel: scale(b.f, 520 + p.speed), life: 1.3, dmg: p.dmg });
      }
      sfx.bump();
    }
    if (p.state === 'flee' && d > 1600) p.alive = false; // se escapó
  }
  // balas enemigas (al carguero también)
  for (const b of s.ebolts) {
    b.life -= dt;
    b.pos = add(b.pos, scale(b.vel, dt));
    if (s.freighter && dist(b.pos, s.freighter.pos) < 14) {
      b.life = 0;
      s.freighter.hp -= b.dmg;
      s.freighter.flash = 0.1;
      continue;
    }
    if (dist(b.pos, sh.pos) < 6) {
      b.life = 0;
      if (dist(sh.pos, st) >= SAFE_R) hurt(s, b.dmg);
    }
  }
  s.ebolts = s.ebolts.filter((b) => b.life > 0);
  s.pirates = s.pirates.filter((p) => p.alive);
  // refuerzos de vez en cuando (si el sistema tiene piratas)
  const def = GAL[s.sysId];
  s.pirateT -= dt;
  if (def.pirates && s.pirateT <= 0) {
    s.pirateT = 45;
    if (s.pirates.filter((p) => !p.boss).length < def.pirates) spawnPirate(s, false);
  }
}

function killPirate(s, p) {
  p.alive = false;
  const pp = s.cam && project(s.cam, p.pos);
  if (pp) {
    for (const c of ['#ff2d55', '#ffe600', '#fff']) fx.burst(pp.x, pp.y, p.boss ? 60 : 22, c, p.boss ? 600 : 380, 5, 0.7, 0);
    fx.ring(pp.x, pp.y, '#ff9f0a', p.boss ? 400 : 160, 0.4, 10);
  }
  sfx.boom();
  fx.shake(p.boss ? 25 : 8);
  const d = GAL[s.sysId].danger;
  const value = (p.boss ? 600 + d * 150 : 25 + d * 18) * (perks().includes('oracle') ? 2 : 1);
  s.loot.push({ pos: { ...p.pos }, credits: value, life: 60 });
  if (p.boss) {
    save.galaxyBoss[s.sysId] = true;
    fx.banner('☠ JEFE PIRATA DERROTADO', `+${value} 💰 al recogerlo`, '#ffe600', true);
    progress('pirateBoss');
  }
  progress('pirate');
  missionEvent(s, { type: 'kill', sys: s.sysId });
}

// ---------- Acciones ----------
export function spaceBoost() {
  const s = S();
  if (!s || G.mode !== 'galaxy' || s.ship.boostCd > 0) return;
  s.ship.boostT = 1.6;
  s.ship.boostCd = perks().includes('warp') ? 2.3 : 3.5;
  sfx.dash();
  fx.vibe(20);
}

export function dock() {
  const s = S();
  if (!s || G.mode !== 'galaxy' || !s.canDock) return;
  G.mode = 'station';
  musicDuck(true);
  sfx.chest();
  const g = gal();
  g.hull = s.ship.hull;
  g.home = s.sysId; // aquí reapareces si te destruyen
  missionEvent(s, { type: 'dock', sys: s.sysId });
  persist();
  ui.showStation(s);
  progress('dock');
}

export function undock() {
  const s = S();
  if (!s || G.mode !== 'station') return;
  undockPose(s);
  s.ship.shield = stats().shield;
  const esc = gal().missions.find((m) => m.kind === 'escort' && m.sys === s.sysId && m.progress < m.n);
  if (esc && !s.freighter) startEscort(s, esc);
  G.mode = 'galaxy';
  musicDuck(false);
  ui.hideAll();
  ui.showSpaceHUD(true);
}

// precio al que compra/vende ESTA estación
export const stationPrices = (sysId = S()?.sysId ?? 0) => GAL[sysId].prices;
export const buyPrice = (ore, sysId) => Math.round(stationPrices(sysId)[ore] * 1.2);

export function sellAll() {
  const g = gal(), prices = stationPrices();
  let got = 0;
  for (const [k, n] of Object.entries(g.cargo)) {
    got += n * prices[k];
    g.cargo[k] = 0;
  }
  if (!got) return 0;
  g.credits += got;
  g.sold = true;
  g.earned = (g.earned || 0) + got;
  progress('galaxyCredits', got);
  sfx.chest();
  persist();
  return got;
}

// COMERCIO: comprar el mineral de este sistema para venderlo más caro en otro
export function buyOre(ore, n = 1) {
  const g = gal(), price = buyPrice(ore);
  const space = stats().cargo - cargoCount(g.cargo);
  const k = Math.min(n, space, Math.floor(g.credits / price));
  if (k <= 0) return 0;
  g.credits -= k * price;
  g.cargo[ore] = (g.cargo[ore] || 0) + k;
  sfx.coin(3);
  persist();
  return k;
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

// Mapa galáctico: elegir destino (la brújula guía puerta a puerta)
export function setRoute(to) {
  const s = S();
  if (!s) return;
  s.routeTo = to === s.sysId ? null : to;
}

// ---------- Misiones ----------
export function boardNow(s = S()) {
  const g = gal();
  const taken = new Set(g.missions.map((m) => m.id));
  return boardFor(GAL, s.sysId, g.boardSeq || 0, { jumpLvl: g.up.jump || 0, discovered: save.galaxyAtlas }).filter((m) => !taken.has(m.id));
}

export function acceptMission(m) {
  const g = gal();
  if (g.missions.length >= MAX_ACTIVE || g.missions.some((x) => x.id === m.id)) return false;
  g.missions.push({ ...m });
  persist();
  sfx.card();
  return true;
}

export function abandonMission(id) {
  const g = gal();
  g.missions = g.missions.filter((m) => m.id !== id);
  persist();
}

// Un suceso avanza las misiones; las cumplidas se cobran al momento (la entrega, al atracar)
function missionEvent(s, ev) {
  const g = gal();
  const done = advanceMissions(g.missions, ev);
  for (const m of done) {
    g.credits += m.reward;
    save.gems += m.gems;
    addXp(save, m.reward / 2);
    g.boardSeq = (g.boardSeq || 0) + 1;
    fx.banner(`✔ MISIÓN: ${MISSION_KINDS[m.kind].name.toUpperCase()}`, `+${m.reward} 💰 · +${m.gems} 💎`, '#30d158', true);
    sfx.milestone();
    progress('gmission');
  }
  if (done.length) {
    g.missions = g.missions.filter((m) => m.progress < m.n);
    persist();
  }
}

// ESCOLTA: un carguero sale de la estación hacia una puerta; los incursores van a por él
function startEscort(s, m) {
  const gate = s.sys.gates.find((gt) => gt.to === m.gate);
  if (!gate) return;
  const from = add(s.sys.station.pos, scale(norm(sub(gate.pos, s.sys.station.pos)), 60));
  s.freighter = { pos: from, to: gate.pos, gate: m.gate, hp: 260, max: 260, speed: 55, flash: 0, raidT: 6 };
  fx.notice('🛡️ Escolta: protege al carguero hasta la puerta', '#30d158');
}

function updateEscort(s, dt) {
  const fr = s.freighter;
  if (!fr) return;
  fr.flash = Math.max(0, fr.flash - dt);
  const dir = norm(sub(fr.to, fr.pos));
  fr.pos = add(fr.pos, scale(dir, fr.speed * dt));
  fr.yaw = Math.atan2(dir.x, dir.z);
  // incursores: dos piratas que salen a por él cuando deja la zona segura
  fr.raidT -= dt;
  if (fr.raidT <= 0 && !fr.raided) {
    fr.raided = true;
    for (let i = 0; i < 2; i++) {
      spawnPirate(s, false);
      const p = s.pirates[s.pirates.length - 1];
      p.raider = true;
      p.pos = add(fr.pos, { x: s.rng.range(-500, 500), y: s.rng.range(-80, 80), z: s.rng.range(-500, 500) });
    }
    fx.notice('☠ ¡Incursores a por el carguero!', '#ff2d55');
    sfx.alarm();
  }
  if (fr.hp <= 0) {
    s.freighter = null;
    const g = gal();
    g.missions = g.missions.filter((m) => !(m.kind === 'escort' && m.sys === s.sysId));
    persist();
    fx.banner('✖ CARGUERO DESTRUIDO', 'misión fallida', '#ff6b6b', true);
    sfx.die();
    return;
  }
  if (dist(fr.pos, fr.to) < 50) {
    s.freighter = null;
    missionEvent(s, { type: 'escort', sys: s.sysId, gate: fr.gate });
  }
}

// ---------- Descubrimientos ----------
function updateScan(s, dt) {
  const sh = s.ship;
  const poi = s.pois.find((p) => !save.galaxyAtlas[p.id] && dist(p.pos, sh.pos) < SCAN_R);
  s.scanning = poi || null;
  if (!poi) { s.scanT = Math.max(0, s.scanT - dt * 2); return; }
  s.scanT += dt;
  if (s.scanT < SCAN_TIME) return;
  s.scanT = 0;
  const before = perks();
  save.galaxyAtlas[poi.id] = true;
  const g = gal();
  g.credits += poi.reward;
  addXp(save, poi.reward);
  fx.banner(`${POI_KINDS[poi.kind].icon} ${POI_KINDS[poi.kind].name.toUpperCase()} DESCUBIERTA`, poi.lore, POI_KINDS[poi.kind].color, true);
  fx.notice(`+${poi.reward} 💰 · ATLAS ${atlasCount()}`, '#ffe600');
  sfx.chest();
  progress('discover');
  missionEvent(s, { type: 'scan', poi: poi.id });
  const fresh = ATLAS_PERKS.filter((pk) => perks().includes(pk.id) && !before.includes(pk.id));
  for (const pk of fresh) fx.banner(`✨ ${pk.name}`, pk.desc, '#ffe600', true);
  persist();
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

// Relajado: te remolcan a tu estación base; pierdes la carga, no el progreso
function respawn(s) {
  const g = gal();
  for (const k of Object.keys(g.cargo)) g.cargo[k] = 0;
  const st = stats();
  s.ship.hull = st.hull;
  s.ship.shield = st.shield;
  g.hull = st.hull;
  const home = g.home ?? 0;
  if (home !== s.sysId) enterSystem(s, home, null);
  else {
    s.ores = [];
    undockPose(s);
  }
  persist();
  fx.banner('💥 NAVE DESTRUIDA', `te han remolcado a ${GAL[home].name} · has perdido la carga`, '#ff6b6b', true);
  sfx.die();
}

// ---------- Bucle ----------
export function updateSpace(dt) {
  const s = S();
  if (!s || G.mode !== 'galaxy') return;
  const sh = s.ship, st = stats(), g = gal();
  s.t += dt;
  // SALTO en curso: túnel de hiperespacio y aparición en el sistema nuevo
  if (s.jumpT > 0) {
    s.jumpT -= dt;
    sh.pos = add(sh.pos, scale(basis(sh.yaw, sh.pitch).f, 600 * dt));
    if (s.jumpT <= 0) {
      const from = s.sysId;
      enterSystem(s, s.jumpTo, from);
      progress('jump');
    }
    s.cam = chaseCam(s.cam, sh, dt, G.W || 375, G.H || 812);
    return;
  }
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

  // láser: se calienta al disparar; sobrecalentado, no dispara hasta enfriarse
  s.heat = Math.max(0, s.heat - dt * 0.45);
  if (s.overheat && s.heat < 0.35) s.overheat = false;
  sh.fireT -= dt;
  if (s.firing && sh.fireT <= 0 && !s.overheat) {
    sh.fireT = st.fireCd;
    s.heat += 0.06;
    if (s.heat >= 1) { s.overheat = true; fx.notice('🌡️ Láser sobrecalentado', '#ff6a00'); sfx.bump(); }
    // autoapuntado suave: primero piratas, luego asteroides
    let dir = b.f, best = null, bestA = 0.3;
    for (const p of s.pirates) {
      const d = dist(p.pos, sh.pos), ang = angleTo(sh.pos, sh.yaw, sh.pitch, p.pos);
      if (d < 800 && ang < 0.35 && (!best || ang < bestA)) { best = p.pos; bestA = ang; }
    }
    if (!best) {
      for (const a of s.sys.asteroids) {
        if (dist(a.pos, sh.pos) > 750) continue;
        const ang = angleTo(sh.pos, sh.yaw, sh.pitch, a.pos);
        if (ang < bestA) { bestA = ang; best = a.pos; }
      }
    }
    if (best) dir = norm(sub(best, sh.pos));
    sh.side = -sh.side;
    const from = add(add(sh.pos, scale(b.r, sh.side * 2.2)), scale(b.f, 4));
    s.bolts.push({ pos: from, vel: add(scale(dir, 950), scale(b.f, speed)), life: 0.85, dmg: st.dmg });
    sfx.swish();
  }

  // tus proyectiles: piratas y asteroides
  for (const bo of s.bolts) {
    bo.life -= dt;
    bo.pos = add(bo.pos, scale(bo.vel, dt));
    let hit = false;
    for (const p of s.pirates) {
      if (!p.alive || dist(p.pos, bo.pos) > (p.boss ? 20 : 8)) continue;
      p.hp -= bo.dmg;
      p.flash = 0.08;
      if (p.state === 'patrol') p.state = 'attack';
      if (p.hp <= 0) killPirate(s, p);
      hit = true;
      break;
    }
    if (!hit) {
      for (const a of s.sys.asteroids) {
        if (!a.alive || dist(a.pos, bo.pos) > a.r + 3) continue;
        a.hp -= bo.dmg;
        a.flash = 0.08;
        if (a.hp <= 0) breakAsteroid(s, a);
        hit = true;
        break;
      }
    }
    if (hit) {
      bo.life = 0;
      const p = s.cam && project(s.cam, bo.pos);
      if (p) fx.burst(p.x, p.y, 5, '#ffd9a0', 160, 2.5, 0.25, 0);
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
  if (alive.length < 55) {
    const a = s.rng.range(0, Math.PI * 2), R = s.sys.beltR + s.rng.range(-130, 130);
    const pos = { x: Math.cos(a) * R, y: s.rng.range(-60, 60), z: Math.sin(a) * R };
    if (dist(pos, sh.pos) > 500) s.sys.asteroids.push(makeAsteroid(s.rng, pos, s.rng.range(9, 22), s.sys.ore));
  }
  s.sys.asteroids = s.sys.asteroids.filter((a) => a.alive);

  updatePirates(s, dt);
  updateEscort(s, dt);
  updateScan(s, dt);

  // mineral y botín: imán y recogida
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
  for (const l of s.loot) {
    l.life -= dt;
    const d = dist(l.pos, sh.pos);
    if (d < MAGNET_R * 1.6) l.pos = add(l.pos, scale(norm(sub(sh.pos, l.pos)), Math.min(d, 400 * dt)));
    if (d < 10) {
      l.life = 0;
      g.credits += l.credits;
      persist();
      fx.notice(`+${l.credits} 💰`, '#ffe600');
      sfx.chest();
    }
  }
  s.loot = s.loot.filter((l) => l.life > 0);
  if (cargoCount(g.cargo) < cap) s.fullWarned = false;

  // estación: gira y deja atracar si estás cerca
  s.sys.station.spin += dt * 0.25;
  s.canDock = dist(sh.pos, s.sys.station.pos) < DOCK_R;

  // PUERTAS DE SALTO: atravesarlas te lleva al sistema vecino (si tu Salto da)
  for (const gt of s.sys.gates) {
    if (dist(gt.pos, sh.pos) > gt.r) continue;
    const to = GAL[gt.to];
    if (!canJump(to, g.up.jump || 0)) {
      if (!s.gateWarnT || s.t - s.gateWarnT > 2) {
        s.gateWarnT = s.t;
        fx.notice(`🌀 ${to.name} necesita Salto ${jumpNeeded(to)} (mejóralo en el taller)`, '#ff9f0a');
        sfx.bump();
      }
      // rebota hacia dentro
      sh.yaw += Math.PI;
      sh.pos = add(gt.pos, scale(norm(scale(gt.pos, -1)), gt.r + 30));
      continue;
    }
    s.jumpT = 1.1;
    s.jumpTo = gt.to;
    fx.flash('#ffffff', 0.8);
    fx.banner('🌀 SALTO', `rumbo a ${to.name}`, '#7df9ff', true);
    sfx.od();
    break;
  }

  // objetivo actual y brújula
  updateObjective(s);
  s.cam = chaseCam(s.cam, sh, dt, G.W || 375, G.H || 812);
}

function updateObjective(s) {
  const g = gal(), sh = s.ship;
  if (s.routeTo !== null && s.routeTo === s.sysId) s.routeTo = null;
  if (s.routeTo !== null) {
    const path = route(GAL, s.sysId, s.routeTo);
    const next = path && path[1];
    const gate = s.sys.gates.find((gt) => gt.to === next);
    if (gate) {
      s.objective = { kind: 'route', text: `Rumbo a ${GAL[s.routeTo].name}: cruza la puerta hacia ${GAL[next].name}` };
      s.target = gate.pos;
      return;
    }
  }
  // MISIÓN activa: te lleva al sistema y, allí, a su objetivo
  const m = g.missions.find((x) => x.progress < x.n);
  if (m && !(cargoCount(g.cargo) >= stats().cargo)) {
    if (m.sys !== s.sysId) {
      const path = route(GAL, s.sysId, m.sys);
      const gate = path && s.sys.gates.find((gt) => gt.to === path[1]);
      if (gate) {
        s.objective = { kind: 'mission', text: `${MISSION_KINDS[m.kind].icon} ${m.text} · ve a ${GAL[m.sys].name}` };
        s.target = gate.pos;
        return;
      }
    } else {
      let t;
      if (m.kind === 'hunt') t = s.pirates.slice().sort((a, b) => dist(a.pos, sh.pos) - dist(b.pos, sh.pos))[0]?.pos;
      else if (m.kind === 'scan') t = s.pois.find((p) => p.id === m.poi)?.pos;
      else if (m.kind === 'escort') t = s.freighter?.pos || s.sys.station.pos;
      else t = s.sys.station.pos;
      if (t) {
        s.objective = { kind: 'mission', text: `${MISSION_KINDS[m.kind].icon} ${m.text}${m.n > 1 ? ` (${m.progress}/${m.n})` : ''}` };
        s.target = t;
        return;
      }
    }
  }
  const o = objective({ cargo: g.cargo, cargoMax: stats().cargo, credits: g.credits, up: g.up, sold: g.sold });
  // ya con alguna mejora y sin nada urgente: explorar
  const anyUp = Object.values(g.up).some((n) => n > 0);
  if (o.kind === 'mine' && anyUp && g.visited.length < 3 && cargoCount(g.cargo) === 0) {
    const open = s.sys.gates.filter((gt) => canJump(GAL[gt.to], g.up.jump || 0));
    if (open.length) {
      const near = open.sort((a, b) => dist(a.pos, sh.pos) - dist(b.pos, sh.pos))[0];
      s.objective = { kind: 'explore', text: `Explora: cruza la puerta de salto hacia ${near.name}` };
      s.target = near.pos;
      return;
    }
  }
  s.objective = o;
  if (o.kind === 'mine') {
    let best = null, bd = Infinity;
    for (const a of s.sys.asteroids) { const d = dist(a.pos, sh.pos); if (d < bd) { bd = d; best = a; } }
    s.target = best ? best.pos : null;
  } else s.target = s.sys.station.pos;
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
