import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, STEPS, stepEvents, sectionAt, layersFor, degree, formBars, duckShape, duckAt, kickGap, nextIntensity, pruneVoices, VOICE_CAP } from '../../js/music.js';

const bar = (song, b, st) => Array.from({ length: STEPS }, (_, k) => stepEvents(song, b * STEPS + k, st)).flat();
const has = (evs, inst) => evs.some((e) => e.inst === inst);
const barOf = (s, name, nth = 0) => {
  let b = 0, seen = 0;
  for (const [n, , bars] of s.form) {
    if (n === name && seen++ === nth) return b;
    b += bars;
  }
  return -1;
};

test('cada canción está bien hecha: forma larga, patrones de 16 que se turnan y melodías dentro de la frase', () => {
  for (const [id, s] of Object.entries(SONGS)) {
    assert.ok(s.bpm >= 100 && s.bpm <= 180, `${id}: bpm ${s.bpm}`);
    assert.ok(formBars(s) >= 64, `${id}: forma de ${formBars(s)} compases (al menos 64 antes de repetirse)`);
    assert.ok(s.bass.length >= 2 && s.kick.length >= 2, `${id}: al menos 2 patrones de bajo y de bombo`);
    for (const p of s.bass) assert.equal(p.length, STEPS, `${id}: bajo de 16`);
    for (const [, p, bars] of s.form) {
      assert.ok(s.prog[p], `${id}: existe la progresión ${p}`);
      assert.ok(bars > 0 && bars % 4 === 0, `${id}: secciones de 4 en 4`);
    }
    for (const mel of Object.values(s.melody)) for (const [st, , len] of mel) assert.ok(st >= 0 && st < 64 && len > 0, `${id}: nota de la melodía fuera de la frase`);
    // una vuelta entera sin errores ni notas absurdas
    for (let i = 0; i < formBars(s) * STEPS; i++) {
      for (const e of stepEvents(s, i, { intensity: 3, od: true })) {
        for (const m of e.midis || (e.midi != null ? [e.midi] : [])) assert.ok(m >= 20 && m <= 112, `${id}: nota MIDI ${m}`);
      }
    }
  }
});

test('estilo: drum&bass en el Runner, techno en la Arena y Pecios, darksynth en la Galaxia; canción de jefe', () => {
  assert.ok(SONGS.runner.bpm >= 168 && SONGS.runner.bpm <= 180);
  assert.ok(SONGS.arena.bpm >= 134 && SONGS.arena.bpm <= 142);
  assert.ok(SONGS.galaxy.bpm >= 124 && SONGS.galaxy.bpm <= 132);
  assert.ok(SONGS.pecio.bpm >= 128 && SONGS.pecio.bpm <= 136);
  assert.ok(SONGS.boss.boss && SONGS.pecioBoss.boss && SONGS.boss.bpm >= 150);
  // drum&bass: el bombo NO va a negras
  const drop = barOf(SONGS.runner, 'drop');
  const kicks = bar(SONGS.runner, drop + 1, { intensity: 3 }).filter((e) => e.inst === 'kick').length;
  assert.ok(kicks >= 2 && kicks <= 3, `bombos D&B por compás: ${kicks}`);
  // techno: cuatro bombos por compás
  assert.equal(bar(SONGS.arena, barOf(SONGS.arena, 'drop') + 1, { intensity: 3 }).filter((e) => e.inst === 'kick').length, 4);
  // acordes con séptima
  assert.equal(stepEvents(SONGS.galaxy, 0, { intensity: 1 }).find((e) => e.inst === 'pad').midis.length, 4);
});

test('la música sube con la acción: más capas con más intensidad, y el OVERDRIVE sube la melodía', () => {
  const s = SONGS.runner, b = barOf(s, 'drop') + 2;
  assert.equal(sectionAt(s, b).name, 'drop');
  const i0 = bar(s, b, { intensity: 0 }), i1 = bar(s, b, { intensity: 1 }), i2 = bar(s, b, { intensity: 2 }), i3 = bar(s, b, { intensity: 3 });
  assert.ok(has(i0, 'pad') && has(i0, 'bass') && !has(i0, 'kick'));
  assert.ok(has(i1, 'kick') && has(i1, 'hat') && !has(i1, 'snare'));
  assert.ok(has(i2, 'snare') && has(i2, 'arp'));
  assert.ok(i0.length < i1.length && i1.length < i2.length && i2.length <= i3.length);
  // la melodía ya entra con intensidad 2 (antes solo a tope)
  const four = (st) => Array.from({ length: 4 }, (_, i) => bar(s, b + i, st)).flat();
  assert.ok(has(four({ intensity: 2 }), 'lead'));
  // OVERDRIVE: la melodía aparece aunque la intensidad sea baja, y una octava más alta
  const lead = (od) => four({ intensity: 3, od }).filter((e) => e.inst === 'lead').map((e) => e.midi);
  assert.deepEqual(lead(true), lead(false).map((m) => m + 12));
  assert.ok(has(four({ intensity: 0, od: true }), 'lead'));
});

