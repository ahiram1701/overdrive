import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genGalaxy } from '../../js/galaxy.js';
import { loadFrom } from '../../js/save.js';
import { ownerOf } from '../../js/factions.js';
import {
  tickWorld, world, worldTerritory, defendKill, clearNest, reclaim, infected, priceMul, warHere,
  WAR_FIRST, WAR_TIME, WAR_KILLS, SWARM_FIRST, SWARM_EVERY, SWARM_MAX, SWARM_PRICE,
} from '../../js/galaxyWorld.js';

const gal = genGalaxy();
const run = (s, from, to) => { for (let j = from; j <= to; j++) tickWorld(s, gal, j); };

test('ofensiva pirata: ataca un aliado fronterizo; si no lo defiendes en 5 saltos, cae; liberarlo lo recupera', () => {
  const s = loadFrom(null);
  run(s, 1, WAR_FIRST);
  const war = world(s).war;
  assert.ok(war, 'a los pocos saltos, una ofensiva');
  const sys = gal[war.sys];
  assert.notEqual(war.sys, 0, 'nunca ORIGEN');
  assert.notEqual(ownerOf(sys, worldTerritory(s)), 'pir');
  assert.ok(sys.links.some((l) => ownerOf(gal[l], worldTerritory(s)) === 'pir'), 'linda con los piratas');
  assert.equal(war.until, WAR_FIRST + WAR_TIME);
  s.territory[war.sys] = 'liga'; // aunque fuera tuyo, se pierde
  run(s, WAR_FIRST + 1, WAR_FIRST + WAR_TIME);
  assert.equal(world(s).war?.sys === war.sys, false);
  assert.equal(ownerOf(sys, worldTerritory(s)), 'pir', 'cayó');
  assert.equal(s.territory[war.sys], undefined);
  assert.ok(world(s).news.some((n) => n.text.includes(sys.name)));
  reclaim(s, war.sys);
  s.territory[war.sys] = 'coal';
  assert.equal(ownerOf(sys, worldTerritory(s)), 'coal', 'liberado otra vez');
});

test('defender: abatir 6 piratas allí la rechaza; es determinista', () => {
  const a = loadFrom(null), b = loadFrom(null);
  run(a, 1, WAR_FIRST);
  run(b, 1, WAR_FIRST);
  assert.deepEqual(world(a).war, world(b).war, 'mismos saltos, misma ofensiva');
  const sys = world(a).war.sys;
  assert.equal(defendKill(a, sys === 1 ? 2 : 1, 7, gal), null, 'en otro sistema no cuenta');
  for (let i = 0; i < WAR_KILLS - 1; i++) assert.equal(defendKill(a, sys, 7, gal), 'progress');
  assert.equal(defendKill(a, sys, 7, gal), 'saved');
  assert.equal(world(a).war, null);
  assert.equal(world(a).saved, 1);
  assert.equal(warHere(a, sys), null);
});

test('enjambre: aparece, se extiende cada 3 saltos hasta 4 sistemas, hunde precios y se extermina nido a nido', () => {
  const s = loadFrom(null);
  run(s, 1, SWARM_FIRST);
  const sw = world(s).swarm;
  assert.ok(sw && sw.systems.length === 1);
  run(s, SWARM_FIRST + 1, SWARM_FIRST + SWARM_EVERY * 6);
  const sys = world(s).swarm.systems;
  assert.ok(sys.length > 1 && sys.length <= SWARM_MAX, `se extendió (${sys.length})`);
  for (const id of sys) {
    assert.ok(id !== 0 && ownerOf(gal[id], worldTerritory(s)) !== 'pir');
    assert.equal(priceMul(s, id), SWARM_PRICE);
  }
  assert.equal(priceMul(s, 0), 1);
  const ids = [...sys];
  for (const id of ids.slice(0, -1)) assert.equal(clearNest(s, id, 40, gal), 'cleared');
  assert.equal(clearNest(s, ids.at(-1), 40, gal), 'wiped');
  assert.equal(world(s).swarm, null);
  assert.equal(world(s).wiped, 1);
  assert.equal(infected(s, ids[0]), false);
  assert.equal(loadFrom(JSON.stringify(s)).galaxyWorld.wiped, 1, 'galaxyWorld está en MAPS');
});
