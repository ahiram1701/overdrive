// GALAXIA: lógica de vuelo, minería, combate, comercio, saltos y reaparición. Pseudo-3D detrás de la nave.
// Relajado: si te destruyen, te remolcan a tu estación base (pierdes la carga, no la partida), y
// junto a las estaciones hay zona segura (los piratas no entran).
import { G } from './state.js';
import { makeRng, hashString } from './rng.js';
import { save, persist } from './save.js';
import { fx } from './fx.js';
import { sfx, music, musicStart, musicStop, musicDuck } from './audio.js';
import { basis, add, sub, scale, norm, dist, chaseCam, angleTo, lookAngles, angDiff, project, quatFromYawPitch, rotateLocal, basisQ, anglesOf } from './space3d.js';
import { CHASSIS, upgradeMats, effLvl, snapThrottle, shipStats, makeSystem, makeAsteroid, cargoCount, ORES, UPGRADES, upgradeCost, repairCost, objective } from './galaxyData.js';
import { genGalaxy, canJump, jumpNeeded, route } from './galaxy.js';
import { poisOf, POI_KINDS, SCAN_TIME, SCAN_R, perksFor, ATLAS_PERKS, boardFor, advanceMissions, MAX_ACTIVE, MISSION_KINDS } from './galaxyMissions.js';
import { addXp } from './progress.js';
import { SHIPS } from './upgrades.js';
import { progress } from './game.js';
import { ui, toast } from './ui.js';
import { hasTalent } from './economy.js';
import { MATS, addMat, dropsOf, hasGear, gearBoost, fitSlots, matOf } from './crafting.js';
import { unitPrice, sellValue, recordSale, recoverMarket, MISSILE_PRICE, tollFor, ITEMS, takeItem, itemCount } from './market.js';
import { currentChapter, storyEvent, storyState, markerPos } from './story.js';
import { FACTIONS, ownerOf, addRep, repOf, repLevel, bestAlly, LIBERATE_KILLS, FACTION_SHOP, lvlAtLeast, bountyBoard, moveBounty, bountyStats, nemesisUp, TRAITS } from './factions.js';
import { eventFor, EVENTS, MISSILE, missileAmmo, missileDmg, steerMissile, lockStep, ENEMY_KINDS, enemyKind, planetInfo } from './galaxyEvents.js';

const S = () => G.space;
const DOCK_R = 150;
const SAFE_R = 380; // zona segura alrededor de la estación
const MAGNET_R = 75;
const BARREL = 0.55; // duración del tonel (s), invulnerable mientras dura
const ORBIT_R = 160; // a esta distancia de la superficie aparece ORBITAR
export const GAL = genGalaxy();

const gal = () => save.galaxy;
// stats de la nave: mejoras del taller + mejoras únicas del ATLAS
export const atlasCount = () => Object.keys(save.galaxyAtlas).length;
const perks = () => perksFor(atlasCount());
const stats = () => {
  const st = shipStats(gal().up, save.ship, gal().chassis);
  // TALENTOS de la galaxia
  if (hasTalent(save, 'g1')) st.cargo += 10;
  if (hasTalent(save, 'g5')) st.shield += 20;
  if (hasGear(save, 'hold')) st.cargo += Math.round(15 * gearBoost(save, 'hold'));
  if (hasGear(save, 'reactive')) st.regen *= 1.6 * gearBoost(save, 'reactive');
  if (perks().includes('alien')) st.shield += 40;
  return st;
};

// ---------- Facciones ----------
export const sysOwner = (id = S()?.sysId ?? 0) => ownerOf(GAL[id], save.territory);
const repBonus = (id) => repLevel(repOf(save, sysOwner(id)));
const B = () => { save.bounties.done ||= {}; return save.bounties; };

// La orientación manda (cuaternión); yaw/pitch se derivan para lo que solo necesita una dirección
function syncAngles(sh) {
  const b = basisQ(sh.q);
  sh.f = b.f; sh.r = b.r; sh.u = b.u;
  const a = anglesOf(b.f);
  sh.yaw = sh._sy = a.yaw;
  sh.pitch = sh._sp = a.pitch;
}
function face(sh, yaw, pitch = 0) {
  sh.q = quatFromYawPitch(yaw, pitch);
  syncAngles(sh);
}

// ---------- Inicio y sistemas ----------
export function newSpace() {
  const forced = G.debug ? new URLSearchParams(location.search).get('seed') : null;
  const g = gal();
  if (!g.visited?.length) g.visited = [0];
  const st = stats();
  const s = {
    rng: makeRng(forced !== null ? Number(forced) >>> 0 : (Math.random() * 2 ** 32) >>> 0),
    ship: { pos: { x: 0, y: 0, z: 0 }, q: quatFromYawPitch(0, 0), yaw: 0, pitch: 0, roll: 0, throttle: 1, rollIn: 0, shield: st.shield, hull: g.hull ?? st.hull, boostT: 0, boostCd: 0, fireT: 0, hitT: 9, side: 1 },
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
    fx.banner('🌌 BIENVENIDO A ORIGEN', 'arrastra para girar · la palanca MOTOR acelera, frena o da marcha atrás', '#7df9ff', true);
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
  s.missiles = []; s.emissiles = []; s.blasts = []; s.sparks = []; s.trail = []; s.mines = []; s.decoy = null;
  s.base = null; s.event = null; s.act = null;
  s.lock = { ref: null, t: 0, locked: false };
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
    // por la puerta del sistema de origen; si no hay (agujero de gusano a un sistema lejano), por la primera
    const back = s.sys.gates.find((gt) => gt.to === fromId) || s.sys.gates[0];
    const inward = norm(scale(back.pos, -1));
    s.ship.pos = add(back.pos, scale(inward, 90));
    face(s.ship, lookAngles(s.ship.pos, add(s.ship.pos, inward)).yaw);
    s.cam = null;
  } else undockPose(s);
  // FACCIÓN del sistema: en los piratas hay base y más piratas (libéralo); en los liberados, asedios
  s.owner = sysOwner(id);
  s.libKills = 0;
  s.pirWarned = false;
  if (s.owner === 'pir') {
    spawnBase(s);
    fx.notice(`🏴‍☠️ ${def.name} es pirata: destruye su base y ${LIBERATE_KILLS} piratas para liberarlo`, '#ff2d55');
  }
  // SUCESO al llegar por una puerta (o un agujero de gusano)
  if (fromId !== null) {
    g.jumps = (g.jumps || 0) + 1;
    const bo = B().active;
    if (bo) bo.sys = moveBounty(GAL, bo, g.jumps);
    if (save.territory[id] && makeRng(hashString(`siege-${id}-${g.jumps}`)).next() < 0.25) startEvent(s, { kind: 'siege', id: `siege-${id}-${g.jumps}` });
    else {
      const ev = eventFor(id, g.jumps, def.danger);
      if (ev && !(ev.kind === 'assault' && s.base)) startEvent(s, ev);
    }
  }
  spawnBounty(s);
  s.devourer = null;
  s.markerT = 0;
  spawnStoryBoss(s);
  persist();
}

// ---------- Materiales ----------
function gainMats(s, drops) {
  const parts = [];
  for (const [k, n] of Object.entries(drops)) { addMat(save, k, n); parts.push(`+${n} ${MATS[k].icon}`); }
  if (parts.length) fx.notice(parts.join(' '), '#b8c2cc');
}

