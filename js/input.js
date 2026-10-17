// Gestos: swipe (se dispara en cuanto se supera el umbral, sin esperar a soltar) y doble toque.
const SWIPE_PX = 26;
const TAP_MS = 260;
const DOUBLE_MS = 320;

// Teclas mantenidas (la ARENA se mueve mientras las pulsas, no a golpes)
export const held = new Set();

export function initInput(h) {
  let sx = 0, sy = 0, st = 0, active = false, swiped = false, moved = 0, lastTap = 0, pid = null, stick = false;

  const ignore = (e) => e.target.closest && e.target.closest('button, .overlay');

  addEventListener('pointerdown', (e) => {
    h.any?.();
    if (ignore(e) || !h.enabled()) return;
    active = true;
    swiped = false;
    moved = 0;
    pid = e.pointerId;
    sx = e.clientX;
    sy = e.clientY;
    st = performance.now();
    // ARENA: joystick virtual (donde pongas el dedo es el centro)
    stick = !!h.stick?.enabled();
    if (stick) h.stick.start(sx, sy);
  });

  addEventListener('pointermove', (e) => {
    if (!active || e.pointerId !== pid) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    const d = Math.hypot(dx, dy);
    moved = Math.max(moved, d);
    if (stick) return h.stick.move(dx, dy);
    if (d < (swiped ? SWIPE_PX * 1.5 : SWIPE_PX)) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    h.swipe(dir);
    swiped = true;
    // permitir encadenar swipes sin levantar el dedo
    sx = e.clientX;
    sy = e.clientY;
  });

  const end = (e) => {
    if (!active || e.pointerId !== pid) return;
    active = false;
    if (stick) { stick = false; h.stick.end(); }
    if (swiped || moved > 18 || performance.now() - st > TAP_MS) return;
    const now = performance.now();
    if (now - lastTap < DOUBLE_MS) {
      lastTap = 0;
      h.double();
    } else lastTap = now;
  };
  addEventListener('pointerup', end);
  addEventListener('pointercancel', (e) => { if (e.pointerId === pid) active = false; });

  addEventListener('keyup', (e) => held.delete(e.key));
  addEventListener('blur', () => held.clear());
  addEventListener('keydown', (e) => {
    h.any?.();
    held.add(e.key);
    if (e.repeat) return;
    const k = e.key;
    if (k === 'Escape' || k === 'p') return h.pause?.();
    if (!h.enabled()) return;
    if (k === 'ArrowLeft' || k === 'a') h.swipe('left');
    else if (k === 'ArrowRight' || k === 'd') h.swipe('right');
    else if (k === 'ArrowUp' || k === 'w') h.swipe('up');
    else if (k === 'ArrowDown' || k === 's') h.swipe('down');
    else if (k === ' ' || k === 'Shift') h.double();
    else if (k === 'e' || k === 'q') h.ability?.();
    else return;
    e.preventDefault();
  });

  // evitar menú contextual / zoom por doble toque
  addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('dblclick', (e) => e.preventDefault());
}
