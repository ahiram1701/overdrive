// Todo el sonido se sintetiza con Web Audio: cero archivos, y el tono puede seguir a la velocidad/combo.
import { save } from './save.js';
import { SONGS, STEPS, stepEvents, midiHz } from './music.js';

let ctx = null, master, sfxBus, musicBus, musicFilter, noiseBuf, sfxDuck;

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  // LIMITADOR en la salida: nada satura, ni con todo sonando a la vez
  const limit = ctx.createDynamicsCompressor();
  limit.threshold.value = -3;
  limit.knee.value = 0;
  limit.ratio.value = 20;
  limit.attack.value = 0.002;
  limit.release.value = 0.12;
  master = ctx.createGain();
  master.gain.value = save.settings.sound ? 0.8 : 0;
  master.connect(limit).connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.9 * setting('sfxVol', 1);
  sfxBus.connect(master);
  musicFilter = ctx.createBiquadFilter();
  musicFilter.type = 'lowpass';
  musicFilter.frequency.value = 18000;
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.0001;
  // la música tiene su propio compresor (pega más, sin que los efectos la hagan bombear)…
  const mcomp = ctx.createDynamicsCompressor();
  mcomp.threshold.value = -16;
  mcomp.ratio.value = 3.5;
  mcomp.attack.value = 0.01;
  mcomp.release.value = 0.18;
  // …y se agacha un poco con los efectos fuertes (explosiones, golpes)
  sfxDuck = ctx.createGain();
  musicBus.connect(mcomp).connect(sfxDuck).connect(musicFilter).connect(master);
  musicFx();

  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  setInterval(scheduler, 25);
  shaperCurve = makeCurve(2.2);
  // si ya había una canción pedida (el menú suena antes del primer toque), arranca ahora
  if (music.on) { music.next = ctx.currentTime + 0.08; musicBus.gain.setTargetAtTime(musicLevel(), ctx.currentTime, 0.3); }
}

// VOLÚMENES (Ajustes): música y efectos por separado; el interruptor 🔊 sigue siendo el general
const setting = (k, d) => { const v = save.settings?.[k]; return typeof v === 'number' && v >= 0 && v <= 1 ? v : d; };
const musicLevel = () => 0.95 * setting('musicVol', 0.7); // en el iPhone sonaba bajita
export function setVolumes() {
  if (!ctx) return;
  sfxBus.gain.setTargetAtTime(0.9 * setting('sfxVol', 1), ctx.currentTime, 0.03);
  if (music.on) musicBus.gain.setTargetAtTime(musicLevel(), ctx.currentTime, 0.03);
}

export function setSound(on) {
  save.settings.sound = on;
  if (master) master.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, 0.02);
}

// un efecto fuerte agacha la música un momento (se oye lo que importa)
function duckForSfx(vol, dest, t) {
  if (dest !== sfxBus || vol < 0.45 || !sfxDuck) return;
  sfxDuck.gain.cancelScheduledValues(t);
  sfxDuck.gain.setTargetAtTime(0.6, t, 0.01);
  sfxDuck.gain.setTargetAtTime(1, t + 0.12, 0.15);
}
function tone({ type = 'square', f = 440, f2 = null, dur = 0.1, vol = 0.25, when = 0, dest = sfxBus, attack = 0.004, cutoff = 0 }) {
  if (!ctx) return;
  if (!cutoff && type === 'square' && dest === sfxBus) cutoff = 3400; // el cuadrado puro chirría: se le quita el filo
  duckForSfx(vol, dest, ctx.currentTime + when);
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (cutoff) {
    const fl = ctx.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = cutoff;
    o.connect(fl);
    node = fl;
  }
  node.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.2, vol = 0.3, type = 'lowpass', f = 1000, f2 = null, q = 1, when = 0, dest = sfxBus }) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  duckForSfx(vol, dest, t);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const fl = ctx.createBiquadFilter();
  fl.type = type;
  fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(fl).connect(g).connect(dest);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

const semi = (base, n) => base * Math.pow(2, n / 12);