// ---------- Historia: LA SEÑAL ----------
export const storyChapter = () => currentChapter(save, GAL);
function storyHit(s, ev) {
  const done = storyEvent(save, GAL, ev);
  if (!done) return;
  const r = done.reward, g = gal();
  g.credits += r.credits || 0;
  for (const [k, n] of Object.entries(r.mats || {})) addMat(save, k, n);
  if (r.ship && !save.ships.includes(r.ship)) save.ships.push(r.ship);
  fx.banner(`📖 ${done.title.toUpperCase()}`, `capítulo completado · +${r.credits || 0} 💰${r.ship ? ' · ¡nueva nave ERRANTE!' : ''}`, '#bf5af2', true);
  sfx.milestone();
  progress('chapter');
  if (r.ship) progress('storyEnd');
  persist();
  // diálogo de cierre y, si hay, el del capítulo siguiente
  const next = storyChapter();
  ui.showDialog?.([...done.outro, ...(next ? next.intro : [])], next?.choice);
  if (next) storyState(save).seen[storyState(save).ch] = true;
  spawnStoryBoss(s);
}
export function storyChoose(pick) {
  const s = S();
  addRep(save, pick, 20);
  storyHit(s, { type: 'choice', pick });
}
// diálogo de entrada si no se ha visto (al despegar en la galaxia)
export function storyIntro() {
  const ch = storyChapter(), st = storyState(save);
  if (!ch || st.seen[st.ch]) return;
  st.seen[st.ch] = true;
  persist();
  ui.showDialog?.(ch.intro, ch.choice);
}
function spawnStoryBoss(s) {
  const ch = storyChapter();
  if (!ch || ch.goal.kind !== 'boss' || ch.goal.sys !== s.sysId) return;
  if (ch.goal.boss === 'herald' && !s.pirates.some((p) => p.story === 'herald')) {
    spawnPirate(s, true);
    const h = s.pirates[s.pirates.length - 1];
    Object.assign(h, { story: 'herald', name: 'EL HERALDO', hp: 1500, max: 1500, mesh: 'wanderer', size: 15, speed: 95, dmg: 14 });
    fx.banner('👁️ EL HERALDO', 'te estaba esperando', '#ff2d55', true);
  }
  if (ch.goal.boss === 'devourer' && !s.devourer) spawnDevourer(s);
}

// EL DEVORADOR DE ESTRELLAS: fase 1, tres ojos (el núcleo es invulnerable); fase 2, núcleo al
// descubierto con oleadas de drones y misiles; fase 3 (furia, <30%), anillos de balas.
export function spawnDevourer(s = S()) {
  const st = s.sys.station.pos;
  const pos = add(st, { x: 700, y: 160, z: 700 });
  s.devourer = { pos, r: 60, hp: 4200, max: 4200, phase: 1, spin: 0, flash: 0, waveT: 6, volleyT: 4, ringT: 3, eyeT: 2,
    eyes: [0, 1, 2].map((i) => ({ ang: (i / 3) * Math.PI * 2, hp: 450, max: 450, alive: true, eye: true, pos: { ...pos }, flash: 0 })) };
  fx.banner('🌑 EL DEVORADOR DE ESTRELLAS', 'destruye sus tres ojos para dejar el núcleo al descubierto', '#bf5af2', true);
  fx.shake(20);
  sfx.boom();
}
function updateDevourer(s, dt) {
  const d = s.devourer;
  if (!d) return;
  const sh = s.ship;
  d.spin += dt * (d.phase === 3 ? 0.9 : 0.4);
  d.flash = Math.max(0, d.flash - dt);
  // se acerca despacio, sin pegarse
  const dd = dist(d.pos, sh.pos);
  if (dd > 260) d.pos = add(d.pos, scale(norm(sub(sh.pos, d.pos)), (d.phase === 3 ? 40 : 22) * dt));
  if (dd < d.r + 8) sh.pos = add(d.pos, scale(norm(sub(sh.pos, d.pos)), d.r + 9));
  for (const e of d.eyes) {
    e.pos = add(d.pos, { x: Math.cos(e.ang + d.spin) * d.r * 0.95, y: Math.sin(e.ang * 2 + d.spin) * d.r * 0.35, z: Math.sin(e.ang + d.spin) * d.r * 0.95 });
    e.flash = Math.max(0, e.flash - dt);
  }
  const near = dd < 900;
  // la furia llega por vida, estés donde estés (los ataques sí necesitan tenerte cerca)
  if (d.phase === 2 && d.hp < d.max * 0.3) { d.phase = 3; fx.banner('🌑 FURIA', 'el Devorador se desata', '#ff2d55', true); }
  if (d.phase === 1) {
    d.eyeT -= dt;
    if (d.eyeT <= 0 && near) {
      d.eyeT = 2.2;
      for (const e of d.eyes) if (e.alive) s.ebolts.push({ pos: { ...e.pos }, vel: scale(norm(sub(sh.pos, e.pos)), 520), life: 2, dmg: 9 });
    }
    if (d.eyes.every((e) => !e.alive)) {
      d.phase = 2;
      fx.banner('🌑 ¡EL NÚCLEO!', 'ahora sí: dispara al centro', '#ffe600', true);
      fx.shake(24);
    }
  } else if (near) {
    d.waveT -= dt;
    d.volleyT -= dt;
    if (d.waveT <= 0) { d.waveT = 9; spawnPirate(s, false, 'drone', add(d.pos, { x: 0, y: -d.r - 20, z: 0 })); }
    if (d.volleyT <= 0) {
      d.volleyT = 4;
      for (const k of [-1, 0, 1]) s.emissiles.push({ pos: add(d.pos, { x: k * 30, y: d.r, z: 0 }), vel: scale(norm(sub(sh.pos, d.pos)), 210), life: 7, dmg: 16 });
    }
    if (d.phase === 3) {
      d.ringT -= dt;
      if (d.ringT <= 0) {
        d.ringT = 3;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          s.ebolts.push({ pos: { ...d.pos }, vel: { x: Math.cos(a) * 380, y: 0, z: Math.sin(a) * 380 }, life: 2.4, dmg: 10 });
        }
      }
    }
  }
}
function hitDevourer(s, ref, dmg) {
  const d = s.devourer;
  if (!d) return;
  if (ref.eye) {
    if (!ref.alive) return;
    ref.hp -= dmg;
    ref.flash = 0.08;
    if (ref.hp <= 0) { ref.alive = false; blast(s, ref.pos, 50, '#ff2d55', 0.6); sfx.boom(); fx.notice(`👁️ Ojo destruido · quedan ${d.eyes.filter((e) => e.alive).length}`, '#ff2d55'); }
    return;
  }
  if (d.phase === 1) {
    if (!d.warned) { d.warned = true; fx.notice('🛡️ Invulnerable: destruye primero sus 3 ojos', '#ffe600'); }
    return;
  }
  d.hp -= dmg;
  d.flash = 0.08;
  if (d.hp <= 0) killDevourer(s);
}
function killDevourer(s) {
  const d = s.devourer;
  s.devourer = null;
  for (let i = 0; i < 4; i++) blast(s, add(d.pos, { x: (i - 1.5) * 30, y: 0, z: 0 }), 200 + i * 60, i % 2 ? '#bf5af2' : '#ffe600', 1.2 + i * 0.3);
  fx.flash('#ffffff', 0.9);
  fx.shake(40);
  sfx.boom();
  gainMats(s, { nucleos: 5, artefactos: 3 });
  s.loot.push({ pos: { ...d.pos }, credits: 2000, life: 120 });
  storyHit(s, { type: 'boss', boss: 'devourer', sys: s.sysId });
}

// BALIZA de la historia: quédate cerca 2 s
function updateStoryMarker(s, dt) {
  const ch = storyChapter();
  if (!ch || ch.goal.kind !== 'reach' || ch.goal.sys !== s.sysId) { s.storyMarker = null; return; }
  s.storyMarker = markerPos(s.sysId);
  if (dist(s.storyMarker, s.ship.pos) < 70) {
    s.markerT = (s.markerT || 0) + dt;
    if (s.markerT >= 2) { s.markerT = 0; storyHit(s, { type: 'reach', sys: s.sysId }); }
  } else s.markerT = Math.max(0, (s.markerT || 0) - dt);
}

