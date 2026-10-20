// PECIOS: la partida en marcha (entrada, paso de simulación, eventos → sonido y efectos, final). Las
// reglas, en pecio.js; el dibujo 3D, en pecioRender.js.
import { G } from './state.js';
import { save, persist } from './save.js';
import { fx } from './fx.js';
import { sfx, music, musicStart, musicStop } from './audio.js';
import { SHIPS } from './upgrades.js';
import { SHIP_ARENA } from './arenaData.js';
import { newRun, updateRun, keptPiezas, ROOM_TYPES, botInput, dash, useAbility, buy, pray } from './pecio.js';
import { progress } from './game.js';
import { ui, dialogPaused } from './ui.js';

const P = () => G.pecio;

// Una partida nueva con la nave del hangar (su vida y su habilidad ⚡)
export function newPecio(seedOverride = null) {
  const forced = G.debug ? new URLSearchParams(location.search).get('seed') : null;
  const seed = seedOverride ?? (forced !== null ? Number(forced) >>> 0 : (Math.random() * 2 ** 32) >>> 0);
  const ship = SHIPS.find((x) => x.id === save.ship) || SHIPS[0];
  const hp = 6 + Math.round(((SHIP_ARENA[ship.id]?.hp || 100) - 100) / 25);
  const s = newRun(seed, { hp, ability: ship.ability });
  Object.assign(s, { ship, flashes: [], endT: 0, fade: 0, input: { x: 0, y: 0 }, stick: false, camSnap: true, turnIn: 0 });
  G.pecio = s;
  G.run = null;
  G.arena = null;
  G.mode = 'pecio';
  fx.clear();
  ui.hideAll();
  ui.showPecioHUD(true);
  music.biome = 2;
  music.intensity = 0;
  musicStart();
  save.pecio.runs++;
  persist();
  progress('pecio');
  // el cartel de la planta espera a que se cierre la GUÍA (si no, se acaba debajo de ella)
  s.introBanner = [`🏚️ ${s.floor.theme.name}`, 'planta 1 · tu nave dispara sola', s.floor.theme.wall, true, 2.4];
  ui.showTip?.('pecio');
}

// Un paso fijo de simulación (lo llama el bucle principal, también con D.step en los tests)
export function pecioStep(dt, input) {
  const s = P();
  if (!s || G.mode !== 'pecio') return;
  const inp = input || s.input;
  s.turnIn += ((inp.x || 0) - s.turnIn) * Math.min(1, dt * 8);
  handle(s, updateRun(s, dt, inp));
  if (s.over) finish(s);
}
export function pecioDash() {
  const s = P();
  if (!s || G.mode !== 'pecio') return;
  handle(s, dash(s));
}
export function pecioAbility() {
  const s = P();
  if (!s || G.mode !== 'pecio') return;
  handle(s, useAbility(s));
}
export function pecioBuy(item) { const s = P(); if (s && G.mode === 'pecioShop') handle(s, buy(s, item)); }
export function pecioPray(pick) { const s = P(); if (s && G.mode === 'pecioShop') handle(s, pray(s, pick)); }

