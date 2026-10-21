// ARENA: lógica del modo survivors. Vista cenital, la nave se mueve libre (joystick / WASD), dispara
// sola y sobrevive 10:00 a oleadas cada vez más grandes. Subir de nivel = elegir 1 de 3 mejoras.
import { G } from './state.js';
import { makeRng } from './rng.js';
import { save, persist } from './save.js';
import { fx } from './fx.js';
import { sfx, music, musicStart, musicStop } from './audio.js';
import { SHIPS, shipLvls, abilityMods } from './upgrades.js';
import { hasTalent } from './economy.js';
import { newAbility, trigger, tickAbility, canUse } from './abilities.js';
import { equipped } from './cosmetics.js';
import { boomFx } from './cosfx.js';
import { addXp, prestigeBonus } from './progress.js';
import { progress } from './game.js';
import { ui } from './ui.js';
import {
  WEAPONS, SHIP_WEAPON, SHIP_ARENA, passiveStats, EVOLUTIONS, offerUpgrades, applyUpgrade, xpNeed,
  ENEMIES, waveAt, ELITE_EVERY, BOSS_TIMES, ARENA_TIME, arenaRewards,
  ARENA_MAPS, mapFeatures, mapUnlocked, ARENA_BOSSES, BOSS_ATTACKS, bossOf, nextBossTime, arenaUpLvl,
} from './arenaData.js';

const A = () => G.arena;
const BOSS_IDS = Object.keys(ARENA_BOSSES);
const BASE_SPEED = 210;
const PLAYER_R = 14;
const CELL = 80;

// ---------- Inicio ----------
export function newArena(opts = {}) {
  let mapId = opts.map || save.arena.map || 'grid';
  if (!mapUnlocked(save, mapId)) mapId = 'grid';
  save.arena.map = mapId;
  const forced = G.debug ? new URLSearchParams(location.search).get('seed') : null;
  const seed = forced !== null ? Number(forced) >>> 0 : (Math.random() * 2 ** 32) >>> 0;
  const ship = SHIPS.find((s) => s.id === save.ship) || SHIPS[0];
  const base = SHIP_ARENA[ship.id] || SHIP_ARENA.viper;
  const lvls = shipLvls(save.shipLvl, ship.id);
  const a = {
    rng: makeRng(seed), ship, time: 0, over: false, won: false, endT: 0,
    x: 0, y: 0, face: -Math.PI / 2, input: { x: 0, y: 0 },
    hp: base.hp, maxHpBase: base.hp, speedMul: base.speed, iframes: 0, dashT: 0, dashCd: 0, dashDir: { x: 0, y: -1 },
    weapons: { [SHIP_WEAPON[ship.id]]: 1 }, passives: {}, evolved: {}, cds: {},
    enemies: [], bullets: [], ebullets: [], gems: [], chests: [], beams: [], rings: [], shells: [], arcs: [], drones: null,
    xp: 0, level: 1, kills: 0, bosses: 0, pendingUps: 0, offers: null,
    spawnAcc: 0, nextElite: ELITE_EVERY, bossIdx: 0, orbAngle: 0, flameT: 0,
    ability: newAbility(ship.ability, abilityMods(ship, lvls)), slowT: 0, phaseT: 0, ramT: 0,
    shake: 0, dmgBy: {},
    map: mapId, M: ARENA_MAPS[mapId], pulseT: 0,
  };
  a.feat = mapFeatures(mapId, a.rng); // rocas, lava y agujeros (el centro, libre)
  // el árbol de la nave también cuenta aquí: BLINDAJE da vida, MOTOR velocidad
  a.maxHpBase += lvls.a * 15;
  a.speedMul *= 1 + lvls.b * 0.04;
  // TALENTOS de la arena
  if (hasTalent(save, 'a1')) a.maxHpBase += 20;
  a.dmgMul = hasTalent(save, 'a2') ? 1.1 : 1;
  a.magMul = hasTalent(save, 'a3') ? 1.4 : 1;
  if (hasTalent(save, 'a4')) a.weapons[SHIP_WEAPON[ship.id]] = 2;
  a.phoenix = hasTalent(save, 'a5') ? 1 : 0;
  a.unlocked = { ...save.arenaWeapons };
  // TALLER DE LA ARENA (mejoras permanentes)
  const U = (k) => arenaUpLvl(save, k);
  a.maxHpBase += U('hp') * 10;
  a.dmgMul *= 1 + U('dmg') * 0.04;
  a.speedMul *= 1 + U('speed') * 0.03;
  a.magMul *= 1 + U('magnet') * 0.1;
  a.xpMul = 1 + U('xp') * 0.05;
  a.rerolls = U('reroll');
  a.banishes = U('banish');
  a.banned = {};
  a.hp = a.maxHpBase;
  G.arena = a;
  G.run = null;
  G.mode = 'arena';
  G.timeWarp = 1;
  fx.clear();
  ui.hideAll();
  ui.showArenaHUD(true);
  music.biome = 2;
  music.intensity = 0;
  musicStart('arena');
  progress('arena');
  ui.showTip('arena');
}

const stats = (a) => passiveStats(a.passives);
export const maxHp = (a) => a.maxHpBase + stats(a).maxHp;

