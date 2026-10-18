// Reglas de la partida: velocidad, puntuación, combo, overdrive, tramos, eventos, recompensas y muerte.
import { G, LANE_W, addShields, shieldCap } from './state.js';
import { makeRng, todayKey, hashString } from './rng.js';
import { save, persist } from './save.js';
import { fx } from './fx.js';
import { sfx, music, musicStart, musicStop, musicDuck } from './audio.js';
import { baseStats, applyCard, offerCards, SHIPS, CARD_BY_ID, shipLvls, applyShipTree, abilityMods } from './upgrades.js';
import { newPlayer, updatePlayer, hookTarget } from './player.js';
import { BIOMES, FORK_REWARDS, updateWorld, spawnBoss, hurtBoss, screenOf, breakObj, bossRz, sweep, fireLaser, hammerLane, runSpeed, SCRIPTS } from './world.js';
import { ABILITIES, newAbility, trigger, tickAbility, canUse, onNearMissCd, isActive } from './abilities.js';
import { baseSpeed, trackSpeed } from './pacing.js';
import { project } from './render.js';
import { ui } from './ui.js';
import { missions } from './missions.js';
import { xpForRun, addXp, trackAch, ACH_GEMS, codexAdd, effectiveRank, prestigeBonus } from './progress.js';
import { takeBoosts, hasTalent, bankCoins } from './economy.js';
import { equipped, addShipStat, achStyle } from './cosmetics.js';
import { capStats, OD_GAIN, OD_COOL, vampireNeed } from './balance.js';
import { ACTS, genAct, nodeById, startOf, eventFor, resolveEffect, progressOf, NODE } from './expedition.js';
import { TRACK_BY_ID, CUP_BY_ID, makeRivals, stepRivals, estimateFinish, standings, GHOST_DT, encodeSample, addPoints, cupMedal, ttMedal, ttTargets, rivalAdapt, MEDALS } from './race.js';
import { MOD_BY_ID, cleanMods, modScore, modGems, mutationOf } from './modifiers.js';
import { boomFx } from './cosfx.js';
import { levelById, levelStars, recordResult, nextLevel, isLevelOpen, totalStars, isPassed, FIXED_SECTORS } from './campaign.js';

const EVENTS = [
  { id: 'invert', name: '¡CONTROLES INVERTIDOS!', sub: 'izquierda es derecha', dur: 5, color: '#ff375f' },
  { id: 'coinrain', name: '¡LLUVIA DE MONEDAS!', sub: 'cógelas todas', dur: 5, color: '#ffcc00' },
  { id: 'flip', name: '¡GRAVEDAD INVERTIDA!', sub: 'el mundo al revés', dur: 5, color: '#bf5af2' },
  { id: 'nearonly', name: 'SOLO NEAR-MISS', sub: 'x3 por near-miss · la distancia no puntúa', dur: 8, color: '#5ac8fa' },
  { id: 'blackout', name: '¡APAGÓN!', sub: 'solo ves lo que tienes cerca', dur: 5, color: '#8e8e93' },
  { id: 'magstorm', name: 'TORMENTA MAGNÉTICA', sub: 'todas las monedas vienen a ti', dur: 6, color: '#ffd60a' },
  { id: 'double', name: 'COMBO DOBLE', sub: 'cada acción suma el doble', dur: 7, color: '#ff2bd6' },
];

// Debug: ?event=id fuerza el evento de cada tramo, ?script=id fuerza un set piece
const DBG = G.debug && typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;

const MULT_WORDS = [[5, '¡BIEN!'], [10, '¡BRUTAL!'], [20, '¡SALVAJE!'], [30, '¡INSANO!'], [50, '¡IMPARABLE!'], [75, '¡DIVINO!'], [99, '¡¡MÁXIMO!!']];
const SPEED_MARKS = [[500, '500 KM/H'], [800, '800 KM/H'], [1000, '1000 KM/H'], [1235, '¡MACH 1!'], [1600, '1600 KM/H'], [2000, '2000 KM/H'], [2470, '¡¡MACH 2!!'], [3705, '¡¡¡MACH 3!!!']];

const run = () => G.run;
// en carrera, chocar o recibir un empujón frena un momento
export const effSpeed = (r = G.run) => r.speed * (r.odTime > 0 ? 1.5 : 1) * (r.crashT > 0 ? 0.45 : r.bumpT > 0 ? 0.8 : 1);
const scoreMult = (r) => r.stats.scoreMult * (r.risk ? 2 : 1) * (r.odTime > 0 ? 2 : 1);

// ---------- Inicio ----------
// opts: { mode: 'endless' | 'mutation' | 'campaign' | 'expedition' | 'race', level, mods }
export function newRun(opts = false) {
  if (typeof opts !== 'object' || !opts) opts = { mode: 'endless' };
  const mutation = opts.mode === 'mutation';
  const expedition = opts.mode === 'expedition';
  const track = opts.mode === 'race' ? TRACK_BY_ID[opts.track] : null;
  const level = opts.mode === 'campaign' ? levelById(opts.level) : null;
  // en modo debug, ?seed=N fija la pista (los tests E2E lo usan para ser reproducibles)
  const forced = G.debug ? new URLSearchParams(location.search).get('seed') : null;
  // CAMPAÑA: cada nivel tiene su semilla fija, así que su pista es siempre la misma y se puede aprender
  const seed = track ? hashString('race-' + track.id) : level ? hashString('camp-' + level.id)
    : forced !== null ? Number(forced) >>> 0
      : mutation ? hashString('mutation-' + todayKey()) : (Math.random() * 2 ** 32) >>> 0;
  const r = {
    // tres RNG: pista (igual para todos en el reto diario), botín (cartas, cofres) e IA (jefe, movers).
    // Así lo que elige cada jugador no desplaza la secuencia de la pista.
    opts, rng: makeRng(seed), lootRng: makeRng(seed ^ 0x9e3779b9), aiRng: makeRng(seed ^ 0x85ebca6b),
    stats: baseStats(),
    dist: 0, time: 0, speed: 28, curve: 0,
    score: 0, coins: 0, chain: 0, mult: 1, maxMult: 1, chainT: 0, coinStreak: 0, lastCoinT: -9,
    od: 0, odTime: 0,
    section: -1, biome: BIOMES[0], sectionEnd: 0, genZ: 40, genHold: false, forkPlaced: false, forkDone: false, forkRewards: {},
    risk: false, riskNext: false, luck: 1, luckNext: 1, minRarityNext: null,
    objects: [], event: null, eventT: 0, nextEventAt: Infinity, rainAcc: 0,
    boss: null, hunter: null, hunters: 0, cards: {}, synergies: new Set(),
    shields: 0, dashCharges: 1, blockedLane: null,
    nearMisses: 0, perfects: 0, hitsTaken: 0, breaks: 0, bosses: 0, speedMark: 0, vampN: 0,
    player: null, result: null,
  };
  G.run = r;
  if (track) {
    // CARRERA: una pista de longitud fija, 3 rivales y tu fantasma (si ya la corriste)
    const cup = CUP_BY_ID[track.cup];
    // CONTRARRELOJ (solo): sin rivales, contra el reloj y tu fantasma
    const solo = !!opts.solo;
    r.race = {
      track, cup, solo, rivals: solo ? [] : makeRivals(cup, seed, rivalAdapt(track, save.raceBest[track.id])), rng: makeRng(seed ^ 0x2468ace), rec: [], recAcc: 0,
      ghost: save.ghosts[track.id] || null, points: opts.points || {}, targets: ttTargets(track),
    };
  }
  if (expedition) {
    // EXPEDICIÓN: mapa del acto 1; se empieza en su salida (un tramo)
    const map = genAct(seed, 0);
    r.exp = { seed, act: 0, map, at: startOf(map).id, path: [startOf(map).id], acts: 0, events: 0 };
  }
  G.player = newPlayer();
  r.player = G.player;
  const ship = SHIPS.find((s) => s.id === save.ship) || SHIPS[0];
  const lvls = shipLvls(save.shipLvl, ship.id);
  ship.apply(r);
  applyShipTree(r, lvls);
  r.ability = newAbility(ship.ability, abilityMods(ship, lvls));
  G.timeWarp = 1;
  // TALENTOS del runner y POTENCIADORES elegidos (no en carreras ni en el reto diario: son justos)
  if (hasTalent(save, 'r1')) addShields(r, 1);
  if (hasTalent(save, 'r3')) r.coins += 60;
  r.deck = { owned: { ...save.cardsOwned }, lvl: { ...save.cardLvl } };
  r.boosts = track ? [] : takeBoosts(save, (id) => id !== 'start' || opts.mode === 'endless');
  if (r.boosts.includes('shield')) addShields(r, 1);
  if (r.boosts.includes('magnet')) r.stats.magnet += 1;
  if (r.boosts.includes('life')) r.extraLife = 1;
  r.xpMult = r.boosts.includes('xp') ? 2 : 1;
  // MODIFICADORES: los elegidos (infinito), los del día (mutación) o los del nivel (campaña).
  // Se aplican después de nave y árbol, así sus topes mandan. ?debug&mods=a,b para los tests.
  const dbgMods = G.debug ? new URLSearchParams(location.search).get('mods') : null;
  const modIds = mutation ? mutationOf(todayKey())
    : level ? cleanMods(level.mods || [])
      : opts.mods ? cleanMods(opts.mods)
      : opts.mode === 'endless' ? cleanMods(dbgMods ? dbgMods.split(',') : save.modsLast, dbgMods ? Infinity : effectiveRank(save))
        : [];
  r.mods = new Set(modIds);
  for (const id of modIds) MOD_BY_ID[id].apply?.(r);
  r.stats.scoreMult *= modScore(modIds);
  r.shields = Math.min(r.shields, shieldCap(r));
  capStats(r);
  r.dashCharges = r.stats.dashMax;

  fx.clear();
  G.slowmo = 0;
  G.hitstop = 0;
  ui.hideAll();
  ui.showHUD(true);
  // ?debug&start=N: empezar en el tramo N, para testear contenido avanzado sin jugar minutos
  const start = G.debug ? Number(new URLSearchParams(location.search).get('start')) : 0;
  if (start > 1) r.section = start - 2;
  // la dificultad de un nivel es la de ese número de tramo del modo infinito
  if (level) {
    r.camp = { level, left: level.sections };
    r.section = level.diff - 1;
  }
  if (track) r.section = track.diff - 1;
  startSection();
  musicStart();
  G.mode = 'play';
  if (save.runs === 0) ui.tutorial();
  if (r.boosts.includes('start') && r.section < 1 && !level && !track) r.section = 1; // 🚀 ARRANQUE: tramo 3
  if (r.boosts.length) { progress('boost', r.boosts.length); persist(); }
  if (r.boosts.includes('luck')) openCards({ title: '🍀 CARTA RARA', next: false, minRarity: 'rare' });
  else if (hasTalent(save, 'r2')) openCards({ title: 'CARTA INICIAL', next: false });
}