// ---------- Cazarrecompensas ----------
function spawnBounty(s) {
  const b = B().active;
  if (!b || b.sys !== s.sysId || s.pirates.some((p) => p.bounty)) return;
  const st = bountyStats(b);
  const a = s.rng.range(0, Math.PI * 2);
  const pos = { x: Math.cos(a) * 1000, y: s.rng.range(-100, 100), z: Math.sin(a) * 1000 };
  if (dist(pos, s.sys.station.pos) < SAFE_R + 300) { pos.x = -pos.x; pos.z = -pos.z; }
  s.pirates.push({
    pos, yaw: 0, pitch: 0, hp: st.hp, max: st.hp, boss: false, alive: true, flash: 0, state: 'attack', t: 0, kind: 'fighter', size: st.size,
    speed: st.speed, turn: st.turn, fireCd: 1, dmg: st.dmg, missileCd: 0, mesh: 'chimera', off: { x: 0, y: 0, z: 0 }, bounty: b.id, name: b.name, flees: b.trait === 'escurridizo',
  });
  for (let i = 0; i < st.drones; i++) spawnPirate(s, false, 'drone', add(pos, { x: 40 * (i - 1.5), y: 10, z: 30 }));
  fx.banner(`🎯 ${b.name.toUpperCase()}`, `nivel ${b.level} · ${TRAITS[b.trait].icon} ${TRAITS[b.trait].name} · está en este sistema`, '#ff9f0a', true);
}
export const bountyBoardNow = (s = S()) => bountyBoard(GAL, s.sysId, B().seq || 0, B().done);
export function acceptBounty(b) {
  if (B().active) return false;
  B().active = { ...b };
  persist();
  sfx.card();
  return true;
}
export function abandonBounty() {
  B().active = null;
  persist();
}
function bountyKilled(s, p) {
  const b = B().active;
  if (!b || b.id !== p.bounty) return;
  const g = gal();
  g.credits += b.reward;
  B().done[b.id] = true;
  B().active = null;
  B().seq = (B().seq || 0) + 1;
  addRep(save, sysOwner(b.from), 5);
  fx.banner(`🎯 ${b.name.toUpperCase()} ABATIDO`, `+${b.reward} 💰`, '#ffe600', true);
  progress('bounty');
  persist();
}

// ---------- Territorio ----------
function checkLiberation(s) {
  if (s.owner !== 'pir' || s.base || s.libKills < LIBERATE_KILLS || save.territory[s.sysId]) return;
  const f = bestAlly(save);
  save.territory[s.sysId] = f;
  s.owner = f;
  addRep(save, f, 15);
  addRep(save, 'pir', -10);
  fx.banner(`🏳️ ${GAL[s.sysId].name} LIBERADO`, `ahora es de la ${FACTIONS[f].name} · su estación te abre`, FACTIONS[f].color, true);
  fx.flash(FACTIONS[f].color, 0.5);
  sfx.milestone();
  progress('liberate');
  persist();
}

// Tienda de facción: estilos exclusivos con créditos según tu reputación
export function buyFactionItem(it) {
  const g = gal();
  if ((save.crates.owned || []).includes(it.id) || !lvlAtLeast(repOf(save, it.faction), it.minLvl) || g.credits < it.cost) return false;
  g.credits -= it.cost;
  save.crates.owned = [...(save.crates.owned || []), it.id];
  persist();
  sfx.chest();
  return true;
}
export { FACTION_SHOP };

// colocarse fuera de la estación, mirando hacia fuera del sol: el cinturón está más allá
function undockPose(s) {
  const st = s.sys.station.pos;
  const out = norm({ x: st.x, y: 0, z: st.z });
  s.ship.pos = add(st, scale(out, DOCK_R * 0.9));
  face(s.ship, lookAngles(s.ship.pos, add(s.ship.pos, out)).yaw);
  s.cam = null;
}

// ---------- Piratas ----------
// kind: fighter | interceptor | bomber | drone (los drones vienen en enjambre de 4)
function spawnPirate(s, boss, kind = null, at = null) {
  const def = GAL[s.sysId];
  const d = def.danger;
  const a = s.rng.range(0, Math.PI * 2), R = s.rng.range(700, 1300);
  const pos = at ? { ...at } : { x: Math.cos(a) * R, y: s.rng.range(-120, 120), z: Math.sin(a) * R };
  if (!at && dist(pos, s.sys.station.pos) < SAFE_R + 200) pos.x += 600;
  const k = boss ? 'fighter' : kind || enemyKind(d, s.rng.next());
  const K = ENEMY_KINDS[k];
  const hp = boss ? 400 + d * 120 : Math.round((30 + d * 14) * K.hpK);
  const n = k === 'drone' ? 4 : 1;
  for (let i = 0; i < n; i++) {
    s.pirates.push({
      pos: i ? add(pos, { x: s.rng.range(-30, 30), y: s.rng.range(-15, 15), z: s.rng.range(-30, 30) }) : pos,
      yaw: s.rng.range(-3, 3), pitch: 0, hp, max: hp, boss, alive: true, flash: 0, state: 'attack', t: 0, kind: k, size: boss ? 13 : K.size,
      speed: ((boss ? 70 : 85) + d * 7) * K.speedK, turn: (boss ? 1.1 : 1.7) * K.turnK, fireCd: s.rng.range(1, 2), dmg: ((boss ? 9 : 5) + d * 1.6) * (k === 'drone' ? 0.6 : 1),
      missileCd: K.missiles ? 3 : 0,
      mesh: boss ? 'kaiju' : K.mesh || s.rng.pick(['raptor', 'viper', 'comet']), off: { x: s.rng.range(-1, 1), y: s.rng.range(-0.4, 0.4), z: s.rng.range(-1, 1) },
    });
  }
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
    if (!p.boss && p.hp < p.max * (p.flees ? 0.5 : 0.25) && p.state !== 'flee') { p.state = 'flee'; p.t = 0; }
    if (p.state === 'attack' && d < 70) { p.state = 'evade'; p.t = 0; }
    if (p.state === 'evade' && p.t > 1.4) p.state = 'attack';
    if (playerSafe && p.state === 'attack') p.state = 'patrol';
    if (p.state === 'patrol' && !playerSafe) p.state = 'attack';
    let target;
    const fr = s.freighter;
    if (p.raider && fr && fr.hp > 0) {
      target = fr.pos;
      p.state = 'attack';
    } else if (s.decoy && !p.boss) {
      target = s.decoy.pos; // SEÑUELO: lo persiguen a él
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
    const aim = p.raider && s.freighter ? s.freighter.pos : s.decoy && !p.boss ? s.decoy.pos : sh.pos;
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
    // BOMBARDERO: lanza misiles que te persiguen (se pueden derribar a tiros o esquivar con un tonel)
    if (p.missileCd > 0 && p.state === 'attack' && !playerSafe && dAim < 750) {
      p.missileCd -= dt;
      if (p.missileCd <= 0) {
        p.missileCd = 5;
        s.emissiles.push({ pos: add(p.pos, scale(f, 10)), vel: scale(f, 230), life: 7, dmg: 18 + GAL[s.sysId].danger * 3 });
        if (!s.warnedMissile) { s.warnedMissile = true; fx.notice('🚀 ¡Misil enemigo! derríbalo o haz un tonel (doble toque)', '#ff2d55'); }
        sfx.dash();
      }
    }
    if (p.state === 'flee' && d > 1600) p.alive = false; // se escapó
  }
  // misiles enemigos: persiguen con menos giro que los tuyos
  for (const m of s.emissiles) {
    steerMissile(m, sh.pos, dt, 1.5);
    if (dist(m.pos, sh.pos) < 7) {
      m.life = 0;
      blast(s, m.pos, 30, '#ff2d55', 0.45);
      if (dist(sh.pos, st) >= SAFE_R) hurt(s, m.dmg);
    }
  }
  s.emissiles = s.emissiles.filter((m) => m.life > 0);
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
  blast(s, p.pos, p.boss ? 130 : p.size * 7, '#ff9f0a', p.boss ? 1.2 : 0.6);
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
  gainMats(s, dropsOf(p.kind, { boss: p.boss, bounty: !!p.bounty }));
  if (p.story) storyHit(s, { type: 'boss', boss: p.story, sys: s.sysId });
  else storyHit(s, { type: 'kill', sys: s.sysId });
  if (s.owner !== 'pir') addRep(save, s.owner, 1);
  addRep(save, 'pir', -1);
  if (s.owner === 'pir') { s.libKills++; checkLiberation(s); }
  if (p.bounty) bountyKilled(s, p);
  if (p.siege && s.event?.kind === 'siege' && !s.event.done) {
    s.event.left--;
    if (s.event.left <= 0) {
      s.event.done = true;
      const c = 300 + GAL[s.sysId].danger * 80;
      gal().credits += c;
      addRep(save, s.owner, 10);
      fx.banner('⚔️ ASEDIO REPELIDO', `+${c} 💰 · la ${FACTIONS[s.owner]?.name || 'estación'} te lo agradece`, '#30d158', true);
      progress('siege');
    }
  }
  missionEvent(s, { type: 'kill', sys: s.sysId });
}

