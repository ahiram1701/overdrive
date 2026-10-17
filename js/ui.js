// Capa DOM: HUD, menú, hangar, cartas, tienda, cofre, muerte y pausa.
import { G, fmt, MAX_SHIELDS } from './state.js';
import { save, persist } from './save.js';
import { sfx, setSound, unlockAudio, musicStop, musicDuck } from './audio.js';
import { fx } from './fx.js';
import { todayKey } from './rng.js';
import { missions } from './missions.js';
import { rankOf, ACHIEVEMENTS, ACH_GEMS, achCount, MAX_RANK } from './progress.js';
import { BOSS_NAMES, BIOMES } from './world.js';
import { GROUPS, isUnlocked, lockText, buyCosmetic, equip, equipped } from './cosmetics.js';
import { drawShip } from './shipdraw.js';
import { RARITY, CARDS, CARD_BY_ID, SHIPS, META, SYNERGIES, offerCards, availableCards, synergyHint, shipLvls, shipProfile, treeOf, PROFILE_KEYS } from './upgrades.js';
import { newRun, pickCard, resume, effSpeed, useAbility } from './game.js';
import { ABILITIES, readiness } from './abilities.js';
import { SECTORS, LEVEL_BY_ID, MAX_STARS, starsOf, starCount, totalStars, isSectorOpen, isLevelOpen } from './campaign.js';
import { BOSS_BY_ID } from './bosses.js';

const $ = (id) => document.getElementById(id);
const OVERLAYS = ['menu', 'hangar', 'achs', 'codex', 'campaign', 'victory', 'cards', 'shop', 'chest', 'death', 'pause'];

