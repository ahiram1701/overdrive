// GALAXIA: lógica de vuelo, minería, combate, comercio, saltos y reaparición. Pseudo-3D detrás de la nave.
// Relajado: si te destruyen, te remolcan a tu estación base (pierdes la carga, no la partida), y
// junto a las estaciones hay zona segura (los piratas no entran).
import { G } from './state.js';
import { makeRng, hashString, todayKey } from './rng.js';
import { save, persist } from './save.js';
import { fx } from './fx.js';
import { sfx, music, musicStart, musicStop, musicDuck } from './audio.js';
import { basis, add, sub, scale, norm, dist, chaseCam, angleTo, lookAngles, angDiff, project, quatFromYawPitch, rotateLocal, basisQ, anglesOf } from './space3d.js';
import { CHASSIS, upgradeMats, effLvl, snapThrottle, shipStats, makeSystem, makeAsteroid, cargoCount, ORES, UPGRADES, upgradeCost, repairCost, objective } from './galaxyData.js';
import { stationOf } from './galaxyLore.js';
import { spawnTraffic, updateTraffic, rumor } from './galaxyTraffic.js';
import { tickFleet, collectFleet, payCrew, crewMul, fleetOf, shipInsured, SHIP_INSURE } from './fleet.js';
import { GALAXY_SEED, rebuildGalaxy, expandAround, isCore, canJump, jumpNeeded, route } from './galaxy.js';
import { LORE, poisOf, POI_KINDS, SCAN_TIME, SCAN_R, perksFor, ATLAS_PERKS, boardFor, advanceMissions, MAX_ACTIVE, MISSION_KINDS, contractExpired } from './galaxyMissions.js';
import { addXp } from './progress.js';
import { SHIPS } from './upgrades.js';
import { progress } from './game.js';
import { ui, toast } from './ui.js';
import { hasTalent } from './economy.js';
import { chipBonus, genChip, addChip, CHIP_TIERS, chipText, GEAR, owns, gear, MATS, addMat, dropsOf, hasGear, gearBoost, fitSlots, matOf } from './crafting.js';
import { killValue, gearDpsK, power, threatOf, extraPirates, rewardMul, addWanted, jumpWanted, stars, hunterChance, hunterCount, bribe, bribeCost, TRAITS as ELITE_TRAITS, TRAIT_KEYS, eliteChance } from './galaxyThreat.js';
import { world, worldTerritory, tickWorld, warHere, infected, priceMul, oreMul, defendKill, clearNest, reclaim, RIVALS } from './galaxyWorld.js';
import { outpostIncome, MODULES as OUTPOST_MODS, outpostAt, found, canFound, modLvl, marketRate, marketBonus, FOUND_COST, OUTPOST_CAP } from './outposts.js';
import { priceDrift, unitPrice, sellValue, recordSale, recoverMarket, MISSILE_PRICE, tollFor, ITEMS, takeItem, itemCount } from './market.js';
import { SIDES, currentChapter, storyEvent, storyState, markerPos, markerTime, chapterLabel } from './story.js';
import { piratesHeld, CAMPAIGNS, campaignEvent, activeCampaign, acceptCampaign, CAMP_LEN, FACTIONS, ownerOf, addRep, repOf, repLevel, bestAlly, LIBERATE_KILLS, FACTION_SHOP, lvlAtLeast, bountyBoard, moveBounty, bountyStats, nemesisUp, TRAITS } from './factions.js';
import { eventFor, EVENTS, MISSILE, missileAmmo, missileDmg, steerMissile, lockStep, ENEMY_KINDS, enemyKind, planetInfo } from './galaxyEvents.js';
import { attackTarget, spots, pickDiver, fireStep, inhibited, rareKind, wingsFor, stalkerVisible, FIRE_CONE, CALL_TIME, CALL_ADDS } from './galaxyTactics.js';
import { diffOf, towFee, respawnHull, pirateMul, matsLost, makeWreck, wreckExpired, wreckJumpsLeft, recoverWreck, WRECK_R, juicyChance, wantedBonus } from './galaxyRisk.js';
import { CONTACTS, CONTACT_LIFE, nextContactDelay, pickContact, trapChance, contactReward, RINGS, ringPath, ringPay, CRUISE, cruiseStep, INTERDICT, interdictChance } from './galaxyContacts.js';
import { WAVES, ARENA_R, WAVE_PAUSE, wavesFor, killScore, waveBonus, creditsFor, recordRun } from './galaxyIncursion.js';
import { newCombat, bumpStreak, breakStreak, streakMul, addSurge, startSurge, surgeOn, tickCombat, SURGE, ROLL, rollCooldown, rollInvuln, HEAT, shotHeat, GEAR_HEAT, vent, AIM_CONE, BOLT_SPEED, leadPos, GRAZE_R, SHIELD_DELAY } from './galaxyCombat.js';

const S = () => G.space;
const DOCK_R = 150;
const SAFE_R = 380; // zona segura alrededor de la estación
const MAGNET_R = 75;
const BARREL = ROLL.anim; // duración del tonel (s); invulnerable solo al principio (ROLL.invuln)
const ORBIT_R = 160; // a esta distancia de la superficie aparece ORBITAR
// LA GALAXIA de esta partida: cada partida nueva tiene su semilla (las empezadas antes conservan la de siempre).
// Es siempre el mismo array (otros módulos lo importan): al cambiar de semilla se rellena de nuevo.
export const GAL = [];
// (la galaxia es INFINITA: al núcleo se le añaden los sectores que ya generaste, en el mismo orden)
export function useGalaxy(seed, sectors = save.galaxy?.sectors || []) {
  if (GAL.length && GAL.seed === seed && GAL.nSec === sectors.length) return;
  GAL.length = 0;
  GAL.push(...rebuildGalaxy(seed, sectors));
  GAL.seed = seed;
  GAL.nSec = sectors.length;
}
useGalaxy(save.galaxy?.seed ?? GALAXY_SEED);
// al llegar cerca del borde de un sector, aparece el de al lado (y se guarda el orden)
export function expandGalaxy(id) {
  const g = save.galaxy;
  const fresh = expandAround(GAL, GAL.seed, id);
  if (!fresh.length) return 0;
  g.sectors = [...(g.sectors || []), ...fresh];
  GAL.nSec = g.sectors.length;
  return fresh.length;
}
// CICLO+: tras el final de LA SEÑAL, una galaxia nueva cada vez más dura (y que paga más)
export const galaxyCycle = () => save.galaxy?.cycle || 0;
export const cycleOpen = () => !!save.story?.ending && cyclePiratesLeft() === 0;
export const cyclePiratesLeft = () => piratesHeld(GAL.filter(isCore), save.territory || {}).length; // (el Ciclo+ mira el núcleo)
const cycleK = () => 1 + 0.2 * galaxyCycle();

const gal = () => save.galaxy;
// stats de la nave: mejoras del taller + mejoras únicas del ATLAS
export const atlasCount = () => Object.keys(save.galaxyAtlas).length;
const perks = () => perksFor(atlasCount());
// En vuelo se piden muchas veces por paso (120 por segundo): se calculan una vez por paso.
// Atracado o en menús (donde se compra) se recalculan siempre.
let statsMemo = null, statsAt = -1;
const stats = () => {
  const s = S();
  if (s && G.mode === 'galaxy' && statsMemo && statsAt === s.t) return statsMemo;
  statsMemo = calcStats();
  statsAt = s && G.mode === 'galaxy' ? s.t : -1;
  return statsMemo;
};
const calcStats = () => {
  const st = shipStats(gal().up, save.ship, gal().chassis);
  // TRIPULACIÓN: piloto, artillera e ingeniero
  const cp = crewMul(save, 'speed');
  st.speed *= cp; st.turn *= cp;
  st.dmg *= crewMul(save, 'dmg');
  st.regen *= crewMul(save, 'regen');
  // TALENTOS de la galaxia
  if (hasTalent(save, 'g1')) st.cargo += 10;
  if (hasTalent(save, 'g5')) st.shield += 20;
  if (hasGear(save, 'hold')) st.cargo += Math.round(15 * gearBoost(save, 'hold'));
  if (hasGear(save, 'reactive')) st.regen *= 1.6 * gearBoost(save, 'reactive');
  // equipo de FACCIÓN
  if (hasGear(save, 'ligaHold')) st.cargo += Math.round(30 * gearBoost(save, 'ligaHold'));
  if (hasGear(save, 'ligaHull')) st.hull = Math.round(st.hull * 1.35 * gearBoost(save, 'ligaHull'));
  if (hasGear(save, 'coalShield')) { st.shield = Math.round(st.shield * 1.3 * gearBoost(save, 'coalShield')); st.regen *= 1.3; }
  if (hasGear(save, 'coalLance')) st.dmg *= 1.2 * gearBoost(save, 'coalLance');
  if (hasGear(save, 'pirTeeth')) { st.dmg *= 1.3 * gearBoost(save, 'pirTeeth'); st.shield = Math.round(st.shield * 0.9); }
  if (perks().includes('alien')) st.shield += 40;
  if (hasGear(save, 'beam')) { st.fireCd *= 0.69; st.dmg *= 0.75; }
  // CHIPS montados
  const cb = chipBonus(save);
  if (cb.dmg) st.dmg *= 1 + cb.dmg / 100;
  if (cb.shield) st.shield = Math.round(st.shield * (1 + cb.shield / 100));
  if (cb.hull) st.hull = Math.round(st.hull * (1 + cb.hull / 100));
  if (cb.cargo) st.cargo += Math.round(cb.cargo);
  if (cb.regen) st.regen *= 1 + cb.regen / 100;
  if (perks().includes('legend')) { st.dmg *= 1.1; st.hull = Math.round(st.hull * 1.1); }
  return st;
};

