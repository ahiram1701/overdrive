// MÚSICA ELECTRÓNICA: las canciones son datos y stepEvents() dice qué suena en cada semicorchea.
// Es un módulo puro (sin Web Audio): se prueba sin altavoces. audio.js solo toca lo que devuelve.
//
// Una canción: tónica (MIDI), escala, progresiones (un grado por compás), FORMA (intro → subida →
// drop → pausa → subida → drop… al menos 64 compases antes de repetirse), varios patrones de bombo,
// caja y bajo que se turnan por sección, arpegio, y melodías en frases de 4 compases.
// Las capas entran según la intensidad (0–3) que pone cada juego, y el OVERDRIVE sube la melodía.

export const STEPS = 16; // semicorcheas por compás
export const PHRASE = 4; // compases de cada frase de la melodía
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const HARMONIC = [0, 2, 3, 5, 7, 8, 11];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];

// ARPEGIOS de 16 pasos: índice de la nota del acorde (0-3; 4 = la tónica una octava arriba), −1 silencio
const ARP = {
  up: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 4],
  updown: [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1],
  slow: [0, -1, 2, -1, 1, -1, 3, -1, 2, -1, 4, -1, 1, -1, 3, -1],
  run: [0, 2, 1, 3, 2, 4, 1, 3, 0, 2, 1, 3, 2, 4, 3, 1],
  stab: [0, -1, -1, 2, -1, -1, 1, -1, 0, -1, -1, 3, -1, -1, 4, -1],
};
// BAJO de 16 pasos: 1 tónica del acorde, 2 octava, 5 quinta, 7 séptima, 0 nada (la nota sigue)
const B = {
  roll: [1, 0, 2, 1, 1, 0, 2, 1, 1, 0, 2, 1, 1, 2, 5, 2], // rodante (darksynth)
  off: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], // a contratiempo (techno)
  off2: [0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 2, 1, 0],
  reese: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 5, 0], // largo (drum&bass)
  reese2: [1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 1, 0, 7, 0, 5, 0],
  pulse: [1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2], // corcheas que empujan
  pulse2: [1, 1, 1, 2, 1, 1, 5, 1, 1, 1, 1, 2, 7, 5, 2, 1],
  grind: [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 2, 1, 0], // industrial
  grind2: [1, 1, 0, 1, 1, 0, 1, 2, 1, 1, 0, 1, 5, 0, 2, 1],
  soft: [1, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0],
  soft2: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 5, 0, 0, 0, 2, 0],
};
// BOMBO (pasos donde suena)
const K = {
  four: [0, 4, 8, 12],
  fourPush: [0, 4, 8, 12, 14],
  dnb: [0, 10],
  dnb2: [0, 7, 10],
  half: [0, 8],
  halfPush: [0, 8, 11],
  drive: [0, 3, 6, 8, 12, 14],
  drive2: [0, 4, 6, 8, 10, 12],
};

