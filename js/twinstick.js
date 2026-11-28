// PECIOS · TWIN-STICK: dos joysticks en el móvil (mitad izquierda mueve, mitad derecha apunta y dispara),
// ratón en el PC (apuntas con el puntero y disparas con el botón; WASD mueve; las flechas también apuntan).
// Cada dedo es su propio joystick (donde lo apoyas es el centro). Va antes que los gestos generales (input.js),
// así un toque para apuntar no cuenta como doble toque.
import { G } from './state.js';
import { save } from './save.js';

const R = 56; // px = joystick a tope
export const twinOn = () => save.settings?.pecioAuto !== true;

const st = { move: null, aim: null, mouse: null, mouseT: -1 };
let visMove = null, visAim = null;

// lo que dicen los sticks/teclas/ratón ahora mismo, como entrada de pecio.js (o null si no toca)
export function twinInput(held) {
  const s = G.pecio;
  if (!s || G.mode !== 'pecio' || !twinOn()) return null;
  const k = (a, b) => (held.has(a) || held.has(b) ? 1 : 0);
  let x = k('d', 'D') - k('a', 'A'), y = k('s', 'S') - k('w', 'W');
  if (st.move) { x = st.move.dx / R; y = st.move.dy / R; }
  let ax = (held.has('ArrowRight') ? 1 : 0) - (held.has('ArrowLeft') ? 1 : 0), ay = (held.has('ArrowDown') ? 1 : 0) - (held.has('ArrowUp') ? 1 : 0);
  let fire = !!(ax || ay);
  if (st.aim) {
    ax = st.aim.dx / R; ay = st.aim.dy / R;
    fire = Math.hypot(ax, ay) > 0.35; // empujar el stick derecho = disparar
  } else if (st.mouse && s.pScr && G.realTime - st.mouseT < 4) {
    // RATÓN: hacia el puntero desde tu nave (la cámara mira al norte: la pantalla es el mapa)
    const dx = st.mouse.x - s.pScr.x, dy = st.mouse.y - s.pScr.y, d = Math.hypot(dx, dy);
    if (d > 8) { ax = dx / d; ay = dy / d; }
    fire = st.mouse.down;
  }
  const c = (v) => Math.max(-1, Math.min(1, v));
  return { abs: true, x: c(x), y: c(y), ax: c(ax), ay: c(ay), fire };
}

function vis(el, P) {
  if (!el) return;
  if (!P) { el.classList.add('hidden'); return; }
  el.style.left = `${P.x0}px`;
  el.style.top = `${P.y0}px`;
  el.classList.remove('hidden');
  const d = Math.hypot(P.dx, P.dy), k = d > R ? R / d : 1;
  el.firstElementChild.style.transform = `translate(${P.dx * k}px, ${P.dy * k}px)`;
}

export function initTwin({ enabled }) {
  visMove = document.getElementById('stickVis');
  visAim = document.getElementById('stickVis2');
  const on = () => G.mode === 'pecio' && twinOn() && enabled();
  const skip = (e) => e.target.closest && e.target.closest('button, input, .overlay');
  addEventListener('pointerdown', (e) => {
    if (!on() || skip(e)) return;
    if (e.pointerType === 'mouse') {
      st.mouse = { x: e.clientX, y: e.clientY, down: e.button === 0 };
      st.mouseT = G.realTime;
    } else {
      const side = e.clientX < innerWidth / 2 ? 'move' : 'aim';
      if (st[side]) return;
      st[side] = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
      vis(side === 'move' ? visMove : visAim, st[side]);
    }
    e.stopImmediatePropagation();
  }, true);
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') {
      if (G.mode !== 'pecio') return;
      st.mouse = { x: e.clientX, y: e.clientY, down: !!st.mouse?.down && (e.buttons & 1) === 1 };
      st.mouseT = G.realTime;
      return;
    }
    for (const side of ['move', 'aim']) {
      const P = st[side];
      if (!P || P.id !== e.pointerId) continue;
      P.dx = e.clientX - P.x0; P.dy = e.clientY - P.y0;
      vis(side === 'move' ? visMove : visAim, P);
      e.stopImmediatePropagation();
    }
  }, true);
  const end = (e) => {
    if (e.pointerType === 'mouse') { if (st.mouse) st.mouse.down = false; return; }
    for (const side of ['move', 'aim']) {
      if (st[side]?.id !== e.pointerId) continue;
      st[side] = null;
      vis(side === 'move' ? visMove : visAim, null);
      e.stopImmediatePropagation();
    }
  };
  addEventListener('pointerup', end, true);
  addEventListener('pointercancel', end, true);
}
// al salir de Pecios (o pausar), los sticks se sueltan
export function twinReset() {
  st.move = st.aim = null;
  if (st.mouse) st.mouse.down = false;
  vis(visMove, null);
  vis(visAim, null);
}
