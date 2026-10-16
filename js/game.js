// Reglas de la partida: velocidad, puntuación, combo, overdrive, tramos, eventos, recompensas y muerte.
import { G, LANE_W, MAX_SHIELDS, addShields } from './state.js';
import { makeRng, todayKey, hashString } from './rng.js';
import { save, persist } from './save.js';
import { fx } from './fx.js';
import { sfx, music, musicStart, musicStop, musicDuck } from './audio.js';
import { baseStats, applyCard, offerCards, SHIPS, CARD_BY_ID, VAMPIRE_NEAR, shipLvls, applyShipTree, abilityMods } from './upgrades.js';
import { newPlayer, updatePlayer, hookTarget } from './player.js';
import { BIOMES, FORK_REWARDS, updateWorld, spawnBoss, hurtBoss, screenOf, breakObj, bossRz, sweep, fireLaser, runSpeed } from './world.js';
import { ABILITIES, newAbility, trigger, tickAbility, canUse, onNearMissCd, isActive } from './abilities.js';
import { baseSpeed, trackSpeed } from './pacing.js';
import { project } from './render.js';
import { ui } from './ui.js';
import { missions } from './missions.js';
import { xpForRun, addXp, trackAch, ACH_GEMS, codexAdd } from './progress.js';

const EVENTS = [
  { id: 'invert', name: '¡CONTROLES INVERTIDOS!', sub: 'izquierda es derecha', dur: 5, color: '#ff375f' },
  { id: 'coinrain', name: '¡LLUVIA DE MONEDAS!', sub: 'cógelas todas', dur: 5, color: '#ffcc00' },
  { id: 'flip', name: '¡GRAVEDAD INVERTIDA!', sub: 'el mundo al revés', dur: 5, color: '#bf5af2' },
  { id: 'nearonly', name: 'SOLO NEAR-MISS', sub: 'x3 por near-miss · la distancia no puntúa', dur: 8, color: '#5ac8fa' },
];

const MULT_WORDS = [[5, '¡BIEN!'], [10, '¡BRUTAL!'], [20, '¡SALVAJE!'], [30, '¡INSANO!'], [50, '¡IMPARABLE!'], [75, '¡DIVINO!'], [99, '¡¡MÁXIMO!!']];
const SPEED_MARKS = [[500, '500 KM/H'], [800, '800 KM/H'], [1000, '1000 KM/H'], [1235, '¡MACH 1!'], [1600, '1600 KM/H'], [2000, '2000 KM/H'], [2470, '¡¡MACH 2!!'], [3705, '¡¡¡MACH 3!!!']];

const run = () => G.run;
export const effSpeed = (r = G.run) => r.speed * (r.odTime > 0 ? 1.5 : 1);
const scoreMult = (r) => r.stats.scoreMult * (r.risk ? 2 : 1) * (r.odTime > 0 ? 2 : 1);

// ---------- Inicio ----------
export function newRun(daily = false) {
  // en modo debug, ?seed=N fija la pista (los tests E2E lo usan para ser reproducibles)
  const forced = G.debug ? new URLSearchParams(location.search).get('seed') : null;
  const seed = forced !== null ? Number(forced) >>> 0
    : daily ? hashString('overdrive-' + todayKey()) : (Math.random() * 2 ** 32) >>> 0;
  const r = {
    // tres RNG: pista (igual para todos en el reto diario), botín (cartas, cofres) e IA (jefe, movers).
    // Así lo que elige cada jugador no desplaza la secuencia de la pista.
    daily, rng: makeRng(seed), lootRng: makeRng(seed ^ 0x9e3779b9), aiRng: makeRng(seed ^ 0x85ebca6b),
    stats: baseStats(),
    dist: 0, time: 0, speed: 28, curve: 0,
    score: 0, coins: 0, chain: 0, mult: 1, maxMult: 1, chainT: 0, coinStreak: 0, lastCoinT: -9,
    od: 0, odTime: 0,
    section: -1, biome: BIOMES[0], sectionEnd: 0, genZ: 40, genHold: false, forkPlaced: false, forkDone: false, forkRewards: {},
    risk: false, riskNext: false, luck: 1, luckNext: 1, minRarityNext: null,
    objects: [], event: null, eventT: 0, nextEventAt: Infinity, rainAcc: 0,
    boss: null, hunter: null, hunters: 0, cards: {}, synergies: new Set(),
    shields: 0, dashCharges: 1, blockedLane: null,
    nearMisses: 0, breaks: 0, bosses: 0, speedMark: 0, vampN: 0,
    player: null, result: null,
  };
  G.run = r;
  G.player = newPlayer();
  r.player = G.player;
  const ship = SHIPS.find((s) => s.id === save.ship) || SHIPS[0];
  const lvls = shipLvls(save.shipLvl, ship.id);
  ship.apply(r);
  applyShipTree(r, lvls);
  r.ability = newAbility(ship.ability, abilityMods(ship, lvls));
  G.timeWarp = 1;
  if (save.meta.shield) addShields(r, 1);
  r.dashCharges = r.stats.dashMax;

  fx.clear();
  G.slowmo = 0;
  G.hitstop = 0;
  ui.hideAll();
  ui.showHUD(true);
  // ?debug&start=N: empezar en el tramo N, para testear contenido avanzado sin jugar minutos
  const start = G.debug ? Number(new URLSearchParams(location.search).get('start')) : 0;
  if (start > 1) r.section = start - 2;
  startSection();
  musicStart();
  G.mode = 'play';
  if (save.runs === 0) ui.tutorial();
  if (daily) progress('daily');
  if (save.meta.card) openCards({ title: 'CARTA INICIAL', next: false });
}