function startSection() {
  const r = run();
  r.section++;
  // cartas del mazo que actúan al empezar cada tramo
  r.bumperUsed = false;
  if (r.cards.chatarrero && r.section > 0) r.coins += 15 * r.cards.chatarrero;
  if (r.cards.mecanico && r.section > 0) {
    r.cleanSec = (r.cleanSec || 0) + 1;
    if (r.cleanSec >= 3) { r.cleanSec = 0; gainShield(1, '🔧 MECÁNICO: +1 🛡️'); }
  }
  const lv = r.camp?.level;
  const node = r.exp ? nodeById(r.exp.map, r.exp.at) : null;
  // JEFAZOS: un jefe cada 2 tramos (en vez de cada 3)
  const isBoss = r.race ? false : node ? node.type === 'boss' : lv ? !!lv.boss : r.mods.has('bosses') ? r.section % 2 === 1 : r.section % 3 === 2;
  // sector mezclado: los tramos alternan entre sus dos biomas
  const mixed = lv && lv.biome2 != null && (lv.sections - r.camp.left) % 2 === 1;
  r.biome = BIOMES[r.race ? r.race.track.biome : node ? (r.exp.act * 2 + node.row) % BIOMES.length : lv ? (mixed ? lv.biome2 : lv.biome) : r.section % BIOMES.length];
  if (r.camp) r.camp.left--;
  r.risk = r.riskNext || node?.type === 'elite'; // ÉLITE: x2 puntos y filas más juntas
  r.riskNext = false;
  // modificador de un evento: solo dura este tramo
  for (const id of r.tempMods || []) r.mods.delete(id);
  r.tempMods = [];
  if (r.nextMod && !r.mods.has(r.nextMod)) { r.mods.add(r.nextMod); r.tempMods.push(r.nextMod); }
  r.nextMod = null;
  if (r.odNext) { r.od = 0.999; r.odNext = false; }
  r.forkPlaced = false;
  r.genHold = false;
  r.genZ = Math.max(r.genZ, r.dist + 45);
  r.event = null;
  // cada tramo nuevo perdona una aparición: si no, el Cazador acabaría saliendo a los 1.5 s para siempre
  r.hunters = Math.max(0, r.hunters - 1);
  progress('section', r.section + 1);
  if (r.section + 1 >= 4 && r.mods.size) progress('modsRun', r.mods.size);
  if (isBoss) {
    r.sectionEnd = Infinity;
    spawnBoss(r);
    r.nextEventAt = Infinity;
  } else {
    // longitud del tramo con la velocidad de referencia (por distancia): igual para todos
    r.sectionEnd = r.genZ + trackSpeed(r.genZ, r.stats.speedMult) * (r.race ? r.race.track.len : r.section === 0 ? 14 : 16 + Math.min(r.section, 6));
    // el evento se decide al empezar el tramo: sacarlo del RNG más tarde mezclaría su tirada con las de la pista
    // CAOS: evento en todos los tramos. La tirada se hace exactamente igual que sin él (en el tramo 1
    // no se tira): así el resto de la pista no se mueve y las semillas siguen dando la misma pista
    const evRoll = r.section >= 1 && r.rng.chance(0.6);
    r.nextEventAt = evRoll || (r.section >= 1 && r.mods.has('chaos')) ? r.time + r.rng.range(5, 10) : Infinity;
    r.pendingEvent = r.rng.pick(EVENTS);
    // SET PIECE: a partir del tramo 3, a veces el tramo trae una secuencia guionizada
    const scriptId = r.section >= 2 && r.rng.chance(0.35) ? r.rng.pick(Object.keys(SCRIPTS)) : null;
    const forcedScript = DBG?.get('script');
    const sid = forcedScript && SCRIPTS[forcedScript] ? forcedScript : scriptId;
    r.script = sid ? { id: sid, ...SCRIPTS[sid], i: 0, announced: false } : null;
    const forcedEvent = EVENTS.find((e) => e.id === DBG?.get('event'));
    if (forcedEvent) { r.pendingEvent = forcedEvent; r.nextEventAt = r.time + 2; }
    const title = r.race ? `🏁 ${r.race.track.name.toUpperCase()}` : node ? `ACTO ${r.exp.act + 1} · ${NODE[node.type].icon} ${NODE[node.type].name.toUpperCase()}`
      : lv ? `NIVEL ${lv.id} · ${lv.sections - r.camp.left}/${lv.sections}` : `TRAMO ${r.section + 1}`;
    fx.banner(title, r.biome.name + (r.risk ? '  ·  ☠ RIESGO x2' : ''), r.biome.accent);
  }
  // HIPERESPACIO: gravedad baja (saltos más largos y flotantes); se deshace al salir del bioma
  if (r.lowGrav) {
    r.stats.gravity /= 0.6;
    r.stats.jumpV /= 0.78;
    r.lowGrav = false;
  }
  if (r.biome.id === 'hyper' && !isBoss && !r.mods.has('lowgrav')) {
    r.stats.gravity *= 0.6;
    r.stats.jumpV *= 0.78;
    r.lowGrav = true;
    fx.notice('🪐 Gravedad baja: saltos más largos', '#7df9ff');
  }
  music.biome = r.biome.music;
  music.intensity = Math.min(3, r.section);
}

// eventos de progreso que cuentan como uso de la nave
const SHIP_STAT = { section: 'sections', boss: 'bosses', runs: 'runs' };

// ---------- Combo / puntos / overdrive ----------
export function addChain(n) {
  const r = run();
  const before = r.mult;
  r.chain = Math.min(98.99, r.chain + n * (r.event?.id === 'double' ? 2 : 1)); // evento COMBO DOBLE
  r.chainT = 0;
  r.mult = Math.min(99, 1 + Math.floor(r.chain));
  if (r.mult > r.maxMult) r.maxMult = r.mult;
  for (const [k, word] of MULT_WORDS) {
    if (before < k && r.mult >= k) {
      fx.banner(`x${k}`, word, `hsl(${k * 7},100%,60%)`);
      fx.flash('#fff', 0.25);
      sfx.milestone();
      fx.vibe([20, 30, 20]);
    }
  }
  if (r.mult !== before) {
    ui.pulseMult();
    progress('mult', r.mult);
  }
}

