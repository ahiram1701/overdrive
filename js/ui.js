// Capa DOM: HUD, menú, hangar, cartas, tienda, cofre, muerte y pausa.
import { G, fmt, shieldCap } from './state.js';
import { save, persist } from './save.js';
import { sfx, setSound, unlockAudio, musicStop, musicDuck, musicStart, setVolumes } from './audio.js';
import { fx } from './fx.js';
import { todayKey } from './rng.js';
import { missions } from './missions.js';
import { rankOf, ACHIEVEMENTS, ACH_GEMS, achCount, MAX_RANK, effectiveRank, prestigeOf, prestigeBonus, canPrestige, doPrestige, PRESTIGE_REWARDS } from './progress.js';
import { BOSS_NAMES, BIOMES } from './world.js';
import { GROUPS, isUnlocked, lockText, buyCosmetic, equip, equipped, itemsFor, looksOf, saveLook, applyLook, copyLook, randomLook, resetLook, emblemOpts, setEmblemStyle, EMBLEM_AT, EMBLEM_COLORS, tintEngine, shipName, setShipName, DEFAULT_SHOT, achStyle } from './cosmetics.js';
import { drawShip, emblemPath } from './shipdraw.js';
import { trailFx, boomFx, makeParticles, auraFx } from './cosfx.js';
import { RARITY, CARDS, CARD_BY_ID, SHIPS, SYNERGIES, offerCards, availableCards, synergyHint, shipLvls, shipProfile, treeOf, PROFILE_KEYS, TREE_COSTS, TREE_LEVELS, MASTERY, MASTERY_COST, RESET_COST, canMaster, treeSpent, treeStars, abilityMods, CARD_LVL_COST, MAX_CARD_LVL, unlockEarnedShips } from './upgrades.js';
import { newRun, pickCard, resume, effSpeed, useAbility, progress, expChoose, expEventChoice, expRest, racePosition } from './game.js';
import { ACTS, ROWS, NODE, nodeById, canChoose, RELICS } from './expedition.js';
import { CUPS, MEDALS, isCupOpen, ghostAt, RIVALS, ttTargets } from './race.js';
import { newSpace, dock, undock, sellAll, buyUpgrade, repair, spaceBoost, leaveSpace, spaceStats, GAL, stationPrices, buyPrice, buyOre, setRoute, boardNow, acceptMission, abandonMission, atlasCount, spaceMissile, spaceAct, planetOf, orbitVisit, planetSell, leaveOrbit, sysOwner, bountyBoardNow, acceptBounty, abandonBounty, buyFactionItem, FACTION_SHOP, stationUpCost, storyChoose, storyIntro, snapThrottle, storyChapter, marketPrice, marketValue, missileMax, missileRefillCost, refillMissiles, itemDisc, useItem, CHASSIS, buyChassis, useChassis, foundOutpost, canFound, FOUND_COST, threat, shipPower, bribeWanted, bribeCost, wantedStars } from './spaceGame.js';
import { allPois, POI_KINDS, ATLAS_PERKS, MISSION_KINDS, MAX_ACTIVE } from './galaxyMissions.js';
import { canJump, jumpNeeded, known, route } from './galaxy.js';
import { chapterLabel } from './story.js';
import { world, WAR_TIME } from './galaxyWorld.js';
import { TIPS, tipSeen, markTip, resetTips } from './tips.js';
import { threatTier } from './galaxyThreat.js';
import { newPecio, pecioDash, pecioAbility, pecioBuy, pecioPray, pecioTakeOffer, pecioUseCons, pecioVaultStore, pecioVaultUnlock, VAULT_COST, pecioChooseExit, pecioWorkshopBuy } from './pecioGame.js';
import { RARITY as LOOT_RAR, SLOTS, SLOT_NAME, CONS, CONS_KEYS, SETS as LOOT_SETS, itemIcon, itemName, itemLines, setLines, currentFor } from './pecioLoot.js';
import { ENEMY, ROOM_TYPES, ABILITY as PECIO_AB, shopCost, SHOP_ITEMS, BOSSES, WORKSHOP, workshopLevel, workshopCost } from './pecio.js';
import { badgesFor, BADGES, LAYERS, DANGER_COLORS, dangerColor, routeToll, placeLabels } from './galmap.js';
import { MODULES, MOD_KEYS, MOD_MAX, outpostAt, modLvl, modCost, upgradeModule, depositAll, withdrawAll, storeCap, storeUsed, workshopDisc, radarSystems } from './outposts.js';
import { ITEMS, ITEM_KEYS, ITEM_MAX, itemCount, buyItem, saturation, priceFactor } from './market.js';
import { MATS, GEAR, slotsOf, matOf, owns, canCraft, craft, equipGear, gear, gearLvl, GEAR_MAX, gearUpCost, canUpgradeGear, upgradeGear } from './crafting.js';
import { chapters, storyState, CAST } from './story.js';
import { FACTIONS, repOf, repLevel, lvlAtLeast, TRAITS, liberatedCount, pirateSystemsTotal } from './factions.js';
import { UPGRADES as SP_UP, MAX_UP, BASE_UP, upgradeMats, upgradeCost as spUpCost, repairCost, ORES, cargoCount, shipStats as galStats, GAL_KEYS } from './galaxyData.js';
import { ABILITIES, readiness, newAbility } from './abilities.js';
import { levelById, visibleSectors, frontier, FIXED_SECTORS, starsOf, starCount, totalStars, isSectorOpen, isLevelOpen } from './campaign.js';
import { BOSS_BY_ID } from './bosses.js';
import { newArena, pickArenaUpgrade, useArenaAbility, fmtTime, arenaContinue, arenaStop, arenaReroll, arenaBanish } from './arena.js';
import { WEAPONS, PASSIVES, EVOLUTIONS, ARENA_TIME, xpNeed, ARENA_MAPS, MAP_KEYS, mapUnlocked, ARENA_BOSSES, ARENA_UPS, arenaUpLvl, arenaUpCost, buyArenaUp, nextBossTime } from './arenaData.js';
import { BOOSTS, MAX_BOOSTS, boostCount, buyBoost, toggleBoost, TALENTS, hasTalent, nextTalent, buyTalent, wallet, CRATES, RARITIES, PITY, openCrate, canAfford, crateStyles, cardLvl, cardOwned, buyCard, upgradeCard, buyWeapon } from './economy.js';
import { MODS, MOD_BY_ID, cleanMods, modScore, modGems, toggleMod, mutationOf } from './modifiers.js';

const $ = (id) => document.getElementById(id);
const OVERLAYS = ['menu', 'runnerHub', 'arenaHub', 'arenaChoice', 'pecioHub', 'pecioShop', 'pecioEnd', 'settings', 'store', 'crateOpen', 'expo', 'planet', 'station', 'galMap', 'galInv', 'atlas', 'hangar', 'achs', 'codex', 'arenaUp', 'arenaEnd', 'expMap', 'expEvent', 'expRest', 'expEnd', 'raceCups', 'racePodium', 'mods', 'campaign', 'victory', 'cards', 'shop', 'chest', 'death', 'pause'];

// Pantallas con la barra inferior (navegación principal) y su cabecera "← título"
const NAV_SCREENS = new Set(['menu', 'hangar', 'store', 'achs', 'codex']);
const BACK = {}; // id de pantalla -> qué hace "atrás" (botón ←, Esc o el atrás de Android)
let current = null, pushed = false, skipPop = false;

function show(id) {
  for (const o of OVERLAYS) $(o).classList.toggle('hidden', o !== id);
  // el diálogo de la historia solo convive con el vuelo y la estación (allí se cierra un capítulo)
  if (id && id !== 'station') $('dialog').classList.add('hidden');
  $('bottomNav').classList.toggle('hidden', !NAV_SCREENS.has(id));
  for (const b of $('bottomNav').querySelectorAll('button')) b.classList.toggle('on', b.dataset.nav === id);
  // historial: una sola entrada mientras hay una pantalla abierta, para que el "atrás" del móvil
  // la cierre en vez de salir de la app; al volver al menú por la UI se consume esa entrada
  try {
    if (BACK[id] && !pushed) { history.pushState({ overdrive: 1 }, ''); pushed = true; } else if (!BACK[id] && pushed) { pushed = false; skipPop = true; history.back(); }
  } catch { /* sin historial: da igual */ }
  current = id;
}

// Cabecera común: ← y título, igual en todas las pantallas
function screenHeader(id, title, onBack) {
  const sec = $(id);
  BACK[id] = onBack;
  const old = sec.querySelector(':scope > h2');
  if (old) old.remove();
  const head = el('div', 'scr-head', `<button class="scr-back" aria-label="Volver">←</button><b>${title}</b>`);
  head.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); unlockAudio(); sfx.ui(); onBack(); });
  sec.prepend(head);
}

// Aviso breve en la capa del DOM (se ve también en pantallas donde el lienzo no se dibuja)
let toastT = 0;
export function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.remove('hidden');
  t.classList.remove('pop');
  void t.offsetWidth;
  t.classList.add('pop');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add('hidden'), 2200);
}

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

// ¿Hay un diálogo abierto que pausa la partida? Se cura solo: si el diálogo ya no se ve (otra
// pantalla lo tapó), deja de pausar, así la partida nunca se queda congelada sin él.
// GIRO LIBRE de una vista 3D: arrastra en cualquier dirección (con inercia), pellizca o usa la rueda
// para acercar y toca dos veces para volver al principio. Si no la tocas en 3 s, vuelve a girar sola.
const ORBIT0 = { yaw: 0.6, pitch: -0.42, zoom: 1 };
function orbitControl(cv, st) {
  Object.assign(st, { ...ORBIT0, vy: 0, vp: 0, idle: 9, touching: 0, ...st });
  const pts = new Map();
  let pinch = null, lastTap = 0, moved = 0, lastT = 0;
  cv.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { cv.setPointerCapture(e.pointerId); } catch { /* ya no está */ }
    st.touching = pts.size;
    st.idle = 0;
    st.vy = st.vp = 0;
    moved = 0;
    lastT = e.timeStamp;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: st.zoom }; }
  });
  cv.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    if (pts.size >= 2 && pinch) { // PELLIZCO: acercar o alejar
      const [a, b] = [...pts.values()];
      st.zoom = Math.min(1.8, Math.max(0.6, pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
      return;
    }
    const dt = Math.max(0.008, (e.timeStamp - lastT) / 1000);
    lastT = e.timeStamp;
    // la nave sigue al dedo: lo que tocas va hacia donde arrastras (en rotate, +yaw lleva lo cercano a
    // la izquierda y +pitch lo sube; por eso se resta)
    st.yaw -= dx * 0.012;
    st.pitch -= dy * 0.012;
    // velocidad para la inercia (suavizada: un último movimiento brusco no la dispara)
    st.vy = st.vy * 0.6 - ((dx * 0.012) / dt) * 0.4;
    st.vp = st.vp * 0.6 - ((dy * 0.012) / dt) * 0.4;
  });
  const up = (e) => {
    if (!pts.delete(e.pointerId)) return;
    st.touching = pts.size;
    if (pts.size < 2) pinch = null;
    if (e.timeStamp - lastT > 90) st.vy = st.vp = 0; // soltó quieto: sin inercia
    if (moved < 8) { // DOBLE TOQUE: a la vista del principio
      if (e.timeStamp - lastTap < 320) { Object.assign(st, ORBIT0, { vy: 0, vp: 0 }); lastTap = 0; } else lastTap = e.timeStamp;
    }
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); st.zoom = Math.min(1.8, Math.max(0.6, st.zoom * Math.exp(-e.deltaY * 0.0015))); st.idle = 0; }, { passive: false });
}
// cada fotograma: inercia que se apaga y, tras 3 s sin tocarla, el giro solo
function orbitStep(st, dt, spin) {
  if (st.touching) return;
  st.idle += dt;
  st.yaw += st.vy * dt;
  st.pitch += st.vp * dt;
  const k = Math.exp(-dt * 3.2);
  st.vy *= k;
  st.vp *= k;
  if (st.idle > 3) st.yaw += dt * spin * Math.min(1, st.idle - 3);
}

// HANGAR · ESTILO: filtro de la lista (recordado en el dispositivo; si no hay almacenamiento, "todo")
const COS_FILTERS = [['all', 'TODO'], ['mine', 'MÍO'], ['locked', 'POR CONSEGUIR']];
let cosFilterMem = 'all';
function cosFilter(v) {
  if (v) { cosFilterMem = v; try { localStorage.setItem('od-cos-filter', v); } catch { /* sin almacenamiento */ } return v; }
  try { cosFilterMem = localStorage.getItem('od-cos-filter') || cosFilterMem; } catch { /* sin almacenamiento */ }
  return COS_FILTERS.some(([k]) => k === cosFilterMem) ? cosFilterMem : 'all';
}
// ICONOS de ESTILO: cada diseño o cabina, sobre la propia nave vista desde arriba; cada estela o
// explosión, con su efecto de verdad congelado en un instante (las de varias fases, se repintan luego)
const NO_CTX = new Proxy({}, { get: () => () => {}, set: () => true }); // lienzo "mudo" para simular
function paintStyleIcons(root, view, eq) {
  const pal = { ...eq.palette, edge: eq.palette.edge || view.color };
  const glow = /^#[0-9a-f]{6}$/i.test(pal.glow || '') ? pal.glow : '#7df9ff';
  for (const cv of root.querySelectorAll('canvas.sw-cv')) {
    const [g, id] = cv.dataset.ic.split(':'), c = cv.getContext('2d'), w = cv.width, h = cv.height;
    const it = GROUPS[g].find((x) => x.id === id);
    if (g === 'stripe' || g === 'cockpit') {
      const opts = { line: 1.2, stripe: g === 'stripe' && it.style !== 'none' ? it : null, cockpit: g === 'cockpit' ? it.color || '#7df9ff' : null };
      drawShip(c, view.id, pal, w / 2, h * 0.55, h * 1.15, { yaw: Math.PI, pitch: -1.3, roll: 0 }, opts);
    } else if (g === 'aura') { // la nave pequeña, con su aura alrededor
      auraFx(c, id, w / 2, h / 2, h * 0.5, 1.3);
      drawShip(c, view.id, pal, w / 2, h / 2, h * 0.5, { yaw: 0.6, pitch: -0.45, roll: 0 }, { line: 1 });
    } else if (g === 'trail') {
      // tumbada: sale por la izquierda y se alarga hacia la derecha (cabe más estela en el chip)
      const parts = makeParticles();
      c.save();
      c.translate(2, h / 2);
      c.rotate(-Math.PI / 2);
      for (let i = 0; i < 30; i++) { trailFx(parts, i === 29 ? c : NO_CTX, id, 0, -h * 0.18, h * 1.25, glow, 0, i / 30); parts.update(1 / 100); }
      parts.draw(c, w, h);
      c.restore();
    } else {
      const parts = makeParticles();
      boomFx(parts, id, w / 2, h / 2, pal.edge, '#ff2bd6', 0.32);
      parts.update(0.1);
      parts.draw(c, w, h);
      setTimeout(() => { if (!cv.isConnected) return; parts.update(0.08); c.clearRect(0, 0, w, h); parts.draw(c, w, h); }, 520);
    }
  }
}
// Tarjeta de un objeto de Pecios (icono, nombre, rareza y lo que hace)
function lootCard(it) {
  const R = LOOT_RAR[it.tier];
  const have = it.set ? G.pecio?.player?.sets?.[it.set] || 0 : 0; // cuántas de su set llevas ya
  const set = it.set ? `<small class="lc-set">${LOOT_SETS[it.set].icon} llevas ${have} de ${LOOT_SETS[it.set].name}</small>` : '';
  return `<div class="loot-card${it.unique ? ' unique' : ''}" style="--rc:${R.color}"><span class="lc-icon">${itemIcon(it)}</span><b>${itemName(it)}</b><small class="lc-rar">${it.unique ? '★ ÚNICO · ' : ''}${R.name}</small>${itemLines(it).map((l) => `<small>${l}</small>`).join('')}${set}</div>`;
}

export function dialogPaused() {
  if (G.dialogPause && $('dialog').classList.contains('hidden')) G.dialogPause = false;
  return !!G.dialogPause;
}

function tap(node, fn) {
  node.addEventListener('click', (e) => {
    // con un diálogo abierto, los botones de la partida (DASH, habilidad, disparo…) no hacen nada
    if (dialogPaused() && !node.closest('#dialog') && node.closest('#hud, #spaceHud, #arenaHud')) return;
    e.stopPropagation();
    unlockAudio();
    sfx.ui();
    fn(e);
  });
}

const hudCache = {};
function setText(id, v) {
  if (hudCache[id] === v) return;
  hudCache[id] = v;
  $(id).textContent = v;
}
// HUD a 60 fps: elementos fijos guardados una vez y estilos/clases escritos solo si cambian
// (cada escritura en el DOM, aunque sea el mismo valor, puede costar un recálculo de estilos)
const hudEl = {};
const $h = (id) => hudEl[id] || (hudEl[id] = $(id));
function setTf(n, v) { if (n._tf !== v) { n._tf = v; n.style.transform = v; } }
function setVar(n, k, v) { const c = `_v${k}`; if (n[c] !== v) { n[c] = v; n.style.setProperty(k, v); } }
function tgl(n, c, on) { if (n.classList.contains(c) !== on) n.classList.toggle(c, on); }
function setHTML(id, v) {
  if (hudCache[id] === v) return;
  hudCache[id] = v;
  $(id).innerHTML = v;
}

let shownScore = 0;

function cardNode(c, run, extra = '') {
  const rar = RARITY[c.rarity];
  const lvl = run.cards[c.id] || 0;
  const syn = synergyHint(run, c.id);
  const n = el('button', `card r-${c.rarity}`);
  n.style.setProperty('--rc', rar.color);
  n.innerHTML = `
    <span class="c-rar">${rar.name}</span>
    <span class="c-icon">${c.icon}</span>
    <span class="c-name">${c.name}</span>
    <span class="c-desc">${c.descN ? c.descN(lvl + 1) : c.desc}</span>
    ${lvl ? `<span class="c-lvl">Nv ${lvl} → ${lvl + 1}</span>` : ''}
    ${syn ? `<span class="c-syn">⚡ SINERGIA: ${syn}</span>` : ''}
    ${extra}`;
  return n;
}

// Misiones de hoy con barra de progreso
function missionsHTML(title = 'MISIONES DE HOY') {
  const list = missions.today();
  const rows = list.map((m) => {
    const k = Math.min(1, m.progress / m.n);
    const prog = m.mode === 'best' && !m.done && m.progress ? `mejor: ${fmt(m.progress)}` : `${fmt(m.progress)}/${fmt(m.n)}`;
    return `<div class="mission d-${m.diff}${m.done ? ' done' : ''}">
      <div class="m-top"><span>${m.done ? '✔ ' : ''}${m.text}</span><b>+${m.gems} 💎</b></div>
      <div class="m-bar"><i style="transform:scaleX(${k})"></i></div>
      <small>${m.done ? 'completada' : prog}</small>
    </div>`;
  }).join('');
  return `<h3>${title}</h3>${rows}`;
}

// Barra de rango de piloto. `from` (XP antes de la partida) anima la parte ganada.
function rankHTML(xp, from = null) {
  const { rank, into, need } = rankOf(xp);
  const k = need ? into / need : 1;
  let gained = '';
  if (from !== null && rankOf(from).rank === rank && need) {
    const k0 = rankOf(from).into / need;
    gained = `<u style="left:${(k0 * 100).toFixed(1)}%;width:${((k - k0) * 100).toFixed(1)}%"></u>`;
  }
  const p = prestigeOf(save);
  return `<div class="rank-top"><b>${p ? `<span class="prest">✨${p}</span> · ` : ''}RANGO ${rank}</b><small>${rank >= MAX_RANK ? 'MÁXIMO' : `${fmt(into)} / ${fmt(need)} XP`}</small></div>
    <div class="rank-bar"><i style="transform:scaleX(${k.toFixed(3)})"></i>${gained}</div>`;
}

// Armas y pasivas de la arena, con su nivel (✨ si ha evolucionado)
function arenaBuild(a) {
  const w = Object.entries(a.weapons).map(([id, n]) => `<span title="${WEAPONS[id].name}">${a.evolved[id] ? EVOLUTIONS[id].icon : WEAPONS[id].icon}<sub>${a.evolved[id] ? '✨' : n}</sub></span>`);
  const p = Object.entries(a.passives || {}).map(([id, n]) => `<span title="${PASSIVES[id].name}">${PASSIVES[id].icon}<sub>${n}</sub></span>`);
  return w.join('') + p.join('');
}

function buildSummary(run) {
  const items = Object.entries(run.cards).map(([id, n]) => `<span title="${CARD_BY_ID[id].name}">${CARD_BY_ID[id].icon}${n > 1 ? `<sub>${n}</sub>` : ''}</span>`);
  const syn = [...run.synergies].map((id) => `<span class="syn">${SYNERGIES.find((s) => s.id === id).name}</span>`);
  return items.join('') + syn.join('');
}