// ---------- Rejilla espacial (colisiones con cientos de enemigos) ----------
let grid = new Map();
const key = (cx, cy) => (cx + 4096) * 8192 + (cy + 4096);
function buildGrid(a) {
  grid = new Map();
  for (const e of a.enemies) {
    if (!e.alive) continue;
    const k = key(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
    let cell = grid.get(k);
    if (!cell) grid.set(k, (cell = []));
    cell.push(e);
  }
}
// enemigos a menos de r de (x, y)
function near(x, y, r) {
  const out = [];
  const c0 = Math.floor((x - r) / CELL), c1 = Math.floor((x + r) / CELL);
  const d0 = Math.floor((y - r) / CELL), d1 = Math.floor((y + r) / CELL);
  for (let cx = c0; cx <= c1; cx++) {
    for (let cy = d0; cy <= d1; cy++) {
      const cell = grid.get(key(cx, cy));
      if (!cell) continue;
      for (const e of cell) if (e.alive && (e.x - x) ** 2 + (e.y - y) ** 2 < (r + e.r) ** 2) out.push(e);
    }
  }
  return out;
}
function nearest(a, x, y, maxR = 640, skip = null) {
  let best = null, bd = maxR * maxR;
  for (const e of a.enemies) {
    if (!e.alive || (skip && skip.has(e))) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// ---------- Enemigos ----------
function spawnEnemy(a, id, { elite = false, x = null, y = null } = {}) {
  const def = ENEMIES[id];
  const w = waveAt(a.time);
  let ex = x, ey = y;
  if (ex === null) {
    // en un anillo justo fuera de la pantalla
    const ang = a.rng.range(0, Math.PI * 2);
    const R = viewRadius() + 40;
    ex = a.x + Math.cos(ang) * R;
    ey = a.y + Math.sin(ang) * R;
  }
  if (a.M.radius) {
    const p = { x: ex, y: ey };
    keepIn(a, p, def.r);
    ex = p.x; ey = p.y;
  }
  const hp = def.hp * w.hpMul * (elite ? 7 : 1);
  a.enemies.push({
    id, def, x: ex, y: ey, hp, max: hp, r: def.r * (elite ? 1.6 : 1), speed: def.speed * (elite ? 0.9 : 1), dmg: def.dmg * (elite ? 1.5 : 1),
    // las gemas valen más con el tiempo: así se sigue subiendo de nivel a buen ritmo
    xp: def.xp * (elite ? 8 : 1) * (1 + a.time / 240), elite, boss: false, alive: true, flash: 0, state: 'go', st: 0, cd: a.rng.range(1, 2.5), phase: a.rng.range(0, 6),
    vx: 0, vy: 0, orbT: 0,
  });
}

function spawnBoss(a, forced = null) {
  const extra = a.bossIdx - BOSS_TIMES.length; // ≥ 0 en el modo sin fin
  const bid = forced || (extra >= 0 ? BOSS_IDS[extra % BOSS_IDS.length] : bossOf(a.map, a.bossIdx));
  const def = ARENA_BOSSES[bid];
  const final = !forced && a.bossIdx === BOSS_TIMES.length - 1;
  const hp = (final || extra >= 0 ? 2400 : 900) * waveAt(a.time).hpMul * (extra >= 0 ? 1 + 0.25 * (extra + 1) : 1);
  const ang = a.rng.range(0, Math.PI * 2);
  const pos = { x: a.x + Math.cos(ang) * 320, y: a.y + Math.sin(ang) * 320 };
  if (a.M.radius) keepIn(a, pos, 46);
  a.enemies.push({
    id: 'boss', bid, def: { color: def.color, shape: def.shape, name: def.name }, name: def.name, final,
    x: pos.x, y: pos.y, hp, max: hp, r: 46, speed: 55, dmg: 25, xp: 60, cds: {}, p2: false, spin: 0,
    elite: false, boss: true, alive: true, flash: 0, state: 'go', st: 0, phase: 0, vx: 0, vy: 0, orbT: 0,
  });
  if (!forced) a.bossIdx++;
  // ANILLO DE COMBATE: se cierra alrededor del duelo; no se sale hasta que cae el jefe
  a.ring = { x: a.x, y: a.y, r: 430, color: def.color };
  fx.banner(final ? '☠ JEFE FINAL ☠' : '⚠ JEFE ⚠', `${def.name} · ${def.desc}`, def.color, true);
  sfx.alarm();
  fx.vibe([60, 40, 60]);
}

function viewRadius() {
  const z = zoomOf();
  return Math.hypot(G.W, G.H) / 2 / z;
}
export const zoomOf = () => Math.max(0.75, Math.min(1.3, Math.min(G.W || 375, G.H || 812) / 420));

export function hurtEnemy(a, e, dmg) {
  if (!e.alive) return;
  if (e.shield) { e.flash = 0.03; return; } // LA COLMENA: con sus crías alrededor no le entra nada
  const st = stats(a);
  const crit = st.crit > 0 && a.rng.next() < st.crit;
  e.hp -= dmg * st.might * (a.dmgMul || 1) * (crit ? 2 : 1);
  if (crit) e.crit = 0.15;
  e.flash = 0.08;
  if (e.boss && !e.p2 && e.hp > 0 && e.hp < e.max / 2) {
    e.p2 = true;
    e.state = 'go';
    fx.banner('⚠ FASE 2', e.name, e.def.color, true);
    a.shake = 14;
    sfx.alarm();
  }
  if (e.hp > 0) return;
  e.alive = false;
  a.kills++;
  const sp = toScreen(a, e.x, e.y);
  fx.burst(sp.x, sp.y, e.boss ? 60 : e.elite ? 26 : 8, e.def.color, e.boss ? 700 : 260, e.boss ? 8 : 4, 0.5, 0);
  if (e.boss) {
    a.bosses++;
    a.ring = null;
    fx.banner('¡JEFE DESTRUIDO!', e.final ? 'has sobrevivido a la ARENA' : '+10 💎', '#ffe600', true);
    fx.flash('#fff', 0.8);
    a.shake = 20;
    sfx.boom();
    progress('boss');
    for (let i = 0; i < 12; i++) dropGem(a, e.x + a.rng.range(-60, 60), e.y + a.rng.range(-60, 60), 5);
    if (e.final) winArena(a);
    return;
  }
  sfx.brk();
  dropGem(a, e.x, e.y, e.xp);
  if (e.elite) a.chests.push({ x: e.x, y: e.y, alive: true });
  if (e.id === 'splitter') {
    for (let i = 0; i < 2; i++) spawnEnemy(a, 'mini', { x: e.x + (i ? 12 : -12), y: e.y });
  }
}

function dropGem(a, x, y, v) {
  // con muchas gemas sueltas, se funden en la más cercana (rendimiento y legibilidad)
  if (a.gems.length > 260) {
    const g = a.gems[a.gems.length - 1];
    g.v += v;
    return;
  }
  a.gems.push({ x, y, v, alive: true, mag: false });
}

// ---------- Jugador ----------
// src: quién hace el daño (se acumula en a.dmgBy: sirve para ajustar el balance)
function hurtPlayer(a, dmg, src = '?') {
  if (a.iframes > 0 || a.dashT > 0 || a.phaseT > 0 || a.over || G.god) return;
  const d = Math.max(1, dmg - stats(a).armor);
  a.hp -= d;
  a.dmgBy[src] = (a.dmgBy[src] || 0) + d;
  a.iframes = 0.6;
  a.shake = 10;
  fx.flash('#f33', 0.35);
  fx.vibe(60);
  sfx.shield();
  if (a.hp <= 0) loseArena(a);
}

export function arenaDash() {
  const a = A();
  if (!a || G.mode !== 'arena' || a.dashCd > 0) return;
  const len = Math.hypot(a.input.x, a.input.y);
  a.dashDir = len > 0.1 ? { x: a.input.x / len, y: a.input.y / len } : { x: Math.cos(a.face), y: Math.sin(a.face) };
  a.dashT = 0.2;
  a.dashCd = 1.2;
  sfx.dash();
}

// La habilidad ⚡ de cada nave, adaptada a la arena
export function useArenaAbility() {
  const a = A();
  if (!a || G.mode !== 'arena' || !canUse(a.ability)) return;
  trigger(a.ability);
  const sp = toScreen(a, a.x, a.y);
  switch (a.ability.id) {
    case 'overclock': a.slowT = 4 * a.ability.pow; break; // todo va a cámara lenta menos tú
    case 'ram': a.ramT = 2.5 * a.ability.pow; break; // embistes y atraviesas
    case 'phase': a.phaseT = 1.6 * a.ability.pow; break; // intangible
    case 'nova':
      for (const e of near(a.x, a.y, 230 * a.ability.pow)) hurtEnemy(a, e, 70);
      a.rings.push({ x: a.x, y: a.y, r: 230 * a.ability.pow, t: 0.4, max: 0.4, color: '#ff375f' });
      break;
    case 'roar':
      for (const e of near(a.x, a.y, 320 * a.ability.pow)) {
        const d = Math.hypot(e.x - a.x, e.y - a.y) || 1;
        if (!e.boss) { e.x += ((e.x - a.x) / d) * 140; e.y += ((e.y - a.y) / d) * 140; }
        e.stun = 1.2;
        hurtEnemy(a, e, 15);
      }
      a.rings.push({ x: a.x, y: a.y, r: 320, t: 0.5, max: 0.5, color: '#30d158' });
      break;
    case 'laser': {
      const t = nearest(a, a.x, a.y);
      const ang = t ? Math.atan2(t.y - a.y, t.x - a.x) : a.face;
      beamHit(a, ang, 700, 22, 90);
      break;
    }
    case 'hook': {
      const len = Math.hypot(a.input.x, a.input.y);
      const dx = len > 0.1 ? a.input.x / len : Math.cos(a.face), dy = len > 0.1 ? a.input.y / len : Math.sin(a.face);
      a.x += dx * 260;
      a.y += dy * 260;
      a.iframes = 0.5;
      break;
    }
    case 'bubble': // invulnerable un rato
      a.iframes = 3 * a.ability.pow;
      a.rings.push({ x: a.x, y: a.y, r: 60, t: 0.4, max: 0.4, color: '#64d2ff' });
      break;
    case 'blink': { // parpadeo hacia donde vas, con onda al llegar
      const len = Math.hypot(a.input.x, a.input.y);
      const dx = len > 0.1 ? a.input.x / len : Math.cos(a.face), dy = len > 0.1 ? a.input.y / len : Math.sin(a.face);
      a.x += dx * 320 * a.ability.pow;
      a.y += dy * 320 * a.ability.pow;
      a.iframes = 0.5;
      for (const e of near(a.x, a.y, 130)) hurtEnemy(a, e, 40);
      a.rings.push({ x: a.x, y: a.y, r: 130, t: 0.35, max: 0.35, color: '#ffe600' });
      break;
    }
    case 'barrier': // cura y protege
      a.hp = Math.min(maxHp(a), a.hp + maxHp(a) * 0.3 * a.ability.pow);
      a.iframes = 1;
      a.rings.push({ x: a.x, y: a.y, r: 90, t: 0.4, max: 0.4, color: '#7dffb0' });
      break;
    case 'singularity': // atrae a todos hacia un punto delante y los aplasta
      for (const e of near(a.x, a.y, 340 * a.ability.pow)) {
        if (!e.boss) { e.x += (a.x - e.x) * 0.5; e.y += (a.y - e.y) * 0.5; }
        hurtEnemy(a, e, 45);
      }
      a.rings.push({ x: a.x, y: a.y, r: 340 * a.ability.pow, t: 0.5, max: 0.5, color: '#c58cff' });
      break;
    case 'chaos':
      for (const e of near(a.x, a.y, 260 * a.ability.pow)) hurtEnemy(a, e, 60);
      a.rings.push({ x: a.x, y: a.y, r: 260 * a.ability.pow, t: 0.45, max: 0.45, color: '#ff4fd8' });
      break;
    case 'surge': { // acelerón hacia donde vas, dañando lo que atraviesas
      const len = Math.hypot(a.input.x, a.input.y);
      const ang = len > 0.1 ? Math.atan2(a.input.y, a.input.x) : a.face;
      beamHit(a, ang, 380 * a.ability.pow, 40, 70);
      a.x += Math.cos(ang) * 380 * a.ability.pow;
      a.y += Math.sin(ang) * 380 * a.ability.pow;
      a.iframes = 0.6;
      break;
    }
    case 'quake': // sacudida: daña y aturde todo lo cercano
      for (const e of near(a.x, a.y, 300 * a.ability.pow)) { hurtEnemy(a, e, 50); e.stun = 1.5; }
      a.rings.push({ x: a.x, y: a.y, r: 300 * a.ability.pow, t: 0.5, max: 0.5, color: '#ff9f0a' });
      break;
    case 'salvage': // desguace: atrae toda la XP y daña lo cercano
      for (const g of a.gems) g.mag = true;
      for (const e of near(a.x, a.y, 200 * a.ability.pow)) hurtEnemy(a, e, 35);
      a.rings.push({ x: a.x, y: a.y, r: 200 * a.ability.pow, t: 0.4, max: 0.4, color: '#8fd14f' });
      break;
    case 'hammer': { // onda en línea, ancha
      const t = nearest(a, a.x, a.y);
      beamHit(a, t ? Math.atan2(t.y - a.y, t.x - a.x) : a.face, 520, 60, 120 * a.ability.pow);
      break;
    }
  }
  fx.ring(sp.x, sp.y, '#fff', 200, 0.35, 10);
  sfx.od();
}

// rayo en línea recta: daña a todo lo que toca
function beamHit(a, ang, len, width, dmg) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  for (const e of a.enemies) {
    if (!e.alive) continue;
    const px = e.x - a.x, py = e.y - a.y;
    const along = px * dx + py * dy;
    if (along < 0 || along > len) continue;
    if (Math.abs(px * dy - py * dx) < width + e.r) hurtEnemy(a, e, dmg);
  }
  a.beams.push({ x: a.x, y: a.y, ang, len, w: width, t: 0.15 });
}

// ---------- Armas ----------
function fireWeapons(a, dt) {
  const st = stats(a);
  for (const [id, lv] of Object.entries(a.weapons)) {
    const W = WEAPONS[id], L = W.lvl(lv), evo = !!a.evolved[id];
    if (id === 'orbs') continue; // los orbes giran siempre (ver updateOrbs)
    a.cds[id] = (a.cds[id] ?? 0.3) - dt;
    if (a.cds[id] > 0) continue;
    let cd = W.cd * st.haste;
    // la Lanza y los Misiles van a por el jefe si está a tiro (si no, nunca bajaría su vida)
    const bossT = (id === 'beam' || id === 'missile') && a.enemies.find((e) => e.boss && e.alive && Math.hypot(e.x - a.x, e.y - a.y) < 600);
    const target = bossT || nearest(a, a.x, a.y, id === 'flame' ? 200 : 640);
    const ang = target ? Math.atan2(target.y - a.y, target.x - a.x) : a.face;
    switch (id) {
      case 'blaster': {
        const shots = L.shots + (evo ? 2 : 0) + st.amount;
        for (let i = 0; i < shots; i++) {
          const sa = ang + (i - (shots - 1) / 2) * 0.12;
          a.bullets.push({ x: a.x, y: a.y, vx: Math.cos(sa) * 640, vy: Math.sin(sa) * 640, r: 5 * st.area, dmg: L.dmg, pierce: evo ? 99 : 1, life: 1.1, kind: 'blaster', hit: null });
        }
        if (evo) cd *= 0.6;
        sfx.coin(2);
        break;
      }
      case 'shotgun': {
        for (let i = 0; i < L.shots; i++) {
          const sa = ang + a.rng.range(-0.4, 0.4);
          const v = a.rng.range(480, 600);
          a.bullets.push({ x: a.x, y: a.y, vx: Math.cos(sa) * v, vy: Math.sin(sa) * v, r: (evo ? 10 : 5) * st.area, dmg: L.dmg * (evo ? 1.6 : 1), pierce: evo ? 4 : 1, life: 0.38, kind: 'pellet', hit: null });
        }
        sfx.dash();
        break;
      }
      case 'beam': {
        if (!target) { a.cds[id] = 0.2; continue; }
        const angs = evo ? [ang - 0.35, ang, ang + 0.35] : [ang];
        for (const b of angs) beamHit(a, b, 560 * st.area, L.width * st.area * (evo ? 2 : 1), L.dmg);
        sfx.near(true, 1);
        break;
      }
      case 'pulse': {
        const R = L.radius * st.area * (evo ? 1.6 : 1);
        let healed = 0;
        for (const e of near(a.x, a.y, R)) {
          hurtEnemy(a, e, L.dmg);
          if (evo && healed < 3) { a.hp = Math.min(maxHp(a), a.hp + 0.4); healed++; }
        }
        a.rings.push({ x: a.x, y: a.y, r: R, t: 0.3, max: 0.3, color: '#ff375f' });
        break;
      }
      case 'flame': {
        const range = L.range * st.area;
        const dirs = evo ? [ang, ang + Math.PI / 2, ang + Math.PI, ang - Math.PI / 2] : [ang];
        for (const d of dirs) {
          for (const e of near(a.x, a.y, range)) {
            const ea = Math.atan2(e.y - a.y, e.x - a.x);
            const diff = Math.abs(Math.atan2(Math.sin(ea - d), Math.cos(ea - d)));
            if (diff < 0.45) hurtEnemy(a, e, L.dmg);
          }
          a.flames = { ang: d, range, t: 0.12, dirs };
        }
        break;
      }
      case 'twin': {
        if (!target) { a.cds[id] = 0.2; continue; }
        const angs = evo ? [ang - 0.3, ang, ang + 0.3] : [ang - 0.18, ang + 0.18];
        for (const b of angs) beamHit(a, b, 520 * st.area, L.width * st.area * (evo ? 2 : 1), L.dmg);
        sfx.near(true, 1);
        break;
      }
      case 'storm': {
        const pool = near(a.x, a.y, 430 * st.area);
        const n = L.strikes * (evo ? 2 : 1);
        for (let i = 0; i < n && pool.length; i++) {
          const e = pool.splice(Math.floor(a.rng.next() * pool.length), 1)[0];
          hurtEnemy(a, e, L.dmg);
          a.rings.push({ x: e.x, y: e.y, r: evo ? 60 : 26, t: 0.2, max: 0.2, color: '#ffe600' });
          if (evo) for (const e2 of near(e.x, e.y, 60)) if (e2 !== e) hurtEnemy(a, e2, L.dmg * 0.5);
        }
        if (n && pool) sfx.dash();
        break;
      }
      case 'mines': {
        const n = (evo ? 3 : L.n) + st.amount;
        for (let i = 0; i < n; i++) {
          const ox = i ? a.rng.range(-50, 50) : 0, oy = i ? a.rng.range(-50, 50) : 0;
          a.bullets.push({ x: a.x + ox, y: a.y + oy, vx: 0, vy: 0, r: (evo ? 16 : 10) * st.area, dmg: L.dmg * (evo ? 1.5 : 1), pierce: 1, life: 6 * st.duration, kind: 'mine', hit: null });
        }
        break;
      }
      case 'boomer': {
        const n = (evo ? 3 : L.n) + st.amount;
        for (let i = 0; i < n; i++) {
          const sa = ang + (i - (n - 1) / 2) * 0.35;
          a.bullets.push({ x: a.x, y: a.y, vx: Math.cos(sa) * 520, vy: Math.sin(sa) * 520, r: 9 * st.area, dmg: L.dmg, pierce: 99, life: 1.6 * st.duration, t: 0, kind: 'boomer', hit: null });
        }
        sfx.swish?.();
        break;
      }
      case 'arc': {
        // ARCO: salta de enemigo en enemigo (la Red eléctrica, el doble y aturdiendo)
        if (!target || Math.hypot(target.x - a.x, target.y - a.y) > 380) { a.cds[id] = 0.2; continue; }
        const hops = (L.chains + st.amount) * (evo ? 2 : 1), hit = new Set();
        let from = { x: a.x, y: a.y }, cur = target;
        for (let i = 0; i < hops && cur; i++) {
          hurtEnemy(a, cur, L.dmg);
          if (evo) cur.stun = 0.4 * st.duration;
          hit.add(cur);
          a.arcs.push({ x1: from.x, y1: from.y, x2: cur.x, y2: cur.y, t: 0.18 });
          from = cur;
          cur = nearest(a, cur.x, cur.y, 170 * st.area, hit);
        }
        if (evo) cd *= 0.7;
        sfx.near(true, 2);
        break;
      }
      case 'mortar': {
        // MORTERO: cae donde más enemigos hay juntos
        if (!target) { a.cds[id] = 0.3; continue; }
        const n = L.shells + st.amount + (evo ? 3 : 0);
        for (let i = 0; i < n; i++) {
          const t = densest(a) || target;
          const tx = t.x + (i ? a.rng.range(-70, 70) : 0), ty = t.y + (i ? a.rng.range(-70, 70) : 0);
          a.shells.push({ x0: a.x, y0: a.y, x: tx, y: ty, t: 0, max: 0.7, dmg: L.dmg, r: L.radius * st.area * (evo ? 1.3 : 1) });
        }
        sfx.dash();
        break;
      }
      case 'saw': {
        // SIERRAS: rebotan en los bordes de la pantalla y trituran (golpean cada 0,25 s)
        const n = L.n + st.amount + (evo ? 2 : 0);
        for (let i = 0; i < n; i++) {
          const sa = ang + (i / n) * Math.PI * 2;
          a.bullets.push({ x: a.x, y: a.y, vx: Math.cos(sa) * 380, vy: Math.sin(sa) * 380, r: (evo ? 22 : 12) * st.area, dmg: L.dmg, pierce: 999, life: 3.5 * st.duration * (evo ? 2 : 1), kind: 'saw', hit: null, hitT: 0, spin: 0 });
        }
        sfx.swish?.();
        break;
      }
      case 'drone': {
        // DRONES: cada uno dispara al enemigo más cercano a él
        cd = Math.max(0.25, L.cd) * st.haste * (evo ? 0.7 : 1);
        for (const d of a.drones || []) {
          const t = nearest(a, d.x, d.y, 420);
          if (!t) continue;
          const da = Math.atan2(t.y - d.y, t.x - d.x);
          const shots = evo ? 3 : 1;
          for (let k = 0; k < shots; k++) {
            const sa = da + (k - (shots - 1) / 2) * 0.1;
            a.bullets.push({ x: d.x, y: d.y, vx: Math.cos(sa) * 600, vy: Math.sin(sa) * 600, r: 4 * st.area, dmg: L.dmg, pierce: 1, life: 0.9, kind: 'drone', hit: null });
          }
        }
        break;
      }
      case 'missile': {
        const used = new Set();
        for (let i = 0; i < L.shots + st.amount; i++) {
          const t = nearest(a, a.x, a.y, 700, used) || target;
          if (t) used.add(t);
          const sa = ang + (i - (L.shots - 1) / 2) * 0.5;
          a.bullets.push({ x: a.x, y: a.y, vx: Math.cos(sa) * 260, vy: Math.sin(sa) * 260, r: 7, dmg: L.dmg, pierce: 1, life: 2.5 * st.duration, kind: 'missile', target: t, hit: null });
        }
        if (evo) cd *= 0.4;
        sfx.dash();
        break;
      }
    }
    a.cds[id] = cd;
  }
}

// el enemigo con más vecinos (de una muestra): donde más daño hace el mortero
function densest(a) {
  let best = null, bn = -1;
  const sample = a.enemies.length > 14 ? 14 : a.enemies.length;
  for (let i = 0; i < sample; i++) {
    const e = a.enemies[Math.floor(a.rng.next() * a.enemies.length)];
    if (!e?.alive || Math.hypot(e.x - a.x, e.y - a.y) > 520) continue;
    const n = near(e.x, e.y, 90).length;
    if (n > bn) { bn = n; best = e; }
  }
  return best;
}
function updateDrones(a, dt) {
  const lv = a.weapons.drone;
  if (!lv) { a.drones = null; return; }
  const count = a.evolved.drone ? 4 : WEAPONS.drone.lvl(lv).count;
  a.droneAng = (a.droneAng || 0) + dt * 1.4;
  a.drones = Array.from({ length: count }, (_, i) => {
    const ang = a.droneAng + (i / count) * Math.PI * 2;
    return { x: a.x + Math.cos(ang) * 46, y: a.y + Math.sin(ang) * 46 };
  });
}
function updateShells(a, dt) {
  for (const sh of a.shells) {
    sh.t += dt;
    if (sh.t < sh.max) continue;
    for (const e of near(sh.x, sh.y, sh.r)) hurtEnemy(a, e, sh.dmg);
    a.rings.push({ x: sh.x, y: sh.y, r: sh.r, t: 0.3, max: 0.3, color: '#ff9f0a' });
  }
  a.shells = a.shells.filter((sh) => sh.t < sh.max);
  for (const r of a.arcs) r.t -= dt;
  a.arcs = a.arcs.filter((r) => r.t > 0);
}

function updateOrbs(a, dt) {
  const lv = a.weapons.orbs;
  if (!lv) return;
  const evo = !!a.evolved.orbs;
  const L = WEAPONS.orbs.lvl(lv), st = stats(a);
  const count = evo ? 8 : L.count, R = (evo ? 105 : 72) * st.area;
  a.orbAngle += dt * (evo ? 3.6 : 2.4);
  a.orbs = [];
  for (let i = 0; i < count; i++) {
    const ang = a.orbAngle + (i / count) * Math.PI * 2;
    const ox = a.x + Math.cos(ang) * R, oy = a.y + Math.sin(ang) * R;
    a.orbs.push({ x: ox, y: oy });
    for (const e of near(ox, oy, 12 * st.area)) {
      if (e.orbT > 0) continue;
      e.orbT = 0.35;
      hurtEnemy(a, e, L.dmg);
    }
  }
}

function updateBullets(a, dt) {
  for (const b of a.bullets) {
    if (b.life <= 0) continue;
    b.life -= dt;
    if (b.kind === 'missile') {
      // giran hacia su objetivo (si murió, al más cercano)
      if (!b.target || !b.target.alive) b.target = nearest(a, b.x, b.y, 500);
      if (b.target) {
        const want = Math.atan2(b.target.y - b.y, b.target.x - b.x);
        const cur = Math.atan2(b.vy, b.vx);
        const turn = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
        const na = cur + Math.max(-6 * dt, Math.min(6 * dt, turn));
        const sp = Math.min(520, Math.hypot(b.vx, b.vy) + 600 * dt);
        b.vx = Math.cos(na) * sp;
        b.vy = Math.sin(na) * sp;
      }
    }
    if (b.kind === 'saw') {
      b.spin += dt * 14;
      b.hitT -= dt;
      if (b.hitT <= 0) { b.hitT = 0.25; b.hit = null; }
      const hw = (G.W || 375) / 2 / zoomOf() - b.r, hh = (G.H || 812) / 2 / zoomOf() - b.r;
      if (Math.abs(b.x + b.vx * dt - a.x) > hw) b.vx = -b.vx;
      if (Math.abs(b.y + b.vy * dt - a.y) > hh) b.vy = -b.vy;
    }
    if (b.kind === 'boomer') {
      // a mitad de vuelo da la vuelta hacia ti (y puede volver a dar a los mismos)
      b.t += dt;
      if (b.t > 0.7) {
        if (!b.back) { b.back = true; b.hit = null; }
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        b.vx = ((a.x - b.x) / d) * 560;
        b.vy = ((a.y - b.y) / d) * 560;
        if (d < 20) b.life = 0;
      }
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (inRock(a, b.x, b.y)) { if (b.kind === 'saw') { b.vx = -b.vx; b.vy = -b.vy; } else { b.life = 0; continue; } } // las rocas paran tus balas (las sierras rebotan)
    for (const e of near(b.x, b.y, b.r)) {
      if (b.hit && b.hit.has(e)) continue;
      if (b.kind === 'mine') {
        for (const e2 of near(b.x, b.y, 70 * stats(a).area)) hurtEnemy(a, e2, b.dmg);
        a.rings.push({ x: b.x, y: b.y, r: 70 * stats(a).area, t: 0.3, max: 0.3, color: '#ff9f0a' });
        b.life = 0;
        break;
      }
      if (b.kind === 'missile') {
        // explota: daño en área
        for (const e2 of near(b.x, b.y, 55 * stats(a).area)) hurtEnemy(a, e2, b.dmg);
        a.rings.push({ x: b.x, y: b.y, r: 55 * stats(a).area, t: 0.25, max: 0.25, color: '#ff9f0a' });
        b.life = 0;
        break;
      }
      hurtEnemy(a, e, b.dmg);
      (b.hit ||= new Set()).add(e);
      if (--b.pierce <= 0) { b.life = 0; break; }
    }
  }
  a.bullets = a.bullets.filter((b) => b.life > 0);
}

// ---------- Enemigos: movimiento y ataques ----------
function updateEnemies(a, dt) {
  const slow = a.slowT > 0 ? 0.35 : 1;
  const st = stats(a);
  for (const e of a.enemies) {
    if (!e.alive) continue;
    e.flash = Math.max(0, e.flash - dt);
    if (e.crit) e.crit = Math.max(0, e.crit - dt);
    e.orbT = Math.max(0, e.orbT - dt);
    if (e.stun > 0) { e.stun -= dt; continue; }
    const dx = a.x - e.x, dy = a.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    let vx = (dx / d) * e.speed, vy = (dy / d) * e.speed;
    if (e.id === 'swarm') {
      e.phase += dt * 6;
      vx += (-dy / d) * Math.sin(e.phase) * 60;
      vy += (dx / d) * Math.sin(e.phase) * 60;
    } else if (e.id === 'dasher') {
      // se para, avisa y embiste en línea recta
      e.st -= dt;
      if (e.state === 'go' && d < 260 && e.st <= 0) { e.state = 'aim'; e.st = 0.6; e.dx = dx / d; e.dy = dy / d; }
      if (e.state === 'aim') { vx = 0; vy = 0; if (e.st <= 0) { e.state = 'dash'; e.st = 0.45; } }
      if (e.state === 'dash') { vx = e.dx * e.speed * 3.6; vy = e.dy * e.speed * 3.6; if (e.st <= 0) { e.state = 'go'; e.st = 1.4; } }
    } else if (e.id === 'shooter') {
      // guarda la distancia y dispara
      if (d < 220) { vx = -vx; vy = -vy; } else if (d < 290) { vx = (-dy / d) * e.speed; vy = (dx / d) * e.speed; }
      e.cd -= dt * slow;
      if (e.cd <= 0) {
        e.cd = 2.4;
        a.ebullets.push({ x: e.x, y: e.y, vx: (dx / d) * 210, vy: (dy / d) * 210, r: 6, dmg: 8, life: 4 });
      }
    } else if (e.boss) {
      ({ vx, vy } = bossAI(a, e, dt, slow, dx, dy, d));
    }
    // ariete: lo que te toca sale despedido
    e.x += vx * dt * slow;
    e.y += vy * dt * slow;
    // contacto
    if (d < e.r + PLAYER_R) {
      if (a.ramT > 0) {
        hurtEnemy(a, e, 40 * dt * 10);
        if (!e.boss) { e.x -= (dx / d) * 30; e.y -= (dy / d) * 30; }
      } else hurtPlayer(a, e.dmg, e.boss ? 'jefe' : e.id);
    }
  }
  // separación barata para que no se apilen todos en un punto
  for (const e of a.enemies) {
    if (!e.alive || e.boss) continue;
    for (const o of near(e.x, e.y, e.r)) {
      if (o === e || o.boss) continue;
      const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy) || 1;
      const push = (e.r + o.r - od) * 0.25;
      if (push > 0) { e.x += (ox / od) * push; e.y += (oy / od) * push; }
    }
  }
  // los que se quedan muy atrás reaparecen delante (nunca se acumulan fuera de pantalla)
  const far = viewRadius() * 1.8;
  for (const e of a.enemies) {
    if (!e.alive || e.boss) continue;
    if (Math.hypot(e.x - a.x, e.y - a.y) > far) {
      const ang = Math.atan2(a.input.y || Math.sin(a.face), a.input.x || Math.cos(a.face)) + a.rng.range(-0.8, 0.8);
      e.x = a.x + Math.cos(ang) * (viewRadius() + 30);
      e.y = a.y + Math.sin(ang) * (viewRadius() + 30);
    }
  }
  if (a.M.radius || a.feat.rocks.length) for (const e of a.enemies) if (e.alive) keepIn(a, e, e.r);
  a.enemies = a.enemies.filter((e) => e.alive);
  // balas enemigas
  for (const b of a.ebullets) {
    b.life -= dt;
    b.x += b.vx * dt * slow;
    b.y += b.vy * dt * slow;
    if (!b.mine && inRock(a, b.x, b.y)) { b.life = 0; continue; } // …y también las suyas
    if (Math.hypot(b.x - a.x, b.y - a.y) < b.r + PLAYER_R * 0.7) {
      b.life = 0;
      hurtPlayer(a, b.dmg, b.boss ? 'balaJefe' : 'bala');
    }
  }
  a.ebullets = a.ebullets.filter((b) => b.life > 0);
  void st;
}

// ---------- Gemas, cofres, nivel ----------
function updatePickups(a, dt) {
  const st = stats(a);
  const magR = 115 * st.magnet * (a.magMul || 1);
  for (const g of a.gems) {
    if (!g.alive) continue;
    const d = Math.hypot(g.x - a.x, g.y - a.y);
    if (d < magR) g.mag = true;
    if (g.mag) {
      const sp = 480 * dt;
      g.x += ((a.x - g.x) / (d || 1)) * Math.min(sp, d);
      g.y += ((a.y - g.y) / (d || 1)) * Math.min(sp, d);
    }
    if (d < PLAYER_R + 6) {
      g.alive = false;
      a.xp += g.v * (a.xpMul || 1);
      sfx.coin(Math.min(11, a.level % 12));
    }
  }
  a.gems = a.gems.filter((g) => g.alive);
  for (const c of a.chests) {
    if (c.alive && Math.hypot(c.x - a.x, c.y - a.y) < PLAYER_R + 18) {
      c.alive = false;
      a.pendingUps += 1 + (a.rng.chance(0.1 * st.luck) ? 1 : 0); // SUERTE: a veces, dos mejoras
      a.hp = Math.min(maxHp(a), a.hp + 25);
      fx.banner('🎁 COFRE', 'mejora gratis', '#ffe600', true);
      sfx.chest();
    }
  }
  a.chests = a.chests.filter((c) => c.alive);
  while (a.xp >= xpNeed(a.level)) {
    a.xp -= xpNeed(a.level);
    a.level++;
    a.pendingUps++;
  }
}

// abre el panel de mejoras si hay alguna pendiente
function maybeLevelUp(a) {
  if (a.pendingUps <= 0 || a.over) return;
  a.offers = offerUpgrades(a, a.rng);
  G.mode = 'arenaUp';
  sfx.card();
  fx.vibe([20, 30, 20]);
  ui.showArenaUp(a);
}

export function pickArenaUpgrade(i) {
  const a = A();
  if (!a || G.mode !== 'arenaUp' || !a.offers) return;
  const up = a.offers[i] || a.offers[0];
  if (up.kind === 'heal') a.hp = maxHp(a);
  else applyUpgrade(a, up);
  if (up.kind === 'passive' && up.id === 'vitality') a.hp = Math.min(maxHp(a), a.hp + 30);
  if (up.kind === 'evolve') {
    fx.banner(`✨ ${EVOLUTIONS[up.id].name}`, 'ARMA EVOLUCIONADA', '#ffe600', true);
    setTimeout(() => ui.showTip('evolve'), 0);
    progress('evolve');
  }
  a.pendingUps--;
  a.offers = null;
  G.mode = 'arena';
  ui.hideAll();
  ui.showArenaHUD(true);
  maybeLevelUp(a); // varias seguidas, una tras otra
}

// ---------- Bucle ----------
export function updateArena(dt) {
  const a = A();
  if (!a) return;
  if (G.mode === 'arenaEnd') {
    a.endT -= dt;
    if (a.endT <= 0) {
      G.mode = 'arenaDone';
      ui.showArenaHUD(false);
      ui.showArenaEnd(a.result);
    }
    return;
  }
  if (G.mode !== 'arena') return;
  a.time += dt;
  music.intensity = a.enemies.some((e) => e.boss && e.alive) ? 3 : Math.min(3, 1 + Math.floor(a.time / 150)); // con jefe, a tope
  a.iframes = Math.max(0, a.iframes - dt);
  a.dashCd = Math.max(0, a.dashCd - dt);
  a.slowT = Math.max(0, a.slowT - dt);
  a.phaseT = Math.max(0, a.phaseT - dt);
  a.ramT = Math.max(0, a.ramT - dt);
  a.shake = Math.max(0, a.shake - dt * 40);
  tickAbility(a.ability, dt);
  const st = stats(a);
  a.hp = Math.min(maxHp(a), a.hp + st.regen * dt);

  // movimiento
  let ix = a.input.x, iy = a.input.y;
  const il = Math.hypot(ix, iy);
  if (il > 1) { ix /= il; iy /= il; }
  if (il > 0.1) a.face = Math.atan2(iy, ix);
  const sp = BASE_SPEED * a.speedMul * st.speed * (a.ramT > 0 ? 1.4 : 1);
  if (a.dashT > 0) {
    a.dashT -= dt;
    a.x += a.dashDir.x * sp * 3.4 * dt;
    a.y += a.dashDir.y * sp * 3.4 * dt;
  } else {
    a.x += ix * sp * dt;
    a.y += iy * sp * dt;
  }
  updateMap(a, dt);
  // dentro del anillo del jefe
  if (a.ring) {
    const dx = a.x - a.ring.x, dy = a.y - a.ring.y, d = Math.hypot(dx, dy), lim = a.ring.r - PLAYER_R;
    if (d > lim) { a.x = a.ring.x + (dx / d) * lim; a.y = a.ring.y + (dy / d) * lim; }
  }

  // oleadas
  const w = waveAt(a.time);
  a.spawnAcc += w.rate * dt;
  while (a.spawnAcc >= 1) {
    a.spawnAcc -= 1;
    if (a.enemies.length < w.cap) spawnEnemy(a, a.rng.weighted(w.weights).id);
  }
  if (a.time >= a.nextElite) {
    a.nextElite += ELITE_EVERY;
    spawnEnemy(a, a.rng.weighted(w.weights).id, { elite: true });
    fx.notice('☠ ÉLITE: suelta un cofre', '#ff9f0a');
  }
  if (a.time >= nextBossTime(a.bossIdx, a.endless)) spawnBoss(a);

  buildGrid(a);
  updateDrones(a, dt);
  fireWeapons(a, dt);
  updateOrbs(a, dt);
  updateShells(a, dt);
  updateBullets(a, dt);
  updateEnemies(a, dt);
  for (const r of a.rings) r.t -= dt;
  a.rings = a.rings.filter((r) => r.t > 0);
  for (const b of a.beams) b.t -= dt;
  a.beams = a.beams.filter((b) => b.t > 0);
  if (a.flames) { a.flames.t -= dt; if (a.flames.t <= 0) a.flames = null; }
  updatePickups(a, dt);
  if (!a.over) maybeLevelUp(a);
}

// ---------- Final ----------
function finish(a, won) {
  if (a.over) return;
  a.over = true;
  a.won = won;
  const rw = arenaRewards({ time: a.time, kills: a.kills, bosses: a.bosses, won });
  const gems = Math.ceil(rw.gems * (1 + prestigeBonus(save)));
  save.gems += gems;
  save.coins += rw.coins;
  const xpBefore = save.xp;
  const rankUps = addXp(save, rw.xp);
  const prev = save.arena.best;
  save.arena.best = Math.max(save.arena.best, Math.floor(a.time));
  save.arena.kills = Math.max(save.arena.kills, a.kills);
  if (won) save.arena.wins++;
  save.arena.bossBest = Math.max(save.arena.bossBest || 0, a.bosses);
  const mr = save.arenaMaps[a.map] || { best: 0, wins: 0 };
  save.arenaMaps[a.map] = { best: Math.max(mr.best, Math.floor(a.time)), wins: mr.wins + (won ? 1 : 0) };
  progress('arenaMapsWon', Object.values(save.arenaMaps).filter((m) => m.wins > 0).length);
  progress('arenaTime', Math.floor(a.time));
  progress('arenaKills', a.kills);
  persist();
  a.result = { map: a.map, endless: !!a.endless, coins: rw.coins, won, time: a.time, kills: a.kills, level: a.level, bosses: a.bosses, gems, xp: rw.xp, xpBefore, rankUps, best: save.arena.best, isBest: a.time > prev, weapons: { ...a.weapons }, evolved: { ...a.evolved } };
  G.mode = 'arenaEnd';
  a.endT = won ? 1.6 : 1.1;
  musicStop();
}

function loseArena(a) {
  // FÉNIX (talento): una vez por partida vuelves con media vida
  if (a.phoenix > 0) {
    a.phoenix--;
    a.hp = Math.round(maxHp(a) / 2);
    a.iframes = 2;
    for (const e of near(a.x, a.y, 260)) if (!e.boss) hurtEnemy(a, e, 999);
    a.rings.push({ x: a.x, y: a.y, r: 260, t: 0.6, max: 0.6, color: '#ff9f0a' });
    fx.banner('🔥 FÉNIX', 'vuelves de las cenizas', '#ff9f0a', true);
    return;
  }
  a.hp = 0;
  const sp = toScreen(a, a.x, a.y);
  const eq = equipped(save, save.ship);
  boomFx(fx, eq.boom.id, sp.x, sp.y, eq.palette.edge || a.ship.color, '#ff2bd6');
  fx.shake(30);
  sfx.die();
  finish(a, !!a.endless);
}

function winArena(a) {
  sfx.milestone();
  if (a.endless) return;
  // ¿SEGUIR? El modo sin fin: un jefe cada 3:00, cada vez más fuerte
  G.mode = 'arenaChoice';
  ui.showArenaChoice(a);
}
export function arenaContinue() {
  const a = A();
  if (!a || G.mode !== 'arenaChoice') return;
  a.endless = true;
  a.ring = null;
  G.mode = 'arena';
  ui.hideAll();
  ui.showArenaHUD(true);
  fx.banner('♾️ SIN FIN', 'un jefe cada 3:00, cada vez más fuerte', '#bf5af2', true);
}
export function arenaStop() {
  const a = A();
  if (a && G.mode === 'arenaChoice') finish(a, true);
}
// cambiar las 3 ofertas (🎲) o vetar una para el resto de la partida (🚫)
export function arenaReroll() {
  const a = A();
  if (!a || G.mode !== 'arenaUp' || a.rerolls <= 0) return;
  a.rerolls--;
  a.offers = offerUpgrades(a, a.rng);
  ui.showArenaUp(a);
}
export function arenaBanish(i) {
  const a = A();
  const up = a?.offers?.[i];
  if (!up || G.mode !== 'arenaUp' || a.banishes <= 0 || !['weapon', 'passive'].includes(up.kind)) return;
  a.banishes--;
  a.banned[`${up.kind}:${up.id}`] = true;
  a.offers = offerUpgrades(a, a.rng);
  ui.showArenaUp(a);
}

// coordenadas de pantalla de un punto del mundo (para efectos de fx)
export function toScreen(a, x, y) {
  const z = zoomOf();
  return { x: (G.W || 375) / 2 + (x - a.x) * z, y: (G.H || 812) / 2 + (y - a.y) * z, s: z };
}

// ---------- Mapas: límites, rocas, lava y agujeros negros ----------
// o: { x, y } que se queda dentro del mapa cerrado y fuera de las rocas (radio r)
function keepIn(a, o, r) {
  const R = a.M.radius;
  if (R) {
    const d = Math.hypot(o.x, o.y), lim = R - r;
    if (d > lim) { o.x = (o.x / d) * lim; o.y = (o.y / d) * lim; }
  }
  for (const k of a.feat.rocks) {
    const dx = o.x - k.x, dy = o.y - k.y, d = Math.hypot(dx, dy) || 1, m = k.r + r;
    if (d < m) { o.x = k.x + (dx / d) * m; o.y = k.y + (dy / d) * m; }
  }
}
function inRock(a, x, y) {
  for (const k of a.feat.rocks) if ((x - k.x) ** 2 + (y - k.y) ** 2 < k.r * k.r) return true;
  return false;
}
// el pulso de la Forja: aviso 1,5 s antes; 2 s con la lava al 160 %
export function lavaScale(a) {
  const P = a.M.pulse;
  if (!P) return { k: 1, warn: false };
  const t = a.pulseT % P;
  return { k: t > P - 2 ? 1.6 : 1, warn: t > P - 3.5 && t <= P - 2 };
}
// distancia a la copia más cercana de un charco (los charcos se repiten cada `tile`)
function wrapD(a, p, x, y) {
  const T = a.M.tile;
  let dx = x - p.x, dy = y - p.y;
  dx -= Math.round(dx / T) * T;
  dy -= Math.round(dy / T) * T;
  return Math.hypot(dx, dy);
}
export const holePos = (a, h) => ({ x: Math.cos(h.ang + a.time * 0.08) * h.d, y: Math.sin(h.ang + a.time * 0.08) * h.d });
function updateMap(a, dt) {
  if (a.M.radius || a.feat.rocks.length) keepIn(a, a, PLAYER_R);
  // LAVA: quema al pisarla (más grande durante el pulso)
  if (a.feat.pools.length) {
    a.pulseT += dt;
    const L = lavaScale(a);
    if (L.k > 1 && !a.pulsed) { a.pulsed = true; fx.notice('🔥 ¡PULSO DE LAVA!', '#ff6a00'); a.shake = 6; }
    if (L.k === 1) a.pulsed = false;
    for (const p of a.feat.pools) if (wrapD(a, p, a.x, a.y) < p.r * L.k) { hurtPlayer(a, 7, 'lava'); break; }
  }
  // AGUJEROS NEGROS: atraen a todos; a los enemigos que caen los aplastan; a ti te hacen daño
  for (const h of a.feat.holes) {
    const c = holePos(a, h);
    const pull = (o, k) => {
      const dx = c.x - o.x, dy = c.y - o.y, d = Math.hypot(dx, dy) || 1;
      if (d > 560) return d;
      const f = (h.pull * (1 - d / 560) + 30) * k * dt;
      o.x += (dx / d) * Math.min(f, d);
      o.y += (dy / d) * Math.min(f, d);
      return d;
    };
    if (pull(a, a.dashT > 0 ? 0.3 : 1) < h.r) hurtPlayer(a, 12, 'agujero');
    for (const e of a.enemies) if (e.alive && !e.boss && pull(e, 1.5) < h.r) hurtEnemy(a, e, 9999);
  }
}

// ---------- Jefes: cada uno con sus ataques (y más en la fase 2) ----------
function bossAI(a, e, dt, slow, dx, dy, d) {
  const B = ARENA_BOSSES[e.bid], atk = B.phases[e.p2 ? 1 : 0];
  let vx = (dx / d) * e.speed, vy = (dy / d) * e.speed;
  // EMBESTIDA: se para, avisa con una línea y carga
  if (e.state === 'aim') { e.st -= dt; if (e.st <= 0) { e.state = 'dash'; e.st = 0.6; } return { vx: 0, vy: 0 }; }
  if (e.state === 'dash') { e.st -= dt; if (e.st <= 0) e.state = 'go'; return { vx: e.dx * 520, vy: e.dy * 520 }; }
  const ready = (k) => {
    e.cds[k] = (e.cds[k] ?? BOSS_ATTACKS[k].cd * 0.5) - dt * slow;
    if (e.cds[k] > 0) return false;
    e.cds[k] = BOSS_ATTACKS[k].cd * (e.p2 ? 0.75 : 1);
    return true;
  };
  const shot = (ang, v, r = 7, dmg = 7) => a.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, r, dmg, life: 5, boss: true });
  const toYou = Math.atan2(dy, dx);
  for (const k of atk) {
    if (k === 'ring' && ready(k)) {
      const n = e.final || e.p2 ? 16 : 12, off = a.rng.range(0, 1);
      for (let i = 0; i < n; i++) shot(((i + off) / n) * Math.PI * 2, 150);
      sfx.dash();
    } else if (k === 'spray' && ready(k)) {
      for (let i = -2; i <= 2; i++) shot(toYou + i * 0.18, 220, 6, 7);
    } else if (k === 'charge' && ready(k)) {
      e.state = 'aim'; e.st = 0.8; e.dx = dx / d; e.dy = dy / d;
      return { vx: 0, vy: 0 };
    } else if (k === 'brood' && ready(k)) {
      for (let i = 0; i < 5; i++) {
        spawnEnemy(a, 'swarm', { x: e.x + a.rng.range(-60, 60), y: e.y + a.rng.range(-60, 60) });
        a.enemies[a.enemies.length - 1].kid = e;
      }
    } else if (k === 'mines' && ready(k)) {
      for (let i = 0; i < 4; i++) {
        const ang = a.rng.range(0, Math.PI * 2), r = a.rng.range(90, 170);
        a.ebullets.push({ x: a.x + Math.cos(ang) * r, y: a.y + Math.sin(ang) * r, vx: 0, vy: 0, r: 11, dmg: 12, life: 7, boss: true, mine: true });
      }
    } else if (k === 'lasers') {
      // LÁSERES que giran; 1,2 s de aviso (finos) antes de quemar
      e.spin += dt * slow * (e.p2 ? 0.75 : 0.55);
      e.lasersT = (e.lasersT || 0) + dt;
      e.nLasers = B.lasers[e.p2 ? 1 : 0];
      e.lasersOn = e.lasersT > 1.2;
      if (e.lasersOn) {
        for (let i = 0; i < e.nLasers; i++) {
          const ang = e.spin + (i / e.nLasers) * Math.PI * 2, cx = Math.cos(ang), cy = Math.sin(ang);
          const px = a.x - e.x, py = a.y - e.y, along = px * cx + py * cy;
          if (along > 0 && along < 560 && Math.abs(px * cy - py * cx) < 14 + PLAYER_R * 0.5) hurtPlayer(a, 10, 'laser');
        }
      }
      vx *= 0.4; vy *= 0.4;
    } else if (k === 'spiral') {
      // ESPIRAL de balas; cada 4 s cambia de sentido
      e.rev = (e.rev || 0) + dt;
      if (e.rev > 4) { e.rev = 0; e.dir = -(e.dir || 1); }
      e.spin += dt * slow * 1.8 * (e.dir || 1);
      e.sT = (e.sT || 0) - dt * slow;
      if (e.sT <= 0) {
        e.sT = e.p2 ? 0.09 : 0.13;
        const arms = e.p2 ? 2 : 1;
        for (let i = 0; i < arms; i++) shot(e.spin + (i / arms) * Math.PI * 2, 170, 6, 6);
      }
      vx *= 0.5; vy *= 0.5;
    } else if (k === 'suction' && d < 560) {
      // SUCCIÓN: te arrastra hacia su boca (el DASH te suelta)
      const f = (e.p2 ? 150 : 100) * dt * (a.dashT > 0 ? 0.2 : 1);
      a.x -= (dx / d) * f;
      a.y -= (dy / d) * f;
      vx *= 0.6; vy *= 0.6;
    }
  }
  if (B.shield) e.shield = a.enemies.filter((k) => k.alive && k.kid === e).length >= B.shield;
  return { vx, vy };
}
// (debug y tests) hace aparecer un jefe concreto
export function debugArenaBoss(id) {
  const a = A();
  if (a && ARENA_BOSSES[id]) spawnBoss(a, id);
}

export const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
export { ARENA_TIME };