// Fuente única de eventos de progreso: alimenta misiones diarias y logros (y en el futuro la campaña).
// Lo que se completa se celebra en el momento.
export function progress(kind, value = 1) {
  // uso de la nave equipada: desbloquea sus pinturas y su insignia exclusivas
  const stat = SHIP_STAT[kind];
  if (stat) {
    for (const it of addShipStat(save, save.ship, stat)) {
      fx.banner('🎨 ¡EXCLUSIVO DESBLOQUEADO!', `${it.name} · en el hangar de tu nave`, '#bf5af2', true);
      sfx.chest();
      if (G.run) (G.run.cosDone ||= []).push(it.id);
      persist();
    }
  }
  for (const m of missions.track(kind, value)) {
    fx.banner('✔ MISIÓN COMPLETADA', `${m.text}  ·  +${m.gems} 💎`, '#30d158', true);
    fx.flash('#30d158', 0.4);
    sfx.chest();
    fx.vibe([30, 40, 30, 40, 80]);
    if (G.run) G.run.missionsDone = (G.run.missionsDone || 0) + 1;
    persist();
  }
  for (const a of trackAch(save, kind, value)) {
    const st = achStyle(a.id);
    fx.banner(`🏆 ${a.name.toUpperCase()}`, st ? `🎨 Nuevo: ${st.name} · equípalo en Logros` : `${a.desc}  ·  +${ACH_GEMS[a.tier]} 💎`, '#ffd60a', true);
    fx.flash('#ffd60a', 0.35);
    sfx.milestone();
    fx.vibe([20, 30, 60]);
    if (G.run) (G.run.achDone ||= []).push(a.id);
    persist();
  }
}

function resetChain() {
  const r = run();
  r.chain = 0;
  r.mult = 1;
  r.vampN = 0;
}

export function addScore(base, label, x, y, color = '#fff') {
  const r = run();
  const pts = base * r.mult * scoreMult(r);
  r.score += pts;
  if (label && x != null) fx.score(label, pts, x, y, color);
  return pts;
}

// Carga de overdrive por jugar (near-miss, roturas, monedas…): escala con odRate y con OD_GAIN.
// flat: carga directa (ESTALLIDO), que no se multiplica. Nada carga en overdrive ni recalentando.
function addOD(v, flat = false) {
  const r = run();
  if (r.odTime > 0 || r.odCool > 0) return;
  r.od = Math.min(1, r.od + (flat ? v : v * OD_GAIN * r.stats.odRate));
  if (r.od >= 1) activateOD();
}

function activateOD() {
  const r = run();
  r.od = 0;
  r.odTime = r.stats.odDur;
  progress('od');
  music.od = true;
  sfx.od();
  fx.banner('OVERDRIVE', '¡INVENCIBLE!', '#ff2bd6', true);
  fx.flash('#fff', 0.7);
  fx.shake(22);
  fx.vibe([60, 40, 120]);
}

// ---------- Hooks del mundo ----------
function playerScreen() {
  const p = G.player;
  return project(p.x * LANE_W, p.y + 0.4, 0) || { x: G.W / 2, y: G.H * 0.7, s: 100 };
}

export function onNearMiss(o, perfect) {
  const r = run();
  r.nearMisses++;
  if (perfect) r.perfects++;
  const ps = playerScreen();
  const bonus = (r.event?.id === 'nearonly' ? 3 : 1) * (isActive(r.ability, 'overclock') ? 2 : 1);
  addChain(perfect ? 2 : 1);
  progress('near');
  if (perfect) progress('perfect');
  addScore((perfect ? 150 : 60) * bonus, perfect ? '¡PERFECTO!' : 'NEAR-MISS', ps.x, ps.y - ps.s * 0.6, perfect ? '#ffe600' : '#5ac8fa');
  addOD(perfect ? 0.12 : 0.07);
  if (perfect && r.synergies.has('zen')) addOD(0.15);
  if (r.stats.nearDash) r.dashCharges = Math.min(r.stats.dashMax, r.dashCharges + 0.25);
  // jugar bien recarga antes la habilidad
  if (onNearMissCd(r.ability)) abilityReady();
  // mutación "chain": los near-miss alargan la SOBRECARGA
  if (isActive(r.ability, 'overclock') && r.ability.mut === 'chain') r.ability.active += 0.3;
  // Vampiro solo premia jugar bien: near-miss, nunca golpes ni roturas
  if (r.stats.vampire && ++r.vampN >= vampireNeed(r.vampGot || 0)) {
    r.vampN = 0;
    r.vampGot = (r.vampGot || 0) + 1;
    gainShield(1, '+1 🛡️ VAMPIRO');
  }
  fx.slowmo((perfect ? 0.22 : 0.12) * r.stats.nearWin, 0.3);
  fx.burst(ps.x, ps.y, perfect ? 22 : 10, perfect ? '#ffe600' : '#5ac8fa', 380, 4, 0.5, 0);
  if (perfect) fx.ring(ps.x, ps.y, '#ffe600', 120, 0.3, 6);
  fx.shake(perfect ? 5 : 2);
  fx.vibe(perfect ? 22 : 10);
  sfx.near(perfect, r.mult);
}

export function onBreak(o, cause, sp) {
  const r = run();
  r.breaks++;
  addChain(1);
  // DIANA: premio extra por reventarla
  if (o.type === 'drone') {
    const s = sp || playerScreen();
    addScore(300, '🎯 DIANA', s.x, s.y - 50, '#30d158');
    addOD(0.08);
    progress('drone');
  }
  // mutación "recharge": cada rotura con el ARIETE activo recarga 1 s
  if (isActive(r.ability, 'ram') && r.ability.mut === 'recharge') r.ability.cdLeft = Math.max(0, r.ability.cdLeft - 1);
  const s = sp || playerScreen();
  addScore(cause === 'chain' ? 40 : 80, cause === 'chain' ? 'CADENA' : '¡CRASH!', s.x, s.y - 30, '#ff9f0a');
  // lo que arrasa una habilidad (ESTALLIDO, RUGIDO) no recarga el overdrive: si no, se alimenta sola
  if (cause !== 'sweep') addOD(0.05);
}

export function onHit(o) {
  const r = run(), p = G.player;
  const ps = playerScreen();
  if (G.god) return breakObj(o, 'dash');
  r.hitsTaken++;
  if (G.debug) (G.hits ||= []).push({ type: o.type, x: +o.x.toFixed(2), px: +p.x.toFixed(2), lane: p.lane, py: +p.y.toFixed(2), slide: p.slide > 0, sec: r.section, t: Math.round(r.time), ev: r.event?.id, hunter: !!o.hunter, boss: !!r.boss });
  // PARACHOQUES (carta): el primer golpe de cada tramo no quita escudo, pero sí combo y overdrive
  if (r.cards.parachoques && !r.bumperUsed && !o.hunter) {
    r.bumperUsed = true;
    p.invuln = 0.8;
    breakObj(o, 'shield');
    r.od *= 0.5;
    resetChain();
    fx.notice('🧱 ¡PARACHOQUES!', '#ff9f0a');
    sfx.shield();
    return;
  }
  // BURBUJA (Manta): absorbe el golpe (sin gastar escudo) y estalla
  if (isActive(r.ability, 'bubble')) {
    const a = r.ability;
    a.active = 0;
    p.invuln = 0.8;
    breakObj(o, 'shield');
    // como un escudo gratis: salva la vida, pero el golpe cuesta overdrive y combo igual
    r.od *= 0.5;
    resetChain();
    if (a.mut === 'pop') sweep(Math.max(12, runSpeed() * 0.3));
    fx.notice('🫧 ¡BURBUJA!', '#64d2ff');
    fx.ring(ps.x, ps.y - 20, '#64d2ff', 260, 0.4, 14);
    fx.flash('#64d2ff', 0.3);
    fx.vibe(40);
    sfx.shield();
    return;
  }
  if (r.shields > 0) {
    // un golpe siempre CUESTA: escudo, medio overdrive y el combo. Nunca da premios.
    r.shields--;
    r.cleanSec = 0; // MECÁNICO: la racha sin perder escudos vuelve a cero
    // ventana corta para no perder dos escudos con la misma fila; ninguna contra el Cazador
    p.invuln = o.hunter ? 0.05 : r.stats.hitInvuln;
    breakObj(o, 'shield');
    r.od *= 0.5;
    if (r.stats.insurance) {
      r.chain /= 2;
      r.mult = Math.min(99, 1 + Math.floor(r.chain));
    } else resetChain();
    fx.notice(`🛡️ ESCUDO ROTO · ${r.shields ? `quedan ${r.shields}` : 'último aviso'}`, '#ff6b6b');
    fx.flash('#f33', 0.45);
    fx.shake(16);
    fx.vibe(90);
    sfx.shield();
    fx.ring(ps.x, ps.y, '#30d158', 220, 0.4, 14);
    return;
  }
  // CARRERA: sin escudos, chocar frena (como en un juego de carreras): la carrera siempre acaba
  if (r.race) {
    r.crashT = 1;
    p.invuln = 1.2;
    breakObj(o, 'shield');
    resetChain();
    fx.notice('💥 ¡CHOQUE! pierdes velocidad', '#ff6b6b');
    fx.flash('#f33', 0.4);
    fx.shake(18);
    fx.vibe(90);
    sfx.shield();
    return;
  }
  // ÚLTIMO ALIENTO (árbol, BLINDAJE nivel 3): una vez por partida, un golpe sin escudos no mata
  if (r.lastStand) {
    r.lastStand = r.lastStand === 2 ? 1 : false; // nivel 5 de BLINDAJE: dos veces
    p.invuln = 1.2;
    breakObj(o, 'shield');
    resetChain();
    fx.banner('¡ÚLTIMO ALIENTO!', 'la próxima no hay perdón', '#ff375f', true);
    fx.flash('#f33', 0.7);
    fx.shake(24);
    fx.vibe([80, 40, 160]);
    sfx.shield();
    return;
  }
  die();
}

