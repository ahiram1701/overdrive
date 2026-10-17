// Capa DOM: HUD, menú, hangar, cartas, tienda, cofre, muerte y pausa.
import { G, fmt, shieldCap } from './state.js';
import { save, persist } from './save.js';
import { sfx, setSound, unlockAudio, musicStop, musicDuck } from './audio.js';
import { fx } from './fx.js';
import { todayKey } from './rng.js';
import { missions } from './missions.js';
import { rankOf, ACHIEVEMENTS, ACH_GEMS, achCount, MAX_RANK, effectiveRank, prestigeOf, prestigeBonus, canPrestige, doPrestige, PRESTIGE_REWARDS } from './progress.js';
import { BOSS_NAMES, BIOMES } from './world.js';
import { GROUPS, isUnlocked, lockText, buyCosmetic, equip, equipped, itemsFor, emblemOpts, setEmblemStyle, EMBLEM_AT, EMBLEM_COLORS } from './cosmetics.js';
import { drawShip, emblemPath } from './shipdraw.js';
import { trailFx, boomFx, makeParticles } from './cosfx.js';
import { RARITY, CARDS, CARD_BY_ID, SHIPS, META, SYNERGIES, offerCards, availableCards, synergyHint, shipLvls, shipProfile, treeOf, PROFILE_KEYS, TREE_COSTS } from './upgrades.js';
import { newRun, pickCard, resume, effSpeed, useAbility, progress, expChoose, expEventChoice, expRest, racePosition } from './game.js';
import { ACTS, ROWS, NODE, nodeById, canChoose } from './expedition.js';
import { CUPS, MEDALS, isCupOpen, ghostAt } from './race.js';
import { newSpace, dock, undock, sellAll, buyUpgrade, repair, spaceBoost, leaveSpace, spaceStats, GAL, stationPrices, buyPrice, buyOre, setRoute, boardNow, acceptMission, abandonMission, atlasCount } from './spaceGame.js';
import { allPois, POI_KINDS, ATLAS_PERKS, MISSION_KINDS, MAX_ACTIVE } from './galaxyMissions.js';
import { canJump, jumpNeeded, known, route } from './galaxy.js';
import { UPGRADES as SP_UP, MAX_UP, upgradeCost as spUpCost, repairCost, ORES, cargoCount } from './galaxyData.js';
import { ABILITIES, readiness } from './abilities.js';
import { levelById, visibleSectors, frontier, FIXED_SECTORS, starsOf, starCount, totalStars, isSectorOpen, isLevelOpen } from './campaign.js';
import { BOSS_BY_ID } from './bosses.js';
import { newArena, pickArenaUpgrade, useArenaAbility, fmtTime } from './arena.js';
import { WEAPONS, PASSIVES, EVOLUTIONS, ARENA_TIME, xpNeed } from './arenaData.js';
import { MODS, MOD_BY_ID, cleanMods, modScore, modGems, toggleMod, mutationOf } from './modifiers.js';

const $ = (id) => document.getElementById(id);
const OVERLAYS = ['menu', 'settings', 'station', 'galMap', 'atlas', 'hangar', 'achs', 'codex', 'arenaUp', 'arenaEnd', 'expMap', 'expEvent', 'expRest', 'expEnd', 'raceCups', 'racePodium', 'mods', 'campaign', 'victory', 'cards', 'shop', 'chest', 'death', 'pause'];

// Pantallas con la barra inferior (navegación principal) y su cabecera "← título"
const NAV_SCREENS = new Set(['menu', 'hangar', 'achs', 'codex']);
const BACK = {}; // id de pantalla -> qué hace "atrás" (botón ←, Esc o el atrás de Android)
let current = null, pushed = false, skipPop = false;

