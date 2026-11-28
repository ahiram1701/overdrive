import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genGalaxy, rebuildGalaxy } from '../../js/galaxy.js';
import { makeSystem, upgradeCost, effLvl, MAX_UP } from '../../js/galaxyData.js';
import { fleetOf, freighterCost, freighterUpCost, buyFreighter, upgradeFreighter, insureFreighter, tickFleet, collectFleet, tripIncome, lossChance, crewCost, crewBonus, hireCrew, crewMul, payCrew, insureShip, shipInsured } from '../../js/fleet.js';
import { stationOf, sysLore } from '../../js/galaxyLore.js';
import { spawnTraffic, updateTraffic, rumor, trafficMix } from '../../js/galaxyTraffic.js';
import { tickWorld, world, worldTerritory, FRONT_FIRST, FRONT_EVERY } from '../../js/galaxyWorld.js';
import { ownerOf } from '../../js/factions.js';
import { makeRng } from '../../js/rng.js';

const fresh = (credits = 1e6) => ({ galaxy: { credits }, territory: {} });

test('siempre hay en qué gastar: Mk ∞, cargueros, tripulación y seguros no tienen techo y cada vez cuestan más', () => {
  for (let l = MAX_UP; l < MAX_UP + 20; l++) assert.ok(upgradeCost('laser', l + 1) > upgradeCost('laser', l));
  assert.ok(effLvl(MAX_UP + 10) < MAX_UP + 10 && effLvl(MAX_UP + 10) > MAX_UP, 'el Mk ∞ rinde menos por nivel');
  for (let n = 0; n < 10; n++) assert.ok(freighterCost(n + 1) > freighterCost(n));
  for (let l = 1; l < 30; l++) assert.ok(freighterUpCost(l + 1) > freighterUpCost(l));
  for (let l = 0; l < 30; l++) assert.ok(crewCost(l + 1) > crewCost(l));
  // la tripulación da cada vez menos por nivel (nunca rompe el juego)
  assert.ok(crewBonus(50, 0.03) < 0.03 * 50 && crewBonus(50, 0.03) > crewBonus(10, 0.03));
});

test('cargueros: comercian solos en cada salto, se cobran al atracar y pueden hundirse (con seguro, te devuelven parte)', () => {
  const save = fresh(), gal = genGalaxy(7);
  const f = buyFreighter(save, 0);
  assert.ok(f && save.galaxy.credits === 1e6 - freighterCost(0));
  assert.ok(upgradeFreighter(save, f.id));
  assert.equal(f.lvl, 2);
  for (let j = 1; j <= 5; j++) tickFleet(save, gal, j);
  const before = save.galaxy.credits, got = collectFleet(save);
  assert.equal(got, tripIncome(2, gal[0].danger) * 5);
  assert.equal(save.galaxy.credits, before + got);
  // lejos y peligroso paga más… y arriesga más
  assert.ok(tripIncome(1, 8) > tripIncome(1, 1));
  assert.ok(lossChance(1, 8) > lossChance(1, 1));
  // con muchos saltos en una ruta peligrosa acaba hundido; asegurado, te devuelven dinero
  const s2 = fresh(), far = gal.find((x) => x.danger >= 6) || gal[gal.length - 1];
  const f2 = buyFreighter(s2, far.id);
  insureFreighter(s2, f2.id);
  let news = [];
  for (let j = 1; j < 400 && fleetOf(s2).ships.length; j++) { news = tickFleet(s2, gal, j); if (f2.ins < 1) insureFreighter(s2, f2.id); }
  assert.equal(fleetOf(s2).ships.length, 0);
  assert.match(news.join(' '), /seguro/);
});

test('tripulación: mejora la nave y cobra por salto; si no le pagas, ese salto no rinde', () => {
  const save = fresh(5000);
  assert.ok(hireCrew(save, 'gunner'));
  assert.ok(crewMul(save, 'dmg') > 1);
  assert.equal(crewMul(save, 'speed'), 1);
  assert.ok(payCrew(save) > 0);
  save.galaxy.credits = 0;
  assert.ok(payCrew(save) < 0);
  assert.equal(crewMul(save, 'dmg'), 1, 'sin cobrar, sin bonus');
  save.galaxy.credits = 9999;
  assert.ok(insureShip(save, 3) && shipInsured(save));
});

