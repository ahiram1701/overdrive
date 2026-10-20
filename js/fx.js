// "Juice": partículas, shake, flash, slow-mo, textos flotantes y banners.
import { G, fmt } from './state.js';
import { save } from './save.js';

const MAXP = 1400;
const parts = Array.from({ length: MAXP }, () => ({ on: false }));
let pIdx = 0;
const rings = [];
const texts = [];
const banners = [];
const notices = [];
let side = 1;

const fxk = () => (save.settings.fx ? 1 : 0.3);

// Ancho que ocupa de verdad un texto dibujado (tinta real, centrado) más su contorno
function inkWidth(ctx, str, line) {
  const m = ctx.measureText(str);
  const l = m.actualBoundingBoxLeft, r = m.actualBoundingBoxRight;
  const ink = Number.isFinite(l) && Number.isFinite(r) ? Math.max(Math.abs(l), Math.abs(r)) * 2 : 0; // centrado: el lado que más se sale manda
  return Math.max(m.width, ink) + line;
}

export const fx = {
  shakeAmt: 0,
  flashA: 0,
  flashColor: '#fff',

  shake(a) { this.shakeAmt = Math.min(45, Math.max(this.shakeAmt, a * fxk())); },
  flash(color, a) { this.flashColor = color; this.flashA = Math.max(this.flashA, a * fxk()); },
  slowmo(dur, scale) { G.slowmo = Math.max(G.slowmo, dur); G.slowScale = scale; },
  hitstop(dur) { G.hitstop = Math.max(G.hitstop, dur); },
  vibe(p) {
    if (!save.settings.vibe || !navigator.vibrate) return;
    try { navigator.vibrate(p); } catch { /* sin soporte */ }
  },

  burst(x, y, n, color, spd = 320, size = 4, life = 0.6, grav = 600) {
    for (let i = 0; i < n; i++) {
      const p = parts[pIdx];
      pIdx = (pIdx + 1) % MAXP;
      const a = Math.random() * Math.PI * 2;
      const v = spd * (0.25 + Math.random() * 0.75);
      p.on = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v - spd * 0.3;
      p.life = p.max = life * (0.5 + Math.random() * 0.5);
      p.size = size * (0.6 + Math.random() * 0.8);
      p.color = typeof color === 'function' ? color() : color;
      p.g = grav;
    }
  },

  // chispas dirigidas (estela del motor, etc.)
  spark(x, y, vx, vy, color, size = 3, life = 0.3) {
    const p = parts[pIdx];
    pIdx = (pIdx + 1) % MAXP;
    p.on = true;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = p.max = life;
    p.size = size;
    p.color = color;
    p.g = 0;
  },

  ring(x, y, color, r = 160, life = 0.45, w = 10) { rings.push({ x, y, color, r, life, max: life, w }); },

  // Puntos ganados: pequeños, a un lado de la nave y agrupados por etiqueta ("¡CRASH! x4 +12K")
  // para no tapar la pista que viene.
  score(label, pts, x, y, color = '#fff') {
    if (save.settings.text === 'min') return;
    const same = texts.find((t) => t.label === label && t.max - t.life < 0.45);
    if (same) {
      same.n++;
      same.pts += pts;
      same.life = same.max;
      return;
    }
    side = -side;
    const off = Math.min(130, G.W * 0.3) * side;
    texts.push({ label, pts, n: 1, x: Math.max(70, Math.min(G.W - 70, x + off)), y, color, size: 16, life: 0.65, max: 0.65 });
  },

  // Un solo banner a la vez, en la franja del cielo. Si el modo de texto es mínimo,
  // solo se muestran los importantes y el resto pasa a aviso.
  // dur: segundos en pantalla (por defecto 1,4 los importantes y 0,95 el resto)
  banner(str, sub = '', color = '#fff', important = false, dur = null) {
    if (save.settings.text === 'min' && !important) return this.notice(str, color);
    // un banner normal nunca pisa a uno importante que siga en pantalla (p.ej. OVERDRIVE)
    const cur = banners[0];
    if (cur && cur.important && !important && cur.life > 0.3) return this.notice(str, color);
    banners.length = 0;
    const d = dur || (important ? 1.4 : 0.95);
    banners.push({ str, sub, color, life: d, max: d, important });
  },

  // Aviso pequeño sobre la barra de overdrive (cartas, escudos, recompensas).
  // Se guardan los 3 últimos (si llegan varios a la vez no se pisan; el mismo texto solo se refresca):
  // los modos que los apilan los ven todos y el resto, solo el último, como siempre.
  // dur: segundos en pantalla (los que explican qué hacer, más tiempo para leerlos)
  notice(str, color = '#fff', dur = 1.6) {
    const i = notices.findIndex((n) => n.str === str);
    if (i >= 0) notices.splice(i, 1);
    notices.push({ str, color, life: dur, max: dur });
    if (notices.length > 3) notices.shift();
  },

  // (tests) los avisos que hay ahora mismo
  get noticeList() { return notices.map((n) => n.str); },

  clear() {
    for (const p of parts) p.on = false;
    rings.length = texts.length = banners.length = notices.length = 0;
    this.shakeAmt = this.flashA = 0;
  },

  update(dt) {
    for (const p of parts) {
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) { p.on = false; continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = rings.length - 1; i >= 0; i--) if ((rings[i].life -= dt) <= 0) rings.splice(i, 1);
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      t.life -= dt;
      t.y -= 60 * dt;
      if (t.life <= 0) texts.splice(i, 1);
    }
    for (let i = banners.length - 1; i >= 0; i--) if ((banners[i].life -= dt) <= 0) banners.splice(i, 1);
    for (let i = notices.length - 1; i >= 0; i--) if ((notices[i].life -= dt) <= 0) notices.splice(i, 1);
    this.shakeAmt *= Math.exp(-dt * 9);
    if (this.shakeAmt < 0.2) this.shakeAmt = 0;
    this.flashA = Math.max(0, this.flashA - dt * 3.5);
  },

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      if (!p.on) continue;
      const k = p.life / p.max;
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      const s = p.size * (0.4 + k * 0.6);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    for (const r of rings) {
      const k = 1 - r.life / r.max;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.w * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r * (0.15 + k * 0.85), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  },

  // Textos de puntos: se dibujan fuera de la transformación del mundo. Si el mundo está
  // invertido (evento 'flip') se refleja solo su posición, nunca las letras.
  drawTexts(ctx, flipH = 0) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of texts) {
      const ty = flipH ? flipH - t.y : t.y;
      const k = t.life / t.max;
      const pop = k > 0.85 ? 1 + (k - 0.85) * 2 : 1;
      const str = `${t.label}${t.n > 1 ? ` x${t.n}` : ''} +${fmt(t.pts)}`;
      ctx.globalAlpha = Math.min(1, k * 2.5);
      ctx.font = `italic 900 ${Math.round(t.size * pop)}px system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,.75)';
      ctx.strokeText(str, t.x, ty);
      ctx.fillStyle = t.color;
      ctx.fillText(str, t.x, ty);
    }
    ctx.restore();
  },

  // opts: bannerY / noticeY (alturas; por defecto, el cartel en el cielo y los avisos abajo), stack (todos los
  // avisos apilados en vez de solo el último) y backdrop (franja oscura tras el cartel para que se lea siempre)
  drawBanners(ctx, W, H, opts = {}) {
    const { bannerY = H * 0.2, noticeY = H - 58, stack = false, backdrop = false } = opts;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const shown = stack ? notices : notices.slice(-1);
    shown.forEach((n, i) => {
      const a = Math.min(1, n.life / 0.3, (n.max - n.life) / 0.1);
      ctx.globalAlpha = a;
      // si no cabe, letra más pequeña (nunca se corta por los lados)
      let fs = 14;
      ctx.font = `800 ${fs}px system-ui, sans-serif`;
      let w = ctx.measureText(n.str).width + 24;
      if (w > W - 24) {
        fs = Math.max(9, Math.floor((fs * (W - 48)) / (w - 24)));
        ctx.font = `800 ${fs}px system-ui, sans-serif`;
        w = ctx.measureText(n.str).width + 24;
      }
      const y = noticeY + i * 30;
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.beginPath();
      // roundRect no existe en Safari < 16: rectángulo normal como alternativa
      if (ctx.roundRect) ctx.roundRect(W / 2 - w / 2, y - 13, w, 26, 13);
      else ctx.rect(W / 2 - w / 2, y - 13, w, 26);
      ctx.fill();
      ctx.fillStyle = n.color;
      ctx.fillText(n.str, W / 2, y + 1);
    });
    banners.forEach((b) => {
      const age = b.max - b.life;
      const inK = Math.min(1, age / 0.12);
      const outK = Math.min(1, b.life / 0.25);
      const scale = (0.5 + 0.5 * inK) * (1 + Math.max(0, 0.12 - age) * 2);
      // franja del cielo: por encima del horizonte (H*0.36) y por debajo de la barra del jefe
      const y = bannerY;
      ctx.globalAlpha = outK;
      if (backdrop) {
        const g = ctx.createLinearGradient(0, y - 44, 0, y + 50);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.3, 'rgba(0,0,0,.55)');
        g.addColorStop(0.75, 'rgba(0,0,0,.55)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, y - 44, W, 94);
      }
      ctx.translate(W / 2, y);
      ctx.scale(scale, scale);
      // se mide el texto de verdad: la estimación por caracteres se quedaba corta y se salía de pantalla
      let size = 46;
      ctx.font = `italic 900 ${size}px system-ui, sans-serif`;
      // se mide la TINTA real (la cursiva y algunos emojis se salen del "avance" del texto) + el contorno, y que quepa
      // también durante el "pop" de entrada (escala hasta ×1,24)
      const fit = (W * 0.88) / 1.24;
      let ink = inkWidth(ctx, b.str, 8);
      if (ink > fit) {
        size = Math.floor(size * fit / ink);
        ctx.font = `italic 900 ${size}px system-ui, sans-serif`;
        ink = inkWidth(ctx, b.str, 8);
      }
      fx.lastBannerBox = { left: W / 2 - (ink / 2) * scale, right: W / 2 + (ink / 2) * scale, W };
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(0,0,0,.75)';
      ctx.strokeText(b.str, 0, 0);
      ctx.fillStyle = b.color;
      ctx.fillText(b.str, 0, 0);
      if (b.sub) {
        let ss = Math.round(size * 0.32);
        ctx.font = `800 ${ss}px system-ui, sans-serif`;
        const sw = inkWidth(ctx, b.sub, 4);
        if (sw > fit) { ss = Math.max(9, Math.floor((ss * fit) / sw)); ctx.font = `800 ${ss}px system-ui, sans-serif`; }
        ctx.lineWidth = 4;
        ctx.strokeText(b.sub, 0, size * 0.62);
        ctx.fillStyle = '#fff';
        ctx.fillText(b.sub, 0, size * 0.62);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(G.dpr, G.dpr);
    });
    ctx.restore();
  },
};