function startSection() {
  const r = run();
  r.section++;
  const isBoss = r.section % 3 === 2;
  r.biome = BIOMES[r.section % BIOMES.length];
  r.risk = r.riskNext;
  r.riskNext = false;
  r.forkPlaced = false;
  r.genHold = false;
  r.genZ = Math.max(r.genZ, r.dist + 45);
  r.event = null;
  // cada tramo nuevo perdona una aparición: si no, el Cazador acabaría saliendo a los 1.5 s para siempre
  r.hunters = Math.max(0, r.hunters - 1);
  progress('section', r.section + 1);
  if (isBoss) {
    r.sectionEnd = Infinity;
    spawnBoss(r);
    r.nextEventAt = Infinity;
  } else {
    // longitud del tramo con la velocidad de referencia (por distancia): igual para todos
    r.sectionEnd = r.genZ + trackSpeed(r.genZ, r.stats.speedMult) * (r.section === 0 ? 14 : 16 + Math.min(r.section, 6));
    // el evento se decide al empezar el tramo: sacarlo del RNG más tarde mezclaría su tirada con las de la pista
    r.nextEventAt = r.section >= 1 && r.rng.chance(0.6) ? r.time + r.rng.range(5, 10) : Infinity;
    r.pendingEvent = r.rng.pick(EVENTS);
    fx.banner(`TRAMO ${r.section + 1}`, r.biome.name + (r.risk ? '  ·  ☠ RIESGO x2' : ''), r.biome.accent);
  }
  music.biome = r.biome.music;
  music.intensity = Math.min(3, r.section);
}