// ---------- Efectos (los dibuja spaceRender) ----------
function blast(s, pos, R, col, max = 0.7) {
  s.blasts.push({ pos: { ...pos }, t: 0, max, R, col });
}
function sparks(s, pos, col, n = 6) {
  for (let i = 0; i < n; i++) {
    const v = { x: Math.random() - 0.5, y: Math.random() - 0.5, z: Math.random() - 0.5 };
    s.sparks.push({ pos: { ...pos }, vel: scale(norm(v), 40 + Math.random() * 60), life: 0.3 + Math.random() * 0.25, col });
  }
}

// ---------- Base pirata ----------
export const turretPos = (b, t) => add(b.pos, { x: Math.cos(t.ang + b.spin) * b.r, y: 8, z: Math.sin(t.ang + b.spin) * b.r });
function spawnBase(s) {
  const st = s.sys.station.pos, d = GAL[s.sysId].danger;
  const a = s.rng.range(0, Math.PI * 2);
  const pos = { x: Math.cos(a) * 1150, y: s.rng.range(-100, 100), z: Math.sin(a) * 1150 };
  if (dist(pos, st) < SAFE_R + 500) { pos.x = -pos.x; pos.z = -pos.z; }
  const hp = 600 + d * 150;
  s.base = { pos, hp, max: hp, r: 34, flash: 0, spin: 0, turrets: [0, 1, 2, 3].map((i) => ({ ang: (i * Math.PI) / 2, cd: 1 + i * 0.4 })) };
  for (let i = 0; i < 2; i++) spawnPirate(s, false, 'fighter', add(pos, { x: i ? 90 : -90, y: 0, z: 70 }));
}
function updateBase(s, dt) {
  const b = s.base;
  if (!b) return;
  const sh = s.ship;
  b.spin += dt * 0.3;
  b.flash = Math.max(0, b.flash - dt);
  const d = dist(b.pos, sh.pos);
  if (d < b.r + 8) sh.pos = add(b.pos, scale(norm(sub(sh.pos, b.pos)), b.r + 9));
  const safe = dist(sh.pos, s.sys.station.pos) < SAFE_R;
  for (const t of b.turrets) {
    t.cd -= dt;
    if (t.cd > 0 || d > 700 || safe) continue;
    t.cd = 1.6;
    const from = turretPos(b, t);
    const lead = add(sh.pos, scale(sh.f, (sh.speed || 0) * (d / 600)));
    s.ebolts.push({ pos: from, vel: scale(norm(sub(lead, from)), 600), life: 1.6, dmg: 6 + GAL[s.sysId].danger * 1.5 });
  }
}
function hitBase(s, dmg) {
  const b = s.base;
  b.hp -= dmg;
  b.flash = 0.08;
  if (b.hp <= 0) killBase(s);
}
function killBase(s) {
  const b = s.base, d = GAL[s.sysId].danger;
  s.base = null;
  blast(s, b.pos, 260, '#ff9f0a', 1.5);
  blast(s, b.pos, 140, '#ffe600', 0.9);
  const pp = s.cam && project(s.cam, b.pos);
  if (pp) for (const c of ['#ff2d55', '#ffe600', '#fff']) fx.burst(pp.x, pp.y, 70, c, 700, 6, 0.9, 0);
  fx.shake(30);
  fx.flash('#ffe600', 0.5);
  sfx.boom();
  const value = 680 + d * 200;
  s.loot.push({ pos: { ...b.pos }, credits: value, life: 90 });
  fx.banner('🏴‍☠️ BASE PIRATA DESTRUIDA', `+${value} 💰 al recogerlo`, '#ffe600', true);
  if (s.event?.kind === 'assault') s.event.done = true;
  progress('pirateBase');
  gainMats(s, dropsOf('base', { base: true }));
  storyHit(s, { type: 'base', sys: s.sysId });
  checkLiberation(s);
  persist();
}

// ---------- Sucesos de sistema ----------
function startEvent(s, ev) {
  const E = EVENTS[ev.kind], sh = s.ship, rng = makeRng(hashString(ev.id));
  s.event = { ...ev, t: 0, done: false };
  fx.banner(`${E.icon} ${E.name}`, E.desc, '#ffe600', true);
  const ahead = (d, side = 0, up = 0) => add(add(add(sh.pos, scale(sh.f, d)), scale(sh.r, side)), scale(sh.u, up));
  if (ev.kind === 'meteor') { s.event.left = E.time; s.event.spawnT = 0; }
  else if (ev.kind === 'rescue') s.event.pod = { pos: ahead(rng.range(500, 800), rng.range(-300, 300), rng.range(-120, 120)) };
  else if (ev.kind === 'convoy') {
    const start = ahead(450, rng.range(-250, 250), 0), dir = scale(sh.r, rng.chance(0.5) ? 1 : -1);
    s.event.ships = [0, 1, 2].map((i) => ({ pos: add(start, scale(dir, -i * 45)), dir, yaw: Math.atan2(dir.x, dir.z) }));
  } else if (ev.kind === 'wormhole') s.event.pos = ahead(rng.range(450, 650), rng.range(-200, 200), rng.range(-80, 80));
  else if (ev.kind === 'assault') spawnBase(s);
  else if (ev.kind === 'siege') {
    s.event.left = 5;
    const st = s.sys.station.pos;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      spawnPirate(s, false, i % 2 ? 'interceptor' : 'fighter', add(st, { x: Math.cos(a) * (SAFE_R + 160), y: 20, z: Math.sin(a) * (SAFE_R + 160) }));
      s.pirates[s.pirates.length - 1].siege = true;
    }
  }
}
function updateEvent(s, dt) {
  const e = s.event;
  if (!e || e.done) return;
  const sh = s.ship, g = gal();
  e.t += dt;
  if (e.kind === 'meteor') {
    e.left -= dt;
    e.spawnT -= dt;
    if (e.spawnT <= 0 && e.left > 0) {
      e.spawnT = 0.7;
      const pos = add(add(add(sh.pos, scale(sh.f, s.rng.range(380, 630))), scale(sh.r, s.rng.range(-250, 250))), scale(sh.u, s.rng.range(-130, 130)));
      const a = makeAsteroid(s.rng, pos, s.rng.range(6, 12), s.sys.ore);
      a.vel = add(scale(norm(sub(sh.pos, pos)), s.rng.range(30, 60)), { x: s.rng.range(-20, 20), y: s.rng.range(-10, 10), z: s.rng.range(-20, 20) });
      a.meteor = true;
      a.life = 25;
      s.sys.asteroids.push(a);
    }
    if (e.left <= 0) { e.done = true; fx.notice('☄️ La lluvia de meteoritos ha pasado', '#ffe600'); }
  } else if (e.kind === 'rescue') {
    if (!e.held && dist(e.pod.pos, sh.pos) < 35) { e.held = true; fx.notice('🆘 Cápsula a bordo: llévala a la estación', '#30d158'); sfx.chest(); }
  } else if (e.kind === 'convoy') {
    for (const c of e.ships) c.pos = add(c.pos, scale(c.dir, 22 * dt));
    e.near = dist(e.ships[0].pos, sh.pos) < 170;
  } else if (e.kind === 'wormhole') {
    if (dist(e.pos, sh.pos) < 40) {
      const opts = GAL.filter((x) => x.id !== s.sysId && canJump(x, g.up.jump || 0));
      const to = opts[Math.floor(makeRng(hashString(e.id)).next() * opts.length)];
      e.done = true;
      s.jumpT = 1.1;
      s.jumpTo = to.id;
      fx.flash('#bf5af2', 0.8);
      fx.banner('🌀 AGUJERO DE GUSANO', `te escupe en ${to.name}`, '#bf5af2', true);
      sfx.od();
      progress('wormhole');
    }
  }
}