// Eventos → sonido, avisos y destellos para el dibujo
function handle(s, ev) {
  for (const e of ev) {
    switch (e.type) {
      case 'fire': sfx.near?.(true, 0.4); break;
      case 'hit': sfx.brk(); break;
      case 'blocked': if (!s.blockT || s.time - s.blockT > 1.5) { s.blockT = s.time; fx.notice('🛡️ ¡Rebota! Rodea al Escudo', '#30d158'); } sfx.bump(); break;
      case 'kill': sfx.coin(4); fx.notice(`+${e.piezas} 🔩`, '#c8d6e5'); s.flashes.push({ kind: 'boom', x: e.x, y: e.y, r: 0.6, t: 0.3, max: 0.3 }); break;
      case 'hurt': fx.flash('#f33', 0.3); fx.shake(8); fx.vibe(50); sfx.shield(); break;
      case 'absorb': fx.notice('🫧 ¡Absorbido!', '#7df9ff'); break;
      case 'dead': sfx.die(); fx.shake(25); break;
      case 'fall': fx.notice('🕳️ ¡Al pozo! Con 💨 lo saltas', '#ff9f0a'); break;
      case 'locked': fx.notice('🔒 Limpia la sala para salir', '#ff2d55'); sfx.bump(); break;
      case 'shut': fx.notice('🚪 Las puertas se cierran', '#ff9f0a'); sfx.alarm?.(); break;
      case 'needKey': fx.notice('🗝️ Necesitas una llave', '#ffcc00'); sfx.bump(); break;
      case 'chest': fx.banner('🎁 COFRE', `+${e.piezas} 🔩 · +1 ❤️`, '#ffcc00', false, 1.8); sfx.chest(); break;
      case 'key': fx.notice('🗝️ +1 llave', '#ffcc00'); break;
      case 'cleared': fx.notice('✔ Sala limpia · +1 ❤️', '#30d158'); sfx.milestone(); progress('pecioRoom'); break;
      case 'room': {
        s.fade = 0.25;
        s.camSnap = true;
        const R = ROOM_TYPES[e.roomType];
        if (e.roomType !== 'combat') fx.notice(`${R.icon} ${R.name}`, '#fff');
        break;
      }
      case 'floor': s.fade = 0.4; s.camSnap = true; fx.banner(`🏚️ ${e.theme}`, `planta ${e.depth}`, s.floor.theme.wall, true, 2.4); sfx.milestone(); progress('pecioFloor', e.depth); break;
      case 'shop': G.mode = 'pecioShop'; ui.showPecioShop(s); break;
      case 'shrine': G.mode = 'pecioShop'; ui.showPecioShrine(s); break;
      case 'bought': sfx.coin(6); ui.showPecioShop(s); break;
      case 'poor': fx.notice('Te faltan 🔩', '#ff2d55'); break;
      case 'blessed': sfx.chest(); fx.banner('✨ BENDICIÓN', e.pick === 'hp' ? '+2 de vida máxima' : '+1 de daño del disparo', '#bf5af2', false, 2); G.mode = 'pecio'; ui.hideAll(); ui.showPecioHUD(true); break;
      case 'boom': s.flashes.push({ kind: 'boom', x: e.x, y: e.y, r: e.r, t: 0.35, max: 0.35 }); sfx.boom(); fx.shake(e.mine ? 6 : 10); break;
      case 'eshot': s.flashes.push({ kind: 'eshot', from: e.from, to: e.to, t: 0.22, max: 0.22 }); sfx.near?.(true, 1); break;
      case 'beam': s.flashes.push({ kind: 'beam', from: e.from, to: e.to, t: 0.35, max: 0.35 }); break;
      case 'armed': sfx.alarm?.(); break;
      case 'ability': fx.notice('⚡ ¡Habilidad!', '#ffe600'); sfx.od(); break;
      case 'dash': sfx.near?.(true, 0.8); break;
      case 'win': fx.banner('🏆 ¡HAS SALIDO!', 'nueve plantas de pecio, superadas', '#ffe600', true, 2.5); break;
      default: break;
    }
  }
}

// Fin: te llevas parte de las 🔩 (todas si sales)
function finish(s) {
  if (G.mode === 'pecioEnd') return;
  const kept = keptPiezas(s);
  save.pecio.piezas += kept;
  save.pecio.best = Math.max(save.pecio.best || 0, Math.min(s.depth, 9));
  if (s.won) save.pecio.wins = (save.pecio.wins || 0) + 1;
  progress('pecioDepth', s.depth);
  persist();
  s.result = { won: s.won, depth: Math.min(s.depth, 9), rooms: s.roomsCleared, kills: s.kills, found: s.player.piezas, kept, wallet: save.pecio.piezas, best: save.pecio.best };
  G.mode = 'pecioEnd';
  s.endT = s.won ? 1.6 : 1.1;
  musicStop();
}

// Cada fotograma: tiempos de animación y el paso a la pantalla final
export function updatePecio(dt) {
  const s = P();
  if (!s) return;
  if (s.introBanner && !dialogPaused()) { fx.banner(...s.introBanner); s.introBanner = null; }
  s.fade = Math.max(0, s.fade - dt);
  for (const f of s.flashes) f.t -= dt;
  s.flashes = s.flashes.filter((f) => f.t > 0);
  if (G.mode === 'pecioEnd') {
    s.endT -= dt;
    if (s.endT <= 0) {
      G.mode = 'pecioDone';
      ui.showPecioHUD(false);
      ui.showPecioEnd(s.result);
    }
  }
}

// (tests) el bot juega `sec` segundos
export function pecioBotSteps(sec = 1) {
  const s = P();
  for (let t = 0; t < sec && s && G.mode === 'pecio'; t += 1 / 30) {
    const inp = botInput(s);
    if (inp.ability) pecioAbility();
    if (inp.dash) pecioDash();
    pecioStep(1 / 30, inp);
  }
  return s && { depth: s.depth, at: s.at, hp: s.player.hp, over: s.over, mode: G.mode, kills: s.kills };
}
