import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFrom } from '../../js/save.js';
import { genGalaxy } from '../../js/galaxy.js';
import { canCraft, craft, GEAR } from '../../js/crafting.js';
import { recoverMarket, recordSale, saturation } from '../../js/market.js';
import {
  FOUND_COST, MOD_MAX, MODULES, canFound, found, outpostAt, modLvl, modCost, upgradeModule, totalModLevels,
  storeCap, storeUsed, depositAll, withdrawAll, workshopDisc, marketRate, marketBonus, radarSystems,
} from '../../js/outposts.js';

const GAL = genGalaxy();
const rich = () => {
  const s = loadFrom(null);
  s.galaxy.credits = 500000;
  s.territory = { 4: 'coal' };
  return s;
};

test('puestos: solo en sistemas liberados, uno por sistema, cuesta 20K', () => {
  const s = rich();
  assert.equal(canFound(s, 2), false, 'un sistema que no es tuyo');
  assert.equal(found(s, 2), false);
  assert.equal(canFound(s, 4), true);
  assert.ok(found(s, 4, '<b>Mi base</b>'));
  assert.equal(s.galaxy.credits, 500000 - FOUND_COST);
  assert.equal(outpostAt(s, 4).name, 'bMi base/b', 'el nombre se limpia');
  assert.equal(found(s, 4), false, 'no dos en el mismo sistema');
  const poor = loadFrom(null);
  poor.territory = { 4: 'coal' };
  poor.galaxy.credits = FOUND_COST - 1;
  assert.equal(found(poor, 4), false, 'sin créditos no hay puesto');
});

test('puestos: módulos de 3 niveles con coste creciente; sobrevive a guardar y cargar', () => {
  const s = rich();
  found(s, 4);
  for (const id of Object.keys(MODULES)) {
    let last = 0;
    for (let l = 0; l < MOD_MAX; l++) {
      const c = modCost(s, 4, id);
      assert.ok(c > last, `${id} nivel ${l + 1} más caro`);
      last = c;
      assert.ok(upgradeModule(s, 4, id));
    }
    assert.equal(modCost(s, 4, id), null);
    assert.equal(upgradeModule(s, 4, id), false, 'no pasa de 3');
  }
  assert.equal(totalModLevels(s), 15);
  const back = loadFrom(JSON.stringify(s));
  assert.equal(modLvl(back, 4, 'radar'), 3, 'outposts está en MAPS');
});

test('puestos: almacén guarda carga y materiales hasta su capacidad', () => {
  const s = rich();
  found(s, 4);
  assert.equal(depositAll(s, 4), 0, 'sin almacén no guarda');
  upgradeModule(s, 4, 'storage');
  assert.equal(storeCap(s, 4), 100);
  s.galaxy.cargo = { iron: 70 };
  s.galaxyMats = { chatarra: 50 };
  assert.equal(depositAll(s, 4), 100, 'se llena');
  assert.equal(storeUsed(outpostAt(s, 4)), 100);
  assert.equal(s.galaxyMats.chatarra, 20, 'sobra lo que no cabe');
  assert.equal(withdrawAll(s, 4, 10), 30 + 10, 'materiales siempre; carga lo que quepa en la bodega');
  assert.equal(s.galaxy.cargo.iron, 10);
  assert.equal(s.galaxyMats.chatarra, 50);
});

test('puestos: taller abarata fabricar, mercado propio, radar', () => {
  const s = rich();
  found(s, 4);
  assert.equal(workshopDisc(s, 4), 1);
  upgradeModule(s, 4, 'workshop');
  upgradeModule(s, 4, 'workshop');
  assert.equal(workshopDisc(s, 4), 0.7);
  // el taller solo descuenta créditos
  const id = Object.keys(GEAR).find((k) => GEAR[k].cost.credits);
  s.galaxyMats = { chatarra: 999, circuitos: 999, nucleos: 999, cristal: 999 };
  const before = s.galaxy.credits;
  assert.ok(canCraft(s, id, 0.7));
  assert.ok(craft(s, id, 0.7));
  assert.equal(before - s.galaxy.credits, Math.round(GEAR[id].cost.credits * 0.7));

  upgradeModule(s, 4, 'market');
  assert.equal(marketRate(s, 4), 2);
  assert.equal(marketRate(s, 3), 1);
  assert.equal(marketBonus(s, 4), 1.05);
  recordSale(s, 4, 'iron', 40);
  recordSale(s, 3, 'iron', 40);
  recoverMarket(s, 20, (sys) => marketRate(s, sys));
  assert.ok(saturation(s, 4, 'iron') < saturation(s, 3, 'iron'), 'se recupera más rápido');

  assert.equal(radarSystems(s, GAL).size, 0, 'sin radar no revela nada');
  upgradeModule(s, 4, 'radar');
  const r1 = radarSystems(s, GAL);
  assert.ok(r1.has(4) && GAL[4].links.every((l) => r1.has(l)), 'revela los vecinos');
  upgradeModule(s, 4, 'radar');
  assert.ok(radarSystems(s, GAL).size >= r1.size);
});
