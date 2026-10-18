import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shipStats } from '../../js/galaxyData.js';
import { loadFrom } from '../../js/save.js';
import {
  power, threatOf, extraPirates, rewardMul, threatTier, THREAT_MAX, addWanted, jumpWanted, stars, hunterChance, hunterCount,
  bribe, bribeCost, eliteChance, TRAITS, TRAIT_KEYS,
} from '../../js/galaxyThreat.js';

const lv = (n) => ({ engine: n, laser: n, shield: n, cargo: n, jump: n, missile: n });

test('poder y amenaza: una nave nueva no cambia nada; una muy mejorada refuerza a los piratas, con tope', () => {
  assert.ok(Math.abs(power(shipStats({}, 'viper', 'explorer')) - 1) < 1e-9, 'nave nueva = 1');
  assert.equal(threatOf(1), 1);
  assert.equal(threatOf(1.2), 1, 'un poco de mejora, nada');
  const maxed = power(shipStats(lv(10), 'viper', 'errante2'));
  assert.ok(maxed > 4, `nave al máximo: poder ${maxed.toFixed(1)}`);
  assert.equal(threatOf(maxed), THREAT_MAX, 'con tope');
  let last = 0;
  for (let n = 0; n <= 10; n++) {
    const t = threatOf(power(shipStats(lv(n))));
    assert.ok(t >= last, 'nunca baja al mejorar');
    last = t;
  }
  assert.equal(extraPirates(1), 0);
  assert.equal(extraPirates(THREAT_MAX), 4);
  assert.equal(rewardMul(4), 2, 'el premio sube con la raíz de la amenaza');
  assert.equal(threatTier(1), 0);
  assert.equal(threatTier(THREAT_MAX), 4);
});

test('nivel de búsqueda: sube al abatir, baja al saltar sin bajas; cazadores desde ⭐⭐; soborno', () => {
  const g = { wanted: 0, credits: 10000 };
  for (let i = 0; i < 40; i++) addWanted(g, 'kill');
  assert.equal(stars(g), 2);
  assert.equal(hunterChance(1.9), 0);
  assert.ok(hunterChance(2) > 0 && hunterChance(5) > hunterChance(2));
  assert.equal(hunterCount(2), 2);
  assert.equal(hunterCount(5), 4);
  jumpWanted(g, 3);
  assert.equal(stars(g), 2, 'si abatiste a alguien, no baja');
  jumpWanted(g, 0);
  assert.ok(g.wanted < 2.4);
  for (let i = 0; i < 20; i++) addWanted(g, 'base');
  assert.equal(g.wanted, 5, 'tope 5');
  const c = bribeCost(g, 1);
  assert.equal(bribe(g, 1), c);
  assert.equal(stars(g), 4);
  assert.equal(g.credits, 10000 - c);
  assert.equal(bribe({ wanted: 0.5, credits: 1e6 }), false, 'sin estrellas no hay soborno');
});

test('élites: ninguna con nave nueva cerca de ORIGEN; más con amenaza y peligro; 4 rasgos', () => {
  assert.equal(eliteChance(1, 0), 0);
  assert.equal(eliteChance(1, 1), 0);
  assert.ok(eliteChance(2, 3) > eliteChance(1.2, 2));
  assert.ok(eliteChance(THREAT_MAX, 6) <= 0.45);
  assert.equal(TRAIT_KEYS.length, 4);
  for (const k of TRAIT_KEYS) assert.ok(TRAITS[k].icon && TRAITS[k].name && TRAITS[k].desc);
});

test('el nivel de búsqueda se guarda (está en los valores por defecto de la galaxia)', () => {
  const s = loadFrom(null);
  s.galaxy.wanted = 3.2;
  assert.equal(loadFrom(JSON.stringify(s)).galaxy.wanted, 3.2);
});
