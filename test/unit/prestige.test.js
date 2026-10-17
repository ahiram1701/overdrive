import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFrom } from '../../js/save.js';
import { rankOf, xpToNext, MAX_RANK, canPrestige, doPrestige, prestigeBonus, effectiveRank, addXp, PRESTIGE_REWARDS } from '../../js/progress.js';
import { PALETTES, TRAILS, BOOMS, EMBLEMS, isUnlocked } from '../../js/cosmetics.js';
import { cleanMods, MODS } from '../../js/modifiers.js';

const xpForRank = (rank) => { let x = 0; for (let r = 1; r < rank; r++) x += xpToNext(r); return x; };

test('prestigio: solo en el rango 30; reinicia el rango y conserva lo demás', () => {
  const s = loadFrom(null);
  s.gems = 77;
  s.xp = xpForRank(MAX_RANK - 1);
  assert.equal(canPrestige(s), false);
  assert.equal(doPrestige(s), null);
  s.xp = xpForRank(MAX_RANK);
  assert.equal(rankOf(s.xp).rank, MAX_RANK);
  assert.ok(canPrestige(s));
  const res = doPrestige(s);
  assert.deepEqual(res, { level: 1, reward: PRESTIGE_REWARDS[1], gems: 0 });
  assert.equal(s.xp, 0);
  assert.equal(rankOf(s.xp).rank, 1);
  assert.equal(s.gems, 77, 'las gemas no se tocan');
  assert.equal(loadFrom(JSON.stringify(s)).prestige, 1, 'persiste');
  // los rangos se vuelven a pagar
  assert.ok(addXp(s, xpToNext(1)).length === 1);
});

test('lo desbloqueado por rango no se pierde tras el prestigio', () => {
  const s = loadFrom(null);
  s.xp = xpForRank(MAX_RANK);
  const fireworks = BOOMS.find((b) => b.id === 'fireworks'); // rango 20
  assert.ok(isUnlocked(fireworks, s));
  doPrestige(s);
  assert.equal(effectiveRank(s), MAX_RANK);
  assert.ok(isUnlocked(fireworks, s), 'sigue desbloqueado');
  assert.equal(cleanMods(MODS.map((m) => m.id), effectiveRank(s)).length, MODS.length - 1, 'todos los modificadores (menos el que choca)');
});

test('premios de prestigio y bonus de gemas con tope', () => {
  const s = loadFrom(null);
  const laurel = EMBLEMS.find((e) => e.id === 'laurel');
  const harlequin = PALETTES.find((p) => p.id === 'harlequin');
  const prism = TRAILS.find((t) => t.id === 'prism');
  const singularity = BOOMS.find((b) => b.id === 'singularity');
  assert.equal(isUnlocked(laurel, s), false);
  assert.equal(prestigeBonus(s), 0);
  s.prestige = 2;
  assert.ok(isUnlocked(laurel, s) && isUnlocked(harlequin, s));
  assert.equal(isUnlocked(prism, s), false);
  assert.ok(Math.abs(prestigeBonus(s) - 0.1) < 1e-9);
  s.prestige = 10;
  assert.ok(isUnlocked(singularity, s));
  s.prestige = 40;
  assert.equal(prestigeBonus(s), 0.5, 'tope +50%');
  // sin premio en ese nivel: gemas
  s.xp = xpForRank(MAX_RANK);
  s.prestige = 11;
  const g = s.gems;
  const res = doPrestige(s);
  assert.equal(res.reward, null);
  assert.equal(s.gems, g + res.gems);
  assert.ok(res.gems > 0);
});
