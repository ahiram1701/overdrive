import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genGalaxy, rebuildGalaxy, sectorOre } from '../../js/galaxy.js';
import { ORES, BASE_ORES } from '../../js/galaxyData.js';
import { GOODS, TRADE, goodSellMul, makes, needs, stockOf, takeStock, regenStock, stockMul, STOCK_MAX, MAKE_SELL, NEED_SELL } from '../../js/goods.js';
import { tickWorld, world, worldTerritory, tickMinute, rivalMeet, REP_EVERY, PIRATE_FIRST, PIRATE_EVERY } from '../../js/galaxyWorld.js';
import { ownerOf } from '../../js/factions.js';
import { npcHp, npcLoot, escortReward } from '../../js/galaxyTraffic.js';
import { shareCost, shareIncome, buyShare, tickShares, collectShares, sharesOwned, chartCost, GAL_PAINTS, buyPaint } from '../../js/fleet.js';
import { PALETTES, isUnlocked } from '../../js/cosmetics.js';

test('la galaxia de siempre no cambia con lo nuevo: mismos jefes, misma estrella y precios de siempre', () => {
  const g = genGalaxy(7);
  // (el núcleo solo usa los 4 minerales de siempre; lo nuevo tiene su propio azar)
  assert.deepEqual(BASE_ORES, ['iron', 'crystal', 'plasma', 'dark']);
  for (const s of g) {
    assert.ok(BASE_ORES.includes(s.ore));
    for (const k of Object.keys(ORES)) assert.ok(s.prices[k] > 0, `${s.name}: precio de ${k}`);
  }
});

test('sectores lejanos: minerales nuevos (exótico y del vacío), más valiosos', () => {
  assert.equal(sectorOre(9), 'exotic');
  assert.equal(sectorOre(14), 'void');
  assert.equal(sectorOre(3), 'crystal');
  assert.ok(ORES.void.price > ORES.exotic.price && ORES.exotic.price > ORES.dark.price);
  const g = rebuildGalaxy(7, [[1, 0], [2, 0], [3, 0], [4, 0]]);
  const ores = new Set(g.filter((s) => s.sec).map((s) => s.ore));
  assert.ok(ores.has('exotic') && ores.has('void'));
});

test('mercancías: cada estación fabrica unas (las paga poco) y necesita otras (las paga bien); los sucesos las mueven', () => {
  assert.equal(GOODS.length, 4);
  for (const g of GOODS) assert.ok(ORES[g]?.good, g);
  for (const [kind, t] of Object.entries(TRADE)) for (const k of t.make) assert.ok(!t.need.includes(k), `${kind} no fabrica y necesita lo mismo`);
  assert.equal(goodSellMul('trade', 'food'), MAKE_SELL);
  assert.equal(goodSellMul('trade', 'machines'), NEED_SELL);
  assert.ok(goodSellMul('mining', 'machines', { war: true }) > goodSellMul('mining', 'machines'));
  assert.ok(goodSellMul('trade', 'medicine', { swarm: true }) > goodSellMul('trade', 'medicine'));
  assert.ok(goodSellMul('black', 'contraband') > goodSellMul('trade', 'contraband') * 2, 'el contrabando, solo bien pagado en el mercado negro');
  assert.equal(goodSellMul('trade', 'iron'), 1);
  // hay rutas: lo que uno fabrica, otro lo necesita
  for (const k of ['food', 'machines', 'medicine']) assert.ok(Object.keys(TRADE).some((a) => makes(a, k)) && Object.keys(TRADE).some((b) => needs(b, k)), k);
});

test('stock: se agota al comprar (y sube el precio) y se repone con el tiempo', () => {
  const save = {};
  assert.equal(stockOf(save, 3, 'food'), STOCK_MAX);
  takeStock(save, 3, 'food', 50);
  assert.equal(stockOf(save, 3, 'food'), STOCK_MAX - 50);
  assert.ok(stockMul(stockOf(save, 3, 'food')) > stockMul(STOCK_MAX));
  regenStock(save, 30);
  assert.equal(stockOf(save, 3, 'food'), STOCK_MAX - 20);
  regenStock(save, 100);
  assert.equal(stockOf(save, 3, 'food'), STOCK_MAX);
});

