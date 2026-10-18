import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFrom } from '../../js/save.js';
import { unitPrice, sellValue, recordSale, recoverMarket, saturation, SAT_MAX, SAT_FREE, RECOVER_SECS, tollFor, ITEMS, ITEM_MAX, buyItem, takeItem, itemCount } from '../../js/market.js';

test('mercado: vender baja el precio, nunca por debajo del 40%, y se recupera volando', () => {
  const s = loadFrom(null);
  const base = 20;
  assert.equal(unitPrice(s, 3, 'iron', base), 20);
  assert.equal(sellValue(s, 3, 'iron', SAT_FREE, base), SAT_FREE * base, 'las primeras, a precio completo');
  const first = sellValue(s, 3, 'iron', 20, base);
  assert.ok(first < 20 * base && first > 20 * base * 0.85, 'a partir de ahí, cada unidad algo menos');
  recordSale(s, 3, 'iron', 20);
  const second = sellValue(s, 3, 'iron', 20, base);
  assert.ok(second < first, 'la segunda venta seguida paga menos');
  recordSale(s, 3, 'iron', 500);
  assert.equal(unitPrice(s, 3, 'iron', base), Math.round(base * (1 - SAT_MAX)), 'tope del −60%');
  assert.equal(unitPrice(s, 4, 'iron', base), 20, 'otra estación no se entera');
  const sat = saturation(s, 3, 'iron');
  recoverMarket(s, RECOVER_SECS * 10);
  assert.equal(saturation(s, 3, 'iron'), sat - 10);
  recoverMarket(s, 1e6);
  assert.equal(unitPrice(s, 3, 'iron', base), 20, 'recuperado del todo');
  assert.deepEqual(s.galaxyMarket, {}, 'sin restos');
});

test('mantenimiento y consumibles: peaje según peligro, tope de 5 y gastar', () => {
  assert.ok(tollFor(6) > tollFor(1) && tollFor(0) > 0);
  const s = loadFrom(null);
  s.galaxy.credits = 10000;
  for (let i = 0; i < ITEM_MAX; i++) assert.ok(buyItem(s, 'repair'));
  assert.equal(buyItem(s, 'repair'), false, 'máximo 5');
  assert.equal(s.galaxy.credits, 10000 - ITEM_MAX * ITEMS.repair.cost);
  assert.ok(buyItem(s, 'beacon', 0.9));
  assert.equal(s.galaxy.credits, 10000 - ITEM_MAX * ITEMS.repair.cost - Math.round(ITEMS.beacon.cost * 0.9), 'descuento de facción');
  assert.ok(takeItem(s, 'repair'));
  assert.equal(itemCount(s, 'repair'), ITEM_MAX - 1);
  assert.equal(takeItem(s, 'mines'), false);
  assert.equal(s.gems, 0, 'todo en créditos');
});
