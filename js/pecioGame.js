// PECIOS: la partida en marcha (entrada, eventos → sonido y efectos, final). Las reglas, en pecio.js;
// el dibujo, en pecioRender.js.
import { G } from './state.js';
import { save, persist } from './save.js';
import { fx } from './fx.js';
import { sfx, music, musicStart, musicStop } from './audio.js';
import { SHIPS } from './upgrades.js';
import { SHIP_ARENA } from './arenaData.js';
import { newRun, act, keptPiezas, DIRS, COLS, ROWS, ROOM_TYPES, botAction } from './pecio.js';
import { progress } from './game.js';
import { ui } from './ui.js';

const P = () => G.pecio;

// Una partida nueva con la nave del hangar (su vida y su habilidad ⚡)
export function newPecio(seedOverride = null) {
  const forced = G.debug ? new URLSearchParams(location.search).get('seed') : null;
  const seed = seedOverride ?? (forced !== null ? Number(forced) >>> 0 : (Math.random() * 2 ** 32) >>> 0);
  const ship = SHIPS.find((x) => x.id === save.ship) || SHIPS[0];
  const hp = 6 + Math.round(((SHIP_ARENA[ship.id]?.hp || 100) - 100) / 25);
  const s = newRun(seed, { hp, ability: ship.ability });
  Object.assign(s, { ship, aim: false, flashes: [], endT: 0, moveT: 0, from: null });
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
  fx.banner(`🏚️ ${s.floor.theme.name}`, 'planta 1 · cada paso tuyo es un turno', s.floor.theme.wall, true);
  ui.showTip?.('pecio');
}

