import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, STEPS, stepEvents, sectionAt, layersFor, degree } from '../../js/music.js';

const bar = (song, b, st) => Array.from({ length: STEPS }, (_, k) => stepEvents(song, b * STEPS + k, st)).flat();
const has = (evs, inst) => evs.some((e) => e.inst === inst);

test('cada canción está bien hecha: forma, progresiones, patrones de 16 y melodías dentro de la frase', () => {
  for (const [id, s] of Object.entries(SONGS)) {
    assert.ok(s.bpm >= 80 && s.bpm <= 160, `${id}: bpm`);
    assert.equal(s.bass.length, STEPS, `${id}: bajo de 16`);
    assert.ok(s.form.length >= 2, `${id}: al menos dos secciones`);
    for (const [, p, bars] of s.form) {
      assert.ok(s.prog[p], `${id}: existe la progresión ${p}`);
      assert.ok(bars > 0 && bars % 4 === 0, `${id}: secciones de 4 en 4`);
    }
    for (const mel of Object.values(s.melody)) for (const [st, , len] of mel) assert.ok(st >= 0 && st < 32 && len > 0, `${id}: nota de la melodía fuera de la frase`);
    // 64 compases sin errores ni notas absurdas
    for (let i = 0; i < 64 * STEPS; i++) {
      for (const e of stepEvents(s, i, { intensity: 3, od: true })) {
        for (const m of e.midis || (e.midi != null ? [e.midi] : [])) assert.ok(m >= 20 && m <= 110, `${id}: nota MIDI ${m}`);
      }
    }
  }
});

test('la música sube con la acción: más capas con más intensidad, y el OVERDRIVE sube la melodía', () => {
  const s = SONGS.runner, b = 6; // un compás del verso, no el último (sin redoble)
  const sec = sectionAt(s, b);
  assert.equal(sec.name, 'verso');
  const i0 = bar(s, b, { intensity: 0 }), i1 = bar(s, b, { intensity: 1 }), i2 = bar(s, b, { intensity: 2 }), i3 = bar(s, b, { intensity: 3 });
  assert.ok(has(i0, 'pad') && has(i0, 'bass') && !has(i0, 'kick'));
  assert.ok(has(i1, 'kick') && has(i1, 'hat') && !has(i1, 'snare'));
  assert.ok(has(i2, 'snare') && has(i2, 'arp') && !has(i2, 'lead'));
  assert.ok(has(i3, 'lead'));
  assert.ok(i0.length < i1.length && i1.length < i2.length && i2.length <= i3.length);
  // OVERDRIVE: la melodía aparece aunque la intensidad sea baja, y una octava más alta
  const lead = (od) => bar(s, b, { intensity: 3, od }).filter((e) => e.inst === 'lead').map((e) => e.midi);
  assert.deepEqual(lead(true), lead(false).map((m) => m + 12));
  assert.ok(has(bar(s, b, { intensity: 0, od: true }), 'lead'));
});

test('redobles al final de cada sección, platillo al empezar la siguiente y un puente sin batería', () => {
  const s = SONGS.runner;
  // el verso (compases 4–11) acaba con redoble y el estribillo (12) entra con platillo
  const last = Array.from({ length: 4 }, (_, i) => stepEvents(s, 11 * STEPS + 12 + i, { intensity: 2 })).flat();
  assert.equal(last.filter((e) => e.inst === 'snare').length, 4, 'redoble de 4 golpes al final del verso');
  assert.ok(has(stepEvents(s, 12 * STEPS, { intensity: 2 }), 'crash'), 'platillo al entrar el estribillo');
  const puente = s.form.findIndex(([n]) => n === 'puente');
  const startBar = s.form.slice(0, puente).reduce((n, f) => n + f[2], 0);
  assert.ok(!has(bar(s, startBar, { intensity: 3 }), 'kick'), 'el puente empieza sin bombo');
  assert.ok(has(bar(s, startBar + 4, { intensity: 3 }), 'kick'), 'y vuelve a los 4 compases');
});

test('el menú es tranquilo (sin caja); las variantes cambian de tonalidad; la escala está bien', () => {
  const m = SONGS.menu;
  for (let b = 0; b < 20; b++) assert.ok(!has(bar(m, b, { intensity: 3 }), 'snare'));
  assert.ok(has(bar(m, 0, { intensity: 0 }), 'arp'), 'el arpegio del menú suena siempre');
  const pad = (v) => stepEvents(SONGS.runner, 0, { intensity: 1, variant: v }).find((e) => e.inst === 'pad').midis[0];
  assert.notEqual(pad(0), pad(1));
  assert.equal(pad(1) - pad(0), SONGS.runner.variants[1]);
  assert.equal(degree([0, 2, 3, 5, 7, 8, 10], 7), 12);
  assert.equal(degree([0, 2, 3, 5, 7, 8, 10], -1), -2);
  assert.deepEqual(layersFor(m, { name: 'intro', bar: 0 }, 0, false).pad, true);
});