export const ui = {
  init() {
    if (unlockEarnedShips(save).length) persist();
    tap($('btnPlay'), () => newRun(false));
    tap($('btnMods'), () => ui.showMods());
    tap($('btnArena'), () => ui.showArenaHub());
    tap($('btnPecio'), () => ui.showPecioHub());
    tap($('btnPecioPlay'), () => newPecio());
    tap($('btnPecioRetry'), () => newPecio());
    tap($('btnPecioMenu'), () => { G.pecio = null; ui.showPecioHub(); });
    tap($('btnPecioShopClose'), () => { G.mode = 'pecio'; ui.hideAll(); ui.showPecioHUD(true); });
    tap($('pcDash'), () => pecioDash());
    tap($('pcAbility'), () => pecioAbility());
    tap($('pcPause'), () => ui.pause());
    tap($('btnGalaxy'), () => newSpace());
    tap($('btnDock'), () => dock());
    tap($('btnUndock'), () => undock());
    tap($('btnSell'), () => { const got = sellAll(); if (got) fx.notice(`+${got} 💰`, '#ffe600'); ui.showStation(G.space); });
    tap($('btnRepair'), () => { repair(); ui.showStation(G.space); });
    tap($('btnSpaceMenu'), () => { leaveSpace(); ui.showMenu(); });
    tap($('spacePause'), () => ui.pause());
    tap($('btnGalMap'), () => ui.showGalMap());
    tap($('btnAtlas'), () => ui.showAtlas());
    // disparar: mantener pulsado; impulso: un toque
    const fire = $('btnFire');
    fire.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); unlockAudio(); if (G.space) G.space.fireHeld = true; });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) fire.addEventListener(ev, () => { if (G.space) G.space.fireHeld = false; });
    $('btnBoost').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); unlockAudio(); spaceBoost(); });
    $('btnMissile').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); unlockAudio(); spaceMissile(); });
    tap($('btnAct'), () => spaceAct());
    // alabeo: mantener ↺ / ↻
    for (const [id, dir] of [['btnRollL', -1], ['btnRollR', 1]]) {
      const b = $(id);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (G.space) G.space.rollBtn = dir; });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => { if (G.space) G.space.rollBtn = 0; });
    }
    // acelerador: de −40% (marcha atrás) a 100%; con un "clic" en el 0 para poder pararse
    // la MUESCA del 0 engancha (y avisa con un toque al llegar)
    $('throttle').addEventListener('input', (e) => {
      const sh = G.space?.ship;
      if (!sh) return;
      const was = sh.throttle === 0;
      sh.throttle = snapThrottle(Number(e.target.value) / 100, was);
      if (sh.throttle === 0 && !was) { fx.vibe(15); sfx.ui(); }
    });
    // al soltar, la palanca se coloca donde manda (en la muesca si está parada)
    $('throttle').addEventListener('change', () => { if (G.space) $('throttle').value = Math.round(G.space.ship.throttle * 100); });
    tap($('btnInv'), () => ui.showGalInv());
    tap($('btnItems'), () => { $('itemBar').classList.toggle('hidden'); ui.renderItemBar(); });
    for (const b of $('giTabs').querySelectorAll('button')) tap(b, () => ui.showGalInv(b.dataset.tab));
    tap($('btnExpedition'), () => newRun({ mode: 'expedition' }));
    tap($('btnExpAgain'), () => newRun({ mode: 'expedition' }));
    tap($('btnExpMenu'), () => ui.showMenu());
    tap($('btnRaces'), () => ui.showRaceCups());
    tap($('btnRaceMenu'), () => ui.showRaceCups());
    tap($('btnRaceNext'), () => { const res = ui.lastRace; if (res?.next) newRun({ mode: 'race', track: res.next, points: res.points }); });
    tap($('btnRaceRetry'), () => { const res = ui.lastRace; if (res) newRun({ mode: 'race', track: res.track.id, points: res.pointsBefore, solo: res.solo }); });
    for (const b of $('rcTabs').querySelectorAll('button')) tap(b, () => { ui.rcTab = b.dataset.tab; ui.showRaceCups(); });
    tap($('btnRestShield'), () => expRest('shield'));
    tap($('btnRestCard'), () => expRest('card'));
    tap($('btnArenaRetry'), () => newArena({ map: save.arena.map }));
    tap($('btnArenaMenu'), () => ui.showArenaHub());
    tap($('btnEndless'), () => arenaContinue());
    tap($('btnArenaStop'), () => arenaStop());
    tap($('btnAuReroll'), () => { ui.auBanish = false; arenaReroll(); });
    tap($('btnAuBanish'), () => { if (!G.arena?.banishes) return; ui.auBanish = !ui.auBanish; ui.showArenaUp(G.arena); });
    tap($('arenaPause'), () => ui.pause());
    $('arenaAbility').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (dialogPaused()) return;
      unlockAudio();
      useArenaAbility();
    });
    tap($('btnModsPlay'), () => newRun({ mode: 'endless' }));
    tap($('btnMutation'), () => newRun({ mode: 'mutation' }));
    tap($('btnCampaign'), () => ui.showCampaign());
    tap($('btnNext'), () => { if (ui.victoryNext) newRun({ mode: 'campaign', level: ui.victoryNext }); });
    tap($('btnRetry'), () => newRun(G.run?.opts));
    tap($('btnMap'), () => ui.showCampaign());
    tap($('btnHangarBack'), () => { ui.preview = null; ui.showMenu(); });
    // barra inferior
    for (const b of $('bottomNav').querySelectorAll('button')) {
      tap(b, () => {
        const to = b.dataset.nav;
        if (to === 'menu') { ui.preview = null; ui.showMenu(); } else if (to === 'hangar') ui.showHangar();
        else if (to === 'store') ui.showStore();
        else if (to === 'achs') ui.showAchievements(); else ui.showCodex();
      });
    }
    tap($('btnRankBadge'), () => ui.showAchievements());
    tap($('btnSettings'), () => ui.showSettings());
    tap($('btnMissions'), () => {
      const open = $('mMissions').classList.toggle('collapsed');
      $('btnMissions').classList.toggle('open', !open);
    });
    // cabeceras comunes con ← (y su "atrás")
    screenHeader('settings', 'AJUSTES', () => (ui._settingsBack === 'pause' ? ui.backToPause() : ui.showMenu())); // desde la pausa, vuelve a la pausa
    tap($('btnTipsReset'), () => { resetTips(save); persist(); toast('🔁 Los consejos volverán a salir'); });
    screenHeader('runnerHub', '🏁 RUNNER', () => ui.showMenu());
    screenHeader('arenaHub', '⚔️ ARENA', () => ui.showMenu());
    screenHeader('pecioHub', '🏚️ PECIOS', () => ui.showMenu());
    tap($('btnRunner'), () => ui.showRunnerHub());
    screenHeader('store', '🛒 TIENDA', () => ui.showMenu());
    tap($('btnCrateOk'), () => ui.showStore());
    for (const b of $('stTabs').querySelectorAll('button')) tap(b, () => { ui.storeTab = b.dataset.tab; ui.showStore(); });
    for (const id of ['btnWallet', 'btnWallet2']) tap($(id), () => $('walletInfo').classList.toggle('hidden'));
    screenHeader('expo', '🏛️ EXPOSICIÓN', () => ui.showHangar());
    screenHeader('planet', '🪐 EN ÓRBITA', () => leaveOrbit());
    tap($('btnExpo'), () => ui.showExpo(ui.hangarView || save.ship));
    screenHeader('achs', '🏆 LOGROS', () => ui.showMenu());
    screenHeader('codex', '📖 COLECCIÓN', () => ui.showMenu());
    screenHeader('campaign', '🗺️ CAMPAÑA', () => ui.showRunnerHub());
    screenHeader('mods', '⚙️ MODIFICADORES', () => ui.showRunnerHub());
    screenHeader('raceCups', '🏆 CARRERAS', () => ui.showRunnerHub());
    screenHeader('atlas', '📖 ATLAS', () => ui.showStation(G.space));
    screenHeader('galInv', '🎒 TU NAVE', () => { G.mode = 'galaxy'; musicDuck(false); ui.hideAll(); ui.showSpaceHUD(true); });
    screenHeader('galMap', '🗺️ MAPA GALÁCTICO', () => { G.mode = 'galaxy'; musicDuck(false); ui.hideAll(); ui.showSpaceHUD(true); });
    BACK.hangar = () => { ui.preview = null; ui.showMenu(); };
    // atrás del móvil / Esc: cierra la pantalla actual; en partida, pausa
    addEventListener('popstate', () => {
      if (skipPop) { skipPop = false; return; }
      pushed = false;
      if (BACK[current]) BACK[current]();
      else if (G.mode === 'play' || G.mode === 'arena' || G.mode === 'galaxy') ui.pause();
    });
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && BACK[current] && !['play', 'arena', 'galaxy'].includes(G.mode)) { e.preventDefault(); BACK[current](); }
    });
    // ajustes de la Galaxia
    $('setSens').addEventListener('input', (e) => { save.settings.sens = Number(e.target.value); persist(); });
    // VOLÚMENES: se oye el cambio al momento (con un sonido de prueba en los efectos)
    $('setMusicVol').addEventListener('input', (e) => { unlockAudio(); save.settings.musicVol = Number(e.target.value); setVolumes(); persist(); });
    $('setSfxVol').addEventListener('input', (e) => { unlockAudio(); save.settings.sfxVol = Number(e.target.value); setVolumes(); persist(); });
    $('setSfxVol').addEventListener('change', () => sfx.coin(3));
    tap($('tgInvert'), () => { save.settings.invertY = !save.settings.invertY; persist(); ui.syncToggles(); });
    tap($('tgLevel'), () => { save.settings.autoLevel = !save.settings.autoLevel; persist(); ui.syncToggles(); });
    tap($('btnResume'), () => {
      if (G.mode === 'arenaPaused') { G.mode = 'arena'; musicDuck(false); ui.hideAll(); ui.showArenaHUD(true); }
      else if (G.mode === 'pecioPaused') { G.mode = 'pecio'; musicDuck(false); ui.hideAll(); ui.showPecioHUD(true); }
      else if (G.mode === 'galaxyPaused') { G.mode = 'galaxy'; musicDuck(false); ui.hideAll(); ui.showSpaceHUD(true); } else resume();
    });
    tap($('btnQuit'), () => { if (G.space) leaveSpace(); musicStop(); G.arena = null; G.pecio = null; ui.showArenaHUD(false); ui.showPecioHUD(false); ui.showMenu(); });
    tap($('pauseBtn'), () => ui.pause());
    tap($('btnPauseSettings'), () => ui.showSettings('pause'));
    // pointerdown y no click: la habilidad tiene que salir en el instante en que tocas
    $('abilityBtn').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      unlockAudio();
      useAbility();
    });
    tap($('btnMenu'), () => ui.showMenu());
    $('death').addEventListener('click', () => {
      if (performance.now() - ui.deathAt < 700) return;
      unlockAudio();
      newRun(G.run?.opts);
    });
    const toggles = [['tgSound', 'sound'], ['tgVibe', 'vibe'], ['tgFx', 'fx']];
    for (const [id, key] of toggles) {
      tap($(id), () => {
        save.settings[key] = !save.settings[key];
        if (key === 'sound') setSound(save.settings.sound);
        if (key === 'vibe' && save.settings.vibe) fx.vibe(30);
        persist();
        ui.syncToggles();
      });
    }
    tap($('tgText'), () => {
      save.settings.text = save.settings.text === 'min' ? 'normal' : 'min';
      persist();
      ui.syncToggles();
    });
    ui.syncToggles();
  },

  syncToggles() {
    $('tgSound').classList.toggle('off', !save.settings.sound);
    $('tgVibe').classList.toggle('off', !save.settings.vibe);
    $('tgFx').classList.toggle('off', !save.settings.fx);
    $('tgText').classList.toggle('off', save.settings.text === 'min');
    $('tgInvert').classList.toggle('off', !save.settings.invertY);
    $('tgLevel').classList.toggle('off', !save.settings.autoLevel);
    $('setSens').value = save.settings.sens ?? 1;
    $('setMusicVol').value = save.settings.musicVol ?? 0.7;
    $('setSfxVol').value = save.settings.sfxVol ?? 1;
  },

  // de Ajustes a la pausa de la que viniste: la partida sigue pausada, tal cual
  backToPause() {
    ui._settingsBack = null;
    musicDuck(true);
    show('pause');
  },

  showSettings(from = null) {
    ui._settingsBack = from;
    // la versión instalada (el nombre de la caché del service worker), para saber si ya tienes la última
    fetch('sw.js', { cache: 'no-store' }).then((r) => r.text()).then((t) => {
      const v = /CACHE = '([^']+)'/.exec(t)?.[1];
      if (v) setText('appVersion', `versión ${v.replace('overdrive-', '')}`);
    }).catch(() => {});
    if (from === 'pause') musicDuck(false); // para oír bien el volumen que ajustas (la partida sigue en pausa)
    else G.mode = 'hangar'; // pantalla estática
    ui.syncToggles();
    show('settings');
  },

  hideAll() { show(null); },

  showHUD(on) {
    $('hud').classList.toggle('hidden', !on);
    const mods = on && G.run?.mods ? [...G.run.mods] : [];
    $('modTag').classList.toggle('hidden', !mods.length);
    $('modTag').textContent = mods.map((id) => MOD_BY_ID[id].icon).join('');
  },

  showMenu() {
    musicStart('menu'); // la canción tranquila del menú (si ya suena, sigue)
    G.mode = 'menu';
    G.run = null;
    G.arena = null;
    G.space = null;
    ui.showArenaHUD(false);
    ui.showSpaceHUD(false);
    G.player = null;
    ui.showHUD(false);
    ui.refreshLabels();
    $('mMissions').innerHTML = missionsHTML();
    const ms = missions.today();
    setText('mMisCount', `${ms.filter((m) => m.done).length}/${ms.length}`);
    setText('mRankNum', String(rankOf(save.xp).rank));
    $('btnRankBadge').classList.toggle('prest', prestigeOf(save) > 0);
    $('mRank').innerHTML = rankHTML(save.xp);
    if (canPrestige(save)) {
      const next = prestigeOf(save) + 1;
      const gift = PRESTIGE_REWARDS[next] ? 'un premio exclusivo' : '200 💎';
      const b = el('button', 'btn prestige', `✨ PRESTIGIO ${next} <small>vuelves al rango 1 · +5% 💎 para siempre · ${gift}</small>`);
      b.id = 'btnPrestige';
      tap(b, () => {
        // primer toque: avisa; segundo: confirma (nada de diálogos del navegador)
        if (!b.classList.contains('confirm')) {
          b.classList.add('confirm');
          b.innerHTML = '¿SEGURO? <small>toca otra vez para renacer</small>';
          return;
        }
        const res = doPrestige(save);
        if (!res) return;
        progress('prestige', res.level);
        persist();
        sfx.milestone();
        fx.flash('#ffffff', 0.9);
        fx.vibe([60, 40, 60, 40, 200]);
        ui.showMenu();
        fx.banner(`✨ PRESTIGIO ${res.level}`, res.reward ? '¡premio exclusivo en el hangar!' : `+${res.gems} 💎`, '#ffe600', true);
      });
      $('mRank').append(b);
    }
    show('menu');
  },

  // Rótulos del menú y de la pantalla RUNNER (carteras, récords y progreso de cada modo)
  refreshLabels() {
    setText('mGems', fmt(save.gems));
    setText('mCoins', fmt(save.coins));
    setText('mBest', save.best ? `récord ${fmt(save.best)}` : 'aún sin récord');
    setText('mBest2', save.best ? `récord ${fmt(save.best)}` : '');
    setText('mCredits', `💰 ${fmt(save.galaxy.credits)}`);
    setText('mGalaxy', save.galaxy.started ? `en ${GAL[save.galaxy.sys ?? 0].name}` : 'explora, mina, comercia y lucha');
    setText('mArena', save.arena.best ? `récord ${fmtTime(save.arena.best)}` : 'sobrevive 10:00');
    setText('mPecio', `🔩 ${fmt(save.pecio.piezas || 0)}${save.pecio.best ? ` · planta ${save.pecio.best}` : ''}`);
    const bs = save.boostSel.filter((id) => boostCount(save, id) > 0);
    setText('mBoosts', bs.length ? bs.map((id) => BOOSTS[id].icon).join('') : '');
    const golds = Object.values(save.raceCups).filter((m) => m === 0).length;
    setText('mRace', Object.keys(save.raceCups).length ? `${golds} 🥇` : `${CUPS.length} copas`);
    const eb = save.expedition.best;
    setText('mExp', save.expedition.wins ? `✔ ${save.expedition.wins}` : eb ? `acto ${Math.floor(eb / 10) + 1}` : 'roguelite');
    setText('mStars', `★ ${totalStars(save)}${frontier(save) > FIXED_SECTORS ? ` · sector ${frontier(save)}` : ''}`);
    const sel = cleanMods(save.modsLast, effectiveRank(save));
    setText('mMods', sel.length ? `x${modScore(sel).toFixed(1)}` : '');
    const mut = mutationOf(todayKey());
    const mutDone = save.mutation.key === todayKey() && save.mutation.played;
    setText('mMut', `${mut.map((id) => MOD_BY_ID[id].icon).join('')}${mutDone ? '' : ' x1,5 💎'}`);
  },

  // RUNNER: el modo infinito y sus 4 modos
  showRunnerHub() {
    G.mode = 'hangar'; // pantalla estática
    G.run = null;
    G.player = null;
    ui.showHUD(false);
    ui.refreshLabels();
    show('runnerHub');
  },

  // ARENA: elegir mapa (cada uno con sus peligros y sus jefes); tocar uno empieza la partida
  showArenaHub() {
    G.mode = 'hangar'; // pantalla estática
    G.arena = null;
    ui.showHUD(false);
    const box = $('arenaMaps');
    box.innerHTML = '';
    for (const id of MAP_KEYS) {
      const M = ARENA_MAPS[id], open = mapUnlocked(save, id), rec = save.arenaMaps[id];
      const b = el('button', `arena-map${open ? '' : ' locked'}${save.arena.map === id ? ' last' : ''}`, `<span class="am-icon">${open ? M.icon : '🔒'}</span>
        <span class="am-body"><b>${M.name}</b><small>${open ? M.desc : `Se abre: ${M.unlock.text}`}</small>
        <em>${M.bosses.map((k) => ARENA_BOSSES[k].name).join(' · ')}</em></span>
        <span class="am-rec">${rec ? `${fmtTime(rec.best)}${rec.wins ? ` · 🏆${rec.wins}` : ''}` : open ? '›' : ''}</span>`);
      b.dataset.map = id;
      b.style.setProperty('--am', M.grid.replace(/[\d.]+\)$/, '1)'));
      b.disabled = !open;
      if (open) tap(b, () => newArena({ map: id }));
      box.append(b);
    }
    show('arenaHub');
  },

  // Hangar: carrusel de naves, ficha con stats comparadas con la equipada y árbol de mejoras.
  showHangar(viewId = ui.hangarView || save.ship) {
    musicStart('menu');
    // dónde estabas: al repintar (elegir un estilo, comprar…) no se vuelve al principio
    const sameView = ui.hangarView === viewId && !$('hangar').classList.contains('hidden');
    const keepTop = sameView ? $('hangar').scrollTop : 0;
    const keepRows = {};
    if (sameView) for (const r of $('cosmetics').querySelectorAll('.cos-chips')) keepRows[r.dataset.group] = r.scrollLeft;
    ui.hangarView = viewId;
    G.mode = 'hangar';
    $('treeSheet').classList.add('hidden');
    if (!['nave', 'mejoras', 'estilo', 'galaxia'].includes(ui.hangarTab)) ui.hangarTab = 'nave';
    if (!ui._tabsReady) {
      ui._tabsReady = true;
      for (const b of $('hTabs').querySelectorAll('button')) {
        tap(b, () => {
          ui.hangarTab = b.dataset.tab;
          ui.showHangar();
          $('hangar').scrollTop = 0; // cada pestaña empieza arriba, justo bajo la nave
        });
      }
    }
    $('hGems').textContent = fmt(save.gems);
    const view = SHIPS.find((s) => s.id === viewId) || SHIPS[0];
    const owned = save.ships.includes(view.id);
    const inUse = save.ship === view.id;
    const ab = ABILITIES[view.ability];

    // carrusel
    const car = $('shipCarousel');
    car.innerHTML = '';
    for (const s of SHIPS) {
      const has = save.ships.includes(s.id);
      const lv = shipLvls(save.shipLvl, s.id);
      const stars = treeStars(lv);
      const b = el('button', `ship-chip${s.id === view.id ? ' viewing' : ''}${save.ship === s.id ? ' equipped' : ''}${has ? '' : ' locked'}${prestigeOf(save) >= 5 ? ' gold' : ''}`);
      b.style.setProperty('--sc', s.color);
      b.innerHTML = `<canvas class="sc-mini" width="96" height="60"></canvas><b>${s.name}</b><small>${has ? (stars ? `★ ${stars}/16` : ABILITIES[s.ability].icon) : s.story ? '📖 historia' : s.earn ? `🏆 ${s.earn.game}` : `💎 ${s.cost}`}</small>`;
      tap(b, () => {
        // segundo toque en la nave que ya ves y es tuya: equiparla sin bajar a buscar el botón
        if (s.id === ui.hangarView && has && save.ship !== s.id) { save.ship = s.id; persist(); fx.vibe(20); toast(`🚀 ${s.name} equipada`); }
        ui.preview = null;
        ui.showHangar(s.id);
      });
      car.appendChild(b);
      // cada nave con SU pintura y SU emblema
      const lk = equipped(save, s.id);
      drawShip(b.querySelector('canvas').getContext('2d'), s.id, { ...lk.palette, edge: lk.palette.edge || s.color },
        48, 34, 34, { yaw: 0.5, pitch: -0.5 }, { line: 1.2, ...emblemOpts(lk) });
    }
    // centrar la nave vista SOLO de lado (scrollIntoView también movía la página hacia arriba)
    const vw = car.querySelector('.viewing');
    if (vw) car.scrollLeft = vw.offsetLeft - (car.clientWidth - vw.offsetWidth) / 2;

    // ficha: barras de esta nave comparadas con la equipada (verde = mejor, rojo = peor)
    const lv = shipLvls(save.shipLvl, view.id);
    const prof = shipProfile(view.id, lv);
    const base = shipProfile(save.ship, shipLvls(save.shipLvl, save.ship));
    const bars = PROFILE_KEYS.map((k) => {
      const d = prof[k] - base[k];
      const diff = inUse || Math.abs(d) < 0.01 ? '' : `<em class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'}</em>`;
      return `<div class="stat"><span>${k}</span><div class="bar"><i style="transform:scaleX(${prof[k].toFixed(3)})"></i>${
        !inUse && d < 0 ? `<u style="left:${(prof[k] * 100).toFixed(1)}%;width:${(-d * 100).toFixed(1)}%"></u>` : ''}</div>${diff}</div>`;
    }).join('');
    let action;
    if (inUse) action = '<button class="btn ghost" disabled>EN USO</button>';
    else if (owned) action = '<button class="btn" id="btnEquip">EQUIPAR</button>';
    else if (view.story) action = '<button class="btn ghost" disabled>📖 Termina la historia LA SEÑAL (Galaxia)</button>';
    else if (view.earn) action = `<button class="btn ghost" disabled>🏆 ${view.earn.text} · ${Math.min(view.earn.of(save), view.earn.n)}/${view.earn.n}</button>`;
    else action = `<button class="btn big" id="btnBuyShip" ${save.gems < view.cost ? 'disabled' : ''}>COMPRAR · 💎 ${view.cost}</button>`;
    $('shipDetail').innerHTML = `
      <div class="sd-head" style="--sc:${view.color}"><div><h3>${shipName(save, view.id) ? `«${shipName(save, view.id)}» <em>${view.name}</em>` : view.name}</h3><small>${view.desc}</small></div>
        ${owned ? `<button class="name-btn" id="btnName" aria-label="Poner nombre">✏️ ${shipName(save, view.id) ? 'Renombrar' : 'Nombre'}</button>` : ''}</div>
      <div class="sd-ability"><span>${ab.icon}</span><div><b>${ab.name}</b> · recarga ${(ab.cd * (lv.c >= 1 ? 0.85 : 1)).toFixed(1)} s<br><small>${ab.desc}</small></div></div>
      <div class="stats">${bars}</div>
      ${action}`;
    $('btnEquip') && tap($('btnEquip'), () => { save.ship = view.id; persist(); fx.vibe(20); ui.showHangar(); });
    $('btnName') && tap($('btnName'), () => {
      const name = typeof prompt === 'function' ? prompt(`Nombre para tu ${view.name} (máx. 14)`, shipName(save, view.id)) : null;
      if (name === null) return;
      const got = setShipName(save, view.id, name);
      persist();
      toast(got ? `🚀 Ahora se llama «${got}»` : 'Nombre borrado');
      ui.showHangar();
    });
    $('btnBuyShip') && tap($('btnBuyShip'), () => {
      if (save.gems < view.cost) return;
      save.gems -= view.cost;
      save.ships.push(view.id);
      save.ship = view.id;
      persist();
      sfx.chest();
      fx.vibe([30, 40, 80]);
      ui.showHangar();
    });

    // árbol de mejoras: 3 ramas x 5 niveles + MAESTRÍA. Tocar un nodo abre su ficha (antes → después)
    const tree = $('shipTree');
    tree.innerHTML = '';
    tree.classList.toggle('locked', !owned);
    const spent = treeSpent(lv);
    tree.append(el('div', 'tree-head', `<b>★ ${treeStars(lv)}/16</b><small>💎 ${fmt(spent)} invertidas en ${view.name}</small>`));
    const cols = el('div', 'tree-cols');
    for (const br of treeOf(view, ab.name, ab.icon)) {
      const col = el('div', `branch b-${br.key}`);
      col.innerHTML = `<h4>${br.icon} ${br.name}</h4>`;
      br.nodes.forEach((n, i) => {
        const bought = lv[br.key] > i, next = lv[br.key] === i;
        const afford = owned && next && save.gems >= n.cost;
        const node = el('button', `node${bought ? ' bought' : ''}${next ? ' next' : ''}${afford ? ' afford' : ''}${i === 2 ? ' mut' : ''}`);
        node.innerHTML = `<small>${i === 2 ? '★ MUTA' : `NIV ${i + 1}`}</small><span>${n.desc}</span><b>${bought ? '✔' : `💎 ${n.cost}`}</b>`;
        tap(node, () => ui.showTreeSheet(view, { branch: br.key, i, name: `${br.icon} ${br.name} · nivel ${i + 1}`, desc: n.desc, cost: n.cost, bought, next, owned }));
        col.append(node);
      });
      cols.append(col);
    }
    tree.append(cols);
    const mOpen = canMaster(lv);
    const mast = el('button', `node mastery${lv.m ? ' bought' : ''}${mOpen ? ' next' : ''}${mOpen && save.gems >= MASTERY_COST ? ' afford' : ''}`,
      `<small>${MASTERY.icon} ${MASTERY.name}</small><span>${lv.m || mOpen ? MASTERY.desc : 'Completa las 3 ramas para abrirla'}</span><b>${lv.m ? '✔' : `💎 ${MASTERY_COST}`}</b>`);
    tap(mast, () => ui.showTreeSheet(view, { branch: 'm', i: 0, name: `${MASTERY.icon} ${MASTERY.name}`, desc: MASTERY.desc, cost: MASTERY_COST, bought: !!lv.m, next: mOpen, owned }));
    tree.append(mast);
    if (owned && spent) {
      const cost = save.treeResets ? RESET_COST : 0;
      const rb = el('button', 'btn ghost tree-reset', `↺ REINICIAR ÁRBOL · ${cost ? `💎 ${cost}` : 'gratis'} <small>(devuelve 💎 ${fmt(spent)})</small>`);
      rb.id = 'btnTreeReset';
      tap(rb, () => {
        if (!rb.dataset.sure) { rb.dataset.sure = '1'; rb.innerHTML = '¿SEGURO? Toca otra vez para reiniciar'; return; }
        if (save.gems + spent < cost) return;
        save.gems += spent - cost;
        save.treeResets = (save.treeResets || 0) + 1;
        save.shipLvl[view.id] = { a: 0, b: 0, c: 0, m: 0 };
        persist();
        toast(`↺ Árbol reiniciado · +${fmt(spent - cost)} 💎`);
        ui.showHangar();
      });
      tree.append(rb);
    }
    if (!owned) tree.insertAdjacentHTML('beforeend', '<p class="tree-lock">Compra la nave para mejorarla</p>');

    // vista 3D: la nave girando (arrastra para girarla)
    ui.startHangarView(view);

    ui.renderStyle(view, owned);

    // GALAXIA: cómo vuela esta nave allí y las mejoras de la nave espacial (con créditos)
    ui.renderGalTab(view);

    ui.updateHangarDots(view, owned);
    for (const panel of $('hangar').querySelectorAll('.tab-panel')) panel.classList.toggle('hidden', panel.dataset.panel !== ui.hangarTab);
    show('hangar');
    // volver a dejarlo todo donde estaba
    if (sameView) {
      $('hangar').scrollTop = keepTop;
      for (const r of $('cosmetics').querySelectorAll('.cos-chips')) if (keepRows[r.dataset.group] !== undefined) r.scrollLeft = keepRows[r.dataset.group];
    }
    // cabecera compacta al bajar (con margen para que no parpadee en el límite)
    if (!$('hangar').dataset.scrollReady) {
      $('hangar').dataset.scrollReady = '1';
      $('hangar').addEventListener('scroll', () => {
        const h = $('hangar'), top = h.scrollTop, hd = h.querySelector('.hangar-top');
        if (top > 60 && !hd.classList.contains('compact')) {
          // lo que encoge la cabecera se reserva abajo: si no, la página deja de desbordar,
          // el navegador la devuelve arriba y la cabecera vuelve a crecer (el "rebote")
          const lost = $('shipCarousel').offsetHeight + Math.max(0, $('hangarView').offsetHeight - 90);
          h.style.setProperty('--hspace', `${lost}px`);
          hd.classList.add('compact');
        } else if (top < 10 && hd.classList.contains('compact')) {
          hd.classList.remove('compact');
          h.style.setProperty('--hspace', '0px');
        }
      }, { passive: true });
    }
  },

  // ESTILO: la lista de personalización de ESTA nave (tocar algo lo prueba o lo equipa; comprar es aparte)
  renderStyle(view, owned) {
    $('cosTitle').textContent = `Personalizar · ${view.name}`;
    const eq = equipped(save, view.id);
    const pv = ui.preview?.ship === view.id ? ui.preview : null;
    const groups = [['palette', '🖌️ Pintura'], ['engine', '🔥 Motor'], ['trail', '✨ Estela'], ['aura', '🌟 Aura'], ['shot', '🔫 Disparo'], ['stripe', '🎨 Diseños'], ['cockpit', '🪟 Cabina'], ['boom', '💥 Explosión'], ['emblem', '🛡️ Emblema']];
    const cosm = $('cosmetics');
    cosm.innerHTML = '';
    // LOOKS: 3 combinaciones guardadas, aleatorio, de serie y copiar a otra nave
    if (owned) {
      const looks = looksOf(save, view.id);
      const swatch = (lk) => { const P = GROUPS.palette.find((x) => x.id === lk.palette) || GROUPS.palette[0]; return `linear-gradient(135deg, ${P.hull} 0 40%, ${P.edge || view.color} 40% 66%, ${P.glow} 66%)`; };
      const box = el('div', 'looks', `<small>💾 LOOKS · toca uno para ponértelo; 💾 guarda ahí el que llevas</small><div class="looks-row">${looks.map((lk, i) => `<div class="look${lk ? '' : ' empty'}"><button class="look-use" data-i="${i}" ${lk ? '' : 'disabled'}><i style="background:${lk ? swatch(lk) : 'none'}"></i>LOOK ${i + 1}</button><button class="look-save" data-i="${i}" aria-label="Guardar el look ${i + 1}">💾</button></div>`).join('')}</div>
        <div class="looks-row tools"><button id="btnLookRnd">🎲 ALEATORIO</button><button id="btnLookReset">↺ DE SERIE</button><button id="btnLookCopy">📋 COPIAR A…</button></div><div id="lookCopyTo" class="looks-row hidden"></div>`);
      for (const b of box.querySelectorAll('.look-use')) tap(b, () => { const sk = applyLook(save, view.id, looks[+b.dataset.i]); persist(); ui.preview = null; fx.vibe(20); toast(sk > 0 ? `👕 Look ${+b.dataset.i + 1} · ${sk} pieza(s) ya no disponibles` : `👕 Look ${+b.dataset.i + 1} puesto`); ui.refreshStyle(); });
      for (const b of box.querySelectorAll('.look-save')) tap(b, () => { saveLook(save, view.id, +b.dataset.i); persist(); fx.vibe([20, 30, 20]); toast(`💾 Guardado en el look ${+b.dataset.i + 1}`); ui.refreshStyle(); });
      tap(box.querySelector('#btnLookRnd'), () => { randomLook(save, view.id); persist(); ui.preview = null; fx.vibe(20); ui.refreshStyle(); });
      tap(box.querySelector('#btnLookReset'), () => { resetLook(save, view.id); persist(); ui.preview = null; fx.vibe(20); ui.refreshStyle(); });
      tap(box.querySelector('#btnLookCopy'), () => {
        const to = box.querySelector('#lookCopyTo'), others = save.ships.filter((id) => id !== view.id);
        to.innerHTML = others.length ? others.map((id) => `<button data-to="${id}">${SHIPS.find((x) => x.id === id).name}</button>`).join('') : '<small>No tienes otra nave</small>';
        to.classList.toggle('hidden');
        for (const b of to.querySelectorAll('button')) tap(b, () => { const sk = copyLook(save, view.id, b.dataset.to); persist(); toast(`📋 Look copiado a ${b.textContent}${sk > 0 ? ` (${sk} pieza(s) no son suyas)` : ''}`); to.classList.add('hidden'); ui.refreshStyle(); });
      });
      cosm.appendChild(box);
    }
    // FILTRO: todo, lo que ya puedes usar o lo que te falta (se recuerda en este dispositivo)
    const filt = cosFilter();
    const seg = el('div', 'seg cos-filter', COS_FILTERS.map(([k, name]) => `<button data-f="${k}" class="${filt === k ? 'on' : ''}">${name}</button>`).join(''));
    for (const b of seg.querySelectorAll('button')) tap(b, () => { cosFilter(b.dataset.f); ui._cosOrder = null; ui.refreshStyle(); });
    cosm.appendChild(seg);
    // ORDEN FIJO mientras estás en esta nave: lo tuyo y luego lo bloqueado. Equipar, probar o comprar
    // no cambia el sitio de nada (así se pueden ir probando una tras otra sin que se muevan)
    const key = `${view.id}|${filt}`;
    if (!ui._styleKeep || !ui._cosOrder || ui._cosOrder.key !== key) {
      ui._cosOrder = { key, g: {} };
      for (const [g] of groups) {
        const all = itemsFor(g, view.id), isOpen = (it) => isUnlocked(it, save, view.id);
        ui._cosOrder.g[g] = all.map((it, k) => [it, k]).sort((x, y) => (isOpen(x[0]) ? 0 : 1) - (isOpen(y[0]) ? 0 : 1) || x[1] - y[1]).map(([it]) => it)
          .filter((it) => filt === 'all' || (filt === 'mine' ? isOpen(it) : !isOpen(it)) || eq[g].id === it.id).map((it) => it.id);
      }
    }
    for (const [g, label] of groups) {
      const all = itemsFor(g, view.id), isOpen = (it) => isUnlocked(it, save, view.id);
      const mine = all.filter(isOpen).length;
      const list = ui._cosOrder.g[g].map((id) => all.find((x) => x.id === id)).filter(Boolean);
      const row = el('div', 'cos-row', `<small>${label} <i class="cos-count">${mine}/${all.length}</i></small>`);
      const chips = el('div', 'cos-chips');
      chips.dataset.group = g;
      for (const it of list) {
        const open = isOpen(it);
        const on = eq[g].id === it.id;
        const trying = !!pv && pv.items?.[g] === it.id;
        let icon = '';
        if (g === 'palette') { // casco (y su segundo color), borde y brillo: las 3 a la vista
          const e = it.edge || view.color;
          const fill = it.alt ? `linear-gradient(135deg, ${it.hull} 0 26%, ${it.alt} 26% 46%, ${e} 46% 68%, ${it.glow} 68%)` : `linear-gradient(135deg, ${it.hull} 0 40%, ${e} 40% 66%, ${it.glow} 66%)`;
          icon = `<i class="sw-pal" style="background:${fill}"></i>`;
        }
        // diseños, cabinas, estelas y explosiones: un mini lienzo con lo que se verá de verdad
        if (g === 'stripe' || g === 'cockpit' || g === 'trail' || g === 'boom' || g === 'aura') icon = `<canvas class="sw-cv" width="88" height="56" data-ic="${g}:${it.id}"></canvas>`;
        if (g === 'engine' || g === 'shot') {
          const c0 = it.color || (g === 'engine' ? eq.basePalette.glow : DEFAULT_SHOT);
          icon = `<i class="sw-${g}" style="--c:${c0}"></i>`;
        }
        if (g === 'emblem') {
          const d = emblemPath(it.id);
          icon = d ? `<svg viewBox="-1.1 -1.1 2.2 2.2"><path d="${d}" fill-rule="evenodd"/></svg>` : '<svg viewBox="-1 -1 2 2"><path d="M-0.6 0H0.6" stroke-width="0.2"/></svg>';
        }
        const tag = on ? 'EQUIPADO' : open ? (owned ? 'usar' : 'probar') : lockText(it, save, view.id);
        const c = el('button', `cos${on ? ' on' : ''}${open ? '' : ' locked'}${trying ? ' trying' : ''}${it.ship ? ' excl' : ''}`,
          `${it.ship ? '<em>EXCLUSIVO</em>' : ''}${icon}<b>${it.name}</b><small>${tag}</small>`);
        c.dataset.cos = `${g}:${it.id}`;
        if (it.ship) c.style.setProperty('--sc', view.color);
        tap(c, () => {
          // lo que ya puedes usar en tu nave se equipa al momento; lo demás se PRUEBA
          // y se pueden PROBAR VARIAS a la vez (una por grupo); tocar otra vez la que pruebas, la quita
          const p = ui.preview?.ship === view.id ? ui.preview : (ui.preview = { ship: view.id, items: {} });
          if (open && owned) {
            equip(g, it.id, save, view.id);
            persist();
            delete p.items[g];
            p.boomShow = g === 'boom';
            fx.vibe(20);
          } else if (p.items[g] === it.id) delete p.items[g];
          else p.items[g] = it.id;
          if (g === 'boom') ui.boomAt = 0; // la explosión se ve al momento
          ui.refreshStyle();
        });
        chips.appendChild(c);
      }
      if (!list.length) chips.appendChild(el('small', 'cos-empty', filt === 'mine' ? 'Aún no tienes ninguno' : '¡Los tienes todos!'));
      row.appendChild(chips);
      cosm.appendChild(row);
      if (g === 'emblem' && owned) {
        const style = el('div', `cos-style${eq.emblem.id === 'none' ? ' off' : ''}`);
        style.innerHTML = `<div class="seg">${EMBLEM_AT.map(([k, name]) => `<button data-at="${k}" class="${eq.emblemAt === k ? 'on' : ''}">${name}</button>`).join('')}</div>
          <div class="swatches">${Object.entries(EMBLEM_COLORS).map(([k, hex]) => `<button data-color="${k}" class="${eq.emblemColor === k ? 'on' : ''}" aria-label="${k}"
            style="background:${hex || `conic-gradient(${eq.palette.glow} 0 50%, ${eq.palette.edge || view.color} 0)`}"></button>`).join('')}</div>`;
        for (const b of style.querySelectorAll('button')) {
          tap(b, () => {
            setEmblemStyle(save, view.id, { at: b.dataset.at, color: b.dataset.color });
            persist();
            fx.vibe(15);
            ui.refreshStyle();
          });
        }
        cosm.appendChild(style);
      }
    }
    paintStyleIcons(cosm, view, eq);
    // barra de prueba: lo que estás probando (puede ser varias cosas), comprar todo o cancelar
    const bar = $('cosPreview');
    const trial = pv ? Object.entries(pv.items || {}).map(([g, id]) => [g, GROUPS[g].find((x) => x.id === id)]).filter(([, it]) => it) : [];
    bar.classList.toggle('hidden', !trial.length);
    bar.innerHTML = '';
    if (trial.length) {
      const buyable = owned ? trial.filter(([, it]) => it.unlock?.gems) : [];
      const cost = buyable.reduce((n, [, it]) => n + it.unlock.gems, 0);
      const locks = trial.filter(([, it]) => !it.unlock?.gems);
      let act = '';
      if (!owned) act = '<small>Compra la nave para personalizarla</small>';
      else if (buyable.length) act = `<button class="btn" id="btnCosBuy" ${save.gems < Math.min(...buyable.map(([, it]) => it.unlock.gems)) ? 'disabled' : ''}>${buyable.length > 1 ? 'COMPRAR TODO' : 'COMPRAR'} · 💎 ${cost}</button>`;
      const why = owned && locks.length ? `<small>🔒 ${locks.map(([, it]) => `${it.name}: ${it.unlock?.stat ? `${lockText(it, save, view.id)} con ${view.name}` : lockText(it)}`).join(' · ')}</small>` : '';
      bar.innerHTML = `<div class="pv-name">PROBANDO: <b>${trial.map(([, it]) => it.name).join(' + ')}</b></div>`
        + (trial.length > 1 ? `<div class="pv-items">${trial.map(([g, it]) => `<button class="pv-x" data-g="${g}">${it.name} ✕</button>`).join('')}</div>` : '')
        + `${act}${why}<button class="btn ghost" id="btnCosCancel">${trial.length > 1 ? 'QUITAR TODO' : 'CANCELAR'}</button>`;
      tap($('btnCosCancel'), () => { ui.preview = null; ui.refreshStyle(); });
      for (const x of bar.querySelectorAll('.pv-x')) tap(x, () => { delete pv.items[x.dataset.g]; ui.refreshStyle(); });
      $('btnCosBuy') && tap($('btnCosBuy'), () => {
        // compra lo que te alcance, en orden; lo demás se sigue probando
        let got = 0;
        for (const [g, it] of buyable) {
          if (!buyCosmetic(it, save, view.id)) continue;
          equip(g, it.id, save, view.id);
          delete pv.items[g];
          got++;
        }
        if (!got) return;
        persist();
        sfx.chest();
        fx.vibe([30, 40, 80]);
        if (!Object.keys(pv.items).length) ui.preview = null;
        ui.refreshStyle();
      });
    }
  },

  // Repintado LIGERO tras tocar algo de ESTILO: solo la lista, la barra de prueba, las gemas, los avisos
  // y la miniatura de la nave. Nada se mueve: ni la página, ni las filas, ni el orden.
  refreshStyle() {
    const view = SHIPS.find((x) => x.id === ui.hangarView) || SHIPS[0], owned = save.ships.includes(view.id);
    const h = $('hangar'), top = h.scrollTop, rows = {};
    for (const r of $('cosmetics').querySelectorAll('.cos-chips')) rows[r.dataset.group] = r.scrollLeft;
    ui._styleKeep = true;
    ui.renderStyle(view, owned);
    ui._styleKeep = false;
    for (const r of $('cosmetics').querySelectorAll('.cos-chips')) if (rows[r.dataset.group] !== undefined) r.scrollLeft = rows[r.dataset.group];
    h.scrollTop = top;
    $('hGems').textContent = fmt(save.gems);
    ui.updateHangarDots(view, owned);
    // la miniatura del carrusel, con el estilo nuevo (sin rehacer el carrusel)
    const chip = $('shipCarousel').querySelector('.ship-chip.viewing canvas');
    if (chip) {
      const c = chip.getContext('2d'), lk = equipped(save, view.id);
      c.clearRect(0, 0, chip.width, chip.height);
      drawShip(c, view.id, { ...lk.palette, edge: lk.palette.edge || view.color }, 48, 34, 34, { yaw: 0.5, pitch: -0.5 }, { line: 1.2, ...emblemOpts(lk) });
    }
  },

  // pestañas: un puntito avisa de que hay algo que ya puedes comprar
  updateHangarDots(view, owned) {
    const lvNow = shipLvls(save.shipLvl, view.id);
    const treeBuy = owned && (['a', 'b', 'c'].some((k) => lvNow[k] < TREE_LEVELS && save.gems >= TREE_COSTS[k][lvNow[k]]) || (canMaster(lvNow) && save.gems >= MASTERY_COST));
    const dots = {
      nave: !owned && save.gems >= view.cost,
      mejoras: treeBuy,
      estilo: owned && ['palette', 'engine', 'trail', 'aura', 'shot', 'stripe', 'cockpit', 'boom', 'emblem'].some((g) => itemsFor(g, view.id).some((it) => it.unlock?.gems && !isUnlocked(it, save, view.id) && save.gems >= it.unlock.gems)),
      galaxia: Object.keys(SP_UP).some((k) => { const c = spUpCost(k, save.galaxy.up[k] || 0); return c !== null && save.galaxy.credits >= c; }),
    };
    for (const b of $('hTabs').querySelectorAll('button')) {
      b.classList.toggle('on', b.dataset.tab === ui.hangarTab);
      b.classList.toggle('dot', !!dots[b.dataset.tab]);
      b.setAttribute('aria-selected', b.dataset.tab === ui.hangarTab);
    }
  },

  renderGalTab(view) {
    const g = save.galaxy;
    const st = galStats(g.up, view.id, g.chassis), cur = galStats(g.up, save.ship, g.chassis);
    const top = {}; // máximo posible de cada stat (todas las naves, todo mejorado)
    const full = Object.fromEntries(Object.keys(SP_UP).map((k) => [k, MAX_UP]));
    for (const sh of SHIPS) { const m = galStats(full, sh.id); for (const [k] of GAL_KEYS) top[k] = Math.max(top[k] || 0, m[k]); }
    const bars = GAL_KEYS.map(([k, label]) => {
      const v = st[k] / top[k], d = (st[k] - cur[k]) / top[k];
      const diff = view.id === save.ship || Math.abs(d) < 0.01 ? '' : `<em class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'}</em>`;
      return `<div class="stat"><span>${label}</span><div class="bar"><i style="transform:scaleX(${v.toFixed(3)})"></i></div>${diff}</div>`;
    }).join('');
    const box = $('galTab');
    box.innerHTML = `<p class="hint">Así vuela <b>${view.name}</b> en la 🌌 Galaxia${view.id === save.ship ? '' : ' (comparada con la equipada)'}. ⚡ Poder ${shipPower().toFixed(1)}: cuanto más fuerte tu nave, más fuertes los piratas.</p>
      <div class="stats">${bars}</div>
      <h3>Nave espacial · 💰 <b id="galCredits">${fmt(g.credits)}</b></h3>
      ${g.started ? '' : '<p class="hint">Aún no has despegado: gana créditos en 🌌 GALAXIA minando y comerciando.</p>'}
      <div id="galUps" class="list"></div>
      <h3>🔧 Equipo fabricado</h3><div id="galGear" class="st-ups"></div>
      <p class="hint">Se fabrica en el taller de las estaciones (Fabricación) con créditos y materiales.</p>`;
    for (const [id, u] of Object.entries(SP_UP)) {
      const lvl = g.up[id] || 0, c = spUpCost(id, lvl);
      const row = el('button', `item${c === null ? ' sel' : g.credits < c ? ' locked' : ''}`);
      row.dataset.up = id;
      row.innerHTML = `<span class="i-icon">${u.icon}</span><span class="i-body"><b>${u.name} · ${lvl >= BASE_UP ? `Mk ${lvl}` : lvl}/${MAX_UP}</b><small>${u.desc}</small></span>
        <span class="i-act">${c === null ? '✔ MAX' : `💰 ${fmt(c)}`}</span>`;
      tap(row, () => {
        if (!buyUpgrade(id)) { fx.vibe(40); return; }
        toast(`${u.icon} ${u.name} nivel ${lvl + 1}`);
        ui.showHangar();
      });
      $('galUps').append(row);
    }
    // reutiliza la lista del taller, pero sin fabricar: solo montar lo que ya tienes
    const gg = $('galGear');
    for (const [id, it] of Object.entries(GEAR)) {
      if (!owns(save, id)) continue;
      const on = gear(save)[it.slot].includes(id);
      const b = el('button', `st-up${on ? ' on' : ''}`, `<span class="su-icon">${it.icon}</span><span class="su-body"><b>${it.name}</b><small>${it.desc}</small></span><span class="su-cost">${on ? '✔' : '＋'}</span>`);
      tap(b, () => { equipGear(save, id); persist(); ui.showHangar(); });
      gg.append(b);
    }
    if (!gg.children.length) gg.innerHTML = '<small>Aún no has fabricado nada.</small>';
  },

  // EXPOSICIÓN: la nave a pantalla completa en una sala con focos; deslizar = otra nave
  showExpo(shipId) {
    G.mode = 'hangar';
    ui._expo = { idx: Math.max(0, SHIPS.findIndex((x) => x.id === shipId)), compare: false, fly: false, mine: false, yaw: 0, shots: [], ...(ui._expo && { compare: ui._expo.compare, fly: ui._expo.fly, mine: ui._expo.mine }) };
    if (!ui._expoReady) {
      ui._expoReady = true;
      // ‹ ›: la nave anterior o siguiente (con SOLO MÍAS, se salta las que no tienes)
      const go = (d) => {
        const e = ui._expo;
        for (let k = 0; k < SHIPS.length; k++) {
          e.idx = (e.idx + d + SHIPS.length) % SHIPS.length;
          if (!e.mine || save.ships.includes(SHIPS[e.idx].id)) break;
        }
        sfx.ui();
        ui.fillExpo();
      };
      tap($('expoPrev'), () => go(-1));
      tap($('expoNext'), () => go(1));
      tap($('expoCompare'), () => { ui._expo.compare = !ui._expo.compare; ui.fillExpo(); });
      tap($('expoFly'), () => { const e = ui._expo; e.fly = !e.fly; e.flyT = 0; e.shots = []; ui._expoParts?.clear(); ui.fillExpo(); });
      tap($('expoMine'), () => { const e = ui._expo; e.mine = !e.mine; if (e.mine && !save.ships.includes(SHIPS[e.idx].id)) go(1); else ui.fillExpo(); });
      // EQUIPAR o COMPRAR desde la propia exposición
      tap($('expoAct'), () => {
        const sh = SHIPS[ui._expo.idx];
        if (save.ships.includes(sh.id)) { if (save.ship === sh.id) return; save.ship = sh.id; persist(); fx.vibe(20); toast(`🚀 ${sh.name} equipada`); }
        else if (!sh.story && !sh.earn && save.gems >= sh.cost) { save.gems -= sh.cost; save.ships.push(sh.id); save.ship = sh.id; persist(); sfx.chest(); fx.vibe([30, 40, 80]); toast(`🚀 ¡${sh.name} es tuya!`); } else return;
        ui.fillExpo();
      });
      ui._expoOrb = { pitch: -0.3 };
      orbitControl($('expoView'), ui._expoOrb);
    }
    show('expo');
    ui.fillExpo();
    ui.startExpoView();
  },

  fillExpo() {
    const e = ui._expo, sh = SHIPS[e.idx], ab = ABILITIES[sh.ability];
    const owned = save.ships.includes(sh.id);
    const nm = shipName(save, sh.id);
    setText('expoName', nm ? `«${nm}»` : sh.name);
    $('expoSub').textContent = `${nm ? `${sh.name} · ` : ''}${ab.icon} ${ab.name}${owned ? '' : ` · 🔒 💎 ${sh.cost}`}`;
    const other = SHIPS.find((x) => x.id === save.ship);
    const cmp = e.compare && other.id !== sh.id ? other : null;
    $('expoCompare').classList.toggle('on', e.compare);
    $('expoFly').classList.toggle('on', e.fly);
    $('expoMine').classList.toggle('on', e.mine);
    const act = $('expoAct');
    act.disabled = false;
    if (owned) { act.textContent = save.ship === sh.id ? 'EN USO' : 'EQUIPAR'; act.disabled = save.ship === sh.id; } else if (sh.story) { act.textContent = '📖 Historia'; act.disabled = true; } else if (sh.earn) { act.textContent = `🏆 ${Math.min(sh.earn.of(save), sh.earn.n)}/${sh.earn.n}`; act.disabled = true; } else { act.textContent = `COMPRAR · 💎 ${sh.cost}`; act.disabled = save.gems < sh.cost; }
    const a = shipProfile(sh.id, shipLvls(save.shipLvl, sh.id));
    const b = cmp && shipProfile(cmp.id, shipLvls(save.shipLvl, cmp.id));
    $('expoStats').innerHTML = (cmp ? `<div class="cmp-head"><b style="color:${sh.color}">${sh.name}</b><span>vs</span><b style="color:${cmp.color}">${cmp.name} (equipada)</b></div>` : '')
      + PROFILE_KEYS.map((k) => `<div class="stat"><span>${k}</span><div class="bar duo"><i style="transform:scaleX(${a[k].toFixed(3)});background:${sh.color}"></i>${
        b ? `<i class="b2" style="transform:scaleX(${b[k].toFixed(3)});background:${cmp.color}"></i>` : ''}</div></div>`).join('')
      + (e.compare && !cmp ? '<p class="hint">Es la que llevas equipada: elige otra para comparar.</p>' : '');
    e.cmp = cmp;
  },

  // EXPO · VUELO: la nave pasa volando sobre una rejilla de neón, esquiva de lado a lado, dispara con
  // SU color, deja SU estela y cada 4 s enseña SU explosión (y vuelve a aparecer)
  drawExpoFlight(c, w, h, dt, now, dpr, parts) {
    const e = ui._expo, sh = SHIPS[e.idx], lk = ui.lookOf(sh.id), pal = lk.palette, edge = pal.edge || sh.color;
    const t = now / 1000;
    e.flyT = (e.flyT || 0) + dt;
    const bg = c.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#05010d'); bg.addColorStop(0.45, '#1a0636'); bg.addColorStop(1, '#05010d');
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    // suelo que corre hacia ti
    const hy = h * 0.36;
    c.strokeStyle = `${sh.color}55`;
    c.lineWidth = dpr;
    for (let i = -12; i <= 12; i++) { c.beginPath(); c.moveTo(w / 2 + i * w * 0.015, hy); c.lineTo(w / 2 + i * w * 0.16, h); c.stroke(); }
    for (let i = 0; i < 10; i++) {
      const k = ((i + (t * 1.6) % 1) / 10) ** 2;
      c.globalAlpha = Math.min(1, k * 3);
      c.beginPath(); c.moveTo(0, hy + (h - hy) * k); c.lineTo(w, hy + (h - hy) * k); c.stroke();
    }
    c.globalAlpha = 1;
    const size = Math.min(w, h) * 0.2 * (ui._expoOrb?.zoom || 1);
    const x = w / 2 + Math.sin(t * 1.3) * w * 0.25, y = h * 0.66;
    const cycle = e.flyT % 4, gone = cycle > 3; // el último segundo de cada 4: explotada
    if (gone && !e.wasGone) boomFx(parts, lk.boom.id, e.lastX ?? x, y, edge, sh.color, 0.55 * dpr); // estalla justo al desaparecer
    e.wasGone = gone;
    if (!gone) {
      e.lastX = x;
      // disparos con el color de la nave
      e.shotT = (e.shotT || 0) - dt;
      if (e.shotT <= 0) { e.shotT = 0.22; e.shots.push({ x, y: y - size * 0.5 }); }
    }
    const shotCol = lk.shot.color || DEFAULT_SHOT;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = shotCol;
    c.lineWidth = 3 * dpr;
    c.shadowColor = shotCol;
    c.shadowBlur = 8 * dpr;
    for (const b of e.shots) { b.y -= dt * h * 1.2; c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x, b.y + 14 * dpr); c.stroke(); }
    c.restore();
    e.shots = e.shots.filter((b) => b.y > -20);
    if (!gone && cycle > 0.15) {
      trailFx(parts, c, lk.trail.id, x, y + size * 0.15, size * 1.3, pal.glow, 80, t);
      auraFx(c, lk.aura.id, x, y, size * 0.85, t);
      drawShip(c, sh.id, { ...pal, edge }, x, y, size, { yaw: 0, pitch: -0.62, roll: -Math.cos(t * 1.3) * 0.3 }, { line: 1.5 * dpr, ...emblemOpts(lk) });
    }
    parts.update(dt);
    parts.draw(c, w, h);
  },

  startExpoView() {
    if (ui._expoRunning) return;
    ui._expoRunning = true;
    let last = performance.now();
    const loop = (now) => {
      const cv = $('expoView');
      if ($('expo').classList.contains('hidden')) { ui._expoRunning = false; return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const e = ui._expo;
      orbitStep(ui._expoOrb, dt, 0.6);
      e.yaw = ui._expoOrb.yaw;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const W = cv.clientWidth || 360, H = cv.clientHeight || 400;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const c = cv.getContext('2d'), w = cv.width, h = cv.height;
      c.setTransform(1, 0, 0, 1, 0, 0);
      // sala: fondo, suelo con rejilla en perspectiva
      const bg = c.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#05010d'); bg.addColorStop(0.62, '#170530'); bg.addColorStop(1, '#05010d');
      c.fillStyle = bg;
      c.fillRect(0, 0, w, h);
      const hy = h * 0.62;
      c.strokeStyle = 'rgba(255,43,214,.25)';
      c.lineWidth = dpr;
      for (let i = -10; i <= 10; i++) { c.beginPath(); c.moveTo(w / 2 + i * w * 0.02, hy); c.lineTo(w / 2 + i * w * 0.2, h); c.stroke(); }
      for (let i = 1; i < 8; i++) { const y = hy + (h - hy) * ((i / 8) ** 1.8); c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      const parts = (ui._expoParts ||= makeParticles());
      if (e.fly) { ui.drawExpoFlight(c, w, h, dt, now, dpr, parts); requestAnimationFrame(loop); return; }
      const ships = e.cmp ? [[SHIPS[e.idx], w * 0.28], [e.cmp, w * 0.72]] : [[SHIPS[e.idx], w / 2]];
      for (const [sh, x] of ships) {
        const lk = ui.lookOf(sh.id), pal = lk.palette, edge = pal.edge || sh.color;
        const size = Math.min(w, h) * (e.cmp ? 0.2 : 0.3) * ui._expoOrb.zoom;
        const py = hy + size * 0.15;
        // foco desde arriba
        const sp = c.createLinearGradient(0, 0, 0, py);
        sp.addColorStop(0, 'rgba(255,255,255,0)'); sp.addColorStop(1, `${sh.color}33`);
        c.fillStyle = sp;
        c.beginPath(); c.moveTo(x - size * 0.15, 0); c.lineTo(x + size * 0.15, 0); c.lineTo(x + size * 1.1, py); c.lineTo(x - size * 1.1, py); c.fill();
        // plataforma giratoria
        c.fillStyle = 'rgba(20,10,40,.9)';
        c.strokeStyle = sh.color;
        c.lineWidth = 2 * dpr;
        c.beginPath(); c.ellipse(x, py, size * 1.05, size * 0.26, 0, 0, Math.PI * 2); c.fill(); c.stroke();
        for (let i = 0; i < 12; i++) {
          const ang = e.yaw * 1.5 + (i / 12) * Math.PI * 2;
          c.fillStyle = i % 3 ? `${sh.color}88` : '#fff';
          c.beginPath(); c.arc(x + Math.cos(ang) * size * 0.95, py + Math.sin(ang) * size * 0.22, 2 * dpr, 0, Math.PI * 2); c.fill();
        }
        const shipY = py - size * 0.95 + Math.sin(now / 700) * size * 0.05;
        const rot = { yaw: e.yaw, pitch: ui._expoOrb.pitch, roll: 0 };
        // reflejo aplastado en el suelo pulido (solo por debajo de la plataforma)
        c.save();
        c.beginPath();
        c.rect(0, py + size * 0.2, w, h);
        c.clip();
        c.globalAlpha = 0.12;
        c.translate(0, py + size * 0.2);
        c.scale(1, -0.35);
        c.translate(0, -(py + size * 0.2));
        drawShip(c, sh.id, { ...pal, edge }, x, shipY, size, rot, { line: 1.5 * dpr });
        c.restore();
        auraFx(c, lk.aura.id, x, shipY, size * 0.85, now / 1000);
        drawShip(c, sh.id, { ...pal, edge }, x, shipY, size, rot, { line: 1.5 * dpr, ...emblemOpts(lk) });
        if (!e.cmp) trailFx(parts, c, lk.trail.id, x, shipY + size * 0.1, size * 1.2, pal.glow, 30, now / 1000);
      }
      parts.update(dt);
      parts.draw(c, w, h);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },

  // Ficha de un nodo del árbol: qué hace y cómo cambian las barras y la habilidad antes de pagar
  showTreeSheet(view, nd) {
    const lv = shipLvls(save.shipLvl, view.id);
    const after = nd.branch === 'm' ? { ...lv, m: 1 } : { ...lv, [nd.branch]: Math.max(lv[nd.branch], nd.i + 1) };
    const p0 = shipProfile(view.id, lv), p1 = shipProfile(view.id, after);
    const A = ABILITIES[view.ability];
    const a0 = newAbility(view.ability, abilityMods(view, lv)), a1 = newAbility(view.ability, abilityMods(view, after));
    const bars = PROFILE_KEYS.map((k) => {
      const d = p1[k] - p0[k];
      return `<div class="stat"><span>${k}</span><div class="bar duo"><i style="transform:scaleX(${p0[k].toFixed(3)})"></i>${
        d > 0.004 ? `<u class="gain" style="left:${(p0[k] * 100).toFixed(1)}%;width:${(d * 100).toFixed(1)}%"></u>` : ''}</div>${d > 0.004 ? '<em class="up">▲</em>' : ''}</div>`;
    }).join('');
    // solo lo que cambia de la habilidad
    const parts = [];
    if (a1.cd < a0.cd - 0.01) parts.push(`recarga ${a0.cd.toFixed(1)} → <b>${a1.cd.toFixed(1)} s</b>`);
    if (a1.dur > a0.dur + 0.01) parts.push(`dura ${a0.dur.toFixed(1)} → <b>${a1.dur.toFixed(1)} s</b>`);
    if (a1.pow > a0.pow + 0.001) parts.push(`potencia ×${a0.pow.toFixed(2)} → <b>×${a1.pow.toFixed(2)}</b>`);
    if (a1.mut && !a0.mut) parts.push('<b>¡MUTA!</b>');
    const abLine = parts.length ? `<p class="ts-ab">${A.icon} ${A.name}: ${parts.join(' · ')}</p>` : '';
    let act;
    if (nd.bought) act = '<button class="btn ghost" disabled>✔ YA LO TIENES</button>';
    else if (!nd.owned) act = '<button class="btn ghost" disabled>Compra la nave primero</button>';
    else if (!nd.next) act = `<button class="btn ghost" disabled>${nd.branch === 'm' ? 'Completa las 3 ramas' : 'Primero el nivel anterior'}</button>`;
    else act = `<button class="btn" id="btnTreeBuy" ${save.gems >= nd.cost ? '' : 'disabled'}>MEJORAR · 💎 ${nd.cost}</button>`;
    const sh = $('treeSheet');
    sh.innerHTML = `<div class="ts-card"><b class="ts-title">${nd.name}</b><p>${nd.desc}</p><div class="stats">${bars}</div>${abLine}
      <div class="ts-act">${act}<button class="btn ghost" id="btnTreeClose">CERRAR</button></div></div>`;
    sh.classList.remove('hidden');
    tap($('btnTreeClose'), () => sh.classList.add('hidden'));
    sh.onclick = (e) => { if (e.target === sh) sh.classList.add('hidden'); }; // tocar fuera cierra
    $('btnTreeBuy') && tap($('btnTreeBuy'), () => {
      if (save.gems < nd.cost) return;
      save.gems -= nd.cost;
      save.shipLvl[view.id] = after;
      persist();
      sfx.chest();
      fx.vibe([20, 30, 60]);
      if (ui._hv) { ui._hv.flash = 1; ui._hv.boost = Math.PI * 2; }
      sh.classList.add('hidden');
      if (nd.branch === 'm') { toast(`★ ¡MAESTRÍA de ${view.name}! Pintura de maestro desbloqueada`); progress('mastery'); }
      ui.showHangar();
      $('shipTree').querySelector(nd.branch === 'm' ? '.mastery' : `.b-${nd.branch} .node:nth-of-type(${nd.i + 1})`)?.classList.add('just');
    });
  },

  showCards(offers, run, title, onPick, reward = '') {
    $('cardsTitle').textContent = title;
    // lo que acabas de ganar en la bifurcación: si no, el overlay lo taparía
    $('cardsReward').textContent = reward;
    $('cardsReward').classList.toggle('hidden', !reward);
    const row = $('cardRow');
    row.innerHTML = '';
    let picked = false;
    offers.forEach((c, i) => {
      const n = cardNode(c, run);
      n.style.animationDelay = `${i * 0.07}s`;
      tap(n, () => {
        if (picked) return;
        picked = true;
        n.classList.add('chosen');
        fx.vibe(30);
        setTimeout(() => onPick(c.id), 220);
      });
      row.appendChild(n);
    });
    $('buildRow').innerHTML = buildSummary(run);
    show('cards');
  },

  showShop(run, onDone) {
    let rerollCost = 10;
    const price = (c) => Math.round({ common: 25, rare: 50, epic: 90 }[c.rarity] * (1 + run.section * 0.1) * (hasTalent(save, 'r4') ? 0.8 : 1));
    const render = (offers) => {
      $('sCoins').textContent = run.coins;
      $('btnReroll').textContent = `RE-TIRAR · 🪙${rerollCost}`;
      // sin cartas disponibles no tiene sentido cobrar por re-tirar
      $('btnReroll').disabled = !availableCards(run).length || run.coins < rerollCost;
      const row = $('shopRow');
      row.innerHTML = '';
      for (const c of offers) {
        if (c.sold) continue;
        const p = price(c);
        const n = cardNode(c, run, `<span class="c-price">🪙 ${p}</span>`);
        if (run.coins < p) n.classList.add('poor');
        tap(n, () => {
          if (run.coins < p) { fx.vibe(60); n.classList.add('shake'); setTimeout(() => n.classList.remove('shake'), 300); return; }
          run.coins -= p;
          c.sold = true;
          pickCard(c.id);
          render(offers);
        });
        row.appendChild(n);
      }
    };
    const fresh = () => offerCards(run, 3).map((c) => ({ ...c }));
    let offers = fresh();
    $('btnReroll').onclick = (e) => {
      e.stopPropagation();
      if (run.coins < rerollCost || !availableCards(run).length) return;
      run.coins -= rerollCost;
      rerollCost += 10;
      sfx.ui();
      offers = fresh();
      render(offers);
    };
    $('btnShopDone').onclick = (e) => { e.stopPropagation(); sfx.ui(); onDone(); };
    render(offers);
    show('shop');
  },

  showChest(res, onDone) {
    const box = $('chestBox'), out = $('chestResult'), ok = $('btnChestOk');
    box.textContent = '🎁';
    box.className = 'shaking';
    out.innerHTML = '';
    ok.classList.add('hidden');
    show('chest');
    setTimeout(() => {
      box.className = 'open';
      box.textContent = res.icon;
      out.innerHTML = `<b>${res.label}</b>`;
      sfx.chest();
      fx.vibe([30, 40, 80]);
      fx.flash('#fff', 0.6);
      for (let i = 0; i < 5; i++) fx.burst(G.W / 2, G.H * 0.4, 20, `hsl(${i * 70},100%,60%)`, 600, 6, 1, 500);
      ok.classList.remove('hidden');
    }, 1100);
    ok.onclick = (e) => { e.stopPropagation(); sfx.ui(); onDone(); };
  },

  showDeath(res) {
    ui.deathAt = performance.now();
    $('dScore').textContent = fmt(res.score);
    $('dNew').classList.toggle('hidden', !res.isBest);
    $('dNew').textContent = '¡NUEVO RÉCORD!';
    const cells = [
      ['Distancia', `${fmt(res.dist)} m`], ['Combo máx.', `x${res.maxMult}`], ['Near-miss', res.near],
      ['Roturas', res.breaks], ['Tramo', res.section], ['Jefes', res.bosses],
    ];
    $('dGrid').innerHTML = cells.map(([k, v]) => `<div><b>${v}</b><small>${k}</small></div>`).join('');
    const modTxt = res.mods?.length ? ` · ${res.mods.map((id) => MOD_BY_ID[id].icon).join('')} x${modGems(res.mods).toFixed(2)}` : '';
    $('dGems').innerHTML = `+${res.gems} 💎${res.banked ? ` · +${res.banked} 🪙` : ''} <small>(total ${fmt(save.gems)})${modTxt}${res.mutationBonus ? ' · 🧬 x1,5' : ''}${prestigeBonus(save) ? ` · ✨ +${Math.round(prestigeBonus(save) * 100)}%` : ''}</small>`;
    // cuánto faltó para el récord: el "casi" es lo que hace darle a reintentar
    $('dExtra').textContent = res.exp ? `EXPEDICIÓN · acto ${res.exp.act + 1} de ${res.exp.total || ACTS.length - 1}, fila ${res.exp.row + 1} de ${ROWS}`
      : res.level ? `NIVEL ${res.level} · la pista es siempre la misma: apréndetela`
      : res.isBest || !res.prevBest ? '' : `te faltaron ${fmt(res.prevBest - res.score)} para tu récord`;
    $('dBuild').innerHTML = buildSummary({ cards: res.cards, synergies: new Set(res.synergies) });
    // XP de la partida y rangos ganados (cada uno con su premio en gemas)
    const ups = res.rankUps.map((u) => `<div class="rank-up">⬆ ¡RANGO ${u.rank}! <b>+${u.gems} 💎</b></div>`).join('');
    const achs = res.achDone.length ? `<div class="rank-up ach">🏆 ${res.achDone.length} logro${res.achDone.length > 1 ? 's' : ''} desbloqueado${res.achDone.length > 1 ? 's' : ''}</div>` : '';
    $('dXp').innerHTML = `<div class="xp-gain">+${fmt(res.xp)} XP</div>${rankHTML(save.xp, res.rankUps.length ? null : res.xpBefore)}${ups}${achs}`;
    $('dMissions').innerHTML = missionsHTML(res.missionsDone ?`MISIONES · ${res.missionsDone} completada${res.missionsDone > 1 ? 's' : ''} en esta partida` : 'MISIONES DE HOY');
    show('death');
  },

  // Mapa de campaña: sectores (se abren con estrellas) y sus niveles con las estrellas ganadas
  showCampaign() {
    G.mode = 'hangar'; // pantalla estática
    G.run = null;
    G.player = null;
    ui.showHUD(false);
    const front = frontier(save);
    $('campStars').textContent = `★ ${totalStars(save)}${front > FIXED_SECTORS ? ` · sector ${front}` : ''}`;
    const map = $('campMap');
    map.innerHTML = '';
    // los sectores abiertos y uno cerrado más: la campaña no se acaba nunca
    for (const sec of visibleSectors(save)) {
      const open = isSectorOpen(save, sec.id);
      const got = sec.levels.reduce((n, l) => n + starCount(starsOf(save, l.id)), 0);
      const box = el('div', `sector${open ? '' : ' locked'}${sec.generated ? ' gen' : ''}`);
      box.dataset.sector = sec.num;
      box.style.setProperty('--bc', BIOMES[sec.biome].accent);
      if (sec.biome2 != null) box.style.setProperty('--bc2', BIOMES[sec.biome2].accent);
      const lockMsg = sec.generated ? `🔒 jefe del ${sec.num - 1}` : `🔒 ${sec.need} ★ para abrir`;
      box.innerHTML = `<div class="sec-top"><b>${sec.generated ? `${sec.num} · ` : ''}${sec.name}</b><small>${open ? `★ ${got}/12` : lockMsg}</small></div>`;
      const row = el('div', 'levels');
      for (const base of sec.levels) {
        const l = levelById(base.id);
        const st = starsOf(save, l.id);
        const can = isLevelOpen(save, l.id);
        const b = el('button', `lvl${can ? '' : ' locked'}${st[0] ? ' done' : ''}${l.boss ? ' boss' : ''}${l.elite ? ' elite' : ''}`);
        b.dataset.level = l.id;
        const mods = (l.mods || []).map((id) => MOD_BY_ID[id].icon).join('');
        b.innerHTML = `<span class="l-id">${can ? l.id : '🔒'}</span><span class="l-ico">${l.boss ? (l.elite ? '☠️ ÉLITE' : '👾 JEFE') : `${l.sections} tramos`}</span>
          ${mods ? `<span class="l-mods">${mods}</span>` : ''}<span class="l-stars">${st.map((x) => (x ? '★' : '☆')).join('')}</span>`;
        if (can) tap(b, () => ui.showLevel(l.id));
        row.append(b);
      }
      box.append(row);
      map.append(box);
    }
    show('campaign');
    ui.showTip('campaign');
  },

  // Ficha del nivel antes de jugar: objetivos de las 3 estrellas
  showLevel(id) {
    const l = levelById(id);
    const st = starsOf(save, id);
    document.querySelector('.lvl-sheet')?.remove();
    const sheet = el('div', 'lvl-sheet');
    sheet.innerHTML = `<h3>NIVEL ${l.id} · ${l.sectorName}</h3>
      <div class="hint">${l.boss ? `${l.elite ? '☠️ Jefe ÉLITE' : '👾 Jefe'}: ${BOSS_BY_ID[l.boss].name}` : `${l.sections} tramos hasta la meta · siempre la misma pista`}</div>
      ${(l.mods || []).length ? `<div class="lvl-mods">${l.mods.map((m) => `<span>${MOD_BY_ID[m].icon} ${MOD_BY_ID[m].name}</span>`).join('')}</div>` : ''}
      <div class="list goals">${l.stars.map((s, i) => `<div class="item${st[i] ? ' sel' : ''}"><span class="i-icon">${st[i] ? '★' : '☆'}</span><span class="i-body"><b>${s.text}</b></span></div>`).join('')}</div>
      <div class="gems">${st[0] ? 'superado' : `primera vez: +${l.gems} 💎`}</div>`;
    const go = el('button', 'btn big', '¡A CORRER!');
    go.id = 'btnLevelGo';
    tap(go, () => { sheet.remove(); newRun({ mode: 'campaign', level: id }); });
    const back = el('button', 'btn ghost', 'CERRAR');
    tap(back, () => sheet.remove());
    sheet.append(go, back);
    $('campaign').append(sheet);
  },

  showVictory(res) {
    const l = levelById(res.level);
    ui.victoryNext = res.next;
    $('vTitle').textContent = res.passed ? '¡NIVEL SUPERADO!' : l.boss ? 'EL JEFE ESCAPÓ' : 'META';
    $('vLevel').textContent = `NIVEL ${l.id} · ${l.sectorName}`;
    $('vStars').innerHTML = res.stars.map((s, i) => `<span class="${s ? 'on' : res.best[i] ? 'had' : ''}" style="animation-delay:${(0.25 + i * 0.3).toFixed(2)}s">★</span>`).join('');
    const hits = res.hits ? `${res.hits} golpe${res.hits > 1 ? 's' : ''}` : 'sin golpes';
    const val = { near: res.near, perfect: res.perfect, coins: res.coins, mult: `x${res.maxMult}`, noHit: hits };
    $('vGoals').innerHTML = l.stars.map((s, i) => `<div class="item${res.stars[i] ? ' sel' : ' locked'}"><span class="i-icon">${res.stars[i] ? '✔' : '✖'}</span>
      <span class="i-body"><b>${s.text}</b>${val[s.kind] != null ? `<small>${val[s.kind]}</small>` : ''}</span>${res.best[i] && !res.stars[i] ? '<span class="i-act">★ ya la tenías</span>' : ''}</div>`).join('');
    $('vGems').innerHTML = (res.gems ? `+${res.gems} 💎 <small>(total ${fmt(save.gems)})</small>` : `<small>★ ${totalStars(save)}</small>`) + (res.banked ? ` · +${res.banked} 🪙` : '');
    const ups = res.rankUps.map((u) => `<div class="rank-up">⬆ ¡RANGO ${u.rank}! <b>+${u.gems} 💎</b></div>`).join('');
    const unl = res.unlocked ? `<div class="rank-up">🔓 ¡Nivel ${res.next} desbloqueado!</div>` : '';
    $('vXp').innerHTML = `<div class="xp-gain">+${fmt(res.xp)} XP</div>${rankHTML(save.xp, res.rankUps.length ? null : res.xpBefore)}${ups}${unl}`;
    $('btnNext').classList.toggle('hidden', !res.next);
    $('btnNext').textContent = res.next ? `SIGUIENTE · ${res.next}` : '';
    if (res.passed) sfx.chest();
    show('victory');
  },

  // ---------- GALAXIA ----------
  showSpaceHUD(on) {
    // un poco después de despegar, y solo si sigues volando (si abriste el mapa, espera al próximo)
    if (on && G.mode === 'galaxy') setTimeout(() => { if (G.mode === 'galaxy') storyIntro(); }, 400);
    $('spaceHud').classList.toggle('hidden', !on);
    if (on) { $('hud').classList.add('hidden'); $('arenaHud').classList.add('hidden'); }
  },

  renderDeck() {
    const box = $('deckList');
    box.innerHTML = '';
    // primero las nuevas que aún no tienes, luego las tuyas
    const order = [...CARDS].sort((x, y) => (cardOwned(save, x) ? 1 : 0) - (cardOwned(save, y) ? 1 : 0));
    for (const c of order) {
      const own = cardOwned(save, c), lv = cardLvl(save, c.id);
      const stars = '★'.repeat(lv) + '☆'.repeat(MAX_CARD_LVL - lv);
      let act;
      if (!own) act = `<button class="btn dk-buy" ${save.gems >= c.cost ? '' : 'disabled'}>DESBLOQUEAR · 💎 ${c.cost}</button>`;
      else if (lv < MAX_CARD_LVL) act = `<button class="btn ghost dk-up" ${save.coins >= CARD_LVL_COST[lv] ? '' : 'disabled'}>MAESTRÍA · 🪙 ${fmt(CARD_LVL_COST[lv])}</button>`;
      else act = '<span class="dk-max">MÁX</span>';
      const row = el('div', `deck-row r-${c.rarity}${own ? '' : ' locked'}`, `<span class="dk-icon">${c.icon}</span>
        <span class="dk-body"><b>${c.name}${c.locked ? ' <em>NUEVA</em>' : ''}</b><small>${c.desc}</small><i>${own ? stars : '🔒'}</i></span>${act}`);
      row.dataset.card = c.id;
      const buy = row.querySelector('.dk-buy'), up = row.querySelector('.dk-up');
      buy && tap(buy, () => { if (buyCard(save, c.id)) { progress('deckCard'); persist(); sfx.chest(); toast(`🃏 ${c.name} ya está en tu mazo`); ui.renderDeck(); } });
      up && tap(up, () => { if (upgradeCard(save, c.id)) { persist(); sfx.coin(4); ui.renderDeck(); } });
      box.append(row);
    }
  },

  // TIENDA: cofres, potenciadores y talentos
  showStore() {
    G.mode = 'hangar';
    ui.storeTab ||= 'crates';
    for (const b of $('stTabs').querySelectorAll('button')) b.classList.toggle('on', b.dataset.tab === ui.storeTab);
    setText('stGems', fmt(save.gems));
    setText('stCoinsW', fmt(save.coins));
    const body = $('storeBody');
    body.innerHTML = '';
    if (ui.storeTab === 'crates') {
      const left = crateStyles(save, save.ship).length;
      body.insertAdjacentHTML('beforeend', `<p class="hint">Estilos para tu ${SHIPS.find((x) => x.id === save.ship).name} que aún no tienes: <b>${left}</b> · nunca salen repetidos.<br>
        Épico garantizado en <b>${PITY - save.crates.pity}</b> cofres como mucho.</p>`);
      for (const [k, C] of Object.entries(CRATES)) {
        const price = C.cost.gems ? `💎 ${C.cost.gems}` : `🪙 ${fmt(C.cost.coins)}`;
        const odds = Object.entries(C.odds).map(([r, p]) => `<i style="color:${RARITIES[r].color}">${RARITIES[r].name} ${Math.round(p * 100)}%</i>`).join(' · ');
        const card = el('div', `crate-card c-${k}`, `<span class="cc-icon">${C.icon}</span><b>${C.name}</b><small>${C.items} objetos · ${odds}</small>
          <button class="btn" data-crate="${k}" ${canAfford(save, k) ? '' : 'disabled'}>ABRIR · ${price}</button>`);
        tap(card.querySelector('button'), () => {
          const got = openCrate(save, k);
          if (!got) return;
          progress('crate');
          persist();
          sfx.chest();
          fx.vibe([30, 40, 80]);
          ui.showCrateOpen(C, got);
        });
        body.append(card);
      }
    } else if (ui.storeTab === 'boosts') {
      body.insertAdjacentHTML('beforeend', `<p class="hint">Marca hasta ${MAX_BOOSTS} para tu próxima partida (Runner, campaña, mutación o expedición). Se gastan al empezar.</p>`);
      for (const [id, B] of Object.entries(BOOSTS)) {
        const n = boostCount(save, id), on = save.boostSel.includes(id);
        const row = el('div', `boost-row${on ? ' on' : ''}`, `<span class="i-icon">${B.icon}</span><span class="i-body"><b>${B.name} <em>x${n}</em></b><small>${B.desc}</small></span>
          <button class="btn ghost bs-use" ${n ? '' : 'disabled'}>${on ? '✔ ACTIVO' : 'USAR'}</button>
          <button class="btn bs-buy" ${save.coins >= B.cost ? '' : 'disabled'}>🪙 ${fmt(B.cost)}</button>`);
        row.dataset.boost = id;
        tap(row.querySelector('.bs-use'), () => { toggleBoost(save, id); persist(); ui.showStore(); });
        tap(row.querySelector('.bs-buy'), () => { if (buyBoost(save, id)) { persist(); sfx.coin(3); toast(`${B.icon} ${B.name} x${boostCount(save, id)}`); ui.showStore(); } });
        body.append(row);
      }
    } else {
      body.insertAdjacentHTML('beforeend', '<p class="hint">Mejoras permanentes, con 🪙. Se compran en orden dentro de cada árbol. Los de la Galaxia están en sus estaciones (con 💰).</p>');
      for (const [tree, T] of Object.entries(TALENTS)) {
        if (T.cur === 'credits') continue;
        const nx = nextTalent(save, tree);
        const col = el('div', 'tal-tree', `<h3>${T.icon} ${T.name}</h3>`);
        T.nodes.forEach((n, i) => {
          const has = hasTalent(save, n.id), next = nx?.id === n.id;
          const node = el('button', `tal-node${has ? ' bought' : ''}${next ? ' next' : ''}${next && wallet(save, T.cur) >= n.cost ? ' afford' : ''}`,
            `<small>${i + 1}</small><b>${n.name}</b><span>${n.desc}</span><em>${has ? '✔' : `${T.cur === 'credits' ? '💰' : '🪙'} ${fmt(n.cost)}`}</em>`);
          node.dataset.talent = n.id;
          tap(node, () => {
            if (!next) return;
            if (!buyTalent(save, n.id)) { fx.vibe(50); return; }
            progress('talent');
            persist();
            sfx.chest();
            toast(`🌟 ${n.name}`);
            ui.showStore();
          });
          col.append(node);
        });
        body.append(col);
      }
      // TALLER DE LA ARENA: mejoras permanentes con 🪙 (5 niveles cada una)
      const shop = el('div', 'tal-tree', '<h3>🛠️ TALLER DE LA ARENA</h3>');
      for (const [id, U] of Object.entries(ARENA_UPS)) {
        const l = arenaUpLvl(save, id), c = arenaUpCost(id, l);
        const node = el('button', `tal-node${c === null ? ' bought' : ' next'}${c !== null && save.coins >= c ? ' afford' : ''}`,
          `<small>${U.icon}</small><b>${U.name} ${'●'.repeat(l)}${'○'.repeat(5 - l)}</b><span>${U.desc(Math.max(1, l + (c === null ? 0 : 1)))}</span><em>${c === null ? 'MÁX' : `🪙 ${fmt(c)}`}</em>`);
        node.dataset.arenaUp = id;
        tap(node, () => {
          if (!buyArenaUp(save, id)) { fx.vibe(50); return; }
          persist();
          sfx.chest();
          toast(`${U.icon} ${U.name} nivel ${l + 1}`);
          ui.showStore();
        });
        shop.append(node);
      }
      body.append(shop);
      // ARSENAL: armas de la Arena que se desbloquean para que te salgan al subir de nivel
      const ars = el('div', 'tal-tree', '<h3>🔱 ARSENAL DE LA ARENA</h3>');
      for (const [id, W] of Object.entries(WEAPONS)) {
        if (!W.locked) continue;
        const has = !!save.arenaWeapons[id];
        const node = el('button', `tal-node${has ? ' bought' : ' next'}${!has && save.gems >= W.cost ? ' afford' : ''}`,
          `<small>${W.icon}</small><b>${W.name}</b><span>${W.desc} · evoluciona en ${EVOLUTIONS[id].name}</span><em>${has ? '✔' : `💎 ${W.cost}`}</em>`);
        node.dataset.weapon = id;
        tap(node, () => {
          if (has) return;
          if (!buyWeapon(save, id)) { fx.vibe(50); return; }
          persist();
          sfx.chest();
          toast(`${W.icon} ${W.name} ya puede salir en la Arena`);
          ui.showStore();
        });
        ars.append(node);
      }
      body.append(ars);
    }
    show('store');
  },

  showCrateOpen(C, items) {
    setText('coTitle', `${C.icon} ${C.name.toUpperCase()}`);
    const box = $('coItems');
    box.innerHTML = '';
    items.forEach((it, i) => {
      const R = RARITIES[it.rarity];
      const icon = it.kind === 'style' ? { palette: '🎨', engine: '🔥', trail: '✨', aura: '🌟', shot: '🔫', boom: '💥', emblem: '🛡️', stripe: '🏁', cockpit: '🪟' }[it.group] : it.kind === 'gems' ? '💎' : it.kind === 'credits' ? '💰' : it.kind === 'card' ? '🃏' : '⚡';
      const c = el('div', `co-item r-${it.rarity}`, `<span>${icon}</span><b>${it.name}</b><small style="color:${R.color}">${R.name}${it.kind === 'style' ? ' · ¡nuevo estilo!' : ''}</small>`);
      c.style.setProperty('--rc', R.color);
      c.style.animationDelay = `${0.15 + i * 0.35}s`;
      box.append(c);
    });
    show('crateOpen');
  },

  // ÓRBITA: el planeta, su historia, la primera visita paga y compra un mineral caro
  showPlanet(idx) {
    ui.showSpaceHUD(false);
    const info = planetOf(idx), g = save.galaxy;
    const first = orbitVisit(idx);
    const n = g.cargo[info.buys] || 0;
    const price = Math.round(stationPrices()[info.buys] * info.mult);
    const pl = G.space.sys.planets[idx];
    $('planetInfo').innerHTML = `
      <div class="pl-globe" style="--c1:${pl.c1};--c2:${pl.c2}">${pl.rings ? '<i></i>' : ''}</div>
      <h3>${info.name}</h3><small class="pl-type">${info.type}</small>
      <p>${info.desc}</p>
      ${first ? `<p class="pl-first">📡 Primer sobrevuelo: +${first} 💰</p>` : ''}
      <div class="pl-trade"><span>${ORES[info.buys].icon} Aquí pagan el <b>${ORES[info.buys].name}</b> a <b>💰 ${price}</b> (×${info.mult})</span>
        <button class="btn" id="btnPlanetSell" ${n ? '' : 'disabled'}>VENDER ${n} · 💰 ${fmt(n * price)}</button></div>
      <button class="btn ghost" id="btnPlanetLeave">🚀 SALIR DE ÓRBITA</button>`;
    tap($('btnPlanetSell'), () => { const got = planetSell(idx); if (got) { toast(`+${fmt(got)} 💰`); ui.showPlanet(idx); } });
    tap($('btnPlanetLeave'), () => leaveOrbit());
    show('planet');
  },

  // joystick visible donde apoyas el dedo (Galaxia)
  stickVis(x, y, dx = 0, dy = 0) {
    const v = $('stickVis');
    if (x === undefined) { v.classList.add('hidden'); return; }
    if (x !== null) { v.style.left = `${x}px`; v.style.top = `${y}px`; v.classList.remove('hidden'); }
    const d = Math.hypot(dx, dy), k = d > 60 ? 60 / d : 1;
    v.firstElementChild.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  },

  updateSpaceHUD() {
    const s = G.space;
    const hud = $h('spaceHud');
    if (!s || hud.classList.contains('hidden')) return;
    const st = spaceStats(), g = save.galaxy;
    const bars = ui._shBars ||= { shield: hud.querySelector('.sh-bar.shield i'), hull: hud.querySelector('.sh-bar.hull i'), cargo: hud.querySelector('.sh-bar.cargo i'), heat: hud.querySelector('.sh-bar.heat i') };
    setTf(bars.shield, `scaleX(${(s.ship.shield / st.shield).toFixed(3)})`);
    setTf(bars.hull, `scaleX(${Math.max(0, s.ship.hull / st.hull).toFixed(3)})`);
    const n = cargoCount(g.cargo);
    setTf(bars.cargo, `scaleX(${Math.min(1, n / st.cargo).toFixed(3)})`);
    setText('shCargo', `${n}/${st.cargo}`);
    setText('shCredits', fmt(g.credits));
    const thr = Math.round((s.ship.throttle ?? 1) * 100);
    const thrEl = $h('throttle');
    if (document.activeElement !== thrEl && thrEl._v !== thr) { thrEl._v = thr; thrEl.value = thr; }
    setText('thrVal', thr === 0 ? 'PARADO' : thr < 0 ? `◀ ${-thr}%` : `${thr}%`);
    tgl($h('throttleBox'), 'rev', thr < 0);
    tgl($h('throttleBox'), 'stop', thr === 0);
    // misiles (si tienes la mejora) y botón de contexto (COMERCIAR / ORBITAR)
    const hasMis = (g.up.missile || 0) > 0;
    tgl($h('btnMissile'), 'hidden', !hasMis);
    if (hasMis) {
      setText('shMis', String(g.missiles || 0));
      tgl($h('btnMissile'), 'lock', !!s.lock?.locked);
    }
    tgl($h('btnAct'), 'hidden', !s.act);
    if (s.act) setText('btnAct', s.act.label);
    setText('shObjective', s.objective ? `▸ ${s.objective.text}` : '');
    const sd = GAL[s.sysId];
    const tt = sd.pirates || s.owner === 'pir' ? threatTier(threat()) : 0;
    setText('shSystem', `${sd.name} ${'☠'.repeat(sd.danger)}${tt ? ` ${'▲'.repeat(tt)}` : ''}`);
    const ws = wantedStars(g);
    setText('shWanted', ws ? '⭐'.repeat(ws) : '');
    setTf(bars.heat, `scaleX(${Math.min(1, s.heat).toFixed(3)})`);
    tgl(bars.heat.parentElement, 'over', !!s.overheat);
    tgl($h('btnDock'), 'hidden', !s.canDock);
    tgl($h('btnBoost'), 'cool', s.ship.boostCd > 0);
    tgl($h('shHint'), 'hidden', s.t > 8 || tipSeen(save, 'galaxy'));
  },

  // Estación: mercado, taller y reparación, todo en una pantalla
  showStation(s) {
    ui.showSpaceHUD(false); // atracado: solo la estación
    const g = save.galaxy, st = spaceStats();
    const sd = GAL[s.sysId];
    ui.showTip('dock');
    setText('stTitle', s.atOutpost && s.outpost ? `🏗️ ${s.outpost.name}` : `🛰️ ESTACIÓN ${sd.name}`);
    ui.renderOutpost(s);
    setText('stCredits', fmt(g.credits));
    setText('stShip', shipName(save, save.ship) ? `· 🚀 «${shipName(save, save.ship)}»` : '');
    const items = Object.entries(g.cargo).filter(([, n]) => n > 0);
    const drop = (k) => Math.round((1 - priceFactor(saturation(save, s.sysId, k))) * 100);
    $('stCargo').innerHTML = items.length
      ? items.map(([k, n]) => `<div><span>${ORES[k].icon} ${ORES[k].name}${drop(k) ? ` <em class="sat">📉 −${drop(k)}%</em>` : ''}</span><b>${n} × ~${marketPrice(k, s.sysId)} = ${fmt(marketValue(k, n, s.sysId))} 💰</b></div>`).join('')
        + '<small class="hint">Cuanto más vendes de lo mismo aquí, menos lo pagan; se recupera mientras vuelas. Comerciar entre sistemas paga más.</small>'
      : '<small>Bodega vacía. Mina asteroides y vuelve a vender.</small>';
    $('btnSell').disabled = !items.length;
    // COMERCIO: aquí se vende barato el mineral local; en otros sistemas lo pagan más
    const local = sd.ore, bp = buyPrice(local, s.sysId);
    const best = GAL.filter((x) => x.id !== sd.id && g.visited.includes(x.id)).sort((a, b) => b.prices[local] - a.prices[local])[0];
    $('stBuy').innerHTML = `<small>Comercio: ${ORES[local].icon} ${ORES[local].name} a ${bp} 💰${best ? ` · en ${best.name} lo pagan a ${best.prices[local]}` : ''}</small>`;
    const bb = el('button', 'btn ghost', `COMPRAR 5 ${ORES[local].icon} · ${bp * 5} 💰`);
    bb.id = 'btnBuyOre';
    bb.disabled = g.credits < bp || cargoCount(g.cargo) >= st.cargo;
    tap(bb, () => { buyOre(local, 5); ui.showStation(s); });
    $('stBuy').append(bb);
    const box = $('stUpgrades');
    box.innerHTML = '';
    for (const [id, u] of Object.entries(SP_UP)) {
      const lvl = g.up[id] || 0, c = stationUpCost(id, lvl);
      const mats = upgradeMats(lvl), okM = Object.entries(mats).every(([k, n]) => matOf(save, k) >= n);
      const b = el('button', `st-up${c !== null && g.credits >= c && okM ? ' afford' : ''}`, `<span class="su-icon">${u.icon}</span>
        <span class="su-body"><b>${u.name}${lvl >= BASE_UP ? ` <em class="mk">Mk ${Math.min(lvl + 1, MAX_UP)}</em>` : ''}</b><small>${u.desc}</small><i>${ui.upDots(lvl)}</i>${c !== null && lvl >= BASE_UP ? `<small class="cr-cost">+ ${ui.costText(mats)}</small>` : ''}</span>
        <span class="su-cost">${c === null ? 'MÁX' : `${fmt(c)} 💰`}</span>`);
      b.dataset.up = id;
      b.disabled = c === null;
      tap(b, () => {
        if (!buyUpgrade(id)) { b.classList.add('shake'); fx.vibe(50); setTimeout(() => b.classList.remove('shake'), 300); return; }
        fx.vibe([20, 30, 60]);
        ui.showStation(s);
      });
      box.append(b);
    }
    // ASTILLERO: chasis espaciales
    const yard = $('stShipyard');
    yard.innerHTML = '';
    for (const [id, c] of Object.entries(CHASSIS)) {
      const own = g.hulls.includes(id), cur = g.chassis === id;
      if (c.story && !own) { yard.append(el('div', 'st-up locked', `<span class="su-icon">${c.icon}</span><span class="su-body"><b>${c.name}</b><small>${c.desc}</small></span><span class="su-cost">📖 Acto III</span>`)); continue; }
      const mm = Object.entries(c.mult).map(([k, v]) => `${{ speed: 'velocidad', turn: 'giro', hull: 'casco', shield: 'escudo', cargo: 'bodega', dmg: 'daño' }[k]} ${v > 1 ? '+' : ''}${Math.round((v - 1) * 100)}%`).join(' · ');
      const b = el('button', `st-up${cur ? ' on' : !own && g.credits >= c.cost ? ' afford' : ''}`, `<span class="su-icon">${c.icon}</span>
        <span class="su-body"><b>${c.name} <em>🔫${c.slots.w} ⚙️${c.slots.m}</em></b><small>${c.desc}</small>${mm ? `<small class="cr-cost">${mm}</small>` : ''}</span>
        <span class="su-cost">${cur ? 'EN USO' : own ? 'USAR' : `${fmt(c.cost)} 💰`}</span>`);
      b.dataset.chassis = id;
      b.disabled = cur;
      tap(b, () => {
        if (own ? useChassis(id) : buyChassis(id)) { toast(`${c.icon} ${c.name}${own ? '' : ' comprado'}`); ui.showStation(s); } else fx.vibe(50);
      });
      yard.append(b);
    }
    ui.renderCraft(() => ui.showStation(s));
    // SUMINISTROS: recargar misiles (de pago) y consumibles de vuelo
    const sup = $('stSupplies');
    sup.innerHTML = '';
    if (g.up.missile) {
      const mc = missileRefillCost();
      const b = el('button', `st-up${mc && g.credits >= mc ? ' afford' : ''}`, `<span class="su-icon">🚀</span><span class="su-body"><b>Recargar misiles</b><small>${g.missiles || 0}/${missileMax()} a bordo</small></span><span class="su-cost">${mc ? `${fmt(mc)} 💰` : 'LLENO'}</span>`);
      b.id = 'btnRefill';
      b.disabled = !mc;
      tap(b, () => { if (refillMissiles()) ui.showStation(s); });
      sup.append(b);
    }
    for (const id of ITEM_KEYS) {
      const it = ITEMS[id], n = itemCount(save, id), c = Math.round(it.cost * itemDisc());
      const b = el('button', `st-up${n < ITEM_MAX && g.credits >= c ? ' afford' : ''}`, `<span class="su-icon">${it.icon}</span><span class="su-body"><b>${it.name} <em>×${n}/${ITEM_MAX}</em></b><small>${it.desc}</small></span><span class="su-cost">${n >= ITEM_MAX ? 'MÁX' : `${fmt(c)} 💰`}</span>`);
      b.dataset.item = id;
      b.disabled = n >= ITEM_MAX;
      tap(b, () => { if (buyItem(save, id, itemDisc())) { persist(); sfx.coin(3); ui.showStation(s); } else fx.vibe(40); });
      sup.append(b);
    }
    // SOBORNO: −1 ⭐ de búsqueda
    if (wantedStars(g)) {
      const c = bribeCost(g, threat());
      const b = el('button', `st-up${g.credits >= c ? ' afford' : ''}`, `<span class="su-icon">🚨</span><span class="su-body"><b>Sobornar <em>${'⭐'.repeat(wantedStars(g))}</em></b><small>Te buscan: con ⭐⭐ o más te esperan cazadores. Esto quita una estrella.</small></span><span class="su-cost">${fmt(c)} 💰</span>`);
      b.id = 'btnBribe';
      tap(b, () => { if (bribeWanted()) { toast('🚨 Una estrella menos'); sfx.coin(2); ui.showStation(s); } else fx.vibe(40); });
      sup.append(b);
    }
    // TALENTOS DE LA GALAXIA (con créditos)
    const tb = $('stTalents');
    tb.innerHTML = '';
    const GT = TALENTS.galaxy, gnx = nextTalent(save, 'galaxy');
    GT.nodes.forEach((n, i) => {
      const has = hasTalent(save, n.id), next = gnx?.id === n.id;
      const node = el('button', `tal-node${has ? ' bought' : ''}${next ? ' next' : ''}${next && g.credits >= n.cost ? ' afford' : ''}`,
        `<small>${i + 1}</small><b>${n.name}</b><span>${n.desc}</span><em>${has ? '✔' : `💰 ${fmt(n.cost)}`}</em>`);
      node.dataset.talent = n.id;
      tap(node, () => {
        if (!next) return;
        if (!buyTalent(save, n.id)) { fx.vibe(50); return; }
        progress('talent');
        persist();
        sfx.chest();
        toast(`🌟 ${n.name}`);
        ui.showStation(s);
      });
      tb.append(node);
    });
    // FACCIÓN de la estación: reputación, ventajas y su tienda (con créditos)
    const own = sysOwner(s.sysId), F = FACTIONS[own], rp = repOf(save, own), lvR = repLevel(rp);
    const fb = $('stFaction');
    fb.innerHTML = `<h3>${F.icon} ${F.name}</h3><small>${F.desc}</small>
      <div class="rep"><div class="m-bar"><i style="transform:scaleX(${((rp + 100) / 200).toFixed(3)});background:${F.color}"></i></div><b>${lvR.name} · ${rp}</b></div>
      <small>${lvR.sell > 1 ? `Te pagan el mineral un ${Math.round((lvR.sell - 1) * 100)}% más · taller y reparación −${Math.round((1 - lvR.disc) * 100)}%` : 'Sube la reputación con sus misiones y cazando piratas: Amigo (20) y Aliado (60) tienen ventajas.'}</small>`;
    for (const it of FACTION_SHOP.filter((x) => x.faction === own)) {
      const item = GROUPS.palette.find((x) => x.id === it.id) || GROUPS.engine.find((x) => x.id === it.id);
      const has = (save.crates.owned || []).includes(it.id), okLvl = lvlAtLeast(rp, it.minLvl);
      const b = el('button', `st-up${!has && okLvl && g.credits >= it.cost ? ' afford' : ''}`, `<span class="su-icon">${item.hull ? '🎨' : '🔥'}</span>
        <span class="su-body"><b>${item.name}</b><small>${item.hull ? 'Pintura' : 'Motor'} de la facción · para todas tus naves</small></span>
        <span class="su-cost">${has ? '✔' : okLvl ? `${fmt(it.cost)} 💰` : `🔒 ${it.minLvl === 'amigo' ? 'Amigo' : 'Aliado'}`}</span>`);
      b.dataset.fshop = it.id;
      b.disabled = has || !okLvl;
      tap(b, () => { if (buyFactionItem(it)) { toast(`🎨 ${item.name} desbloqueado`); ui.showStation(s); } });
      fb.append(b);
    }
    // SE BUSCA: piratas con nombre; uno activo a la vez
    const bBox = $('stBounties');
    bBox.innerHTML = '';
    const act = save.bounties.active;
    if (act) {
      const row = el('div', 'st-mis active', `<span>🎯</span><div><b>${act.name} · nivel ${act.level}</b><small>${TRAITS[act.trait].icon} ${TRAITS[act.trait].name} · visto en ${GAL[act.sys].name} · +${fmt(act.reward)} 💰</small></div>`);
      const x = el('button', 'btn ghost', '✕');
      tap(x, () => { abandonBounty(); ui.showStation(s); });
      row.append(x);
      bBox.append(row);
    } else {
      for (const b of bountyBoardNow(s)) {
        const row = el('div', 'st-mis', `<span>🎯</span><div><b>${b.name} · nivel ${b.level}</b><small>${TRAITS[b.trait].icon} ${TRAITS[b.trait].desc} · en ${GAL[b.sys].name} · +${fmt(b.reward)} 💰</small></div>`);
        const ok = el('button', 'btn', 'CAZAR');
        ok.dataset.bounty = b.id;
        tap(ok, () => { acceptBounty(b); ui.showStation(s); });
        row.append(ok);
        bBox.append(row);
      }
    }
    // TABLÓN: misiones activas (con su progreso) y ofertas de esta estación
    const mBox = $('stMissions');
    mBox.innerHTML = '';
    for (const m of g.missions) {
      const row = el('div', 'st-mis active', `<span>${MISSION_KINDS[m.kind].icon}</span><div><b>${m.text}</b><small>${m.n > 1 ? `${m.progress}/${m.n} · ` : ''}+${m.reward} 💰</small></div>`);
      const x = el('button', 'btn ghost', '✕');
      x.title = 'Abandonar';
      tap(x, () => { abandonMission(m.id); ui.showStation(s); });
      row.append(x);
      mBox.append(row);
    }
    for (const m of boardNow(s)) {
      const row = el('div', 'st-mis', `<span>${MISSION_KINDS[m.kind].icon}</span><div><b>${m.text}</b><small>+${m.reward} 💰</small></div>`);
      const ok = el('button', 'btn', 'ACEPTAR');
      ok.disabled = g.missions.length >= MAX_ACTIVE;
      ok.dataset.mission = m.kind;
      tap(ok, () => { acceptMission(m); ui.showStation(s); });
      row.append(ok);
      mBox.append(row);
    }
    if (!mBox.children.length) mBox.innerHTML = '<small>No hay encargos ahora mismo. Vuelve más tarde.</small>';
    const rc = repairCost(s.ship.hull, st.hull);
    $('stRepairBox').classList.toggle('hidden', !rc);
    $('btnRepair').textContent = `REPARAR · ${rc} 💰`;
    $('btnRepair').disabled = g.credits < rc;
    show('station');
  },

  // PUESTO AVANZADO: fundarlo (en un sistema liberado) o ampliarlo con módulos
  renderOutpost(s) {
    const box = $('stOutpost'), g = save.galaxy, o = outpostAt(save, s.sysId);
    box.innerHTML = '';
    if (!o) {
      if (!canFound(save, s.sysId)) { box.classList.add('hidden'); return; }
      box.classList.remove('hidden');
      box.innerHTML = '<h3>🏗️ Puesto avanzado</h3><small>Este sistema es tuyo: funda aquí tu propia estación y amplíala con módulos.</small>';
      const b = el('button', `btn${g.credits >= FOUND_COST ? '' : ' ghost'}`, `FUNDAR · ${fmt(FOUND_COST)} 💰`);
      b.id = 'btnFound';
      b.disabled = g.credits < FOUND_COST;
      tap(b, () => { if (foundOutpost()) { toast('🏗️ ¡Puesto avanzado fundado!'); ui.showStation(s); } });
      box.append(b);
      return;
    }
    box.classList.remove('hidden');
    box.innerHTML = `<h3>🏗️ ${o.name}</h3><small>Tu puesto en este sistema. Atraca en él (estructura verde) o aquí mismo para gestionarlo.</small>`;
    for (const id of MOD_KEYS) {
      const M = MODULES[id], l = modLvl(save, s.sysId, id), c = modCost(save, s.sysId, id);
      const b = el('button', `st-up${c && g.credits >= c ? ' afford' : ''}${l ? ' on' : ''}`, `<span class="su-icon">${M.icon}</span>
        <span class="su-body"><b>${M.name} <em>${l}/${MOD_MAX}</em></b><small>${l && l < MOD_MAX ? 'Siguiente: ' : ''}${M.desc(Math.min(MOD_MAX, l + 1))}</small></span>
        <span class="su-cost">${c ? `${fmt(c)} 💰` : 'MÁX'}</span>`);
      b.dataset.module = id;
      b.disabled = !c;
      tap(b, () => {
        if (!upgradeModule(save, s.sysId, id)) { fx.vibe(40); return; }
        progress('outpostLvl', Object.values(outpostAt(save, s.sysId).mods).reduce((a, n) => a + n, 0));
        persist();
        sfx.chest();
        toast(`${M.icon} ${M.name} nivel ${l + 1}`);
        ui.showStation(s);
      });
      box.append(b);
    }
    const cap = storeCap(save, s.sysId);
    if (cap) {
      const row = el('div', 'op-store', `<small>📦 Almacén: ${storeUsed(o)}/${cap}</small>`);
      const dep = el('button', 'btn ghost', 'GUARDAR TODO');
      dep.id = 'btnDeposit';
      tap(dep, () => { const n = depositAll(save, s.sysId); persist(); toast(n ? `📦 ${n} guardados` : 'Nada que guardar (o lleno)'); ui.showStation(s); });
      const wd = el('button', 'btn ghost', 'SACAR');
      wd.id = 'btnWithdraw';
      tap(wd, () => { const n = withdrawAll(save, s.sysId, spaceStats().cargo - cargoCount(save.galaxy.cargo)); persist(); toast(n ? `📦 ${n} sacados` : 'Nada que sacar'); ui.showStation(s); });
      row.append(dep, wd);
      box.append(row);
    }
  },

  // texto de un coste { credits, chatarra… }
  costText(c) {
    return Object.entries(c).map(([k, n]) => (k === 'credits' ? `${fmt(n)} 💰` : `${n} ${MATS[k].icon}`)).join(' · ');
  },
  // puntos de nivel de una mejora: ● normales, ◆ los Mk 6-10
  upDots(lvl) {
    return Array.from({ length: MAX_UP }, (_, i) => (i < BASE_UP ? (i < lvl ? '●' : '○') : `<b class="mk${i < lvl ? ' on' : ''}">◆</b>`)).join('');
  },

  // TALLER de fabricación: materiales, huecos montados y recetas (créditos + materiales)
  renderCraft(again) {
    const g = gear(save);
    const disc = G.space ? workshopDisc(save, G.space.sysId) : 1; // Taller de tu puesto
    $('stMats').innerHTML = Object.entries(MATS).map(([k, m]) => `<span title="${m.desc}">${m.icon} <b>${matOf(save, k)}</b> <small>${m.name}</small></span>`).join('');
    const slotHtml = (slot, label) => Array.from({ length: slotsOf(save)[slot] }, (_, i) => {
      const id = g[slot][i];
      return `<span class="slot${id ? ' full' : ''}">${id ? `${GEAR[id].icon} ${GEAR[id].name}` : `${label} libre`}</span>`;
    }).join('');
    $('stSlots').innerHTML = `<div><small>ARMAS</small>${slotHtml('w', '🔫')}</div><div><small>MÓDULOS</small>${slotHtml('m', '⚙️')}</div>`;
    const box = $('stCraft');
    box.innerHTML = '';
    for (const [id, it] of Object.entries(GEAR)) {
      const has = owns(save, id), on = g[it.slot].includes(id);
      const cost = ui.costText(Object.fromEntries(Object.entries(it.cost).map(([k, n]) => [k, k === 'credits' ? Math.round(n * disc) : n])));
      const b = el('button', `st-up${!has && canCraft(save, id, disc) ? ' afford' : ''}${on ? ' on' : ''}`, `<span class="su-icon">${it.icon}</span>
        <span class="su-body"><b>${it.name} <em>${it.slot === 'w' ? 'arma' : 'módulo'}</em></b><small>${it.desc}</small><small class="cr-cost">${has ? (on ? '✔ MONTADO · toca para quitar' : 'fabricado · toca para montar') : cost}</small></span>
        <span class="su-cost">${has ? (on ? '✔' : '＋') : 'FABRICAR'}</span>`);
      b.dataset.gear = id;
      // NIVELES del equipo fabricado (1-5)
      if (has) {
        const lv = gearLvl(save, id), uc = gearUpCost(id, lv);
        const ucd = uc && Object.fromEntries(Object.entries(uc).map(([k, n]) => [k, k === 'credits' ? Math.round(n * disc) : n]));
        const up = el('span', `gear-up${uc && canUpgradeGear(save, id, disc) ? ' afford' : ''}`, `Nv ${lv}/${GEAR_MAX}${uc ? ` · ⬆ ${ui.costText(ucd)}` : ' · MÁX'}`);
        up.dataset.gearUp = id;
        if (uc) tap(up, () => { if (upgradeGear(save, id, disc)) { persist(); sfx.chest(); toast(`${it.icon} ${it.name} nivel ${lv + 1}`); again(); } else fx.vibe(40); });
        b.querySelector('.su-body').append(up);
      }
      tap(b, () => {
        if (has) { equipGear(save, id); persist(); again(); return; }
        if (!craft(save, id, disc)) { b.classList.add('shake'); fx.vibe(50); setTimeout(() => b.classList.remove('shake'), 300); return; }
        persist();
        sfx.chest();
        progress('craft');
        toast(`${it.icon} ${it.name} fabricado y montado`);
        again();
      });
      box.append(b);
    }
  },

  // DIÁLOGO de la historia: líneas con quién habla; la última puede tener una elección
  // opts.pause: congela la partida mientras se lee (y la reanuda al cerrar); opts.onClose
  showDialog(lines, choice = null, opts = {}) {
    if (!lines?.length) return;
    const box = $('dialog');
    let i = 0;
    // PAUSA mientras se lee (la GUÍA y la historia): no depende de G.mode, que otras partes del juego
    // cambian solas (acabar un salto, elegir carta…). En los tests (?debug) solo con ?tips.
    const pauses = opts.pause !== false && (!G.debug || new URLSearchParams(location.search).has('tips'));
    if (pauses) { G.dialogPause = true; musicDuck(true); }
    const close = () => {
      box.classList.add('hidden');
      if (pauses) {
        G.dialogPause = false;
        if (['play', 'galaxy', 'arena'].includes(G.mode)) musicDuck(false);
      }
      opts.onClose?.();
    };
    const draw = () => {
      const [who, text] = lines[i], c = CAST[who];
      setText('dlIcon', c.icon);
      setText('dlName', c.name);
      $('dlName').style.color = c.color;
      setText('dlText', text);
      const acts = $('dlActs');
      acts.innerHTML = '';
      const last = i === lines.length - 1;
      if (last && choice) {
        for (const [pick, label] of choice) {
          const b = el('button', 'btn', label);
          b.dataset.pick = pick;
          tap(b, () => { close(); storyChoose(pick); });
          acts.append(b);
        }
      } else {
        const b = el('button', 'btn', last ? 'ENTENDIDO' : 'SIGUIENTE ▸');
        b.id = 'btnDialog';
        tap(b, () => { if (last) close(); else { i++; draw(); } });
        acts.append(b);
      }
    };
    box.classList.remove('hidden');
    draw();
  },

  // PRIMEROS PASOS: un consejo de la GUÍA la primera vez que pasa algo (pausa la partida mientras
  // se lee). En los tests (?debug) no salen, salvo con ?tips: no estorban a los bots.
  showTip(id, onClose = null) {
    if (!TIPS[id] || tipSeen(save, id)) return false;
    if (G.debug && !new URLSearchParams(location.search).has('tips')) return false;
    markTip(save, id);
    persist();
    ui.showDialog(TIPS[id], null, { onClose });
    return true;
  },

  // ATLAS: lo descubierto, con su historia, y las mejoras únicas que da explorar
  showAtlas() {
    const pois = allPois(GAL);
    const n = atlasCount();
    setText('atCount', `📖 ${n} / ${pois.length} descubiertos`);
    // HISTORIA: capítulos de LA SEÑAL
    const chs = chapters(GAL), cur = storyState(save).ch;
    $('atStory').innerHTML = `<h3>📡 LA SEÑAL · ${Math.min(cur, chs.length)}/${chs.length}</h3>` + chs.map((c, i) => `<div class="${i < cur ? 'done' : i === cur ? 'now' : 'locked'}">
      <b>${i < cur ? '✔' : i === cur ? '▸' : '🔒'} ${i + 1}. ${i <= cur ? c.title : '???'}</b>${i === cur ? `<small>${c.goal.text}</small>` : ''}</div>`).join('');
    $('atPerks').innerHTML = ATLAS_PERKS.map((pk) => `<div class="${n >= pk.n ? 'on' : ''}"><b>${n >= pk.n ? '✨' : '🔒'} ${pk.name}</b><small>${pk.desc} · ${pk.n} descubrimientos</small></div>`).join('');
    const found = pois.filter((p) => save.galaxyAtlas[p.id]);
    $('atList').innerHTML = found.length
      ? found.map((p) => `<div class="item"><span class="i-icon">${POI_KINDS[p.kind].icon}</span><span class="i-body"><b>${POI_KINDS[p.kind].name} · ${GAL[p.sys].name}</b><small>${p.lore}</small></span></div>`).join('')
      : '<small>Aún no has descubierto nada. Busca los marcadores en cada sistema y vuela cerca para escanearlos.</small>';
    show('atlas');
  },

  // 🧰 barra de consumibles (en vuelo): toca para usar; teclas 1-5
  renderItemBar() {
    const bar = $('itemBar');
    if (bar.classList.contains('hidden')) return;
    bar.innerHTML = '';
    ITEM_KEYS.forEach((id, i) => {
      const n = itemCount(save, id);
      const b = el('button', `ib${n ? '' : ' empty'}`, `<span>${ITEMS[id].icon}</span><b>${n}</b><small>${i + 1}</small>`);
      b.dataset.use = id;
      b.title = ITEMS[id].name;
      b.disabled = !n;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (useItem(id)) ui.renderItemBar(); });
      bar.append(b);
    });
  },

  // 🎒 PANEL de vuelo: inventario y misiones activas (la partida se pausa mientras está abierto)
  showGalInv(tab = ui.giTab || 'inv') {
    const s = G.space;
    if (!s) return;
    if (G.mode === 'galaxy') { G.mode = 'galaxyInv'; musicDuck(true); s.fireHeld = false; s.rollBtn = 0; }
    ui.giTab = tab;
    for (const b of $('giTabs').querySelectorAll('button')) b.classList.toggle('on', b.dataset.tab === tab);
    const g = save.galaxy, st = spaceStats(), body = $('giBody');
    const hops = (to) => { const r = route(GAL, s.sysId, to); return r ? r.length - 1 : '?'; };
    const jumps = (to) => { const h = hops(to); return h === 1 ? '1 salto' : `${h} saltos`; };
    const where = (to) => (to === s.sysId ? 'aquí' : `${GAL[to].name} · ${jumps(to)}`);
    body.innerHTML = '';
    if (tab === 'inv') {
      const n = cargoCount(g.cargo);
      const ores = Object.entries(g.cargo).filter(([, k]) => k > 0);
      const value = ores.reduce((a, [k, q]) => a + marketValue(k, q, s.sysId), 0);
      body.innerHTML = `
        <div class="gi-block"><h3>💰 ${fmt(g.credits)} créditos</h3><small>⚡ Poder de tu nave ${shipPower().toFixed(1)} · los piratas se refuerzan x${threat().toFixed(2)}${wantedStars(g) ? ` · 🚨 ${'⭐'.repeat(wantedStars(g))} te buscan` : ''}</small></div>
        <div class="gi-block"><h3>📦 Bodega · ${n}/${st.cargo}</h3><div class="m-bar"><i style="transform:scaleX(${Math.min(1, n / st.cargo).toFixed(3)})"></i></div>
          ${ores.length ? ores.map(([k, q]) => `<div class="gi-row"><span>${ORES[k].icon} ${ORES[k].name}</span><b>×${q}</b><small>~${marketPrice(k, s.sysId)} 💰/u aquí</small></div>`).join('')
            + `<div class="gi-row total"><span>Valor en ${GAL[s.sysId].name}</span><b>${fmt(value)} 💰</b></div>` : '<small>Vacía. Dispara a los asteroides para minar.</small>'}</div>
        <div class="gi-block"><h3>🔧 Materiales</h3><div class="gi-mats">${Object.entries(MATS).map(([k, m]) => `<span>${m.icon} <b>${matOf(save, k)}</b> <small>${m.name}</small></span>`).join('')}</div></div>
        ${g.up.missile ? `<div class="gi-block"><h3>🚀 Misiles · ${g.missiles || 0}/${missileMax()}</h3><small>Se recargan (pagando) en los Suministros de las estaciones.</small></div>` : ''}
        <div class="gi-block"><h3>🧰 Consumibles</h3><div class="gi-mats">${ITEM_KEYS.map((id) => `<span>${ITEMS[id].icon} <b>${itemCount(save, id)}</b> <small>${ITEMS[id].name}</small></span>`).join('')}</div></div>
        <div class="gi-block"><h3>🛠️ Equipo montado · ${CHASSIS[g.chassis].icon} ${CHASSIS[g.chassis].name}</h3>${['w', 'm'].map((sl) => Array.from({ length: slotsOf(save)[sl] }, (_, i) => {
          const id = gear(save)[sl][i];
          return id ? `<div class="gi-row"><span>${GEAR[id].icon} ${GEAR[id].name}</span><small>${GEAR[id].desc}</small></div>` : `<div class="gi-row empty"><span>${sl === 'w' ? '🔫 arma' : '⚙️ módulo'} libre</span><small>se fabrica en el taller de las estaciones</small></div>`;
        }).join('')).join('')}</div>
        <div class="gi-block"><h3>⬆️ Mejoras</h3>${Object.entries(SP_UP).map(([id, u]) => `<div class="gi-row"><span>${u.icon} ${u.name}</span><b class="dots">${ui.upDots(g.up[id] || 0)}</b></div>`).join('')}</div>`;
    } else if (tab === 'news') {
      // NOTICIAS: lo que pasa en la galaxia (ofensivas, enjambre) y los últimos titulares
      const w = world(save), rows = [];
      if (w.war) rows.push(`<div class="gi-mis war"><span>⚔️</span><div><b>Ofensiva pirata en ${GAL[w.war.sys].name}</b><small>${where(w.war.sys)} · cae en ${Math.max(0, w.war.until - g.jumps)} saltos · abatidos ${w.war.kills}/${w.war.need}</small></div></div>`);
      if (w.swarm) rows.push(`<div class="gi-mis swarm"><span>🐝</span><div><b>Enjambre en ${w.swarm.systems.length} sistema${w.swarm.systems.length > 1 ? 's' : ''}</b><small>${w.swarm.systems.map((id) => GAL[id].name).join(' · ')} · se extiende en ${Math.max(0, w.swarm.nextSpread - g.jumps)} saltos</small></div></div>`);
      if (!rows.length) rows.push(`<small>Todo en calma… por ahora. Cada pocos saltos los piratas lanzan una ofensiva (tienes ${WAR_TIME} saltos para defenderla) y el enjambre busca nuevos sistemas.</small>`);
      rows.push(`<div class="gi-block"><h3>📰 Titulares</h3><div class="gi-news">${w.news.length ? w.news.map((n) => `<div><small>salto ${n.j}</small><span>${n.text}</span></div>`).join('') : '<small>Sin noticias todavía.</small>'}</div></div>`);
      rows.push(`<small>🛡️ Sistemas defendidos: ${w.saved} · ✨ enjambres exterminados: ${w.wiped}</small>`);
      body.innerHTML = rows.join('');
    } else {
      const rows = [];
      const ch = storyChapter();
      if (ch) rows.push(`<div class="gi-mis story"><span>📖</span><div><b>${chapterLabel(save)} · ${ch.title}</b><small>${ch.goal.text}${ch.goal.sys !== undefined ? ` · ${ch.goal.sys === s.sysId ? 'aquí' : jumps(ch.goal.sys)}` : ''}</small></div></div>`);
      const bo = save.bounties.active;
      if (bo) rows.push(`<div class="gi-mis bounty"><span>🎯</span><div><b>${bo.name} · nivel ${bo.level}</b><small>${TRAITS[bo.trait].icon} ${TRAITS[bo.trait].name} · visto en ${where(bo.sys)} · +${fmt(bo.reward)} 💰</small></div></div>`);
      if (s.event && !s.event.done && s.objective?.kind === 'event') rows.push(`<div class="gi-mis event"><span>⚡</span><div><b>Suceso en ${GAL[s.sysId].name}</b><small>${s.objective.text}</small></div></div>`);
      if (sysOwner(s.sysId) === 'pir') rows.push(`<div class="gi-mis lib"><span>🏴‍☠️</span><div><b>Libera ${GAL[s.sysId].name}</b><small>destruye su base y 4 piratas</small></div></div>`);
      body.innerHTML = rows.join('');
      for (const m of g.missions) {
        const row = el('div', 'gi-mis', `<span>${MISSION_KINDS[m.kind].icon}</span><div><b>${m.text}</b><small>${m.n > 1 ? `${m.progress}/${m.n} · ` : ''}${where(m.sys)} · +${fmt(m.reward)} 💰</small></div>`);
        const x = el('button', 'btn ghost gi-x', '✕');
        x.title = 'Abandonar';
        x.dataset.abandon = m.id;
        tap(x, () => {
          if (!x.dataset.sure) { x.dataset.sure = '1'; x.textContent = '¿Seguro?'; return; }
          abandonMission(m.id);
          ui.showGalInv('mis');
        });
        row.append(x);
        body.append(row);
      }
      if (!body.children.length) body.innerHTML = '<p class="hint">No tienes misiones activas: los tablones están en las estaciones (y los carteles de 🎯 SE BUSCA).</p>';
    }
    ui.showSpaceHUD(false);
    show('galInv');
  },

  // Mapa galáctico: los sistemas conocidos (visitados y sus vecinos), rutas y peligro
  // MAPA GALÁCTICO: color = peligro, anillo = facción, insignias alrededor de cada sistema, ruta con
  // flechas, zoom (pellizcar, rueda o ＋ －) y capas que se pueden ocultar
  showGalMap(sel = null) {
    const s = G.space;
    if (!s) return;
    if (G.mode === 'galaxy') { G.mode = 'galaxyMap'; musicDuck(true); if (s) s.fireHeld = false; ui.gmView = null; }
    ui.gmSel = sel;
    // primero se muestra: el recuadro tiene que tener su tamaño real para encuadrar bien
    ui.showSpaceHUD(false);
    show('galMap');
    const g = save.galaxy;
    const L = (save.settings.mapLayers ||= { obj: true, fac: true, evt: true, dng: true });
    const seen = known(GAL, g.visited);
    for (const id of radarSystems(save, GAL)) seen.add(id); // RADAR de tus puestos
    const path = s.routeTo !== null ? route(GAL, s.sysId, s.routeTo) || [] : [];
    const onPath = (a, b2) => path.some((x, i) => i && ((path[i - 1] === a && x === b2) || (path[i - 1] === b2 && x === a)));
    // vista: por defecto, todo lo que conoces; el zoom y el arrastre la cambian
    const wrap = $('gmWrap'), W = wrap.clientWidth || 360, H = wrap.clientHeight || 420;
    const known_ = GAL.filter((a) => seen.has(a.id));
    const xs = known_.map((a) => a.x), ys = known_.map((a) => a.y), pad = 70;
    const fit = { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2,
      w: Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * (W / H), 260) + pad * 2 };
    ui.gmFit = fit;
    const v = (ui.gmView ||= { ...fit });
    const u = v.w / W; // unidades del mapa por píxel: los símbolos miden lo mismo en pantalla con cualquier zoom
    // qué hay en cada sistema (para las insignias y la ficha)
    const ch = storyChapter(), w = world(save);
    const ctx = {
      story: ch?.goal?.sys ?? null,
      missions: g.missions.filter((m) => m.progress < m.n).map((m) => m.sys),
      bounty: save.bounties.active?.sys ?? null,
      war: w.war?.sys ?? null,
      swarm: w.swarm?.systems || [],
      pirates: new Set(known_.filter((a) => g.visited.includes(a.id) && sysOwner(a.id) === 'pir').map((a) => a.id)),
      outposts: new Set(Object.keys(save.outposts || {}).map(Number)),
      home: g.home ?? 0,
    };
    const R = 9 * u;
    let svg = `<defs><marker id="gmArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#ffe600"/></marker></defs>`;
    for (const a of known_) {
      for (const b2 of a.links) {
        if (b2 <= a.id || !seen.has(b2)) continue;
        const on = onPath(a.id, b2);
        svg += `<line x1="${a.x}" y1="${a.y}" x2="${GAL[b2].x}" y2="${GAL[b2].y}" class="${on ? 'path' : ''}" stroke-width="${(on ? 4 : 2) * u}"/>`;
      }
    }
    // RUTA: flechas en el sentido del viaje (a mitad de cada tramo)
    for (let i = 1; i < path.length; i++) {
      const p0 = GAL[path[i - 1]], p1 = GAL[path[i]];
      svg += `<line x1="${p0.x}" y1="${p0.y}" x2="${(p0.x + p1.x) / 2}" y2="${(p0.y + p1.y) / 2}" class="gm-arrow" stroke-width="${4 * u}" marker-end="url(#gmArrow)"/>`;
    }
    const nodes = [];
    for (const a of known_) {
      const visited = g.visited.includes(a.id), here = a.id === s.sysId, lock = !canJump(a, g.up.jump || 0);
      const owner = visited ? sysOwner(a.id) : null;
      const fill = !visited ? '#2a2a3a' : L.dng ? dangerColor(a.danger) : '#8a93a6';
      svg += `<g class="gm-node${here ? ' here' : ''}${a.id === sel ? ' sel' : ''}${visited ? '' : ' unknown'}" data-sys="${a.id}">
        <circle cx="${a.x}" cy="${a.y}" r="${24 * u}" fill="transparent" class="hit"/>
        ${here ? `<circle cx="${a.x}" cy="${a.y}" r="${R * 2.3}" class="gm-here" stroke-width="${2.5 * u}"/>` : ''}
        ${a.id === sel ? `<circle cx="${a.x}" cy="${a.y}" r="${R * 2}" class="gm-sel" stroke-width="${2.5 * u}"/>` : ''}
        ${visited && L.fac ? `<circle cx="${a.x}" cy="${a.y}" r="${R * 1.55}" class="fac" style="fill:none;stroke:${FACTIONS[owner].color};stroke-width:${2.8 * u}${owner === 'pir' ? `;stroke-dasharray:${4 * u} ${3 * u}` : ''}"/>` : ''}
        <circle cx="${a.x}" cy="${a.y}" r="${R}" fill="${fill}" class="core" stroke-width="${1.5 * u}"${visited ? '' : ` stroke-dasharray="${3 * u} ${3 * u}"`}/>`;
      // INSIGNIAS en 4 huecos fijos alrededor (NE, NO, SE, SO): nunca tapan el nombre
      const { shown, more } = badgesFor(a.id, ctx, L);
      const slots = [[1, -1], [-1, -1], [1, 1], [-1, 1]];
      shown.forEach((k, i) => {
        const [sx, sy] = slots[i], bx = a.x + sx * R * 2.05, by = a.y + sy * R * 1.8;
        svg += `<g class="gm-badge" data-badge="${k}"><circle cx="${bx}" cy="${by}" r="${10 * u}" stroke-width="${1.2 * u}"/><text x="${bx}" y="${by}" font-size="${12.5 * u}">${BADGES[k].icon}</text></g>`;
      });
      if (more) svg += `<text x="${a.x + R * 3.2}" y="${a.y}" class="gm-more" font-size="${9 * u}">+${more}</text>`;
      svg += '</g>';
      nodes.push({ id: a.id, x: a.x, y: a.y, name: `${visited ? a.name : '???'}${lock ? ' 🔒' : ''}`, keep: here || a.id === sel });
    }
    // NOMBRES: debajo; si pisan a otro, encima; si no caben, ocultos (salvo donde estás y el elegido)
    // ancho real de cada nombre con la fuente del mapa (cambia según el sistema: no se estima)
    const mctx = (ui._gmMeasure ||= document.createElement('canvas').getContext('2d'));
    mctx.font = '900 11px system-ui';
    for (const lb of placeLabels(nodes, u, 11, (t) => mctx.measureText(t).width)) {
      if (lb.hidden) continue;
      const n = nodes.find((x) => x.id === lb.id);
      svg += `<text x="${lb.x}" y="${lb.y}" class="gm-label" font-size="${11 * u}" stroke-width="${3 * u}" data-label="${lb.id}">${n.name}</text>`;
    }
    $('gmSvg').innerHTML = svg;
    ui.gmApplyView();
    for (const n of $('gmSvg').querySelectorAll('.gm-node')) n.addEventListener('click', () => { if (!ui._gmDragged) ui.showGalMap(Number(n.dataset.sys)); });
    ui.gmInitOnce();
    // CAPAS
    $('gmLayers').innerHTML = '';
    for (const [k, label] of Object.entries(LAYERS)) {
      const b2 = el('button', `gm-layer${L[k] ? ' on' : ''}`, label);
      b2.dataset.layer = k;
      tap(b2, () => { L[k] = !L[k]; persist(); ui.showGalMap(ui.gmSel); });
      $('gmLayers').append(b2);
    }
    // FICHA del sistema elegido (o resumen)
    const info = $('gmInfo');
    const jumpLvl = g.up.jump || 0;
    if (sel !== null) {
      const a = GAL[sel], visited = g.visited.includes(sel);
      const r = route(GAL, s.sysId, sel);
      const own = visited ? sysOwner(sel) : null;
      const rows = [];
      if (visited) {
        rows.push(`${FACTIONS[own].icon} ${FACTIONS[own].name} · peligro ${'☠'.repeat(a.danger) || 'ninguno'}${a.danger && threatTier(threat()) ? ` · amenaza ${'▲'.repeat(threatTier(threat()))}` : ''}`);
        rows.push(`mineral ${ORES[a.ore].icon} ${ORES[a.ore].name} · ${own === 'pir' ? '🚫 su estación no te deja atracar' : '🛰️ estación abierta'}`);
      } else rows.push('Sin explorar: se ve desde un sistema vecino');
      // lo que tienes allí
      if (ctx.story === sel) rows.push(`📖 ${ch.goal.text}`);
      for (const m of g.missions.filter((x) => x.sys === sel && x.progress < x.n)) rows.push(`📋 ${m.text}`);
      if (ctx.bounty === sel) rows.push(`🎯 ${save.bounties.active.name} (recompensa)`);
      if (ctx.war === sel) rows.push(`⚔️ Ofensiva pirata: cae en ${Math.max(0, w.war.until - g.jumps)} saltos`);
      if (ctx.swarm.includes(sel)) rows.push('🐝 Infectado: destruye su nido');
      if (ctx.outposts.has(sel)) rows.push(`🏗️ Tu puesto: ${save.outposts[sel].name}`);
      if (r && sel !== s.sysId) rows.push(`🧭 ${r.length - 1} salto${r.length === 2 ? '' : 's'} · peaje ~${fmt(routeToll(GAL, r, jumpLvl))} 💰`);
      info.innerHTML = `<b>${visited ? a.name : 'Sistema sin explorar'}</b>${rows.map((x) => `<small>${x}</small>`).join('')}
        ${!canJump(a, jumpLvl) ? `<small class="warn">🔒 Necesitas Salto ${jumpNeeded(a)}</small>` : ''}`;
      if (sel !== s.sysId) {
        const go = el('button', 'btn', '🧭 TRAZAR RUTA');
        go.id = 'btnRoute';
        tap(go, () => { setRoute(sel); G.mode = 'galaxy'; musicDuck(false); ui.hideAll(); ui.showSpaceHUD(true); });
        info.append(go);
      }
    } else {
      const rt = path.length > 1 ? `<small class="gm-route">🧭 Ruta a <b>${GAL[s.routeTo].name}</b>: ${path.length - 1} saltos · peaje ~${fmt(routeToll(GAL, path, jumpLvl))} 💰</small>` : '';
      info.innerHTML = `${rt}<small>Estás en <b>${GAL[s.sysId].name}</b>. Has visitado ${g.visited.length} de ${GAL.length} sistemas · 🏳️ liberados ${liberatedCount(save.territory)}/${pirateSystemsTotal(GAL)}</small>
        <small>Toca un sistema para ver qué hay y trazar la ruta · pellizca o usa ＋ － para acercar</small>`;
    }
    // LEYENDA
    $('gmLegendBody').innerHTML = `
      <div class="gl-row"><b>Color = peligro</b>${DANGER_COLORS.map((c, i) => `<span><i style="background:${c}"></i>${i}</span>`).join('')}</div>
      <div class="gl-row"><b>Anillo = facción</b>${Object.entries(FACTIONS).map(([k, f]) => `<span><i class="ring${k === 'pir' ? ' dash' : ''}" style="border-color:${f.color}"></i>${f.name}</span>`).join('')}</div>
      <div class="gl-icons">${Object.values(BADGES).map((x) => `<span>${x.icon} ${x.name}</span>`).join('')}<span>🔒 Necesitas más Salto</span><span><i class="ring here"></i> Estás aquí</span><span><i class="line"></i> Tu ruta (las flechas, hacia dónde)</span></div>`;
  },
  // aplica la vista (centro y ancho) al viewBox, con el alto que toca por la forma del recuadro
  gmApplyView() {
    const v = ui.gmView, wrap = $('gmWrap');
    if (!v) return;
    const W = wrap.clientWidth || 360, H = wrap.clientHeight || 420, h = (v.w * H) / W;
    $('gmSvg').setAttribute('viewBox', `${v.cx - v.w / 2} ${v.cy - h / 2} ${v.w} ${h}`);
  },
  gmZoom(f) {
    const v = ui.gmView, fit = ui.gmFit;
    if (!v || !fit) return;
    v.w = Math.max(220, Math.min(fit.w * 1.6, v.w * f));
    ui.showGalMap(ui.gmSel);
  },
  // gestos del mapa (una vez): arrastrar = mover, pellizcar o rueda = zoom, doble toque = centrar en ti
  gmInitOnce() {
    if (ui._gmReady) return;
    ui._gmReady = true;
    const svg = $('gmSvg'), pts = new Map();
    let start = null, lastTap = 0;
    tap($('gmIn'), () => ui.gmZoom(0.7));
    tap($('gmOut'), () => ui.gmZoom(1 / 0.7));
    tap($('gmFit'), () => { ui.gmView = { ...ui.gmFit }; ui.showGalMap(ui.gmSel); });
    svg.addEventListener('pointerdown', (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const v = ui.gmView;
      if (!v) return;
      const [a, b2] = [...pts.values()];
      start = { v: { ...v }, a: { ...a }, d: b2 ? Math.hypot(a.x - b2.x, a.y - b2.y) : 0, moved: false };
      const now = performance.now();
      if (pts.size === 1 && now - lastTap < 300) {
        const here = GAL[G.space?.sysId ?? 0];
        ui.gmView = { ...ui.gmView, cx: here.x, cy: here.y };
        ui.gmApplyView();
      }
      lastTap = now;
    });
    svg.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId) || !start || !ui.gmView) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const W = $('gmWrap').clientWidth || 360, list = [...pts.values()];
      if (list.length >= 2 && start.d) {
        const d = Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y);
        ui.gmView.w = Math.max(220, Math.min(ui.gmFit.w * 1.6, start.v.w * (start.d / Math.max(20, d))));
        start.moved = true;
        ui.showGalMap(ui.gmSel); // el tamaño de los símbolos depende del zoom
        return;
      }
      const dx = list[0].x - start.a.x, dy = list[0].y - start.a.y;
      if (!start.moved && Math.hypot(dx, dy) < 8) return;
      start.moved = true;
      const u = start.v.w / W;
      ui.gmView.cx = start.v.cx - dx * u;
      ui.gmView.cy = start.v.cy - dy * u;
      ui.gmApplyView();
    });
    const end = (e) => {
      pts.delete(e.pointerId);
      if (start?.moved) { ui._gmDragged = true; setTimeout(() => { ui._gmDragged = false; }, 0); }
      if (!pts.size) start = null;
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', (e) => { e.preventDefault(); ui.gmZoom(e.deltaY > 0 ? 1.15 : 1 / 1.15); }, { passive: false });
  },

  // ---------- CARRERAS ----------
  showRaceCups() {
    G.mode = 'hangar'; // pantalla estática
    G.run = null;
    G.player = null;
    ui.showHUD(false);
    const list = $('rcList');
    list.innerHTML = '';
    ui.rcTab ||= 'cups';
    for (const b of $('rcTabs').querySelectorAll('button')) b.classList.toggle('on', b.dataset.tab === ui.rcTab);
    setText('rcHint', ui.rcTab === 'tt' ? 'Solo tú, el reloj y tu fantasma. Bate los tiempos para ganar 🥇🥈🥉.' : '3 rivales, 3 pistas por copa y tu fantasma. Chocar frena, no mata.');
    // CONTRARRELOJ: cada pista de las copas abiertas, con su medalla y sus tiempos
    if (ui.rcTab === 'tt') {
      for (const cup of CUPS) {
        if (!isCupOpen(save, cup.id)) continue;
        for (const t of cup.tracks) {
          const m = save.raceTT[t.id], best = save.raceBest[t.id], tg = ttTargets(t);
          const b = el('button', 'tt-row', `<span class="tt-medal">${m !== undefined ? MEDALS[m] : '⏱️'}</span>
            <span class="tt-body"><b>${t.name}</b><small>${cup.name} · ${tg.map((x, i) => `${MEDALS[i]} ${x.toFixed(1)}`).join(' ')}</small></span>
            <em>${best ? `${best.toFixed(1)} s` : '—'}</em>`);
          b.style.setProperty('--cc', cup.color);
          b.dataset.tt = t.id;
          tap(b, () => newRun({ mode: 'race', track: t.id, solo: true }));
          list.append(b);
        }
      }
      show('raceCups');
      return;
    }
    for (const cup of CUPS) {
      const open = isCupOpen(save, cup.id);
      const medal = save.raceCups[cup.id];
      const box = el('div', `rc-cup${open ? '' : ' locked'}`);
      box.style.setProperty('--cc', cup.color);
      box.innerHTML = `<div class="rc-top"><b>${cup.name}</b><span>${medal !== undefined ? MEDALS[medal] : open ? '' : '🔒'}</span></div>
        <div class="rc-tracks">${cup.tracks.map((t) => `<div><small>${t.name}</small><em>${save.raceBest[t.id] ? `${save.raceBest[t.id].toFixed(1)} s${save.ghosts[t.id] ? ' 👻' : ''}` : '—'}</em></div>`).join('')}</div>`;
      const go = el('button', 'btn', open ? '🏁 CORRER LA COPA' : 'gana una medalla en la anterior');
      go.disabled = !open;
      go.dataset.cup = cup.id;
      if (open) tap(go, () => newRun({ mode: 'race', track: cup.tracks[0].id, points: {} }));
      box.append(go);
      list.append(box);
    }
    show('raceCups');
    ui.showTip('race');
  },

  showRacePodium(res) {
    ui.lastRace = res;
    ui.deathAt = performance.now();
    if (res.solo) {
      // CONTRARRELOJ: tu tiempo frente a los tres objetivos
      setText('rpTitle', res.tt !== null ? `${MEDALS[res.tt]} ${res.time.toFixed(1)} s` : `${res.time.toFixed(1)} s`);
      $('rpTitle').className = res.tt === 0 ? 'won' : '';
      setText('rpTrack', `⏱️ CONTRARRELOJ · ${res.track.name}`);
      $('rpOrder').innerHTML = res.targets.map((x, i) => `<div class="${res.time <= x ? 'you' : ''}"><b>${MEDALS[i]}</b><span>${['ORO', 'PLATA', 'BRONCE'][i]}</span><em>${x.toFixed(1)} s</em><small>${res.time <= x ? '✔' : ''}</small></div>`).join('');
      setText('rpGhost', res.hadGhost ? (res.ghostBeaten ? '👻 ¡Has batido a tu fantasma!' : `👻 Tu mejor tiempo: ${res.best.toFixed(1)} s`) : '👻 Fantasma guardado');
      $('rpCup').innerHTML = '';
      $('rpGems').innerHTML = `+${res.gems} 💎 <small>(total ${fmt(save.gems)})</small>`;
      const ups = res.rankUps.map((u) => `<div class="rank-up">⬆ ¡RANGO ${u.rank}! <b>+${u.gems} 💎</b></div>`).join('');
      $('rpXp').innerHTML = `<div class="xp-gain">+${fmt(res.xp)} XP</div>${rankHTML(save.xp, res.rankUps.length ? null : res.xpBefore)}${ups}`;
      $('btnRaceNext').classList.add('hidden');
      show('racePodium');
      return;
    }
    const nT = res.cup.tracks.length;
    setText('rpTitle', res.pos === 0 ? '¡VICTORIA!' : `${res.pos + 1}.º PUESTO`);
    $('rpTitle').className = res.pos === 0 ? 'won' : '';
    setText('rpTrack', `${res.cup.name} · ${res.track.idx + 1}/${nT} · ${res.track.name}`);
    $('rpOrder').innerHTML = res.order.map((x, i) => `<div class="${x.you ? 'you' : ''}" style="--rc:${x.color}"><b>${i + 1}.º</b><span>${x.name}</span><em>${x.t.toFixed(1)} s</em><small>+${[10, 6, 3, 1][i]}</small></div>`).join('');
    setText('rpGhost', res.hadGhost ? (res.ghostBeaten ? '👻 ¡Has batido a tu fantasma!' : `👻 Tu mejor tiempo: ${res.best.toFixed(1)} s`) : '👻 Fantasma guardado: la próxima vez corres contra ti');
    const table = Object.entries(res.points).sort((a, b) => b[1] - a[1]);
    const names = { you: 'TÚ', ...Object.fromEntries(RIVALS.map((rv, i) => [i, rv.name])) };
    $('rpCup').innerHTML = `<small>${res.cupEnd ? 'CLASIFICACIÓN FINAL' : 'CLASIFICACIÓN DE LA COPA'}</small>${table.map(([k, v], i) => `<div class="${k === 'you' ? 'you' : ''}"><b>${i + 1}.</b> ${names[k]} <em>${v} pts</em></div>`).join('')}${res.cupEnd ? `<div class="rp-medal">${res.medal !== null ? `${MEDALS[res.medal]} ¡${['ORO', 'PLATA', 'BRONCE'][res.medal]}!` : 'Sin medalla esta vez'}</div>` : ''}`;
    $('rpGems').innerHTML = `+${res.gems} 💎 <small>(total ${fmt(save.gems)})</small>`;
    const ups = res.rankUps.map((u) => `<div class="rank-up">⬆ ¡RANGO ${u.rank}! <b>+${u.gems} 💎</b></div>`).join('');
    $('rpXp').innerHTML = `<div class="xp-gain">+${fmt(res.xp)} XP</div>${rankHTML(save.xp, res.rankUps.length ? null : res.xpBefore)}${ups}`;
    $('btnRaceNext').classList.toggle('hidden', !res.next);
    $('btnRaceNext').textContent = res.next ? `SIGUIENTE · ${res.track.idx + 2}/${nT}` : '';
    show('racePodium');
  },

  // ---------- EXPEDICIÓN ----------
  // Mapa del acto: la salida abajo y el jefe arriba. Las líneas se calculan con la fila y la
  // columna de cada nodo (sin medir el DOM): el mapa es igual en cualquier pantalla.
  showExpMap(e) {
    if (e.relics?.length) ui.showTip('relic'); else ui.showTip('expedition');
    const act = ACTS[e.act];
    setText('emTitle', `ACTO ${e.act + 1} · ${act.name}`);
    setText('emSub', act.sub);
    const r = G.run;
    $('emStatus').innerHTML = `<span>🛡️ ${r.shields}</span><span>🪙 ${r.coins}</span><span>🃏 ${Object.values(r.cards).reduce((a, b) => a + b, 0)}</span><span>🏁 ${e.acts}/${e.total}</span>${e.relics.length ? `<span class="em-relics" title="Reliquias">${e.relics.map((id) => RELICS[id].icon).join('')}</span>` : ''}`;
    const cur = nodeById(e.map, e.at);
    const ROW_H = 78, H = ROWS * ROW_H;
    const pos = (n) => ({ x: n.col * 100, y: H - (n.row + 0.5) * ROW_H });
    const box = $('emMap');
    box.style.height = `${H}px`;
    const lines = [];
    for (const n of e.map) {
      for (const id of n.next) {
        const m = nodeById(e.map, id), a = pos(n), b = pos(m);
        const walked = e.path.includes(n.id) && e.path.includes(m.id);
        const open = n.id === cur.id;
        lines.push(`<line x1="${a.x}%" y1="${a.y}" x2="${b.x}%" y2="${b.y}" class="${walked ? 'walked' : open ? 'open' : ''}"/>`);
      }
    }
    box.innerHTML = `<svg class="em-lines" width="100%" height="${H}">${lines.join('')}</svg>`;
    for (const n of e.map) {
      const p = pos(n);
      const state = e.path.includes(n.id) ? (n.id === cur.id ? 'here' : 'done') : cur.next.includes(n.id) ? 'open' : 'locked';
      const b = el('button', `em-node t-${n.type} ${state}`, `<span>${NODE[n.type].icon}</span><small>${NODE[n.type].name}</small>`);
      b.style.left = `${p.x}%`;
      b.style.top = `${p.y}px`;
      b.dataset.node = n.id;
      b.title = NODE[n.type].desc;
      if (state === 'open') tap(b, () => expChoose(n.id));
      box.append(b);
    }
    show('expMap');
    // que se vea el nodo actual (abajo al principio, arriba al final del acto)
    box.querySelector('.here')?.scrollIntoView({ block: 'center' });
  },

  showExpEvent(ev, r) {
    setText('eeTitle', ev.title);
    setText('eeText', ev.text);
    const box = $('eeChoices');
    box.innerHTML = '';
    ev.choices.forEach((c, i) => {
      const ok = canChoose(c, { coins: r.coins, shields: r.shields });
      const b = el('button', `btn${ok ? '' : ' ghost'}`, c.label);
      b.dataset.choice = i;
      b.disabled = !ok;
      tap(b, () => expEventChoice(ev, i));
      box.append(b);
    });
    show('expEvent');
  },

  showExpRest() {
    show('expRest');
  },

  showExpEnd(res) {
    setText('xeScore', fmt(res.score));
    $('xeBuild').innerHTML = buildSummary({ cards: res.cards, synergies: new Set(res.synergies) });
    $('xeGems').innerHTML = `+${res.gems} 💎 por el último acto${res.banked ? ` · +${res.banked} 🪙` : ''} <small>(total ${fmt(save.gems)})</small>`;
    const ups = res.rankUps.map((u) => `<div class="rank-up">⬆ ¡RANGO ${u.rank}! <b>+${u.gems} 💎</b></div>`).join('');
    $('xeXp').innerHTML = `<div class="xp-gain">+${fmt(res.xp)} XP</div>${rankHTML(save.xp, res.rankUps.length ? null : res.xpBefore)}${ups}`;
    show('expEnd');
  },

  // ---------- ARENA ----------
  // ---------- PECIOS ----------
  showPecioHub() {
    G.mode = 'hangar'; // pantalla estática
    G.pecio = null;
    ui.showHUD(false);
    ui.showPecioHUD(false);
    const P = save.pecio;
    setText('phRecord', P.best ? `récord: planta ${P.best}${P.wins ? ` · 🏆 ${P.wins}` : ''} · ${P.runs} partidas` : 'tu nave entra en pecios abandonados');
    setText('phPiezas', fmt(P.piezas || 0));
    $('phInfo').innerHTML = `
      <div class="gi-block"><h3>⚔️ Cómo se juega</h3><small>Vuelas por dentro del pecio con la cámara detrás de tu nave. Apoya el dedo donde quieras: arriba avanzas y a los lados giras (en el teclado, flechas o WASD). Tu nave dispara sola al enemigo más cercano que vea. 💨 Esquive (o Espacio) te hace intocable un instante y salta pozos; ⚡ es la habilidad de tu nave (E). Limpia la sala para abrir sus puertas y baja por la escotilla ⬇️. Si caes, te llevas parte de las 🔩.</small></div>
      <div class="gi-block"><h3>👾 Enemigos</h3>${Object.values(ENEMY).filter((e) => !e.boss).map((e) => `<div class="gi-row"><span style="color:${e.color}">■ ${e.name}</span><small>${e.desc}</small></div>`).join('')}</div>
      <div class="gi-block"><h3>🗺️ Salas</h3><div class="gi-mats">${Object.values(ROOM_TYPES).map((r) => `<span>${r.icon} <small>${r.name}</small></span>`).join('')}</div></div>
      <div class="gi-block"><h3>🎁 Botín</h3><small>Arma, blindaje y 2 módulos, de <b style="color:${LOOT_RAR[0].color}">común</b> a <b style="color:${LOOT_RAR[3].color}">legendario</b>: caen de enemigos, cofres y mímicos. En la mochila, hasta 3 de cada: ${Object.values(CONS).map((c) => `${c.icon} ${c.name}`).join(' · ')}. Las paredes agrietadas esconden salas: embístelas con 💨. Los interruptores 🔌 apagan el suelo eléctrico.</small></div>
      <div class="gi-block"><h3>💀 Jefes (cada 3 plantas)</h3>${Object.values(BOSSES).map((b, i) => `<div class="gi-row"><span style="color:${b.color}">■ ${b.name}</span><small>planta ${(i + 1) * 3}: ${b.tip}</small></div>`).join('')}<small>Tras la planta 9 eliges: salir con todo o seguir en el ♾️ modo sin fin.</small></div>
      <div class="gi-block"><h3>🛠️ Taller</h3><small>Mejoras para siempre, con 🔩.</small><div id="phWorkshop" class="ps-items"></div></div>
      <div class="gi-block"><h3>🔐 Bóveda</h3><div id="phVault"></div></div>`;
    ui.renderPecioVault();
    ui.renderPecioWorkshop();
    show('pecioHub');
  },
  renderPecioWorkshop() {
    const box = $('phWorkshop');
    if (!box) return;
    box.innerHTML = '';
    for (const w of WORKSHOP) {
      const lv = workshopLevel(save.pecioUp, w.id), c = workshopCost(save.pecioUp, w.id), max = c === null;
      const b = el('button', `st-up${!max && save.pecio.piezas >= c ? ' afford' : ''}${max ? ' maxed' : ''}`, `<span class="su-icon">${w.icon}</span><span class="su-body"><b>${w.name} <small>${'●'.repeat(lv)}${'○'.repeat(w.cost.length - lv)}</small></b><small>${w.desc(Math.max(1, max ? lv : lv + 1))}</small></span><span class="su-cost">${max ? 'MÁX' : `${c} 🔩`}</span>`);
      b.dataset.pup = w.id;
      tap(b, () => { if (pecioWorkshopBuy(w.id)) { setText('phPiezas', fmt(save.pecio.piezas)); ui.renderPecioWorkshop(); ui.renderPecioVault(); } });
      box.append(b);
    }
  },
  // PLANTA 9 superada: salir con todo o seguir en el modo sin fin
  showPecioExit(s) {
    ui.showPecioHUD(false);
    setText('psTitle', '🏆 ¡PLANTA 9 SUPERADA!');
    $('psText').innerHTML = `Llevas <b>${s.player.piezas} 🔩</b>. Ya cuenta como victoria: si sigues, ya no pierdes 🔩 al caer.`;
    $('btnPecioShopClose').classList.add('hidden');
    const box = $('psItems');
    box.innerHTML = '';
    for (const [pick, icon, name, desc] of [['leave', '🚀', 'SALIR', 'te llevas todas las 🔩'], ['continue', '♾️', 'SEGUIR', 'modo sin fin: los jefes vuelven, más duros; ¿hasta qué planta llegas?']]) {
      const b = el('button', 'st-up afford', `<span class="su-icon">${icon}</span><span class="su-body"><b>${name}</b><small>${desc}</small></span>`);
      b.dataset.exit = pick;
      tap(b, () => pecioChooseExit(pick));
      box.append(b);
    }
    show('pecioShop');
  },
  renderPecioVault() {
    const P = save.pecio, box = $('phVault');
    if (!box) return;
    if (!P.vaultOpen) {
      box.innerHTML = `<small>Guarda 1 objeto al acabar una partida y empiezas la siguiente con él puesto.</small>`;
      const b = el('button', `st-up${P.piezas >= VAULT_COST ? ' afford' : ''}`, `<span class="su-icon">🔐</span><span class="su-body"><b>Abrir la bóveda</b><small>para siempre</small></span><span class="su-cost">${VAULT_COST} 🔩</span>`);
      b.id = 'btnPecioVault';
      tap(b, () => { if (pecioVaultUnlock()) { setText('phPiezas', fmt(save.pecio.piezas)); ui.renderPecioVault(); } });
      box.append(b);
    } else box.innerHTML = P.vault ? `<small>Guardado para la próxima partida:</small>${lootCard(P.vault)}` : '<small>Vacía. Al acabar una partida, elige qué objeto guardar.</small>';
  },
  showPecioHUD(on) {
    $('pecioHud').classList.toggle('hidden', !on);
    if (on) { $('hud').classList.add('hidden'); $('arenaHud').classList.add('hidden'); }
  },
  updatePecioHUD() {
    const s = G.pecio;
    if (!s || $h('pecioHud').classList.contains('hidden')) return;
    const p = s.player;
    setText('pcFloor', `PLANTA ${s.depth}`);
    setText('pcTheme', s.floor.theme.name);
    // con muchas vidas, en número: una fila de corazones que salta de línea empujaría la barra sobre el cartel
    setText('pcHearts', (p.max > 8 ? `❤️ ${Math.max(0, p.hp)}/${p.max}` : '❤️'.repeat(Math.max(0, p.hp)) + '🖤'.repeat(Math.max(0, p.max - p.hp))) + (p.shield ? ` 🫧${p.shield}` : ''));
    setText('pcKeys', String(p.keys));
    setText('pcPiezas', String(p.piezas));
    setText('pcDashTxt', p.dashCd > 0 ? `${p.dashCd.toFixed(1)} s` : 'ESQUIVE');
    tgl($h('pcDash'), 'cool', p.dashCd > 0);
    const AB = PECIO_AB[p.ability] || PECIO_AB.phase;
    setText('pcAbTxt', p.abCd > 0 ? `${Math.ceil(p.abCd)} s` : AB.name.toUpperCase());
    tgl($h('pcAbility'), 'cool', p.abCd > 0);
    // equipo (iconos con el color de su rareza) y mochila (un botón por consumible que lleves): solo si cambian
    const sig = SLOTS.map((k) => p.gear[k]?.id || '-').join() + '|' + CONS_KEYS.map((k) => p.bag[k]).join();
    if (s.hudSig !== sig) {
      s.hudSig = sig;
      $('pcGear').innerHTML = SLOTS.filter((k) => p.gear[k]).map((k) => `<span class="pg-it" style="--rc:${LOOT_RAR[p.gear[k].tier].color}" title="${itemName(p.gear[k])}">${itemIcon(p.gear[k])}</span>`).join('');
      const bar = $('pcBagBar');
      bar.innerHTML = '';
      for (const k of CONS_KEYS) {
        if (!p.bag[k]) continue;
        const b = el('button', 'pc-cons', `<span>${CONS[k].icon}</span><b>${p.bag[k]}</b>`);
        b.dataset.cons = k;
        b.setAttribute('aria-label', CONS[k].name);
        tap(b, () => pecioUseCons(k));
        bar.append(b);
      }
    }
  },
  // BOTÍN: lo nuevo frente a lo que llevas, y elegir
  showPecioOffer(s) {
    const it = s.offer.item, p = s.player, cur = currentFor(p, it);
    setText('psTitle', '🎁 BOTÍN');
    $('psText').innerHTML = `<b style="color:${LOOT_RAR[it.tier].color}">${LOOT_RAR[it.tier].name}</b> · ${it.slot === 'mod' ? 'Módulo' : SLOT_NAME[it.slot]}`;
    const box = $('psItems');
    box.innerHTML = `<div class="loot-vs"><div><small>NUEVO</small>${lootCard(it)}</div><div><small>${cur ? 'LLEVAS' : 'RANURA VACÍA'}</small>${cur ? lootCard(cur) : '<div class="loot-card empty">—</div>'}</div></div>`;
    const opts = it.slot === 'mod' && p.gear.mod1 && p.gear.mod2
      ? [['mod1', `CAMBIAR POR ${itemIcon(p.gear.mod1)} ${itemName(p.gear.mod1).toUpperCase()}`], ['mod2', `CAMBIAR POR ${itemIcon(p.gear.mod2)} ${itemName(p.gear.mod2).toUpperCase()}`]]
      : [['equip', cur ? 'CAMBIAR' : 'EQUIPAR']];
    for (const [choice, txt] of [...opts, ['leave', 'DEJARLO EN EL SUELO']]) {
      const b = el('button', `btn${choice === 'leave' ? ' ghost' : ''}`, txt);
      b.dataset.offer = choice;
      tap(b, () => pecioTakeOffer(choice));
      box.append(b);
    }
    ui.showPecioHUD(false); // los botones de la partida no tapan los de esta pantalla
    $('btnPecioShopClose').classList.add('hidden'); // hay que elegir
    show('pecioShop');
  },
  showPecioShop(s) {
    setText('psTitle', '🛒 TIENDA DEL PECIO');
    setText('psText', `Tienes ${s.player.piezas} 🔩 de esta partida.`);
    ui.showPecioHUD(false); // los botones de la partida no tapan los de esta pantalla
    $('btnPecioShopClose').classList.remove('hidden');
    const box = $('psItems');
    box.innerHTML = '';
    const INFO = { repair: ['🔧', 'Reparación', '+3 de vida ahora'], key: ['🗝️', 'Llave', 'abre un cofre'], box: ['📦', 'Caja misteriosa', 'un objeto, al menos raro'] };
    for (const item of SHOP_ITEMS) {
      const [icon, name, desc] = INFO[item] || [CONS[item].icon, CONS[item].name, `${CONS[item].desc} · llevas ${s.player.bag[item]}/3`];
      const c = shopCost(s, item);
      const b = el('button', `st-up${s.player.piezas >= c ? ' afford' : ''}`, `<span class="su-icon">${icon}</span><span class="su-body"><b>${name}</b><small>${desc}</small></span><span class="su-cost">${c} 🔩</span>`);
      b.dataset.buy = item;
      tap(b, () => pecioBuy(item));
      box.append(b);
    }
    show('pecioShop');
  },
  showPecioShrine() {
    setText('psTitle', '✨ ALTAR');
    ui.showPecioHUD(false); // los botones de la partida no tapan los de esta pantalla
    setText('psText', 'Una luz antigua te ofrece una bendición. Solo una.');
    $('btnPecioShopClose').classList.remove('hidden');
    const box = $('psItems');
    box.innerHTML = '';
    for (const [pick, icon, name, desc] of [['hp', '❤️', 'Vitalidad', '+2 de vida máxima'], ['dmg', '⚡', 'Potencia', '+1 de daño del disparo'], ['pact', '🩸', 'Pacto', '−1 de vida máxima a cambio de un objeto épico o mejor']]) {
      const b = el('button', 'st-up afford', `<span class="su-icon">${icon}</span><span class="su-body"><b>${name}</b><small>${desc}</small></span><span class="su-cost">ELEGIR</span>`);
      b.dataset.pray = pick;
      tap(b, () => pecioPray(pick));
      box.append(b);
    }
    show('pecioShop');
  },
  showPecioEnd(r) {
    setText('peTitle', r.won ? '🏆 ¡HAS SALIDO!' : r.endless ? '♾️ FIN DEL VIAJE' : 'DESTRUIDO');
    $('peTitle').className = r.won || r.endless ? 'won' : 'dead';
    setText('peDepth', `PLANTA ${r.depth}`);
    $('peGrid').innerHTML = [['Salas', r.rooms], ['Bajas', r.kills], ['Jefes', r.bosses || 0], ['Récord', `planta ${r.best}`]].map(([k, v]) => `<div><b>${v}</b><small>${k}</small></div>`).join('');
    $('pePiezas').innerHTML = `+${r.kept} 🔩 <small>${r.won ? 'todas' : `de ${r.found} encontradas`} · tienes ${fmt(r.wallet)}</small>`;
    // BÓVEDA: guarda uno de los objetos que llevabas para la próxima partida
    const vb = $('peVault');
    vb.innerHTML = '';
    const kept = Object.entries(r.gear || {});
    if (kept.length && save.pecio.vaultOpen) {
      vb.innerHTML = `<small>🔐 Guarda 1 objeto en la bóveda para la próxima partida${save.pecio.vault ? ' (sustituye al que hay)' : ''}:</small>`;
      const row = el('div', 'pe-vault-row', '');
      for (const [slot, it] of kept) {
        const b = el('button', 'pg-it big', itemIcon(it));
        b.style.setProperty('--rc', LOOT_RAR[it.tier].color);
        b.dataset.vault = slot;
        b.title = itemName(it);
        tap(b, () => { if (pecioVaultStore(slot)) vb.innerHTML = `<small>🔐 Guardado: ${itemIcon(it)} ${itemName(it)} (${LOOT_RAR[it.tier].name})</small>`; });
        row.append(b);
      }
      vb.append(row);
    } else if (kept.length) vb.innerHTML = `<small>🔐 Abre la bóveda en el menú de Pecios (${VAULT_COST} 🔩) para guardar un objeto entre partidas.</small>`;
    show('pecioEnd');
  },

  showArenaHUD(on) {
    $('arenaHud').classList.toggle('hidden', !on);
    if (on) $('hud').classList.add('hidden');
  },

  updateArenaHUD() {
    const a = G.arena;
    if (!a || $('arenaHud').classList.contains('hidden')) return;
    setText('ahTime', fmtTime(a.time));
    setText('ahGoal', a.endless ? `♾️ jefe en ${fmtTime(Math.max(0, nextBossTime(a.bossIdx, true) - a.time))}` : a.time < ARENA_TIME ? `sobrevive ${fmtTime(ARENA_TIME)}` : '¡JEFE FINAL!');
    setText('ahLvl', String(a.level));
    setText('ahKills', fmt(a.kills));
    $('arenaHud').querySelector('.ah-xp i').style.transform = `scaleX(${Math.min(1, a.xp / Math.max(1, xpNeed(a.level))).toFixed(3)})`;
    setHTML('ahWeapons', arenaBuild(a));
    const ab = $('arenaAbility');
    ab.style.setProperty('--f', readiness(a.ability).toFixed(3));
    setText('arenaAbilityIcon', ABILITIES[a.ability.id].icon);
    ab.classList.toggle('ready', a.ability.cdLeft <= 0 && a.ability.active <= 0);
    $('ahHint').classList.toggle('hidden', a.time > 6 || tipSeen(save, 'arena'));
  },

  showArenaUp(a) {
    setText('auTitle', `¡NIVEL ${a.level}!`);
    setText('auHint', ui.auBanish ? '🚫 Toca la mejora que no quieres volver a ver' : 'Elige una mejora');
    setText('auRerolls', String(a.rerolls || 0));
    setText('auBanishes', String(a.banishes || 0));
    $('btnAuReroll').classList.toggle('hidden', !a.rerolls);
    $('btnAuBanish').classList.toggle('hidden', !a.banishes);
    $('btnAuBanish').classList.toggle('on', !!ui.auBanish);
    if (!a.banishes) ui.auBanish = false;
    const box = $('auOptions');
    box.innerHTML = '';
    a.offers.forEach((up, i) => {
      const info = up.kind === 'weapon' ? WEAPONS[up.id] : up.kind === 'passive' ? PASSIVES[up.id] : up.kind === 'evolve' ? EVOLUTIONS[up.id] : { name: 'Reparación', icon: '❤️', desc: 'Recuperas toda la vida.' };
      const tag = up.kind === 'evolve' ? '✨ EVOLUCIÓN' : up.kind === 'weapon' ? (up.lvl === 1 ? 'ARMA NUEVA' : `ARMA · NIV ${up.lvl}`) : up.kind === 'passive' ? (up.lvl === 1 ? 'PASIVA NUEVA' : `PASIVA · NIV ${up.lvl}`) : 'CURA';
      const b = el('button', `au-opt k-${up.kind}`, `<span class="au-icon">${info.icon}</span><span class="au-body"><small>${tag}</small><b>${info.name}</b><em>${info.desc}</em></span>`);
      b.dataset.i = i;
      tap(b, () => { if (ui.auBanish) { ui.auBanish = false; arenaBanish(i); } else pickArenaUpgrade(i); });
      if (ui.auBanish && !['weapon', 'passive'].includes(up.kind)) b.disabled = true;
      box.append(b);
    });
    show('arenaUp');
    ui.showTip('arenaLevel');
  },

  // ganaste: ¿seguir en el modo sin fin o cobrar?
  showArenaChoice() {
    show('arenaChoice');
  },

  showArenaEnd(res) {
    ui.deathAt = performance.now();
    setText('aeTitle', res.endless ? '♾️ SIN FIN' : res.won ? '¡ARENA SUPERADA!' : 'DESTRUIDO');
    $('aeTitle').className = res.won ? 'won' : 'dead';
    $('aeNew').classList.toggle('hidden', !res.isBest);
    setText('aeTime', fmtTime(res.time));
    const cells = [['Bajas', fmt(res.kills)], ['Nivel', res.level], ['Jefes', res.bosses], ['Récord', fmtTime(res.best)]];
    $('aeGrid').innerHTML = cells.map(([k, v]) => `<div><b>${v}</b><small>${k}</small></div>`).join('');
    $('aeBuild').innerHTML = arenaBuild({ weapons: res.weapons, passives: {}, evolved: res.evolved });
    $('aeGems').innerHTML = `+${res.gems} 💎 · +${fmt(res.coins || 0)} 🪙 <small>(total ${fmt(save.gems)} 💎 · ${fmt(save.coins)} 🪙)</small>`;
    const ups = res.rankUps.map((u) => `<div class="rank-up">⬆ ¡RANGO ${u.rank}! <b>+${u.gems} 💎</b></div>`).join('');
    $('aeXp').innerHTML = `<div class="xp-gain">+${fmt(res.xp)} XP</div>${rankHTML(save.xp, res.rankUps.length ? null : res.xpBefore)}${ups}`;
    show('arenaEnd');
  },

  // Panel de modificadores: lo desbloqueado se activa y desactiva; lo bloqueado dice su rango
  showMods() {
    G.mode = 'hangar'; // pantalla estática
    const rank = effectiveRank(save);
    const sel = cleanMods(save.modsLast, rank);
    const list = $('modList');
    list.innerHTML = '';
    for (const m of MODS) {
      const open = rank >= m.rank;
      const on = sel.includes(m.id);
      const b = el('button', `mod${on ? ' on' : ''}${open ? '' : ' locked'}`, `<span class="mi">${open ? m.icon : '🔒'}</span><b>${m.name}</b>
        <small>${open ? m.desc : `RANGO ${m.rank}`}</small><em>x${m.score}</em>`);
      b.dataset.mod = m.id;
      if (open) {
        tap(b, () => {
          save.modsLast = toggleMod(sel, m.id);
          persist();
          fx.vibe(15);
          ui.showMods();
        });
      }
      list.append(b);
    }
    $('modTotal').innerHTML = sel.length
      ? `<b>x${modScore(sel).toFixed(2)}</b> puntos · <b>x${modGems(sel).toFixed(2)}</b> 💎`
      : '<small>Sin modificadores: partida normal</small>';
    show('mods');
  },

  pause() {
    if (G.mode === 'pecio') {
      G.mode = 'pecioPaused';
      musicDuck(true);
      ui.showPecioHUD(false); // los botones de la partida no tapan SEGUIR / ABANDONAR
      // el equipo, en filas compactas (las tarjetas grandes empujaban los botones fuera de la pantalla)
      const rows = SLOTS.filter((k) => G.pecio.player.gear[k]).map((k) => {
        const it = G.pecio.player.gear[k], R = LOOT_RAR[it.tier];
        return `<div class="pg-row"><span class="pg-it" style="--rc:${R.color}">${itemIcon(it)}</span><span><b>${itemName(it)}</b> <i style="color:${R.color}">${R.name}</i><small>${itemLines(it).find((l) => l.startsWith('★')) || itemLines(it)[0] || ''}</small></span></div>`;
      }).join('');
      const sets = setLines(G.pecio.player.sets).map((l) => `<small class="pg-set">${l}</small>`).join('');
      $('pBuild').innerHTML = `<small>🏚️ PECIOS · planta ${G.pecio.depth}</small>${rows ? `<div class="pause-gear">${rows}${sets}</div>` : ''}`;
      show('pause');
      return;
    }
    if (G.mode === 'galaxy') {
      G.mode = 'galaxyPaused';
      musicDuck(true);
      if (G.space) G.space.fireHeld = false;
      $('pBuild').innerHTML = '<small>🌌 GALAXIA</small>';
      show('pause');
      return;
    }
    if (G.mode === 'arena') {
      G.mode = 'arenaPaused';
      musicDuck(true);
      const a = G.arena;
      $('pBuild').innerHTML = arenaBuild(a);
      show('pause');
      return;
    }
    if (G.mode !== 'play') return;
    G.mode = 'paused';
    musicDuck(true);
    $('pBuild').innerHTML = buildSummary(G.run) || '<small>sin cartas todavía</small>';
    show('pause');
  },

  tutorial() {
    if (ui.showTip('runner')) return; // la GUÍA lo explica (y pausa); si ya se vio, la chuleta de siempre
    const t = $('tutorial');
    t.classList.remove('hidden');
    clearTimeout(ui._tut);
    ui._tut = setTimeout(() => t.classList.add('hidden'), 6500);
  },

  // Aspecto de una nave en el hangar: lo equipado, con lo que se esté probando encima
  lookOf(shipId) {
    const lk = equipped(save, shipId);
    const pv = ui.preview;
    if (pv && pv.ship === shipId) {
      for (const [g, id] of Object.entries(pv.items || {})) {
        const it = GROUPS[g].find((x) => x.id === id);
        if (!it) continue;
        lk[g] = it;
        if (g === 'palette') lk.basePalette = it;
      }
      lk.palette = tintEngine(lk.basePalette, lk.engine);
    }
    return lk;
  },

  // Bucle propio del canvas 3D del hangar (el mundo no se dibuja mientras el hangar está abierto)
  startHangarView(ship) {
    const cv = $('hangarView');
    if (!cv) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = cv.clientWidth || 300, H = cv.clientHeight || 170;
    cv.width = W * dpr;
    cv.height = H * dpr;
    // el estado se conserva entre repintados (giro, destello); el canvas es siempre el mismo
    ui._hv = Object.assign(ui._hv || { spin: 0.7, flash: 0, boost: 0 }, { ship }); // el MISMO objeto: el control de giro lo usa
    if (!cv.dataset.ready) {
      cv.dataset.ready = '1';
      orbitControl(cv, ui._hv);
    }
    if (ui._hvRunning) return;
    ui._hvRunning = true;
    let last = performance.now();
    const loop = (now) => {
      const view = $('hangarView');
      if (G.mode !== 'hangar' || !view || $('hangar').classList.contains('hidden')) { ui._hvRunning = false; return; }
      const s = ui._hv, dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      orbitStep(s, dt, s.spin);
      // vuelta rápida al comprar una mejora
      if (s.boost > 0) {
        const d = Math.min(s.boost, dt * 9);
        s.yaw += d;
        s.boost -= d;
      }
      s.flash = Math.max(0, s.flash - dt * 1.8);
      const ch = Math.round((view.clientHeight || 150) * dpr);
      if (view.height !== ch) view.height = ch; // cabecera compacta: menos alto, sin estirar el dibujo
      const c = view.getContext('2d');
      const w = view.width, h = view.height;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, w, h);
      // suelo con rejilla y halo del color de la nave
      const g = c.createRadialGradient(w / 2, h * 0.62, 0, w / 2, h * 0.62, w * 0.45);
      g.addColorStop(0, `${s.ship.color}55`);
      g.addColorStop(1, 'transparent');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      const lk = ui.lookOf(s.ship.id);
      const pal = lk.palette, edge = pal.edge || s.ship.color;
      const parts = (ui._hvParts ||= makeParticles());
      const sx = w / 2, sy = h * 0.52, size = h * 0.42 * (s.zoom || 1);
      // EXPLOSIÓN: al probarla, la nave estalla y se vuelve a montar (cada 2,4 s mientras la pruebes)
      const pv = ui.preview;
      const boomOn = pv && pv.ship === s.ship.id && (pv.items?.boom || pv.boomShow);
      if (boomOn && (!ui.boomAt || now - ui.boomAt > 2400)) {
        ui.boomAt = now;
        boomFx(parts, lk.boom.id, sx, sy, edge, s.ship.color, 0.32 * dpr);
      }
      parts.update(dt);
      if (!(boomOn && now - ui.boomAt < 1000)) {
        auraFx(c, lk.aura.id, sx, sy, size * 0.85, now / 1000);
        drawShip(c, s.ship.id, { ...pal, edge }, sx, sy, size,
          { yaw: s.yaw, pitch: s.pitch + Math.sin(now / 900) * 0.05, roll: Math.sin(now / 700) * 0.08 }, { line: 1.5 * dpr, ...emblemOpts(lk) });
        // ESTELA: la de la nave (o la que estés probando), saliendo hacia abajo
        trailFx(parts, c, lk.trail.id, sx, sy + size * 0.1, size * 1.2, pal.glow, 30, now / 1000);
      }
      parts.draw(c, w, h);
      if (s.flash > 0) {
        const fg = c.createRadialGradient(sx, sy, 0, sx, sy, w * 0.5);
        fg.addColorStop(0, `rgba(255,255,255,${(0.7 * s.flash).toFixed(3)})`);
        fg.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = fg;
        c.fillRect(0, 0, w, h);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },

  showAchievements() {
    G.mode = 'hangar'; // pantalla estática: el mundo no se dibuja
    $('achCount').textContent = `🏆 ${achCount(save)} / ${ACHIEVEMENTS.length}`;
    const swatch = (it) => it.group === 'palette' ? `<i class="ach-sw" style="background:linear-gradient(135deg, ${it.hull} 40%, ${it.edge} 40% 60%, ${it.glow} 60%)"></i>`
      : `<i class="ach-sw" style="background:${it.color};box-shadow:0 0 8px ${it.color}"></i>`;
    const ICON = { palette: '🎨', stripe: '🏁', engine: '🔥', shot: '🔫', cockpit: '🪟' };
    const box = $('achList');
    box.innerHTML = '';
    // los conseguidos, arriba (con su EQUIPAR)
    const list = [...ACHIEVEMENTS].sort((x, y) => (save.ach[y.id]?.done ? 1 : 0) - (save.ach[x.id]?.done ? 1 : 0));
    for (const a of list) {
      const st = save.ach[a.id] || { p: 0, done: false };
      const k = Math.min(1, st.p / a.n);
      const it = achStyle(a.id);
      const on = st.done && equipped(save, save.ship)[it.group]?.id === it.id;
      const row = el('div', `item ach-item t-${a.tier}${st.done ? ' sel' : ' locked'}`, `
        <span class="i-icon">${st.done ? '🏆' : '🔒'}</span>
        <span class="i-body"><b>${a.name}</b><small>${a.desc}</small>
          <small class="ach-prize">${swatch(it)} ${ICON[it.group]} ${it.name} · +${ACH_GEMS[a.tier]} 💎</small>
          ${st.done ? '' : `<div class="m-bar"><i style="transform:scaleX(${k.toFixed(3)})"></i></div><small>${fmt(st.p)} / ${fmt(a.n)}${a.mode === 'best' ? ' (en una partida)' : ''}</small>`}</span>
        <span class="i-act">${st.done ? `<button class="btn ghost ach-eq" ${on ? 'disabled' : ''}>${on ? 'PUESTO' : 'EQUIPAR'}</button>` : ''}</span>`);
      row.dataset.ach = a.id;
      const eq = row.querySelector('.ach-eq');
      eq && tap(eq, () => {
        equip(it.group, it.id, save, save.ship);
        persist();
        toast(`🎨 ${it.name} en tu ${SHIPS.find((x) => x.id === save.ship).name}`);
        ui.showAchievements();
      });
      box.append(row);
    }
    show('achs');
  },

  // Colección: lo descubierto con su icono; lo que falta, en silueta
  showCodex() {
    G.mode = 'hangar';
    ui.renderDeck();
    const cards = save.codex.cards || {}, syn = save.codex.syn || {}, bosses = save.codex.bosses || {};
    const cell = (found, icon, name, n) => `<div class="cx${found ? '' : ' unknown'}"><span>${found ? icon : '❔'}</span><small>${found ? name : '???'}</small>${found && n ? `<em>x${n}</em>` : ''}</div>`;
    $('codexCards').innerHTML = CARDS.map((c) => cell(cards[c.id], c.icon, c.name, cards[c.id])).join('');
    $('codexSyn').innerHTML = SYNERGIES.map((s) => cell(syn[s.id], '⚡', s.name, syn[s.id])).join('');
    $('codexBosses').innerHTML = BOSS_NAMES.map((b) => cell(bosses[b], '👾', b, bosses[b])).join('');
    const found = Object.keys(cards).length + Object.keys(syn).length + Object.keys(bosses).length;
    $('codexCount').textContent = `📖 ${found} / ${CARDS.length + SYNERGIES.length + BOSS_NAMES.length} descubiertos`;
    show('codex');
  },

  pulseAbility() {
    const b = $('abilityBtn');
    b.classList.remove('pulse');
    void b.offsetWidth;
    b.classList.add('pulse');
  },

  pulseMult() {
    const m = $('mult');
    m.classList.remove('pop');
    void m.offsetWidth;
    m.classList.add('pop');
  },

  updateHUD(dt) {
    const r = G.run;
    if (!r) return;
    shownScore += (r.score - shownScore) * Math.min(1, dt * 10);
    if (Math.abs(r.score - shownScore) < 1) shownScore = r.score;
    if (r.score < shownScore) shownScore = r.score;
    setText('score', fmt(shownScore));
    setText('mult', `x${r.mult}`);
    const mEl = $('mult');
    const hue = Math.min(r.mult * 6, 330);
    if (hudCache.multHue !== hue) { hudCache.multHue = hue; mEl.style.color = `hsl(${hue},100%,62%)`; }
    setTf($h('chainbar').firstElementChild, `scaleX(${Math.max(0, 1 - r.chainT / 3).toFixed(3)})`);
    setHTML('speed', `${Math.round(effSpeed(r) * 10)}<small> KM/H</small>`);
    setText('dist', `${fmt(r.dist)} m`);
    setText('coins', `🪙 ${r.coins}`);
    setText('shields', '🛡️'.repeat(r.shields) + '▫️'.repeat(Math.max(0, shieldCap(r) - r.shields)));
    const a = r.ability;
    const ab = $h('abilityBtn');
    setVar(ab, '--f', readiness(a).toFixed(3));
    setText('abilityIcon', ABILITIES[a.id].icon);
    tgl(ab, 'ready', a.cdLeft <= 0 && a.active <= 0);
    tgl(ab, 'active', a.active > 0);
    const od = $h('odbar');
    setTf(od.firstElementChild, `scaleX(${(r.odTime > 0 ? r.odTime / r.stats.odDur : r.od).toFixed(3)})`);
    tgl(od, 'active', r.odTime > 0);
    // RECALENTANDO: tras un overdrive la barra no carga unos segundos
    tgl(od, 'cool', r.odCool > 0);
    setText('odLabel', r.odCool > 0 ? 'RECALENTANDO' : 'OVERDRIVE');
    // cargas de DASH: los <i> se crean una vez (al cambiar cuántas hay); luego solo cambia su --f
    const full = Math.floor(r.dashCharges);
    const part = r.dashCharges - full;
    const dashEl = $h('dash');
    if (dashEl._n !== r.stats.dashMax) {
      dashEl._n = r.stats.dashMax;
      dashEl.innerHTML = '<i></i>'.repeat(r.stats.dashMax);
    }
    for (let i = 0; i < dashEl.children.length; i++) {
      const f = i < full ? 1 : i === full ? part : 0;
      setVar(dashEl.children[i], '--f', f.toFixed(2));
      tgl(dashEl.children[i], 'ready', f >= 1);
    }
    const rt = $('raceTag');
    if (r.race) {
      const pos = racePosition(r);
      const g = ghostAt(r.race.ghost, r.time);
      const ghostGap = g ? ` · 👻 ${((r.dist - g.z) / Math.max(1, r.speed)).toFixed(1)} s` : '';
      if (r.race.solo) {
        const i = r.race.targets.findIndex((x) => r.time <= x);
        setText('raceTag', `⏱️ ${r.time.toFixed(1)} s${i >= 0 ? ` · ${MEDALS[i]} ${r.race.targets[i].toFixed(0)}` : ''}${ghostGap}`);
      } else setText('raceTag', `${pos}.º / ${r.race.rivals.length + 1}${ghostGap}`);
      rt.classList.remove('hidden');
      rt.classList.toggle('first', pos === 1);
    } else rt.classList.add('hidden');
    const ev = $('eventTag');
    if (r.event) {
      setText('eventTag', `${r.event.name} ${Math.ceil(r.eventT)}s`);
      ev.classList.remove('hidden');
    } else ev.classList.add('hidden');
  },
};
