// PECIOS: la partida en marcha (entrada, paso de simulación, eventos → sonido y efectos, final). Las
// reglas, en pecio.js; el dibujo 3D, en pecioRender.js.
import { G } from './state.js';
import { todayKey } from './rng.js';
import { save, persist } from './save.js';
import { fx } from './fx.js';
import { sfx, music, musicStart, musicStop } from './audio.js';
import { SHIPS } from './upgrades.js';
import { SHIP_ARENA } from './arenaData.js';
import { LOADOUTS, HEAT_MAX, heatReward, dailySeed, DAILY_GEMS, CURSES, FLOOD_AT, selectOffer, newRun, updateRun, keptPiezas, ROOM_TYPES, EVENTS, THEMES, roomOf, locked, botInput, dash, useAbility, buy, pray, takeOffer, botOffer, useCons, chooseExit, workshopShip, workshopCost, BOSSES, bossOf, LAST_FLOOR, pecioRewards, fwd } from './pecio.js';
import { addXp, prestigeBonus } from './progress.js';
import { TAGS, CONS, RARITY, SLOTS, itemIcon, itemName } from './pecioLoot.js';
import { progress } from './game.js';
import { ui, dialogPaused } from './ui.js';
import { juice, stepParts } from './pecioFx.js';
import { lookColor } from './pecioRender.js';

const P = () => G.pecio;

// Una partida nueva con la nave del hangar (su vida y su habilidad ⚡)
// opts.daily: la INMERSIÓN DEL DÍA (misma planta para todos ese día; con el cargamento básico, sin profundidad ni bóveda)
export function newPecio(seedOverride = null, opts = {}) {
  G.timeWarp = 1;
  const daily = !!opts.daily, day = todayKey();
  const forced = G.debug ? new URLSearchParams(location.search).get('seed') : null;
  const seed = daily ? dailySeed(day) : seedOverride ?? (forced !== null ? Number(forced) >>> 0 : (Math.random() * 2 ** 32) >>> 0);
  const ship = SHIPS.find((x) => x.id === save.ship) || SHIPS[0];
  // la vida, de tu nave del hangar; lo demás que traes, del TALLER de Pecios
  const ws = workshopShip(save.pecioUp);
  const hp = 6 + Math.round(((SHIP_ARENA[ship.id]?.hp || 100) - 100) / 25) + ws.hpBonus;
  // LA BÓVEDA: lo que guardaste en la partida anterior sale contigo (y la bóveda queda vacía)
  const vault = daily ? [] : vaultItems();
  if (!daily) { save.pecio.vault = null; save.pecio.vaults = []; }
  // CARGAMENTO (el equipo con el que empiezas) y PROFUNDIDAD
  const loId = !daily && save.pecio.loadouts?.[save.pecio.loadout] ? save.pecio.loadout : 'assault', lo = LOADOUTS[loId] || LOADOUTS.assault;
  const heat = daily ? 0 : Math.max(0, Math.min(save.pecio.heat || 0, save.pecio.heatMax || 0, HEAT_MAX));
  const s = newRun(seed, { hp, ability: ship.ability, gear: [...lo.gear(), ...vault], keys: ws.keys + (lo.keys || 0), piezas: lo.piezas || 0, bag: ws.bag, bagMax: ws.bagMax, luck: ws.luck, bonusDmg: ws.bonusDmg, crit: ws.crit, pool: daily ? null : ws.pool, heat, daily }); // (la del día, con todo abierto: la misma planta para todos)
  s.day = day;
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
  pecioMusic(s);
  musicStart('pecio');
  save.pecio.runs++;
  persist();
  progress('pecio');
  // el cartel de la planta espera a que se cierre la GUÍA (si no, se acaba debajo de ella)
  s.introBanner = [`🏚️ ${s.floor.theme.name}`, daily ? '🌅 INMERSIÓN DEL DÍA · planta 1' : heat ? `planta 1 · 🔥 profundidad ${heat}` : (s.twin === false || save.settings.pecioAuto ? 'planta 1 · tu nave dispara sola' : 'planta 1 · izquierda mueve · derecha apunta y dispara'), s.floor.theme.wall, true, 2.4];
  if (vault.length) fx.notice(`🔐 De la bóveda: ${vault.map((v) => `${itemIcon(v)} ${itemName(v)}`).join(' · ')}`, RARITY[Math.max(...vault.map((v) => v.tier))].color);
  ui.showTip?.('pecio');
}

