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

test('sucesos: deterministas, ORIGEN tranquilo y bases solo en lo peligroso', async () => {
  const { eventFor, EVENTS } = await import('../../js/galaxyEvents.js');
  assert.equal(eventFor(0, 5, 0), null);
  assert.deepEqual(eventFor(7, 3, 2), eventFor(7, 3, 2));
  const seen = new Set();
  for (let n = 0; n < 200; n++) {
    const e = eventFor(5, n, 1);
    if (!e) continue;
    assert.ok(EVENTS[e.kind]);
    assert.notEqual(e.kind, 'assault', 'sin bases en peligro 1');
    seen.add(e.kind);
  }
  assert.equal(seen.size, 4, 'salen todos los sucesos tranquilos');
  let any = 0;
  for (let n = 0; n < 200; n++) if (eventFor(9, n, 3)?.kind === 'assault') any++;
  assert.ok(any > 10, 'las bases piratas aparecen en sistemas peligrosos');
});

test('misiles: se fijan en el cono tras un tiempo y persiguen hasta alcanzar', async () => {
  const { lockStep, steerMissile, MISSILE, missileAmmo } = await import('../../js/galaxyEvents.js');
  const me = { x: 0, y: 0, z: 0 }, f = { x: 0, y: 0, z: 1 };
  const a = { id: 'a' }, b = { id: 'b' };
  let lock = { ref: null, t: 0, locked: false };
  // fuera del cono: nada
  lock = lockStep(lock, [{ ref: b, pos: { x: 400, y: 0, z: 100 } }], me, f, 0.1);
  assert.equal(lock.ref, null);
  for (let i = 0; i < 5; i++) lock = lockStep(lock, [{ ref: a, pos: { x: 20, y: 0, z: 500 } }], me, f, 0.1);
  assert.equal(lock.locked, false);
  for (let i = 0; i < 3; i++) lock = lockStep(lock, [{ ref: a, pos: { x: 20, y: 0, z: 500 } }], me, f, 0.1);
  assert.equal(lock.locked, true);
  assert.equal(lock.ref, a);
  // un blanco que se mueve de lado: el misil le alcanza antes de agotarse
  const tgt = { x: 300, y: 50, z: 300 };
  const m = { pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: MISSILE.speed }, life: MISSILE.life };
  let hit = false;
  for (let t = 0; t < MISSILE.life && !hit; t += 1 / 60) {
    tgt.x -= 60 / 60;
    steerMissile(m, tgt, 1 / 60);
    hit = Math.hypot(m.pos.x - tgt.x, m.pos.y - tgt.y, m.pos.z - tgt.z) < 8;
  }
  assert.ok(hit);
  assert.equal(missileAmmo(0), 0);
  assert.ok(missileAmmo(5) > missileAmmo(1));
});

test('planetas: nombre, tipo y lo que compran, deterministas', async () => {
  const { planetInfo } = await import('../../js/galaxyEvents.js');
  const a = planetInfo(4, 1, 'VEGA', 2);
  assert.deepEqual(a, planetInfo(4, 1, 'VEGA', 2));
  assert.equal(a.name, 'VEGA II');
  assert.ok(ORES[a.buys] && a.mult > 1 && a.reward > 0);
});