export const SONGS = {
  // MENÚ y HANGAR: electro tranquilo, sin caja
  menu: {
    name: 'Neón en el hangar', bpm: 110, root: 45, scale: DORIAN, soft: true, arpAlways: true,
    prog: { A: [0, 5, 3, 4], B: [5, 3, 0, 4], C: [3, 4, 5, 4] },
    form: [['intro', 'A', 8], ['subida', 'A', 8], ['drop', 'B', 16], ['pausa', 'C', 8], ['subida', 'A', 8], ['drop', 'B', 16]],
    bass: [B.soft, B.soft2], kick: [K.half, K.halfPush], snare: [], hats: 'off', arp: 'slow',
    melody: {
      A: [[0, 4, 6], [6, 3, 2], [8, 2, 8], [16, 0, 8], [24, 2, 8], [32, 4, 6], [38, 5, 2], [40, 4, 8], [48, 2, 12], [60, 1, 4]],
      B: [[0, 7, 8], [8, 6, 4], [12, 4, 4], [16, 5, 12], [28, 4, 4], [32, 7, 6], [38, 8, 2], [40, 9, 8], [48, 7, 16]],
      C: [[0, 2, 16], [16, 4, 16], [32, 5, 16], [48, 4, 16]],
    },
  },
  // RUNNER: drum&bass a 174; una tonalidad por bioma
  runner: {
    name: 'Overdrive', bpm: 174, root: 45, scale: MINOR, variants: [0, 3, -2, 5, 2],
    prog: { A: [0, 5, 2, 6], B: [5, 6, 0, 0], C: [3, 4, 5, 6] },
    form: [['intro', 'A', 8], ['subida', 'A', 8], ['drop', 'B', 16], ['pausa', 'C', 8], ['subida', 'A', 8], ['drop', 'B', 16]],
    bass: [B.reese, B.reese2], kick: [K.dnb, K.dnb2], snare: [4, 12], hats: 'dnb', arp: 'up',
    melody: {
      A: [[0, 7, 3], [3, 6, 3], [6, 4, 2], [8, 4, 4], [12, 2, 4], [16, 0, 3], [19, 2, 3], [22, 4, 2], [24, 6, 8], [32, 7, 3], [35, 9, 3], [38, 7, 2], [40, 6, 8], [48, 4, 6], [54, 2, 2], [56, 4, 8]],
      B: [[0, 9, 4], [4, 7, 4], [8, 8, 6], [14, 7, 2], [16, 6, 4], [20, 4, 4], [24, 7, 8], [32, 9, 4], [36, 11, 4], [40, 9, 6], [46, 8, 2], [48, 7, 16]],
      C: [[0, 2, 8], [8, 4, 8], [16, 5, 8], [24, 6, 8], [32, 7, 16], [48, 6, 16]],
    },
  },
  // GALAXIA: darksynth a 128, oscuro y con bajo rodante; más peligro, otra tonalidad
  galaxy: {
    name: 'Espacio profundo', bpm: 128, root: 43, scale: MINOR, variants: [0, 2, -3, 5],
    prog: { A: [0, 6, 5, 6], B: [3, 5, 0, 4], C: [5, 3, 4, 4] },
    form: [['intro', 'A', 8], ['subida', 'A', 8], ['drop', 'B', 16], ['pausa', 'C', 8], ['subida', 'A', 8], ['drop', 'B', 16]],
    bass: [B.roll, B.pulse2], kick: [K.four, K.fourPush], snare: [4, 12], hats: '16', arp: 'stab',
    melody: {
      A: [[0, 4, 12], [12, 3, 4], [16, 2, 12], [28, 0, 4], [32, 4, 8], [40, 6, 8], [48, 7, 12], [60, 6, 4]],
      B: [[0, 7, 8], [8, 6, 4], [12, 4, 4], [16, 5, 12], [28, 4, 4], [32, 9, 8], [40, 7, 4], [44, 6, 4], [48, 7, 16]],
      C: [[0, 0, 16], [16, 2, 16], [32, 3, 16], [48, 4, 16]],
    },
  },
  // PECIOS: techno industrial a 132 (frigia), una variante por ambientación
  pecio: {
    name: 'Pecio', bpm: 132, root: 40, scale: PHRYGIAN, variants: [0, 3, -2],
    prog: { A: [0, 1, 0, 6], B: [5, 6, 0, 1], C: [3, 1, 0, 1] },
    form: [['intro', 'A', 8], ['subida', 'A', 8], ['drop', 'B', 16], ['pausa', 'C', 8], ['subida', 'A', 8], ['drop', 'B', 16]],
    bass: [B.grind, B.grind2], kick: [K.four, K.drive2], snare: [4, 12], hats: 'metal', arp: 'run',
    melody: {
      A: [[0, 0, 4], [4, 1, 2], [6, 0, 2], [8, 3, 8], [16, 4, 4], [20, 3, 4], [24, 1, 8], [32, 0, 4], [36, 1, 4], [40, 4, 8], [48, 3, 6], [54, 1, 2], [56, 0, 8]],
      B: [[0, 7, 6], [6, 6, 2], [8, 5, 8], [16, 4, 6], [22, 3, 2], [24, 1, 8], [32, 7, 4], [36, 8, 4], [40, 7, 8], [48, 5, 8], [56, 1, 8]],
      C: [[0, 0, 16], [16, 1, 16], [32, 3, 16], [48, 1, 16]],
    },
  },
  // PECIOS · sala del jefe: menor armónica a 150
  pecioBoss: {
    name: 'Alarma', bpm: 150, root: 41, scale: HARMONIC, boss: true,
    prog: { A: [0, 0, 1, 4], B: [5, 4, 1, 4] },
    form: [['drop', 'A', 16], ['pausa', 'B', 8], ['subida', 'A', 8], ['drop', 'B', 16], ['drop', 'A', 16]],
    bass: [B.pulse, B.grind2], kick: [K.drive, K.drive2], snare: [4, 12], hats: '16', arp: 'run',
    melody: {
      A: [[0, 0, 2], [2, 0, 2], [4, 4, 2], [6, 3, 2], [8, 1, 4], [12, 0, 4], [16, 7, 2], [18, 7, 2], [20, 6, 4], [24, 4, 8], [32, 0, 2], [34, 1, 2], [36, 4, 4], [40, 6, 4], [44, 7, 4], [48, 8, 8], [56, 7, 8]],
      B: [[0, 9, 8], [8, 8, 8], [16, 7, 8], [24, 6, 8], [32, 4, 8], [40, 6, 8], [48, 7, 16]],
    },
  },
  // JEFES del Runner, la Arena y la Galaxia: a 156 y sin respiro
  boss: {
    name: 'Jefe final', bpm: 156, root: 38, scale: HARMONIC, boss: true,
    prog: { A: [0, 5, 4, 4], B: [0, 1, 5, 4] },
    form: [['drop', 'A', 16], ['pausa', 'B', 8], ['subida', 'A', 8], ['drop', 'B', 16], ['drop', 'A', 16]],
    bass: [B.pulse2, B.pulse], kick: [K.fourPush, K.drive], snare: [4, 12], hats: '16', arp: 'updown',
    melody: {
      A: [[0, 7, 4], [4, 6, 2], [6, 7, 2], [8, 8, 8], [16, 7, 4], [20, 4, 4], [24, 6, 8], [32, 7, 4], [36, 9, 4], [40, 11, 8], [48, 10, 8], [56, 7, 8]],
      B: [[0, 4, 8], [8, 6, 8], [16, 7, 16], [32, 8, 8], [40, 7, 8], [48, 6, 16]],
    },
  },
  // ARENA: techno a 138 que empuja sin parar
  arena: {
    name: 'Gladiador', bpm: 138, root: 47, scale: MINOR, variants: [0, 2, -2, 5],
    prog: { A: [0, 5, 6, 4], B: [3, 0, 6, 4], C: [5, 3, 6, 6] },
    form: [['intro', 'A', 8], ['subida', 'A', 8], ['drop', 'B', 16], ['pausa', 'C', 8], ['subida', 'A', 8], ['drop', 'B', 16]],
    bass: [B.off, B.off2], kick: [K.four, K.fourPush], snare: [4, 12], hats: 'off', arp: 'updown',
    melody: {
      A: [[0, 4, 2], [2, 4, 2], [4, 7, 4], [8, 6, 2], [10, 4, 2], [12, 3, 4], [16, 4, 2], [18, 4, 2], [20, 9, 4], [24, 7, 8], [32, 4, 2], [34, 4, 2], [36, 7, 4], [40, 9, 4], [44, 11, 4], [48, 9, 16]],
      B: [[0, 11, 4], [4, 9, 4], [8, 7, 8], [16, 9, 4], [20, 7, 4], [24, 6, 8], [32, 11, 4], [36, 12, 4], [40, 11, 8], [48, 9, 8], [56, 7, 8]],
      C: [[0, 4, 16], [16, 5, 16], [32, 6, 16], [48, 4, 16]],
    },
  },
};