// ---------- Facciones ----------
const fmtK = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
// AMENAZA: los piratas se refuerzan con el PODER de tu nave (ver galaxyThreat.js)
export const shipPower = () => power(stats(), gearDpsK(save, gal().up.missile || 0));
export const threat = () => threatOf(shipPower()) * (1 + 0.25 * galaxyCycle());
// la ESTACIÓN de un sistema: su nombre y su tipo (y lo que eso cambia al vender, comprar, reparar y mejorar)
export const stationHere = (id = S()?.sysId ?? 0) => stationOf(GAL[id], sysOwner(id), GAL.seed);
export const sysOwner = (id = S()?.sysId ?? 0) => ownerOf(GAL[id], worldTerritory(save)); // con lo perdido en las ofensivas
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
  // la primera vez, la semilla de esta partida (en los tests y en las partidas ya empezadas, la de siempre)
  if (g.seed == null) g.seed = !g.started && !G.debug ? (Math.random() * 2 ** 31) >>> 0 : GALAXY_SEED;
  useGalaxy(g.seed);
  if (!g.visited?.length) g.visited = [0];
  const st = stats();
  const s = {
    rng: makeRng(forced !== null ? Number(forced) >>> 0 : (Math.random() * 2 ** 32) >>> 0),
    ship: { pos: { x: 0, y: 0, z: 0 }, q: quatFromYawPitch(0, 0), yaw: 0, pitch: 0, roll: 0, throttle: 1, rollIn: 0, shield: st.shield, hull: g.hull ?? st.hull, boostT: 0, boostCd: 0, fireT: 0, hitT: 9, side: 1 },
    input: { x: 0, y: 0 }, firing: false, bolts: [], ebolts: [], ores: [], loot: [], pirates: [], cam: null, t: 0, canDock: false, fullWarned: false,
    objective: null, target: null, heat: 0, overheat: false, jumpT: 0, pirateT: 30, routeTo: null,
    combat: newCombat(g.surge), cruiseK: 1, contact: null, contactT: 20, interdict: null,
    // CONTACTOS al azar: en las pruebas (?debug) solo si se piden (?contacts), para que sean deterministas
    contactsOn: !G.debug || new URLSearchParams(location.search).has('contacts'),
    // TRÁFICO (cargueros, mineros, patrullas): igual, en las pruebas solo si se pide (?traffic)
    trafficOn: !G.debug || new URLSearchParams(location.search).has('traffic'),
    trng: makeRng((Math.random() * 2 ** 32) >>> 0),
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
  musicStart('galaxy');
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
  // GALAXIA INFINITA: cerca del borde de un sector, se abre el siguiente
  if (expandGalaxy(id) && fromId != null) { fx.notice('🌌 Más allá del borde: un sector nuevo en el mapa', '#7df9ff', 3); ui.showTip?.('sector'); }
  s.capsules = null; // (las cápsulas y los objetivos de contrato son de cada sistema)
  s.hitSpawned = {};
  if (def.hidden && fromId !== null && fromId !== undefined) { fx.banner(`🌀 ${def.name}`, 'sistema oculto: mineral oscuro, jefes y piratas de élite', '#c58cff', true, 3); progress('galHidden'); }
  const killedThere = s.sysKills || 0; // abatidos en el sistema del que vienes (para el nivel de búsqueda)
  s.sysKills = 0;
  s.cleared = false; // SISTEMA DESPEJADO se anuncia una vez por visita
  s.contact = null; s.cruiseK = 1;
  s.call = null; s.callDone = false; s.safeWarned = false; s.inhibited = false; // radio pirata, alto el fuego, inhibidor
  const gates = def.links.map((to) => ({ to, name: GAL[to].name, ang: Math.atan2(GAL[to].y - def.y, GAL[to].x - def.x) }));
  s.sysId = id;
  s.sys = makeSystem(id + 1, { name: def.name, sunColor: def.star.color, planets: def.planets, ore: def.ore, gates, danger: def.danger, asteroids: id === 0 ? 80 : 70 });
  s.traffic = s.trafficOn ? spawnTraffic(s.trng, s.sys, sysOwner(id), def.danger) : [];
  // los CAPITANES RIVALES que estén en este sistema también vuelan por aquí
  if (s.trafficOn) for (const R of RIVALS) {
    const st = world(save).rivals?.[R.id];
    if (st?.sys !== id) continue;
    const t = spawnTraffic(s.trng, s.sys, 'liga', 0)[0];
    s.traffic.push({ ...t, id: `r-${R.id}`, kind: R.f === 'pir' ? 'smuggler' : R.style === 'hunt' ? 'patrol' : 'trader', name: `⭐ ${R.name} · nv ${st.lvl}` });
  }
  s.tracers = [];
  s.pirates = [];
  s.ebolts = [];
  s.bolts = [];
  s.ores = [];
  s.loot = [];
  s.pirateT = 25;
  s.pois = poisOf(GAL, id);
  s.scanT = 0;
  s.freighter = null;
  s.missiles = []; s.emissiles = []; s.blasts = []; s.sparks = []; s.trail = []; s.mines = []; s.emines = []; s.decoy = null;
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
  const extra = def.pirates ? extraPirates(threat()) : 0;
  for (let i = 0; i < def.pirates + extra; i++) spawnPirate(s, false);
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
    ui.showTip?.('pirate');
    spawnBase(s);
    fx.notice(`🏴‍☠️ ${def.name} es pirata: destruye su base y ${LIBERATE_KILLS} piratas para liberarlo`, '#ff2d55');
  }
  // SUCESO al llegar por una puerta (o un agujero de gusano)
  if (fromId !== null) {
    g.jumps = (g.jumps || 0) + 1;
    // SUCESOS DE LA GALAXIA: ofensivas y enjambre avanzan con cada salto
    for (const t of tickWorld(save, GAL, g.jumps)) { fx.notice(`📰 ${t}`, '#ffd60a'); ui.showTip?.('worldEvent'); }
    // TU FLOTA: cada salto tuyo, un viaje de cada carguero; la tripulación cobra; la póliza corre
    for (const t of tickFleet(save, GAL, g.jumps)) fx.notice(t, '#ff9f0a', 3);
    if (payCrew(save) < 0) fx.notice('🧑‍✈️ No puedes pagar a la tripulación: este salto trabaja sin ganas', '#ff6b6b', 2.6);
    const FL = fleetOf(save);
    if (FL.insure > 0 && --FL.insure === 0) fx.notice('📄 Tu seguro de nave ha caducado', '#ff9f0a', 2.4);
    // CONTRATOS contrarreloj que se han pasado de plazo
    const late = g.missions.filter((m) => contractExpired(m, g.jumps));
    if (late.length) { g.missions = g.missions.filter((m) => !late.includes(m)); g.boardSeq = (g.boardSeq || 0) + 1; for (const m of late) fx.notice(`⏱️ Contrato fallido: ${m.text}`, '#ff6b6b', 2.4); }
    const bo = B().active;
    if (bo) bo.sys = moveBounty(GAL, bo, g.jumps);
    if (save.territory[id] && makeRng(hashString(`siege-${id}-${g.jumps}`)).next() < 0.25) startEvent(s, { kind: 'siege', id: `siege-${id}-${g.jumps}` });
    else {
      const ev = eventFor(id, g.jumps, def.danger);
      if (ev && !(ev.kind === 'assault' && s.base)) startEvent(s, ev);
    }
  }
  spawnBounty(s);
  placeOutpost(s);
  storyBase(s);
  worldArrive(s);
  // PECIO PROPIO: tu carga perdida espera donde caíste (unos saltos)
  if (wreckExpired(g.wreck, g.jumps || 0)) { fx.notice(`🪦 Tu pecio en ${GAL[g.wreck.sys].name} ha sido saqueado`, '#ff6b6b', 2.4); g.wreck = null; }
  s.wreck = g.wreck && g.wreck.sys === id ? g.wreck : null;
  if (s.wreck) fx.notice(`🪦 Tu pecio está en este sistema (quedan ${wreckJumpsLeft(g.wreck, g.jumps || 0)} saltos)`, '#ffd60a', 2.4);
  // BOTÍN JUGOSO: con mucha carga valiosa, te pueden estar esperando
  if (fromId !== null && id !== 0) {
    const value = Object.entries(g.cargo).reduce((a, [k, n]) => a + (n ? marketValue(k, n, id) : 0), 0);
    if (makeRng(hashString(`juicy-${id}-${g.jumps}`)).next() < juicyChance(value, def.danger)) {
      const at = add(s.ship.pos, scale(s.ship.f || basis(s.ship.yaw, s.ship.pitch).f, 520));
      for (let i = 0; i < (def.danger >= 4 ? 3 : 2); i++) spawnPirate(s, false, null, add(at, { x: i * 45, y: 0, z: i * 30 }));
      fx.banner('🏴‍☠️ ¡EMBOSCADA!', `huelen tu carga (${fmtK(Math.round(value))} 💰)`, '#ff2d55', true);
      sfx.alarm();
    }
  }
  // NIVEL DE BÚSQUEDA: con ⭐⭐ o más, a veces te esperan CAZADORES (no en ORIGEN)
  if (fromId !== null && id !== 0 && makeRng(hashString(`hunt-${id}-${g.jumps}`)).next() < hunterChance(g.wanted || 0)) spawnHunters(s);
  // …y después, si en el sistema anterior no abatiste a nadie, se van olvidando de ti
  if (fromId !== null) jumpWanted(g, killedThere);
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
  campHit(s, ev);
  const done = storyEvent(save, GAL, ev);
  if (!done) return;
  const r = done.reward, g = gal();
  g.credits += r.credits || 0;
  for (const [k, n] of Object.entries(r.mats || {})) addMat(save, k, n);
  if (r.ship && !save.ships.includes(r.ship)) save.ships.push(r.ship);
  for (const c of [r.chassis, r.chassis2]) if (c && !g.hulls.includes(c)) { g.hulls = [...g.hulls, c]; progress('chassis', g.hulls.length); }
  if (done.end === 'act3') { progress('ending'); const sd = SIDES[storyState(save).ending]; if (sd) fx.banner(`${sd.icon} ${sd.ending}`, `¡chasis ${CHASSIS[r.chassis2]?.name || ''} en el astillero!`, '#ffd60a', true, 3.5); }
  fx.banner(`${done.chronicle ? '📜' : '📖'} ${done.title.toUpperCase()}`, `${done.chronicle ? 'crónica' : 'capítulo'} completada · +${r.credits || 0} 💰${r.ship ? ' · ¡nueva nave ERRANTE!' : ''}${r.chassis ? ' · ¡chasis ERRANTE Mk II!' : ''}`, '#bf5af2', true);
  sfx.milestone();
  progress('chapter');
  if (r.ship) progress('storyEnd');
  if (done.end) progress(done.end); // fin de acto
  if (done.chronicle) progress('chronicle');
  persist();
  // diálogo de cierre y, si hay, el del capítulo siguiente
  const next = storyChapter();
  ui.showDialog?.([...done.outro, ...(next ? next.intro : [])], next?.choice);
  if (next) storyState(save).seen[storyState(save).ch] = true;
  spawnStoryBoss(s);
}
// CAMPAÑA DE FACCIÓN: los mismos sucesos que la historia hacen avanzar el encargo activo
function campHit(s, ev) {
  const done = campaignEvent(save, GAL, ev);
  if (!done) return;
  const g = gal(), C = CAMPAIGNS[done.f];
  g.credits += done.reward.credits;
  for (const [k, n] of Object.entries(done.reward.mats || {})) addMat(save, k, n);
  addRep(save, done.f, 6);
  if (done.last && !g.hulls.includes(C.chassis)) { g.hulls = [...g.hulls, C.chassis]; progress('chassis', g.hulls.length); }
  if (done.last) progress('factionCamp');
  fx.banner(`${FACTIONS[done.f].icon} ${C.title.toUpperCase()} ${done.i + 1}/${CAMP_LEN}`, done.last ? `¡campaña completa! chasis ${CHASSIS[C.chassis].name} en el astillero` : `+${done.reward.credits} 💰 · siguiente encargo en cualquier estación`, FACTIONS[done.f].color, true, 3);
  sfx.milestone();
  persist();
}
export function startCampaign(f) {
  if (!acceptCampaign(save, f)) return false;
  persist();
  return true;
}
export const campaignNow = () => activeCampaign(save, GAL);
export function storyChoose(pick) {
  const s = S();
  if (pick === 'free') { addRep(save, 'pir', 25); addRep(save, 'liga', -8); addRep(save, 'coal', -8); } else addRep(save, pick, 20);
  storyHit(s, { type: 'choice', pick });
}
// diálogo de entrada si no se ha visto (al despegar en la galaxia)
export function storyIntro() {
  if (ui.showTip?.('galaxy', storyIntro)) return;
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
    const hp = Math.round(1500 * (ch.goal.hpMul || 1) * threat());
    Object.assign(h, { story: 'herald', name: ch.goal.hpMul ? 'EL HERALDO RENACIDO' : 'EL HERALDO', hp, max: hp, mesh: 'wanderer', size: 15, speed: 95, dmg: 14 * Math.min(2, ch.goal.hpMul || 1) });
    fx.banner('👁️ EL HERALDO', 'te estaba esperando', '#ff2d55', true);
  }
  if (ch.goal.boss === 'devourer' && !s.devourer) spawnDevourer(s);
  if (ch.goal.boss === 'primordial' && !s.devourer) spawnDevourer(s, PRIMORDIAL);
  if (ch.goal.boss === 'queen' && !s.pirates.some((p) => p.alive && p.story === 'queen')) {
    spawnPirate(s, true);
    const q = s.pirates[s.pirates.length - 1];
    const qhp = Math.round(2600 * (ch.goal.hpMul || 1) * threat());
    Object.assign(q, { story: 'queen', name: ch.goal.hpMul ? 'ECO DE LA REINA' : 'LA REINA DEL ENJAMBRE', hp: qhp, max: qhp, mesh: 'kaiju', size: 18, speed: 80, dmg: 12, broodT: 2,
      pal: { hull: '#2a2000', edge: '#ffd60a', glow: '#ff9f0a' } });
    fx.banner('🐝 LA REINA DEL ENJAMBRE', 'sus drones la protegen', '#ffd60a', true);
  }
}
// capítulos "base": si ya liberaste ese sistema, la base vuelve para la historia (si no, se atascaría)
function storyBase(s) {
  const ch = storyChapter();
  if (ch && ch.goal.kind === 'base' && ch.goal.sys === s.sysId && !s.base) spawnBase(s);
  const cp = campaignNow();
  if (cp && cp.kind === 'base' && cp.sys === s.sysId && !s.base) spawnBase(s); // la de la campaña, también
}

// LA REINA DEL ENJAMBRE: pone drones; mientras la protejan 3 o más, su escudo lo aguanta todo
function updateQueen(s, dt) {
  const q = s.pirates.find((p) => p.alive && p.story === 'queen');
  if (!q) return;
  const kids = () => s.pirates.filter((p) => p.alive && p.queenKid).length;
  q.broodT -= dt;
  if (kids() < 3 && q.broodT <= 0) {
    q.broodT = 9;
    const n0 = s.pirates.length;
    spawnPirate(s, false, 'drone', add(q.pos, { x: 40, y: 10, z: -40 }));
    for (const p of s.pirates.slice(n0)) p.queenKid = true;
    fx.notice('🐝 La Reina pone nuevos drones', '#ffd60a');
  }
  const shield = kids() >= 3;
  if (shield && !q.shield) q.shieldHp = q.hp;
  q.shield = shield;
  if (shield) q.hp = Math.max(q.hp, q.shieldHp);
}

// EL DEVORADOR DE ESTRELLAS: fase 1, tres ojos (el núcleo es invulnerable); fase 2, núcleo al
// descubierto con oleadas de drones y misiles; fase 3 (furia, <30%), anillos de balas.
// EL DEVORADOR PRIMORDIAL (fin del Acto III): 4 ojos, más vida y dos anillos de balas en la furia
const PRIMORDIAL = { boss: 'primordial', name: 'EL DEVORADOR PRIMORDIAL', eyes: 4, hp: 7000, eyeHp: 650, rings: 2, color: '#ff2d55' };
export function spawnDevourer(s = S(), o = {}) {
  const st = s.sys.station.pos;
  const pos = add(st, { x: 700, y: 160, z: 700 });
  const t = threat();
  const ne = o.eyes || 3, hp = Math.round((o.hp || 4200) * t), eh = Math.round((o.eyeHp || 450) * t);
  s.devourer = { pos, r: o.eyes ? 70 : 60, hp, max: hp, phase: 1, spin: 0, flash: 0, waveT: 6, volleyT: 4, ringT: 3, eyeT: 2,
    boss: o.boss || 'devourer', name: o.name || 'EL DEVORADOR DE ESTRELLAS', rings: o.rings || 1, color: o.color || null,
    eyes: Array.from({ length: ne }, (_, i) => ({ ang: (i / ne) * Math.PI * 2, hp: eh, max: eh, alive: true, eye: true, pos: { ...pos }, flash: 0 })) };
  fx.banner(`🌑 ${s.devourer.name}`, `destruye sus ${ne === 3 ? 'tres' : 'cuatro'} ojos para dejar el núcleo al descubierto`, o.color || '#bf5af2', true);
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
  if (d.phase === 2 && d.hp < d.max * 0.3) { d.phase = 3; fx.banner('🌑 FURIA', `${d.boss === 'primordial' ? 'el Primordial' : 'el Devorador'} se desata`, '#ff2d55', true); }
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
        for (let r = 0; r < d.rings; r++) {
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 + r * 0.26; // el segundo anillo, girado y en vertical
            s.ebolts.push({ pos: { ...d.pos }, vel: r ? { x: Math.cos(a) * 340, y: Math.sin(a) * 340, z: 0 } : { x: Math.cos(a) * 380, y: 0, z: Math.sin(a) * 380 }, life: 2.4, dmg: 10 });
          }
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
    if (!d.warned) { d.warned = true; fx.notice(`🛡️ Invulnerable: destruye primero sus ${d.eyes.length} ojos`, '#ffe600'); }
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
  storyHit(s, { type: 'boss', boss: d.boss || 'devourer', sys: s.sysId });
}

// BALIZA de la historia: quédate cerca 2 s
function updateStoryMarker(s, dt) {
  const ch = storyChapter();
  if (!ch || !['reach', 'scan'].includes(ch.goal.kind) || ch.goal.sys !== s.sysId) { s.storyMarker = null; return; }
  s.storyMarker = markerPos(s.sysId);
  if (dist(s.storyMarker, s.ship.pos) < 70) {
    s.markerT = (s.markerT || 0) + dt;
    if (ch.goal.kind === 'scan') s.scanStory = Math.min(1, s.markerT / markerTime('scan'));
    if (s.markerT >= markerTime(ch.goal.kind)) { s.markerT = 0; s.scanStory = 0; storyHit(s, { type: ch.goal.kind, sys: s.sysId }); }
  } else s.markerT = Math.max(0, (s.markerT || 0) - dt);
}
// BALIZA de la CAMPAÑA de facción (al otro lado del sistema que la de la historia)
function updateCampMarker(s, dt) {
  const cp = campaignNow();
  if (!cp || !['reach', 'scan'].includes(cp.kind) || cp.sys !== s.sysId) { s.campMarker = null; return; }
  const m = markerPos(s.sysId);
  s.campMarker = { x: -m.x, y: m.y, z: m.z };
  if (dist(s.campMarker, s.ship.pos) < 70) {
    s.campT = (s.campT || 0) + dt;
    if (s.campT >= markerTime(cp.kind)) { s.campT = 0; campHit(s, { type: cp.kind, sys: s.sysId }); }
  } else s.campT = Math.max(0, (s.campT || 0) - dt);
}