function show(id) {
  for (const o of OVERLAYS) $(o).classList.toggle('hidden', o !== id);
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
    <span class="c-desc">${c.desc}</span>
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
  return `<div class="rank-top"><b>RANGO ${rank}</b><small>${rank >= MAX_RANK ? 'MÁXIMO' : `${fmt(into)} / ${fmt(need)} XP`}</small></div>
    <div class="rank-bar"><i style="transform:scaleX(${k.toFixed(3)})"></i>${gained}</div>`;
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
    tap($('btnCampaign'), () => ui.showCampaign());
    tap($('btnCampBack'), () => ui.showMenu());
    tap($('btnNext'), () => { if (ui.victoryNext) newRun({ mode: 'campaign', level: ui.victoryNext }); });
    tap($('btnRetry'), () => newRun(G.run?.opts));
    tap($('btnMap'), () => ui.showCampaign());
    tap($('btnHangar'), () => ui.showHangar());
    tap($('btnHangarBack'), () => ui.showMenu());
    tap($('btnAch'), () => ui.showAchievements());
    tap($('btnCodex'), () => ui.showCodex());
    tap($('btnAchBack'), () => ui.showMenu());
    tap($('btnCodexBack'), () => ui.showMenu());
    tap($('btnResume'), () => resume());
    tap($('btnQuit'), () => { musicStop(); ui.showMenu(); });
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
  },

  hideAll() { show(null); },

  showHUD(on) { $('hud').classList.toggle('hidden', !on); },

  showMenu() {
    G.mode = 'menu';
    G.run = null;
    G.player = null;
    ui.showHUD(false);
    $('mBest').textContent = fmt(save.best);
    $('mGems').textContent = fmt(save.gems);
    $('mDaily').textContent = save.daily.key === todayKey() && save.daily.best ? `· hoy ${fmt(save.daily.best)}` : '· nueva pista hoy';
    $('mMissions').innerHTML = missionsHTML();
    $('mRank').innerHTML = rankHTML(save.xp);
    $('mStars').textContent = `· ★ ${totalStars(save)}/${MAX_STARS}`;
    show('menu');
  },

  // Hangar: carrusel de naves, ficha con stats comparadas con la equipada y árbol de mejoras.
  showHangar(viewId = ui.hangarView || save.ship) {
    ui.hangarView = viewId;
    G.mode = 'hangar';
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
      const b = el('button', `ship-chip${s.id === view.id ? ' viewing' : ''}${save.ship === s.id ? ' equipped' : ''}${has ? '' : ' locked'}`);
      b.style.setProperty('--sc', s.color);
      b.innerHTML = `<span class="sc-icon">▲</span><b>${s.name}</b><small>${has ? (stars ? `★ ${stars}/9` : ABILITIES[s.ability].icon) : `💎 ${s.cost}`}</small>`;
      tap(b, () => ui.showHangar(s.id));
      car.appendChild(b);
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
      <canvas id="hangarView" class="hangar-view" aria-label="Nave en 3D: arrastra para girarla"></canvas>
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

    // personalizar: pintura, estela y explosión (comunes a todas las naves)
    const eq = equipped(save);
    const groups = [['palette', '🎨 Pintura'], ['trail', '✨ Estela'], ['boom', '💥 Explosión']];
    const cosm = $('cosmetics');
    cosm.innerHTML = '';
    for (const [g, label] of groups) {
      const row = el('div', 'cos-row', `<small>${label}</small>`);
      const chips = el('div', 'cos-chips');
      for (const it of GROUPS[g]) {
        const open = isUnlocked(it, save);
        const on = eq[g].id === it.id;
        const swatch = g === 'palette' ? `<i style="background:${it.edge || view.color};box-shadow:inset 0 0 0 3px ${it.hull}"></i>` : '';
        const c = el('button', `cos${on ? ' on' : ''}${open ? '' : ' locked'}`, `${swatch}<b>${it.name}</b><small>${on ? 'EQUIPADO' : open ? 'usar' : lockText(it)}</small>`);
        tap(c, () => {
          if (!open) {
            if (!buyCosmetic(it, save)) { c.classList.add('shake'); fx.vibe(50); setTimeout(() => c.classList.remove('shake'), 300); return; }
            sfx.chest();
          }
          equip(g, it.id, save);
          persist();
          fx.vibe(20);
          ui.showHangar();
        });
        chips.appendChild(c);
      }
      row.appendChild(chips);
      cosm.appendChild(row);
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
    $('dGems').innerHTML = `+${res.gems} 💎 <small>(total ${fmt(save.gems)})</small>`;
    // cuánto faltó para el récord: el "casi" es lo que hace darle a reintentar
    $('dExtra').textContent = res.level ? `NIVEL ${res.level} · la pista es siempre la misma: apréndetela`
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
    $('campStars').textContent = `★ ${totalStars(save)} / ${MAX_STARS}`;
    const map = $('campMap');
    map.innerHTML = '';
    for (const sec of SECTORS) {
      const open = isSectorOpen(save, sec.id);
      const got = sec.levels.reduce((n, l) => n + starCount(starsOf(save, l.id)), 0);
      const box = el('div', `sector${open ? '' : ' locked'}`);
      box.style.setProperty('--bc', BIOMES[sec.biome].accent);
      box.innerHTML = `<div class="sec-top"><b>${sec.name}</b><small>${open ? `★ ${got}/12` : `🔒 ${sec.need} ★ para abrir`}</small></div>`;
      const row = el('div', 'levels');
      for (const l of sec.levels) {
        const st = starsOf(save, l.id);
        const can = isLevelOpen(save, l.id);
        const b = el('button', `lvl${can ? '' : ' locked'}${st[0] ? ' done' : ''}${l.boss ? ' boss' : ''}`);
        b.dataset.level = l.id;
        b.innerHTML = `<span class="l-id">${can ? l.id : '🔒'}</span><span class="l-ico">${l.boss ? '👾 JEFE' : `${l.sections} tramos`}</span>
          <span class="l-stars">${st.map((x) => (x ? '★' : '☆')).join('')}</span>`;
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
    const l = LEVEL_BY_ID[id];
    const st = starsOf(save, id);
    document.querySelector('.lvl-sheet')?.remove();
    const sheet = el('div', 'lvl-sheet');
    sheet.innerHTML = `<h3>NIVEL ${l.id} · ${l.sectorName}</h3>
      <div class="hint">${l.boss ? `👾 Jefe: ${BOSS_BY_ID[l.boss].name}` : `${l.sections} tramos hasta la meta · siempre la misma pista`}</div>
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
    const l = LEVEL_BY_ID[res.level];
    ui.victoryNext = res.next;
    $('vTitle').textContent = res.passed ? '¡NIVEL SUPERADO!' : l.boss ? 'EL JEFE ESCAPÓ' : 'META';
    $('vLevel').textContent = `NIVEL ${l.id} · ${l.sectorName}`;
    $('vStars').innerHTML = res.stars.map((s, i) => `<span class="${s ? 'on' : res.best[i] ? 'had' : ''}" style="animation-delay:${(0.25 + i * 0.3).toFixed(2)}s">★</span>`).join('');
    const hits = res.hits ? `${res.hits} golpe${res.hits > 1 ? 's' : ''}` : 'sin golpes';
    const val = { near: res.near, perfect: res.perfect, coins: res.coins, mult: `x${res.maxMult}`, noHit: hits };
    $('vGoals').innerHTML = l.stars.map((s, i) => `<div class="item${res.stars[i] ? ' sel' : ' locked'}"><span class="i-icon">${res.stars[i] ? '✔' : '✖'}</span>
      <span class="i-body"><b>${s.text}</b>${val[s.kind] != null ? `<small>${val[s.kind]}</small>` : ''}</span>${res.best[i] && !res.stars[i] ? '<span class="i-act">★ ya la tenías</span>' : ''}</div>`).join('');
    $('vGems').innerHTML = res.gems ? `+${res.gems} 💎 <small>(total ${fmt(save.gems)})</small>` : `<small>★ ${totalStars(save)}/${MAX_STARS}</small>`;
    const ups = res.rankUps.map((u) => `<div class="rank-up">⬆ ¡RANGO ${u.rank}! <b>+${u.gems} 💎</b></div>`).join('');
    const unl = res.unlocked ? `<div class="rank-up">🔓 ¡Nivel ${res.next} desbloqueado!</div>` : '';
    $('vXp').innerHTML = `<div class="xp-gain">+${fmt(res.xp)} XP</div>${rankHTML(save.xp, res.rankUps.length ? null : res.xpBefore)}${ups}${unl}`;
    $('btnNext').classList.toggle('hidden', !res.next);
    $('btnNext').textContent = res.next ? `SIGUIENTE · ${res.next}` : '';
    if (res.passed) sfx.chest();
    show('victory');
  },

  pause() {
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

  // Bucle propio del canvas 3D del hangar (el mundo no se dibuja mientras el hangar está abierto)
  startHangarView(ship) {
    const cv = $('hangarView');
    if (!cv) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = cv.clientWidth || 300, H = cv.clientHeight || 170;
    cv.width = W * dpr;
    cv.height = H * dpr;
    const st = (ui._hv = { ship, yaw: ui._hv?.yaw ?? 0.6, drag: null, spin: 0.7 });
    cv.addEventListener('pointerdown', (e) => { st.drag = e.clientX; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => {
      if (st.drag === null) return;
      st.yaw += (e.clientX - st.drag) * 0.012;
      st.drag = e.clientX;
    });
    cv.addEventListener('pointerup', () => { st.drag = null; });
    if (ui._hvRunning) return;
    ui._hvRunning = true;
    let last = performance.now();
    const loop = (now) => {
      const view = $('hangarView');
      if (G.mode !== 'hangar' || !view || $('hangar').classList.contains('hidden')) { ui._hvRunning = false; return; }
      const s = ui._hv, dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (s.drag === null) s.yaw += dt * s.spin;
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
      const pal = equipped(save).palette;
      drawShip(c, s.ship.id, { hull: pal.hull, edge: pal.edge || s.ship.color, glow: pal.glow }, w / 2, h * 0.52, h * 0.42,
        { yaw: s.yaw, pitch: -0.42 + Math.sin(now / 900) * 0.05, roll: Math.sin(now / 700) * 0.08 }, { line: 1.5 * dpr });
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
    setText('shields', '🛡️'.repeat(r.shields) + '▫️'.repeat(Math.max(0, MAX_SHIELDS - r.shields)));
    const a = r.ability;
    const ab = $('abilityBtn');
    ab.style.setProperty('--f', readiness(a).toFixed(3));
    setText('abilityIcon', ABILITIES[a.id].icon);
    ab.classList.toggle('ready', a.cdLeft <= 0 && a.active <= 0);
    ab.classList.toggle('active', a.active > 0);
    const od = $('odbar');
    od.firstElementChild.style.transform = `scaleX(${r.odTime > 0 ? r.odTime / r.stats.odDur : r.od})`;
    od.classList.toggle('active', r.odTime > 0);
    const full = Math.floor(r.dashCharges);
    const part = r.dashCharges - full;
    let dash = '';
    for (let i = 0; i < r.stats.dashMax; i++) {
      const f = i < full ? 1 : i === full ? part : 0;
      dash += `<i class="${f >= 1 ? 'ready' : ''}" style="--f:${f}"></i>`;
    }
    setHTML('dash', dash);
    const ev = $('eventTag');
    if (r.event) {
      setText('eventTag', `${r.event.name} ${Math.ceil(r.eventT)}s`);
      ev.classList.remove('hidden');
    } else ev.classList.add('hidden');
  },
};