export const sfx = {
  swish() { noise({ dur: 0.09, vol: 0.18, type: 'bandpass', f: 2600, f2: 700, q: 2 }); },
  bump() { tone({ type: 'square', f: 110, f2: 80, dur: 0.08, vol: 0.15 }); },
  jump() { tone({ type: 'sine', f: 320, f2: 820, dur: 0.16, vol: 0.22 }); },
  dbljump() { tone({ type: 'triangle', f: 600, f2: 1400, dur: 0.14, vol: 0.2 }); },
  land() { noise({ dur: 0.08, vol: 0.2, f: 500 }); },
  slide() { noise({ dur: 0.22, vol: 0.18, type: 'bandpass', f: 1500, f2: 300, q: 1.5 }); },
  dash() {
    tone({ type: 'sawtooth', f: 1100, f2: 90, dur: 0.32, vol: 0.22 });
    noise({ dur: 0.3, vol: 0.3, type: 'bandpass', f: 4000, f2: 400, q: 0.8 });
  },
  near(perfect, mult) {
    noise({ dur: 0.18, vol: 0.28, type: 'bandpass', f: 5000, f2: 900, q: 3 });
    const f = semi(520, Math.min(mult, 36));
    tone({ type: 'triangle', f, dur: 0.12, vol: 0.18 });
    if (perfect) tone({ type: 'square', f: f * 2, dur: 0.1, vol: 0.1, when: 0.05 });
  },
  coin(n) {
    const f = semi(880, n % 24);
    tone({ type: 'square', f, dur: 0.05, vol: 0.09 });
    tone({ type: 'square', f: f * 1.5, dur: 0.07, vol: 0.08, when: 0.04 });
  },
  brk() {
    noise({ dur: 0.28, vol: 0.45, f: 3500, f2: 180 });
    tone({ type: 'sine', f: 140, f2: 40, dur: 0.25, vol: 0.4 });
  },
  boom() {
    noise({ dur: 0.9, vol: 0.7, f: 2500, f2: 50 });
    tone({ type: 'sine', f: 90, f2: 25, dur: 0.7, vol: 0.6 });
  },
  shield() {
    tone({ type: 'square', f: 300, f2: 120, dur: 0.25, vol: 0.2 });
    noise({ dur: 0.3, vol: 0.35, type: 'highpass', f: 2000 });
  },
  die() {
    sfx.boom();
    tone({ type: 'sawtooth', f: 440, f2: 30, dur: 1.2, vol: 0.3 });
  },
  arp(notes, base = 523, step = 0.06, type = 'square', vol = 0.12) {
    notes.forEach((n, i) => tone({ type, f: semi(base, n), dur: step * 1.8, vol, when: i * step }));
  },
  card() { sfx.arp([0, 4, 7, 12, 16], 523, 0.05, 'triangle', 0.18); },
  milestone() { sfx.arp([0, 7, 12, 19, 24], 440, 0.045, 'square', 0.13); },
  od() {
    tone({ type: 'sawtooth', f: 160, f2: 2200, dur: 0.7, vol: 0.25 });
    noise({ dur: 0.8, vol: 0.4, type: 'bandpass', f: 300, f2: 8000, q: 1 });
    sfx.arp([0, 12, 24], 220, 0.12, 'square', 0.1);
  },
  alarm() {
    for (let i = 0; i < 3; i++) tone({ type: 'square', f: 440, f2: 330, dur: 0.22, vol: 0.14, when: i * 0.3 });
  },
  event() { sfx.arp([0, 6, 12, 6, 0], 330, 0.07, 'sawtooth', 0.1); },
  ui() { tone({ type: 'square', f: 900, dur: 0.04, vol: 0.08 }); },
  chest() { sfx.arp([0, 3, 7, 10, 12, 15, 19, 24], 392, 0.05, 'square', 0.12); },
  // PECIOS: el disparo suena según el arma
  pew(kind) {
    const P = {
      basic: ['square', 880, 440, 0.05, 0.05], spread: ['sawtooth', 700, 300, 0.07, 0.05], pierce: ['triangle', 1400, 900, 0.06, 0.07],
      bounce: ['sine', 600, 1200, 0.07, 0.07], blast: ['square', 260, 90, 0.12, 0.08], rapid: ['square', 1100, 700, 0.03, 0.035],
      arc: ['sawtooth', 1800, 400, 0.06, 0.05], orbit: ['sine', 500, 700, 0.05, 0.04],
      cannon: ['square', 180, 60, 0.18, 0.1], shard: ['triangle', 1600, 2200, 0.05, 0.05], charge: ['sawtooth', 220, 1400, 0.16, 0.09],
    }[kind] || ['square', 880, 440, 0.05, 0.05];
    tone({ type: P[0], f: P[1], f2: P[2], dur: P[3], vol: P[4] });
    if (kind === 'arc') noise({ dur: 0.05, vol: 0.06, type: 'highpass', f: 5000 });
  },
  rail() { tone({ type: 'sawtooth', f: 2400, f2: 300, dur: 0.14, vol: 0.12 }); noise({ dur: 0.1, vol: 0.1, type: 'highpass', f: 3000 }); },
  ion() { tone({ type: 'sine', f: 420, f2: 900, dur: 0.08, vol: 0.1 }); },
  beam() { tone({ type: 'triangle', f: 1300, f2: 1200, dur: 0.04, vol: 0.06 }); },
  zap() { noise({ dur: 0.08, vol: 0.12, type: 'highpass', f: 4000 }); tone({ type: 'sawtooth', f: 2200, f2: 500, dur: 0.07, vol: 0.06 }); },
  thud(big) { tone({ type: 'sine', f: big ? 140 : 220, f2: 40, dur: big ? 0.25 : 0.1, vol: big ? 0.45 : 0.22 }); noise({ dur: 0.06, vol: big ? 0.25 : 0.1, f: 1200 }); },
  growl() { tone({ type: 'sawtooth', f: 90, f2: 55, dur: 0.45, vol: 0.25, cutoff: 600 }); noise({ dur: 0.3, vol: 0.15, f: 400 }); },
  secret() { sfx.arp([0, 4, 7, 11, 14, 18, 21], 659, 0.06, 'triangle', 0.15); },
  roar() { tone({ type: 'sawtooth', f: 70, f2: 45, dur: 0.9, vol: 0.32, cutoff: 900 }); sfx.arp([0, 1, 0, 1, 0, -1], 220, 0.11, 'square', 0.1); },
};