test('estaciones con nombre y tipo según quién manda; cada sistema con su historia', () => {
  const gal = genGalaxy(7);
  const st = gal.map((s) => stationOf(s, ownerOf(s), 7));
  assert.ok(new Set(st.map((x) => x.kind)).size >= 4, 'hay variedad de estaciones');
  assert.ok(st.every((x) => x.title.includes(gal[st.indexOf(x)].name)));
  assert.equal(stationOf(gal[0], 'coal', 7).sell, 1, 'ORIGEN: precios de siempre');
  for (const s of gal.filter((x) => ownerOf(x) === 'pir')) assert.ok(['black', 'mining'].includes(stationOf(s, 'pir', 7).kind));
  assert.notEqual(sysLore(gal[1], 7), sysLore(gal[2], 7));
  assert.equal(sysLore(gal[1], 7), sysLore(gal[1], 7));
});

test('los sectores lejanos no son todos piratas: hay de todo (más piratas cuanto más lejos)', () => {
  const gal = rebuildGalaxy(7, [[1, 0], [2, 0], [3, 0]]);
  const far = gal.filter((s) => s.sec), owners = far.map((s) => ownerOf(s));
  for (const f of ['pir', 'liga', 'coal']) assert.ok(owners.includes(f), f);
});

test('tráfico: se mueve entre la estación, los planetas y las puertas; las patrullas disparan a los piratas', () => {
  const sys = makeSystem(3, { gates: [{ to: 1, name: 'X', ang: 0 }, { to: 2, name: 'Y', ang: 2 }], planets: 3 });
  const rng = makeRng(5);
  assert.deepEqual(trafficMix('pir', 6).filter((k) => k === 'patrol'), [], 'en un sistema pirata no hay patrullas');
  const list = spawnTraffic(rng, sys, 'liga', 1);
  assert.ok(list.length >= 3 && list.some((n) => n.kind === 'patrol'));
  const p0 = list.map((n) => ({ ...n.pos }));
  const pirate = { pos: { ...list.find((n) => n.kind === 'patrol').pos, x: list.find((n) => n.kind === 'patrol').pos.x + 300 }, alive: true };
  let hits = 0;
  for (let i = 0; i < 300; i++) updateTraffic(rng, sys, list, [pirate], 1 / 30, () => { hits++; });
  assert.ok(list.some((n, i) => Math.hypot(n.pos.x - p0[i].x, n.pos.z - p0[i].z) > 50), 'se mueven');
  assert.ok(hits > 0, 'la patrulla dispara al pirata');
  // el chivatazo: el sitio que mejor paga lo que llevas
  const r = rumor([{ id: 1, p: { iron: 10 } }, { id: 2, p: { iron: 14 } }], { iron: 5 }, ['A', 'B', 'C']);
  assert.equal(r.sys, 2);
  assert.equal(r.name, 'C');
});

test('la galaxia se mueve sola: la frontera Liga/Coalición cambia y los rivales viajan y suben de nivel', () => {
  const save = fresh(), gal = genGalaxy(7);
  const before = gal.map((s) => ownerOf(s, worldTerritory(save)));
  for (let j = 1; j <= FRONT_FIRST + FRONT_EVERY * 4; j++) tickWorld(save, gal, j);
  const after = gal.map((s) => ownerOf(s, worldTerritory(save)));
  assert.ok(after.some((o, i) => o !== before[i] && ['liga', 'coal'].includes(o) && ['liga', 'coal'].includes(before[i])), 'algún sistema cambió de manos');
  assert.ok(save.galaxy && world(save).news.length > 0);
  const rv = Object.values(world(save).rivals);
  assert.ok(rv.length >= 3);
  for (let j = 50; j <= 400; j++) tickWorld(save, gal, j);
  assert.ok(Object.values(world(save).rivals).some((x) => x.lvl > 1), 'los rivales suben de nivel');
  // ORIGEN nunca cambia de manos
  assert.equal(ownerOf(gal[0], worldTerritory(save)), 'coal');
});
