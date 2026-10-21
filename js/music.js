// MÚSICA SYNTHWAVE: las canciones son datos y stepEvents() dice qué suena en cada semicorchea.
// Es un módulo puro (sin Web Audio): se prueba sin altavoces. audio.js solo toca lo que devuelve.
//
// Una canción: tónica (MIDI), escala, progresiones (un grado por compás), forma (secciones que se
// repiten en bucle), y los patrones de bajo, arpegio y batería; la melodía va por progresión.
// Las capas entran según la intensidad (0–3) que pone cada juego, y el OVERDRIVE sube la melodía.

export const STEPS = 16; // semicorcheas por compás
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const HARMONIC = [0, 2, 3, 5, 7, 8, 11];

// patrones de 16 pasos. Bajo: 1 tónica del acorde, 2 octava, 5 quinta, 0 nada (suena hasta la siguiente)
const ARP = {
  up: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3],
  updown: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3],
  slow: [0, -1, 1, -1, 2, -1, 3, -1, 2, -1, 1, -1, 0, -1, 2, -1],
  run: [0, 2, 1, 3, 2, 3, 1, 2, 0, 2, 1, 3, 2, 3, 1, 3],
};
const KICK = { four: [0, 4, 8, 12], half: [0, 8], drive: [0, 4, 8, 10, 12] };

export const SONGS = {
  // MENÚ y HANGAR: tranquila, sin batería fuerte
  menu: {
    name: 'Neón en el hangar', bpm: 92, root: 45, scale: MINOR, soft: true, arpAlways: true,
    prog: { A: [0, 5, 2, 6], B: [3, 0, 5, 4] },
    form: [['intro', 'A', 4], ['verso', 'A', 8], ['estribillo', 'B', 8]],
    bass: [1, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0], arp: 'slow', kick: 'half',
    melody: {
      A: [[0, 4, 6], [6, 3, 2], [8, 2, 8], [16, 0, 6], [22, 2, 2], [24, 4, 8]],
      B: [[0, 7, 8], [8, 5, 4], [12, 4, 4], [16, 2, 8], [24, 4, 8]],
    },
  },
  // RUNNER: la de siempre, pero con canción; una tonalidad por bioma
  runner: {
    name: 'Overdrive', bpm: 124, root: 45, scale: MINOR, variants: [0, 3, -2, 5, 2],
    prog: { A: [0, 5, 2, 6], B: [5, 6, 0, 0], C: [3, 4, 5, 6] },
    form: [['intro', 'A', 4], ['verso', 'A', 8], ['estribillo', 'B', 8], ['verso', 'A', 8], ['estribillo', 'B', 8], ['puente', 'C', 8]],
    bass: [1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 2, 1, 2], arp: 'up', kick: 'four',
    melody: {
      A: [[0, 7, 3], [3, 6, 3], [6, 4, 2], [8, 4, 4], [12, 2, 4], [16, 0, 3], [19, 2, 3], [22, 4, 2], [24, 6, 6], [30, 4, 2]],
      B: [[0, 9, 4], [4, 7, 4], [8, 8, 6], [14, 7, 2], [16, 6, 4], [20, 4, 4], [24, 7, 8]],
      C: [[0, 2, 8], [8, 4, 8], [16, 5, 8], [24, 6, 8]],
    },
  },
  // GALAXIA: amplia y espaciosa; con peligro o combate sube
  galaxy: {
    name: 'Espacio profundo', bpm: 100, root: 43, scale: MINOR, variants: [0, 2, -3, 5],
    prog: { A: [0, 6, 5, 6], B: [3, 5, 0, 4] },
    form: [['intro', 'A', 4], ['verso', 'A', 8], ['estribillo', 'B', 8], ['verso', 'A', 8]],
    bass: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 5, 0, 0, 0, 0, 0], arp: 'slow', kick: 'half',
    melody: {
      A: [[0, 4, 12], [12, 3, 4], [16, 2, 12], [28, 0, 4]],
      B: [[0, 7, 8], [8, 6, 4], [12, 4, 4], [16, 5, 12], [28, 4, 4]],
    },
  },
  // PECIOS: oscura (frigia), una variante por ambientación
  pecio: {
    name: 'Pecio', bpm: 112, root: 40, scale: PHRYGIAN, variants: [0, 3, -2],
    prog: { A: [0, 1, 0, 6], B: [5, 6, 0, 1] },
    form: [['intro', 'A', 4], ['verso', 'A', 8], ['estribillo', 'B', 8]],
    bass: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 2, 0], arp: 'run', kick: 'half',
    melody: {
      A: [[0, 0, 4], [4, 1, 2], [6, 0, 2], [8, 3, 8], [16, 4, 4], [20, 3, 4], [24, 1, 8]],
      B: [[0, 7, 6], [6, 6, 2], [8, 5, 8], [16, 4, 6], [22, 3, 2], [24, 1, 8]],
    },
  },
  // PECIOS · sala del jefe: menor armónica y prisa
  pecioBoss: {
    name: 'Alarma', bpm: 142, root: 41, scale: HARMONIC,
    prog: { A: [0, 0, 1, 4], B: [5, 4, 1, 4] },
    form: [['verso', 'A', 8], ['estribillo', 'B', 8]],
    bass: [1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2], arp: 'run', kick: 'drive',
    melody: { A: [[0, 0, 2], [2, 0, 2], [4, 4, 2], [6, 3, 2], [8, 1, 4], [12, 0, 4], [16, 7, 2], [18, 7, 2], [20, 6, 4], [24, 4, 8]] },
  },
  // ARENA: empuja sin parar
  arena: {
    name: 'Gladiador', bpm: 132, root: 47, scale: MINOR, variants: [0, 2, -2, 5],
    prog: { A: [0, 5, 6, 4], B: [3, 0, 6, 4], C: [5, 3, 6, 6] },
    form: [['intro', 'A', 4], ['verso', 'A', 8], ['estribillo', 'B', 8], ['verso', 'A', 8], ['puente', 'C', 8], ['estribillo', 'B', 8]],
    bass: [1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 5, 5, 2, 1], arp: 'updown', kick: 'four',
    melody: {
      A: [[0, 4, 2], [2, 4, 2], [4, 7, 4], [8, 6, 2], [10, 4, 2], [12, 3, 4], [16, 4, 2], [18, 4, 2], [20, 9, 4], [24, 7, 8]],
      B: [[0, 11, 4], [4, 9, 4], [8, 7, 8], [16, 9, 4], [20, 7, 4], [24, 6, 8]],
      C: [[0, 4, 16], [16, 5, 16]],
    },
  },
};

