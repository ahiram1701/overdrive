import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFrom } from '../../js/save.js';
import { BOSS_BY_ID, makeElite, bossHp } from '../../js/bosses.js';
import { cleanMods } from '../../js/modifiers.js';
import {
  SECTORS, LEVELS, LEVEL_BY_ID, MAX_STARS, levelStars, recordResult, totalStars, isSectorOpen, isLevelOpen, nextLevel,
  sectorAt, levelById, frontier, visibleSectors, ELITE_FROM,
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
  assert.equal(nextLevel('4-4').id, '5-1', 'tras el último sector fijo empiezan los generados');
});

test('sectores generados: deterministas, 4 niveles, más difíciles y sin fin', () => {
  for (const n of [5, 6, 9, 30, 200]) {
    const a = sectorAt(n), b = sectorAt(n);
    assert.equal(a, b);
    assert.equal(a.levels.length, 4);
    assert.ok(a.name.length > 4);
    assert.deepEqual(a.levels.map((l) => l.id), [1, 2, 3, 4].map((k) => `${n}-${k}`));
    const boss = a.levels[3];
    assert.ok(BOSS_BY_ID[boss.boss]);
    assert.equal(!!boss.elite, n >= ELITE_FROM && n % 2 === 0, `sector ${n}: élite`);
    for (const l of a.levels.slice(0, 3)) {
      assert.ok(l.sections >= 2 && l.sections <= 5);
      assert.ok(l.mods.length >= 1 && l.mods.length <= 2);
      assert.deepEqual(cleanMods(l.mods), l.mods, 'modificadores compatibles');
      assert.ok(!l.mods.includes('bosses'));
      assert.equal(l.stars.length, 3);
      assert.equal(l.stars[0].kind, 'finish');
    }
  }
  assert.ok(sectorAt(20).levels[0].diff > sectorAt(6).levels[0].diff, 'la dificultad crece');
  assert.equal(levelById('17-3').sectorName, sectorAt(17).name);
  assert.equal(levelById('3-9'), null);
  assert.equal(levelById('2-2').id, '2-2', 'los fijos también');
});

test('los sectores generados se abren venciendo al jefe del anterior', () => {
  const s = loadFrom(null);
  const all = [true, true, true];
  for (const l of LEVELS) if (l.id !== '4-4') s.campaign[l.id] = all;
  assert.equal(frontier(s), 4);
  assert.equal(isLevelOpen(s, '5-1'), false);
  s.campaign['4-4'] = all;
  assert.ok(isLevelOpen(s, '5-1'));
  assert.equal(frontier(s), 5);
  assert.equal(visibleSectors(s).length, 6, 'los abiertos y uno más para ver lo que viene');
  assert.equal(isLevelOpen(s, '5-2'), false);
  recordResult(s, '5-1', [true, false, false]);
  assert.ok(isLevelOpen(s, '5-2'));
  assert.ok(totalStars(s) > MAX_STARS, 'las estrellas de los generados también cuentan');
});

test('jefe élite y vida con tope', () => {
  const e = makeElite(BOSS_BY_ID.gusano, 'beam');
  assert.ok(e.elite);
  assert.deepEqual(e.phases[0], e.phases[1]);
  assert.ok(e.phases[0].includes('beam') && e.phases[0].includes('wallRain'));
  assert.equal(bossHp(2), 3);
  assert.equal(bossHp(200), 10);
  assert.equal(bossHp(200, true), 11);
});