// ---------- Amenaza: daño a piratas, rasgos de élite, corbetas, minadores y cazadores ----------
// Todo el daño a un pirata pasa por aquí: escudo de élite y protección de una corbeta cercana
function damagePirate(s, p, dmg, opt = {}) {
  if (!p.alive) return;
  // FRAGATA: su escudo frontal para casi todo; por detrás, su punto débil (el iónico lo atraviesa)
  if (p.kind === 'frigate' && !opt.ion) {
    const f = basis(p.yaw, p.pitch).f, to = norm(sub(s.ship.pos, p.pos)), dot = f.x * to.x + f.y * to.y + f.z * to.z;
    if (dot > 0.35) { dmg *= 0.2; if (!p.told) { p.told = true; fx.notice('🛡️ La fragata para lo que le llega de frente: dale por detrás', '#7df9ff', 2.8); } } else if (dot < -0.35) dmg *= 1.6;
  }
  if (opt.ion && p.eShield > 0) dmg *= 3;
  if (p.kind !== 'corvette' && s.pirates.some((c) => c.alive && c.kind === 'corvette' && c !== p && dist(c.pos, p.pos) < 260)) dmg *= 0.5;
  p.hitT = 0;
  if (!p.aware) alertPirate(s, p);
  if (p.state === 'patrol') p.state = 'attack';
  if (p.eShield > 0) {
    p.eShield = Math.max(0, p.eShield - dmg);
    p.flash = 0.05;
    if (!p.eShield) fx.notice('🛡️ ¡Escudo de élite roto!', '#7df9ff');
    return;
  }
  p.hp -= dmg;
  p.flash = 0.08;
  if (p.hp <= 0) killPirate(s, p);
}
function pirateTraits(s, p, d, dt) {
  p.hitT = (p.hitT || 0) + dt;
  const sh = s.ship;
  // BLINDADO: el escudo vuelve si dejas de darle; REGENERADOR: la vida
  if (p.eShieldMax && p.hitT > 3) p.eShield = Math.min(p.eShieldMax, p.eShield + p.eShieldMax * 0.25 * dt);
  if (p.elite === 'regen' && p.hitT > 2) p.hp = Math.min(p.max, p.hp + p.max * 0.08 * dt);
  // KAMIKAZE: se lanza a por ti y estalla al tocarte
  if (p.elite === 'kamikaze') {
    p.state = 'attack';
    if (d < 16) {
      p.alive = false;
      blast(s, p.pos, 70, '#ff2d55', 0.8);
      sfx.boom();
      if (dist(sh.pos, s.sys.station.pos) >= SAFE_R) hurt(s, 28 + GAL[s.sysId].danger * 4);
    }
  }
  // PORTANAVES: suelta drones (como mucho 4 a la vez)
  if (p.kind === 'carrier' && p.state !== 'patrol') {
    p.launchT = (p.launchT ?? 3) - dt;
    const live = s.pirates.filter((q) => q.alive && q.mother === p).length;
    if (p.launchT <= 0 && live < 4) {
      p.launchT = 8;
      const n0 = s.pirates.length;
      spawnPirate(s, false, 'drone', add(p.pos, { x: 0, y: -6, z: 14 })); // (un grupo de drones)
      s.pirates.splice(n0 + (4 - live)); // como mucho 4 a la vez
      for (const q of s.pirates.slice(n0)) { q.mother = p; q.state = 'attack'; q.aware = true; }
      fx.notice('🛸 La portanaves lanza drones: tumba la nodriza', '#ff9f0a');
    }
  }
  // REPARADOR: cura a los suyos cada poco
  if (p.kind === 'mender') {
    p.healT = (p.healT ?? 2) - dt;
    if (p.healT <= 0) {
      p.healT = 3;
      for (const q of s.pirates) if (q.alive && q !== p && !q.boss && !q.story && q.hp < q.max && dist(q.pos, p.pos) < 320) { q.hp = Math.min(q.max, q.hp + q.max * 0.15); q.flash = 0.06; }
    }
  }
  // FRANCOTIRADOR (y el TIRADOR FANTASMA, que solo se ve mientras apunta): se queda lejos, apunta y dispara un tiro fuerte
  if ((p.elite === 'sniper' || p.kind === 'wraith') && p.state !== 'flee') {
    if (d < 520) p.pos = add(p.pos, scale(norm(sub(p.pos, sh.pos)), p.speed * 0.9 * dt));
    p.snipeCd = (p.snipeCd ?? 2.5) - dt;
    if (p.snipeCd <= 0 && d < 1150 && !p.aimT) { p.aimT = 0.9; p.aimAt = { ...sh.pos }; }
    if (p.aimT) {
      p.aimT -= dt;
      if (p.aimT <= 0) {
        p.aimT = 0;
        p.snipeCd = 3.2;
        s.ebolts.push({ pos: { ...p.pos }, vel: scale(norm(sub(p.aimAt, p.pos)), 900), life: 1.6, dmg: p.dmg * 2.6, big: true });
        sfx.dash();
      }
    }
  }
  // MINADOR: siembra minas por donde pasa
  if (p.kind === 'minelayer' && s.emines.length < 14) {
    p.layT -= dt;
    if (p.layT <= 0) { p.layT = 4; s.emines.push({ pos: { ...p.pos }, life: 22, arm: 1 }); }
  }
}
function updateEMines(s, dt) {
  const sh = s.ship;
  for (const m of s.emines) {
    m.life -= dt;
    m.arm -= dt;
    if (m.arm <= 0 && dist(m.pos, sh.pos) < 16) {
      m.life = 0;
      blast(s, m.pos, 55, '#ff2d55', 0.6);
      sfx.boom();
      if (dist(sh.pos, s.sys.station.pos) >= SAFE_R) hurt(s, 22 + GAL[s.sysId].danger * 3);
    }
    // tus disparos las revientan
    for (const b of s.bolts) if (b.life > 0 && dist(b.pos, m.pos) < 8) { b.life = 0; m.life = 0; blast(s, m.pos, 40, '#ff9f0a', 0.4); }
  }
  s.emines = s.emines.filter((m) => m.life > 0);
}
// CAZADORES: élites que vienen a por ti (y, con 4 ⭐ o más, su comandante)
function spawnHunters(s) {
  const g = gal(), n = hunterCount(g.wanted || 0);
  const at = add(s.ship.pos, scale(norm({ x: s.rng.range(-1, 1), y: 0, z: s.rng.range(-1, 1) }), 650));
  const n0 = s.pirates.length;
  for (let i = 0; i < n; i++) spawnPirate(s, false, 'interceptor', add(at, { x: i * 40, y: 0, z: i * 30 }));
  for (const p of s.pirates.slice(n0)) {
    const tr = s.rng.pick(TRAIT_KEYS);
    Object.assign(p, { elite: tr, name: `🚨 CAZADOR`, hp: p.hp * 2.2, max: p.max * 2.2, state: 'attack', hunter: true,
      eShield: tr === 'shielded' ? p.max : 0, eShieldMax: tr === 'shielded' ? p.max : 0 });
  }
  if (stars(g) >= 4) {
    spawnPirate(s, true, null, add(at, { x: 0, y: 30, z: -60 }));
    s.pirates[s.pirates.length - 1].name = '🚨 JEFE DE CAZA';
  }
  fx.banner('🚨 TE BUSCAN', `${'⭐'.repeat(stars(g))} · ${n} cazadores vienen a por ti`, '#ff2d55', true);
  sfx.alarm?.();
  if (stars(g) >= 5) progress('wanted5');
}
// (debug y tests) un pirata de un tipo y rasgo concretos, delante de ti
export function debugPirate(kind = null, trait = null, ahead = 220) {
  const s = S(), n0 = s.pirates.length;
  spawnPirate(s, false, kind, add(s.ship.pos, scale(basis(s.ship.yaw, s.ship.pitch).f, ahead)));
  const out = s.pirates.slice(n0);
  for (const p of out) {
    if (trait) Object.assign(p, { elite: trait, name: `${ELITE_TRAITS[trait].icon} ÉLITE`, eShield: trait === 'shielded' ? p.max : 0, eShieldMax: trait === 'shielded' ? p.max : 0 });
    else Object.assign(p, { elite: null, eShield: 0, eShieldMax: 0 });
  }
  return out.length;
}
// SOBORNO en la estación: −1 ⭐
export function bribeWanted() {
  const c = bribe(gal(), threat());
  if (c) persist();
  return c;
}
export { bribeCost, stars as wantedStars };

// ---------- Sucesos de la galaxia: ofensivas y enjambre ----------
function worldArrive(s) {
  const war = warHere(save, s.sysId);
  if (war) {
    // la oleada del ataque y su comandante
    for (let i = 0; i < 3; i++) spawnPirate(s, false);
    spawnPirate(s, true);
    s.pirates[s.pirates.length - 1].name = 'COMANDANTE PIRATA';
    fx.banner('⚔️ OFENSIVA PIRATA', `defiende ${GAL[s.sysId].name}: abate ${war.need - war.kills} piratas`, '#ff2d55', true);
  }
  if (infected(save, s.sysId) && !s.base) {
    spawnBase(s);
    s.base.nest = true;
    for (let i = 0; i < 2; i++) spawnPirate(s, false, 'drone');
    fx.banner('🐝 SISTEMA INFECTADO', 'destruye el nido del enjambre', '#ffd60a', true);
  }
}

// ---------- Puesto avanzado ----------
// tu estación propia: más allá de la del sistema, en la línea que sale del sol (nunca cae en él)
function placeOutpost(s) {
  const o = outpostAt(save, s.sysId), st = s.sys.station.pos;
  s.outpost = o ? { pos: add(add(st, scale(norm(sub(st, s.sys.sun.pos)), 480)), { x: 0, y: 70, z: 0 }), r: 26, spin: 0, name: o.name } : null;
}
export function foundOutpost(name) {
  const s = S();
  if (!s || !found(save, s.sysId, name || `Puesto ${GAL[s.sysId].name}`)) return false;
  placeOutpost(s);
  progress('outpost');
  sfx.milestone();
  persist();
  return true;
}
export { canFound, FOUND_COST };
function updateOutpost(s, dt) {
  const o = s.outpost;
  if (!o) return;
  o.spin += dt * 0.3;
  // TORRETAS: disparan solas a los piratas cercanos
  const lv = modLvl(save, s.sysId, 'turrets');
  if (!lv) return;
  o.fireT = (o.fireT || 0) - dt;
  if (o.fireT > 0) return;
  const t = s.pirates.filter((p) => p.alive && dist(p.pos, o.pos) < 700).sort((a, b) => dist(a.pos, o.pos) - dist(b.pos, o.pos))[0];
  if (!t) return;
  o.fireT = 1.2 / lv;
  s.bolts.push({ pos: { ...o.pos }, vel: scale(norm(sub(t.pos, o.pos)), 900), life: 0.9, dmg: 20 + 15 * lv });
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
  addWanted(gal(), 'bounty');
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
  reclaim(save, s.sysId); // si lo perdiste en una ofensiva, vuelve a ser tuyo
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
  const d = s.incursion?.danger ?? def.danger;
  const a = s.rng.range(0, Math.PI * 2), R = s.rng.range(700, 1300);
  const pos = at ? { ...at } : { x: Math.cos(a) * R, y: s.rng.range(-120, 120), z: Math.sin(a) * R };
  if (!at && dist(pos, s.sys.station.pos) < SAFE_R + 200) pos.x += 600;
  const t = threat();
  let k = boss ? 'fighter' : kind || enemyKind(d, s.rng.next());
  // CORBETAS y MINADORES: lejos de ORIGEN o con amenaza alta
  if (!boss && !kind) k = rareKind(d, t, s.rng.next()) || k;
  const K = ENEMY_KINDS[k];
  const vet = pirateMul(diffOf(gal()));
  const hp = Math.round((boss ? 400 + d * 120 : (30 + d * 14) * K.hpK) * t * vet);
  const n = k === 'drone' ? 4 : 1;
  // ESCUADRILLA: cazas e interceptores que patrullan pueden venir con alas en V
  const wings = !boss && !at && (k === 'fighter' || k === 'interceptor') ? wingsFor(d, s.rng.next()) : 0;
  const flank = s.rng.next() < 0.5 ? -1 : 1;
  const n0 = s.pirates.length;
  // ÉLITE con un rasgo (más probable cuanto más amenaza y peligro)
  const elite = !boss && k !== 'drone' && s.rng.next() < eliteChance(t, d) ? s.rng.pick(TRAIT_KEYS) : null;
  const php = elite ? Math.round(hp * 2.2) : hp;
  for (let i = 0; i < n; i++) {
    s.pirates.push({ threat: t, layT: 3, fireK: 1 / (1 + (t - 1) * 0.15), hitT: 9,
      ...(elite ? { elite, name: `${ELITE_TRAITS[elite].icon} ÉLITE`, eShield: elite === 'shielded' ? hp * 0.8 : 0, eShieldMax: elite === 'shielded' ? hp * 0.8 : 0 } : {}),
      pos: i ? add(pos, { x: s.rng.range(-30, 30), y: s.rng.range(-15, 15), z: s.rng.range(-30, 30) }) : pos,
      // ALERTA: los del sistema patrullan su zona sin verte; los que llegan a por ti (at) ya te buscan
      home: { ...pos }, aware: !!at, phase: s.rng.range(0, 6.28), flank: i % 2 ? -flank : flank, orbitA: (i * Math.PI) / 2,
      yaw: s.rng.range(-3, 3), pitch: 0, hp: php, max: php, boss, alive: true, flash: 0, state: at ? 'attack' : 'patrol', t: 0, kind: k, size: boss ? 13 : K.size,
      speed: ((boss ? 70 : 85) + d * 7) * K.speedK * (elite === 'kamikaze' ? 1.25 : 1), turn: (boss ? 1.1 : 1.7) * K.turnK, fireCd: s.rng.range(1, 2), dmg: ((boss ? 9 : 5) + d * 1.6) * (k === 'drone' ? 0.6 : 1) * (K.dmgK || 1) * t ** 0.75 * vet,
      missileCd: K.missiles ? 3 : 0,
      mesh: boss ? 'kaiju' : K.mesh || s.rng.pick(['raptor', 'viper', 'comet']), off: { x: s.rng.range(-1, 1), y: s.rng.range(-0.4, 0.4), z: s.rng.range(-1, 1) },
    });
  }
  const leader = s.pirates[n0];
  for (let w = 0; w < wings; w++) {
    const wp = { ...leader, pos: add(pos, { x: (w ? 40 : -40), y: 0, z: -35 }), home: { ...pos }, hp: Math.round(php * 0.8), max: Math.round(php * 0.8), elite: null, name: undefined, eShield: 0, eShieldMax: 0,
      leader, wing: w, flank: w ? -flank : flank, fireCd: s.rng.range(1.2, 2.4), mesh: leader.mesh, off: { x: s.rng.range(-1, 1), y: s.rng.range(-0.4, 0.4), z: s.rng.range(-1, 1) } };
    s.pirates.push(wp);
  }
  if (boss && !s.incursion) fx.notice(`☠ Hay un JEFE PIRATA en ${def.name}`, '#ff2d55');
}

// ALERTA: un pirata te ha visto (o le has dado). Avisa a los de su zona; el primero pide refuerzos por radio.
function alertPirate(s, p) {
  p.aware = true;
  if (p.state === 'patrol') p.state = 'attack';
  for (const q of s.pirates) if (q.alive && !q.aware && dist(q.pos, p.pos) < 500) { q.aware = true; q.state = 'attack'; }
  if (!p.boss && !p.story && !p.hunter && !s.call && !s.callDone) {
    s.call = { by: p, t: CALL_TIME };
    p.caller = true;
    fx.notice(`📡 ¡Un pirata pide refuerzos! abátelo antes de ${CALL_TIME} s`, '#ff9f0a', 2.4);
    sfx.alarm();
  }
}

