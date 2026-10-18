import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genGalaxy } from '../../js/galaxy.js';
import { loadFrom } from '../../js/save.js';
import { GEAR, MATS, SLOTS, addMat, canCraft, craft, equipGear, gear, hasGear, dropsOf } from '../../js/crafting.js';
import { chapters, storySystems, storyEvent, storyState, currentChapter, storyDone, CAST, ACT_LEN, chapterLabel } from '../../js/story.js';

const gal = genGalaxy();

test('fabricar: cuesta créditos y materiales, se monta solo y respeta los huecos', () => {
  const s = loadFrom(null);
  assert.equal(canCraft(s, 'laser2'), false, 'sin nada no se fabrica');
  s.galaxy.credits = 1e5;
  for (const k of Object.keys(MATS)) addMat(s, k, 50);
  assert.ok(craft(s, 'laser2'));
  assert.equal(craft(s, 'laser2'), false, 'una vez');
  assert.equal(s.galaxy.credits, 1e5 - GEAR.laser2.cost.credits);
  assert.equal(s.galaxyMats.chatarra, 50 - GEAR.laser2.cost.chatarra);
  assert.ok(hasGear(s, 'laser2'), 'se monta al fabricarlo');
  assert.ok(craft(s, 'flak') && craft(s, 'plasma'));
  assert.equal(gear(s).w.length, SLOTS.w, 'como mucho 2 armas montadas');
  assert.ok(!hasGear(s, 'laser2') || !hasGear(s, 'flak') || !hasGear(s, 'plasma'));
  equipGear(s, 'plasma');
  assert.equal(hasGear(s, 'plasma'), false, 'tocar lo montado lo desmonta');
  for (const id of Object.keys(GEAR)) assert.ok(['w', 'm'].includes(GEAR[id].slot));
  assert.ok(dropsOf('base', { base: true }).nucleos > 0 && dropsOf('drone').circuitos > 0);
});

test('historia: actos de 8 capítulos, sistemas cada vez más lejos y que se puede acabar', () => {
  const chs = chapters(gal);
  assert.equal(chs.length, 2 * ACT_LEN);
  assert.deepEqual([...new Set(chs.map((c) => c.act))], [1, 2]);
  for (const c of chs) if (c.goal.sys !== undefined) assert.ok(gal[c.goal.sys], `${c.title}: sistema válido`);
  const S = storySystems(gal);
  assert.ok(gal[S.a].danger < gal[S.c].danger && gal[S.c].danger < gal[S.f].danger);
  for (const c of chs) for (const [who] of [...c.intro, ...c.outro]) assert.ok(CAST[who], who);
  const s = loadFrom(null);
  // nada que no sea su objetivo hace avanzar
  assert.equal(storyEvent(s, gal, { type: 'kill', sys: 0 }), null);
  for (const c of chs) {
    assert.equal(currentChapter(s, gal).title, c.title);
    const g = c.goal;
    let done = null;
    for (let i = 0; i < g.n; i++) done = storyEvent(s, gal, { type: g.kind, sys: g.sys, boss: g.boss, pick: 'liga' });
    assert.equal(done?.title, c.title, `completa ${c.title}`);
  }
  assert.ok(storyDone(s, gal));
  assert.equal(storyState(s).choice, 'liga');
  assert.equal(chs[ACT_LEN - 1].reward.ship, 'wanderer');
  assert.equal(chs[2 * ACT_LEN - 1].goal.boss, 'queen');
  assert.equal(chs[2 * ACT_LEN - 1].end, 'act2');
});

test('historia: el Acto II usa otros sistemas, se nombra "Acto II · n/8" y vender cuenta por unidades', () => {
  const A1 = storySystems(gal, 1), A2 = storySystems(gal, 2);
  assert.notDeepEqual([A1.a, A1.b, A1.c], [A2.a, A2.b, A2.c], 'sistemas distintos');
  const s = loadFrom(null);
  storyState(s).ch = ACT_LEN; // partida que ya acabó el Acto I
  assert.equal(chapterLabel(s), 'Acto II · 1/8');
  assert.equal(currentChapter(s, gal).act, 2);
  const sell = chapters(gal).findIndex((c) => c.goal.kind === 'sell');
  storyState(s).ch = sell;
  const g = currentChapter(s, gal).goal;
  assert.equal(storyEvent(s, gal, { type: 'sell', sys: g.sys, amount: 12 }), null);
  assert.equal(storyState(s).n, 12);
  assert.ok(storyEvent(s, gal, { type: 'sell', sys: g.sys, amount: 9 }), 'con 21 ≥ 20 se completa');
  assert.equal(storyEvent(s, gal, { type: 'reach', sys: 0 }), null, 'lo de otro capítulo no cuenta');
});
