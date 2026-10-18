import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genGalaxy, route } from '../../js/galaxy.js';
import { badgesFor, MAX_BADGES, routeToll, placeLabels, dangerColor, DANGER_COLORS } from '../../js/galmap.js';
import { tollFor } from '../../js/market.js';

const gal = genGalaxy();

test('insignias: por prioridad, como mucho 4 (+n) y las capas las ocultan', () => {
  const ctx = { story: 3, missions: [3], bounty: 3, war: 3, swarm: [3], pirates: new Set([3]), outposts: new Set([3]), home: 3 };
  const all = badgesFor(3, ctx, {});
  assert.equal(all.shown.length, MAX_BADGES);
  assert.deepEqual(all.shown, ['story', 'mission', 'bounty', 'war']);
  assert.equal(all.more, 4);
  const noObj = badgesFor(3, ctx, { obj: false });
  assert.ok(!noObj.shown.includes('story') && noObj.shown.includes('war'));
  assert.deepEqual(badgesFor(9, ctx, {}).shown, [], 'otro sistema, nada');
  assert.equal(dangerColor(0), DANGER_COLORS[0]);
  assert.equal(dangerColor(99), DANGER_COLORS[6]);
});

test('ruta: el peaje suma el de cada sistema al que saltas (el Salto Mk 6+ lo abarata)', () => {
  const path = route(gal, 0, 11);
  const full = path.slice(1).reduce((a, id) => a + tollFor(gal[id].danger), 0);
  assert.equal(routeToll(gal, path, 0), full);
  assert.ok(routeToll(gal, path, 8) < full);
  assert.equal(routeToll(gal, [0], 0), 0);
});

test('nombres: nunca se pisan; los importantes nunca se ocultan', () => {
  const nodes = [
    { id: 1, x: 100, y: 100, name: 'LARGUÍSIMO', keep: false },
    { id: 2, x: 104, y: 102, name: 'PEGADO', keep: true },
    { id: 3, x: 108, y: 98, name: 'OTRO', keep: false },
    { id: 4, x: 400, y: 400, name: 'LEJOS', keep: false },
  ];
  const out = placeLabels(nodes, 1);
  const vis = out.filter((l) => !l.hidden);
  for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
    const a = vis[i].box, b = vis[j].box;
    assert.ok(!(a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0), `${vis[i].id} y ${vis[j].id} se pisan`);
  }
  assert.ok(!out.find((l) => l.id === 2).hidden, 'el importante, siempre');
  assert.ok(!out.find((l) => l.id === 4).hidden);
});
