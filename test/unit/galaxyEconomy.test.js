import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genGalaxy } from '../../js/galaxy.js';
import { boardFor, TIER_MUL, tierOf, modsFor, contractExpired } from '../../js/galaxyMissions.js';
import { tickWorld, oreMul, world, SHORT_MUL, SHORT_FIRST, SHORT_TIME } from '../../js/galaxyWorld.js';
import { upgradeCost, BASE_UP, CHASSIS } from '../../js/galaxyData.js';
import { loadFrom } from '../../js/save.js';

const GAL = genGalaxy();

test('contratos: ★ / ★★ / ★★★ con condiciones y paga creciente', () => {
  assert.equal(tierOf(0.1), 1);
  assert.equal(tierOf(0.6), 2);
  assert.equal(tierOf(0.9), 3);
  assert.deepEqual(modsFor(1, 0.1), []);
  assert.equal(modsFor(2, 0.1).length, 1);
  assert.deepEqual(modsFor(3, 0.5), ['timed', 'clean']);
  assert.ok(TIER_MUL[3] > TIER_MUL[2] && TIER_MUL[2] > TIER_MUL[1]);
  const all = [];
  for (let seq = 0; seq < 40; seq++) all.push(...boardFor(GAL, 0, seq, { jumpLvl: 3 }));
  const tiers = new Set(all.map((m) => m.tier));
  assert.deepEqual([...tiers].sort(), [1, 2, 3], 'salen los tres niveles');
  for (const m of all) {
    assert.ok(m.text.startsWith('★'.repeat(m.tier)), m.text);
    assert.equal(m.mods.length, m.tier - 1);
    assert.ok(m.jumps >= 2);
  }
  const avg = (t) => { const l = all.filter((m) => m.tier === t); return l.reduce((a, m) => a + m.reward, 0) / l.length; };
  assert.ok(avg(3) > avg(1) * 3, 'los ★★★ pagan mucho más');
  const timed = { mods: ['timed'], deadline: 10 };
  assert.ok(!contractExpired(timed, 10));
  assert.ok(contractExpired(timed, 11));
  assert.ok(!contractExpired({ mods: ['clean'], deadline: 0 }, 99));
});

test('escasez: sale en las noticias, paga ×2 ese mineral en esa estación y se acaba', () => {
  const save = loadFrom(null);
  for (let j = 1; j <= SHORT_FIRST; j++) tickWorld(save, GAL, j);
  const sh = world(save).shortage;
  assert.ok(sh, 'hay escasez');
  assert.notEqual(sh.sys, 0);
  assert.notEqual(sh.ore, GAL[sh.sys].ore, 'nunca del mineral local');
  assert.equal(oreMul(save, sh.sys, sh.ore), SHORT_MUL);
  assert.equal(oreMul(save, sh.sys, GAL[sh.sys].ore), 1);
  assert.ok(world(save).news.some((n) => n.text.includes('Escasez')));
  tickWorld(save, GAL, SHORT_FIRST + SHORT_TIME);
  assert.ok(!world(save).shortage || world(save).shortage.sys !== sh.sys || world(save).shortage.ore !== sh.ore, 'se acaba');
});

test('precios: los Mk siguen subiendo con medida; los chasis, en orden', () => {
  const mk6 = upgradeCost('laser', BASE_UP);
  assert.ok(mk6 > upgradeCost('laser', BASE_UP - 1), 'el primer Mk sigue costando más que el nivel 5');
  assert.ok(mk6 < upgradeCost('laser', BASE_UP - 1) * 1.7, 'y cada Mk, como mucho ×1,7 del anterior');
  assert.ok(CHASSIS.corsair.cost > CHASSIS.warship.cost && CHASSIS.hauler.cost < CHASSIS.interceptor.cost);
});