function updatePirates(s, dt) {
  const sh = s.ship, st = s.sys.station.pos;
  const playerSafe = dist(sh.pos, st) < SAFE_R;
  const me = { pos: sh.pos, f: sh.f || basis(sh.yaw, sh.pitch).f, r: sh.r || basis(sh.yaw, sh.pitch).r, speed: sh.speed };
  const myVel = scale(me.f, sh.speed || 0);
  // ENJAMBRE: de los drones que te persiguen, uno a la vez se lanza
  const diver = pickDiver(s.pirates.filter((q) => q.kind === 'drone' && q.aware), s.t);
  // RADIO: si el que avisa sigue vivo al acabar la cuenta, llegan refuerzos
  if (s.call) {
    s.call.t -= dt;
    if (!s.call.by.alive) { s.call = null; s.callDone = true; } else if (s.call.t <= 0) {
      s.call.by.caller = false;
      s.call = null;
      s.callDone = true;
      const at = add(sh.pos, scale(norm({ x: s.rng.range(-1, 1), y: s.rng.range(-0.2, 0.2), z: s.rng.range(-1, 1) }), 650));
      for (let i = 0; i < CALL_ADDS; i++) spawnPirate(s, false, null, add(at, { x: i * 40, y: 0, z: i * 30 }));
      fx.banner('📡 ¡REFUERZOS PIRATAS!', 'no abatiste a tiempo al que avisaba', '#ff2d55');
      sfx.alarm();
    }
  }
  s.inhibited = inhibited(s.pirates, sh.pos);
  for (const p of s.pirates) {
    if (!p.alive) continue;
    p.t += dt;
    p.flash = Math.max(0, p.flash - dt);
    p.revealT = Math.max(0, (p.revealT || 0) - dt);
    const d = dist(p.pos, sh.pos);
    // ALERTA: patrullan su zona hasta verte
    if (!p.aware && !playerSafe && spots(d, false)) alertPirate(s, p);
    // estados: atacar, evadir tras cruzarse, huir con poca vida, merodear si estás a salvo (o no te ha visto)
    if (!p.boss && !p.contract && p.hp < p.max * (p.flees ? 0.5 : 0.25) && p.state !== 'flee') { p.state = 'flee'; p.t = 0; } // (el objetivo de un contrato no huye)
    if (p.state === 'attack' && d < 70) { p.state = 'evade'; p.t = 0; }
    if (p.state === 'evade' && p.t > 1.4) p.state = 'attack';
    if (playerSafe && p.state === 'attack') p.state = 'patrol';
    if (p.state === 'patrol' && !playerSafe && p.aware) p.state = 'attack';
    if (p.kind === 'drone') { p.orbitA = (p.orbitA || 0) + dt * 1.3; p.dive = p === diver; }
    let target;
    const fr = s.freighter;
    if (p.raider && fr && fr.hp > 0) {
      target = fr.pos;
      p.state = 'attack';
    } else if (s.decoy && !p.boss && !p.smuggler) {
      target = s.decoy.pos; // SEÑUELO: lo persiguen a él
      p.state = 'attack';
    } else if (p.state === 'attack') {
      // cada tipo a su manera (ver galaxyTactics.js); los jefes y élites, de frente
      target = p.boss || p.elite ? add(sh.pos, scale(me.f, (sh.speed || 90) * Math.min(1, d / 400))) : attackTarget(p, me, d, { leader: p.leader });
    } else if (p.state === 'evade') target = add(p.pos, scale(norm(add(p.off, basis(p.yaw, p.pitch).f)), 300));
    else if (p.state === 'flee') target = add(p.pos, scale(norm(sub(p.pos, sh.pos)), 500));
    else if (!p.aware) {
      // PATRULLA: vueltas lentas alrededor de su zona
      const a = p.t * 0.25 + (p.phase || 0);
      p.home ||= { ...p.pos };
      target = add(p.home, { x: Math.cos(a) * 220, y: Math.sin(a * 0.7) * 40, z: Math.sin(a) * 220 });
    } else target = add(st, scale(norm(sub(p.pos, st)), SAFE_R + 600)); // ronda lejos de la zona segura
    const want = lookAngles(p.pos, target);
    p.yaw += Math.max(-p.turn * dt, Math.min(p.turn * dt, angDiff(want.yaw, p.yaw)));
    p.pitch += Math.max(-p.turn * dt, Math.min(p.turn * dt, want.pitch - p.pitch));
    p.pitch = Math.max(-1.1, Math.min(1.1, p.pitch));
    const f = basis(p.yaw, p.pitch).f;
    p.f = f;
    p.vel = scale(f, p.speed * (p.state === 'flee' ? 1.3 : !p.aware ? 0.5 : 1));
    p.pos = add(p.pos, scale(p.vel, dt));
    // nunca dentro de la zona segura
    const ds = dist(p.pos, st);
    if (ds < SAFE_R) p.pos = add(st, scale(norm(sub(p.pos, st)), SAFE_R));
    // disparo: alineado contigo y a tiro; apuntan a donde VAS a estar; los cazas, en ráfagas
    p.fireCd -= dt;
    const aim = p.raider && s.freighter ? s.freighter.pos : s.decoy && !p.boss ? s.decoy.pos : sh.pos;
    const dAim = dist(p.pos, aim);
    if (p.state === 'attack' && dAim < 520 && p.fireCd <= 0 && angleTo(p.pos, p.yaw, p.pitch, aim) < (p.boss ? 0.35 : FIRE_CONE) && (p.raider || !playerSafe)) {
      const baseCd = (p.boss ? 0.9 : Math.max(0.5, 1.2 - GAL[s.sysId].danger * 0.08)) * (p.fireK || 1);
      const fs = fireStep(p, baseCd);
      p.fireCd = fs.cd;
      p.burstLeft = fs.burstLeft;
      p.revealT = 0.6; // el ACECHADOR se delata al disparar
      const vb = 520 + p.speed;
      const aimDir = aim === sh.pos ? norm(sub(leadPos(p.pos, sh.pos, myVel, vb), p.pos)) : f;
      const dirs = p.boss ? [-0.12, 0, 0.12] : [0];
      for (const off of dirs) {
        const bf = off ? basis(p.yaw + off, p.pitch).f : aimDir;
        s.ebolts.push({ pos: add(p.pos, scale(bf, 6)), vel: scale(bf, vb), life: 1.3, dmg: p.dmg });
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
    pirateTraits(s, p, d, dt);
    // HUYENDO: se le cae el botín por el camino (perseguirlo paga)
    if (p.state === 'flee' && !p.boss && (p.drops || 0) < 3) {
      p.dropT = (p.dropT ?? 0.5) - dt;
      if (p.dropT <= 0) {
        p.dropT = 1.2;
        p.drops = (p.drops || 0) + 1;
        s.loot.push({ pos: { ...p.pos }, credits: Math.round((25 + GAL[s.sysId].danger * 18) * 0.3), life: 30 });
      }
    }
    if (p.state === 'flee' && d > 1600) p.alive = false; // se escapó
  }
  updateEMines(s, dt);
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
    const db = dist(b.pos, sh.pos);
    if (db < 6) {
      b.life = 0;
      if (dist(sh.pos, st) >= SAFE_R) hurt(s, b.dmg);
    } else if (!b.grazed && db < GRAZE_R) b.near = true;
    else if (b.near && db > GRAZE_R) {
      // ROCE: te ha pasado rozando y no te ha dado
      b.near = false;
      b.grazed = true;
      if (dist(sh.pos, st) >= SAFE_R) { combatGain(s, 'graze'); fx.notice('⚡ ¡ROCE!', '#ff2bd6', 0.5); }
    }
  }
  s.ebolts = s.ebolts.filter((b) => b.life > 0);
  s.pirates = s.pirates.filter((p) => p.alive);
  // refuerzos de vez en cuando (si el sistema tiene piratas)
  const def = GAL[s.sysId];
  s.pirateT -= dt;
  if (def.pirates && s.pirateT <= 0 && !s.incursion) {
    s.pirateT = 45;
    if (s.pirates.filter((p) => !p.boss).length < def.pirates) spawnPirate(s, false);
  }
}

// CHIPS: botín con afijos (jefes siempre; élites y piratas de sistemas ocultos, a veces)
function dropChip(s, p) {
  const hidden = !!GAL[s.sysId]?.hidden;
  const chance = p.boss || p.story ? 1 : p.elite || p.contract ? 0.35 : hidden ? 0.12 : p.kind !== 'drone' ? 0.04 : 0;
  if (!chance || s.rng.next() > chance) return;
  const c = genChip(s.rng, GAL[s.sysId].danger, (p.boss || p.story ? 1 : 0) + (hidden ? 1 : 0));
  if (!addChip(save, c)) { fx.notice('💠 Bolsa de chips llena: desguaza alguno en la estación', '#ff9f0a', 2.6); return; }
  const T = CHIP_TIERS[c.tier];
  fx.notice(`💠 Chip ${T.name}: ${chipText(c)}`, T.color, 3.2);
  progress('galChip');
}
function killPirate(s, p) {
  if (p.shield) { p.hp = p.shieldHp; return; }
  p.alive = false;
  // ESCUADRILLA sin líder: las alas se dispersan (alguna huye)
  for (const q of s.pirates) {
    if (q.leader !== p || !q.alive) continue;
    q.leader = null;
    if (s.rng.next() < 0.4) { q.state = 'flee'; q.t = 0; } else { q.state = 'evade'; q.t = 0; }
  }
  if (s.call?.by === p) { s.call = null; s.callDone = true; fx.notice('📡 ¡Aviso cortado! no vendrán refuerzos', '#30d158'); }
  // RACHA y SOBRECARGA; un instante congelado (más largo si era gordo)
  dropChip(s, p);
  if (p.contract) missionEvent(s, { type: 'hit', id: p.contract });
  combatGain(s, p.boss || p.story ? 'boss' : p.elite ? 'elite' : 'kill', true);
  const mul = streakMul(s.combat.streak);
  fx.hitstop(p.boss ? 0.12 : p.elite ? 0.07 : 0.035);
  const pp = s.cam && project(s.cam, p.pos);
  if (pp) {
    for (const c of ['#ff2d55', '#ffe600', '#fff']) fx.burst(pp.x, pp.y, p.boss ? 60 : 22, c, p.boss ? 600 : 380, 5, 0.7, 0);
    fx.ring(pp.x, pp.y, '#ff9f0a', p.boss ? 400 : 160, 0.4, 10);
  }
  blast(s, p.pos, p.boss ? 130 : p.size * 7, '#ff9f0a', p.boss ? 1.2 : 0.6);
  sfx.boom();
  fx.shake(p.boss ? 25 : 8);
  const d = GAL[s.sysId].danger;
  const value = Math.round((1 + (chipBonus(save).bounty || 0) / 100) * killValue(d, p.boss) * (perks().includes('oracle') ? 2 : 1) * rewardMul(p.threat || 1) * (p.elite ? 2 : 1) * mul * wantedBonus(stars(gal())) * cycleK());
  if (pp && mul > 1.05) fx.score(`💰 ×${mul.toFixed(1)}`, value, pp.x, pp.y, '#ffe600');
  if (!p.inc) s.sysKills = (s.sysKills || 0) + 1;
  if (!p.inc) addWanted(gal(), 'kill');
  if (p.elite) progress('eliteKill');
  ui.showTip?.('galCombat');
  s.loot.push({ pos: { ...p.pos }, credits: value, life: 60 });
  // el último pirata del sistema: cámara lenta y SISTEMA DESPEJADO
  if (!p.boss && !p.inc && !s.cleared && GAL[s.sysId].pirates && !s.base && !s.pirates.some((q) => q.alive)) {
    s.cleared = true;
    fx.slowmo(0.7, 0.25);
    fx.banner('✔ SISTEMA DESPEJADO', `mejor racha x${s.combat.best}`, '#30d158');
  }
  if (p.inc && s.incursion) {
    const pts = killScore(s.incursion.wave, mul, p.boss);
    s.incursion.score += pts;
    if (pp) fx.score('pts', pts, pp.x, pp.y, '#ff2bd6');
  }
  if (p.boss && !p.inc) {
    save.galaxyBoss[s.sysId] = true;
    fx.banner('☠ JEFE PIRATA DERROTADO', `+${value} 💰 al recogerlo`, '#ffe600', true);
    progress('pirateBoss');
  }
  progress('pirate');
  gainMats(s, dropsOf(p.kind, { boss: p.boss, bounty: !!p.bounty }));
  // INCURSIÓN: sus bajas puntúan, pero no cuentan para la historia, los contratos, la reputación ni las ofensivas del sistema
  if (p.inc) return;
  if (p.story) storyHit(s, { type: 'boss', boss: p.story, sys: s.sysId });
  else storyHit(s, { type: 'kill', sys: s.sysId });
  if (s.owner !== 'pir') addRep(save, s.owner, 1);
  addRep(save, 'pir', -1);
  if (s.owner === 'pir') { s.libKills++; checkLiberation(s); }
  if (p.bounty) bountyKilled(s, p);
  if (p.smuggler && s.contact?.ref === p) {
    const cr = contactReward('smuggler', GAL[s.sysId].danger);
    s.contact.paid = true;
    s.loot.push({ pos: { ...p.pos }, credits: cr, life: 60 });
    gainMats(s, { circuitos: 2, chatarra: 2 });
    fx.banner('🏃 CONTRABANDO INCAUTADO', `+${cr} 💰 al recogerlo`, '#30d158', true);
    progress('galContact');
    endContact(s);
  }
  if (defendKill(save, s.sysId, gal().jumps, GAL) === 'saved') {
    const c = 1050 + GAL[s.sysId].danger * 175;
    gal().credits += c;
    addRep(save, s.owner, 12);
    fx.banner('🛡️ OFENSIVA RECHAZADA', `${GAL[s.sysId].name} resiste · +${fmtK(c)} 💰`, '#30d158', true);
    progress('defend', world(save).saved);
    addWanted(gal(), 'defend');
    persist();
  }
  if (p.siege && s.event?.kind === 'siege' && !s.event.done) {
    s.event.left--;
    if (s.event.left <= 0) {
      s.event.done = true;
      const c = 210 + GAL[s.sysId].danger * 56;
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
  const hp = Math.round((600 + d * 150) * threat());
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
  const value = Math.round((480 + d * 140) * rewardMul(threat()));
  addWanted(gal(), 'base');
  s.loot.push({ pos: { ...b.pos }, credits: value, life: 90 });
  if (b.nest) {
    const res = clearNest(save, s.sysId, gal().jumps, GAL);
    const bonus = res === 'wiped' ? 2800 : 850;
    gal().credits += bonus;
    if (res === 'wiped') { addRep(save, s.owner, 15); progress('exterminio'); }
    fx.banner(res === 'wiped' ? '✨ ENJAMBRE EXTERMINADO' : '🔥 NIDO DESTRUIDO', `+${fmtK(bonus)} 💰${res === 'wiped' ? ' · la galaxia respira' : ''}`, '#ffd60a', true);
  } else fx.banner('🏴‍☠️ BASE PIRATA DESTRUIDA', `+${value} 💰 al recogerlo`, '#ffe600', true);
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
  if (id === 'beacon' && s.incursion) { fx.notice('⚔️ En la incursión no funciona la baliza', '#ff2bd6'); sfx.bump(); return false; }
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
      damagePirate(s, p, 150);
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
  if (dist(s.ship.pos, s.sys.station.pos) < SAFE_R) { fx.notice('🕊️ Zona segura: alto el fuego. Sal a pelear', '#7df9ff'); sfx.bump(); return; }
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
  // encadenarlos cansa: cada tonel seguido tarda más en volver
  sh.rollCd = rollCooldown(s.combat, s.t);
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
  } else if (s.act.kind === 'hail') {
    const n = s.act.npc;
    n.hailed = true;
    const seen = g.visited.filter((id) => GAL[id] && !GAL[id].hidden);
    const rows = seen.map((id) => ({ id, p: Object.fromEntries(Object.keys(ORES).map((k) => [k, marketPrice(k, id)])) }));
    const r = rumor(rows, g.cargo, GAL.map((x) => x.name));
    const lines = [
      r ? `«En ${r.name} pagan ${r.price} 💰 por ${ORES[r.ore].icon} ${ORES[r.ore].name}. Te lo digo yo.»` : '«Buen viaje, piloto.»',
      n.kind === 'smuggler' ? '«Y si alguien pregunta, no me has visto.»' : GAL[s.sysId].danger >= 4 ? '«Ojo con los piratas de las puertas.»' : '«Por aquí todo tranquilo.»',
    ];
    fx.banner(`📡 ${n.name}`, lines.join(' '), '#7df9ff', false, 4.5);
    sfx.ui();
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
  if (s.inhibited) { fx.notice('🧲 Un INHIBIDOR cerca anula el impulso: derríbalo', '#bf5af2'); sfx.bump(); return; }
  s.ship.boostT = 1.6;
  s.ship.boostCd = 3.5 * (hasGear(save, 'warpdrv') ? 0.65 / gearBoost(save, 'warpdrv') : 1) * (hasGear(save, 'pirBoost') ? 0.6 / gearBoost(save, 'pirBoost') : 1) * (CHASSIS[gal().chassis]?.boostCd ?? 1);
  sfx.dash();
  fx.vibe(20);
}

export function dock() {
  const s = S();
  if (!s || G.mode !== 'galaxy' || !s.canDock) return;
  G.mode = 'station';
  s.atOutpost = !!s.atOutpostRange;
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
  collectOutposts();
  const fl = collectFleet(save);
  if (fl) { fx.notice(`🚢 Tus cargueros: +${fl} 💰`, '#30d158', 3); persist(); }
  progress('dock');
}
// PUESTOS AVANZADOS: rinden créditos por cada salto que das; se cobran al atracar (como mucho OUTPOST_CAP saltos)
function collectOutposts() {
  const g = gal(), inc = outpostIncome(save);
  const n = Math.min(OUTPOST_CAP, (g.jumps || 0) - (g.incomeAt ?? (g.jumps || 0)));
  g.incomeAt = g.jumps || 0;
  if (!inc || n <= 0) return;
  g.credits += inc * n;
  persist();
  fx.notice(`🏗️ Tus puestos: +${inc * n} 💰 (${n} saltos)`, '#30d158', 3);
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
// (×1,5: por encima de lo máximo que paga la estación con talento, reputación y mercado propio, ×1,42)
// (y con una ESCASEZ del mismo mineral en esta estación, también ×2: nunca se gana comprando y revendiendo aquí)
export const buyPrice = (ore, sysId) => Math.round(stationPrices(sysId)[ore] * 1.5 * oreMul(save, sysId, ore) * priceDrift(sysId, ore, gal().jumps || 0) * (stationHere(sysId ?? S()?.sysId ?? 0)?.buy || 1));

// lo que paga AHORA esta estación por una unidad (baja si le vendes mucho)
export const marketPrice = (ore, sysId = S()?.sysId ?? 0) => unitPrice(save, sysId, ore, stationPrices(sysId)[ore] * priceMul(save, sysId) * oreMul(save, sysId, ore) * priceDrift(sysId, ore, gal().jumps || 0));
// lo que pagaría por n unidades (cada una algo menos)
export const marketValue = (ore, n, sysId = S()?.sysId ?? 0) => sellValue(save, sysId, ore, n, stationPrices(sysId)[ore] * priceMul(save, sysId) * oreMul(save, sysId, ore) * priceDrift(sysId, ore, gal().jumps || 0));

export function sellAll() {
  const g = gal(), sys = S()?.sysId ?? 0;
  let got = 0, units = 0;
  for (const [k, n] of Object.entries(g.cargo)) {
    if (!n) continue;
    got += marketValue(k, n, sys);
    recordSale(save, sys, k, n);
    units += n;
    g.cargo[k] = 0;
  }
  if (units && S()) storyHit(S(), { type: 'sell', sys, amount: units });
  if (hasTalent(save, 'g3')) got = Math.round(got * 1.1); // talento CONTACTOS
  got = Math.round(got * (stationHere(sys)?.sell || 1) * crewMul(save, 'sell') * repBonus(S()?.sysId ?? 0).sell * marketBonus(save, sys) * (hasGear(save, 'ligaHold') ? 1.06 : 1) * (perks().includes('cartographer') ? 1.1 : 1) * cycleK()); // facción, Mercado propio, Atlas y ciclo pagan más
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
  if (!c || c.story || c.faction || g.hulls.includes(id) || g.credits < c.cost) return false;
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
export const missileMax = () => Math.round(chipBonus(save).missile || 0) + missileAmmo(Math.round(effLvl(gal().up.missile || 0))) + (hasTalent(save, 'g2') ? 2 : 0) + (hasGear(save, 'rapid') ? Math.round(2 * gearBoost(save, 'rapid')) : 0) + (CHASSIS[gal().chassis]?.missiles ?? 0);
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
  return c === null ? null : G.mode === 'station' && S() ? Math.round(c * repBonus(S().sysId).disc * (stationHere(S().sysId)?.up || 1)) : c;
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
  const c = Math.ceil((repairCost(s.ship.hull, st.hull) * (hasTalent(save, 'g4') ? 0.5 : 1) * repBonus(s.sysId).disc * (stationHere(s.sysId)?.repair || 1)) / crewMul(save, 'regen')); // el INGENIERO y las fortalezas abaratan
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
  g.missions.push({ ...m, deadline: (g.jumps || 0) + (m.jumps || 0) });
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

// RESCATE (cápsulas a la deriva) y ASESINATO (un objetivo con escolta) de los contratos
// NEBULOSA: dentro, el radar no ve nada lejos (los piratas solo se ven de cerca)
export const NEBULA_R = 1300, NEBULA_SEE = 420;
function updateNebula(s) {
  const neb = s.pois?.find((p) => p.kind === 'nebula' && dist(p.pos, s.ship.pos) < NEBULA_R);
  const was = s.fogged;
  s.fogged = !!neb;
  if (s.fogged && !was) fx.notice('🌫️ Dentro de la nebulosa: sin radar, solo ves lo que está cerca', '#64d2ff', 3);
}
function updateRescueHit(s) {
  const g = gal();
  const rm = g.missions.find((m) => m.kind === 'rescue' && m.sys === s.sysId && m.progress < m.n);
  if (rm && !s.capsules) {
    s.capsules = Array.from({ length: rm.n - rm.progress }, () => { const a = s.rng.range(0, Math.PI * 2), R = s.rng.range(700, 1400); return { pos: { x: Math.cos(a) * R, y: s.rng.range(-120, 120), z: Math.sin(a) * R }, got: false }; });
    fx.notice('🛟 Cápsulas de escape a la deriva: vuela hasta ellas', '#7df9ff', 3);
  }
  for (const c of s.capsules || []) {
    if (c.got || dist(c.pos, s.ship.pos) > 45) continue;
    c.got = true;
    fx.notice('🛟 Cápsula a bordo', '#7df9ff');
    sfx.coin?.(4);
    missionEvent(s, { type: 'rescue', sys: s.sysId });
  }
  const hm = g.missions.find((m) => m.kind === 'hit' && m.sys === s.sysId && m.progress < m.n);
  if (hm && !(s.hitSpawned ||= {})[hm.id]) {
    s.hitSpawned[hm.id] = true;
    const at = add(s.sys.station.pos, { x: s.rng.range(-900, 900), y: 0, z: s.rng.range(900, 1500) });
    const n0 = s.pirates.length;
    spawnPirate(s, false, 'fighter', at);
    const t = s.pirates[n0];
    Object.assign(t, { name: `🗡️ ${hm.target}`, hp: t.max * 3.5, max: t.max * 3.5, contract: hm.id, elite: 'shielded', eShield: t.max * 1.5, eShieldMax: t.max * 1.5, state: 'patrol' });
    for (const k of [-1, 1]) spawnPirate(s, false, 'interceptor', add(at, { x: 40 * k, y: 0, z: -30 }));
    fx.notice(`🗡️ ${hm.target} está en el sistema, con escolta`, '#ff9f0a', 3);
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
  const far = perks().includes('scanner');
  const poi = s.pois.find((p) => !save.galaxyAtlas[p.id] && dist(p.pos, sh.pos) < SCAN_R * (far ? 2 : 1));
  s.scanning = poi || null;
  if (!poi) { s.scanT = Math.max(0, s.scanT - dt * 2); return; }
  s.scanT += dt;
  if (s.scanT < SCAN_TIME * (far ? 0.5 : 1)) return;
  s.scanT = 0;
  const before = perks();
  const nth = atlasCount();
  save.galaxyAtlas[poi.id] = nth + 1; // su número en el Atlas: cada uno cuenta una historia distinta
  const lore = LORE[nth % LORE.length];
  const g = gal();
  g.credits += poi.reward;
  addXp(save, poi.reward);
  fx.banner(`${POI_KINDS[poi.kind].icon} ${POI_KINDS[poi.kind].name.toUpperCase()} DESCUBIERTA`, lore, POI_KINDS[poi.kind].color, true);
  fx.notice(`+${poi.reward} 💰 · ATLAS ${atlasCount()}`, '#ffe600');
  sfx.chest();
  progress('discover');
  gainMats(s, { artefactos: 1, ...(perks().includes('salvager') ? { chatarra: 2 } : {}) });
  anomaly(s, poi);
  missionEvent(s, { type: 'scan', poi: poi.id });
  const fresh = ATLAS_PERKS.filter((pk) => perks().includes(pk.id) && !before.includes(pk.id));
  for (const pk of fresh) fx.banner(`✨ ${pk.name}`, pk.desc, '#ffe600', true);
  persist();
}

// ANOMALÍAS: lo que pasa al escanear cada una
// ESTACIÓN ABANDONADA: 3 oleadas de guardianes; al acabar, su botín
export const DERELICT_WAVES = 3;
function derelictWave(s) {
  const d = s.derelict, before = s.pirates.length;
  d.wave++;
  spawnPirate(s, false, 'drone', add(d.pos, { x: 0, y: 20, z: 60 }));
  if (d.wave >= 2) spawnPirate(s, false, 'fighter', add(d.pos, { x: 120, y: 0, z: -40 }));
  if (d.wave >= 3) spawnPirate(s, false, 'interceptor', add(d.pos, { x: -120, y: 0, z: -40 }));
  for (const p of s.pirates.slice(before)) p.derelict = true;
  fx.notice(`⚠️ Estación abandonada · oleada ${d.wave}/${DERELICT_WAVES}`, '#ff9f0a', 2.6);
}
function updateDerelict(s) {
  const d = s.derelict;
  if (!d || s.pirates.some((p) => p.alive && p.derelict)) return;
  if (d.wave < DERELICT_WAVES) { derelictWave(s); return; }
  s.derelict = null;
  gainMats(s, { chatarra: 12, circuitos: 4, nucleos: 2 });
  gal().credits += 400 + 120 * GAL[s.sysId].danger;
  fx.banner('🏚️ ESTACIÓN LIMPIA', `+${400 + 120 * GAL[s.sysId].danger} 💰 y sus materiales`, '#ff9f0a', true, 3);
}
function anomaly(s, poi) {
  const K = POI_KINDS[poi.kind], g = gal();
  if (K.effect === 'ambush') {
    s.derelict = { pos: poi.pos, wave: 0 };
    derelictWave(s);
  } else if (K.effect === 'gear') {
    const free = Object.keys(GEAR).filter((id) => !GEAR[id].faction && !owns(save, id));
    if (free.length) {
      const id = s.rng.pick(free);
      gear(save).owned[id] = true;
      fx.banner(`🗿 ${GEAR[id].icon} ${GEAR[id].name.toUpperCase()}`, 'la reliquia era equipo: móntalo en el taller', '#ffd60a', true, 3);
    } else gainMats(s, { artefactos: 3 });
  } else if (K.effect === 'ore') {
    const k = Math.max(0, Math.min(10, stats().cargo - cargoCount(g.cargo)));
    g.cargo.dark = (g.cargo.dark || 0) + k;
    fx.notice(k ? `🌫️ +${k} de mineral oscuro en la bodega` : '🌫️ Bodega llena: no cabe el mineral de la nebulosa', '#64d2ff', 3);
  } else if (K.effect === 'credits') {
    g.credits += poi.reward * 2;
    fx.notice(`📻 Recompensa antigua: +${poi.reward * 2} 💰`, '#30d158', 3);
  }
}
// CICLO+: una galaxia nueva (otra semilla). Te llevas la nave, los chasis, el equipo, los talentos, el Atlas y la historia
export function startCycle() {
  if (!cycleOpen() || S()) return false;
  const g = gal();
  g.cycle = galaxyCycle() + 1;
  g.seed = G.debug ? GALAXY_SEED + g.cycle : (Math.random() * 2 ** 31) >>> 0;
  Object.assign(g, { sys: 0, home: 0, visited: [0], missions: [], wreck: null, jumps: 0, wanted: 0, routeTo: null, sectors: [] });
  save.territory = {};
  save.galaxyWorld = {};
  // lo guardado por sistema era de la galaxia anterior: jefes vencidos, planetas, mercados y puestos
  save.galaxyBoss = {};
  save.galaxyPlanets = {};
  save.galaxyMarket = {};
  // los puestos no tienen sitio en la galaxia nueva: se devuelve todo lo invertido en ellos
  for (const o of Object.values(save.outposts || {})) {
    // lo guardado en su almacén vuelve a tu bodega y a tus materiales
    for (const [k, n] of Object.entries(o.store?.cargo || {})) g.cargo[k] = (g.cargo[k] || 0) + n;
    for (const [k, n] of Object.entries(o.store?.mats || {})) addMat(save, k, n);
    g.credits += FOUND_COST;
    for (const [k, l] of Object.entries(o.mods || {})) for (let i = 0; i < l; i++) g.credits += OUTPOST_MODS[k]?.costs[i] || 0;
  }
  save.outposts = {};
  if (save.bounties) save.bounties.active = null;
  useGalaxy(g.seed, []);
  progress('galCycle', g.cycle);
  persist();
  return true;
}

// ---------- Contactos en ruta (ver galaxyContacts.js) ----------
function startContact(s, kind) {
  const sh = s.ship, d = GAL[s.sysId].danger;
  const f = sh.f || basis(sh.yaw, sh.pitch).f, r = sh.r || basis(sh.yaw, sh.pitch).r;
  const pos = add(add(sh.pos, scale(f, 650)), scale(r, s.rng.range(-250, 250)));
  const c = { kind, pos, t: 0 };
  s.contact = c;
  if (s.cruiseK > 1.2) fx.notice('🌠 Contacto: sales del supercrucero', '#7df9ff');
  s.cruiseK = 1;
  const K = CONTACTS[kind];
  if (kind === 'distress') c.trap = s.rng.next() < trapChance(d);
  else if (kind === 'smuggler') {
    spawnPirate(s, false, 'interceptor', pos);
    const p = s.pirates[s.pirates.length - 1];
    Object.assign(p, { smuggler: true, aware: true, state: 'flee', name: '🏃 CONTRABANDISTA', fireCd: 999, hp: p.hp * 1.6, max: p.max * 1.6, elite: null, eShield: 0, eShieldMax: 0 });
    c.ref = p;
  } else if (kind === 'rings') {
    c.rings = ringPath(sh.pos, f, r, s.rng.next() < 0.5 ? -1 : 1);
    c.next = 0;
    c.left = RINGS.time;
    c.pos = c.rings[0];
  } else if (kind === 'storm') {
    c.r = 260;
    c.left = 45;
    for (let i = 0; i < 8; i++) {
      const off = scale(norm({ x: s.rng.range(-1, 1), y: s.rng.range(-0.4, 0.4), z: s.rng.range(-1, 1) }), s.rng.range(40, 200));
      s.sys.asteroids.push(makeAsteroid(s.rng, add(pos, off), s.rng.range(10, 17), 'dark'));
    }
  } else if (kind === 'ambush') {
    const at = add(sh.pos, scale(f, -420));
    for (let i = 0; i < (d >= 4 ? 4 : 3); i++) spawnPirate(s, false, null, add(at, { x: i * 50 - 50, y: s.rng.range(-30, 30), z: i * 25 }));
    fx.banner('🪤 ¡EMBOSCADA!', 'salen del cinturón, detrás de ti', '#ff2d55', true);
    sfx.alarm();
    return endContact(s);
  } else if (kind === 'container') {
    for (let i = 0; i < 2; i++) {
      spawnPirate(s, false, 'fighter', add(pos, { x: i ? 120 : -120, y: 0, z: 60 }));
      Object.assign(s.pirates[s.pirates.length - 1], { aware: false, state: 'patrol', home: { ...pos } });
    }
  }
  fx.notice(`📡 Contacto en el radar: ${K.icon} ${K.name}`, '#7df9ff', 2.4);
  sfx.event();
}
function endContact(s) {
  s.contact = null;
  s.contactT = nextContactDelay(s.rng.next());
}
function payContact(s, credits, mats = {}) {
  gal().credits += credits;
  if (Object.keys(mats).length) gainMats(s, mats);
  persist();
  sfx.chest();
  progress('galContact');
}
function updateContacts(s, dt) {
  const sh = s.ship, d = GAL[s.sysId].danger, c = s.contact;
  if (!c) {
    if (!s.contactsOn || s.incursion) return;
    const safe = dist(sh.pos, s.sys.station.pos) < SAFE_R + 200;
    const busy = (s.event && !s.event.done) || s.pirates.some((p) => p.alive && p.aware && dist(p.pos, sh.pos) < 900);
    if (safe || busy) return;
    s.contactT -= dt;
    if (s.contactT <= 0) startContact(s, pickContact(d, s.rng.next()));
    return;
  }
  c.t += dt;
  const near = (r) => dist(sh.pos, c.pos) < r;
  if (c.kind === 'distress' && near(35)) {
    if (c.trap) {
      for (let i = 0; i < 3; i++) spawnPirate(s, false, null, add(c.pos, scale(norm({ x: s.rng.range(-1, 1), y: s.rng.range(-0.3, 0.3), z: s.rng.range(-1, 1) }), 160)));
      fx.banner('🆘 ¡ERA UNA TRAMPA!', 'piratas por todas partes', '#ff2d55', true);
      sfx.alarm();
    } else {
      const cr = contactReward('distress', d);
      payContact(s, cr, s.rng.next() < 0.3 ? { artefactos: 1 } : { chatarra: 2 });
      fx.banner('🆘 TRIPULACIÓN RESCATADA', `+${cr} 💰`, '#30d158', true);
    }
    return endContact(s);
  }
  if (c.kind === 'smuggler') {
    c.pos = c.ref.pos;
    if (c.t > CONTACT_LIFE && c.ref.alive) c.ref.alive = false; // se le acabó el tiempo: salta y se va
    if (!c.ref.alive && !c.paid) { fx.notice('🏃 El contrabandista se ha escapado', '#ff9f0a'); return endContact(s); }
    return;
  }
  if (c.kind === 'rings') {
    if (c.next > 0) c.left -= dt;
    if (c.next < RINGS.n && dist(sh.pos, c.rings[c.next]) < RINGS.r) {
      c.next++;
      sfx.coin(c.next * 2);
      combatGain(s, 'graze');
      if (c.next < RINGS.n) c.pos = c.rings[c.next];
    }
    if (c.next >= RINGS.n || (c.next > 0 && c.left <= 0)) {
      const cr = ringPay(c.next, d);
      payContact(s, cr);
      fx.banner(c.next >= RINGS.n ? '💠 ¡CARRERA PERFECTA!' : `💠 ${c.next}/${RINGS.n} anillos`, `+${cr} 💰`, c.next >= RINGS.n ? '#30d158' : '#ffe600', true);
      return endContact(s);
    }
  }
  if (c.kind === 'storm') {
    c.left -= dt;
    if (near(c.r)) {
      sh.shield = 0;
      sh.hitT = 0;
      if (!c.warned) { c.warned = true; fx.notice('⚡ Dentro de la tormenta no hay escudo', '#bf5af2'); }
    }
    if (c.left <= 0) { fx.notice('⚡ La tormenta iónica se disipa', '#b8c2cc'); return endContact(s); }
    return;
  }
  if (c.kind === 'container' && near(30)) {
    const cr = contactReward('container', d);
    payContact(s, cr, { chatarra: 3, circuitos: 1 });
    fx.banner('📦 CONTENEDOR RECUPERADO', `+${cr} 💰 · materiales`, '#30d158', true);
    return endContact(s);
  }
  if (c.t > CONTACT_LIFE && !(c.kind === 'rings' && c.next > 0)) { fx.notice(`📡 Contacto perdido: ${CONTACTS[c.kind].name}`, '#b8c2cc'); endContact(s); }
}
export function debugContact(kind) {
  const s = S();
  if (s) startContact(s, kind);
}

// ---------- INCURSIÓN DIARIA (ver galaxyIncursion.js) ----------
// Un sector sellado sobre la estación: 10 oleadas del día. Morir aquí no cuesta nada: acaba la incursión.
export function startIncursion() {
  const s = S();
  if (!s || G.mode !== 'station' || s.jumpT > 0) return false;
  undock();
  const day = todayKey();
  const center = add(s.sys.station.pos, { x: 0, y: 2600, z: 0 });
  // lo que había en el sistema se guarda y vuelve al acabar (la incursión no toca nada de fuera)
  const stash = { pirates: s.pirates, base: s.base, event: s.event, contact: s.contact, freighter: s.freighter, call: s.call, callDone: s.callDone,
    devourer: s.devourer, loot: s.loot, hull: s.ship.hull, streak: s.combat };
  s.pirates = []; s.ebolts = []; s.emissiles = []; s.emines = []; s.missiles = []; s.loot = [];
  s.base = null; s.event = null; s.contact = null; s.freighter = null; s.call = null; s.callDone = true; s.devourer = null;
  s.ship.pos = add(center, { x: 0, y: 0, z: -ARENA_R * 0.6 });
  face(s.ship, lookAngles(s.ship.pos, center).yaw);
  s.cam = null;
  const st = stats();
  s.ship.hull = st.hull;
  s.ship.shield = st.shield;
  s.heat = 0; s.overheat = false;
  s.combat = newCombat(s.combat?.surge);
  s.incursion = { day, center, waves: wavesFor(day), wave: 0, score: 0, pause: 2, waveT: 0, danger: 1, stash };
  fx.banner('⚔️ INCURSIÓN DEL DÍA', `${WAVES} oleadas · la racha multiplica los puntos`, '#ff2bd6', true);
  musicStart('galaxy');
  progress('galIncursion');
  return true;
}
function spawnWave(s) {
  const inc = s.incursion, w = inc.waves[inc.wave];
  inc.wave++;
  inc.waveT = 0;
  inc.danger = w.danger;
  const mark = (n0) => { for (const p of s.pirates.slice(n0)) Object.assign(p, { inc: true, aware: true, state: 'attack' }); };
  w.list.forEach((k, i) => {
    const a = (i / w.list.length) * Math.PI * 2;
    const n0 = s.pirates.length;
    spawnPirate(s, false, k, add(inc.center, { x: Math.cos(a) * ARENA_R * 0.8, y: s.rng.range(-150, 150), z: Math.sin(a) * ARENA_R * 0.8 }));
    mark(n0);
  });
  if (w.boss) {
    const n0 = s.pirates.length;
    spawnPirate(s, true, null, add(inc.center, { x: 0, y: 200, z: ARENA_R * 0.7 }));
    mark(n0);
  }
  fx.banner(`⚔️ OLEADA ${inc.wave}/${WAVES}`, w.boss ? '¡con jefe!' : `${w.list.length} piratas`, '#ff2bd6', true);
  sfx.alarm();
}
function updateIncursion(s, dt) {
  const inc = s.incursion;
  if (!inc) return;
  // el muro del sector
  const off = sub(s.ship.pos, inc.center), d = Math.hypot(off.x, off.y, off.z);
  if (d > ARENA_R) {
    s.ship.pos = add(inc.center, scale(norm(off), ARENA_R));
    if (s.t - (inc.wallT || 0) > 1.5) { inc.wallT = s.t; fx.notice('🧱 Límite del sector', '#ff2bd6', 0.8); }
  }
  if (inc.pause > 0) {
    inc.pause -= dt;
    if (inc.pause <= 0) spawnWave(s);
    return;
  }
  inc.waveT += dt;
  if (s.pirates.some((p) => p.alive && p.inc)) return;
  // oleada superada: bonus por rapidez y escudo lleno
  const bonus = waveBonus(inc.wave, inc.waveT);
  inc.score += bonus;
  if (inc.wave >= WAVES) { endIncursion(s, true); return; }
  fx.banner(`✔ OLEADA ${inc.wave}`, `+${bonus} pts · ${inc.score} en total`, '#30d158');
  s.ship.shield = stats().shield;
  inc.pause = WAVE_PAUSE;
}
function endIncursion(s, won) {
  const inc = s.incursion, g = gal();
  s.incursion = null;
  // oleadas superadas (entre oleadas, la última ya cuenta)
  const waves = won ? WAVES : Math.max(0, inc.pause > 0 ? inc.wave : inc.wave - 1);
  const r = recordRun(g.incursion, inc.day, waves, inc.score);
  g.incursion = r.rec;
  // el botín que quedó flotando en el sector también se cobra
  const cr = creditsFor(inc.score) + s.loot.reduce((a, l) => a + l.credits, 0);
  g.credits += cr;
  if (r.gems) save.gems += r.gems;
  // vuelve todo lo del sistema, y tu nave como estaba (ni reparada gratis ni dañada)
  const sv = inc.stash;
  Object.assign(s, { pirates: sv.pirates.filter((p) => p.alive), base: sv.base, event: sv.event, contact: sv.contact, freighter: sv.freighter, call: sv.call, callDone: sv.callDone, devourer: sv.devourer, loot: sv.loot });
  s.ebolts = []; s.emissiles = []; s.emines = [];
  s.combat = newCombat(s.combat.surge);
  s.ship.hull = sv.hull;
  s.ship.shield = stats().shield;
  undockPose(s);
  persist();
  const medal = r.medal ? ` · ${r.medal.icon} ${r.medal.name}` : '';
  fx.banner(won ? '🏆 INCURSIÓN SUPERADA' : '💥 INCURSIÓN TERMINADA', `${waves}/${WAVES} oleadas · ${fmtK(inc.score)} pts · +${fmtK(cr)} 💰${r.gems ? ` · +${r.gems} 💎` : ''}${medal}${r.isBest ? ' · ¡récord!' : ''}`, won ? '#ffe600' : '#ff6b6b', true);
  sfx.milestone();
  progress('galIncursionWave', waves);
}
export const incursionRecord = () => { const r = gal().incursion; return r && r.day === todayKey() ? r : null; };

// ---------- Racha y sobrecarga (ver galaxyCombat.js) ----------
function combatGain(s, kind, streak = false) {
  const c = s.combat;
  if (streak) {
    const w = bumpStreak(c);
    progress('galStreak', c.streak);
    if (w) fx.banner(w, `racha x${c.streak} · 💰 ×${streakMul(c.streak).toFixed(1)}`, '#ffe600');
  }
  if (addSurge(c, kind)) { fx.notice('⚡ SOBRECARGA LISTA · botón ⚡ (o V)', '#ff2bd6', 2.4); sfx.milestone(); fx.vibe([30, 40, 30]); }
  gal().surge = c.surge; // se guarda: no se pierde al salir de la Galaxia
}
// SOBRECARGA (botón ⚡ o V): unos segundos sin calor, con más daño y más cadencia
export function spaceSurge() {
  const s = S();
  if (!s || G.mode !== 'galaxy') return;
  if (!startSurge(s.combat)) {
    if (!surgeOn(s.combat)) { fx.notice(`⚡ Sobrecarga al ${Math.round(s.combat.surge * 100)}%: abate piratas y roza sus balas`, '#ff2bd6'); sfx.bump(); }
    return;
  }
  s.heat = 0;
  s.overheat = false;
  gal().surge = 0;
  fx.banner('⚡ SOBRECARGA', 'sin calor · más daño · más cadencia', '#ff2bd6', true);
  fx.flash('#ff2bd6', 0.35);
  fx.shake(8);
  sfx.od();
  fx.vibe([20, 40, 60]);
  progress('galSurge');
}

// ---------- Daño y reaparición ----------
// src: 'hit' (balas, misiles, minas, kamikazes: se pueden esquivar con un tonel), 'sun' o 'rock'
function hurt(s, dmg, src = 'hit') {
  if (G.god) return;
  const sh = s.ship;
  if (sh.barrelT > 0 && rollInvuln(sh.barrelT)) {
    // ESQUIVE PERFECTO: algo te iba a dar justo mientras girabas
    if (!sh.dodged && src === 'hit') {
      sh.dodged = true;
      fx.banner('🌀 ¡ESQUIVE PERFECTO!', '', '#7df9ff');
      fx.slowmo(0.4, 0.3);
      fx.vibe(25);
      sfx.near(true, 1);
      combatGain(s, 'perfect', true);
    }
    return;
  }
  sh.hitT = 0;
  const toShield = Math.min(sh.shield, dmg);
  // un golpe en el CASCO rompe la racha
  if (dmg > toShield && src !== 'sun') {
    const had = breakStreak(s.combat);
    if (had >= 3) fx.notice(`💔 Racha perdida (x${had})`, '#ff6b6b');
  }
  // CONTRATOS «sin daño en el casco»: fallidos (el sol también cuenta; la incursión va aparte)
  if (dmg > toShield && !s.incursion) {
    const g = gal(), broken = g.missions.filter((m) => m.mods?.includes('clean'));
    if (broken.length) {
      g.missions = g.missions.filter((m) => !broken.includes(m));
      g.boardSeq = (g.boardSeq || 0) + 1;
      for (const m of broken) fx.notice(`🛡️ Contrato fallido (daño en el casco): ${m.text}`, '#ff6b6b', 2.4);
      persist();
    }
  }
  if (toShield > 0) sh.shieldFx = 0.45;
  sh.shield -= toShield;
  sh.hull -= dmg - toShield;
  fx.shake(10);
  fx.flash(toShield >= dmg ? '#7df9ff' : '#f33', 0.3);
  fx.vibe(40);
  sfx.shield();
  if (sh.hull <= 0) { if (s.incursion) endIncursion(s, false); else respawn(s); }
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
  // DIFICULTAD: en Piloto y Veterano el remolque se paga, vuelves tocado y la carga queda en tu PECIO
  const diff = diffOf(g), danger = GAL[s.sysId].danger;
  const wreck = diff !== 'relaxed' ? makeWreck(s.sysId, s.ship.pos, g.cargo, g.jumps || 0) : null;
  if (wreck) {
    if (g.wreck) fx.notice('🪦 Tu pecio anterior se ha perdido', '#ff6b6b', 2.4);
    g.wreck = wreck;
  }
  const fee = Math.round(towFee(g.credits, danger, diff) * (shipInsured(save) ? SHIP_INSURE.cut : 1)); // con SEGURO, la mitad
  g.credits -= fee;
  const lost = matsLost(save.galaxyMats, diff);
  for (const [k, n] of Object.entries(lost)) save.galaxyMats[k] -= n;
  breakStreak(s.combat);
  for (const k of Object.keys(g.cargo)) g.cargo[k] = 0;
  const st = stats();
  s.ship.hull = Math.round(st.hull * respawnHull(diff));
  s.ship.shield = st.shield;
  g.hull = s.ship.hull;
  s.deathInfo = { fee, wreck: !!wreck, mats: Object.keys(lost).length, diff };
  const home = g.home ?? 0;
  if (home !== s.sysId) enterSystem(s, home, null);
  else {
    s.ores = [];
    undockPose(s);
  }
  s.wreck = g.wreck && g.wreck.sys === s.sysId ? g.wreck : null;
  persist();
  const di = s.deathInfo || {};
  const bits = [`remolcado a ${GAL[home].name}`, di.fee ? `−${fmtK(di.fee)} 💰` : '', di.wreck ? '🪦 tu carga quedó en tu pecio' : di.diff === 'relaxed' ? 'has perdido la carga' : '', di.mats ? `−${di.mats} materiales` : ''];
  fx.banner('💥 NAVE DESTRUIDA', bits.filter(Boolean).join(' · '), '#ff6b6b', true);
  if (diff !== 'relaxed') ui.showTip?.('galRisk');
  sfx.die();
}

// ---------- Bucle ----------
export function updateSpace(dt) {
  const s = S();
  if (!s || G.mode !== 'galaxy') return;
  const sh = s.ship, st = stats(), g = gal();
  // MÚSICA: más capas con piratas cerca, a tope con una jefa (se mira 4 veces por segundo)
  if ((s.musT = (s.musT || 0) - dt) <= 0) {
    s.musT = 0.25;
    // con HISTÉRESIS: sube al acercarse (450) y no baja hasta que se alejan (600) y pasan 2 s
    // la canción de JEFA también: entra a 600, no se va hasta 900 y dura al menos 8 s (antes saltaba
    // entre canciones al rondar los 600 y cada salto volvía al principio)
    let near = 0, far = 0, bossIn = false, bossKeep = false;
    for (const p of s.pirates) {
      if (!p.alive) continue;
      const d = dist(p.pos, sh.pos);
      if (d < 450) near++;
      if (d < 600) { far++; if (p.story) bossIn = true; }
      if (p.story && d < 900) bossKeep = true;
    }
    s.musBossT = Math.max(0, (s.musBossT || 0) - 0.25);
    if (bossIn) s.musBossT = 8;
    const boss = bossIn || (music.boss && (bossKeep || s.musBossT > 0));
    const want = boss ? 3 : near >= 3 ? 2 : near ? 1 : 0, keep = far >= 3 ? 2 : far ? 1 : 0;
    if (want > music.intensity) { music.intensity = want; s.musHold = 2; } else if ((s.musHold = (s.musHold || 0) - 0.25) <= 0) music.intensity = Math.max(want, Math.min(music.intensity, keep));
    music.boss = boss;
  }
  // si alguien fija yaw/pitch a mano (estación, puertas, tests), la orientación se rehace con ellos
  if (!sh.f || sh.yaw !== sh._sy || sh.pitch !== sh._sp) face(sh, sh.yaw, sh.pitch);
  s.t += dt;
  // SALTO en curso: túnel de hiperespacio y aparición en el sistema nuevo
  if (s.jumpT > 0) {
    s.canDock = false; // en pleno salto no se atraca
    // INTERDICCIÓN: te han enganchado en el túnel; forcejea (toca disparo) antes de que acabe
    const it = s.interdict;
    if (it) {
      it.t -= dt;
      const pressed = s.firing && !s.firingWas;
      s.firingWas = s.firing;
      if (pressed) { it.taps++; sfx.bump(); fx.shake(5); fx.vibe(15); }
      if (it.taps >= INTERDICT.taps) { s.interdict = null; fx.banner('🌀 ¡TE HAS SOLTADO!', 'sigues hacia tu destino', '#30d158'); sfx.od(); } else if (it.t <= 0) {
        s.interdict = null;
        s.interdictFail = true;
        fx.banner('⚠️ INTERDICCIÓN', 'llegas con cazadores pegados', '#ff2d55', true);
        sfx.alarm();
      }
      s.cam = chaseCam(s.cam, sh, dt, G.W || 375, G.H || 812);
      return;
    }
    s.jumpT -= dt;
    sh.pos = add(sh.pos, scale(sh.f, 600 * dt));
    if (s.jumpT <= 0) {
      const from = s.sysId;
      enterSystem(s, s.jumpTo, from);
      if (s.beaconJump) { s.beaconJump = false; undockPose(s); } // BALIZA: directo a la estación
      if (s.interdictFail) { s.interdictFail = false; if (s.jumpTo !== 0 && !s.pirates.some((p) => p.alive && p.hunter)) spawnHunters(s); }
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
  // SUPERCRUCERO: motor a tope, sin virar fuerte, sin enemigos cerca ni inhibidor: hasta ×4
  const cruiseOk = sh.throttle >= CRUISE.minThr && sh.boostT <= 0 && turning < 0.35 && !s.inhibited && !(sh.barrelT > 0)
    && !s.pirates.some((p) => p.alive && p.aware && dist(p.pos, sh.pos) < CRUISE.clearR)
    // se sale solo al llegar: cerca del destino, de la estación o dentro del cinturón (polvo)
    && !(s.target && dist(s.target, sh.pos) < 450) && dist(sh.pos, s.sys.station.pos) > 600
    && Math.abs(Math.hypot(sh.pos.x, sh.pos.z) - s.sys.beltR) > 220;
  const wasCruise = s.cruiseK || 1;
  s.cruiseK = cruiseStep(wasCruise, dt, cruiseOk);
  if (wasCruise > 2 && s.cruiseK === 1) { fx.notice('🌠 Fuera del supercrucero', '#b8c2cc', 0.9); fx.shake(4); }
  const want = st.speed * thr * (1 - 0.55 * turning) * s.cruiseK;
  // FRENADA SUAVE: al bajar (o al cambiar de sentido) la nave frena en ~0,4 s en vez de clavarse;
  // al acelerar responde al momento
  const cur = sh.speed ?? want;
  const slowing = Math.abs(want) < Math.abs(cur) || Math.sign(want) !== Math.sign(cur);
  const speed = slowing ? cur + (want - cur) * Math.min(1, dt * 7) : want;
  sh.speed = Math.abs(speed) < 0.5 && want === 0 ? 0 : speed;
  const b = { f: sh.f, r: sh.r, u: sh.u };
  sh.pos = add(sh.pos, scale(b.f, sh.speed * dt));
  recoverMarket(save, dt, (sys) => marketRate(save, sys)); // el Mercado propio de un puesto lo acelera
  // estela del motor en el mundo (cinta 3D)
  s.trailT = (s.trailT || 0) + dt;
  if (s.trailT > 0.025) {
    s.trailT = 0;
    s.trail.unshift(add(sh.pos, scale(sh.f, -3)));
    if (s.trail.length > 28) s.trail.length = 28;
  }
  // escudo: se regenera tras SHIELD_DELAY s sin daño
  sh.hitT += dt;
  if (sh.hitT > SHIELD_DELAY) sh.shield = Math.min(st.shield, sh.shield + st.regen * dt);

  // el sol quema
  const ds = dist(sh.pos, s.sys.sun.pos);
  if (ds < s.sys.sun.r + 60) {
    sh.pos = add(s.sys.sun.pos, scale(norm(sub(sh.pos, s.sys.sun.pos)), s.sys.sun.r + 60));
    hurt(s, 20 * dt * 10, 'sun');
    fx.notice('🔥 ¡Demasiado cerca del sol!', '#ff9f0a');
  }

  // RACHA que caduca y SOBRECARGA que se agota
  const cb = tickCombat(s.combat, dt);
  if (cb.lost >= 3) fx.notice(`Racha terminada (x${cb.lost})`, '#b8c2cc');
  if (cb.surgeEnd) fx.notice('⚡ Sobrecarga agotada', '#b8c2cc');
  const surge = surgeOn(s.combat);
  // láser: se calienta al disparar. Sobrecalentado no dispara, pero si VUELVES A PULSAR con el calor en la
  // franja se ventila al momento; fuera de ella, se atasca (vuelve a tope)
  s.heat = Math.max(0, s.heat - dt * HEAT.cool);
  if (s.overheat && s.heat < HEAT.release) s.overheat = false;
  const pressed = s.firing && !s.firingWas;
  s.firingWas = s.firing;
  if (s.overheat && pressed) {
    const v = vent(s.heat);
    s.heat = v.heat;
    s.overheat = v.overheat;
    if (v.ok) { fx.notice('❄️ ¡VENTILADO!', '#7df9ff', 0.8); sfx.near(false, 1); combatGain(s, 'vent'); } else { fx.notice('🌡️ ¡Atasco! pulsa con el calor en la franja azul', '#ff6a00', 0.9); sfx.bump(); }
  }
  sh.fireT -= dt;
  if (s.firing && sh.fireT <= 0 && !s.overheat) {
    sh.fireT = surge ? st.fireCd / SURGE.fireMul : st.fireCd;
    if (!surge) {
      s.heat += (shotHeat(st.fireCd) + (hasGear(save, 'laser2') ? GEAR_HEAT.laser2 : 0) + (hasGear(save, 'flak') ? GEAR_HEAT.flak : 0) + (hasGear(save, 'burst') ? GEAR_HEAT.burst : 0) + (hasGear(save, 'ion') ? GEAR_HEAT.ion : 0)) * (hasGear(save, 'beam') ? 0.7 : 1) * (1 - Math.min(60, chipBonus(save).cool || 0) / 100);
      if (s.heat >= 1) { s.heat = 1; s.overheat = true; fx.notice('🌡️ Sobrecalentado: vuelve a pulsar en la franja azul', '#ff6a00'); sfx.bump(); }
    }
    const dmg = surge ? st.dmg * SURGE.dmgMul : st.dmg;
    // ZONA SEGURA: alto el fuego (tus disparos no hacen daño a los piratas desde aquí)
    const inSafe = dist(sh.pos, s.sys.station.pos) < SAFE_R;
    if (inSafe && !s.safeWarned && s.pirates.some((p) => p.alive && dist(p.pos, sh.pos) < 900)) { s.safeWarned = true; fx.notice('🕊️ Zona segura: alto el fuego. Sal a pelear', '#7df9ff', 2); }
    // autoapuntado suave (cono estrecho): primero piratas, apuntando a donde VAN a estar; luego asteroides
    let dir = b.f, best = null, bestA = 0.3;
    for (const p of s.pirates) {
      const d = dist(p.pos, sh.pos), ang = angleTo(sh.pos, sh.yaw, sh.pitch, p.pos);
      if (d < 800 && ang < AIM_CONE && (!best || ang < bestA) && stalkerVisible(p, d)) { best = p.vel ? leadPos(sh.pos, p.pos, p.vel, BOLT_SPEED) : p.pos; bestA = ang; }
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
    s.bolts.push({ pos: from, vel: add(scale(dir, BOLT_SPEED), scale(b.f, speed)), life: 0.85, dmg, surge, safe: inSafe, ion: hasGear(save, 'ion'), burst: hasGear(save, 'burst') });
    // EQUIPO fabricado: láser doble, metralla y plasma (también calientan)
    if (hasGear(save, 'laser2')) s.bolts.push({ pos: add(add(sh.pos, scale(b.r, -sh.side * 2.2)), scale(b.f, 4)), vel: add(scale(dir, BOLT_SPEED), scale(b.f, speed)), life: 0.85, dmg: dmg * gearBoost(save, 'laser2'), surge, safe: inSafe });
    if (hasGear(save, 'flak')) for (const k of [-1, 1]) s.bolts.push({ pos: from, vel: add(scale(norm(add(dir, scale(b.r, k * 0.08))), BOLT_SPEED), scale(b.f, speed)), life: 0.6, dmg: dmg * 0.6 * gearBoost(save, 'flak'), surge, safe: inSafe });
    if (hasGear(save, 'plasma') && (sh.shots = (sh.shots || 0) + 1) % 3 === 0) {
      s.bolts.push({ pos: from, vel: add(scale(dir, 700), scale(b.f, speed)), life: 1.1, dmg: dmg * 3 * gearBoost(save, 'plasma'), plasma: true, safe: inSafe });
      if (!surge) s.heat += GEAR_HEAT.plasma;
    }
    if (hasGear(save, 'rail') && (sh.railN = (sh.railN || 0) + 1) % 4 === 0) {
      s.bolts.push({ pos: from, vel: add(scale(dir, 1400), scale(b.f, speed)), life: 0.9, dmg: dmg * 2 * gearBoost(save, 'rail'), pierce: true, rail: true, safe: inSafe });
      if (!surge) s.heat += GEAR_HEAT.rail;
      sfx.rail();
    }
    if (hasGear(save, 'ion')) sfx.ion(); else if (hasGear(save, 'beam')) sfx.beam(); else sfx.swish();
  }

  // TORRETA automática (equipo): dispara sola al pirata más cercano
  if (hasGear(save, 'turret') && dist(sh.pos, s.sys.station.pos) >= SAFE_R) { // alto el fuego: la torreta tampoco
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
      // RIEL: atraviesa (no se para en el primero)
      if (bo.pierce) { if ((bo.hits ||= []).includes(p)) continue; bo.hits.push(p); if (!bo.safe) damagePirate(s, p, bo.dmg, bo); continue; }
      if (!bo.safe) damagePirate(s, p, bo.dmg, bo);
      // FLAK DE ÁREA: también a los de alrededor
      if (bo.burst && !bo.safe) { for (const q of s.pirates) if (q.alive && q !== p && dist(q.pos, p.pos) < 60) damagePirate(s, q, bo.dmg * 0.45); blast(s, p.pos, 30, '#ff9f0a', 0.25); }
      if (s.t - (s.zapT || 0) > 0.07) { s.zapT = s.t; sfx.zap(); }
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
        damagePirate(s, m.target, m.dmg);
        combatGain(s, 'missile');
      }
    }
  }
  s.missiles = s.missiles.filter((m) => m.life > 0);
  // fijar blanco: lo que tengas en el visor
  if (g.up.missile > 0) {
    const cands = s.pirates.filter((p) => p.alive && stalkerVisible(p, dist(p.pos, sh.pos))).map((p) => ({ ref: p, pos: p.pos }));
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
      hurt(s, 12, 'rock');
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
  updateQueen(s, dt);
  updateItems(s, dt);
  updateOutpost(s, dt);
  updateBase(s, dt);
  updateDevourer(s, dt);
  updateStoryMarker(s, dt);
  updateCampMarker(s, dt);
  updateEvent(s, dt);
  updateEscort(s, dt);
  updateRescueHit(s);
  updateDerelict(s);
  updateNebula(s);
  updateScan(s, dt);
  updateContacts(s, dt);
  updateIncursion(s, dt);
  // planetas: sólidos; cerca de uno aparece ORBITAR
  s.act = null;
  for (let i = 0; i < s.sys.planets.length; i++) {
    const pl = s.sys.planets[i], d = dist(pl.pos, sh.pos);
    if (d < pl.r + 8) sh.pos = add(pl.pos, scale(norm(sub(sh.pos, pl.pos)), pl.r + 9));
    if (d < pl.r + ORBIT_R && !s.act) s.act = { kind: 'orbit', idx: i, label: '🪐 ORBITAR' };
  }
  if (s.event?.kind === 'convoy' && !s.event.done && s.event.near) s.act = { kind: 'trade', label: '🚚 COMERCIAR' };
  // TRÁFICO: se mueve, salta y las patrullas te echan una mano contra los piratas
  if (s.traffic?.length) {
    const dmg = 6 + GAL[s.sysId].danger * 2;
    for (const t of updateTraffic(s.trng, s.sys, s.traffic, s.pirates, dt, (n, p) => damagePirate(s, p, dmg, { npc: true }))) s.tracers.push({ ...t, t: 0.15 });
    // con un carguero o minero cerca: SALUDAR (te da un chivatazo de precios)
    if (!s.act) {
      const n = s.traffic.find((x) => x.away <= 0 && !x.hailed && x.kind !== 'patrol' && dist(x.pos, sh.pos) < 160);
      if (n) s.act = { kind: 'hail', npc: n, label: '📡 SALUDAR' };
    }
  }
  for (const tr of s.tracers || []) tr.t -= dt;
  if (s.tracers?.length) s.tracers = s.tracers.filter((tr) => tr.t > 0);
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
  // PECIO PROPIO: al pasar junto a él, recuperas lo que quepa
  if (s.wreck && g.wreck === s.wreck && dist(s.wreck.pos, sh.pos) < WRECK_R) {
    const space = Math.max(0, cap - cargoCount(g.cargo));
    if (!space) {
      if (s.t - (s.wreckWarnT || -9) > 3) { s.wreckWarnT = s.t; fx.notice('📦 Bodega llena: haz sitio para recuperar tu pecio', '#ffe600'); }
    } else {
      const r = recoverWreck(s.wreck, g.cargo, space);
      g.cargo = r.cargo;
      if (r.rest) s.wreck.cargo = r.rest; else { g.wreck = null; s.wreck = null; }
      persist();
      fx.banner('🪦 CARGA RECUPERADA', `+${r.got} de mineral${r.rest ? ' · vuelve a por el resto' : ''}`, '#30d158', true);
      sfx.chest();
    }
  }
  if (cargoCount(g.cargo) < cap) s.fullWarned = false;

  // estación: gira y deja atracar si estás cerca
  s.sys.station.spin += dt * 0.25;
  s.canDock = dist(sh.pos, s.sys.station.pos) < DOCK_R;
  if (s.canDock && s.owner === 'pir') {
    s.canDock = false;
    if (!s.pirWarned) { s.pirWarned = true; fx.notice('🏴‍☠️ Estación pirata: libera el sistema para atracar', '#ff2d55'); }
  }
  s.atOutpostRange = !!(s.outpost && dist(sh.pos, s.outpost.pos) < DOCK_R);
  if (s.atOutpostRange) s.canDock = true; // tu puesto: siempre puedes atracar
  if (s.canDock && s.act?.kind === 'orbit') s.act = null; // junto a la estación manda ATRACAR

  // PUERTAS DE SALTO: atravesarlas te lleva al sistema vecino (si tu Salto da)
  for (const gt of s.sys.gates) {
    if (dist(gt.pos, sh.pos) > gt.r) continue;
    const to = GAL[gt.to];
    if (s.inhibited || !canJump(to, g.up.jump || 0)) {
      if (s.inhibited && (!s.gateWarnT || s.t - s.gateWarnT > 2)) { s.gateWarnT = s.t; fx.notice('🧲 Un INHIBIDOR cerca bloquea el salto: derríbalo', '#bf5af2'); sfx.bump(); }
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
    s.cruiseK = 1;
    // muy buscado: te pueden sacar del hiperespacio
    if (gt.to !== 0 && s.rng.next() < interdictChance(stars(g))) {
      s.interdict = { t: INTERDICT.time, taps: 0 };
      s.firingWas = true; // hay que volver a pulsar
    }
    // PEAJE de la puerta (si no te llega, te lo perdonan: nunca te quedas atrapado)
    const toll = Math.round(tollFor(to.danger) * Math.max(0.25, 1 - 0.15 * Math.max(0, (g.up.jump || 0) - 5)));
    if (g.credits >= toll) { g.credits -= toll; fx.notice(`🌀 Peaje −${toll} 💰`, '#b8c2cc'); } else fx.notice('🌀 Peaje perdonado (no te llegaba)', '#ff9f0a');
    fx.flash('#ffffff', 0.8);
    if (s.interdict) fx.banner('⚠️ ¡INTERDICCIÓN!', '¡toca 🔫 sin parar para soltarte!', '#ff2d55', true);
    else fx.banner('🌀 SALTO', `rumbo a ${to.name}`, '#7df9ff', true);
    sfx.od();
    break;
  }

  // objetivo actual y brújula
  updateObjective(s);
  // un ACECHADOR que aún no se ve tampoco sale en la brújula
  const tp = s.target && s.pirates.find((p) => p.alive && p.pos === s.target);
  if (tp && !stalkerVisible(tp, dist(tp.pos, sh.pos))) s.target = null;
  s.cam = chaseCam(s.cam, sh, dt, G.W || 375, G.H || 812);
}

function updateObjective(s) {
  const g = gal(), sh = s.ship;
  if (s.incursion) {
    const inc = s.incursion, left = s.pirates.filter((p) => p.alive && p.inc);
    s.objective = { kind: 'incursion', text: `⚔️ Incursión · oleada ${inc.wave}/${WAVES} · ${fmtK(inc.score)} pts${left.length ? ` · quedan ${left.length}` : ''}` };
    s.target = left.sort((a, b) => dist(a.pos, sh.pos) - dist(b.pos, sh.pos))[0]?.pos || inc.center;
    return;
  }
  if (s.routeTo !== null && s.routeTo === s.sysId) s.routeTo = null;
  // PECIO PROPIO en este sistema
  if (s.wreck && g.wreck === s.wreck) {
    s.objective = { kind: 'wreck', text: `🪦 Recupera tu carga (quedan ${wreckJumpsLeft(g.wreck, g.jumps || 0)} saltos)` };
    s.target = s.wreck.pos;
    return;
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
  // CONTACTO en ruta
  const ct = s.contact;
  if (ct) {
    const K = CONTACTS[ct.kind];
    const text = ct.kind === 'rings' ? `${K.icon} Anillo ${Math.min(RINGS.n, ct.next + 1)}/${RINGS.n}${ct.next ? ` · ${Math.ceil(ct.left)} s` : ''}` : ct.kind === 'storm' ? `${K.icon} ${K.text} (${Math.ceil(ct.left)} s)` : `${K.icon} ${K.text}`;
    s.objective = { kind: 'contact', text };
    s.target = ct.pos;
    return;
  }
  // RUTA del mapa (lo urgente de aquí va antes)
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
  // SISTEMA PIRATA: cómo liberarlo (salvo que aquí te espere un jefe o una base de la historia)
  const chHere = storyChapter();
  const storyFight = chHere && chHere.goal.sys === s.sysId && ['boss', 'base'].includes(chHere.goal.kind);
  if (s.owner === 'pir' && !save.territory[s.sysId] && !storyFight) {
    s.objective = { kind: 'liberate', text: s.base ? `🏴‍☠️ Libera ${GAL[s.sysId].name}: destruye la base pirata` : `🏴‍☠️ Libera ${GAL[s.sysId].name}: abate ${Math.max(0, LIBERATE_KILLS - s.libKills)} piratas más` };
    s.target = s.base ? s.base.pos : s.pirates.slice().sort((a, b) => dist(a.pos, sh.pos) - dist(b.pos, sh.pos))[0]?.pos || null;
    if (s.target) return;
  }
  // OFENSIVA PIRATA aquí: defiéndelo
  const war = warHere(save, s.sysId);
  if (war) {
    s.objective = { kind: 'war', text: `⚔️ Defiende ${GAL[s.sysId].name}: abate ${war.need - war.kills} piratas más` };
    s.target = s.pirates.filter((p) => p.alive).sort((a, b) => dist(a.pos, sh.pos) - dist(b.pos, sh.pos))[0]?.pos || null;
    if (s.target) return;
  }
  if (s.base?.nest) {
    s.objective = { kind: 'nest', text: `🐝 Destruye el nido del enjambre en ${GAL[s.sysId].name}` };
    s.target = s.base.pos;
    return;
  }
  // HISTORIA: el capítulo actual (después de lo que eliges tú: caza y liberar este sistema)
  const ch = storyChapter();
  // (la Crónica no se acaba: si has aceptado una campaña de facción, va antes que ella)
  if (ch && ch.goal.kind !== 'choice' && !(ch.chronicle && campaignNow())) {
    const gsys = ch.goal.sys;
    const text = `📖 ${chapterLabel(save)} · ${ch.goal.text}${ch.goal.n > 1 ? ` (${storyState(save).n}/${ch.goal.n})` : ''}${ch.goal.kind === 'scan' && s.scanStory ? ` · ${Math.round(s.scanStory * 100)}%` : ''}`;
    if (gsys !== s.sysId) {
      const path = route(GAL, s.sysId, gsys);
      const gate = path && s.sys.gates.find((gt) => gt.to === path[1]);
      if (gate && canJump(GAL[path[1]], g.up.jump || 0)) { s.objective = { kind: 'story', text }; s.target = gate.pos; return; }
      // sin SALTO suficiente: la historia no se esconde; dice qué mejorar (y te lleva a la estación)
      if (gate) { s.objective = { kind: 'story', text: `${text} · 🌀 mejora SALTO a ${jumpNeeded(GAL[path[1]])}` }; s.target = s.sys.station.pos; return; }
    } else {
      let t = null;
      if (ch.goal.kind === 'reach' || ch.goal.kind === 'scan') t = s.storyMarker;
      else if (ch.goal.kind === 'dock' || ch.goal.kind === 'sell') t = s.sys.station.pos;
      else if (ch.goal.kind === 'base') t = s.base?.pos;
      else if (ch.goal.kind === 'boss') t = s.devourer ? (s.devourer.eyes.find((ey) => ey.alive)?.pos || s.devourer.pos) : s.pirates.find((p) => p.story)?.pos;
      else if (ch.goal.kind === 'kill') t = s.pirates.slice().sort((a, b) => dist(a.pos, sh.pos) - dist(b.pos, sh.pos))[0]?.pos;
      if (t) { s.objective = { kind: 'story', text }; s.target = t; return; }
    }
  }
  // CAMPAÑA DE FACCIÓN activa: después de la historia
  const cp = campaignNow();
  if (cp) {
    const ctext = `${FACTIONS[cp.f].icon} ${CAMPAIGNS[cp.f].title} ${cp.i + 1}/${CAMP_LEN} · ${cp.text}${cp.n > 1 ? ` (${save.factionCamp.n || 0}/${cp.n})` : ''}`;
    if (cp.sys !== s.sysId) {
      const path = route(GAL, s.sysId, cp.sys);
      const gate = path && s.sys.gates.find((gt) => gt.to === path[1]);
      if (gate && canJump(GAL[path[1]], g.up.jump || 0)) { s.objective = { kind: 'camp', text: ctext }; s.target = gate.pos; return; }
      // sin SALTO suficiente: lo dice y te lleva a la estación (como la historia)
      if (gate) { s.objective = { kind: 'camp', text: `${ctext} · 🌀 mejora SALTO a ${jumpNeeded(GAL[path[1]])}` }; s.target = s.sys.station.pos; return; }
    } else {
      let t = null;
      if (cp.kind === 'reach' || cp.kind === 'scan') t = s.campMarker;
      else if (cp.kind === 'dock' || cp.kind === 'sell') t = s.sys.station.pos;
      else if (cp.kind === 'base') t = s.base?.pos;
      else if (cp.kind === 'kill') t = s.pirates.filter((p) => p.alive).sort((a, b) => dist(a.pos, sh.pos) - dist(b.pos, sh.pos))[0]?.pos;
      if (t) { s.objective = { kind: 'camp', text: ctext }; s.target = t; return; }
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
      else if (m.kind === 'rescue') t = s.capsules?.find((c) => !c.got)?.pos;
      else if (m.kind === 'hit') t = s.pirates.find((p) => p.alive && p.contract === m.id)?.pos;
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
  combatGain(s, 'rock'); // minar también carga (poco) la sobrecarga
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
  if (s) gal().hull = s.incursion ? s.incursion.stash.hull : s.ship.hull;
  if (s) gal().surge = s.combat?.surge || 0;
  persist();
  musicStop();
  G.space = null;
}
