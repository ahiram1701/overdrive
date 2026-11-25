// GALAXIA · economía: la amenaza sigue tu poder más despacio, el premio crece con ella, los precios se mueven
// (rutas comerciales), los puestos rinden y los Mk valen la pena. Y una tabla de créditos por tramo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shipStats, UPGRADES, upgradeCost, upgradeMats, effLvl, CHASSIS, ORES } from '../../js/galaxyData.js';
import { power, threatOf, rewardMul, killValue, THREAT_MAX } from '../../js/galaxyThreat.js';
import { priceDrift, DRIFT_EVERY, GOOD_PRICE } from '../../js/market.js';
import { outpostIncome } from '../../js/outposts.js';
import { oreForDanger } from '../../js/galaxy.js';

const lv = (n) => ({ engine: n, laser: n, shield: n, cargo: n, jump: n, missile: n });

test('amenaza: crece más despacio que tu poder; el premio, igual que ella', () => {
  for (let n = 3; n <= 10; n++) {
    const pw = power(shipStats(lv(n)));
    const t = threatOf(pw);
    assert.ok(t <= pw, `nivel ${n}: amenaza ${t.toFixed(2)} ≤ poder ${pw.toFixed(2)}`);
    assert.equal(rewardMul(t), t);
  }
  const maxed = power(shipStats(lv(10), 'viper', 'errante2'));
  assert.ok(threatOf(maxed) / maxed < 0.6, 'muy mejorado, la diferencia se nota');
  assert.equal(threatOf(1000), THREAT_MAX);
});

test('Mk 6-10: rinden como un nivel normal y piden más materiales', () => {
  assert.equal(effLvl(10), 10);
  assert.ok(shipStats({ laser: 10 }).dmg - shipStats({ laser: 5 }).dmg >= shipStats({ laser: 5 }).dmg - shipStats({}).dmg - 1e-9);
  assert.ok(upgradeMats(6).chatarra >= 18 && upgradeMats(9).nucleos >= 6);
});

test('rutas comerciales: cada estación paga distinto y cambia cada pocos saltos', () => {
  const vals = new Set();
  for (let sys = 1; sys < 20; sys++) {
    const d = priceDrift(sys, 'crystal', 0);
    assert.ok(d >= 0.8 && d <= 1.3);
    assert.equal(priceDrift(sys, 'crystal', DRIFT_EVERY - 1), d, 'no cambia a cada salto');
    vals.add(d);
  }
  assert.ok(vals.size > 10);
  const changes = Array.from({ length: 10 }, (_, k) => priceDrift(3, 'plasma', k * DRIFT_EVERY));
  assert.ok(new Set(changes).size > 5, 'con el tiempo, cambia');
  assert.ok(Array.from({ length: 30 }, (_, s) => priceDrift(s, 'iron', 0)).some((d) => d >= GOOD_PRICE), 'hay buenos precios que buscar');
});

test('puestos avanzados: rinden por salto, más cuanto más ampliados', () => {
  assert.equal(outpostIncome({ outposts: {} }), 0);
  assert.equal(outpostIncome({ outposts: { 3: { mods: {} } } }), 30);
  assert.equal(outpostIncome({ outposts: { 3: { mods: { radar: 2, market: 1 } }, 7: { mods: {} } } }), 30 + 45 + 30);
});

// TABLA: créditos de un "viaje" típico (bodega llena + 8 bajas) en cada tramo, y cuántos viajes cuesta lo siguiente
test('tabla de economía: cada tramo paga más y lo caro se alcanza en un número razonable de viajes', () => {
  const row = (d, up) => {
    const st = shipStats(lv(up));
    const t = threatOf(power(st));
    const ore = ORES[oreForDanger(d)].price * st.cargo;
    const kills = 8 * killValue(d) * rewardMul(t);
    return Math.round(ore + kills);
  };
  const tiers = [[1, 1], [2, 3], [4, 5], [6, 8]].map(([d, up]) => ({ d, up, trip: row(d, up) }));
  for (let i = 1; i < tiers.length; i++) assert.ok(tiers[i].trip > tiers[i - 1].trip * 1.3, `tramo ${tiers[i].d} paga más`);
  const trips = (cost, i) => cost / tiers[i].trip;
  // un nivel normal, en 1-4 viajes del tramo bajo; un chasis grande, en 6-40 viajes del tramo medio
  const lvl3 = UPGRADES.laser.cost[2];
  assert.ok(trips(lvl3, 0) >= 0.3 && trips(lvl3, 0) <= 4, `nivel 3: ${trips(lvl3, 0).toFixed(1)} viajes`);
  const ws = CHASSIS.warship.cost;
  assert.ok(trips(ws, 2) >= 6 && trips(ws, 2) <= 40, `acorazado: ${trips(ws, 2).toFixed(1)} viajes`);
  const mk8 = upgradeCost('laser', 7);
  assert.ok(trips(mk8, 3) >= 0.2 && trips(mk8, 3) <= 25, `Mk 8: ${trips(mk8, 3).toFixed(1)} viajes`);
});
