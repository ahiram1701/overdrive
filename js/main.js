// Arranque y bucle principal.
import { G } from './state.js';
import { initRender, render } from './render.js';
import { initInput, held } from './input.js';
import { unlockAudio } from './audio.js';
import { fx } from './fx.js';
import { moveLane, jump, slide, dash } from './player.js';
import { update, useAbility } from './game.js';
import { ui, dialogPaused } from './ui.js';
import { updateArena, arenaDash, useArenaAbility, debugArenaBoss } from './arena.js';
import { renderArena } from './arenaRender.js';
import { updateSpace, spaceBoost, spaceStats, spaceRoll, spaceMissile, forceEvent, spawnDevourer, useItem } from './spaceGame.js';
import { ITEM_KEYS } from './market.js';
import { save } from './save.js';
import { renderSpace } from './spaceRender.js';

const inSpace = () => G.mode === 'galaxy' || G.mode === 'station' || G.mode === 'galaxyPaused' || G.mode === 'galaxyMap' || G.mode === 'planet' || G.mode === 'galaxyInv';

const inArena = () => G.mode.startsWith('arena');
// un paso de simulación del modo que toque
function simStep(dt) {
  if (dialogPaused()) return; // leyendo la GUÍA o la historia: el mundo se para
  if (inSpace()) {
    const s = G.space;
    if (s && G.mode === 'galaxy') {
      const kx = (held.has('ArrowRight') || held.has('d') ? 1 : 0) - (held.has('ArrowLeft') || held.has('a') ? 1 : 0);
      const ky = (held.has('ArrowDown') || held.has('s') ? 1 : 0) - (held.has('ArrowUp') || held.has('w') ? 1 : 0);
      if (kx || ky) s.input = { x: kx, y: ky };
      else if (!s.stick) s.input = s.botInput || { x: 0, y: 0 };
      s.firing = held.has(' ') || !!s.fireHeld || !!s.botFire;
      // Q/E = alabeo; R/F = acelerador (los botones ↺ ↻ y la palanca hacen lo mismo en el móvil)
      const kr = (held.has('e') || held.has('E') ? 1 : 0) - (held.has('q') || held.has('Q') ? 1 : 0);
      s.ship.rollIn = kr || s.rollBtn || 0;
      const kt = (held.has('r') || held.has('R') ? 1 : 0) - (held.has('f') || held.has('F') ? 1 : 0);
      // al cruzar el 0 se queda PARADO hasta soltar la tecla (la misma muesca que la palanca)
      if (kt && !s.thrHold) {
        const t0 = s.ship.throttle ?? 1;
        let t1 = Math.max(-0.4, Math.min(1, t0 + kt * dt * 0.9));
        if (t0 !== 0 && Math.sign(t1) !== Math.sign(t0)) { t1 = 0; s.thrHold = true; fx.vibe(15); }
        s.ship.throttle = t1;
      } else if (!kt) s.thrHold = false;
    }
    updateSpace(dt);
  } else if (inArena()) {
    if (G.arena && G.mode === 'arena') {
      const kx = (held.has('ArrowRight') || held.has('d') ? 1 : 0) - (held.has('ArrowLeft') || held.has('a') ? 1 : 0);
      const ky = (held.has('ArrowDown') || held.has('s') ? 1 : 0) - (held.has('ArrowUp') || held.has('w') ? 1 : 0);
      if (kx || ky) G.arena.input = { x: kx, y: ky };
      else if (!G.arena.stick) G.arena.input = G.arena.botInput || { x: 0, y: 0 };
    }
    updateArena(dt);
  } else update(dt);
}

initRender(document.getElementById('game'));
ui.init();
ui.showMenu();

