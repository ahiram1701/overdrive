// Todo el sonido se sintetiza con Web Audio: cero archivos, y el tono puede seguir a la velocidad/combo.
import { save } from './save.js';
import { SONGS, stepEvents, midiHz } from './music.js';

let ctx = null, master, sfxBus, musicBus, musicFilter, noiseBuf;

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 6;
  master = ctx.createGain();
  master.gain.value = save.settings.sound ? 0.8 : 0;
  master.connect(comp).connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.9 * setting('sfxVol', 1);
  sfxBus.connect(master);
  musicFilter = ctx.createBiquadFilter();
  musicFilter.type = 'lowpass';
  musicFilter.frequency.value = 18000;
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.0001;
  musicBus.connect(musicFilter).connect(master);
  musicFx();

  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  setInterval(scheduler, 25);
  // si ya había una canción pedida (el menú suena antes del primer toque), arranca ahora
  if (music.on) { music.next = ctx.currentTime + 0.08; musicBus.gain.setTargetAtTime(musicLevel(), ctx.currentTime, 0.3); }
}

// VOLÚMENES (Ajustes): música y efectos por separado; el interruptor 🔊 sigue siendo el general
const setting = (k, d) => { const v = save.settings?.[k]; return typeof v === 'number' && v >= 0 && v <= 1 ? v : d; };
const musicLevel = () => 0.5 * setting('musicVol', 0.7);
export function setVolumes() {
  if (!ctx) return;
  sfxBus.gain.setTargetAtTime(0.9 * setting('sfxVol', 1), ctx.currentTime, 0.03);
  if (music.on) musicBus.gain.setTargetAtTime(musicLevel(), ctx.currentTime, 0.03);
}

export function setSound(on) {
  save.settings.sound = on;
  if (master) master.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, 0.02);
}

function tone({ type = 'square', f = 440, f2 = null, dur = 0.1, vol = 0.25, when = 0, dest = sfxBus, attack = 0.004, cutoff = 0 }) {
  if (!ctx) return;
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
    }[kind] || ['square', 880, 440, 0.05, 0.05];
    tone({ type: P[0], f: P[1], f2: P[2], dur: P[3], vol: P[4] });
    if (kind === 'arc') noise({ dur: 0.05, vol: 0.06, type: 'highpass', f: 5000 });
  },
  zap() { noise({ dur: 0.08, vol: 0.12, type: 'highpass', f: 4000 }); tone({ type: 'sawtooth', f: 2200, f2: 500, dur: 0.07, vol: 0.06 }); },
  thud(big) { tone({ type: 'sine', f: big ? 140 : 220, f2: 40, dur: big ? 0.25 : 0.1, vol: big ? 0.45 : 0.22 }); noise({ dur: 0.06, vol: big ? 0.25 : 0.1, f: 1200 }); },
  growl() { tone({ type: 'sawtooth', f: 90, f2: 55, dur: 0.45, vol: 0.25, cutoff: 600 }); noise({ dur: 0.3, vol: 0.15, f: 400 }); },
  secret() { sfx.arp([0, 4, 7, 11, 14, 18, 21], 659, 0.06, 'triangle', 0.15); },
  roar() { tone({ type: 'sawtooth', f: 70, f2: 45, dur: 0.9, vol: 0.32, cutoff: 900 }); sfx.arp([0, 1, 0, 1, 0, -1], 220, 0.11, 'square', 0.1); },
};

// ---------- Música: canciones synthwave (las notas, en music.js) con efectos ----------
// song: menu, runner, galaxy, pecio, arena. La variante (tonalidad) sale de music.biome (o de
// music.pecio en Pecios, donde el 3 es la sala del jefe). intensity 0–3 y od añaden capas.
export const music = { on: false, song: 'menu', bpm: 92, biome: 0, intensity: 0, od: false, step: 0, next: 0, pecio: null };
let duck, delay, verb;

// efectos: retardo de corchea con puntillo, reverb (impulso generado) y "sidechain" (el pad y el
// bajo se agachan con cada bombo: el bombeo típico del synthwave)
function musicFx() {
  duck = ctx.createGain();
  duck.connect(musicBus);
  delay = ctx.createDelay(1.5);
  const fb = ctx.createGain(), wet = ctx.createGain();
  fb.gain.value = 0.32;
  wet.gain.value = 0.3;
  delay.connect(fb).connect(delay);
  delay.connect(wet).connect(musicBus);
  verb = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 2.4), imp = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = imp.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  verb.buffer = imp;
  const vw = ctx.createGain();
  vw.gain.value = 0.25;
  verb.connect(vw).connect(musicBus);
}

// una voz: osciladores (con desafinado) → filtro → envolvente → destinos (y envíos a efectos)
function voice({ f, t, dur, vol, type = 'sawtooth', detune = [0], cutoff = 4000, q = 0.7, attack = 0.01, release = 0.12, dest = musicBus, toDelay = 0, toVerb = 0, vib = 0 }) {
  const g = ctx.createGain(), fl = ctx.createBiquadFilter();
  fl.type = 'lowpass';
  fl.frequency.value = cutoff;
  fl.Q.value = q;
  const end = t + dur;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, Math.max(t + attack, end - release));
  g.gain.exponentialRampToValueAtTime(0.0001, end + release);
  fl.connect(g).connect(dest);
  if (toDelay) { const sd = ctx.createGain(); sd.gain.value = toDelay; g.connect(sd).connect(delay); }
  if (toVerb) { const sv = ctx.createGain(); sv.gain.value = toVerb; g.connect(sv).connect(verb); }
  let lfo = null;
  if (vib) { lfo = ctx.createOscillator(); const lg = ctx.createGain(); lfo.frequency.value = 5.5; lg.gain.value = vib; lfo.connect(lg); lfo.start(t); lfo.stop(end + release + 0.05); lfo._g = lg; }
  for (const dt of detune) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.detune.value = dt;
    if (lfo) lfo._g.connect(o.detune);
    o.connect(fl);
    o.start(t);
    o.stop(end + release + 0.05);
  }
}