// Suma escudos respetando el tope; lo que sobra se paga en monedas.
function gainShield(n, label) {
  const r = run();
  const before = r.shields;
  addShields(r, n);
  const extra = n - (r.shields - before);
  const msg = extra > 0 ? `🛡️ Escudos al máximo (${shieldCap(r)}) · +${20 * extra} 🪙` : label;
  if (extra > 0) r.coins += 20 * extra;
  fx.notice(msg, '#30d158');
  return msg;
}

export function hunterEscaped() {
  const r = run();
  const ps = playerScreen();
  // premio decreciente y sin combo: escapar no debe compensar más que jugar (antes se farmeaba)
  addScore(2000 / Math.max(1, r.hunters), '¡ESCAPASTE!', ps.x, ps.y - 60, '#ff3b6b');
  progress('hunter');
  if (r.cards.trofeo) gainShield(1, '🎯 TROFEO: +1 🛡️');
  fx.banner('¡ESCAPASTE!', 'el Cazador se retira', '#ff3b6b');
  fx.flash('#fff', 0.35);
  sfx.milestone();
  fx.vibe([20, 30, 40]);
}

// ---------- Habilidad activa (botón ⚡) ----------
function abilityReady() {
  const d = ABILITIES[run().ability.id];
  fx.notice(`${d.icon} ${d.name} LISTA`, '#00e5ff');
  sfx.ui();
  ui.pulseAbility();
}

export function useAbility() {
  const r = G.run, p = G.player;
  if (G.mode !== 'play' || !r || p.dead) return;
  const a = r.ability;
  // el Gancho necesita un carril de destino libre de bloqueos; si no, no se gasta
  const hook = a.id === 'hook' ? hookTarget() : null;
  if (!canUse(a) || (a.id === 'hook' && hook === null) || (a.id === 'blink' && r.boss)) {
    sfx.bump();
    fx.vibe(15);
    return;
  }
  trigger(a);
  p.lastAction = r.time; // cuenta como acción (no sirve para "jugar sin jugar": la recarga es larga)
  save.abilityUses[a.id] = (save.abilityUses[a.id] || 0) + 1;
  progress('ability');
  const d = ABILITIES[a.id];
  const ps = playerScreen();
  fx.vibe(30);
  fx.ring(ps.x, ps.y, '#00e5ff', 180, 0.4, 10);
  switch (a.id) {
    case 'overclock':
      G.timeWarp = 0.55;
      fx.flash('#00e5ff', 0.3);
      sfx.od();
      break;
    case 'ram':
      fx.shake(10);
      fx.flash('#ff9f0a', 0.3);
      sfx.dash();
      break;
    case 'phase':
      fx.flash('#e0e0ff', 0.35);
      sfx.slide();
      break;
    case 'nova': {
      // mutación "full": llena el overdrive entero
      // carga plana (no la multiplica el Cargador): 10%, o 25% con la mutación
      addOD(a.mut === 'full' ? 0.25 : 0.1, true);
      const n = sweep(Math.max(14, runSpeed() * 0.5) * a.pow);
      fx.ring(ps.x, ps.y - 40, '#ff375f', 600, 0.6, 26);
      fx.flash('#ff375f', 0.55);
      fx.shake(24);
      sfx.boom();
      if (n) fx.notice(`💥 ${n} destruidos`, '#ff375f');
      break;
    }
    case 'roar': {
      const n = sweep(Math.max(24, runSpeed() * 0.9) * a.pow);
      for (const o of r.objects) if (o.alive && o.type === 'coin' && o.z - r.dist < 110) o.mag = true;
      if (a.mut === 'shield') gainShield(1, '🦖 +1 🛡️');
      fx.ring(ps.x, ps.y - 40, '#30d158', 800, 0.8, 30);
      fx.shake(30);
      sfx.boom();
      if (n) fx.notice(`🦖 ${n} destruidos`, '#30d158');
      break;
    }
    case 'laser':
      // nivel 2: atraviesa 2; mutación "triple": dispara en los 3 carriles
      fireLaser(a.pow > 1 ? 2 : 1, a.mut === 'triple');
      fx.shake(6);
      sfx.dash();
      break;
    case 'hook': {
      const from = playerScreen();
      p.lane = hook;
      p.x = hook; // instantáneo: no pasa por el carril del medio
      const to = playerScreen();
      fx.ring(from.x, from.y, '#bf5af2', 120, 0.3, 8);
      fx.ring(to.x, to.y, '#bf5af2', 160, 0.35, 10);
      fx.burst(to.x, to.y, 18, '#bf5af2', 400, 4, 0.4, 0);
      sfx.dash();
      if (a.pow > 1) p.invuln = Math.max(p.invuln, 0.6); // nivel 2
      if (a.mut === 'trail') sweep(Math.max(10, runSpeed() * 0.25)); // mutación: arrasa lo de delante
      break;
    }
    case 'bubble':
      fx.ring(ps.x, ps.y - 20, '#64d2ff', 200, 0.4, 10);
      sfx.slide();
      break;
    case 'blink': {
      // salto hacia delante: lo que queda atrás no te toca (no "cruza"), las monedas se recogen
      const D = 35 * Math.min(a.pow, 1.3); // la distancia solo sube en el nivel 2: saltar más se salta media pista
      for (const o of r.objects) {
        const rz = o.z - r.dist;
        if (!o.alive || rz <= 0 || rz > D + 0.5) continue;
        if (o.type === 'coin') { o.alive = false; onCoin(o); } else o.rzPrev = rz - D;
      }
      r.dist += D;
      p.invuln = Math.max(p.invuln, 0.5);
      fx.flash('#ffe600', 0.35);
      fx.burst(ps.x, ps.y, 22, '#ffe600', 500, 4, 0.4, 0);
      fx.slowmo(0.5, 0.15);
      if (a.mut === 'land') sweep(Math.max(10, runSpeed() * 0.25));
      sfx.dash();
      break;
    }
    case 'barrier': {
      gainShield(1, '🔰 +1 🛡️');
      if (a.pow > 1) p.invuln = Math.max(p.invuln, 1); // nivel 2
      if (a.mut === 'wave') sweep(Math.max(12, runSpeed() * 0.3));
      fx.ring(ps.x, ps.y, '#7dffb0', 260, 0.45, 14);
      sfx.shield();
      break;
    }
    case 'singularity': {
      const n = sweep(50 * a.pow);
      for (const o of r.objects) if (o.alive && o.type === 'coin') o.mag = true;
      if (a.mut === 'shield') gainShield(1, '🕳️ +1 🛡️');
      fx.ring(ps.x, ps.y - 60, '#c58cff', 700, 0.7, 28);
      fx.flash('#2a0050', 0.5);
      fx.shake(22);
      sfx.boom();
      if (n) fx.notice(`🕳️ ${n} destruidos`, '#c58cff');
      break;
    }
    case 'chaos': {
      const n = sweep(40 * a.pow);
      r.coins += n * 5;
      if (a.mut === 'magnet') for (const o of r.objects) if (o.alive && o.type === 'coin') o.mag = true;
      fx.ring(ps.x, ps.y - 40, '#ff4fd8', 500, 0.5, 20);
      fx.shake(16);
      sfx.boom();
      if (n) fx.notice(`🌀 ${n} destruidos · +${n * 5} 🪙`, '#ff4fd8');
      break;
    }
    case 'hammer': {
      const n = hammerLane(60 * a.pow, a.mut === 'triple');
      fx.shake(18);
      fx.flash('#ff6b3d', 0.3);
      sfx.boom();
      if (n) fx.notice(`🔨 ${n} destruidos`, '#ff6b3d');
      break;
    }
  }
  if (d.dur > 0) fx.notice(`${d.icon} ${d.name}`, '#00e5ff');
}