initInput({
  any: unlockAudio,
  enabled: () => !dialogPaused() && (G.mode === 'play' || G.mode === 'arena' || G.mode === 'galaxy'),
  // ARENA: el dedo mueve la nave como un joystick (60 px = velocidad máxima)
  stick: {
    enabled: () => !dialogPaused() && (G.mode === 'arena' || G.mode === 'galaxy'),
    // en la arena y en la galaxia el dedo es un joystick: allí mueve, aquí vira
    target: () => (G.mode === 'galaxy' ? G.space : G.arena),
    start(x, y) { const t = this.target(); if (t) t.stick = true; if (G.mode === 'galaxy') ui.stickVis(x, y, 0, 0); },
    move(dx, dy) {
      const t = this.target();
      if (t) t.input = { x: Math.max(-1, Math.min(1, dx / 60)), y: Math.max(-1, Math.min(1, dy / 60)) };
      if (G.mode === 'galaxy') ui.stickVis(null, null, dx, dy);
    },
    end() { const t = this.target(); if (t) { t.stick = false; t.input = { x: 0, y: 0 }; } ui.stickVis(); },
  },
  swipe(dir) {
    if (G.mode === 'arena' || G.mode === 'galaxy') return;
    if (dir === 'left') moveLane(-1);
    else if (dir === 'right') moveLane(1);
    else if (dir === 'up') jump();
    else slide();
  },
  // doble toque (o Shift): DASH en el runner y la arena. En la galaxia, doble toque = TONEL y Shift = impulso
  double: () => (G.mode === 'galaxy' ? (held.has('Shift') ? spaceBoost() : held.has(' ') ? null : spaceRoll()) : G.mode === 'arena' ? arenaDash() : dash()),
  extra: (k) => {
    if (G.mode !== 'galaxy') return;
    if ('12345'.includes(k)) useItem(ITEM_KEYS[Number(k) - 1]); // consumibles
    else if (k === 'i') ui.showGalInv(); else if (k === 'x') spaceRoll(); else spaceMissile();
  },
  ability: () => (G.mode === 'arena' ? useArenaAbility() : useAbility()),
  pause() {
    if (dialogPaused()) return;
    if (G.mode === 'play' || G.mode === 'arena' || G.mode === 'galaxy') ui.pause();
    else if (G.mode === 'paused' || G.mode === 'arenaPaused' || G.mode === 'galaxyPaused') document.getElementById('btnResume').click();
  },
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && (G.mode === 'play' || G.mode === 'arena' || G.mode === 'galaxy')) ui.pause();
});

const STEP = 1 / 120;
let last = performance.now();
let acc = 0;

function tick(now) {
  // el timestamp de rAF puede ser anterior a performance.now() del arranque: nunca dt negativo
  const real = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  G.realTime += real;

  let dt = real * G.timeWarp;
  if (G.hitstop > 0) {
    G.hitstop -= real;
    dt = 0;
  } else if (G.slowmo > 0) {
    G.slowmo -= real;
    dt = real * Math.min(G.slowScale, G.timeWarp);
  }

  // paso fijo para que física y colisiones no dependan de los fps
  // G.manual (solo debug/tests): la simulación avanza únicamente con D.step, para ser determinista
  acc = G.manual ? 0 : acc + dt;
  while (acc >= STEP) {
    simStep(STEP);
    acc -= STEP;
  }

  fx.update(real);
  // en el hangar el mundo no se ve: no dibujarlo ahorra batería
  if (inSpace()) {
    renderSpace(real);
    ui.updateSpaceHUD();
  } else if (inArena()) {
    renderArena(real);
    ui.updateArenaHUD();
  } else {
    if (G.mode !== 'hangar') render(real);
    ui.updateHUD(real);
  }
}

let lastError = 0;
function frame(now) {
  // pase lo que pase en un frame, el siguiente se pide igual: una excepción nunca congela el juego
  try {
    tick(now);
  } catch (e) {
    if (now - lastError > 2000) { lastError = now; console.error(e); }
  } finally {
    requestAnimationFrame(frame);
  }
}
requestAnimationFrame(frame);

// Herramientas de depuración (?debug): G.god = true ignora golpes; D.step(s) simula s segundos.
if (G.debug) {
  window.G = G;
  window.__save = save; // para los bots de los tests
  window.__spaceStats = spaceStats;
  window.__forceEvent = forceEvent;
  window.__devourer = () => spawnDevourer();
  window.__arenaBoss = (id) => debugArenaBoss(id);
  window.D = {
    step(sec, draw = true) {
      for (let t = 0; t < sec; t += STEP) { simStep(STEP); fx.update(STEP); }
      if (draw) {
        if (inSpace()) { renderSpace(STEP); ui.updateSpaceHUD(); } else if (inArena()) { renderArena(STEP); ui.updateArenaHUD(); } else { render(STEP); ui.updateHUD(1); }
      }
      return { mode: G.mode, section: G.run?.section, score: Math.round(G.run?.score), mult: G.run?.mult, speed: G.run?.speed };
    },
  };
}

// ?nosw desactiva la caché offline mientras se desarrolla
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !location.search.includes('nosw')) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
