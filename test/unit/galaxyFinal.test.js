// GALAXIA · objetivo a largo plazo: las elecciones cuentan (bando, Acto III, final y nave), campañas de facción,
// chasis exclusivos y equipo de facción
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genGalaxy } from '../../js/galaxy.js';
import { chapters, storyEvent, storyState, currentChapter, alignment, SIDES, ACT_LEN, genChapter } from '../../js/story.js';
import { CAMPAIGNS, CAMP_LEN, campaignStep, campaignEvent, acceptCampaign, campOpen, campDone, activeCampaign, ownerOf } from '../../js/factions.js';
import { CHASSIS } from '../../js/galaxyData.js';
import { GEAR, canCraft, gearAllowed } from '../../js/crafting.js';
import { loadFrom } from '../../js/save.js';

const gal = genGalaxy();

// juega la historia entera eligiendo `picks` (una por acto)
function playStory(picks) {
  const s = loadFrom(null);
  for (let i = 0; i < 3 * ACT_LEN; i++) {
    const c = currentChapter(s, gal), g = c.goal;
    let done = null;
    for (let k = 0; k < g.n; k++) done = storyEvent(s, gal, { type: g.kind, sys: g.sys, boss: g.boss, pick: picks[c.act - 1] });
    assert.equal(done?.title, c.title);
  }
  return s;
}

test('las elecciones cuentan: cada bando cambia el Acto III, el final y la nave', () => {
  const seen = {};
  for (const [picks, side] of [[['liga', 'liga', 'coal'], 'liga'], [['coal', 'coal', 'liga'], 'coal'], [['free', 'liga', 'free'], 'free']]) {
    const s = playStory(picks);
    assert.equal(alignment(s), side);
    assert.equal(storyState(s).ending, side);
    const ch = chapters(gal, side);
    seen[side] = ch[3 * ACT_LEN - 2];
    const last = ch[3 * ACT_LEN - 1];
    assert.equal(last.reward.chassis, 'errante2');
    assert.ok(CHASSIS[last.reward.chassis2]?.faction, 'y la nave de su bando');
    assert.ok(SIDES[side]);
  }
  assert.equal(new Set(Object.values(seen).map((c) => c.title)).size, 3, 'tres capítulos 7 distintos');
  assert.equal(seen.coal.goal.boss, 'queen', 'con la Coalición, la Reina renacida');
  // las tres decisiones tienen la opción «por tu cuenta»
  const choices = chapters(gal).filter((c) => c.choice);
  assert.equal(choices.length, 3);
  for (const c of choices) assert.ok(c.choice.some(([k]) => k === 'free'));
});

test('empate de bando: manda la última elección', () => {
  const s = loadFrom(null);
  storyState(s).choices = { 1: 'liga', 2: 'coal', 3: 'free' };
  storyState(s).choice = 'free';
  assert.equal(alignment(s), 'free');
  assert.equal(alignment(loadFrom(null)), null);
});

test('la Crónica también trae de vuelta al Devorador', () => {
  const bosses = new Set();
  for (let i = 0; i < 30; i++) { const c = genChapter(gal, i); if (c.goal.kind === 'boss') bosses.add(c.goal.boss); }
  assert.deepEqual([...bosses].sort(), ['devourer', 'herald', 'queen']);
});

test('campañas de facción: 5 encargos válidos, se abren con reputación y acaban en su chasis', () => {
  for (const f of Object.keys(CAMPAIGNS)) {
    for (let i = 0; i < CAMP_LEN; i++) {
      const st = campaignStep(gal, f, i);
      assert.ok(gal[st.sys], `${f} ${i}: sistema válido`);
      if (['dock', 'sell'].includes(st.kind)) assert.notEqual(ownerOf(gal[st.sys]), 'pir', 'no te dejan atracar en un sistema pirata');
      if (st.kind === 'base') assert.equal(ownerOf(gal[st.sys]), 'pir');
      assert.deepEqual(campaignStep(gal, f, i), st, 'determinista');
    }
    assert.ok(CHASSIS[CAMPAIGNS[f].chassis].faction === f);
  }
  const s = loadFrom(null);
  assert.ok(!campOpen(s, 'liga'));
  assert.ok(!acceptCampaign(s, 'liga'));
  s.factionRep.liga = 25;
  assert.ok(acceptCampaign(s, 'liga'));
  for (let i = 0; i < CAMP_LEN; i++) {
    const st = activeCampaign(s, gal);
    assert.equal(st.i, i);
    let done = null;
    for (let k = 0; k < st.n; k++) done = campaignEvent(s, gal, { type: st.kind, sys: st.sys });
    assert.equal(done?.i, i);
    assert.equal(done.last, i === CAMP_LEN - 1);
  }
  assert.ok(campDone(s, 'liga'));
  assert.equal(activeCampaign(s, gal), null);
  assert.ok(!acceptCampaign(s, 'liga'), 'no se repite');
  // la de Vex: con reputación pirata o eligiendo ir por tu cuenta
  const s2 = loadFrom(null);
  assert.ok(!campOpen(s2, 'pir'));
  storyState(s2).choices = { 1: 'free' };
  assert.ok(campOpen(s2, 'pir'));
});

test('chasis exclusivos: no se venden; equipo de facción: pide reputación', () => {
  for (const id of ['minero', 'centinela', 'saqueador']) assert.ok(CHASSIS[id].faction && CHASSIS[id].cost === 0);
  const fg = Object.entries(GEAR).filter(([, g]) => g.faction);
  assert.equal(fg.length, 6);
  assert.deepEqual([...new Set(fg.map(([, g]) => g.faction))].sort(), ['coal', 'liga', 'pir']);
  const s = loadFrom(null);
  s.galaxy.credits = 1e6;
  s.galaxyMats = { chatarra: 99, circuitos: 99, nucleos: 99, artefactos: 99 };
  assert.ok(!gearAllowed(s, 'ligaHold') && !canCraft(s, 'ligaHold'));
  s.factionRep.liga = 25;
  assert.ok(gearAllowed(s, 'ligaHold') && canCraft(s, 'ligaHold'));
  assert.ok(!gearAllowed(s, 'ligaHull'), 'el de Aliado aún no');
  s.factionRep.liga = 70;
  assert.ok(canCraft(s, 'ligaHull'));
});