// (debug/tests) fuerza un suceso en el sistema actual
export function forceEvent(kind) {
  const s = S();
  if (s) startEvent(s, { kind, id: `force-${s.sysId}-${kind}` });
}

// ---------- Consumibles de vuelo ----------
export function useItem(id) {
  const s = S();
  if (!s || G.mode !== 'galaxy' || !ITEMS[id] || itemCount(save, id) <= 0) return false;
  const sh = s.ship, st = stats(), g = gal();
  if (id === 'repair' && sh.hull >= st.hull) { fx.notice('🧰 El casco ya está entero', '#b8c2cc'); return false; }
  if (id === 'shield' && sh.shield >= st.shield) { fx.notice('🔋 El escudo ya está lleno', '#b8c2cc'); return false; }
  if (id === 'beacon' && s.jumpT > 0) return false;
  takeItem(save, id);
  if (id === 'repair') { sh.hull = Math.min(st.hull, sh.hull + st.hull * 0.4); g.hull = sh.hull; }
  else if (id === 'shield') { sh.shield = st.shield; sh.shieldFx = 0.6; }
  else if (id === 'mines') {
    for (let i = 0; i < 3; i++) s.mines.push({ pos: add(add(sh.pos, scale(sh.f, -14 - i * 12)), scale(sh.r, (i - 1) * 10)), life: 25, arm: 0.6 });
  } else if (id === 'decoy') {
    s.decoy = { pos: add(sh.pos, scale(sh.f, -30)), t: 6 };
  } else if (id === 'beacon') {
    const home = g.home ?? 0;
    if (home === s.sysId) undockPose(s);
    else { s.jumpT = 1.1; s.jumpTo = home; s.beaconJump = true; }
    fx.flash('#7df9ff', 0.6);
  }
  fx.notice(`${ITEMS[id].icon} ${ITEMS[id].name}`, '#7df9ff');
  sfx.ui();
  persist();
  return true;
}
function updateItems(s, dt) {
  if (s.decoy) { s.decoy.t -= dt; if (s.decoy.t <= 0) s.decoy = null; }
  for (const m of s.mines) {
    m.life -= dt;
    m.arm -= dt;
    if (m.arm > 0) continue;
    const near = s.pirates.find((p) => p.alive && dist(p.pos, m.pos) < 40);
    if (!near) continue;
    m.life = 0;
    blast(s, m.pos, 60, '#ff9f0a', 0.6);
    for (const p of s.pirates) {
      if (!p.alive || dist(p.pos, m.pos) > 60) continue;
      p.hp -= 150;
      p.flash = 0.1;
      if (p.hp <= 0) killPirate(s, p);
    }
    sfx.boom();
  }
  s.mines = s.mines.filter((m) => m.life > 0);
}

// ---------- Acciones ----------
// MISIL: necesita un blanco fijado (mantenerlo en el visor) y munición (se recarga al atracar)
export function spaceMissile() {
  const s = S();
  if (!s || G.mode !== 'galaxy') return;
  const g = gal();
  if (!(g.up.missile > 0)) return;
  if ((g.missiles || 0) <= 0) { fx.notice('🚀 Sin misiles: recarga en la estación', '#ff9f0a'); sfx.bump(); return; }
  if (!s.lock.locked || !s.lock.ref) { fx.notice('🎯 Mantén un enemigo en el visor para fijarlo', '#ffe600'); sfx.bump(); return; }
  g.missiles--;
  const sh = s.ship;
  s.missiles.push({ pos: add(sh.pos, scale(sh.u, -2.5)), vel: scale(sh.f, MISSILE.speed * (hasGear(save, 'rapid') ? 1.3 : 1)), life: MISSILE.life, target: s.lock.ref, dmg: missileDmg(g.up.missile) });
  sfx.dash();
  fx.vibe(25);
}

// TONEL (doble toque o X): una vuelta de campana hacia un lado, invulnerable mientras dura
export function spaceRoll(dir = 0) {
  const s = S();
  if (!s || G.mode !== 'galaxy') return;
  const sh = s.ship;
  if (sh.rollCd > 0) return;
  sh.barrelT = BARREL;
  sh.barrelDir = dir || (s.input.x < -0.1 ? -1 : 1);
  sh.rollCd = 1.3;
  sh.dodged = false;
  sfx.slide();
  fx.vibe(20);
}

// Botón de contexto: COMERCIAR con el convoy u ORBITAR un planeta
export function spaceAct() {
  const s = S();
  if (!s || G.mode !== 'galaxy' || !s.act) return;
  const g = gal();
  if (s.act.kind === 'trade') {
    let total = 0;
    for (const [k, n] of Object.entries(g.cargo)) { if (n) { total += Math.round(marketValue(k, n, s.sysId) * 1.4); recordSale(save, s.sysId, k, n); } g.cargo[k] = 0; }
    if (!total) { fx.notice('🚚 No llevas carga que venderles', '#ff9f0a'); return; }
    g.credits += total;
    g.earned = (g.earned || 0) + total;
    s.event.done = true;
    fx.banner('🚚 TRATO HECHO', `+${total} 💰 (+40%)`, '#30d158', true);
    sfx.chest();
    progress('trade');
    persist();
  } else if (s.act.kind === 'orbit') {
    G.mode = 'planet';
    s.fireHeld = false;
    musicDuck(true);
    ui.showPlanet(s.act.idx);
  }
}

// Planeta: la primera visita paga; el planeta compra un mineral a mejor precio
export function planetOf(idx, s = S()) {
  return planetInfo(s.sysId, idx, GAL[s.sysId].name, GAL[s.sysId].danger);
}
export function orbitVisit(idx) {
  const info = planetOf(idx);
  if (save.galaxyPlanets[info.key]) return 0;
  save.galaxyPlanets[info.key] = true;
  gal().credits += info.reward;
  progress('planet');
  persist();
  return info.reward;
}
export function planetSell(idx) {
  const s = S(), g = gal(), info = planetOf(idx);
  const n = g.cargo[info.buys] || 0;
  if (!n) return 0;
  const total = Math.round(marketValue(info.buys, n, s.sysId) * info.mult);
  recordSale(save, s.sysId, info.buys, n);
  g.cargo[info.buys] = 0;
  g.credits += total;
  g.earned = (g.earned || 0) + total;
  sfx.chest();
  persist();
  return total;
}
export function leaveOrbit() {
  if (G.mode !== 'planet') return;
  G.mode = 'galaxy';
  musicDuck(false);
  ui.hideAll();
  ui.showSpaceHUD(true);
}