// ---------- Música: canciones electrónicas (las notas, en music.js) con efectos ----------
// song: menu, runner, galaxy, pecio, arena. La variante (tonalidad) sale de music.biome (o de
// music.pecio en Pecios, donde el 3 es la sala del jefe). intensity 0–3, od y boss los pone cada juego;
// los cambios de capas, tonalidad y canción de jefe entran AL COMPÁS (nada se corta a mitad).
export const music = { on: false, song: 'menu', bpm: 110, biome: 0, intensity: 0, od: false, boss: false, step: 0, next: 0, pecio: null, playing: null, cur: null, fadeTo: null, fadeAt: 0 };
let duck, delay, delayFb, verb, shaperCurve, leadHz = 0, lastDelay = 0;
export const LOOKAHEAD = 0.2; // s de música programada por adelantado (aguanta tirones del móvil)

// saturación suave (bombo y bajo con más pegada)
function makeCurve(k) {
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
  return c;
}
// efectos: retardo de corchea con puntillo (con la realimentación filtrada: las repeticiones se apagan
// sin chirriar), reverb (impulso generado) y sidechain (el pad y el bajo se agachan con cada bombo)
function musicFx() {
  duck = ctx.createGain();
  duck.connect(musicBus);
  delay = ctx.createDelay(1.5);
  delayFb = ctx.createGain();
  const wet = ctx.createGain(), lp = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3200;
  hp.type = 'highpass';
  hp.frequency.value = 280;
  delayFb.gain.value = 0.34;
  wet.gain.value = 0.28;
  delay.connect(lp).connect(hp).connect(delayFb).connect(delay);
  hp.connect(wet).connect(musicBus);
  verb = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 2.2), imp = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = imp.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2;
  }
  verb.buffer = imp;
  const vw = ctx.createGain();
  vw.gain.value = 0.22;
  verb.connect(vw).connect(musicBus);
}
const panner = (p) => {
  if (!p || !ctx.createStereoPanner) return null;
  const n = ctx.createStereoPanner();
  n.pan.value = p;
  return n;
};