test('forma: la subida acaba en redoble y ruido que sube, el drop entra con platillo y la pausa respira', () => {
  const s = SONGS.arena, up = barOf(s, 'subida'), drop = barOf(s, 'drop'), pause = barOf(s, 'pausa');
  const last = bar(s, drop - 1, { intensity: 2 });
  assert.equal(last.filter((e) => e.inst === 'snare').length, 16, 'redoble de semicorcheas en el último compás de la subida');
  assert.ok(!has(last, 'kick'), 'y el bombo calla justo antes del drop');
  assert.ok(has(bar(s, drop - 2, { intensity: 2 }), 'riser'), 'el ruido sube los 2 últimos compases');
  assert.ok(has(stepEvents(s, drop * STEPS, { intensity: 2 }), 'crash'), 'platillo al entrar el drop');
  assert.ok(!has(bar(s, pause, { intensity: 3 }), 'kick'), 'la pausa, sin bombo');
  assert.ok(has(bar(s, up + 1, { intensity: 1 }), 'kick'), 'la subida, con bombo');
  // los patrones se turnan: el bajo del primer drop y el del segundo no son iguales
  const bassOf = (b) => bar(s, b, { intensity: 3 }).filter((e) => e.inst === 'bass').map((e) => e.dur).join();
  assert.notEqual(bassOf(drop + 1), bassOf(barOf(s, 'drop', 1) + 1));
});

test('la melodía contesta (la 2.ª frase de cada 8 acaba distinta) y los golpes no suenan todos igual', () => {
  const s = SONGS.galaxy, drop = barOf(s, 'drop');
  const notes = (b) => Array.from({ length: 4 }, (_, i) => bar(s, b + i, { intensity: 3 })).flat().filter((e) => e.inst === 'lead').map((e) => e.midi);
  assert.notDeepEqual(notes(drop), notes(drop + 4));
  const vels = new Set(bar(s, drop + 1, { intensity: 3 }).filter((e) => e.inst === 'hat').map((e) => e.vel));
  assert.ok(vels.size >= 4, 'velocidades humanas');
});

test('el menú es tranquilo (sin caja); las variantes cambian de tonalidad; la escala está bien', () => {
  const m = SONGS.menu;
  for (let b = 0; b < formBars(m); b++) assert.ok(!has(bar(m, b, { intensity: 3 }), 'snare'));
  assert.ok(has(bar(m, 0, { intensity: 0 }), 'arp'), 'el arpegio del menú suena siempre');
  const pad = (v) => stepEvents(SONGS.runner, 0, { intensity: 1, variant: v }).find((e) => e.inst === 'pad').midis[0];
  assert.equal(pad(1) - pad(0), SONGS.runner.variants[1]);
  assert.equal(degree([0, 2, 3, 5, 7, 8, 10], 7), 12);
  assert.equal(degree([0, 2, 3, 5, 7, 8, 10], -1), -2);
  assert.deepEqual(layersFor(m, { name: 'intro', bar: 0, bars: 8 }, 0, false).pad, true);
});

test('sin cortes: el sidechain vuelve a más del 90 % antes del bombo siguiente en TODAS las canciones', () => {
  for (const [id, s] of Object.entries(SONGS)) {
    const spb = 60 / s.bpm / 4;
    for (let i = 0; i < formBars(s) * STEPS; i++) {
      for (const e of stepEvents(s, i, { intensity: 3 })) {
        if (e.inst !== 'kick') continue;
        assert.ok(e.gap >= 1, `${id}: hueco al siguiente bombo`);
        const sh = duckShape(e.gap, spb);
        assert.ok(sh.depth >= 0.45, `${id}: no se hunde de más`);
        assert.ok(duckAt(sh, e.gap * spb) >= 0.9, `${id}: paso ${i}, vuelve a tiempo (hueco ${e.gap})`);
      }
    }
  }
  // el caso que cortaba: bombos a 2 pasos (drive) ya no dejan el bajo a −12 dB
  assert.equal(kickGap([0, 3, 6, 8, 12, 14], 6), 2);
  assert.equal(kickGap([0, 3, 6, 8, 12, 14], 14), 2);
  assert.equal(kickGap([0, 10], 10), 6);
});

test('la intensidad sube enseguida pero solo baja tras 2 compases pidiendo menos', () => {
  assert.deepEqual(nextIntensity(1, 3, 0), { value: 3, low: 0 });
  let st = nextIntensity(3, 1, 0);
  assert.equal(st.value, 3, 'un compás de calma no apaga la batería');
  st = nextIntensity(3, 1, st.low);
  assert.equal(st.value, 1, 'dos sí');
  assert.equal(nextIntensity(3, 3, 1).low, 0, 'si vuelve la acción, se reinicia la cuenta');
});

test('polifonía limitada: nunca más de VOICE_CAP voces; se apagan las más viejas', () => {
  let list = [];
  for (let i = 0; i < 20; i++) {
    const { keep, steal } = pruneVoices(list, i * 0.1, VOICE_CAP.lead);
    keep.push({ g: i, end: i * 0.1 + 5 });
    if (i >= VOICE_CAP.lead) assert.ok(steal.length >= 1 && steal[0].g < keep[0].g);
    list = keep;
    assert.ok(list.length <= VOICE_CAP.lead);
  }
  // las que ya acabaron se olvidan
  assert.equal(pruneVoices([{ g: 0, end: 1 }], 2, 6).keep.length, 0);
});