// Un paso fijo de simulación (lo llama el bucle principal, también con D.step en los tests)
export function pecioStep(dt, input) {
  const s = P();
  if (!s || G.mode !== 'pecio') return;
  const inp = input || s.input;
  s.turnIn += ((inp.x || 0) - s.turnIn) * Math.min(1, dt * 8);
  stepParts(s, dt);
  // HITSTOP: un instante congelado al tumbar algo grande (el golpe se siente)
  if (s.hitstop > 0) { s.hitstop -= dt; return; }
  if (s.tally) s.tally.t -= dt;
  handle(s, updateRun(s, dt, inp));
  // ESTELA del motor mientras te mueves
  const pl = s.player;
  if ((pl.vel || 0) > 0.35 && (s.engT = (s.engT || 0) - dt) <= 0) { s.engT = 0.035; juice.engine(s, pl.x, pl.y, pl.moveAng ?? pl.ang); }
  pecioMusic(s);
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
// BOTÍN: ponértelo ('equip' / 'mod1' / 'mod2') o dejarlo en el suelo ('leave'); y vuelta a la partida
export function pecioTakeOffer(choice) {
  const s = P();
  if (!s || !s.offer) return;
  handle(s, takeOffer(s, choice));
  G.mode = 'pecio';
  ui.hideAll();
  ui.showPecioHUD(true);
}
// ELIGE 1 DE 3: cambia el objeto que estás mirando
export function pecioSelectOffer(i) {
  const s = P();
  if (!s || !s.offer) return;
  selectOffer(s, i);
  sfx.coin?.(1);
  ui.showPecioOffer(s);
}
// PLANTA 9: salir con todo o seguir en el modo sin fin
export function pecioChooseExit(pick) {
  const s = P();
  if (!s || s.choice !== 'exit') return;
  G.mode = 'pecio';
  ui.hideAll();
  ui.showPecioHUD(true);
  handle(s, chooseExit(s, pick));
  if (s.over) finish(s);
}
// TALLER: mejoras para siempre, con 🔩
// SALIR del sin fin desde la pausa: la partida ya cuenta como victoria, te llevas las 🔩 y lo demás
export function pecioQuitEndless() {
  const s = P();
  if (!s || !s.endless || G.mode === 'pecioEnd') return false;
  s.won = true;
  finish(s);
  return true;
}
// CARGAMENTOS: comprar (una vez) y elegir
export function pecioLoadout(id) {
  const L = LOADOUTS[id];
  if (!L) return false;
  const sp = save.pecio;
  sp.loadouts ||= { assault: true };
  if (!sp.loadouts[id]) {
    if ((sp.piezas || 0) < L.cost) return false;
    sp.piezas -= L.cost;
    sp.loadouts[id] = true;
    sfx.chest?.();
  }
  sp.loadout = id;
  persist();
  return true;
}
// PROFUNDIDAD: de 0 a la más honda que hayas abierto
export function pecioSetHeat(h) {
  save.pecio.heat = Math.max(0, Math.min(h, save.pecio.heatMax || 0, HEAT_MAX));
  persist();
  return save.pecio.heat;
}
export function pecioWorkshopBuy(id) {
  const c = workshopCost(save.pecioUp, id);
  if (c === null || save.pecio.piezas < c) return false;
  save.pecio.piezas -= c;
  save.pecioUp[id] = (save.pecioUp[id] || 0) + 1;
  persist();
  sfx.chest?.();
  return true;
}
// MOCHILA
export function pecioUseCons(k) {
  const s = P();
  if (!s || G.mode !== 'pecio') return;
  handle(s, useCons(s, k));
}
// BÓVEDA: desde la pantalla final, guardas objetos de los que llevabas para la próxima partida
// (uno por ranura; tantos como huecos tengas: si no caben, sale el más antiguo)
export const vaultSlots = () => (save.pecio.vaultOpen ? workshopShip(save.pecioUp).vaultSlots : 0);
export function vaultItems() {
  const P_ = save.pecio, list = [...(P_.vaults || [])];
  if (P_.vault && !list.some((v) => v.id === P_.vault.id)) list.unshift({ ...P_.vault, vslot: P_.vault.vslot || P_.vault.slot }); // (de la bóveda de antes)
  return list;
}
export function pecioVaultStore(slot) {
  const s = P(), it = s?.result?.gear?.[slot];
  if (!it || !save.pecio.vaultOpen) return false;
  const list = vaultItems().filter((v) => v.vslot !== slot && v.id !== it.id);
  list.push({ ...it, vslot: slot });
  while (list.length > vaultSlots()) list.shift();
  save.pecio.vaults = list;
  save.pecio.vault = null;
  persist();
  return true;
}
export const VAULT_COST = 300;
export function pecioVaultUnlock() {
  if (save.pecio.vaultOpen || save.pecio.piezas < VAULT_COST) return false;
  save.pecio.piezas -= VAULT_COST;
  save.pecio.vaultOpen = true;
  persist();
  return true;
}

// MÚSICA: la pista de la ambientación; con las puertas cerradas, más intensa; con el jefe, la suya
function pecioMusic(s) {
  const room = roomOf(s), boss = room.type === 'boss' && room.enemies.some((e) => e.kind === 'boss' && (e.alive || e.downT > 0));
  const shut = !boss && locked(room);
  music.pecio = boss ? 3 : Math.max(0, THEMES.findIndex((t) => t.id === s.floor.theme.id));
  music.intensity = boss ? 3 : shut ? 2 : 1; // sin combate sigue el pulso (con 0 se apagaba la batería de golpe)
}

// cada HABILIDAD con su sonido, su color y su golpe de cámara
const ABILITY_FX = {
  nova: { name: 'Nova', color: '#ffe600', shake: 8, snd: () => { sfx.boom(); sfx.od(); } },
  chaos: { name: 'Caos', color: '#ff2bd6', shake: 6, snd: () => sfx.zap() },
  singularity: { name: 'Singularidad', color: '#bf5af2', shake: 10, snd: () => { sfx.growl(); sfx.ion(); } },
  laser: { name: 'Láser', color: '#ff2d55', shake: 5, snd: () => sfx.beam() },
  hammer: { name: 'Martillo', color: '#ff9f0a', shake: 14, snd: () => { sfx.thud(true); sfx.boom(); } },
  hook: { name: 'Garfio', color: '#7df9ff', shake: 4, snd: () => sfx.rail() },
  blink: { name: 'Salto', color: '#bfe9ff', shake: 3, snd: () => sfx.dash() },
  bubble: { name: 'Burbuja', color: '#7df9ff', shake: 2, snd: () => sfx.shield() },
  barrier: { name: 'Barrera', color: '#30d158', shake: 3, snd: () => sfx.shield() },
  overclock: { name: 'Sobrecarga', color: '#ffe600', shake: 4, snd: () => sfx.od() },
  ram: { name: 'Embestida', color: '#ff6a00', shake: 9, snd: () => { sfx.dash(); sfx.thud(true); } },
  roar: { name: 'Rugido', color: '#ff2d55', shake: 12, snd: () => sfx.roar() },
  phase: { name: 'Fase', color: '#bfe9ff', shake: 2, snd: () => sfx.secret() },
  surge: { name: 'Oleada', color: '#7df9ff', shake: 7, snd: () => { sfx.zap(); sfx.ion(); } },
  quake: { name: 'Terremoto', color: '#c8743a', shake: 18, snd: () => { sfx.boom(); sfx.thud(true); } },
  salvage: { name: 'Chatarrero', color: '#c8d6e5', shake: 3, snd: () => sfx.coin(8) },
};

// Eventos → sonido, avisos y destellos para el dibujo
function handle(s, ev) {
  for (const e of ev) {
    switch (e.type) {
      case 'fire': {
        sfx.pew(e.weapon);
        const big = e.weapon === 'cannon' || e.weapon === 'charge';
        if (e.a != null) {
          juice.muzzle(s, e.x, e.y, e.a, big);
          // RETROCESO de cámara: un empujón hacia atrás con cada disparo (más con los gordos)
          const f = fwd(e.a), k = (s.kick ||= { x: 0, y: 0 }), m = ({ cannon: 0.14, charge: 0.1 + 0.12 * (e.power || 0), blast: 0.06, spread: 0.05, rapid: 0.02 })[e.weapon] ?? 0.035;
          k.x -= f.x * m; k.y -= f.y * m;
        }
        break;
      }
      case 'weakSpot': if (!s.weakT || s.time - s.weakT > 3) { s.weakT = s.time; fx.notice('🎯 ¡PUNTO DÉBIL! Por la espalda le duele más', '#bf5af2', 2); } juice.hit(s, e.x, e.y, true); break;
      case 'spark': juice.wall(s, e.x, e.y, e.big); if (!s.tinkT || s.time - s.tinkT > 0.06) { s.tinkT = s.time; sfx.tink(); } break;
      case 'attack': if (!s.swT || s.time - s.swT > 0.25) { s.swT = s.time; sfx.swish(); } break;
      case 'hit': juice.hit(s, e.x, e.y, e.crit);
        // (un golpe por cada 40 ms como mucho: con armas rápidas el ruido tapaba todo)
        if (!s.brkT || s.time - s.brkT > 0.04) { s.brkT = s.time; sfx.brk(); }
        s.flashes.push({ kind: 'spark', x: e.x, y: e.y, t: 0.2, max: 0.2, a: Math.random() * 6.3 });
        s.flashes.push({ kind: 'num', x: e.x, y: e.y, text: `${Math.round(e.dmg)}${e.crit ? '!' : ''}`, color: e.crit ? '#ffe600' : '#ffffff', crit: e.crit, dx: (Math.random() - 0.5) * 18, t: 0.7, max: 0.7 });
        if (e.crit && !(s.hitstop > 0)) s.hitstop = 0.03;
        break;
      case 'blocked': if (!s.blockT || s.time - s.blockT > 1.5) { s.blockT = s.time; fx.notice('🛡️ ¡Rebota! Rodea al Escudo', '#30d158', 2.6); } sfx.bump(); break;
      case 'kill': sfx.thud(e.big);
        juice.kill(s, e.x, e.y, lookColor(e.kind, e.boss), e.big);
        // HITSTOP: un instante congelado (corto con cada baja, largo con una élite y más con un jefe)
        fx.hitstop(e.boss ? 0.18 : e.big ? 0.09 : 0.04);
        if (e.big) { fx.shake(e.boss ? 18 : 10); fx.vibe(40); } else fx.shake(4);
        if (e.boss) s.zoomPunch = 1;
        // la ÚLTIMA baja de la sala, a cámara lenta
        if (e.last) fx.slowmo(0.35, 0.35);
        if (e.combo >= 3) sfx.coin(Math.min(14, 2 + e.combo));
        sfx.coin(4); s.flashes.push({ kind: 'boom', x: e.x, y: e.y, r: 0.6, t: 0.3, max: 0.3 });
        // las 🔩 se ACUMULAN en un solo contador junto a las tuyas (antes, un aviso por cada baja)
        s.tally = { n: (s.tally?.t > 0 ? s.tally.n : 0) + e.piezas, t: 1.8 }; break;
      case 'hurt': fx.flash('#f33', 0.3); fx.shake(e.low ? 12 : 8); fx.vibe(e.low ? 90 : 50); sfx.shield(); juice.hurt(s, s.player.x, s.player.y); fx.hitstop(0.05); break;
      case 'absorb': fx.notice('🫧 ¡Absorbido!', '#7df9ff'); break;
      case 'dead': sfx.die(); fx.shake(25); juice.kill(s, s.player.x, s.player.y, '#00e5ff', true); fx.flash('#fff', 0.5); break;
      case 'fall': fx.notice('🕳️ ¡Al pozo! Con 💨 lo saltas', '#ff9f0a', 3.2); break;
      case 'locked': fx.notice('🔒 Limpia la sala para salir', '#ff2d55', 2.6); sfx.bump(); break;
      case 'shut': fx.notice('🚪 Las puertas se cierran', '#ff9f0a'); sfx.alarm?.(); break;
      case 'needKey': fx.notice('🗝️ Necesitas una llave', '#ffcc00', 2.6); sfx.bump(); break;
      case 'chest': fx.banner('🎁 COFRE', `+${e.piezas} 🔩 · +1 ❤️`, '#ffcc00', false, 1.8); sfx.chest(); break;
      case 'key': fx.notice('🗝️ +1 llave', '#ffcc00'); break;
      case 'cleared': fx.notice('✔ Sala limpia · +1 ❤️', '#30d158'); sfx.milestone(); progress('pecioRoom'); break;
      case 'room': {
        s.fade = 0.25;
        s.camSnap = true;
        const R = ROOM_TYPES[e.roomType];
        if (e.roomType === 'boss') { const B = BOSSES[s.floor.boss || bossOf(s.depth)]; fx.banner(`💀 ${B.name}`, B.tip, B.color, true, 3); sfx.roar(); fx.shake(12); } else if (e.roomType !== 'combat') fx.notice(`${R.icon} ${R.name}`, '#fff');
        break;
      }
      case 'floor': {
        s.fade = 0.4; s.camSnap = true;
        const evn = EVENTS[s.floor.event];
        fx.banner(`🏚️ ${e.theme}`, evn ? `planta ${e.depth} · ${evn.icon} ${evn.name}` : `planta ${e.depth}`, s.floor.theme.wall, true, 2.4);
        if (evn) fx.notice(`${evn.icon} ${evn.name}: ${evn.desc}`, '#ffe600', 4);
        if (e.curse) { const C = CURSES[e.curse]; fx.notice(`☠️ MALDICIÓN · ${C.icon} ${C.name}: ${C.desc} · ×1,5 🔩 y mejor botín`, '#ff2d55', 5); }
        sfx.milestone(); progress('pecioFloor', e.depth);
        break;
      }
      case 'dig': fx.shake(10); sfx.boom(); fx.notice('🕳️ ¡Se hunde! Sal de las casillas marcadas', '#c8743a', 2.4); break;
      case 'fusionDown': fx.notice('⚡ Un núcleo cae… ¡tumba el otro antes de 4 s!', '#ffe600', 3); sfx.milestone(); break;
      case 'fusionUp': fx.notice('⚡ El núcleo vuelve a encenderse', '#ff2d55', 2.4); s.flashes.push({ kind: 'boom', x: e.x, y: e.y, r: 1, t: 0.4, max: 0.4 }); break;
      case 'shop': G.mode = 'pecioShop'; ui.showPecioShop(s); break;
      case 'shrine': G.mode = 'pecioShop'; ui.showPecioShrine(s); break;
      case 'bought': sfx.coin(6); ui.showPecioShop(s); break;
      case 'poor': fx.notice('Te faltan 🔩', '#ff2d55'); break;
      case 'blessed': sfx.chest(); fx.banner(e.pick === 'pact' ? '🩸 PACTO' : '✨ BENDICIÓN', { hp: '+2 de vida máxima', dmg: '+1 de daño del disparo', pact: '−1 de vida máxima… a cambio de esto' }[e.pick], '#bf5af2', false, 2); G.mode = 'pecio'; ui.hideAll(); ui.showPecioHUD(true); break;
      case 'weak': fx.notice('🩸 Estás demasiado débil para un pacto', '#ff2d55', 2.6); break;
      case 'offer': G.mode = 'pecioShop'; ui.showPecioOffer(s); sfx.chest(); break;
      case 'equip': fx.notice(`${itemIcon(e.item)} ${itemName(e.item)} equipado`, RARITY[e.item.tier].color); sfx.milestone(); if (e.item.tier === 3) progress('pecioLegend'); break;
      case 'bossDown': fx.banner(`💀 ${e.name}`, '¡derrotado! la escotilla ⬇️ se abre', BOSSES[e.boss].color, true, 2.4); fx.shake(20); sfx.milestone(); progress('pecioBoss'); break;
      case 'phase': fx.banner('⚠️ FASE 2', e.boss === 'guardian' ? 'embiste más a menudo y llama refuerzos' : e.boss === 'swarm' ? '¡se divide!' : '¡electrifica el suelo!', BOSSES[e.boss].color, true, 1.8); fx.shake(12); sfx.alarm?.(); break;
      case 'slam': fx.shake(16); fx.notice('💫 ¡Se ha estrellado! Ahora recibe el doble', '#ffcc00'); break;
      case 'pulse': for (const [c, r] of e.marks) s.flashes.push({ kind: 'tile', c, r, t: 0.3, max: 0.3 }); sfx.boom(); fx.shake(6); break;
      case 'spawn': s.flashes.push({ kind: 'boom', x: e.x, y: e.y, r: 0.9, t: 0.3, max: 0.3 }); break;
      case 'shockwave': sfx.boom(); fx.shake(8); break;
      case 'wave': fx.banner(`🌊 OLEADA ${3 - e.left}/3`, e.left ? 'aguanta' : '¡la última!', '#7df9ff', false, 1.4); sfx.alarm?.(); break;
      case 'reward': fx.banner('🎁 ¡PREMIO!', e.what === 'challenge' ? 'desafío superado a tiempo' : e.what === 'elite' ? 'la sala de élite, limpia' : 'las 3 oleadas, superadas', '#ffcc00', false, 1.8); sfx.chest(); break;
      case 'challengeFail': fx.notice('⏱️ Se acabó el tiempo: sin premio', '#ff2d55', 2.6); break;
      case 'exitChoice': G.mode = 'pecioShop'; ui.showPecioExit(s); sfx.milestone(); break;
      case 'cleared9': progress('pecioWin'); break;
      case 'endless': fx.banner('♾️ MODO SIN FIN', 'las plantas siguen, cada vez más duras', '#bf5af2', true, 2.4); break;
      case 'left': fx.notice('Lo dejas en el suelo', '#c8d6e5'); break;
      case 'scrap': fx.notice(`♻️ Desguazado: +${e.piezas} 🔩`, '#c8d6e5'); sfx.coin(5); break;
      case 'drop': if (e.kind === 'item') { fx.notice('✨ ¡Botín en el suelo!', '#ffcc00'); sfx.chest(); } break;
      case 'pickup': fx.notice(`${CONS[e.cons].icon} +1 ${CONS[e.cons].name}`, '#7df9ff'); sfx.coin(3); break;
      case 'bagFull': fx.notice(`${CONS[e.cons].icon} Ya llevas ${s.player.bagMax}`, '#ff9f0a', 2.6); break;
      case 'used': fx.notice(`${CONS[e.cons].icon} ${CONS[e.cons].name}`, '#7df9ff'); sfx.od(); break;
      case 'full': fx.notice('❤️ Ya estás entero', '#c8d6e5'); break;
      case 'leech': fx.notice('🩸 +1 ❤️', '#ff2d55'); break;
      case 'hpUp': fx.notice('❤️ +1', '#ff375f'); sfx.coin(2); break;
      case 'heal': s.flashes.push({ kind: 'heal', from: e.from, to: e.to, t: 0.35, max: 0.35 }); break;
      case 'mineDrop': sfx.bump(); s.flashes.push({ kind: 'boom', x: e.x, y: e.y, r: 0.35, t: 0.25, max: 0.25 }); break;
      case 'flood': fx.banner('🌊 ¡EL PECIO SE INUNDA!', `llevas más de ${FLOOD_AT} s: llegan refuerzos`, '#7df9ff', true, 2.2); sfx.alarm?.(); fx.shake(8); break;
      case 'fast': fx.notice(`⚡ ¡RÁPIDO! Racha ×${e.streak} · +${e.piezas} 🔩`, '#ffe600', 2.4); sfx.coin(6); progress('pecioStreak', e.streak); break;
      case 'streakLost': fx.notice('Racha perdida: limpia más deprisa', '#c8d6e5', 2); break;
      case 'regen': fx.notice('💚 +1 ❤️', '#30d158'); break;
      case 'frost': s.flashes.push({ kind: 'boom', x: e.x, y: e.y, r: 0.4, t: 0.25, max: 0.25 }); break;
      case 'phoenix': fx.banner('🪶 ¡FÉNIX!', 'vuelves con 3 ❤️ (solo una vez)', '#ff9f0a', true, 2.2); fx.flash('#ff9f0a', 0.4); sfx.milestone(); break;
      case 'synergy': { const T = TAGS[e.tag]; fx.banner(`${T.icon} ${T.name.toUpperCase()}`, T.desc, '#ffe600', true, 2.6); sfx.milestone(); progress('pecioSynergy'); break; }
      case 'mimic': fx.banner('😈 ¡MÍMICO!', 'el cofre muerde: véncelo y suelta su botín', '#ffcc00', true, 1.8); fx.shake(14); sfx.growl(); break;
      case 'secret': fx.banner('💎 ¡SALA OCULTA!', 'la pared agrietada escondía una puerta', '#7df9ff', true, 2); sfx.secret(); s.flashes.push({ kind: 'boom', x: e.x, y: e.y, r: 0.8, t: 0.4, max: 0.4 }); break;
      case 'crack': fx.notice('🧱 La pared cruje… embístela con 💨', '#c8d6e5', 2.6); break;
      case 'switch': fx.notice('🔌 Suelo eléctrico apagado', '#ffe600'); sfx.milestone(); break;
      case 'boom': s.flashes.push({ kind: 'boom', x: e.x, y: e.y, r: e.r, t: 0.35, max: 0.35 }); sfx.boom(); fx.shake(e.mine ? 6 : 10); break;
      case 'arc': s.flashes.push({ kind: 'arc', from: e.from, to: e.to, t: 0.18, max: 0.18 }); sfx.zap(); break;
      case 'mirror': fx.notice('🪞 ¡Golpe devuelto!', '#bfe9ff', 1.6); sfx.bump(); break;
      case 'eshot': s.flashes.push({ kind: 'eshot', from: e.from, to: e.to, t: 0.22, max: 0.22 }); sfx.near?.(true, 1); break;
      case 'beam': s.flashes.push({ kind: 'beam', from: e.from, to: e.to, t: 0.35, max: 0.35 }); break;
      case 'armed': sfx.alarm?.(); break;
      case 'ability': { const A = ABILITY_FX[e.id] || ABILITY_FX.nova; fx.notice(`⚡ ${A.name}`, A.color); A.snd(); fx.flash(A.color, 0.12); fx.shake(A.shake); juice.kill(s, s.player.x, s.player.y, A.color, false); break; }
      case 'dash': sfx.dash(); if (e.x != null) juice.dash(s, e.x, e.y, e.a); break;
      case 'win': fx.banner('🏆 ¡HAS SALIDO!', 'nueve plantas de pecio, superadas', '#ffe600', true, 2.5); break;
      default: break;
    }
  }
}

// Fin: te llevas parte de las 🔩 (todas si sales)
function finish(s) {
  if (G.mode === 'pecioEnd') return;
  const kept = Math.round(keptPiezas(s) * heatReward(s.heat));
  save.pecio.piezas += kept;
  save.pecio.best = Math.max(save.pecio.best || 0, s.endless ? s.depth : Math.min(s.depth, LAST_FLOOR));
  if (s.cleared9) save.pecio.wins = (save.pecio.wins || 0) + 1;
  // al salir de la planta 9, se abre la PROFUNDIDAD siguiente
  let heatUp = false;
  if (s.cleared9 && !s.daily && (s.heat || 0) + 1 > (save.pecio.heatMax || 0) && (s.heat || 0) < HEAT_MAX) { save.pecio.heatMax = (s.heat || 0) + 1; heatUp = true; }
  // INMERSIÓN DEL DÍA: su récord de hoy y, la primera vez, gemas
  let dailyGems = 0;
  if (s.daily) {
    const d = save.pecio.daily ||= { day: '', best: 0, paid: false };
    if (d.day !== s.day) Object.assign(d, { day: s.day, best: 0, paid: false });
    d.best = Math.max(d.best || 0, s.depth);
    if (!d.paid) { d.paid = true; dailyGems = DAILY_GEMS; save.gems += DAILY_GEMS; }
  }
  // gemas y XP de rango, como en los otros juegos
  const rw = pecioRewards({ depth: s.depth, bosses: s.bosses, rooms: s.roomsCleared, kills: s.kills, won: s.won || s.cleared9, heat: s.heat });
  const gems = Math.ceil(rw.gems * (1 + prestigeBonus(save)));
  save.gems += gems;
  const rankUps = addXp(save, rw.xp);
  progress('pecioDepth', s.depth);
  persist();
  const gear = {};
  for (const k of SLOTS) if (s.player.gear[k]) gear[k] = s.player.gear[k];
  s.result = { won: s.won, endless: s.endless, bosses: s.bosses, depth: s.endless ? s.depth : Math.min(s.depth, LAST_FLOOR), rooms: s.roomsCleared, kills: s.kills, found: s.player.piezas, kept, wallet: save.pecio.piezas, best: save.pecio.best, gear, bestItem: s.best, gems, xp: rw.xp, rankUps, heat: s.heat || 0, heatUp, daily: s.daily, dailyGems, dailyBest: s.daily ? save.pecio.daily.best : 0 };
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
  for (let t = 0; t < sec && s && (G.mode === 'pecio' || G.mode === 'pecioShop'); t += 1 / 30) {
    // las pantallas que se abren solas (botín, tienda, altar): el bot elige o las cierra
    if (G.mode === 'pecioShop') {
      if (s.offer) pecioTakeOffer(botOffer(s));
      else if (s.choice) pecioChooseExit('leave');
      else { G.mode = 'pecio'; ui.hideAll(); ui.showPecioHUD(true); }
      continue;
    }
    const inp = botInput(s);
    if (inp.ability) pecioAbility();
    if (inp.dash) pecioDash();
    if (inp.cons) pecioUseCons(inp.cons);
    pecioStep(1 / 30, inp);
  }
  return s && { depth: s.depth, at: s.at, hp: s.player.hp, over: s.over, mode: G.mode, kills: s.kills };
}