function show(id) {
  for (const o of OVERLAYS) $(o).classList.toggle('hidden', o !== id);
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

function tap(node, fn) {
  node.addEventListener('click', (e) => {
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
    tap($('btnPlay'), () => newRun(false));
    tap($('btnDaily'), () => newRun(true));
    tap($('btnMods'), () => ui.showMods());
    tap($('btnArena'), () => newArena());
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
    tap($('btnExpedition'), () => newRun({ mode: 'expedition' }));
    tap($('btnExpAgain'), () => newRun({ mode: 'expedition' }));
    tap($('btnExpMenu'), () => ui.showMenu());
    tap($('btnRaces'), () => ui.showRaceCups());
    tap($('btnRaceMenu'), () => ui.showRaceCups());
    tap($('btnRaceNext'), () => { const res = ui.lastRace; if (res?.next) newRun({ mode: 'race', track: res.next, points: res.points }); });
    tap($('btnRaceRetry'), () => { const res = ui.lastRace; if (res) newRun({ mode: 'race', track: res.track.id, points: res.pointsBefore }); });
    tap($('btnRestShield'), () => expRest('shield'));
    tap($('btnRestCard'), () => expRest('card'));
    tap($('btnArenaRetry'), () => newArena());
    tap($('btnArenaMenu'), () => ui.showMenu());
    tap($('arenaPause'), () => ui.pause());
    $('arenaAbility').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
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
    screenHeader('settings', 'AJUSTES', () => ui.showMenu());
    screenHeader('achs', '🏆 LOGROS', () => ui.showMenu());
    screenHeader('codex', '📖 COLECCIÓN', () => ui.showMenu());
    screenHeader('campaign', '🗺️ CAMPAÑA', () => ui.showMenu());
    screenHeader('mods', '⚙️ MODIFICADORES', () => ui.showMenu());
    screenHeader('raceCups', '🏆 CARRERAS', () => ui.showMenu());
    screenHeader('atlas', '📖 ATLAS', () => ui.showStation(G.space));
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
    tap($('tgInvert'), () => { save.settings.invertY = !save.settings.invertY; persist(); ui.syncToggles(); });
    tap($('tgLevel'), () => { save.settings.autoLevel = !save.settings.autoLevel; persist(); ui.syncToggles(); });
    tap($('btnResume'), () => {
      if (G.mode === 'arenaPaused') { G.mode = 'arena'; musicDuck(false); ui.hideAll(); ui.showArenaHUD(true); }
      else if (G.mode === 'galaxyPaused') { G.mode = 'galaxy'; musicDuck(false); ui.hideAll(); ui.showSpaceHUD(true); } else resume();
    });
    tap($('btnQuit'), () => { if (G.space) leaveSpace(); musicStop(); G.arena = null; ui.showArenaHUD(false); ui.showMenu(); });
    tap($('pauseBtn'), () => ui.pause());
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
  },

  showSettings() {
    G.mode = 'hangar'; // pantalla estática
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
    G.mode = 'menu';
    G.run = null;
    G.arena = null;
    G.space = null;
    ui.showArenaHUD(false);
    ui.showSpaceHUD(false);
    G.player = null;
    ui.showHUD(false);
    $('mBest').textContent = fmt(save.best);
    $('mGems').textContent = fmt(save.gems);
    $('mDaily').textContent = save.daily.key === todayKey() && save.daily.best ? `hoy ${fmt(save.daily.best)}` : 'pista nueva';
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
    $('mGalaxy').textContent = save.galaxy.started ? `💰 ${fmt(save.galaxy.credits)} · ${GAL[save.galaxy.sys ?? 0].name}` : 'explora, mina, comercia y lucha';
    const golds = Object.values(save.raceCups).filter((m) => m === 0).length;
    $('mRace').textContent = Object.keys(save.raceCups).length ? `${golds} 🥇` : '3 copas';
    const eb = save.expedition.best;
    $('mExp').textContent = save.expedition.wins ? `✔ ${save.expedition.wins}` : eb ? `acto ${Math.floor(eb / 10) + 1}` : 'roguelite';
    $('mArena').textContent = save.arena.best ? `récord ${fmtTime(save.arena.best)}` : 'sobrevive 10:00';
    $('mStars').textContent = `★ ${totalStars(save)}${frontier(save) > FIXED_SECTORS ? ` · sector ${frontier(save)}` : ''}`;
    const sel = cleanMods(save.modsLast, effectiveRank(save));
    $('mMods').textContent = sel.length ? `x${modScore(sel).toFixed(1)}` : '';
    const mut = mutationOf(todayKey());
    const mutDone = save.mutation.key === todayKey() && save.mutation.played;
    $('mMut').textContent = `${mut.map((id) => MOD_BY_ID[id].icon).join('')}${mutDone ? '' : ' x1,5 💎'}`;
    show('menu');
  },

  // Hangar: carrusel de naves, ficha con stats comparadas con la equipada y árbol de mejoras.
  showHangar(viewId = ui.hangarView || save.ship) {
    ui.hangarView = viewId;
    G.mode = 'hangar';
    ui.hangarTab ||= 'nave';
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
      const stars = lv.a + lv.b + lv.c;
      const b = el('button', `ship-chip${s.id === view.id ? ' viewing' : ''}${save.ship === s.id ? ' equipped' : ''}${has ? '' : ' locked'}${prestigeOf(save) >= 5 ? ' gold' : ''}`);
      b.style.setProperty('--sc', s.color);
      b.innerHTML = `<canvas class="sc-mini" width="96" height="60"></canvas><b>${s.name}</b><small>${has ? (stars ? `★ ${stars}/9` : ABILITIES[s.ability].icon) : `💎 ${s.cost}`}</small>`;
      tap(b, () => { ui.preview = null; ui.showHangar(s.id); });
      car.appendChild(b);
      // cada nave con SU pintura y SU emblema
      const lk = equipped(save, s.id);
      drawShip(b.querySelector('canvas').getContext('2d'), s.id, { ...lk.palette, edge: lk.palette.edge || s.color },
        48, 34, 34, { yaw: 0.5, pitch: -0.5 }, { line: 1.2, ...emblemOpts(lk) });
    }
    car.querySelector('.viewing')?.scrollIntoView({ block: 'nearest', inline: 'center' });

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
    else action = `<button class="btn big" id="btnBuyShip" ${save.gems < view.cost ? 'disabled' : ''}>COMPRAR · 💎 ${view.cost}</button>`;
    $('shipDetail').innerHTML = `
      <div class="sd-head" style="--sc:${view.color}"><div><h3>${view.name}</h3><small>${view.desc}</small></div></div>
      <div class="sd-ability"><span>${ab.icon}</span><div><b>${ab.name}</b> · recarga ${(ab.cd * (lv.c >= 1 ? 0.85 : 1)).toFixed(1)} s<br><small>${ab.desc}</small></div></div>
      <div class="stats">${bars}</div>
      ${action}`;
    $('btnEquip') && tap($('btnEquip'), () => { save.ship = view.id; persist(); fx.vibe(20); ui.showHangar(); });
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

    // árbol de mejoras: 3 ramas x 3 niveles, en orden
    const tree = $('shipTree');
    tree.innerHTML = '';
    tree.classList.toggle('locked', !owned);
    for (const br of treeOf(view, ab.name, ab.icon)) {
      const col = el('div', `branch b-${br.key}`);
      col.innerHTML = `<h4>${br.icon} ${br.name}</h4>`;
      br.nodes.forEach((n, i) => {
        const bought = lv[br.key] > i;
        const next = lv[br.key] === i;
        const afford = owned && next && save.gems >= n.cost;
        const node = el('button', `node${bought ? ' bought' : ''}${next ? ' next' : ''}${afford ? ' afford' : ''}${i === 2 ? ' mut' : ''}`);
        node.innerHTML = `<small>${i === 2 ? '★ NIVEL 3' : `NIVEL ${i + 1}`}</small><span>${n.desc}</span><b>${bought ? '✔' : `💎 ${n.cost}`}</b>`;
        tap(node, () => {
          if (!afford) {
            if (next && owned) { node.classList.add('shake'); fx.vibe(50); setTimeout(() => node.classList.remove('shake'), 300); }
            return;
          }
          save.gems -= n.cost;
          save.shipLvl[view.id] = { ...lv, [br.key]: i + 1 };
          persist();
          sfx.chest();
          fx.vibe([20, 30, 60]);
          if (ui._hv) { ui._hv.flash = 1; ui._hv.boost = Math.PI * 2; } // la nave lo celebra arriba
          ui.showHangar();
          tree.querySelector(`.b-${br.key} .node:nth-of-type(${i + 1})`)?.classList.add('just');
        });
        col.appendChild(node);
      });
      tree.appendChild(col);
    }
    if (!owned) tree.insertAdjacentHTML('beforeend', '<p class="tree-lock">Compra la nave para mejorarla</p>');

    // vista 3D: la nave girando (arrastra para girarla)
    ui.startHangarView(view);

    // personalizar: lo de ESTA nave. Tocar algo lo prueba en la vista 3D; comprar es aparte.
    $('cosTitle').textContent = `Personalizar · ${view.name}`;
    const eq = equipped(save, view.id);
    const pv = ui.preview?.ship === view.id ? ui.preview : null;
    const groups = [['palette', '🎨 Pintura'], ['trail', '✨ Estela'], ['boom', '💥 Explosión'], ['emblem', '🛡️ Emblema']];
    const cosm = $('cosmetics');
    cosm.innerHTML = '';
    for (const [g, label] of groups) {
      const row = el('div', 'cos-row', `<small>${label}</small>`);
      const chips = el('div', 'cos-chips');
      for (const it of itemsFor(g, view.id)) {
        const open = isUnlocked(it, save, view.id);
        const on = eq[g].id === it.id;
        const trying = pv && pv.group === g && pv.id === it.id;
        let icon = '';
        if (g === 'palette') {
          const fill = it.alt ? `linear-gradient(90deg, ${it.hull} 50%, ${it.alt} 50%)` : it.hull;
          icon = `<i style="background:${fill};box-shadow:0 0 0 2px ${it.edge || view.color}"></i>`;
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
          if (open && owned) {
            equip(g, it.id, save, view.id);
            persist();
            ui.preview = g === 'boom' ? { ship: view.id, group: g, id: it.id, equipped: true } : null;
            fx.vibe(20);
          } else {
            ui.preview = { ship: view.id, group: g, id: it.id };
          }
          if (g === 'boom') ui.boomAt = 0; // la explosión se ve al momento
          ui.showHangar();
        });
        chips.appendChild(c);
      }
      row.appendChild(chips);
      cosm.appendChild(row);
      if (g === 'emblem' && eq.emblem.id !== 'none' && owned) {
        const style = el('div', 'cos-style');
        style.innerHTML = `<div class="seg">${EMBLEM_AT.map(([k, name]) => `<button data-at="${k}" class="${eq.emblemAt === k ? 'on' : ''}">${name}</button>`).join('')}</div>
          <div class="swatches">${Object.entries(EMBLEM_COLORS).map(([k, hex]) => `<button data-color="${k}" class="${eq.emblemColor === k ? 'on' : ''}" aria-label="${k}"
            style="background:${hex || `conic-gradient(${eq.palette.glow} 0 50%, ${eq.palette.edge || view.color} 0)`}"></button>`).join('')}</div>`;
        for (const b of style.querySelectorAll('button')) {
          tap(b, () => {
            setEmblemStyle(save, view.id, { at: b.dataset.at, color: b.dataset.color });
            persist();
            fx.vibe(15);
            ui.showHangar();
          });
        }
        cosm.appendChild(style);
      }
    }
    // barra de prueba: comprar o cancelar
    const bar = $('cosPreview');
    const pit = pv && !pv.equipped && GROUPS[pv.group].find((x) => x.id === pv.id);
    bar.classList.toggle('hidden', !pit);
    bar.innerHTML = '';
    if (pit) {
      const u = pit.unlock || {};
      let act;
      if (!owned) act = '<small>Compra la nave para personalizarla</small>';
      else if (u.gems) act = `<button class="btn" id="btnCosBuy" ${save.gems < u.gems ? 'disabled' : ''}>COMPRAR · 💎 ${u.gems}</button>`;
      else act = `<small>🔒 ${u.stat ? `Exclusivo: ${lockText(pit, save, view.id)} con ${view.name}` : `Se desbloquea con ${lockText(pit)}`}</small>`;
      bar.innerHTML = `<div class="pv-name">PROBANDO: <b>${pit.name}</b></div>${act}<button class="btn ghost" id="btnCosCancel">CANCELAR</button>`;
      tap($('btnCosCancel'), () => { ui.preview = null; ui.showHangar(); });
      $('btnCosBuy') && tap($('btnCosBuy'), () => {
        if (!buyCosmetic(pit, save, view.id)) return;
        equip(pv.group, pit.id, save, view.id);
        persist();
        sfx.chest();
        fx.vibe([30, 40, 80]);
        ui.preview = null;
        ui.showHangar();
      });
    }

    // mejoras globales (todas las naves)
    const ml = $('metaList');
    ml.innerHTML = '';
    for (const m of META) {
      const has = save.meta[m.id];
      const row = el('button', `item${has ? ' sel' : ''}${!has && save.gems < m.cost ? ' locked' : ''}`);
      row.innerHTML = `<span class="i-icon">${m.icon}</span>
        <span class="i-body"><b>${m.name}</b><small>${m.desc}</small></span>
        <span class="i-act">${has ? '✔' : `💎 ${m.cost}`}</span>`;
      tap(row, () => {
        if (has || save.gems < m.cost) return;
        save.gems -= m.cost;
        save.meta[m.id] = true;
        persist();
        sfx.chest();
        ui.showHangar();
      });
      ml.appendChild(row);
    }

    // pestañas: solo se ve la activa; un puntito avisa de que hay algo que ya puedes comprar
    const lvNow = shipLvls(save.shipLvl, view.id);
    const treeBuy = owned && ['a', 'b', 'c'].some((k) => lvNow[k] < 3 && save.gems >= TREE_COSTS[k][lvNow[k]]);
    const dots = {
      nave: !owned && save.gems >= view.cost,
      mejoras: treeBuy,
      estilo: false,
      global: META.some((m) => !save.meta[m.id] && save.gems >= m.cost),
    };
    for (const b of $('hTabs').querySelectorAll('button')) {
      b.classList.toggle('on', b.dataset.tab === ui.hangarTab);
      b.classList.toggle('dot', !!dots[b.dataset.tab]);
      b.setAttribute('aria-selected', b.dataset.tab === ui.hangarTab);
    }
    for (const panel of $('hangar').querySelectorAll('.tab-panel')) panel.classList.toggle('hidden', panel.dataset.panel !== ui.hangarTab);
    show('hangar');
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
    const price = (c) => Math.round({ common: 25, rare: 50, epic: 90 }[c.rarity] * (1 + run.section * 0.1));
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
    $('dNew').classList.toggle('hidden', !(res.isBest || res.dailyBest));
    $('dNew').textContent = res.daily ? (res.dailyBest ? '¡RÉCORD DEL DÍA!' : '') : '¡NUEVO RÉCORD!';
    const cells = [
      ['Distancia', `${fmt(res.dist)} m`], ['Combo máx.', `x${res.maxMult}`], ['Near-miss', res.near],
      ['Roturas', res.breaks], ['Tramo', res.section], ['Jefes', res.bosses],
    ];
    $('dGrid').innerHTML = cells.map(([k, v]) => `<div><b>${v}</b><small>${k}</small></div>`).join('');
    const modTxt = res.mods?.length ? ` · ${res.mods.map((id) => MOD_BY_ID[id].icon).join('')} x${modGems(res.mods).toFixed(2)}` : '';
    $('dGems').innerHTML = `+${res.gems} 💎 <small>(total ${fmt(save.gems)})${modTxt}${res.mutationBonus ? ' · 🧬 x1,5' : ''}${prestigeBonus(save) ? ` · ✨ +${Math.round(prestigeBonus(save) * 100)}%` : ''}</small>`;
    // cuánto faltó para el récord: el "casi" es lo que hace darle a reintentar
    $('dExtra').textContent = res.exp ? `EXPEDICIÓN · acto ${res.exp.act + 1} de ${ACTS.length}, fila ${res.exp.row + 1} de ${ROWS}`
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
    $('vGems').innerHTML = res.gems ? `+${res.gems} 💎 <small>(total ${fmt(save.gems)})</small>` : `<small>★ ${totalStars(save)}</small>`;
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
    $('spaceHud').classList.toggle('hidden', !on);
    if (on) { $('hud').classList.add('hidden'); $('arenaHud').classList.add('hidden'); }
  },

  updateSpaceHUD() {
    const s = G.space;
    if (!s || $('spaceHud').classList.contains('hidden')) return;
    const st = spaceStats(), g = save.galaxy;
    $('spaceHud').querySelector('.sh-bar.shield i').style.transform = `scaleX(${(s.ship.shield / st.shield).toFixed(3)})`;
    $('spaceHud').querySelector('.sh-bar.hull i').style.transform = `scaleX(${Math.max(0, s.ship.hull / st.hull).toFixed(3)})`;
    const n = cargoCount(g.cargo);
    $('spaceHud').querySelector('.sh-bar.cargo i').style.transform = `scaleX(${Math.min(1, n / st.cargo).toFixed(3)})`;
    setText('shCargo', `${n}/${st.cargo}`);
    setText('shCredits', fmt(g.credits));
    setText('shObjective', s.objective ? `▸ ${s.objective.text}` : '');
    const sd = GAL[s.sysId];
    setText('shSystem', `${sd.name} ${'☠'.repeat(sd.danger)}`);
    const heat = $('spaceHud').querySelector('.sh-bar.heat i');
    heat.style.transform = `scaleX(${Math.min(1, s.heat).toFixed(3)})`;
    heat.parentElement.classList.toggle('over', s.overheat);
    $('btnDock').classList.toggle('hidden', !s.canDock);
    $('btnBoost').classList.toggle('cool', s.ship.boostCd > 0);
    $('shHint').classList.toggle('hidden', s.t > 8);
  },

  // Estación: mercado, taller y reparación, todo en una pantalla
  showStation(s) {
    ui.showSpaceHUD(false); // atracado: solo la estación
    const g = save.galaxy, st = spaceStats();
    const sd = GAL[s.sysId], prices = stationPrices(s.sysId);
    setText('stTitle', `🛰️ ESTACIÓN ${sd.name}`);
    setText('stCredits', fmt(g.credits));
    const items = Object.entries(g.cargo).filter(([, n]) => n > 0);
    $('stCargo').innerHTML = items.length
      ? items.map(([k, n]) => `<div><span>${ORES[k].icon} ${ORES[k].name}</span><b>${n} × ${prices[k]} = ${n * prices[k]} 💰</b></div>`).join('')
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
      const lvl = g.up[id] || 0, c = spUpCost(id, lvl);
      const b = el('button', `st-up${c !== null && g.credits >= c ? ' afford' : ''}`, `<span class="su-icon">${u.icon}</span>
        <span class="su-body"><b>${u.name}</b><small>${u.desc}</small><i>${'●'.repeat(lvl)}${'○'.repeat(MAX_UP - lvl)}</i></span>
        <span class="su-cost">${c === null ? 'MÁX' : `${c} 💰`}</span>`);
      b.dataset.up = id;
      b.disabled = c === null;
      tap(b, () => {
        if (!buyUpgrade(id)) { b.classList.add('shake'); fx.vibe(50); setTimeout(() => b.classList.remove('shake'), 300); return; }
        fx.vibe([20, 30, 60]);
        ui.showStation(s);
      });
      box.append(b);
    }
    // TABLÓN: misiones activas (con su progreso) y ofertas de esta estación
    const mBox = $('stMissions');
    mBox.innerHTML = '';
    for (const m of g.missions) {
      const row = el('div', 'st-mis active', `<span>${MISSION_KINDS[m.kind].icon}</span><div><b>${m.text}</b><small>${m.n > 1 ? `${m.progress}/${m.n} · ` : ''}+${m.reward} 💰 · +${m.gems} 💎</small></div>`);
      const x = el('button', 'btn ghost', '✕');
      x.title = 'Abandonar';
      tap(x, () => { abandonMission(m.id); ui.showStation(s); });
      row.append(x);
      mBox.append(row);
    }
    for (const m of boardNow(s)) {
      const row = el('div', 'st-mis', `<span>${MISSION_KINDS[m.kind].icon}</span><div><b>${m.text}</b><small>+${m.reward} 💰 · +${m.gems} 💎</small></div>`);
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

  // ATLAS: lo descubierto, con su historia, y las mejoras únicas que da explorar
  showAtlas() {
    const pois = allPois(GAL);
    const n = atlasCount();
    setText('atCount', `📖 ${n} / ${pois.length} descubiertos`);
    $('atPerks').innerHTML = ATLAS_PERKS.map((pk) => `<div class="${n >= pk.n ? 'on' : ''}"><b>${n >= pk.n ? '✨' : '🔒'} ${pk.name}</b><small>${pk.desc} · ${pk.n} descubrimientos</small></div>`).join('');
    const found = pois.filter((p) => save.galaxyAtlas[p.id]);
    $('atList').innerHTML = found.length
      ? found.map((p) => `<div class="item"><span class="i-icon">${POI_KINDS[p.kind].icon}</span><span class="i-body"><b>${POI_KINDS[p.kind].name} · ${GAL[p.sys].name}</b><small>${p.lore}</small></span></div>`).join('')
      : '<small>Aún no has descubierto nada. Busca los marcadores en cada sistema y vuela cerca para escanearlos.</small>';
    show('atlas');
  },

  // Mapa galáctico: los sistemas conocidos (visitados y sus vecinos), rutas y peligro
  showGalMap(sel = null) {
    const s = G.space;
    if (!s) return;
    if (G.mode === 'galaxy') { G.mode = 'galaxyMap'; musicDuck(true); if (s) s.fireHeld = false; }
    const g = save.galaxy;
    const seen = known(GAL, g.visited);
    const path = s.routeTo !== null ? route(GAL, s.sysId, s.routeTo) || [] : [];
    const onPath = (a, b) => path.some((x, i) => i && ((path[i - 1] === a && x === b) || (path[i - 1] === b && x === a)));
    const dcol = (d) => ['#30d158', '#7df9ff', '#ffe600', '#ff9f0a', '#ff6a00', '#ff2d55', '#bf5af2'][Math.min(6, d)];
    let svg = '';
    for (const a of GAL) {
      if (!seen.has(a.id)) continue;
      for (const b of a.links) if (b > a.id && seen.has(b)) svg += `<line x1="${a.x}" y1="${a.y}" x2="${GAL[b].x}" y2="${GAL[b].y}" class="${onPath(a.id, b) ? 'path' : ''}"/>`;
    }
    for (const a of GAL) {
      if (!seen.has(a.id)) continue;
      const visited = g.visited.includes(a.id);
      const here = a.id === s.sysId, lock = !canJump(a, g.up.jump || 0);
      svg += `<g class="gm-node${here ? ' here' : ''}${a.id === sel ? ' sel' : ''}${visited ? '' : ' unknown'}" data-sys="${a.id}">
        <circle cx="${a.x}" cy="${a.y - 10}" r="44" fill="transparent" class="hit"/>
        <circle cx="${a.x}" cy="${a.y}" r="${here ? 22 : 16}" fill="${visited ? dcol(a.danger) : '#333'}"/>
        <text x="${a.x}" y="${a.y - 26}">${visited ? a.name : '???'}${lock ? ' 🔒' : ''}${a.id === (g.home ?? 0) ? ' 🏠' : ''}</text></g>`;
    }
    $('gmSvg').innerHTML = svg;
    // encuadre: solo lo que conoces (con margen), para que el mapa no sea un puntito en medio
    const xs = GAL.filter((a) => seen.has(a.id)).map((a) => a.x), ys = GAL.filter((a) => seen.has(a.id)).map((a) => a.y);
    const pad = 90, x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
    const side = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 260) + pad * 2;
    $('gmSvg').setAttribute('viewBox', `${x0} ${y0} ${side} ${side}`);
    for (const n of $('gmSvg').querySelectorAll('.gm-node')) n.addEventListener('click', () => ui.showGalMap(Number(n.dataset.sys)));
    const info = $('gmInfo');
    if (sel !== null) {
      const a = GAL[sel], visited = g.visited.includes(sel);
      const r = route(GAL, s.sysId, sel);
      info.innerHTML = `<b>${visited ? a.name : 'Sistema sin explorar'}</b>
        <small>${visited ? `Peligro ${'☠'.repeat(a.danger) || 'ninguno'} · mineral ${ORES[a.ore].icon} ${ORES[a.ore].name}` : 'Se ve desde un sistema vecino'} · ${r ? r.length - 1 : '?'} saltos</small>
        ${!canJump(a, g.up.jump || 0) ? `<small class="warn">🔒 Necesitas Salto ${jumpNeeded(a)}</small>` : ''}`;
      if (sel !== s.sysId) {
        const go = el('button', 'btn', '🧭 TRAZAR RUTA');
        go.id = 'btnRoute';
        tap(go, () => { setRoute(sel); G.mode = 'galaxy'; musicDuck(false); ui.hideAll(); ui.showSpaceHUD(true); });
        info.append(go);
      }
    } else info.innerHTML = `<small>Estás en <b>${GAL[s.sysId].name}</b>. Has visitado ${g.visited.length} de ${GAL.length} sistemas.</small>`;
    ui.showSpaceHUD(false);
    show('galMap');
  },

  // ---------- CARRERAS ----------
  showRaceCups() {
    G.mode = 'hangar'; // pantalla estática
    G.run = null;
    G.player = null;
    ui.showHUD(false);
    const list = $('rcList');
    list.innerHTML = '';
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
  },

  showRacePodium(res) {
    ui.lastRace = res;
    ui.deathAt = performance.now();
    setText('rpTitle', res.pos === 0 ? '¡VICTORIA!' : `${res.pos + 1}.º PUESTO`);
    $('rpTitle').className = res.pos === 0 ? 'won' : '';
    setText('rpTrack', `${res.cup.name} · ${res.track.idx + 1}/3 · ${res.track.name}`);
    $('rpOrder').innerHTML = res.order.map((x, i) => `<div class="${x.you ? 'you' : ''}" style="--rc:${x.color}"><b>${i + 1}.º</b><span>${x.name}</span><em>${x.t.toFixed(1)} s</em><small>+${[10, 6, 3, 1][i]}</small></div>`).join('');
    setText('rpGhost', res.hadGhost ? (res.ghostBeaten ? '👻 ¡Has batido a tu fantasma!' : `👻 Tu mejor tiempo: ${res.best.toFixed(1)} s`) : '👻 Fantasma guardado: la próxima vez corres contra ti');
    const table = Object.entries(res.points).sort((a, b) => b[1] - a[1]);
    const names = { you: 'TÚ', 0: 'BRUTO', 1: 'SEDA', 2: 'CHISPA' };
    $('rpCup').innerHTML = `<small>${res.cupEnd ? 'CLASIFICACIÓN FINAL' : 'CLASIFICACIÓN DE LA COPA'}</small>${table.map(([k, v], i) => `<div class="${k === 'you' ? 'you' : ''}"><b>${i + 1}.</b> ${names[k]} <em>${v} pts</em></div>`).join('')}${res.cupEnd ? `<div class="rp-medal">${res.medal !== null ? `${MEDALS[res.medal]} ¡${['ORO', 'PLATA', 'BRONCE'][res.medal]}!` : 'Sin medalla esta vez'}</div>` : ''}`;
    $('rpGems').innerHTML = `+${res.gems} 💎 <small>(total ${fmt(save.gems)})</small>`;
    const ups = res.rankUps.map((u) => `<div class="rank-up">⬆ ¡RANGO ${u.rank}! <b>+${u.gems} 💎</b></div>`).join('');
    $('rpXp').innerHTML = `<div class="xp-gain">+${fmt(res.xp)} XP</div>${rankHTML(save.xp, res.rankUps.length ? null : res.xpBefore)}${ups}`;
    $('btnRaceNext').classList.toggle('hidden', !res.next);
    $('btnRaceNext').textContent = res.next ? `SIGUIENTE · ${res.track.idx + 2}/3` : '';
    show('racePodium');
  },

  // ---------- EXPEDICIÓN ----------
  // Mapa del acto: la salida abajo y el jefe arriba. Las líneas se calculan con la fila y la
  // columna de cada nodo (sin medir el DOM): el mapa es igual en cualquier pantalla.
  showExpMap(e) {
    const act = ACTS[e.act];
    setText('emTitle', `ACTO ${e.act + 1} · ${act.name}`);
    setText('emSub', act.sub);
    const r = G.run;
    $('emStatus').innerHTML = `<span>🛡️ ${r.shields}</span><span>🪙 ${r.coins}</span><span>🃏 ${Object.values(r.cards).reduce((a, b) => a + b, 0)}</span><span>🏁 ${e.acts}/${ACTS.length}</span>`;
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
    $('xeGems').innerHTML = `+${res.gems} 💎 por el último acto <small>(total ${fmt(save.gems)})</small>`;
    const ups = res.rankUps.map((u) => `<div class="rank-up">⬆ ¡RANGO ${u.rank}! <b>+${u.gems} 💎</b></div>`).join('');
    $('xeXp').innerHTML = `<div class="xp-gain">+${fmt(res.xp)} XP</div>${rankHTML(save.xp, res.rankUps.length ? null : res.xpBefore)}${ups}`;
    show('expEnd');
  },

  // ---------- ARENA ----------
  showArenaHUD(on) {
    $('arenaHud').classList.toggle('hidden', !on);
    if (on) $('hud').classList.add('hidden');
  },

  updateArenaHUD() {
    const a = G.arena;
    if (!a || $('arenaHud').classList.contains('hidden')) return;
    setText('ahTime', fmtTime(a.time));
    setText('ahGoal', a.time < ARENA_TIME ? `sobrevive ${fmtTime(ARENA_TIME)}` : '¡JEFE FINAL!');
    setText('ahLvl', String(a.level));
    setText('ahKills', fmt(a.kills));
    $('arenaHud').querySelector('.ah-xp i').style.transform = `scaleX(${Math.min(1, a.xp / Math.max(1, xpNeed(a.level))).toFixed(3)})`;
    setHTML('ahWeapons', arenaBuild(a));
    const ab = $('arenaAbility');
    ab.style.setProperty('--f', readiness(a.ability).toFixed(3));
    setText('arenaAbilityIcon', ABILITIES[a.ability.id].icon);
    ab.classList.toggle('ready', a.ability.cdLeft <= 0 && a.ability.active <= 0);
    $('ahHint').classList.toggle('hidden', a.time > 6);
  },

  showArenaUp(a) {
    setText('auTitle', `¡NIVEL ${a.level}!`);
    const box = $('auOptions');
    box.innerHTML = '';
    a.offers.forEach((up, i) => {
      const info = up.kind === 'weapon' ? WEAPONS[up.id] : up.kind === 'passive' ? PASSIVES[up.id] : up.kind === 'evolve' ? EVOLUTIONS[up.id] : { name: 'Reparación', icon: '❤️', desc: 'Recuperas toda la vida.' };
      const tag = up.kind === 'evolve' ? '✨ EVOLUCIÓN' : up.kind === 'weapon' ? (up.lvl === 1 ? 'ARMA NUEVA' : `ARMA · NIV ${up.lvl}`) : up.kind === 'passive' ? (up.lvl === 1 ? 'PASIVA NUEVA' : `PASIVA · NIV ${up.lvl}`) : 'CURA';
      const b = el('button', `au-opt k-${up.kind}`, `<span class="au-icon">${info.icon}</span><span class="au-body"><small>${tag}</small><b>${info.name}</b><em>${info.desc}</em></span>`);
      b.dataset.i = i;
      tap(b, () => pickArenaUpgrade(i));
      box.append(b);
    });
    show('arenaUp');
  },

  showArenaEnd(res) {
    ui.deathAt = performance.now();
    setText('aeTitle', res.won ? '¡ARENA SUPERADA!' : 'DESTRUIDO');
    $('aeTitle').className = res.won ? 'won' : 'dead';
    $('aeNew').classList.toggle('hidden', !res.isBest);
    setText('aeTime', fmtTime(res.time));
    const cells = [['Bajas', fmt(res.kills)], ['Nivel', res.level], ['Jefes', res.bosses], ['Récord', fmtTime(res.best)]];
    $('aeGrid').innerHTML = cells.map(([k, v]) => `<div><b>${v}</b><small>${k}</small></div>`).join('');
    $('aeBuild').innerHTML = arenaBuild({ weapons: res.weapons, passives: {}, evolved: res.evolved });
    $('aeGems').innerHTML = `+${res.gems} 💎 <small>(total ${fmt(save.gems)})</small>`;
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
    const t = $('tutorial');
    t.classList.remove('hidden');
    clearTimeout(ui._tut);
    ui._tut = setTimeout(() => t.classList.add('hidden'), 6500);
  },

  // Aspecto de una nave en el hangar: lo equipado, con lo que se esté probando encima
  lookOf(shipId) {
    const lk = equipped(save, shipId);
    const pv = ui.preview;
    if (pv && pv.ship === shipId) lk[pv.group] = GROUPS[pv.group].find((x) => x.id === pv.id) || lk[pv.group];
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
    ui._hv = { yaw: 0.6, drag: null, spin: 0.7, flash: 0, boost: 0, ...ui._hv, ship };
    if (!cv.dataset.ready) {
      cv.dataset.ready = '1';
      cv.addEventListener('pointerdown', (e) => { ui._hv.drag = e.clientX; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', (e) => {
        if (ui._hv.drag === null) return;
        ui._hv.yaw += (e.clientX - ui._hv.drag) * 0.012;
        ui._hv.drag = e.clientX;
      });
      cv.addEventListener('pointerup', () => { ui._hv.drag = null; });
    }
    if (ui._hvRunning) return;
    ui._hvRunning = true;
    let last = performance.now();
    const loop = (now) => {
      const view = $('hangarView');
      if (G.mode !== 'hangar' || !view || $('hangar').classList.contains('hidden')) { ui._hvRunning = false; return; }
      const s = ui._hv, dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (s.drag === null) s.yaw += dt * s.spin;
      // vuelta rápida al comprar una mejora
      if (s.boost > 0) {
        const d = Math.min(s.boost, dt * 9);
        s.yaw += d;
        s.boost -= d;
      }
      s.flash = Math.max(0, s.flash - dt * 1.8);
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
      const sx = w / 2, sy = h * 0.52, size = h * 0.42;
      // EXPLOSIÓN: al probarla, la nave estalla y se vuelve a montar (cada 2,4 s mientras la pruebes)
      const pv = ui.preview;
      const boomOn = pv && pv.ship === s.ship.id && pv.group === 'boom';
      if (boomOn && (!ui.boomAt || now - ui.boomAt > 2400)) {
        ui.boomAt = now;
        boomFx(parts, lk.boom.id, sx, sy, edge, s.ship.color, 0.32 * dpr);
      }
      parts.update(dt);
      if (!(boomOn && now - ui.boomAt < 1000)) {
        drawShip(c, s.ship.id, { ...pal, edge }, sx, sy, size,
          { yaw: s.yaw, pitch: -0.42 + Math.sin(now / 900) * 0.05, roll: Math.sin(now / 700) * 0.08 }, { line: 1.5 * dpr, ...emblemOpts(lk) });
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
    $('achList').innerHTML = ACHIEVEMENTS.map((a) => {
      const st = save.ach[a.id] || { p: 0, done: false };
      const k = Math.min(1, st.p / a.n);
      return `<div class="item ach-item t-${a.tier}${st.done ? ' sel' : ' locked'}">
        <span class="i-icon">${st.done ? '🏆' : '🔒'}</span>
        <span class="i-body"><b>${a.name}</b><small>${a.desc}</small>
          ${st.done ? '' : `<div class="m-bar"><i style="transform:scaleX(${k.toFixed(3)})"></i></div><small>${fmt(st.p)} / ${fmt(a.n)}${a.mode === 'best' ? ' (en una partida)' : ''}</small>`}</span>
        <span class="i-act">${st.done ? '✔' : `💎 ${ACH_GEMS[a.tier]}`}</span></div>`;
    }).join('');
    show('achs');
  },

  // Colección: lo descubierto con su icono; lo que falta, en silueta
  showCodex() {
    G.mode = 'hangar';
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
    $('chainbar').firstElementChild.style.transform = `scaleX(${Math.max(0, 1 - r.chainT / 3)})`;
    setHTML('speed', `${Math.round(effSpeed(r) * 10)}<small> KM/H</small>`);
    setText('dist', `${fmt(r.dist)} m`);
    setText('coins', `🪙 ${r.coins}`);
    setText('shields', '🛡️'.repeat(r.shields) + '▫️'.repeat(Math.max(0, shieldCap(r) - r.shields)));
    const a = r.ability;
    const ab = $('abilityBtn');
    ab.style.setProperty('--f', readiness(a).toFixed(3));
    setText('abilityIcon', ABILITIES[a.id].icon);
    ab.classList.toggle('ready', a.cdLeft <= 0 && a.active <= 0);
    ab.classList.toggle('active', a.active > 0);
    const od = $('odbar');
    od.firstElementChild.style.transform = `scaleX(${r.odTime > 0 ? r.odTime / r.stats.odDur : r.od})`;
    od.classList.toggle('active', r.odTime > 0);
    // RECALENTANDO: tras un overdrive la barra no carga unos segundos
    od.classList.toggle('cool', r.odCool > 0);
    setText('odLabel', r.odCool > 0 ? 'RECALENTANDO' : 'OVERDRIVE');
    const full = Math.floor(r.dashCharges);
    const part = r.dashCharges - full;
    let dash = '';
    for (let i = 0; i < r.stats.dashMax; i++) {
      const f = i < full ? 1 : i === full ? part : 0;
      dash += `<i class="${f >= 1 ? 'ready' : ''}" style="--f:${f}"></i>`;
    }
    setHTML('dash', dash);
    const rt = $('raceTag');
    if (r.race) {
      const pos = racePosition(r);
      const g = ghostAt(r.race.ghost, r.time);
      const ghostGap = g ? ` · 👻 ${((r.dist - g.z) / Math.max(1, r.speed)).toFixed(1)} s` : '';
      setText('raceTag', `${pos}.º / 4${ghostGap}`);
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