// Una acción del jugador (con el modo APUNTAR, la siguiente dirección dispara)
export function pecioAct(action) {
  const s = P();
  const inMenu = G.mode === 'pecioShop' && (action.type === 'buy' || action.type === 'shrine'); // tienda y altar, con su pantalla abierta
  if (!s || (G.mode !== 'pecio' && !inMenu)) return;
  if (s.aim && action.type === 'move') { action = { type: 'shoot', dir: action.dir }; s.aim = false; }
  const from = { x: s.player.x, y: s.player.y, at: s.at };
  const ev = act(s, action);
  if (from.at === s.at) { s.from = from; s.moveT = 0.12; } else s.from = null;
  handle(s, ev);
  if (s.over) finish(s);
}
export const pecioMove = (dir) => pecioAct({ type: 'move', dir });
export const pecioWait = () => pecioAct({ type: 'wait' });
export const pecioAbility = () => pecioAct({ type: 'ability' });
export function pecioAim() {
  const s = P();
  if (!s || G.mode !== 'pecio') return;
  if (s.player.shotCd > 0) { fx.notice(`⚡ recargando: ${s.player.shotCd} turno${s.player.shotCd > 1 ? 's' : ''}`, '#7df9ff'); return; }
  s.aim = !s.aim;
  if (s.aim) fx.notice('⚡ ¿Hacia dónde disparas? desliza o toca', '#7df9ff');
}
// tocar una casilla al lado = moverte allí (o disparar si apuntas); tocar tu nave = esperar
export function pecioTap(x, y) {
  const s = P();
  if (!s || G.mode !== 'pecio') return;
  const L = pecioLayout(G.W || 375, G.H || 812);
  const c = Math.floor((x - L.ox) / L.T), r = Math.floor((y - L.oy) / L.T);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
  const dx = c - s.player.x, dy = r - s.player.y;
  if (!dx && !dy) return pecioWait();
  if (s.aim && (dx === 0 || dy === 0)) return pecioAct({ type: 'move', dir: dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up' });
  if (Math.abs(dx) + Math.abs(dy) !== 1) return;
  pecioMove(dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up');
}
export const pecioBuy = (item) => pecioAct({ type: 'buy', item });
export const pecioPray = (pick) => pecioAct({ type: 'shrine', pick });

// La sala en pantalla: casillas cuadradas tan grandes como quepan entre la barra de arriba y los botones
export function pecioLayout(W, H) {
  const top = 112, bottom = 140;
  const T = Math.floor(Math.min((W - 20) / COLS, (H - top - bottom) / ROWS));
  return { T, ox: Math.round((W - T * COLS) / 2), oy: top + Math.max(0, Math.round((H - top - bottom - T * ROWS) / 2)) };
}

// Eventos → sonido, avisos y destellos para el dibujo
function handle(s, ev) {
  for (const e of ev) {
    switch (e.type) {
      case 'hit': sfx.brk(); break;
      case 'blocked': fx.notice('🛡️ ¡Rebota! Al Escudo, de cerca', '#30d158'); sfx.bump(); break;
      case 'kill': sfx.coin(4); fx.notice(`+${e.piezas} 🔩`, '#c8d6e5'); s.flashes.push({ kind: 'boom', x: e.x, y: e.y, r: 0, t: 0.3, max: 0.3 }); break;
      case 'hurt': fx.flash('#f33', 0.3); fx.shake(8); fx.vibe(50); sfx.shield(); break;
      case 'absorb': case 'dodge': fx.notice('🫧 ¡Absorbido!', '#7df9ff'); break;
      case 'dead': sfx.die(); fx.shake(25); break;
      case 'locked': fx.notice('🔒 Limpia la sala para salir', '#ff2d55'); sfx.bump(); break;
      case 'shut': fx.notice('🚪 Las puertas se cierran', '#ff9f0a'); sfx.alarm?.(); break;
      case 'needKey': fx.notice('🗝️ Necesitas una llave', '#ffcc00'); sfx.bump(); break;
      case 'chest': fx.banner('🎁 COFRE', `+${e.piezas} 🔩 · +1 ❤️`, '#ffcc00'); sfx.chest(); break;
      case 'key': fx.notice('🗝️ +1 llave', '#ffcc00'); break;
      case 'cleared': fx.notice('✔ Sala limpia · +1 ❤️', '#30d158'); sfx.milestone(); progress('pecioRoom'); break;
      case 'room': { const R = ROOM_TYPES[e.roomType]; if (e.roomType !== 'combat') fx.notice(`${R.icon} ${R.name}`, '#fff'); break; }
      case 'floor': fx.banner(`🏚️ ${e.theme}`, `planta ${e.depth}`, s.floor.theme.wall, true); sfx.milestone(); progress('pecioFloor', e.depth); break;
      case 'shop': G.mode = 'pecioShop'; ui.showPecioShop(s); break;
      case 'shrine': G.mode = 'pecioShop'; ui.showPecioShrine(s); break;
      case 'bought': sfx.coin(6); ui.showPecioShop(s); break;
      case 'poor': fx.notice('Te faltan 🔩', '#ff2d55'); break;
      case 'blessed': sfx.chest(); fx.banner('✨ BENDICIÓN', e.pick === 'hp' ? '+2 de vida máxima' : '+1 de daño del disparo', '#bf5af2'); G.mode = 'pecio'; ui.hideAll(); ui.showPecioHUD(true); break;
      case 'boom': s.flashes.push({ kind: 'boom', x: e.x, y: e.y, r: e.r, t: 0.35, max: 0.35 }); sfx.boom(); fx.shake(10); break;
      case 'shot': s.flashes.push({ kind: 'shot', path: e.path, t: 0.18, max: 0.18 }); sfx.near(true, 1); break;
      case 'eshot': s.flashes.push({ kind: 'eshot', path: e.path, t: 0.2, max: 0.2 }); break;
      case 'armed': fx.notice('💣 ¡Bomba armada: aléjate!', '#ff9f0a'); break;
      case 'ability': fx.notice('⚡ ¡Habilidad!', '#ffe600'); sfx.od(); break;
      case 'cooldown': fx.notice('Aún recargando', '#7df9ff'); break;
      case 'win': fx.banner('🏆 ¡HAS SALIDO!', 'nueve plantas de pecio, superadas', '#ffe600', true); break;
      default: break;
    }
  }
}

// Fin: te llevas parte de las 🔩 (todas si sales)
function finish(s) {
  if (G.mode === 'pecioEnd') return;
  const kept = keptPiezas(s);
  save.pecio.piezas += kept;
  save.pecio.best = Math.max(save.pecio.best || 0, s.depth);
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
  s.moveT = Math.max(0, s.moveT - dt);
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

// (tests) el bot juega n turnos
export function pecioBotSteps(n = 1) {
  const s = P();
  for (let i = 0; i < n && s && G.mode === 'pecio'; i++) pecioAct(botAction(s));
  return s && { depth: s.depth, at: s.at, hp: s.player.hp, over: s.over, mode: G.mode };
}
export { DIRS };