// una voz: osciladores (desafinados) → filtro (con su envolvente) → [saturación] → envolvente → [paneo] → destinos
function voice({ f, t, dur, vol, type = 'sawtooth', detune = [0], cutoff = 4000, cutoffEnv = 0, q = 0.7, attack = 0.01, release = 0.12, dest = musicBus, toDelay = 0, toVerb = 0, vib = 0, glide = 0, drive = false, pan = 0, sub = 0 }) {
  const g = ctx.createGain(), fl = ctx.createBiquadFilter();
  fl.type = 'lowpass';
  fl.Q.value = q;
  const end = t + dur;
  // ENVOLVENTE DE FILTRO: empieza abierto y se cierra (el golpe de los bajos y leads electrónicos)
  if (cutoffEnv) {
    fl.frequency.setValueAtTime(Math.min(16000, cutoff + cutoffEnv), t);
    fl.frequency.setTargetAtTime(cutoff, t + 0.005, Math.max(0.03, dur * 0.35));
  } else fl.frequency.value = cutoff;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, Math.max(t + attack, end - release));
  g.gain.exponentialRampToValueAtTime(0.0001, end + release);
  let chain = fl;
  if (drive && shaperCurve) {
    const ws = ctx.createWaveShaper();
    ws.curve = shaperCurve;
    fl.connect(ws);
    chain = ws;
  }
  const pn = panner(pan);
  chain.connect(g);
  (pn ? g.connect(pn) : g).connect(dest);
  if (toDelay) { const sd = ctx.createGain(); sd.gain.value = toDelay; g.connect(sd).connect(delay); }
  if (toVerb) { const sv = ctx.createGain(); sv.gain.value = toVerb; g.connect(sv).connect(verb); }
  let lfo = null;
  if (vib) { lfo = ctx.createOscillator(); const lg = ctx.createGain(); lfo.frequency.value = 5.5; lg.gain.value = vib; lfo.connect(lg); lfo.start(t); lfo.stop(end + release + 0.05); lfo._g = lg; }
  const osc = (dt, ty, fr) => {
    const o = ctx.createOscillator();
    o.type = ty;
    // PORTAMENTO: la nota sale de la anterior y se desliza
    if (glide) { o.frequency.setValueAtTime(glide * (fr / f), t); o.frequency.exponentialRampToValueAtTime(fr, t + 0.06); } else o.frequency.setValueAtTime(fr, t);
    o.detune.value = dt;
    if (lfo) lfo._g.connect(o.detune);
    o.connect(fl);
    o.start(t);
    o.stop(end + release + 0.05);
  };
  for (const dt of detune) osc(dt, type, f);
  if (sub) osc(0, 'sine', f / 2); // un seno una octava abajo: el cuerpo del bajo
}

