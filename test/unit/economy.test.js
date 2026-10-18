import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFrom } from '../../js/save.js';
import { BOOSTS, buyBoost, toggleBoost, takeBoosts, MAX_BOOSTS, TALENTS, buyTalent, hasTalent, nextTalent, CRATES, PITY, rollCrate, openCrate, crateStyles, bankCoins } from '../../js/economy.js';
import { isUnlocked, GROUPS } from '../../js/cosmetics.js';

test('potenciadores: se compran con gemas, se eligen hasta 2 y se gastan al empezar', () => {
  const s = loadFrom(null);
  s.gems = 1000;
  assert.ok(buyBoost(s, 'life'));
  assert.ok(buyBoost(s, 'xp'));
  assert.ok(buyBoost(s, 'shield'));
  assert.equal(s.gems, 1000 - BOOSTS.life.cost - BOOSTS.xp.cost - BOOSTS.shield.cost);
  assert.equal(toggleBoost(s, 'magnet'), false, 'no se elige lo que no tienes');
  toggleBoost(s, 'life'); toggleBoost(s, 'xp');
  assert.equal(toggleBoost(s, 'shield'), false, `máximo ${MAX_BOOSTS}`);
  assert.deepEqual(takeBoosts(s, (id) => id !== 'xp'), ['life'], 'el filtro por modo deja fuera los que no valen');
  assert.equal(s.boosts.life, 0);
  assert.equal(s.boosts.xp, 1, 'lo filtrado no se gasta');
  assert.deepEqual(s.boostSel, ['xp']);
  s.gems = 0;
  assert.equal(buyBoost(s, 'luck'), false);
});

test('talentos: en orden, con gemas; las mejoras globales antiguas pasan a ser talentos', () => {
  const s = loadFrom(null);
  s.gems = 10000;
  assert.equal(buyTalent(s, 'r2'), false, 'no te saltas el primero');
  assert.ok(buyTalent(s, 'r1'));
  assert.ok(buyTalent(s, 'r2'));
  assert.equal(nextTalent(s, 'runner').id, 'r3');
  for (const t of Object.values(TALENTS)) assert.equal(t.nodes.length, 5);
  // guardado v3 con las mejoras globales compradas
  const old = loadFrom(JSON.stringify({ v: 3, gems: 5, meta: { shield: true, card: true } }));
  assert.ok(hasTalent(old, 'r1') && hasTalent(old, 'r2'));
  assert.equal(old.meta, undefined);
  assert.equal(old.gems, 5, 'no se pierde nada');
});

test('cofres: nunca repiten un estilo, cobran y la racha garantiza un épico', () => {
  const s = loadFrom(null);
  s.gems = 1e6;
  s.galaxy.credits = 1e7;
  const before = crateStyles(s, 'viper').length;
  assert.ok(before > 20);
  const seen = new Set();
  let maxDry = 0, dry = 0;
  for (let i = 0; i < 300; i++) {
    const got = openCrate(s, i % 3 ? 'std' : 'elite', 'viper');
    for (const it of got) {
      if (it.kind !== 'style') continue;
      assert.ok(!seen.has(it.id), `repetido: ${it.id}`);
      seen.add(it.id);
      const item = GROUPS[it.group].find((x) => x.id === it.id);
      assert.ok(isUnlocked(item, s, 'viper'), 'el estilo queda desbloqueado');
    }
    const epic = got.some((it) => it.rarity === 'epic' || it.rarity === 'legendary');
    dry = epic ? 0 : dry + 1;
    maxDry = Math.max(maxDry, dry);
  }
  assert.ok(maxDry < PITY, `racha sin épico: ${maxDry}`);
  assert.equal(crateStyles(s, 'viper').length, 0, 'tras muchos cofres ya no quedan estilos por dar');
  // sin estilos, el cofre sigue dando algo
  assert.equal(rollCrate(s, 'std', 'viper').length, CRATES.std.items);
  // sin dinero no se abre
  const p = loadFrom(null);
  assert.equal(openCrate(p, 'elite'), null);
});

test('cofres deterministas por número de cofre', () => {
  const a = loadFrom(null), b = loadFrom(null);
  a.galaxy.credits = b.galaxy.credits = 1e6;
  assert.deepEqual(openCrate(a, 'std'), openCrate(b, 'std'));
});

test('las monedas que sobran pasan a créditos', () => {
  const s = loadFrom(null);
  assert.equal(bankCoins(s, 34.7), 34);
  assert.equal(s.galaxy.credits, 34);
});