// ---------- Combo / puntos / overdrive ----------
export function addChain(n) {
  const r = run();
  const before = r.mult;
  r.chain = Math.min(98.99, r.chain + n);
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
function progress(kind, value = 1) {
  for (const m of missions.track(kind, value)) {
    fx.banner('✔ MISIÓN COMPLETADA', `${m.text}  ·  +${m.gems} 💎`, '#30d158', true);
    fx.flash('#30d158', 0.4);
    sfx.chest();
    fx.vibe([30, 40, 30, 40, 80]);
    if (G.run) G.run.missionsDone = (G.run.missionsDone || 0) + 1;
    persist();
  }
  for (const a of trackAch(save, kind, value)) {
    fx.banner(`🏆 ${a.name.toUpperCase()}`, `${a.desc}  ·  +${ACH_GEMS[a.tier]} 💎`, '#ffd60a', true);
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

function addOD(v) {
  const r = run();
  if (r.odTime > 0) return;
  r.od = Math.min(1, r.od + v * r.stats.odRate);
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
  const ps = playerScreen();
  const bonus = (r.event?.id === 'nearonly' ? 3 : 1) * (isActive(r.ability, 'overclock') ? 2 : 1);
  addChain(perfect ? 2 : 1);
  progress('near');
  if (perfect) progress('perfect');
  addScore((perfect ? 150 : 60) * bonus, perfect ? '¡PERFECTO!' : 'NEAR-MISS', ps.x, ps.y - ps.s * 0.6, perfect ? '#ffe600' : '#5ac8fa');
  addOD(perfect ? 0.12 : 0.07);
  if (perfect && r.synergies.has('zen')) addOD(0.15);
  if (r.stats.nearDash) r.dashCharges = Math.min(r.stats.dashMax, r.dashCharges + 0.5);
  // jugar bien recarga antes la habilidad
  if (onNearMissCd(r.ability)) abilityReady();
  // mutación "chain": los near-miss alargan la SOBRECARGA
  if (isActive(r.ability, 'overclock') && r.ability.mut === 'chain') r.ability.active += 0.3;
  // Vampiro solo premia jugar bien: near-miss, nunca golpes ni roturas
  if (r.stats.vampire && ++r.vampN >= VAMPIRE_NEAR) {
    r.vampN = 0;
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
  addOD(0.05);
}

export function onHit(o) {
  const r = run(), p = G.player;
  const ps = playerScreen();
  if (G.god) return breakObj(o, 'dash');
  if (G.debug) (G.hits ||= []).push({ type: o.type, x: +o.x.toFixed(2), px: +p.x.toFixed(2), lane: p.lane, py: +p.y.toFixed(2), slide: p.slide > 0, sec: r.section, t: Math.round(r.time), ev: r.event?.id, hunter: !!o.hunter, boss: !!r.boss });
  if (r.shields > 0) {
    // un golpe siempre CUESTA: escudo, medio overdrive y el combo. Nunca da premios.
    r.shields--;
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
  // ÚLTIMO ALIENTO (árbol, BLINDAJE nivel 3): una vez por partida, un golpe sin escudos no mata
  if (r.lastStand) {
    r.lastStand = false;
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
  const msg = extra > 0 ? `🛡️ Escudos al máximo (${MAX_SHIELDS}) · +${20 * extra} 🪙` : label;
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
  if (!canUse(a) || (a.id === 'hook' && hook === null)) {
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
      if (a.mut === 'full') r.od = 0.999;
      else addOD(0.5);
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
  addOD(0.012);
  sfx.coin(r.coinStreak);
  const sp = project(o.x, o.y, 0.3);
  if (sp) fx.burst(sp.x, sp.y, 6, '#ffcc00', 220, 3, 0.35, 300);
}

export function onCore(o) {
  o.alive = false;
  const ps = playerScreen();
  addChain(3);
  addScore(1000, '¡GOLPE AL JEFE!', ps.x, ps.y - 60, '#ff2d55');
  hurtBoss();
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
        let reward = `${res.icon} ${res.label}`;
        if (res.kind === 'coins') r.coins += res.amount;
        if (res.kind === 'shield') reward = gainShield(res.amount, '+1 🛡️ ESCUDO');
        if (res.kind === 'od') r.od = 0.999;
        openCards(res.kind === 'epic' ? { minRarity: 'epic', title: '¡CARTA ÉPICA!' } : { reward });
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

function openCards({ minRarity = null, title = 'ELIGE UNA CARTA', next = true, reward = '' } = {}) {
  const r = run();
  let offers = offerCards(r, 3, minRarity);
  if (!offers.length) offers = offerCards(r, 3);
  const finish = () => {
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

// ---------- Muerte ----------
function die() {
  const r = run(), p = G.player;
  G.mode = 'dying';
  G.timeWarp = 1;
  G.dyingT = 1.0;
  p.dead = true;
  const ps = playerScreen();
  for (const c of ['#fff', '#ff2d55', '#ffcc00', r.biome.obs]) fx.burst(ps.x, ps.y, 40, c, 800, 7, 1.1, 500);
  fx.ring(ps.x, ps.y, '#fff', 500, 0.6, 24);
  fx.shake(32);
  fx.flash('#fff', 0.9);
  fx.vibe([120, 60, 220]);
  sfx.die();
  musicStop();

  // raíz cuadrada: la puntuación crece de forma explosiva, las gemas no deben hacerlo
  // + 1 gema por cada 2 tramos: con el árbol de mejoras hay mucho más en lo que gastarlas
  let gems = Math.floor(Math.sqrt(r.score) / 40) + r.bosses * 5 + Math.max(0, r.section) + Math.floor(Math.max(0, r.section) / 2);
  if (r.daily) gems = Math.ceil(gems * 1.5);
  const prevBest = save.best;
  const isBest = r.score > save.best;
  save.gems += gems;
  save.best = Math.max(save.best, Math.floor(r.score));
  save.bestDist = Math.max(save.bestDist, Math.floor(r.dist));
  let dailyBest = false;
  if (r.daily) {
    if (save.daily.key !== todayKey()) save.daily = { key: todayKey(), best: 0 };
    dailyBest = r.score > save.daily.best;
    save.daily.best = Math.max(save.daily.best, Math.floor(r.score));
  }
  save.runs++;
  progress('runs');
  progress('score', Math.floor(r.score));
  // rango de piloto: la XP de la partida y los rangos que suben (con su premio)
  const xp = xpForRun({ dist: r.dist, near: r.nearMisses, section: r.section + 1, bosses: r.bosses, missionsDone: r.missionsDone });
  const xpBefore = save.xp;
  const rankUps = addXp(save, xp);
  persist();
  r.result = { xp, xpBefore, rankUps, achDone: r.achDone || [], prevBest, missionsDone: r.missionsDone || 0, score: r.score, dist: r.dist, maxMult: r.maxMult, near: r.nearMisses, breaks: r.breaks, section: r.section + 1, bosses: r.bosses, gems, isBest, dailyBest, daily: r.daily, cards: r.cards, synergies: [...r.synergies] };
}

// ---------- Bucle ----------
export function update(dt) {
  if (G.mode === 'dying') {
    G.dyingT -= dt;
    if (G.dyingT <= 0) {
      G.mode = 'dead';
      ui.showHUD(false);
      ui.showDeath(G.run.result);
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
      music.od = false;
      // margen de salida: durante el overdrive no hace falta esquivar, así que acabarlo justo
      // delante de un obstáculo sería una muerte sin tiempo de reacción
      G.player.invuln = Math.max(G.player.invuln, 0.6);
      fx.notice('OVERDRIVE terminado', '#ff2bd6');
    }
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
}
