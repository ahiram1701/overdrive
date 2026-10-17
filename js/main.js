// Arranque y bucle principal.
import { G } from './state.js';
import { initRender, render } from './render.js';
import { initInput, held } from './input.js';
import { unlockAudio } from './audio.js';
import { fx } from './fx.js';
import { moveLane, jump, slide, dash } from './player.js';
import { update, useAbility } from './game.js';
import { ui } from './ui.js';
import { updateArena, arenaDash, useArenaAbility } from './arena.js';
import { renderArena } from './arenaRender.js';

const inArena = () => G.mode.startsWith('arena');
// un paso de simulación del modo que toque
function simStep(dt) {
  if (inArena()) {
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
  enabled: () => G.mode === 'play' || G.mode === 'arena',
  // ARENA: el dedo mueve la nave como un joystick (60 px = velocidad máxima)
  stick: {
    enabled: () => G.mode === 'arena',
    start() { if (G.arena) G.arena.stick = true; },
    move(dx, dy) { if (G.arena) G.arena.input = { x: Math.max(-1, Math.min(1, dx / 60)), y: Math.max(-1, Math.min(1, dy / 60)) }; },
    end() { if (G.arena) { G.arena.stick = false; G.arena.input = { x: 0, y: 0 }; } },
  },
  swipe(dir) {
    if (G.mode === 'arena') return;
    if (dir === 'left') moveLane(-1);
    else if (dir === 'right') moveLane(1);
    else if (dir === 'up') jump();
    else slide();
  },
  double: () => (G.mode === 'arena' ? arenaDash() : dash()),
  ability: () => (G.mode === 'arena' ? useArenaAbility() : useAbility()),
  pause() {
    if (G.mode === 'play' || G.mode === 'arena') ui.pause();
    else if (G.mode === 'paused' || G.mode === 'arenaPaused') document.getElementById('btnResume').click();
  },
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && (G.mode === 'play' || G.mode === 'arena')) ui.pause();
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
  if (inArena()) {
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
  window.D = {
    step(sec, draw = true) {
      for (let t = 0; t < sec; t += STEP) { simStep(STEP); fx.update(STEP); }
      if (draw) {
        if (inArena()) { renderArena(STEP); ui.updateArenaHUD(); } else { render(STEP); ui.updateHUD(1); }
      }
      return { mode: G.mode, section: G.run?.section, score: Math.round(G.run?.score), mult: G.run?.mult, speed: G.run?.speed };
    },
  };
}

// ?nosw desactiva la caché offline mientras se desarrolla
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !location.search.includes('nosw')) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
