import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genGalaxy, genSector, expandAround, rebuildGalaxy, route, ringOf, secOf, sectorName, jumpNeeded, SECTOR, EDGE, N_SYSTEMS, HIDDEN_N } from '../../js/galaxy.js';

test('el núcleo es la galaxia de siempre: los sectores se añaden detrás sin tocarla', () => {
  const a = genGalaxy(7), b = rebuildGalaxy(7, [[1, 0], [0, 1]]);
  assert.equal(a.length, N_SYSTEMS + HIDDEN_N);
  for (let i = 0; i < a.length; i++) {
    assert.equal(b[i].name, a[i].name);
    assert.equal(b[i].danger, a[i].danger);
    for (const l of a[i].links) assert.ok(b[i].links.includes(l));
  }
  assert.ok(b.length > a.length + 30);
});

test('sectores deterministas: misma semilla y mismo orden, mismos sistemas (guardar y cargar)', () => {
  const order = [[1, 0], [1, 1], [-1, 0], [2, 1]];
  const g1 = rebuildGalaxy(11, order), g2 = rebuildGalaxy(11, order);
  assert.deepEqual(g1.map((s) => [s.name, s.x, s.y, s.danger, s.links.join('.')]), g2.map((s) => [s.name, s.x, s.y, s.danger, s.links.join('.')]));
  // y repetir un sector no lo duplica
  assert.equal(genSector(g1, 11, 1, 0).length, 0);
});

test('todo está conectado: desde ORIGEN se llega a cualquier sistema de cualquier sector', () => {
  const g = rebuildGalaxy(5, [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [2, 0], [3, 0]]);
  for (const s of g) assert.ok(route(g, 0, s.id), `${s.name} (${secOf(s)}) alcanzable`);
  const names = new Set(g.map((s) => s.name));
  assert.equal(names.size, g.length, 'nombres únicos');
  for (const s of g) for (const l of s.links) assert.ok(g[l].links.includes(s.id), 'enlaces simétricos');
});

test('cuanto más lejos, más peligro (sin tope); el salto nunca pide más que Mk 10', () => {
  const g = rebuildGalaxy(3, [[1, 0], [2, 0], [3, 0], [4, 0]]);
  const avg = (r) => { const xs = g.filter((s) => s.sec && ringOf(...s.sec) === r); return xs.reduce((a, s) => a + s.danger, 0) / xs.length; };
  assert.ok(avg(1) < avg(2) && avg(2) < avg(3) && avg(3) < avg(4));
  assert.ok(Math.max(...g.map((s) => s.danger)) > 12);
  assert.ok(g.every((s) => jumpNeeded(s) <= 10));
  // y se paga mejor lejos de casa
  const priceAt = (r) => { const xs = g.filter((s) => s.sec && ringOf(...s.sec) === r); return xs.reduce((a, s) => a + s.prices.iron, 0) / xs.length; };
  assert.ok(priceAt(4) > priceAt(1));
});

test('expandir: solo cerca del borde, y el sector nuevo queda unido al tuyo', () => {
  const g = genGalaxy(7);
  // un sistema del núcleo pegado al borde este
  const edge = g.filter((s) => !s.hidden && s.x > SECTOR - EDGE).sort((a, b) => b.x - a.x)[0];
  const mid = g[0];
  assert.deepEqual(expandAround(g, 7, mid.id), [], 'en el centro no se genera nada');
  if (edge) {
    const add = expandAround(g, 7, edge.id);
    assert.ok(add.some(([sx, sy]) => sx === 1 && sy === 0));
    const far = g.find((s) => s.sec && s.sec[0] === 1);
    assert.ok(route(g, edge.id, far.id));
  }
  assert.ok(sectorName(7, 1, 0).length > 4);
  assert.equal(sectorName(7, 0, 0), 'Núcleo de Origen');
});