function playEvent(e, t, spb) {
  const I = music.cur?.intensity ?? music.intensity, od = music.cur?.od ?? music.od, bright = 1100 + I * 700 + (od ? 2600 : 0);
  const when = t - ctx.currentTime;
  switch (e.inst) {
    case 'kick':
      // dos capas: un clic que corta y el cuerpo (seno que cae) saturado
      noise({ dur: 0.012, vol: 0.22 * e.vel, type: 'highpass', f: 3000, when, dest: musicBus });
      kickBody(t, e.vel);
      // sidechain: el pad y el bajo se agachan y vuelven
      duck.gain.cancelScheduledValues(t);
      duck.gain.setValueAtTime(0.25, t);
      duck.gain.linearRampToValueAtTime(1, t + spb * 3);
      break;
    case 'snare':
      // caja + palmada (3 golpes de ruido muy seguidos)
      noise({ dur: 0.17, vol: 0.26 * e.vel, type: 'bandpass', f: 1900, q: 0.8, when, dest: musicBus });
      for (let i = 0; i < 3; i++) noise({ dur: 0.03 + (i === 2 ? 0.09 : 0), vol: 0.16 * e.vel, type: 'bandpass', f: 1200, q: 1.2, when: when + i * 0.011, dest: musicBus });
      tone({ type: 'triangle', f: 200, f2: 120, dur: 0.08, vol: 0.12 * e.vel, when, dest: musicBus });
      break;
    case 'hat': {
      // charles con su lado (estéreo) y swing en los contratiempos
      const sw = e.swing ? spb * 0.1 : 0;
      hat(t + sw, e.open ? 0.2 : 0.035, 0.085 * e.vel, e.pan || 0);
      break;
    }
    case 'crash':
      noise({ dur: 1.6, vol: 0.12 * e.vel, type: 'highpass', f: 4200, when, dest: musicBus });
      break;
    case 'riser':
      // ruido que sube antes del drop
      riser(t, e.dur * spb);
      break;
    case 'pad':
      // acorde con séptima: una sierra por nota, abierta con la intensidad
      e.midis.forEach((m, i) => voice({ f: midiHz(m), t, dur: e.dur * spb, vol: 0.04, detune: [i % 2 ? 7 : -7], cutoff: bright * 0.6, attack: 0.08, release: 0.45, dest: duck, toVerb: 0.55, pan: (i - 1.5) * 0.25 }));
      break;
    case 'bass':
      // REESE: dos sierras desafinadas + un seno debajo, filtro que se cierra y saturación
      voice({ f: midiHz(e.midi), t, dur: Math.max(0.08, e.dur * spb * 0.92), vol: 0.2 * e.vel, type: 'sawtooth', detune: [-14, 14], sub: 1, cutoff: 260 + I * 180 + (od ? 600 : 0), cutoffEnv: 900 + I * 400, q: 5, attack: 0.004, release: 0.05, dest: duck, drive: true });
      break;
    case 'arp':
      voice({ f: midiHz(e.midi), t, dur: spb * 0.75, vol: 0.05 * e.vel, type: 'sawtooth', detune: [0], cutoff: 1100 + I * 400, cutoffEnv: 2200, q: 3, attack: 0.002, release: 0.05, toDelay: 0.45, pan: e.pan || 0 });
      break;
    case 'lead': {
      // SUPERSIERRA: 5 osciladores, filtro con envolvente, portamento y vibrato
      const f = midiHz(e.midi), glide = leadHz && Math.abs(leadHz / f - 1) < 0.6 ? leadHz : 0;
      leadHz = f;
      voice({ f, t, dur: e.dur * spb * 0.95, vol: 0.06 * e.vel, type: 'sawtooth', detune: [-18, -8, 0, 8, 18], cutoff: bright + 600, cutoffEnv: 3000, q: 1.2, attack: 0.01, release: 0.16, toDelay: 0.35, toVerb: 0.4, vib: 6, glide });
      break;
    }
    case 'stinger':
      // entra un JEFE: golpe grave que cae y platillo
      tone({ type: 'sawtooth', f: 220, f2: 40, dur: 0.9, vol: 0.28, when, dest: musicBus, cutoff: 1400 });
      noise({ dur: 1.8, vol: 0.16, type: 'highpass', f: 3000, when, dest: musicBus });
      kickBody(t, 1.2);
      break;
    default:
  }
}
function kickBody(t, vel) {
  const o = ctx.createOscillator(), g = ctx.createGain(), ws = ctx.createWaveShaper();
  ws.curve = shaperCurve;
  o.type = 'sine';
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.9 * vel, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(ws).connect(g).connect(musicBus);
  o.start(t);
  o.stop(t + 0.3);
}
function hat(t, dur, vol, pan) {
  const src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuf;
  fl.type = 'highpass';
  fl.frequency.value = 8000;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const pn = panner(pan);
  src.connect(fl).connect(g);
  (pn ? g.connect(pn) : g).connect(musicBus);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}
