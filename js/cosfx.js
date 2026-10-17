// Efectos de los cosméticos: estela y explosión. Los usan la partida (con fx, sobre el canvas del
// juego) y la vista previa del hangar (con su propio montón de partículas): así lo que pruebas en el
// hangar es exactamente lo que verás jugando.
// sink = { spark(x, y, vx, vy, color, size, life), burst(x, y, n, color, spd, size, life, grav),
//          ring(x, y, color, r, life, w), flash(color, a) }

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Estela detrás de la nave. t = tiempo real (para el arcoíris), speed = velocidad de la partida.
export function trailFx(sink, ctx, id, x, y, s, col, speed, t) {
  const vy = 200 + speed * 4;
  switch (id) {
    case 'ribbon': {
      const ribbon = (sink.ribbon ||= []);
      ribbon.unshift([x, y + 0.12 * s]);
      ribbon.length = Math.min(ribbon.length, 14);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (let i = 1; i < ribbon.length; i++) {
        ctx.strokeStyle = hexA(col.length === 7 ? col : '#ffffff', 0.6 * (1 - i / ribbon.length));
        ctx.lineWidth = s * 0.16 * (1 - i / ribbon.length);
        ctx.beginPath();
        ctx.moveTo(ribbon[i - 1][0], ribbon[i - 1][1] + (i - 1) * s * 0.06);
        ctx.lineTo(ribbon[i][0], ribbon[i][1] + i * s * 0.06);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'pixels':
      sink.spark(x + (Math.random() - 0.5) * s * 0.3, y + 0.15 * s, (Math.random() - 0.5) * 60, vy * 0.7, col, s * 0.11, 0.4);
      break;
    case 'rainbow':
      sink.spark(x + (Math.random() - 0.5) * s * 0.2, y + 0.15 * s, (Math.random() - 0.5) * 40, vy, `hsl(${(t * 900) % 360},100%,60%)`, s * 0.07, 0.35);
      break;
    case 'comet':
      for (let i = 0; i < 2; i++) sink.spark(x + (Math.random() - 0.5) * s * 0.1, y + 0.15 * s, (Math.random() - 0.5) * 20, vy * 1.3, i ? '#ffffff' : col, s * 0.09, 0.5);
      break;
    case 'prism':
      // abanico de los colores del arcoíris, cada uno con su ángulo
      for (let i = 0; i < 3; i++) {
        const hue = (t * 300 + i * 120) % 360;
        sink.spark(x + (i - 1) * s * 0.12, y + 0.15 * s, (i - 1) * 60, vy, `hsl(${hue},100%,65%)`, s * 0.06, 0.4);
      }
      break;
    case 'smoke':
      if (Math.random() < 0.6) sink.spark(x + (Math.random() - 0.5) * s * 0.2, y + 0.18 * s, (Math.random() - 0.5) * 30, vy * 0.3, 'rgba(170,170,190,.45)', s * (0.12 + Math.random() * 0.1), 0.9);
      break;
    case 'lightning': {
      // un rayo en zigzag desde el motor, nuevo cada frame
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineJoin = 'miter';
      for (const [w, c] of [[s * 0.07, hexA(col.length === 7 ? col : '#7df9ff', 0.35)], [s * 0.025, '#ffffff']]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        let px = x, py = y + 0.15 * s;
        ctx.moveTo(px, py);
        for (let i = 0; i < 6; i++) {
          px = x + (Math.random() - 0.5) * s * 0.35;
          py += s * 0.13;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    default: // chispas
      sink.spark(x + (Math.random() - 0.5) * s * 0.15, y + 0.15 * s, (Math.random() - 0.5) * 40, vy, col, s * 0.05, 0.25);
  }
}

// Ejecuta fn tras ms (los efectos en varias fases); en Node no hay ventana, pero tampoco se dibuja
const later = (ms, fn) => (typeof setTimeout !== 'undefined' ? setTimeout(fn, ms) : fn());

// Explosión de la nave. edge = color de la pintura, accent = color del bioma. k escala el tamaño
// (el hangar es más pequeño que la pantalla de juego).
export function boomFx(sink, id, x, y, edge, accent, k = 1) {
  switch (id) {
    case 'pixel':
      for (let i = 0; i < 4; i++) sink.burst(x, y, 30, i % 2 ? '#ffffff' : edge, 650 * k, 16 * k, 1.2, 700 * k);
      break;
    case 'confetti':
      for (let i = 0; i < 6; i++) sink.burst(x, y, 30, () => `hsl(${Math.random() * 360},100%,60%)`, 900 * k, 7 * k, 1.6, 900 * k);
      break;
    case 'supernova':
      for (let i = 0; i < 3; i++) sink.ring(x, y, i ? '#ffd60a' : '#ffffff', (300 + i * 260) * k, 0.5 + i * 0.25, (30 - i * 8) * k);
      sink.burst(x, y, 90, '#ffd60a', 1100 * k, 6 * k, 1.3, 0);
      sink.flash('#ffd60a', 1);
      break;
    case 'glitch':
      for (let i = 0; i < 8; i++) sink.burst(x + (Math.random() - 0.5) * 160 * k, y + (Math.random() - 0.5) * 60 * k, 14, i % 2 ? '#39ff14' : '#ff00ff', 400 * k, 10 * k, 0.9, 0);
      break;
    case 'blackhole': {
      // la materia cae hacia el centro… y luego estalla
      const R = 260 * k;
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * Math.PI * 2, rr = R * (0.6 + Math.random() * 0.4);
        sink.spark(x + Math.cos(a) * rr, y + Math.sin(a) * rr, -Math.cos(a) * rr * 2.6, -Math.sin(a) * rr * 2.6, i % 3 ? edge : '#bf5af2', 5 * k, 0.38);
      }
      later(380, () => {
        sink.ring(x, y, '#bf5af2', 420 * k, 0.6, 26 * k);
        sink.burst(x, y, 50, '#ffffff', 900 * k, 5 * k, 0.8, 0);
        sink.flash('#bf5af2', 0.6);
      });
      break;
    }
    case 'singularity': {
      // todo colapsa en un punto blanco… y el universo vuelve a empezar
      for (let i = 0; i < 4; i++) sink.ring(x, y, i % 2 ? '#ffffff' : edge, (600 - i * 120) * k, 0.25 + i * 0.08, 14 * k);
      later(300, () => {
        sink.flash('#ffffff', 1);
        for (const c of ['#ffffff', '#bf5af2', '#00e5ff', '#ffe600']) sink.burst(x, y, 60, c, 1300 * k, 6 * k, 1.5, 0);
        sink.ring(x, y, '#ffffff', 900 * k, 0.9, 36 * k);
      });
      break;
    }
    case 'fireworks':
      // tres palmeras de colores, una tras otra
      ['#ff2bd6', '#ffe600', '#00e5ff'].forEach((c, i) => later(i * 260, () => {
        const ox = (i - 1) * 110 * k, oy = -60 * k * (i % 2 ? 1.6 : 1);
        sink.burst(x + ox, y + oy, 45, c, 700 * k, 5 * k, 1.3, 260 * k);
        sink.ring(x + ox, y + oy, c, 200 * k, 0.4, 8 * k);
      }));
      break;
    default:
      for (const c of ['#fff', '#ff2d55', '#ffcc00', accent]) sink.burst(x, y, 40, c, 800 * k, 7 * k, 1.1, 500 * k);
      sink.ring(x, y, '#fff', 500 * k, 0.6, 24 * k);
  }
}

// Montón de partículas propio para un canvas pequeño (vista previa del hangar)
export function makeParticles() {
  const parts = [], rings = [];
  let flashA = 0, flashC = '#fff';
  const col = (c) => (typeof c === 'function' ? c() : c);
  return {
    spark(x, y, vx, vy, c, size = 3, life = 0.3) { parts.push({ x, y, vx, vy, c: col(c), size, life, max: life, g: 0 }); },
    burst(x, y, n, c, spd = 320, size = 4, life = 0.6, grav = 600) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = spd * (0.3 + Math.random() * 0.7);
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: col(c), size: size * (0.5 + Math.random()), life: life * (0.6 + Math.random() * 0.4), max: life, g: grav });
      }
    },
    ring(x, y, c, r = 160, life = 0.45, w = 10) { rings.push({ x, y, c, r, life, max: life, w }); },
    flash(c, a) { flashC = c; flashA = Math.max(flashA, a * 0.5); },
    clear() { parts.length = 0; rings.length = 0; flashA = 0; this.ribbon = []; },
    get count() { return parts.length + rings.length; },
    update(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (let i = rings.length - 1; i >= 0; i--) if ((rings[i].life -= dt) <= 0) rings.splice(i, 1);
      flashA = Math.max(0, flashA - dt * 2);
    },
    draw(ctx, w, h) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of parts) {
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      for (const r of rings) {
        const k = 1 - r.life / r.max;
        ctx.globalAlpha = r.life / r.max;
        ctx.strokeStyle = r.c;
        ctx.lineWidth = r.w * (1 - k) + 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r * k, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      if (flashA > 0) {
        ctx.save();
        ctx.globalAlpha = flashA;
        ctx.fillStyle = flashC;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    },
  };
}