// grado de la escala (puede pasar de 7 o ser negativo) → semitonos sobre la tónica
export function degree(scale, d) {
  const o = Math.floor(d / 7), i = ((d % 7) + 7) % 7;
  return scale[i] + 12 * o;
}
export const formBars = (song) => song.form.reduce((n, f) => n + f[2], 0);
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
// intro: ambiente · subida: bombo seguido y redoble que crece · drop: todo · pausa: sin bombo, la melodía respira
export function layersFor(song, sec, intensity, od) {
  const n = sec.name, drop = n === 'drop', build = n === 'subida', pause = n === 'pausa', intro = n === 'intro';
  return {
    pad: true,
    bass: !intro || intensity >= 1,
    kick: intensity >= 1 && (drop || build) && !(build && sec.bar >= sec.bars - 1),
    hats: intensity >= 1 && !pause,
    snare: intensity >= 2 && !song.soft && (drop || build),
    arp: song.arpAlways || intensity >= 2 || pause,
    lead: (intensity >= 2 || od || (song.soft && drop)) && !intro && !build,
    riser: build && sec.bar >= sec.bars - 2 && intensity >= 1,
  };
}
// variación determinista (misma canción, mismo resultado): 0..1
const hash = (n) => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
// velocidad humana: unos golpes un pelo más fuertes que otros
const human = (v, step, salt = 0) => +(v * (0.86 + 0.14 * hash(step * 7 + salt))).toFixed(3);