function riser(t, dur) {
  const src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuf;
  src.loop = true;
  fl.type = 'bandpass';
  fl.Q.value = 2;
  fl.frequency.setValueAtTime(400, t);
  fl.frequency.exponentialRampToValueAtTime(9000, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.14, t + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
  src.connect(fl).connect(g).connect(musicBus);
  src.start(t);
  src.stop(t + dur + 0.08);
}

// la canción que DEBE sonar ahora: con jefe, la de jefe (Pecios tiene la suya)
export function songId(m = music) {
  if (m.song === 'pecio' && m.pecio === 3) return 'pecioBoss';
  if (m.boss && ['runner', 'arena', 'galaxy'].includes(m.song)) return 'boss';
  return SONGS[m.song] ? m.song : 'menu';
}
const variantOf = () => (music.song === 'pecio' ? music.pecio || 0 : music.biome || 0);
const bpmOf = (id) => (id === 'runner' ? music.bpm : SONGS[id].bpm); // el Runner la marca él según la velocidad

// Pide una canción. Si ya suena, no la reinicia; si es otra, la que suena se apaga (0,4 s) y la nueva
// entra desde su principio. Funciona antes de que haya sonido (iOS lo habilita al primer toque).
export function musicStart(song = music.song) {
  const changed = song !== music.song || !music.on;
  music.song = song;
  if (song !== 'runner') music.bpm = (SONGS[song] || SONGS.menu).bpm;
  else if (music.bpm < 160) music.bpm = SONGS.runner.bpm;
  const wasOn = music.on && music.playing;
  music.on = true;
  if (!ctx || !changed) return;
  if (wasOn) {
    // FUNDIDO de salida y la nueva, al acabar
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
    music.fadeTo = true;
    music.fadeAt = ctx.currentTime + 0.4;
  } else startSong();
}
function startSong() {
  music.fadeTo = null;
  music.playing = songId();
  music.cur = { intensity: music.intensity, od: music.od, variant: variantOf() };
  music.step = 0;
  leadHz = 0;
  music.next = ctx.currentTime + 0.06;
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setValueAtTime(0.0001, ctx.currentTime);
  musicBus.gain.setTargetAtTime(musicLevel(), ctx.currentTime + 0.03, 0.2);
}

export function musicStop() {
  music.on = false;
  music.pecio = null;
  music.od = false;
  music.boss = false;
  music.intensity = 0;
  music.playing = null;
  music.fadeTo = null;
  if (ctx) musicBus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1);
}

export function musicDuck(on) {
  if (!ctx) return;
  musicFilter.frequency.setTargetAtTime(on ? 600 : 18000, ctx.currentTime, 0.08);
}

// ¿se oye algo? (silenciado o a volumen 0, no se programan notas: no se gasta batería)
const audible = () => save.settings.sound && setting('musicVol', 0.7) > 0;

function scheduler() {
  if (!ctx || !music.on) return;
  const now = ctx.currentTime;
  if (music.fadeTo) {
    if (now < music.fadeAt) return;
    startSong();
  }
  if (!music.playing) startSong();
  // si el timer estuvo dormido (pestaña oculta), resincronizar en vez de soltar de golpe las notas atrasadas
  if (music.next < now - 0.05) music.next = now + 0.02;
  while (music.next < now + LOOKAHEAD) {
    if (music.step % STEPS === 0) atBar(); // AL COMPÁS: capas, tonalidad y canción de jefe
    if (audible()) playStep(music.step, music.next - now);
    music.next += 60 / bpmOf(music.playing) / 4;
    music.step++;
  }
}
// al empezar cada compás se aplica lo que haya cambiado (intensidad, OVERDRIVE, tonalidad, jefe)
function atBar() {
  music.cur = { intensity: music.intensity, od: music.od, variant: variantOf() };
  const want = songId();
  if (want === music.playing) return;
  const toBoss = !!SONGS[want].boss;
  music.playing = want;
  music.step = 0;
  leadHz = 0;
  if (toBoss && audible()) playEvent({ inst: 'stinger', vel: 1 }, Math.max(ctx.currentTime, music.next), 60 / bpmOf(want) / 4);
}

function playStep(s, when) {
  const song = SONGS[music.playing] || SONGS.menu, spb = 60 / bpmOf(music.playing) / 4;
  const t = ctx.currentTime + Math.max(0, when);
  // el retardo sigue al tempo, sin saltos (si el tempo cambia poco a poco no se oyen chasquidos)
  const dt = Math.min(1.4, spb * 3);
  if (Math.abs(dt - lastDelay) > 0.002) { delay.delayTime.setTargetAtTime(dt, t, 0.08); lastDelay = dt; }
  for (const e of stepEvents(song, s, music.cur)) playEvent({ ...e, swing: e.inst === 'hat' && s % 2 === 1 }, t, spb);
}
