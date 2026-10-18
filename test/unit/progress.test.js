import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFrom } from '../../js/save.js';
import { xpForRun, xpToNext, rankOf, addXp, rankGems, MAX_RANK, ACHIEVEMENTS, trackAch, achCount, codexAdd } from '../../js/progress.js';

const fresh = () => loadFrom(null);

test('la XP para subir crece con el rango y rankOf es coherente', () => {
  for (let r = 1; r < MAX_RANK; r++) assert.ok(xpToNext(r + 1) > xpToNext(r));
  assert.deepEqual(rankOf(0), { rank: 1, into: 0, need: xpToNext(1) });
  assert.equal(rankOf(xpToNext(1)).rank, 2);
  assert.equal(rankOf(xpToNext(1) - 1).rank, 1);
  assert.equal(rankOf(1e12).rank, MAX_RANK);
});

test('addXp paga cada rango una sola vez, aunque se suban varios de golpe', () => {
  const s = fresh();
  const ups = addXp(s, xpToNext(1) + xpToNext(2) + xpToNext(3));
  assert.deepEqual(ups.map((u) => u.rank), [2, 3, 4]);
  assert.equal(s.gems, rankGems(2) + rankGems(3) + rankGems(4));
  assert.deepEqual(addXp(s, 1), []);
  assert.equal(s.gems, rankGems(2) + rankGems(3) + rankGems(4));
});

test('las gemas de todos los rangos no rompen la economía (≤ 1500)', () => {
  let total = 0;
  for (let r = 2; r <= MAX_RANK; r++) total += rankGems(r);
  assert.ok(total <= 1500, `${total}`);
});

test('una partida normal da XP razonable', () => {
  const xp = xpForRun({ dist: 3000, near: 40, section: 3, bosses: 1, missionsDone: 0 });
  assert.ok(xp > 150 && xp < 1000, `${xp}`);
});

test('logros: ~30, ids únicos, sum/best y se pagan una vez', () => {
  assert.ok(ACHIEVEMENTS.length >= 30);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  const s = fresh();
  for (let i = 0; i < 99; i++) assert.deepEqual(trackAch(s, 'near', 1), []);
  const got = trackAch(s, 'near', 1);
  assert.deepEqual(got.map((a) => a.id), ['near100']);
  const gems = s.gems;
  trackAch(s, 'speed', 1300);
  trackAch(s, 'speed', 500);
  assert.equal(s.ach.mach1.done, true);
  assert.equal(s.ach.mach2.p, 1300, 'best no baja');
  assert.ok(s.gems > gems);
  assert.equal(achCount(s), 2);
});

test('el progreso de logros y la colección sobreviven a guardar y cargar', () => {
  const s = fresh();
  trackAch(s, 'boss', 1);
  assert.equal(codexAdd(s, 'cards', 'iman'), true);
  assert.equal(codexAdd(s, 'cards', 'iman'), false);
  const again = loadFrom(JSON.stringify(s));
  assert.equal(again.ach.boss1.done, true);
  assert.equal(again.codex.cards.iman, 2);
});

test('cada logro da un estilo exclusivo, único, válido y para todas las naves', async () => {
  const { ACH_STYLES, achStyle, GROUPS, isUnlocked, equip, equipped } = await import('../../js/cosmetics.js');
  const { loadFrom } = await import('../../js/save.js');
  assert.equal(ACH_STYLES.length, ACHIEVEMENTS.length);
  assert.equal(new Set(ACH_STYLES.map((x) => x.id)).size, ACH_STYLES.length);
  for (const a of ACHIEVEMENTS) {
    const it = achStyle(a.id);
    assert.ok(it && GROUPS[it.group].includes(it), a.id);
    assert.ok(!it.ship, 'para todas las naves');
    for (const c of [it.color, it.edge, it.glow, it.hull].filter(Boolean)) assert.match(c, /^#[0-9a-f]{6}$/, `${a.id}: ${c}`);
  }
  const s = loadFrom(null);
  const it = achStyle('boss1');
  assert.equal(isUnlocked(it, s, 'viper'), false);
  trackAch(s, 'boss', 1);
  assert.ok(isUnlocked(it, s, 'viper') && isUnlocked(it, s, 'titan'));
  assert.ok(equip(it.group, it.id, s, 'titan'));
  assert.equal(equipped(s, 'titan')[it.group].id, it.id);
});
