import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genGalaxy, N_SYSTEMS, canJump, jumpNeeded, route, known, oreForDanger } from '../../js/galaxy.js';
import { ORES } from '../../js/galaxyData.js';

test('galaxia: 30 sistemas, determinista, conexa y con enlaces simétricos', () => {
  const g = genGalaxy();
  assert.equal(g.length, N_SYSTEMS);
  assert.deepEqual(g, genGalaxy());
  assert.equal(g[0].name, 'ORIGEN');
  assert.equal(new Set(g.map((s) => s.name)).size, N_SYSTEMS, 'nombres únicos');
  for (const s of g) {
    assert.ok(s.links.length >= 1);
    for (const l of s.links) assert.ok(g[l].links.includes(s.id), 'enlace en los dos sentidos');
    assert.ok(Number.isFinite(s.danger), 'todo sistema es alcanzable');
  }
});

test('peligro = saltos desde ORIGEN; lejos, mejor mineral, más piratas; jefes solo en lo peligroso', () => {
  const g = genGalaxy();
  assert.equal(g[0].danger, 0);
  assert.equal(g[0].pirates, 0, 'ORIGEN es seguro');
  for (const s of g) {
    for (const l of s.links) assert.ok(Math.abs(g[l].danger - s.danger) <= 1);
    if (s.id) assert.equal(s.ore, oreForDanger(s.danger));
    if (s.boss) assert.ok(s.danger >= 4);
    for (const k of Object.keys(ORES)) assert.ok(s.prices[k] > 0);
    // lo local es más barato que el precio base
    if (s.id) assert.ok(s.prices[s.ore] <= Math.round(ORES[s.ore].price * 1.35 * 0.75) + 1);
  }
  assert.ok(Math.max(...g.map((s) => s.danger)) >= 4, 'hay zonas lejanas');
  assert.ok(ORES[oreForDanger(6)].price > ORES[oreForDanger(0)].price);
});

test('salto, rutas y niebla', () => {
  const g = genGalaxy();
  const far = g.find((s) => s.danger >= 3);
  assert.equal(canJump(far, 0), false);
  assert.ok(canJump(far, jumpNeeded(far)));
  assert.ok(canJump(g.find((s) => s.danger === 1), 0), 'el primer anillo, libre');
  const r = route(g, 0, far.id);
  assert.equal(r[0], 0);
  assert.equal(r.at(-1), far.id);
  assert.equal(r.length - 1, far.danger, 'la ruta más corta tiene tantos saltos como peligro');
  const k = known(g, [0]);
  assert.ok(k.has(0));
  for (const l of g[0].links) assert.ok(k.has(l));
  assert.ok(k.size < g.length, 'el resto está en la niebla');
});