function abilityEnded(a) {
  if (a.id === 'overclock') G.timeWarp = 1;
  // mutación "wave": al salir de FASE, una onda rompe lo cercano
  if (a.id === 'phase' && a.mut === 'wave') {
    const ps = playerScreen();
    sweep(Math.max(12, runSpeed() * 0.3));
    fx.ring(ps.x, ps.y, '#e0e0ff', 400, 0.5, 18);
    fx.shake(12);
    sfx.boom();
  }
}

export function onCoin(o) {
  const r = run();
  const v = r.stats.coinValue * (r.odTime > 0 && r.synergies.has('supernova') ? 3 : 1);
  r.coins += v;
  progress('coins', v);
  r.coinStreak = r.time - r.lastCoinT < 0.45 ? r.coinStreak + 1 : 0;
  r.lastCoinT = r.time;
  addChain(0.2 + (r.synergies.has('sangre') ? 0.3 : 0));
  r.score += 10 * v * r.mult * scoreMult(r);
  addOD(o.mag ? 0.006 : 0.012); // lo que trae el imán carga la mitad: el imán es para recoger, no para vivir en overdrive
  sfx.coin(r.coinStreak);
  const sp = project(o.x, o.y, 0.3);
  if (sp) fx.burst(sp.x, sp.y, 6, '#ffcc00', 220, 3, 0.35, 300);
}

// powered: con DASH, overdrive o Ariete (golpe crítico: doble daño)
export function onCore(o, powered = false) {
  const ps = playerScreen();
  // blindado (EL CENSOR): sin embestida rebota y avisa; el núcleo sigue ahí
  if (o.shield && !powered) {
    if (!o.warned) {
      o.warned = true;
      fx.notice('🛡️ ¡BLINDADO! Atraviésalo con DASH', '#5ac8fa');
      sfx.bump();
    }
    return;
  }
  o.alive = false;
  addChain(3);
  if (powered) {
    addScore(2000, '¡GOLPE CRÍTICO! x2', ps.x, ps.y - 60, '#ffe600');
    fx.flash('#ffe600', 0.4);
  } else addScore(1000, '¡GOLPE AL JEFE!', ps.x, ps.y - 60, '#ff2d55');
  hurtBoss(powered ? 2 : 1);
}

// SALTO DOBLE por encima de un muro: cuenta como esquive de lujo
export function onJumpOver(o) {
  if (o.jumped) return;
  o.jumped = true;
  const ps = playerScreen();
  addChain(2);
  addScore(300, '🦘 ¡POR ENCIMA!', ps.x, ps.y - 50, '#7df9ff');
  addOD(0.1);
  fx.ring(ps.x, ps.y, '#7df9ff', 140, 0.35, 8);
  sfx.near(true, run().mult);
  progress('jumpOver');
}

function clearBossStuff() {
  const r = run();
  for (const o of r.objects) {
    if (o.alive && (o.type === 'shot' || o.type === 'core')) {
      o.alive = false;
      const sp = screenOf(o);
      if (sp) fx.burst(sp.x, sp.y, 8, '#ffd60a', 200, 3, 0.4, 0);
    }
  }
}

export function bossDefeated() {
  const r = run();
  r.boss.dying = 2;
  r.bosses++;
  codexAdd(save, 'bosses', r.boss.name);
  progress('boss');
  if (r.shields === 0) progress('bossNoShield');
  if (r.boss.def.elite) progress('elite');
  if (r.boss.id === 'leviatan') progress('leviatan');
  r.coins += 50;
  clearBossStuff();
  addScore(5000, null);
  fx.banner('¡JEFE DESTRUIDO!', '+50 🪙  ·  +5 💎', '#ffe600', true);
  fx.flash('#fff', 0.9);
  fx.shake(35);
  fx.vibe([100, 50, 100, 50, 250]);
  sfx.boom();
  sfx.milestone();
}

export function bossEscaped() {
  const r = run();
  r.boss = null;
  clearBossStuff();
  r.sectionEnd = r.genZ;
  fx.banner('HA ESCAPADO…', 'la próxima vez', '#aaa');
}

// ---------- Bifurcación / cartas ----------
export function onFork(reward) {
  const r = run();
  const info = FORK_REWARDS[reward];
  fx.flash(info.color, 0.4);
  fx.shake(8);
  sfx.card();
  const ps = playerScreen();
  fx.burst(ps.x, ps.y, 30, info.color, 500, 5, 0.6, 0);
  switch (reward) {
    case 'riesgo':
      r.riskNext = true;
      return openCards({ reward: '☠ RIESGO: x2 puntos en el próximo tramo' });
    case 'escudo':
      return openCards({ reward: gainShield(1, '+1 🛡️ ESCUDO') });
    case 'monedas': {
      const c = 30 + r.section * 12;
      r.coins += c;
      for (let i = 0; i < 4; i++) fx.burst(G.W * Math.random(), G.H * 0.3, 12, '#ffcc00', 300, 5, 1, 600);
      return openCards({ reward: `+${c} 🪙 MONEDAS` });
    }
    case 'epica':
      return openCards({ minRarity: 'rare', title: 'CARTAS RARAS' });
    case 'tienda':
      G.mode = 'shop';
      musicDuck(true);
      return ui.showShop(r, () => openCards());
    case 'cofre': {
      G.mode = 'chest';
      musicDuck(true);
      const res = rollChest(r);
      return ui.showChest(res, () => {
        let got = `${res.icon} ${res.label}`;
        if (res.kind === 'coins') r.coins += res.amount;
        if (res.kind === 'shield') got = gainShield(res.amount, '+1 🛡️ ESCUDO');
        if (res.kind === 'od') r.od = 0.999;
        openCards(res.kind === 'epic' ? { minRarity: 'epic', title: '¡CARTA ÉPICA!' } : { reward: got });
      });
    }
  }
}

function rollChest(r) {
  const k = r.lootRng.weighted([{ w: 40, k: 'coins' }, { w: 20, k: 'shield' }, { w: 20, k: 'od' }, { w: 20, k: 'epic' }]).k;
  if (k === 'coins') { const a = r.lootRng.int(40, 100) + r.section * 15; return { kind: k, amount: a, icon: '🪙', label: `+${a} MONEDAS` }; }
  if (k === 'shield') return { kind: k, amount: 1, icon: '🛡️', label: '+1 ESCUDO' };
  if (k === 'od') return { kind: k, icon: '🔥', label: 'OVERDRIVE INSTANTÁNEO' };
  return { kind: k, icon: '🃏', label: 'CARTA ÉPICA' };
}

function openCards({ minRarity = null, title = 'ELIGE UNA CARTA', next = true, reward = '', after = null } = {}) {
  const r = run();
  const n = hasTalent(save, 'r5') ? 4 : 3; // talento CUARTA CARTA
  let offers = offerCards(r, n, minRarity);
  if (!offers.length) offers = offerCards(r, n);
  const finish = () => {
    if (after) return after();
    if (next) startSection();
    resume();
  };
  if (!offers.length) return finish();
  G.mode = 'cards';
  musicDuck(true);
  ui.showCards(offers, r, title, (id) => {
    pickCard(id);
    finish();
  }, reward);
}

