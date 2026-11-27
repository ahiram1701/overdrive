// Balance de Pecios: tiene que costar. Con el bot (que esquiva peor que una persona) medimos lo que da una partida
// y comprobamos que el taller no se compra en un par de tardes y que lo hondo pega de verdad más fuerte
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRun, updateRun, botInput, botOffer, takeOffer, chooseExit, useAbility, dash, useCons, keptPiezas, WORKSHOP, foeDmgUp, ENEMY, piezasMul, PIEZAS_MUL_MAX, shopCost } from '../../js/pecio.js';

const DT = 1 / 30;
function play(seed, hp) {
  const s = newRun(seed, { hp, ability: 'nova' });
  for (let i = 0; i < 30 * 60 * 20 && !s.over; i++) {
    if (s.offer) takeOffer(s, botOffer(s));
    if (s.choice) chooseExit(s, 'leave');
    const inp = botInput(s);
    if (inp.ability) useAbility(s);
    if (inp.dash) dash(s);
    if (inp.cons) useCons(s, inp.cons);
    updateRun(s, DT, inp);
  }
  return { depth: s.depth, found: s.found, kept: keptPiezas(s) };
}
const median = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
const runs = (hp) => Array.from({ length: 8 }, (_, i) => play(i + 1, hp));

test('una partida de veterano da 🔩 con mesura y el taller entero cuesta muchas partidas', () => {
  const r = runs(10);
  const found = median(r.map((x) => x.found)), kept = median(r.map((x) => x.kept));
  assert.ok(found >= 120 && found <= 900, `🔩 encontradas (mediana): ${found}`);
  const total = WORKSHOP.reduce((a, w) => a + w.cost.reduce((x, y) => x + y, 0), 0);
  assert.ok(total >= 10 * kept, `taller ${total} 🔩 vs ${kept} por partida`);
});

test('con la nave básica no se llega lejos sin jugar bien', () => {
  const r = runs(6);
  const avg = r.reduce((a, x) => a + x.depth, 0) / r.length;
  assert.ok(avg >= 2 && avg < 5, `planta media: ${avg.toFixed(2)}`);
});

test('lo hondo pega más: en la planta 8 un dron hace al menos el doble que en la 1', () => {
  const d = ENEMY.drone.dmg;
  assert.ok(d + foeDmgUp(8, 0) >= 2 * (d + foeDmgUp(1, 0)));
  assert.ok(foeDmgUp(8, 8) > foeDmgUp(8, 0), 'y la PROFUNDIDAD suma');
});

test('los bonus de 🔩 no se disparan: rendimiento decreciente y tope', () => {
  assert.equal(piezasMul({}, {}, { magnet: 40 }), 1.4);
  assert.ok(piezasMul({}, {}, { magnet: 75, greed: 90, setPiezas: 70 }) < 2.5);
  assert.equal(piezasMul({ event: 'gold', curse: 'dark' }, {}, { magnet: 75, greed: 90 }), PIEZAS_MUL_MAX);
});

test('la tienda cuesta: precios con la planta y la reparación se encarece si repites', () => {
  const s = newRun(1);
  s.depth = 6;
  const r0 = shopCost(s, 'repair');
  assert.ok(r0 >= 25, `reparar en la 6: ${r0}`);
  s.repairs = { 6: 2 };
  assert.ok(shopCost(s, 'repair') > r0);
  assert.ok(shopCost(s, 'box') >= 70);
});