// grado de la escala (puede pasar de 7 o ser negativo) → semitonos sobre la tónica
export function degree(scale, d) {
  const o = Math.floor(d / 7), i = ((d % 7) + 7) % 7;
  return scale[i] + 12 * o;
}
const formBars = (song) => song.form.reduce((n, f) => n + f[2], 0);
// dónde estamos de la forma en el compás `bar`
export function sectionAt(song, bar) {
  let b = bar % formBars(song);
  for (let i = 0; i < song.form.length; i++) {
    const [name, prog, bars] = song.form[i];
    if (b < bars) return { i, name, prog, bars, bar: b };
    b -= bars;
  }
  return null;
}
// qué capas suenan con esta intensidad (y en esta sección)
export function layersFor(song, sec, intensity, od) {
  const breakdown = sec.name === 'puente' && sec.bar < 4; // el puente empieza sin batería
  const intro = sec.name === 'intro';
  const L = {
    pad: true, bass: !intro || intensity >= 1,
    kick: intensity >= 1 && !breakdown && !intro,
    hats: intensity >= 1 && !breakdown,
    snare: intensity >= 2 && !breakdown && !intro && !song.soft,
    arp: song.arpAlways || intensity >= 2 || breakdown,
    lead: (intensity >= 3 || od || (song.soft && sec.name === 'estribillo')) && !intro,
  };
  return L;
}

// Lo que suena en la semicorchea `step` (global). st = { intensity, od, variant }.
// Devuelve [{ inst, midi?, midis?, dur? (en pasos), vel }]
export function stepEvents(song, step, st = {}) {
  const intensity = Math.max(0, Math.min(3, st.intensity | 0)), od = !!st.od;
  const bar = Math.floor(step / STEPS), k = step % STEPS;
  const sec = sectionAt(song, bar);
  const L = layersFor(song, sec, intensity, od);
  const tr = song.variants ? song.variants[(st.variant | 0) % song.variants.length] : 0;
  const root = song.root + tr;
  const prog = song.prog[sec.prog];
  const deg = prog[sec.bar % prog.length];
  const chord = [0, 2, 4].map((x) => root + 12 + degree(song.scale, deg + x)); // tríada (octava media)
  const ev = [];
  // BATERÍA
  const fill = L.snare && sec.bar === sec.bars - 1 && k >= 12; // redoble al final de cada sección
  if (L.kick && KICK[song.kick].includes(k) && !fill) ev.push({ inst: 'kick', vel: song.soft ? 0.5 : 1 });
  if (L.kick && k === 0 && sec.bar === 0 && sec.i > 0) ev.push({ inst: 'crash', vel: 0.8 });
  if (fill) ev.push({ inst: 'snare', vel: 0.5 + (k - 12) * 0.15 });
  else if (L.snare && (k === 4 || k === 12)) ev.push({ inst: 'snare', vel: 1 });
  if (L.hats && (k % 4 === 2 || (intensity >= 3 && k % 2 === 1))) ev.push({ inst: 'hat', vel: song.soft ? 0.4 : k % 4 === 2 ? 0.9 : 0.5, open: k % 8 === 6 && intensity >= 2 });
  // ACORDE (pad): al empezar el compás, todo el compás
  if (L.pad && k === 0) ev.push({ inst: 'pad', midis: chord, dur: STEPS, vel: 1 });
  // BAJO: la tónica del acorde (o su octava/quinta), dura hasta la nota siguiente
  if (L.bass && song.bass[k]) {
    let n = 1;
    while (k + n < STEPS && !song.bass[k + n]) n++;
    const off = { 1: 0, 2: 12, 5: 7 }[song.bass[k]];
    ev.push({ inst: 'bass', midi: root - 12 + degree(song.scale, deg) + off, dur: n, vel: 1 });
  }
  // ARPEGIO: notas del acorde (y la octava)
  if (L.arp) {
    const a = ARP[song.arp][k];
    if (a >= 0) ev.push({ inst: 'arp', midi: (a === 3 ? chord[0] + 12 : chord[a]) + 12, dur: 1, vel: 0.8 });
  }
  // MELODÍA: por frases de 2 compases; con OVERDRIVE, una octava más arriba
  if (L.lead) {
    const mel = song.melody[sec.prog] || song.melody.A;
    const s32 = (sec.bar % 2) * STEPS + k;
    const note = mel.find(([s]) => s === s32);
    if (note) ev.push({ inst: 'lead', midi: root + 24 + degree(song.scale, note[1]) + (od ? 12 : 0), dur: note[2], vel: 1 });
  }
  return ev;
}
export const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);
