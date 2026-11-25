// GALAXIA · exploración: anomalías nuevas, 40 textos del Atlas sin repetir, mejoras del Atlas, 8 planetas,
// y lo oculto fuera de la historia, las campañas y las misiones
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genGalaxy, mainSystems } from '../../js/galaxy.js';
import { loadFrom } from '../../js/save.js';
import { POI_KINDS, LORE, loreOf, poisOf, ATLAS_PERKS, perksFor, allPois } from '../../js/galaxyMissions.js';
import { planetInfo } from '../../js/galaxyEvents.js';
import { chapters, genChapter, storySystems } from '../../js/story.js';
import { campaignStep, CAMPAIGNS, CAMP_LEN, bountyBoard, pirateSystemsTotal } from '../../js/factions.js';

const gal = genGalaxy();

test('Atlas: 40 textos distintos; cada descubrimiento nuevo cuenta el siguiente', () => {
  assert.equal(LORE.length, 40);
  assert.equal(new Set(LORE).size, 40);
  const p = { id: 'x', lore: 'antiguo' };
  assert.equal(loreOf({ x: true }, p), 'antiguo', 'los descubiertos antes conservan su texto');
  assert.equal(loreOf({ x: 1 }, p), LORE[0]);
  assert.equal(loreOf({ x: 41 }, p), LORE[0]);
  assert.equal(loreOf({ x: 7 }, p), LORE[6]);
});

test('anomalías: 4 nuevas con su efecto, solo desde su peligro', () => {
  const news = Object.entries(POI_KINDS).filter(([, k]) => k.effect);
  assert.equal(news.length, 4);
  assert.deepEqual(news.map(([, k]) => k.effect).sort(), ['ambush', 'credits', 'gear', 'ore']);
  const seen = new Set();
  for (const s of gal) {
    for (const poi of poisOf(gal, s.id)) {
      const K = POI_KINDS[poi.kind];
      if (K.from) assert.ok(s.danger >= K.from, `${poi.kind} en peligro ${s.danger}`);
      seen.add(poi.kind);
    }
  }
  assert.ok(news.filter(([k]) => seen.has(k)).length >= 3, 'salen en la galaxia');
  assert.ok(allPois(gal).length >= 40, 'hay de sobra para las 40 líneas');
});

test('mejoras del Atlas: hasta 40 descubrimientos y sin duplicar el Motor de curvatura', () => {
  assert.equal(ATLAS_PERKS.length, 6);
  assert.equal(Math.max(...ATLAS_PERKS.map((p) => p.n)), 40);
  assert.ok(!ATLAS_PERKS.some((p) => p.id === 'warp'));
  assert.deepEqual(perksFor(3), ['scanner']);
  assert.equal(perksFor(40).length, 6);
});

test('planetas: 8 tipos', () => {
  const types = new Set(Array.from({ length: 8 }, (_, i) => planetInfo(1, i, 'X', 2).type));
  assert.equal(types.size, 8);
});

test('lo oculto no entra en la historia, las campañas ni los carteles', () => {
  const hidden = new Set(gal.filter((s) => s.hidden).map((s) => s.id));
  assert.equal(hidden.size, 5);
  for (const c of chapters(gal, 'liga')) if (c.goal.sys !== undefined) assert.ok(!hidden.has(c.goal.sys), c.title);
  for (let i = 0; i < 40; i++) assert.ok(!hidden.has(genChapter(gal, i).goal.sys));
  for (const a of [1, 2, 3]) for (const id of Object.values(storySystems(gal, a))) assert.ok(!hidden.has(id));
  for (const f of Object.keys(CAMPAIGNS)) for (let i = 0; i < CAMP_LEN; i++) assert.ok(!hidden.has(campaignStep(gal, f, i).sys));
  for (let seq = 0; seq < 20; seq++) for (const b of bountyBoard(gal, 0, seq)) assert.ok(!hidden.has(b.sys));
  assert.equal(pirateSystemsTotal(gal), pirateSystemsTotal(mainSystems(gal)));
});

test('la semilla y el ciclo de la galaxia se conservan al cargar la partida', () => {
  const s = loadFrom(JSON.stringify({ v: 6, galaxy: { started: true, seed: 12345, cycle: 2 } }));
  assert.equal(s.galaxy.seed, 12345);
  assert.equal(s.galaxy.cycle, 2);
  assert.equal(loadFrom(null).galaxy.seed, null);
});
