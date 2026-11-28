// PECIOS · "GAME JUICE": partículas en el MUNDO (chispas, metralla, humo y anillos) con un pool fijo.
// Puro: solo números (el dibujo, en pecioRender.js). Coordenadas: x = columna, y = fila, h = altura.
export const MAX_PARTS = 420;

// una tanda de partículas en (x, y): n, color, velocidad, vida, altura, tamaño, gravedad, frenado
export function emit(s, x, y, n, o = {}) {
  const P = (s.parts ||= []);
  const rnd = s.fxRng || Math.random;
  const { color = '#ffe08a', speed = 3, life = 0.4, h = 0.4, size = 1, grav = 0, drag = 3, kind = 'spark', dir = null, spread = Math.PI, up = 0 } = o;
  for (let i = 0; i < n; i++) {
    if (P.length >= MAX_PARTS) P.shift(); // lo más viejo deja sitio (nunca crece sin límite)
    const a = dir == null ? rnd() * Math.PI * 2 : dir + (rnd() - 0.5) * 2 * spread;
    const v = speed * (0.35 + rnd() * 0.65);
    const l = life * (0.6 + rnd() * 0.5);
    P.push({ x, y, h, vx: Math.sin(a) * v, vy: -Math.cos(a) * v, vh: up * (0.5 + rnd()), t: l, max: l, color, size: size * (0.6 + rnd() * 0.6), grav, drag, kind });
  }
}
export function stepParts(s, dt) {
  const P = s.parts;
  if (!P || !P.length) return;
  let j = 0;
  for (let i = 0; i < P.length; i++) {
    const q = P[i];
    q.t -= dt;
    if (q.t <= 0) continue;
    const k = Math.max(0, 1 - q.drag * dt);
    q.vx *= k; q.vy *= k;
    q.vh -= q.grav * dt;
    q.x += q.vx * dt; q.y += q.vy * dt; q.h = Math.max(0.02, q.h + q.vh * dt);
    if (q.h <= 0.02 && q.vh < 0) { q.vh = -q.vh * 0.35; q.vx *= 0.6; q.vy *= 0.6; } // la metralla rebota en el suelo
    P[j++] = q;
  }
  P.length = j;
}

// recetas: lo que suelta cada cosa
export const juice = {
  hit(s, x, y, crit) { emit(s, x, y, crit ? 10 : 5, { color: crit ? '#ffe600' : '#ffe08a', speed: crit ? 5 : 3.5, life: 0.25 }); },
  wall(s, x, y, big) { emit(s, x, y, big ? 9 : 4, { color: '#bfe9ff', speed: 2.6, life: 0.22, size: 0.8 }); },
  muzzle(s, x, y, a, big) { emit(s, x + Math.sin(a) * 0.4, y - Math.cos(a) * 0.4, big ? 7 : 3, { color: big ? '#ffb340' : '#7df9ff', speed: big ? 5 : 4, life: 0.12, dir: a, spread: 0.35 }); },
  kill(s, x, y, color, big) {
    emit(s, x, y, big ? 34 : 16, { color, speed: big ? 7 : 5, life: big ? 0.7 : 0.45, size: 1.3 });
    emit(s, x, y, big ? 14 : 6, { color: '#9aa0b4', kind: 'debris', speed: big ? 4 : 2.8, life: 1.1, up: 3, grav: 9, drag: 1.2, size: 1.6 });
    emit(s, x, y, big ? 8 : 3, { color: '#3a3346', kind: 'smoke', speed: 0.6, life: 0.9, up: 0.7, drag: 1, size: big ? 3 : 2 });
  },
  dash(s, x, y, a) { emit(s, x, y, 10, { color: '#ffffff', speed: 2.2, life: 0.3, dir: a + Math.PI, spread: 0.5, size: 0.9 }); },
  engine(s, x, y, a) { emit(s, x - Math.sin(a) * 0.3, y + Math.cos(a) * 0.3, 1, { color: '#00e5ff', speed: 0.8, life: 0.25, dir: a + Math.PI, spread: 0.4, size: 0.8 }); },
  hurt(s, x, y) { emit(s, x, y, 14, { color: '#ff2d55', speed: 4, life: 0.35 }); },
};