export function pickCard(id) {
  const r = run();
  const fresh = applyCard(r, id);
  capStats(r); // topes: ninguna combinación de cartas pasa de ahí
  codexAdd(save, 'cards', id);
  for (const s of fresh) codexAdd(save, 'syn', s.id);
  progress('cards');
  if (fresh.length) progress('synergy', fresh.length);
  sfx.card();
  const c = CARD_BY_ID[id];
  fx.notice(`${c.icon} ${c.name}`);
  for (const s of fresh) {
    fx.banner('¡SINERGIA!', s.name, '#ff9f0a', true);
    fx.flash('#ff9f0a', 0.5);
    sfx.milestone();
  }
  // si el carril bloqueado es el actual, apartar al jugador
  if (r.blockedLane !== null && G.player.lane === r.blockedLane) G.player.lane = 0;
}

export function resume() {
  G.mode = 'play';
  // tras un menú el contador de inactividad empieza de cero: no es culpa del jugador
  if (G.player && G.run) G.player.lastAction = G.run.time;
  musicDuck(false);
  ui.hideAll();
  ui.showHUD(true);
  fx.slowmo(0.45, 0.35);
}

// ---------- Carreras ----------
function raceTick(r, dt) {
  const p = G.player, R = r.race;
  r.crashT = Math.max(0, (r.crashT || 0) - dt);
  r.bumpT = Math.max(0, (r.bumpT || 0) - dt);
  const env = { objects: r.objects, time: r.time, playerZ: r.dist, playerLane: p.lane, playerX: p.x, laneTime: r.stats.laneTime };
  for (const ev of stepRivals(R.rivals, env, dt, R.rng, r.finishZ ?? Infinity)) {
    if (ev.type !== 'bump') continue;
    const rv = ev.rival;
    const powered = p.dash > 0 || r.odTime > 0 || isActive(r.ability, 'ram');
    const ps = playerScreen();
    if (powered) {
      // embestida tuya: el rival sale despedido
      rv.slowT = 1.4;
      rv.flash = 0.5;
      addScore(500, `💥 ¡FUERA, ${rv.name}!`, ps.x, ps.y - 50, rv.color);
      fx.shake(14);
      sfx.brk();
    } else {
      r.bumpT = 0.6;
      rv.slowT = 0.4;
      fx.notice(`${rv.name} te empuja`, rv.color);
      fx.shake(10);
      sfx.bump();
    }
  }
  // fantasma: tu carrera, muestreada
  R.recAcc += dt;
  while (R.recAcc >= GHOST_DT) {
    R.recAcc -= GHOST_DT;
    R.rec.push(encodeSample(r.dist, p.x, p.y));
  }
}

// Posición actual (1-4) para el HUD
export function racePosition(r = G.run) {
  if (!r?.race) return null;
  return 1 + r.race.rivals.filter((rv) => rv.finishT !== null || rv.z > r.dist).length;
}

function raceFinish() {
  const r = run(), R = r.race, t = R.track;
  G.mode = 'won';
  G.timeWarp = 1;
  G.dyingT = 1.4;
  const you = { who: 'you', name: 'TÚ', color: '#00e5ff', finishT: r.time, z: r.dist, you: true };
  const rivals = R.rivals.map((rv) => ({ who: String(rv.i), name: rv.name, color: rv.color, finishT: estimateFinish(rv, r.finishZ, r.time), z: rv.z }));
  const order = standings([you, ...rivals]);
  const pos = order.findIndex((x) => x.you);
  const pointsBefore = R.points;
  const points = R.solo ? R.points : addPoints(R.points, order.map((x) => x.who));
  const cupEnd = !R.solo && t.idx === 2;
  // CONTRARRELOJ: medalla por tiempo (la mejor se guarda)
  const tt = R.solo ? ttMedal(t, r.time) : null;
  if (R.solo && tt !== null) {
    const prev = save.raceTT[t.id];
    save.raceTT[t.id] = prev === undefined ? tt : Math.min(prev, tt);
    progress('ttGold', Object.values(save.raceTT).filter((m) => m === 0).length);
  }
  const medal = cupEnd ? cupMedal(points) : null;
  if (cupEnd && medal !== null) {
    const prev = save.raceCups[R.cup.id];
    save.raceCups[R.cup.id] = prev === undefined ? medal : Math.min(prev, medal);
    if (medal === 0) progress('cupGold');
  }
  // fantasma y mejor tiempo
  const best = save.raceBest[t.id];
  const ghostBeaten = !!R.ghost && r.time < R.ghost.t;
  if (best === undefined || r.time < best) {
    save.raceBest[t.id] = Math.round(r.time * 100) / 100;
    save.ghosts[t.id] = { t: r.time, d: R.rec };
  }
  const gems = Math.ceil((R.solo ? (tt !== null ? [40, 25, 15][tt] : 5) : [30, 18, 10, 5][pos] + (cupEnd && medal !== null ? [80, 50, 30][medal] : 0)) * (1 + prestigeBonus(save)));
  save.gems += gems;
  const xp = xpForRun({ dist: r.dist, near: r.nearMisses, section: 2, bosses: 0, missionsDone: r.missionsDone }) + (3 - pos) * 40;
  bankCoins(save, r.coins);
  const xpBefore = save.xp;
  const rankUps = addXp(save, xp);
  save.runs++;
  progress('runs');
  if (pos === 0 && !R.solo) progress('raceWin');
  persist();
  const ps = playerScreen();
  for (const c of ['#ffe600', '#fff', R.cup.color]) fx.burst(ps.x, ps.y - 80, 40, c, 700, 6, 1.2, 400);
  if (R.solo) fx.banner(tt !== null ? `${MEDALS[tt]} ${r.time.toFixed(1)} s` : `${r.time.toFixed(1)} s`, t.name, tt === 0 ? '#ffe600' : '#fff', true);
  else fx.banner(pos === 0 ? '¡VICTORIA!' : `${pos + 1}.º PUESTO`, t.name, pos === 0 ? '#ffe600' : '#fff', true);
  sfx.milestone();
  musicStop();
  const next = !R.solo && t.idx < R.cup.tracks.length - 1 ? R.cup.tracks[t.idx + 1].id : null;
  r.result = {
    race: true, solo: R.solo, tt, targets: R.targets, track: t, cup: R.cup, order: order.map((x) => ({ name: x.name, color: x.color, t: x.finishT, you: !!x.you })),
    pos, points, pointsBefore, cupEnd, medal, next, gems, xp, xpBefore, rankUps, time: r.time, best: save.raceBest[t.id], ghostBeaten, hadGhost: !!R.ghost,
  };
}

// ---------- Expedición ----------
// Se cruza la meta de un nodo (tramo, élite o jefe): premio y, después, el mapa
function expNodeDone() {
  const r = run(), e = r.exp, node = nodeById(e.map, e.at);
  G.mode = 'cards';
  const ps = playerScreen();
  for (const c of ['#ffe600', '#fff', '#30d158']) fx.burst(ps.x, ps.y - 60, 30, c, 600, 5, 1, 400);
  sfx.milestone();
  if (node.type === 'boss') {
    e.acts++;
    progress('expAct', e.acts);
    const gems = 25 * e.acts;
    save.gems += gems;
    persist();
    if (e.act >= ACTS.length - 1) return expWin(gems);
    e.act++;
    e.map = genAct(e.seed, e.act);
    e.at = startOf(e.map).id;
    e.path = [e.at];
    fx.banner(`ACTO ${e.act} SUPERADO`, `+${gems} 💎 · siguiente: ${ACTS[e.act].name}`, '#ffe600', true);
    return openCards({ minRarity: 'rare', title: `¡ACTO ${e.act} SUPERADO!`, next: false, after: expStartNode });
  }
  const elite = node.type === 'elite';
  openCards({ minRarity: elite ? 'rare' : null, title: elite ? '☠ ÉLITE SUPERADO' : 'ELIGE UNA CARTA', next: false, after: expShowMap });
}

function expShowMap() {
  G.mode = 'map';
  musicDuck(true);
  ui.showHUD(false);
  ui.showExpMap(run().exp);
}

function expStartNode() {
  startSection();
  resume();
}