export function spaceBoost() {
  const s = S();
  if (!s || G.mode !== 'galaxy' || s.ship.boostCd > 0) return;
  s.ship.boostT = 1.6;
  s.ship.boostCd = (perks().includes('warp') ? 2.3 : 3.5) * (hasGear(save, 'warpdrv') ? 0.65 / gearBoost(save, 'warpdrv') : 1) * (CHASSIS[gal().chassis]?.boostCd ?? 1);
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
  g.missiles = Math.min(g.missiles || 0, missileMax()); // la recarga se paga en la estación
  if (s.event?.kind === 'rescue' && s.event.held && !s.event.done) {
    s.event.done = true;
    const c = 270 + GAL[s.sysId].danger * 60;
    g.credits += c;
    toast(`🆘 Tripulación a salvo · +${c} 💰`);
    progress('rescue');
  }
  missionEvent(s, { type: 'dock', sys: s.sysId });
  storyHit(s, { type: 'dock', sys: s.sysId });
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

// lo que paga AHORA esta estación por una unidad (baja si le vendes mucho)
export const marketPrice = (ore, sysId = S()?.sysId ?? 0) => unitPrice(save, sysId, ore, stationPrices(sysId)[ore]);
// lo que pagaría por n unidades (cada una algo menos)
export const marketValue = (ore, n, sysId = S()?.sysId ?? 0) => sellValue(save, sysId, ore, n, stationPrices(sysId)[ore]);

export function sellAll() {
  const g = gal(), sys = S()?.sysId ?? 0;
  let got = 0;
  for (const [k, n] of Object.entries(g.cargo)) {
    if (!n) continue;
    got += marketValue(k, n, sys);
    recordSale(save, sys, k, n);
    g.cargo[k] = 0;
  }
  if (hasTalent(save, 'g3')) got = Math.round(got * 1.1); // talento CONTACTOS
  got = Math.round(got * repBonus(S()?.sysId ?? 0).sell); // facción: Amigo/Aliado pagan más
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

// ASTILLERO: comprar y cambiar de chasis (en cualquier estación)
export function buyChassis(id) {
  const g = gal(), c = CHASSIS[id];
  if (!c || g.hulls.includes(id) || g.credits < c.cost) return false;
  g.credits -= c.cost;
  g.hulls = [...g.hulls, id];
  progress('chassis', g.hulls.length);
  useChassis(id);
  return true;
}
export function useChassis(id) {
  const g = gal(), s = S();
  if (!g.hulls.includes(id)) return false;
  g.chassis = id;
  fitSlots(save);
  const st = stats();
  if (s) { s.ship.hull = Math.min(s.ship.hull, st.hull); s.ship.shield = Math.min(s.ship.shield, st.shield); g.hull = s.ship.hull; }
  g.missiles = Math.min(g.missiles || 0, missileMax());
  sfx.chest();
  persist();
  return true;
}
export { CHASSIS };

// MISILES: capacidad y recarga de pago (más barata en estaciones amigas)
export const missileMax = () => missileAmmo(Math.round(effLvl(gal().up.missile || 0))) + (hasTalent(save, 'g2') ? 2 : 0) + (hasGear(save, 'rapid') ? Math.round(2 * gearBoost(save, 'rapid')) : 0) + (CHASSIS[gal().chassis]?.missiles ?? 0);
export const missileRefillCost = () => Math.max(0, missileMax() - (gal().missiles || 0)) * Math.round(MISSILE_PRICE * repBonus(S()?.sysId ?? 0).disc);
export function refillMissiles() {
  const g = gal(), c = missileRefillCost();
  if (!c || g.credits < c) return false;
  g.credits -= c;
  g.missiles = missileMax();
  sfx.coin(4);
  persist();
  return true;
}
// CONSUMIBLES con descuento de la facción de la estación
export const itemDisc = () => repBonus(S()?.sysId ?? 0).disc;

// precio de una mejora: atracado en una estación amiga, con descuento
export function stationUpCost(id, lvl) {
  const c = upgradeCost(id, lvl);
  return c === null ? null : G.mode === 'station' && S() ? Math.round(c * repBonus(S().sysId).disc) : c;
}

export function buyUpgrade(id) {
  const g = gal();
  const lvl = g.up[id] || 0;
  const c = stationUpCost(id, lvl);
  const mats = upgradeMats(lvl);
  if (c === null || g.credits < c || Object.entries(mats).some(([k, n]) => matOf(save, k) < n)) return false;
  g.credits -= c;
  for (const [k, n] of Object.entries(mats)) save.galaxyMats[k] -= n;
  g.up[id] = lvl + 1;
  if (id === 'missile' && lvl === 0) g.missiles = missileMax(); // la primera carga, de regalo
  progress('galaxyUpgrade');
  if (g.up[id] >= 10) progress('mk10');
  sfx.milestone();
  persist();
  return true;
}

export function repair() {
  const s = S(), g = gal(), st = stats();
  const c = Math.ceil(repairCost(s.ship.hull, st.hull) * (hasTalent(save, 'g4') ? 0.5 : 1) * repBonus(s.sysId).disc);
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
    addXp(save, m.reward / 2);
    g.boardSeq = (g.boardSeq || 0) + 1;
    addRep(save, sysOwner(m.from ?? s.sysId), 8);
    fx.banner(`✔ MISIÓN: ${MISSION_KINDS[m.kind].name.toUpperCase()}`, `+${m.reward} 💰 · reputación +8`, '#30d158', true);
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
  gainMats(s, { artefactos: 1 });
  missionEvent(s, { type: 'scan', poi: poi.id });
  const fresh = ATLAS_PERKS.filter((pk) => perks().includes(pk.id) && !before.includes(pk.id));
  for (const pk of fresh) fx.banner(`✨ ${pk.name}`, pk.desc, '#ffe600', true);
  persist();
}

// ---------- Daño y reaparición ----------
function hurt(s, dmg) {
  if (G.god) return;
  const sh = s.ship;
  if (sh.barrelT > 0) {
    if (!sh.dodged) { sh.dodged = true; fx.notice('🌀 ¡ESQUIVADO!', '#7df9ff'); }
    return;
  }
  sh.hitT = 0;
  const toShield = Math.min(sh.shield, dmg);
  if (toShield > 0) sh.shieldFx = 0.45;
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
  // NÉMESIS: si el objetivo de tu caza te ha destruido, sube de nivel (y paga más)
  const bo = B().active;
  if (bo && s.pirates.some((p) => p.bounty === bo.id && p.alive)) {
    B().active = nemesisUp(bo);
    fx.notice(`🎯 ${bo.name} sube a nivel ${B().active.level} (y su recompensa también)`, '#ff9f0a');
  }
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
  // si alguien fija yaw/pitch a mano (estación, puertas, tests), la orientación se rehace con ellos
  if (!sh.f || sh.yaw !== sh._sy || sh.pitch !== sh._sp) face(sh, sh.yaw, sh.pitch);
  s.t += dt;
  // SALTO en curso: túnel de hiperespacio y aparición en el sistema nuevo
  if (s.jumpT > 0) {
    s.jumpT -= dt;
    sh.pos = add(sh.pos, scale(sh.f, 600 * dt));
    if (s.jumpT <= 0) {
      const from = s.sysId;
      enterSystem(s, s.jumpTo, from);
      if (s.beaconJump) { s.beaconJump = false; undockPose(s); } // BALIZA: directo a la estación
      progress('jump');
    }
    s.cam = chaseCam(s.cam, sh, dt, G.W || 375, G.H || 812);
    return;
  }
  // VUELO LIBRE: el dedo (o WASD) gira la nave EN SUS EJES: arriba/abajo = cabeceo sin tope (rizos),
  // a los lados = guiñada; ↺ ↻ (o Q/E) = alabeo. Sensibilidad y eje invertido salen de Ajustes.
  const set = save.settings || {};
  const sens = set.sens ?? 1;
  const ix = Math.max(-1, Math.min(1, s.input.x)), iy = Math.max(-1, Math.min(1, s.input.y)) * (set.invertY ? -1 : 1);
  const rollIn = Math.max(-1, Math.min(1, sh.rollIn || 0));
  sh.q = rotateLocal(sh.q, -iy * st.turn * 0.8 * sens * dt, ix * st.turn * sens * dt, rollIn * 2.4 * dt);
  // nivelación automática (opcional): si no alabeas ni tiras fuerte, el ala vuelve a la horizontal
  if (set.autoLevel !== false && !rollIn) {
    const b0 = basisQ(sh.q);
    if (Math.abs(b0.f.y) < 0.92) {
      const err = Math.atan2(b0.r.y, b0.u.y); // 0 = nivelada; ±π = boca abajo
      const k = 1.6 * (1 - Math.min(1, Math.abs(iy) * 1.4));
      sh.q = rotateLocal(sh.q, 0, 0, err * Math.min(1, k * dt));
    }
  }
  syncAngles(sh);
  // alabeo visual al virar (la cámara ya sigue el alabeo real)
  sh.roll += (-ix * 0.6 - rollIn * 0.3 - sh.roll) * Math.min(1, dt * 6);
  sh.boostT = Math.max(0, sh.boostT - dt);
  sh.boostCd = Math.max(0, sh.boostCd - dt);
  sh.rollCd = Math.max(0, (sh.rollCd || 0) - dt);
  sh.shieldFx = Math.max(0, (sh.shieldFx || 0) - dt);
  if (sh.barrelT > 0) {
    sh.barrelT -= dt;
    sh.pos = add(sh.pos, scale(sh.r, sh.barrelDir * 110 * dt)); // el tonel te aparta de lado
  }
  // ACELERADOR: de marcha atrás (−40%) a tope; el impulso va aparte. Al virar fuerte se afloja un poco.
  sh.throttle = Math.max(-0.4, Math.min(1, sh.throttle ?? 1));
  const turning = Math.min(1, Math.hypot(ix, iy));
  const thr = sh.boostT > 0 ? st.boost : sh.throttle;
  const want = st.speed * thr * (1 - 0.55 * turning);
  // FRENADA SUAVE: al bajar (o al cambiar de sentido) la nave frena en ~0,4 s en vez de clavarse;
  // al acelerar responde al momento
  const cur = sh.speed ?? want;
  const slowing = Math.abs(want) < Math.abs(cur) || Math.sign(want) !== Math.sign(cur);
  const speed = slowing ? cur + (want - cur) * Math.min(1, dt * 7) : want;
  sh.speed = Math.abs(speed) < 0.5 && want === 0 ? 0 : speed;
  const b = { f: sh.f, r: sh.r, u: sh.u };
  sh.pos = add(sh.pos, scale(b.f, sh.speed * dt));
  recoverMarket(save, dt);
  // estela del motor en el mundo (cinta 3D)
  s.trailT = (s.trailT || 0) + dt;
  if (s.trailT > 0.025) {
    s.trailT = 0;
    s.trail.unshift(add(sh.pos, scale(sh.f, -3)));
    if (s.trail.length > 28) s.trail.length = 28;
  }
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
    // EQUIPO fabricado: láser doble, metralla y plasma
    if (hasGear(save, 'laser2')) s.bolts.push({ pos: add(add(sh.pos, scale(b.r, -sh.side * 2.2)), scale(b.f, 4)), vel: add(scale(dir, 950), scale(b.f, speed)), life: 0.85, dmg: st.dmg * gearBoost(save, 'laser2') });
    if (hasGear(save, 'flak')) for (const k of [-1, 1]) s.bolts.push({ pos: from, vel: add(scale(norm(add(dir, scale(b.r, k * 0.08))), 950), scale(b.f, speed)), life: 0.6, dmg: st.dmg * 0.6 * gearBoost(save, 'flak') });
    if (hasGear(save, 'plasma') && (sh.shots = (sh.shots || 0) + 1) % 3 === 0) s.bolts.push({ pos: from, vel: add(scale(dir, 700), scale(b.f, speed)), life: 1.1, dmg: st.dmg * 3 * gearBoost(save, 'plasma'), plasma: true });
    sfx.swish();
  }

  // TORRETA automática (equipo): dispara sola al pirata más cercano
  if (hasGear(save, 'turret')) {
    s.turretT = (s.turretT || 0) - dt;
    const tgt = s.turretT <= 0 && s.pirates.filter((p) => p.alive && dist(p.pos, sh.pos) < 450).sort((x, y) => dist(x.pos, sh.pos) - dist(y.pos, sh.pos))[0];
    if (tgt) {
      s.turretT = 0.8 / gearBoost(save, 'turret');
      const from = add(sh.pos, scale(sh.u, 3));
      s.bolts.push({ pos: from, vel: scale(norm(sub(tgt.pos, from)), 900), life: 0.7, dmg: st.dmg * 0.7 });
    }
  }

  // tus proyectiles: piratas y asteroides
  for (const bo of s.bolts) {
    bo.life -= dt;
    bo.pos = add(bo.pos, scale(bo.vel, dt));
    let hit = false;
    for (const p of s.pirates) {
      if (!p.alive || dist(p.pos, bo.pos) > Math.max(6, p.size * 1.4)) continue;
      p.hp -= bo.dmg;
      p.flash = 0.08;
      if (p.state === 'patrol') p.state = 'attack';
      if (p.hp <= 0) killPirate(s, p);
      hit = true;
      break;
    }
    if (!hit && s.base && dist(s.base.pos, bo.pos) < s.base.r + 4) { hitBase(s, bo.dmg); hit = true; }
    if (!hit && s.devourer) {
      const eye = s.devourer.eyes.find((e) => e.alive && dist(e.pos, bo.pos) < 16);
      if (eye) { hitDevourer(s, eye, bo.dmg); hit = true; } else if (dist(s.devourer.pos, bo.pos) < s.devourer.r) { hitDevourer(s, s.devourer, bo.dmg); hit = true; }
    }
    if (!hit) {
      for (const m of s.emissiles) {
        if (m.life > 0 && dist(m.pos, bo.pos) < 7) { m.life = 0; blast(s, m.pos, 25, '#ffe600', 0.4); hit = true; break; }
      }
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
      sparks(s, bo.pos, '#ffd9a0');
    }
  }
  s.bolts = s.bolts.filter((bo) => bo.life > 0);

  // TUS MISILES: persiguen al blanco fijado
  const tgtPos = (t) => (t === s.base ? (s.base ? s.base.pos : null) : t === s.devourer ? t.pos : t.eye ? (t.alive && s.devourer ? t.pos : null) : t.alive ? t.pos : null);
  for (const m of s.missiles) {
    const tp = m.target && tgtPos(m.target);
    steerMissile(m, tp, dt);
    const reach = m.target === s.base ? s.base.r + 4 : m.target === s.devourer ? s.devourer.r : m.target.eye ? 16 : Math.max(8, m.target.size * 1.6);
    if (tp && dist(m.pos, tp) < reach) {
      m.life = 0;
      blast(s, m.pos, 45, '#ffe600', 0.5);
      if (m.target === s.base) hitBase(s, m.dmg);
      else if (m.target === s.devourer || m.target.eye) hitDevourer(s, m.target, m.dmg);
      else {
        m.target.hp -= m.dmg;
        m.target.flash = 0.1;
        if (m.target.state === 'patrol') m.target.state = 'attack';
        if (m.target.hp <= 0) killPirate(s, m.target);
      }
    }
  }
  s.missiles = s.missiles.filter((m) => m.life > 0);
  // fijar blanco: lo que tengas en el visor
  if (g.up.missile > 0) {
    const cands = s.pirates.filter((p) => p.alive).map((p) => ({ ref: p, pos: p.pos }));
    if (s.base) cands.push({ ref: s.base, pos: s.base.pos });
    if (s.devourer) {
      for (const e of s.devourer.eyes) if (e.alive) cands.push({ ref: e, pos: e.pos });
      if (s.devourer.phase > 1) cands.push({ ref: s.devourer, pos: s.devourer.pos });
    }
    const was = s.lock.locked;
    s.lock = lockStep(s.lock, cands, sh.pos, sh.f, dt * (CHASSIS[g.chassis]?.lockMul ?? 1));
    if (s.lock.locked && !was) sfx.ui();
  }

  // asteroides: giran; chocar con ellos duele y rebota
  for (const a of s.sys.asteroids) {
    if (!a.alive) continue;
    if (a.vel) { // meteoritos de la lluvia
      a.pos = add(a.pos, scale(a.vel, dt));
      a.life -= dt;
      if (a.life <= 0) { a.alive = false; continue; }
    }
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
  updateItems(s, dt);
  updateBase(s, dt);
  updateDevourer(s, dt);
  updateStoryMarker(s, dt);
  updateEvent(s, dt);
  updateEscort(s, dt);
  updateScan(s, dt);
  // planetas: sólidos; cerca de uno aparece ORBITAR
  s.act = null;
  for (let i = 0; i < s.sys.planets.length; i++) {
    const pl = s.sys.planets[i], d = dist(pl.pos, sh.pos);
    if (d < pl.r + 8) sh.pos = add(pl.pos, scale(norm(sub(sh.pos, pl.pos)), pl.r + 9));
    if (d < pl.r + ORBIT_R && !s.act) s.act = { kind: 'orbit', idx: i, label: '🪐 ORBITAR' };
  }
  if (s.event?.kind === 'convoy' && !s.event.done && s.event.near) s.act = { kind: 'trade', label: '🚚 COMERCIAR' };
  // ondas y chispas
  for (const bl of s.blasts) bl.t += dt;
  s.blasts = s.blasts.filter((bl) => bl.t < bl.max);
  for (const p of s.sparks) { p.pos = add(p.pos, scale(p.vel, dt)); p.life -= dt; }
  s.sparks = s.sparks.filter((p) => p.life > 0);

  // mineral y botín: imán y recogida
  const cap = st.cargo;
  for (const o of s.ores) {
    o.life -= dt;
    o.pos = add(o.pos, scale(o.vel, dt));
    o.vel = scale(o.vel, 1 - Math.min(1, dt * 1.5));
    const d = dist(o.pos, sh.pos);
    if (d < MAGNET_R * (hasGear(save, 'bigmag') ? 2 * gearBoost(save, 'bigmag') : 1) && cargoCount(g.cargo) < cap) o.vel = add(o.vel, scale(norm(sub(sh.pos, o.pos)), 900 * dt));
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
    if (d < MAGNET_R * 1.6 * (hasGear(save, 'bigmag') ? 2 : 1)) l.pos = add(l.pos, scale(norm(sub(sh.pos, l.pos)), Math.min(d, 400 * dt)));
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
  if (s.canDock && s.owner === 'pir') {
    s.canDock = false;
    if (!s.pirWarned) { s.pirWarned = true; fx.notice('🏴‍☠️ Estación pirata: libera el sistema para atracar', '#ff2d55'); }
  }
  if (s.canDock && s.act?.kind === 'orbit') s.act = null; // junto a la estación manda ATRACAR

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
      sh.q = rotateLocal(sh.q, 0, Math.PI, 0);
      syncAngles(sh);
      sh.pos = add(gt.pos, scale(norm(scale(gt.pos, -1)), gt.r + 30));
      continue;
    }
    s.jumpT = 1.1;
    s.jumpTo = gt.to;
    // PEAJE de la puerta (si no te llega, te lo perdonan: nunca te quedas atrapado)
    const toll = Math.round(tollFor(to.danger) * Math.max(0.25, 1 - 0.15 * Math.max(0, (g.up.jump || 0) - 5)));
    if (g.credits >= toll) { g.credits -= toll; fx.notice(`🌀 Peaje −${toll} 💰`, '#b8c2cc'); } else fx.notice('🌀 Peaje perdonado (no te llegaba)', '#ff9f0a');
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
  // SUCESO en curso
  const e = s.event;
  if (e && !e.done) {
    let t = null, text = '';
    if (e.kind === 'meteor') {
      text = `☄️ Lluvia de meteoritos: mina rápido (${Math.ceil(e.left)} s)`;
      let bd = Infinity;
      for (const a of s.sys.asteroids) { if (!a.meteor) continue; const d = dist(a.pos, sh.pos); if (d < bd) { bd = d; t = a.pos; } }
    } else if (e.kind === 'rescue') { text = e.held ? '🆘 Lleva la cápsula a la estación' : '🆘 Recoge la cápsula de rescate'; t = e.held ? s.sys.station.pos : e.pod.pos; }
    else if (e.kind === 'convoy') { text = '🚚 Alcanza al convoy y comercia (+40%)'; t = e.ships[0].pos; }
    else if (e.kind === 'wormhole') { text = '🌀 Entra en el agujero de gusano (destino al azar)'; t = e.pos; }
    else if (e.kind === 'siege') { text = `⚔️ Defiende ${GAL[s.sysId].name}: quedan ${e.left} piratas`; t = s.pirates.find((p) => p.siege)?.pos; }
    else if (e.kind === 'assault' && s.base) { text = `🏴‍☠️ Destruye la base pirata (${Math.ceil((s.base.hp / s.base.max) * 100)}%)`; t = s.base.pos; }
    if (t) {
      s.objective = { kind: 'event', text };
      s.target = t;
      return;
    }
  }
  // CAZA activa: al sistema del objetivo y, allí, a por él
  const bo = B().active;
  if (bo) {
    if (bo.sys !== s.sysId) {
      const path = route(GAL, s.sysId, bo.sys);
      const gate = path && s.sys.gates.find((gt) => gt.to === path[1]);
      if (gate) { s.objective = { kind: 'bounty', text: `🎯 Caza a ${bo.name} · está en ${GAL[bo.sys].name}` }; s.target = gate.pos; return; }
    } else {
      const tp = s.pirates.find((p) => p.bounty === bo.id);
      if (tp) { s.objective = { kind: 'bounty', text: `🎯 Abate a ${bo.name} (nivel ${bo.level})` }; s.target = tp.pos; return; }
    }
  }
  // SISTEMA PIRATA: cómo liberarlo
  if (s.owner === 'pir' && !save.territory[s.sysId]) {
    s.objective = { kind: 'liberate', text: s.base ? `🏴‍☠️ Libera ${GAL[s.sysId].name}: destruye la base pirata` : `🏴‍☠️ Libera ${GAL[s.sysId].name}: abate ${Math.max(0, LIBERATE_KILLS - s.libKills)} piratas más` };
    s.target = s.base ? s.base.pos : s.pirates.slice().sort((a, b) => dist(a.pos, sh.pos) - dist(b.pos, sh.pos))[0]?.pos || null;
    if (s.target) return;
  }
  // HISTORIA: el capítulo actual (después de lo que eliges tú: caza y liberar este sistema)
  const ch = storyChapter();
  if (ch && ch.goal.kind !== 'choice') {
    const gsys = ch.goal.sys;
    const text = `📖 Cap. ${storyState(save).ch + 1} · ${ch.goal.text}${ch.goal.n > 1 ? ` (${storyState(save).n}/${ch.goal.n})` : ''}`;
    if (gsys !== s.sysId) {
      const path = route(GAL, s.sysId, gsys);
      const gate = path && s.sys.gates.find((gt) => gt.to === path[1]);
      if (gate && canJump(GAL[path[1]], g.up.jump || 0)) { s.objective = { kind: 'story', text }; s.target = gate.pos; return; }
    } else {
      let t = null;
      if (ch.goal.kind === 'reach') t = s.storyMarker;
      else if (ch.goal.kind === 'dock') t = s.sys.station.pos;
      else if (ch.goal.kind === 'base') t = s.base?.pos;
      else if (ch.goal.kind === 'boss') t = s.devourer ? (s.devourer.eyes.find((ey) => ey.alive)?.pos || s.devourer.pos) : s.pirates.find((p) => p.story)?.pos;
      else if (ch.goal.kind === 'kill') t = s.pirates.slice().sort((a, b) => dist(a.pos, sh.pos) - dist(b.pos, sh.pos))[0]?.pos;
      if (t) { s.objective = { kind: 'story', text }; s.target = t; return; }
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
  const n = Math.max(1, Math.round(a.r / 6)) * (a.meteor ? 2 : 1);
  blast(s, a.pos, a.r * 2.5, '#c9b8a0', 0.45);
  for (let i = 0; i < n; i++) {
    const v = { x: s.rng.range(-1, 1), y: s.rng.range(-1, 1), z: s.rng.range(-1, 1) };
    s.ores.push({ pos: { ...a.pos }, vel: scale(norm(v), s.rng.range(20, 50)), ore: a.ore, life: 40 });
  }
  progress('asteroid');
}

export { snapThrottle };
export const shipDef = () => SHIPS.find((x) => x.id === save.ship) || SHIPS[0];
export { UPGRADES, upgradeCost, repairCost, stats as spaceStats };

export function leaveSpace() {
  const s = S();
  if (s) gal().hull = s.ship.hull;
  persist();
  musicStop();
  G.space = null;
}
