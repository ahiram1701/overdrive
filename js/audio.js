// Todo el sonido se sintetiza con Web Audio: cero archivos, y el tono puede seguir a la velocidad/combo.
import { save } from './save.js';

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
  sfxBus.gain.value = 0.9;
  sfxBus.connect(master);
  musicFilter = ctx.createBiquadFilter();
  musicFilter.type = 'lowpass';
  musicFilter.frequency.value = 18000;
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.42;
  musicBus.connect(musicFilter).connect(master);

  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  setInterval(scheduler, 25);
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
};

// ---------- Música procedural ----------
const BIOME_MUSIC = [
  { root: 55.0, bass: [0, null, 0, 12, null, 0, 10, null, 0, null, 0, 12, 7, null, 5, null] },   // Neón
  { root: 73.4, bass: [0, 0, null, 3, null, 0, 5, null, 0, 0, null, 3, 6, 5, 3, null] },        // Lava
  { root: 49.0, bass: [0, null, 1, null, 0, null, 6, 7, 0, null, 1, null, 12, 11, 6, null] },   // Glitch
  { root: 82.4, bass: [0, 12, 0, 12, 7, 19, 7, 19, 5, 17, 5, 17, 3, 15, 2, 14] },             // Hiper
];
const LEAD = [0, 7, 12, 15, 19, 15, 12, 7];

export const music = { on: false, bpm: 124, biome: 0, intensity: 0, od: false, step: 0, next: 0 };

export function musicStart() {
  if (!ctx) return;
  music.on = true;
  music.step = 0;
  music.next = ctx.currentTime + 0.05;
  musicBus.gain.setTargetAtTime(0.42, ctx.currentTime, 0.05);
}

export function musicStop() {
  music.on = false;
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
    music.step = (music.step + 1) % 64;
  }
}

function playStep(s, when) {
  if (when < 0) when = 0;
  const k = s % 16;
  const b = BIOME_MUSIC[music.biome % BIOME_MUSIC.length];
  const spb = 60 / music.bpm / 4;
  if (k % 4 === 0) tone({ type: 'sine', f: 160, f2: 42, dur: 0.14, vol: 0.75, when, dest: musicBus, attack: 0.002 });
  if (k % 4 === 2 || (music.intensity >= 2 && k % 2 === 1)) {
    noise({ dur: 0.035, vol: 0.13, type: 'highpass', f: 7000, when, dest: musicBus });
  }
  if (music.intensity >= 1 && (k === 4 || k === 12)) {
    noise({ dur: 0.12, vol: 0.28, type: 'bandpass', f: 1600, q: 0.8, when, dest: musicBus });
  }
  const n = b.bass[k];
  if (n !== null) {
    tone({
      type: 'sawtooth', f: semi(b.root, n), dur: spb * 0.95, vol: 0.2, when, dest: musicBus,
      cutoff: 350 + music.intensity * 350 + (music.od ? 2200 : 0),
    });
  }
  if ((music.od || music.intensity >= 3) && k % 2 === 0) {
    tone({ type: 'square', f: semi(b.root * 8, LEAD[(s / 2) % LEAD.length | 0]), dur: spb * 1.6, vol: 0.05, when, dest: musicBus });
  }
}