// Elegir un nodo del mapa (solo los conectados al actual)
export function expChoose(id) {
  const r = run(), e = r?.exp;
  if (!e || G.mode !== 'map') return;
  const cur = nodeById(e.map, e.at);
  if (!cur.next.includes(id)) return;
  e.at = id;
  e.path.push(id);
  const node = nodeById(e.map, id);
  switch (node.type) {
    case 'tramo': case 'elite': case 'boss':
      return expStartNode();
    case 'shop':
      G.mode = 'shop';
      return ui.showShop(r, expShowMap);
    case 'treasure': {
      G.mode = 'chest';
      const res = rollChest(r);
      return ui.showChest(res, () => {
        let got = `${res.icon} ${res.label}`;
        if (res.kind === 'coins') r.coins += res.amount;
        if (res.kind === 'shield') got = gainShield(res.amount, '+1 🛡️ ESCUDO');
        if (res.kind === 'od') { r.odNext = true; got = '🔥 OVERDRIVE lleno en el próximo tramo'; }
        openCards({ ...(res.kind === 'epic' ? { minRarity: 'epic', title: '¡CARTA ÉPICA!' } : { reward: got }), next: false, after: expShowMap });
      });
    }
    case 'event':
      G.mode = 'event';
      return ui.showExpEvent(eventFor(e.seed, id), r);
    case 'rest':
      G.mode = 'rest';
      return ui.showExpRest(r);
  }
}

// Aplica la opción elegida de un evento
export function expEventChoice(ev, i) {
  const r = run(), e = r.exp;
  if (G.mode !== 'event') return;
  const eff = resolveEffect(ev.choices[i].eff, r.lootRng);
  e.events++;
  progress('expEvent');
  const notes = [];
  if (eff.coins) { r.coins = Math.max(0, r.coins + eff.coins); notes.push(`${eff.coins > 0 ? '+' : ''}${eff.coins} 🪙`); }
  if (eff.shields > 0) notes.push(gainShield(eff.shields, `+${eff.shields} 🛡️`));
  if (eff.shields < 0) { r.shields = Math.max(0, r.shields + eff.shields); notes.push(`${eff.shields} 🛡️`); }
  if (eff.gems) { save.gems += eff.gems; persist(); notes.push(`+${eff.gems} 💎`); }
  if (eff.risk) { r.riskNext = true; notes.push('☠ próximo tramo RIESGO x2'); }
  if (eff.mod) { r.nextMod = eff.mod; notes.push(`próximo tramo: ${eff.mod}`); }
  if (eff.od) { r.odNext = true; notes.push('🔥 OVERDRIVE lleno al empezar'); }
  if ('lucky' in eff) notes.unshift(eff.lucky ? '¡SUERTE!' : 'Mala suerte…');
  const reward = notes.join(' · ');
  const n = eff.card ? 1 : eff.cards || 0;
  if (!n) {
    if (reward) fx.notice(reward, '#ffe600');
    return expShowMap();
  }
  const more = (left) => openCards({ minRarity: eff.card && eff.card !== 'common' ? eff.card : null, title: eff.card === 'epic' ? '¡CARTA ÉPICA!' : 'ELIGE UNA CARTA', next: false, reward, after: left > 1 ? () => more(left - 1) : expShowMap });
  more(n);
}

// Descanso: +1 escudo, o mejorar (repetir) una carta que ya tienes
export function expRest(kind) {
  const r = run();
  if (G.mode !== 'rest') return;
  if (kind === 'shield') {
    gainShield(1, '🔥 +1 🛡️');
    return expShowMap();
  }
  const owned = Object.keys(r.cards).filter((id) => r.cards[id] < CARD_BY_ID[id].max);
  if (owned.length) {
    const id = r.lootRng.pick(owned);
    pickCard(id);
    fx.notice(`🔥 ${CARD_BY_ID[id].icon} ${CARD_BY_ID[id].name} sube de nivel`, '#ff9f0a');
    return expShowMap();
  }
  openCards({ next: false, after: expShowMap });
}

// Expedición completada (los 3 jefes)
function expWin(gems) {
  const r = run();
  G.mode = 'expEnd';
  musicStop();
  save.expedition.wins++;
  save.expedition.best = Math.max(save.expedition.best, progressOf(ACTS.length, 0));
  const xp = (xpForRun({ dist: r.dist, near: r.nearMisses, section: r.section + 1, bosses: r.bosses, missionsDone: r.missionsDone }) + 400) * r.xpMult;
  const banked = bankCoins(save, r.coins);
  const xpBefore = save.xp;
  const rankUps = addXp(save, xp);
  save.runs++;
  progress('runs');
  persist();
  ui.showHUD(false);
  ui.showExpEnd({ gems, banked, xp, xpBefore, rankUps, score: r.score, cards: r.cards, synergies: [...r.synergies], sections: r.section + 1 });
}

// ---------- Muerte ----------
// Explosión de la nave según el cosmético equipado
function die() {
  const r = run(), p = G.player;
  // ❤️ SEGUNDA VIDA: una vez, revives y se despeja lo que tienes delante
  if (r.extraLife > 0) {
    r.extraLife--;
    p.invuln = 2.5;
    sweep(Math.max(30, runSpeed() * 0.8));
    const ps = playerScreen();
    fx.banner('❤️ SEGUNDA VIDA', 'no la desperdicies', '#ff2d55', true);
    fx.ring(ps.x, ps.y, '#ff2d55', 400, 0.6, 20);
    fx.flash('#ff2d55', 0.5);
    fx.vibe([60, 40, 120]);
    sfx.shield();
    return;
  }
  G.mode = 'dying';
  G.timeWarp = 1;
  G.dyingT = 1.0;
  p.dead = true;
  const ps = playerScreen();
  const eq = equipped(save, save.ship);
  const ship = SHIPS.find((sh) => sh.id === save.ship) || SHIPS[0];
  boomFx(fx, eq.boom.id, ps.x, ps.y, eq.palette.edge || ship.color, r.biome.obs);
  fx.shake(32);
  fx.flash('#fff', 0.9);
  fx.vibe([120, 60, 220]);
  sfx.die();
  musicStop();

  // raíz cuadrada: la puntuación crece de forma explosiva, las gemas no deben hacerlo
  // + 1 gema por cada 2 tramos: con el árbol de mejoras hay mucho más en lo que gastarlas
  let gems = Math.floor(Math.sqrt(r.score) / 40) + r.bosses * 5 + Math.max(0, r.section) + Math.floor(Math.max(0, r.section) / 2);
  if (r.cards.tesoro) gems = Math.ceil(gems * 1.5); // carta TESORO
  if (r.exp) {
    gems += r.exp.acts * 15;
    const pr = progressOf(r.exp.act, nodeById(r.exp.map, r.exp.at).row);
    save.expedition.best = Math.max(save.expedition.best, pr);
  }
  gems = Math.ceil(gems * modGems([...r.mods]) * (1 + prestigeBonus(save)));
  // MUTACIÓN DEL DÍA: el primer intento de cada día paga x1,5
  let mutationBonus = false;
  if (r.opts.mode === 'mutation') {
    if (save.mutation.key !== todayKey()) save.mutation = { key: todayKey(), played: false };
    if (!save.mutation.played) {
      gems = Math.ceil(gems * 1.5);
      mutationBonus = true;
      save.mutation.played = true;
    }
    progress('mutation');
  }
  const prevBest = save.best;
  const isBest = r.score > save.best;
  save.gems += gems;
  save.best = Math.max(save.best, Math.floor(r.score));
  save.bestDist = Math.max(save.bestDist, Math.floor(r.dist));
  save.runs++;
  progress('runs');
  progress('score', Math.floor(r.score));
  // rango de piloto: la XP de la partida y los rangos que suben (con su premio)
  const xp = xpForRun({ dist: r.dist, near: r.nearMisses, section: r.section + 1, bosses: r.bosses, missionsDone: r.missionsDone }) * r.xpMult;
  const xpBefore = save.xp;
  const rankUps = addXp(save, xp);
  const banked = bankCoins(save, r.coins); // las 🪙 que sobran, a tu cartera
  persist();
  r.result = { exp: r.exp ? { act: r.exp.act, row: nodeById(r.exp.map, r.exp.at).row } : null, opts: r.opts, mods: [...r.mods], mutationBonus, level: r.camp?.level.id, xp, xpBefore, rankUps, banked, achDone: r.achDone || [], prevBest, missionsDone: r.missionsDone || 0, score: r.score, dist: r.dist, maxMult: r.maxMult, near: r.nearMisses, breaks: r.breaks, section: r.section + 1, bosses: r.bosses, gems, isBest, cards: r.cards, synergies: [...r.synergies] };
}

// ---------- Campaña: meta ----------
// Estadísticas que miran las estrellas de un nivel
const campStats = (r, finished) => ({
  finished, bossDefeated: r.bosses > 0, near: r.nearMisses, perfect: r.perfects,
  coins: r.coins, maxMult: r.maxMult, hits: r.hitsTaken,
});

