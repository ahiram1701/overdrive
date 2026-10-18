import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../js/rng.js';
import { ROWS, NODE, genAct, nodeById, startOf, EVENTS, canChoose, resolveEffect, eventFor, progressOf, ACTS, actsTotal, RELICS, RELIC_KEYS, offerRelics, relicEvent, FORGE } from '../../js/expedition.js';
import { loadFrom } from '../../js/save.js';

test('mapa: salida abajo, jefe arriba, 2-4 nodos por fila, tipos válidos y determinista', () => {
  for (const seed of [1, 2, 99, 12345]) {
    for (let act = 0; act < 3; act++) {
      const map = genAct(seed, act);
      assert.deepEqual(map, genAct(seed, act));
      assert.equal(startOf(map).row, 0);
      assert.equal(map.filter((n) => n.row === 0).length, 1);
      assert.deepEqual(map.filter((n) => n.row === ROWS - 1).map((n) => n.type), ['boss']);
      for (let r = 1; r < ROWS - 1; r++) {
        const k = map.filter((n) => n.row === r).length;
        assert.ok(k >= 2 && k <= 4, `fila ${r}: ${k}`);
      }
      for (const n of map) assert.ok(NODE[n.type], n.type);
      assert.ok(map.filter((n) => n.row === 1).every((n) => n.type === 'tramo'), 'la primera fila siempre es un tramo');
      assert.ok(map.filter((n) => n.row <= 2).every((n) => n.type !== 'elite'), 'sin élites al principio');
    }
  }
});

test('mapa: todo nodo tiene 1-3 salidas (la salida, hasta 4) a la fila siguiente, entrada, y todo camino llega al jefe', () => {
  for (const seed of [3, 7, 2026]) {
    const map = genAct(seed, 1);
    for (const n of map) {
      if (n.row === ROWS - 1) { assert.equal(n.next.length, 0); continue; }
      assert.ok(n.next.length >= 1 && n.next.length <= (n.row === 0 ? 4 : 3), `${n.id}: ${n.next.length} salidas`); // desde la salida se puede ir a cualquiera
      for (const id of n.next) assert.equal(nodeById(map, id).row, n.row + 1);
      if (n.row > 0) assert.ok(map.some((m) => m.next.includes(n.id)), `${n.id} sin entrada`);
    }
    // desde la salida se alcanza todo nodo, y cualquier recorrido acaba en el jefe
    const seen = new Set([startOf(map).id]);
    const stack = [startOf(map)];
    while (stack.length) for (const id of stack.pop().next) if (!seen.has(id)) { seen.add(id); stack.push(nodeById(map, id)); }
    assert.equal(seen.size, map.length);
  }
});

test('eventos: opciones con requisitos, efectos con azar resueltos y deterministas por nodo', () => {
  assert.ok(EVENTS.length >= 12);
  assert.equal(new Set(EVENTS.map((e) => e.id)).size, EVENTS.length);
  for (const ev of EVENTS) {
    assert.ok(ev.choices.length >= 2);
    assert.ok(ev.choices.some((c) => canChoose(c, { coins: 0, shields: 0 })), `${ev.id}: siempre hay una opción posible`);
  }
  const casino = EVENTS.find((e) => e.id === 'casino').choices[0];
  assert.equal(canChoose(casino, { coins: 10 }), false);
  assert.ok(canChoose(casino, { coins: 30 }));
  const results = new Set();
  for (let i = 0; i < 40; i++) {
    const r = resolveEffect(casino.eff, makeRng(i));
    assert.equal(r.chance, undefined);
    results.add(r.lucky);
  }
  assert.deepEqual([...results].sort(), [false, true], 'a veces se gana y a veces no');
  assert.equal(eventFor(5, '0-3-1').id, eventFor(5, '0-3-1').id);
  assert.ok(progressOf(1, 0) > progressOf(0, 6));
});

test('reliquias: 10, se ofrecen 3 distintas que no tienes; el 4.º acto, tras ganar una expedición', () => {
  assert.equal(RELIC_KEYS.length, 10);
  for (const k of RELIC_KEYS) assert.ok(RELICS[k].icon && RELICS[k].name && RELICS[k].desc);
  for (let i = 0; i < 30; i++) {
    const o = offerRelics(['cristal', 'avaro'], makeRng(i));
    assert.equal(o.length, 3);
    assert.equal(new Set(o).size, 3);
    assert.ok(!o.includes('cristal') && !o.includes('avaro'));
  }
  assert.deepEqual(offerRelics(RELIC_KEYS, makeRng(1)), [], 'con todas, ninguna');
  const ev = relicEvent(['iman', 'gema', 'fenix']);
  assert.equal(ev.choices.length, 4, '3 reliquias y «ninguna»');
  assert.equal(ACTS.length, 4);
  const s = loadFrom(null);
  assert.equal(actsTotal(s), 3);
  s.expedition.wins = 1;
  assert.equal(actsTotal(s), 4);
  assert.ok(NODE.forge && FORGE.choices.some((c) => canChoose(c, { coins: 0, shields: 0 })));
  assert.ok(EVENTS.length >= 18, 'eventos nuevos');
});