function playEvent(e, t, spb) {
  const I = music.intensity, bright = 900 + I * 650 + (music.od ? 2600 : 0);
  switch (e.inst) {
    case 'kick':
      tone({ type: 'sine', f: 150, f2: 42, dur: 0.16, vol: 0.85 * e.vel, when: t - ctx.currentTime, dest: musicBus, attack: 0.002 });
      // sidechain: el pad y el bajo se agachan y vuelven
      duck.gain.cancelScheduledValues(t);
      duck.gain.setValueAtTime(0.32, t);
      duck.gain.linearRampToValueAtTime(1, t + spb * 3);
      break;
    case 'snare':
      noise({ dur: 0.16, vol: 0.3 * e.vel, type: 'bandpass', f: 1900, q: 0.7, when: t - ctx.currentTime, dest: musicBus });
      tone({ type: 'triangle', f: 210, f2: 130, dur: 0.09, vol: 0.12 * e.vel, when: t - ctx.currentTime, dest: musicBus });
      break;
    case 'hat':
      noise({ dur: e.open ? 0.2 : 0.04, vol: 0.1 * e.vel, type: 'highpass', f: 7500, when: t - ctx.currentTime, dest: musicBus });
      break;
    case 'crash':
      noise({ dur: 1.4, vol: 0.11 * e.vel, type: 'highpass', f: 4500, when: t - ctx.currentTime, dest: musicBus });
      break;
    case 'pad':
      for (const m of e.midis) voice({ f: midiHz(m), t, dur: e.dur * spb, vol: 0.035, detune: [-9, 9], cutoff: bright * 0.7, attack: 0.35, release: 0.5, dest: duck, toVerb: 0.6 });
      break;
    case 'bass':
      voice({ f: midiHz(e.midi), t, dur: Math.max(0.08, e.dur * spb * 0.9), vol: 0.2, type: 'sawtooth', detune: [0, -1200], cutoff: 380 + I * 260 + (music.od ? 900 : 0), q: 4, attack: 0.005, release: 0.06, dest: duck });
      break;
    case 'arp':
      voice({ f: midiHz(e.midi), t, dur: spb * 0.8, vol: 0.045, type: 'square', cutoff: 1800 + I * 500, attack: 0.003, release: 0.05, toDelay: 0.55 });
      break;
    case 'lead':
      voice({ f: midiHz(e.midi), t, dur: e.dur * spb * 0.95, vol: 0.065, type: 'sawtooth', detune: [-6, 6], cutoff: bright + 1200, attack: 0.02, release: 0.15, toDelay: 0.4, toVerb: 0.5, vib: 7 });
      break;
    default:
  }
}

const curSong = () => (music.song === 'pecio' && music.pecio === 3 ? SONGS.pecioBoss : SONGS[music.song] || SONGS.menu);
const variantOf = () => (music.song === 'pecio' ? music.pecio || 0 : music.biome || 0);

// Pide una canción. Si ya suena, no la reinicia; si es otra, entra con un fundido corto. Funciona
// también antes de que haya sonido (iOS lo habilita al primer toque): queda pedida y arranca entonces.
export function musicStart(song = music.song) {
  const changed = song !== music.song || !music.on;
  music.song = song;
  if (song !== 'runner') music.bpm = (SONGS[song] || SONGS.menu).bpm; // el Runner la marca él según la velocidad
  music.on = true;
  if (!ctx || !changed) return;
  music.step = 0;
  music.next = ctx.currentTime + 0.12;
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setValueAtTime(0.0001, ctx.currentTime);
  musicBus.gain.setTargetAtTime(musicLevel(), ctx.currentTime + 0.1, 0.25);
}

export function musicStop() {
  music.on = false;
  music.pecio = null;
  music.od = false;
  music.intensity = 0;
  if (ctx) musicBus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1);
}

export function musicDuck(on) {
  if (!ctx) return;
  musicFilter.frequency.setTargetAtTime(on ? 600 : 18000, ctx.currentTime, 0.08);
}

function scheduler() {
  if (!ctx || !music.on) return;
  // si el timer estuvo dormido (pestaña oculta), resincronizar en vez de soltar de golpe las notas atrasadas
  if (music.next < ctx.currentTime - 0.05) music.next = ctx.currentTime + 0.02;
  while (music.next < ctx.currentTime + 0.12) {
    playStep(music.step, music.next - ctx.currentTime);
    music.next += 60 / music.bpm / 4;
    music.step++;
  }
}

function playStep(s, when) {
  const song = curSong(), spb = 60 / music.bpm / 4;
  const t = ctx.currentTime + Math.max(0, when);
  delay.delayTime.setValueAtTime(Math.min(1.4, spb * 3), t); // corchea con puntillo, al tempo
  for (const e of stepEvents(song, s, { intensity: music.intensity, od: music.od, variant: variantOf() })) playEvent(e, t, spb);
}