// Cruzar la línea de meta de un nivel de campaña
export function onFinish() {
  const r = run();
  if (G.mode === 'play' && r.exp) return expNodeDone();
  if (G.mode === 'play' && r.race) return raceFinish();
  if (G.mode !== 'play' || !r.camp) return;
  G.mode = 'won';
  G.timeWarp = 1;
  G.dyingT = 1.4;
  const lv = r.camp.level;
  const wasOpen = nextLevel(lv.id) && isLevelOpen(save, nextLevel(lv.id).id);
  const firstPass = !isPassed(save, lv.id);
  const stars = levelStars(lv, campStats(r, true));
  const res = recordResult(save, lv.id, stars);
  // bonus de prestigio sobre las gemas del nivel
  const extra = Math.floor(res.gems * prestigeBonus(save));
  save.gems += extra;
  res.gems += extra;
  const xp = xpForRun({ dist: r.dist, near: r.nearMisses, section: lv.sections, bosses: r.bosses, missionsDone: r.missionsDone }) * r.xpMult;
  const banked = bankCoins(save, r.coins);
  const xpBefore = save.xp;
  const rankUps = addXp(save, xp);
  save.runs++;
  progress('runs');
  if (res.stars[0] && firstPass) progress('level');
  if (res.stars[0] && lv.num > FIXED_SECTORS) progress('sector', lv.num);
  progress('stars', totalStars(save));
  persist();
  const nx = nextLevel(lv.id);
  r.result = {
    opts: r.opts, level: lv.id, stars, best: res.stars, newStars: res.newStars, gems: res.gems, xp, xpBefore, rankUps, banked,
    passed: stars[0], next: nx && isLevelOpen(save, nx.id) ? nx.id : null, unlocked: !!nx && !wasOpen && isLevelOpen(save, nx.id),
    score: r.score, near: r.nearMisses, perfect: r.perfects, coins: r.coins, maxMult: r.maxMult, hits: r.hitsTaken,
  };
  const ps = playerScreen();
  for (const c of ['#ffe600', '#fff', '#30d158', '#ff2bd6']) fx.burst(ps.x, ps.y - 80, 40, c, 700, 6, 1.2, 400);
  fx.banner(stars[0] ? '¡NIVEL SUPERADO!' : 'META', '★'.repeat(starCountOf(stars)) || 'sin estrellas', '#ffe600', true);
  fx.flash('#fff', 0.6);
  fx.vibe([60, 40, 60, 40, 200]);
  sfx.milestone();
  musicStop();
}
const starCountOf = (st) => st.filter(Boolean).length;

// ---------- Bucle ----------
export function update(dt) {
  if (G.mode === 'dying' || G.mode === 'won') {
    G.dyingT -= dt;
    // tras la meta la nave sigue corriendo un momento (el mundo no genera nada más)
    if (G.mode === 'won') G.run.dist += effSpeed(G.run) * dt;
    if (G.dyingT <= 0) {
      const won = G.mode === 'won';
      G.mode = won ? 'victory' : 'dead';
      ui.showHUD(false);
      if (won && G.run.race) ui.showRacePodium(G.run.result);
      else if (won) ui.showVictory(G.run.result);
      else ui.showDeath(G.run.result);
    }
    return;
  }
  if (G.mode !== 'play') return;
  const r = run();
  r.time += dt;
  r.speed = baseSpeed(r.time) * r.stats.speedMult;
  const eff = effSpeed(r);
  r.dist += eff * dt;
  r.curve = Math.sin(r.time * 0.23) * 0.00035 + Math.sin(r.time * 0.61) * 0.00015;

  if (r.event?.id !== 'nearonly') r.score += eff * dt * 0.5 * r.mult * scoreMult(r);

  // superar el récord se celebra en el momento, no al morir
  if (!r.recordShown && save.best > 0 && r.score > save.best) {
    r.recordShown = true;
    fx.banner('¡NUEVO RÉCORD!', 'sigue, que cada punto cuenta', '#ffe600', true);
    fx.flash('#ffe600', 0.5);
    sfx.milestone();
    fx.vibe([40, 30, 40, 30, 120]);
  }

  r.chainT += dt;
  if (r.chainT > 3 && r.chain > 0) {
    r.chain = Math.max(0, r.chain - dt * 3);
    const m = Math.min(99, 1 + Math.floor(r.chain));
    if (m !== r.mult) { r.mult = m; ui.pulseMult(); }
  }

  if (r.odTime > 0) {
    r.odTime -= dt;
    if (r.odTime <= 0) {
      r.odTime = 0;
      r.odCool = OD_COOL; // RECALENTANDO: la barra no carga durante unos segundos
      music.od = false;
      // margen de salida: durante el overdrive no hace falta esquivar, así que acabarlo justo
      // delante de un obstáculo sería una muerte sin tiempo de reacción
      G.player.invuln = Math.max(G.player.invuln, 0.6);
      fx.notice('OVERDRIVE terminado', '#ff2bd6');
    }
  } else if (r.odCool > 0) {
    r.odCool = Math.max(0, r.odCool - dt);
  } else if (r.od >= 0.999) {
    activateOD();
  }

  if (!r.event && r.time >= r.nextEventAt) {
    const ev = r.pendingEvent;
    r.event = ev;
    r.eventT = ev.dur;
    r.nextEventAt = Infinity;
    fx.banner(ev.name, ev.sub, ev.color, true);
    sfx.event();
    fx.vibe([30, 30, 30]);
  } else if (r.event) {
    r.eventT -= dt;
    if (r.eventT <= 0) r.event = null;
  }

  // SET PIECE: se anuncia al llegar a él (no al generarlo, que es ~150 m antes) y termina al pasarlo
  if (r.script && r.script.z0 !== undefined) {
    if (!r.script.announced && r.dist >= r.script.z0 - runSpeed() * 1.2) {
      r.script.announced = true;
      fx.banner(`⚡ ${r.script.name}`, r.script.sub, '#ff9f0a', true);
      (r.scriptsSeen ||= []).push(r.script.id);
      sfx.alarm();
      fx.vibe([30, 30, 60]);
      progress('script');
    }
    if (r.script.z1 !== undefined && r.dist > r.script.z1) r.script = null;
  }

  const kmh = r.speed * 10; // sin el x1.5 del overdrive: si no, su banner tapa al de OVERDRIVE
  while (r.speedMark < SPEED_MARKS.length && kmh >= SPEED_MARKS[r.speedMark][0]) {
    fx.banner(SPEED_MARKS[r.speedMark][1], '', '#7df9ff');
    progress('speed', SPEED_MARKS[r.speedMark][0]);
    fx.flash('#7df9ff', 0.3);
    sfx.milestone();
    r.speedMark++;
  }

  music.bpm = 118 + Math.min(70, eff * 0.35);

  // GRIND: mientras recorres un riel, puntos, combo y overdrive cada 0,2 s
  if (G.player.grind) {
    r.grindAcc = (r.grindAcc || 0) + dt;
    while (r.grindAcc >= 0.2) {
      r.grindAcc -= 0.2;
      const ps = playerScreen();
      addChain(0.3);
      addScore(25, '🛹 GRIND', ps.x, ps.y - 30, '#ffffff');
      addOD(0.015);
      fx.burst(ps.x, ps.y + ps.s * 0.1, 6, '#ffd60a', 260, 3, 0.3, 500);
      sfx.coin(r.coinStreak++ % 12);
    }
    r.grindT = (r.grindT || 0) + dt;
    progress('grind', dt);
  }

  const ev = tickAbility(r.ability, dt);
  if (ev === 'ended') abilityEnded(r.ability);
  else if (ev === 'ready') abilityReady();
  if (r.beam) {
    r.beam.t -= dt;
    if (r.beam.t <= 0) r.beam = null;
  }

  if (r.boss && r.boss.dying) {
    const b = r.boss;
    b.dying -= dt;
    const sp = project(b.x, 3.4, bossRz());
    if (sp && Math.random() < dt * 25) {
      fx.burst(sp.x + (Math.random() - 0.5) * sp.s * 2, sp.y + (Math.random() - 0.5) * sp.s * 1.5, 20, Math.random() < 0.5 ? '#fff' : r.biome.obs, 600, 6, 0.8, 300);
      sfx.brk();
      fx.shake(10);
    }
    if (b.dying <= 0) {
      r.boss = null;
      r.sectionEnd = r.genZ;
    }
  }

  updatePlayer(dt);
  updateWorld(dt);
  if (r.race) raceTick(r, dt);
}
