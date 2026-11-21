import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dist } from '../../js/space3d.js';
import {
  CONTACTS, CONTACT_KEYS, pickContact, nextContactDelay, trapChance, contactReward, RINGS, ringPath, ringPay, CRUISE, cruiseStep, interdictChance,
} from '../../js/galaxyContacts.js';

test('contactos: cada poco, y lo peligroso solo lejos de ORIGEN', () => {
  assert.ok(nextContactDelay(0) >= 25 && nextContactDelay(0.999) <= 40);
  const near = new Set(), far = new Set();
  for (let r = 0; r < 1; r += 0.005) { near.add(pickContact(0, r)); far.add(pickContact(5, r)); }
  for (const k of near) assert.ok(!CONTACTS[k].from, `${k} no sale en ORIGEN`);
  assert.equal(far.size, CONTACT_KEYS.length, 'lejos sale de todo');
  assert.ok(trapChance(6) > trapChance(0) && trapChance(99) <= 0.45);
  assert.ok(contactReward('smuggler', 3) > contactReward('distress', 3));
});

test('anillos: en fila delante de ti y pagan más si los cruzas todos', () => {
  const path = ringPath({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }, 1);
  assert.equal(path.length, RINGS.n);
  for (let i = 1; i < path.length; i++) assert.ok(path[i].z > path[i - 1].z, 'cada uno más lejos');
  for (let i = 1; i < path.length; i++) assert.ok(dist(path[i], path[i - 1]) < 300, 'alcanzables');
  assert.equal(ringPay(0, 2), 0);
  assert.ok(ringPay(RINGS.n, 2) > ringPay(RINGS.n - 1, 2) * 1.3, 'la carrera perfecta tiene premio');
});

test('supercrucero: sube despacio hasta ×4 y cae de golpe', () => {
  let k = 1, t = 0;
  while (k < CRUISE.max && t < 30) { k = cruiseStep(k, 0.1, true); t += 0.1; }
  assert.equal(k, CRUISE.max);
  assert.ok(t > 4, `tarda unos segundos (${t.toFixed(1)} s)`);
  assert.equal(cruiseStep(k, 0.1, false), 1);
});

test('interdicción: solo muy buscado', () => {
  assert.equal(interdictChance(2), 0);
  assert.ok(interdictChance(3) > 0 && interdictChance(5) > interdictChance(3));
  assert.ok(interdictChance(5) <= 0.45);
});
