import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFrom } from '../../js/save.js';
import { BOSS_BY_ID } from '../../js/bosses.js';
import {
  SECTORS, LEVELS, LEVEL_BY_ID, MAX_STARS, levelStars, recordResult, totalStars, isSectorOpen, isLevelOpen, nextLevel,
} from '../../js/campaign.js';

test('4 sectores x 4 niveles, ids únicos, 3 estrellas y un jefe al final de cada sector', () => {
  assert.equal(SECTORS.length, 4);
  assert.equal(LEVELS.length, 16);
  assert.equal(MAX_STARS, 48);
  assert.equal(new Set(LEVELS.map((l) => l.id)).size, 16);
  for (const s of SECTORS) {
    assert.equal(s.levels.length, 4);
    const last = s.levels[3];
    assert.ok(BOSS_BY_ID[last.boss], `${last.id}: jefe ${last.boss}`);
    assert.equal(last.stars[0].kind, 'boss');
  }
  for (const l of LEVELS) {
    assert.equal(l.stars.length, 3);
    if (!l.boss) assert.equal(l.stars[0].kind, 'finish');
  }
  // los sectores piden cada vez más estrellas, y siempre alcanzables con los anteriores
  for (let i = 1; i < SECTORS.length; i++) {
    assert.ok(SECTORS[i].need > SECTORS[i - 1].need);
    assert.ok(SECTORS[i].need <= i * 12, 'alcanzable con los sectores previos');
  }
});

test('levelStars evalúa cada objetivo', () => {
  const lv = LEVEL_BY_ID['1-1'];
  assert.deepEqual(levelStars(lv, { finished: true, near: 15, hits: 0 }), [true, true, true]);
  assert.deepEqual(levelStars(lv, { finished: true, near: 3, hits: 2 }), [true, false, false]);
  assert.deepEqual(levelStars(lv, { finished: false, near: 99, hits: 0 }), [false, true, false], 'sin terminar no hay "sin golpes"');
  const boss = LEVEL_BY_ID['1-4'];
  assert.deepEqual(levelStars(boss, { bossDefeated: true, hits: 0, near: 10 }), [true, true, true]);
});

test('recordResult guarda lo mejor, paga una vez y las estrellas nuevas', () => {
  const s = loadFrom(null);
  let res = recordResult(s, '1-1', [true, false, false]);
  assert.equal(res.gems, LEVEL_BY_ID['1-1'].gems + 5);
  res = recordResult(s, '1-1', [true, true, false]);
  assert.equal(res.gems, 5, 'solo la estrella nueva');
  res = recordResult(s, '1-1', [false, false, false]);
  assert.deepEqual(res.stars, [true, true, false], 'nunca se pierden estrellas');
  assert.equal(res.gems, 0);
  assert.equal(totalStars(s), 2);
  assert.deepEqual(loadFrom(JSON.stringify(s)).campaign['1-1'], [true, true, false], 'persiste');
});

test('apertura de niveles y sectores', () => {
  const s = loadFrom(null);
  assert.ok(isLevelOpen(s, '1-1'));
  assert.ok(!isLevelOpen(s, '1-2'), 'hay que superar el anterior');
  recordResult(s, '1-1', [true, false, false]);
  assert.ok(isLevelOpen(s, '1-2'));
  assert.ok(!isSectorOpen(s, 's2'));
  for (const id of ['1-1', '1-2']) recordResult(s, id, [true, true, true]);
  assert.ok(isSectorOpen(s, 's2'), '6 estrellas abren el sector 2');
  assert.equal(nextLevel('1-4').id, '2-1');
  assert.equal(nextLevel('4-4'), null);
});