test('el mundo se mueve: los piratas toman o sueltan sistemas, la reputación se enfría y el tiempo corre en vuelo', () => {
  const save = { galaxy: {}, territory: {}, factionRep: { liga: 80, coal: -60, pir: 10 } }, gal = genGalaxy(7);
  const before = gal.map((s) => ownerOf(s, worldTerritory(save)));
  for (let j = 1; j <= PIRATE_FIRST + PIRATE_EVERY * 3; j++) tickWorld(save, gal, j);
  const after = gal.map((s) => ownerOf(s, worldTerritory(save)));
  assert.ok(after.some((o, i) => (o === 'pir') !== (before[i] === 'pir')), 'algún sistema pasó a (o dejó de ser) pirata');
  assert.ok(world(save).news.some((n) => /piratas (toman|abandonan)/.test(n.text)));
  const jumps = PIRATE_FIRST + PIRATE_EVERY * 3;
  assert.equal(save.factionRep.liga, 80 - Math.floor(jumps / REP_EVERY), 'la reputación alta baja despacio');
  assert.equal(save.factionRep.coal, -60 + Math.floor(jumps / REP_EVERY));
  assert.equal(save.factionRep.pir, 10, 'la que está cerca de 0 no cambia');
  // un minuto de vuelo mueve a un rival
  const st = Object.values(world(save).rivals)[0], id = Object.keys(world(save).rivals)[0];
  const w0 = st.wealth;
  for (let n = 0; n < 12; n++) tickMinute(save, gal, n);
  assert.ok(st.wealth > w0);
  assert.equal(rivalMeet(save, id).rel, 1);
  assert.equal(rivalMeet(save, id).rel, 2);
});

test('asaltar y escoltar: los civiles tienen vida, sueltan botín y cuestan búsqueda; escoltar paga', () => {
  assert.ok(npcHp('patrol', 3) > npcHp('trader', 3));
  const tr = npcLoot('trader', 4), pa = npcLoot('patrol', 4), sm = npcLoot('smuggler', 4);
  assert.ok(tr.credits > 0 && tr.wanted === 1 && tr.rep < 0);
  assert.ok(pa.wanted > tr.wanted, 'derribar una patrulla, peor');
  assert.equal(sm.rep, 0);
  assert.ok(sm.contraband > 0);
  assert.ok(escortReward(5) > escortReward(1));
});

test('acciones, cartas y pinturas: más gastos que no se acaban', () => {
  for (let n = 0; n < 20; n++) assert.ok(shareCost(n + 1) > shareCost(n));
  for (let n = 0; n < 20; n++) assert.ok(chartCost(n + 1) > chartCost(n));
  const save = { galaxy: { credits: 1e6 }, crates: { owned: [] } }, gal = genGalaxy(7);
  assert.ok(buyShare(save, 3) && buyShare(save, 3) && buyShare(save, 5));
  assert.equal(sharesOwned(save), 3);
  const per = tickShares(save, gal);
  assert.equal(per, 2 * shareIncome(gal[3].danger) + shareIncome(gal[5].danger));
  const c0 = save.galaxy.credits;
  assert.equal(collectShares(save), per);
  assert.equal(save.galaxy.credits, c0 + per);
  for (const P of GAL_PAINTS) {
    const pal = PALETTES.find((x) => x.id === P.id);
    assert.ok(pal && !isUnlocked(pal, save));
    assert.ok(buyPaint(save, P.id));
    assert.ok(isUnlocked(pal, save));
    assert.ok(!buyPaint(save, P.id), 'no se compra dos veces');
  }
});

test('el stock, la flota y la exploración se guardan y vuelven al cargar', async () => {
  const { loadFrom } = await import('../../js/save.js');
  const s = loadFrom(null);
  s.galaxyStock = { 0: { food: 12 } };
  s.galaxyFleet.crew.pilot = 3;
  s.galaxy.charted = [40, 41];
  s.galaxy.cargo.medicine = 7;
  const back = loadFrom(JSON.stringify(s));
  assert.equal(back.galaxyStock[0].food, 12);
  assert.equal(back.galaxyFleet.crew.pilot, 3);
  assert.deepEqual(back.galaxy.charted, [40, 41]);
  assert.equal(back.galaxy.cargo.medicine, 7);
});
