// Arranque y bucle principal.
import { G } from './state.js';
import { initRender, render } from './render.js';
import { initInput } from './input.js';
import { unlockAudio } from './audio.js';
import { fx } from './fx.js';
import { moveLane, jump, slide, dash } from './player.js';
import { update, useAbility } from './game.js';
import { ui } from './ui.js';

initRender(document.getElementById('game'));
ui.init();
ui.showMenu();

initInput({
  any: unlockAudio,
  enabled: () => G.mode === 'play',
  swipe(dir) {
    if (dir === 'left') moveLane(-1);
    else if (dir === 'right') moveLane(1);
    else if (dir === 'up') jump();
    else slide();
  },
  double: dash,
  ability: useAbility,
  pause() {
    if (G.mode === 'play') ui.pause();
    else if (G.mode === 'paused') document.getElementById('btnResume').click();
  },
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.mode === 'play') ui.pause();
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
    update(STEP);
    acc -= STEP;
  }

  fx.update(real);
  render(real);
  ui.updateHUD(real);
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
      for (let t = 0; t < sec; t += STEP) { update(STEP); fx.update(STEP); }
      if (draw) {
        render(STEP);
        ui.updateHUD(1);
      }
      return { mode: G.mode, section: G.run?.section, score: Math.round(G.run?.score), mult: G.run?.mult, speed: G.run?.speed };
    },
  };
}

// ?nosw desactiva la caché offline mientras se desarrolla
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !location.search.includes('nosw')) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