// Lo que suena en la semicorchea `step` (global). st = { intensity, od, variant }.
// Devuelve [{ inst, midi?, midis?, dur? (en pasos), vel, open?, pan? }]
export function stepEvents(song, step, st = {}) {
  const intensity = Math.max(0, Math.min(3, st.intensity | 0)), od = !!st.od;
  const bar = Math.floor(step / STEPS), k = step % STEPS;
  const sec = sectionAt(song, bar);
  const L = layersFor(song, sec, intensity, od);
  const tr = song.variants ? song.variants[(st.variant | 0) % song.variants.length] : 0;
  const root = song.root + tr;
  const prog = song.prog[sec.prog];
  const deg = prog[sec.bar % prog.length];
  const chord = [0, 2, 4, 6].map((x) => root + 12 + degree(song.scale, deg + x)); // acorde con SÉPTIMA (octava media)
  const pat = (list) => list[sec.i % list.length]; // cada sección, su patrón
  const ev = [];
  // BATERÍA
  const lastBar = sec.bar === sec.bars - 1;
  const roll = L.snare && buildRoll(sec, k); // redoble que crece al final de la subida
  const fill = !roll && L.snare && lastBar && k >= 12 && sec.name === 'drop'; // y un remate al acabar el drop
  if (L.kick && pat(song.kick).includes(k) && !fill) ev.push({ inst: 'kick', vel: human(song.soft ? 0.55 : 1, step, 1) });
  if (k === 0 && sec.bar === 0 && intensity >= 1 && (sec.name === 'drop' || (sec.i > 0 && sec.name !== 'pausa'))) ev.push({ inst: 'crash', vel: sec.name === 'drop' ? 1 : 0.6 });
  if (roll) ev.push({ inst: 'snare', vel: human(0.35 + 0.65 * (k / 15), step, 2) });
  else if (fill) ev.push({ inst: 'snare', vel: 0.55 + (k - 12) * 0.15 });
  else if (L.snare && song.snare.includes(k)) ev.push({ inst: 'snare', vel: human(1, step, 3) });
  if (L.hats) {
    const h = hatAt(song.hats, k, intensity);
    if (h) ev.push({ inst: 'hat', vel: human(song.soft ? h.v * 0.5 : h.v, step, 4), open: !!h.open, pan: k % 4 === 2 ? 0.25 : -0.2 });
  }
  if (L.riser && k === 0 && sec.bar === sec.bars - 2) ev.push({ inst: 'riser', dur: STEPS * 2, vel: 1 });
  // ACORDE (pad): al empezar el compás, todo el compás
  if (L.pad && k === 0) ev.push({ inst: 'pad', midis: chord, dur: STEPS, vel: 1 });
  // BAJO: la tónica del acorde (o su octava, quinta o séptima), dura hasta la nota siguiente
  const bass = pat(song.bass);
  if (L.bass && bass[k]) {
    let n = 1;
    while (k + n < STEPS && !bass[k + n]) n++;
    const base = degree(song.scale, deg);
    const off = { 1: 0, 2: 12, 5: degree(song.scale, deg + 4) - base, 7: degree(song.scale, deg + 6) - base }[bass[k]];
    ev.push({ inst: 'bass', midi: root - 12 + base + off, dur: n, vel: human(1, step, 5) });
  }
  // ARPEGIO: notas del acorde (y la octava), de un lado a otro
  if (L.arp) {
    const a = ARP[song.arp][k];
    if (a >= 0) ev.push({ inst: 'arp', midi: (a === 4 ? chord[0] + 12 : chord[a]) + 12, dur: 1, vel: human(0.8, step, 6), pan: k % 2 ? 0.35 : -0.35 });
  }
  // MELODÍA: frases de 4 compases; la segunda vuelta de cada 8 CONTESTA (su último compás, una 3.ª más alta);
  // con OVERDRIVE, una octava más arriba
  if (L.lead) {
    const mel = song.melody[sec.prog] || song.melody.A;
    const s64 = (sec.bar % PHRASE) * STEPS + k;
    const answer = Math.floor(sec.bar / PHRASE) % 2 === 1;
    const note = mel.find(([s]) => s === s64);
    if (note) {
      const d = note[1] + (answer && s64 >= (PHRASE - 1) * STEPS ? 2 : 0);
      ev.push({ inst: 'lead', midi: root + 24 + degree(song.scale, d) + (od ? 12 : 0), dur: note[2], vel: human(1, step, 7) });
    }
  }
  return ev;
}
// redoble de la subida: corcheas en el penúltimo compás, semicorcheas en el último
function buildRoll(sec, k) {
  if (sec.name !== 'subida') return false;
  if (sec.bar === sec.bars - 2) return k % 2 === 0;
  return sec.bar === sec.bars - 1;
}
// CHARLES según el estilo: 'off' a contratiempo (techno), '16' semicorcheas, 'dnb' rotos, 'metal' industrial
function hatAt(style, k, intensity) {
  if (style === 'off') return k % 4 === 2 ? { v: 0.95, open: intensity >= 2 } : intensity >= 3 && k % 2 === 1 ? { v: 0.4 } : null;
  if (style === '16') return { v: k % 4 === 2 ? 0.9 : k % 2 ? 0.45 : 0.6, open: k % 8 === 6 && intensity >= 2 };
  if (style === 'dnb') return [2, 6, 7, 10, 14, 15].includes(k) || (intensity >= 3 && k % 2 === 1) ? { v: [2, 10].includes(k) ? 0.9 : 0.55, open: k === 14 && intensity >= 2 } : null;
  if (style === 'metal') return k % 2 === 0 ? { v: k % 4 === 2 ? 0.95 : 0.5, open: k === 14 && intensity >= 2 } : intensity >= 3 ? { v: 0.35 } : null;
  return k % 4 === 2 ? { v: 0.8 } : null;
}
export const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);
