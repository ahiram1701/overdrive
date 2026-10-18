import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFrom } from '../../js/save.js';
import { BOOSTS, buyBoost, toggleBoost, takeBoosts, MAX_BOOSTS, TALENTS, buyTalent, hasTalent, nextTalent, CRATES, PITY, rollCrate, openCrate, crateStyles, bankCoins } from '../../js/economy.js';
import { isUnlocked, GROUPS } from '../../js/cosmetics.js';

test('potenciadores: se compran con monedas, se eligen hasta 2 y se gastan al empezar', () => {
  const s = loadFrom(null);
  s.coins = 10000;
  assert.ok(buyBoost(s, 'life'));
  assert.ok(buyBoost(s, 'xp'));
  assert.ok(buyBoost(s, 'shield'));
  assert.equal(s.coins, 10000 - BOOSTS.life.cost - BOOSTS.xp.cost - BOOSTS.shield.cost);
  assert.equal(toggleBoost(s, 'magnet'), false, 'no se elige lo que no tienes');
  toggleBoost(s, 'life'); toggleBoost(s, 'xp');
  assert.equal(toggleBoost(s, 'shield'), false, `máximo ${MAX_BOOSTS}`);
  assert.deepEqual(takeBoosts(s, (id) => id !== 'xp'), ['life'], 'el filtro por modo deja fuera los que no valen');
  assert.equal(s.boosts.life, 0);
  assert.equal(s.boosts.xp, 1, 'lo filtrado no se gasta');
  assert.deepEqual(s.boostSel, ['xp']);
  s.coins = 0;
  assert.equal(buyBoost(s, 'luck'), false);
});

test('talentos: en orden; Runner y Arena con monedas, Galaxia con créditos; las mejoras globales antiguas pasan a talentos', () => {
  const s = loadFrom(null);
  s.coins = 100000;
  assert.equal(buyTalent(s, 'r2'), false, 'no te saltas el primero');
  assert.ok(buyTalent(s, 'r1'));
  assert.ok(buyTalent(s, 'r2'));
  assert.equal(nextTalent(s, 'runner').id, 'r3');
  assert.equal(buyTalent(s, 'g1'), false, 'la Galaxia no se paga con monedas');
  s.galaxy.credits = 5000;
  assert.ok(buyTalent(s, 'g1'));
  assert.equal(s.galaxy.credits, 5000 - TALENTS.galaxy.nodes[0].cost);
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
  s.coins = 1e7;
  const credits0 = s.galaxy.credits;
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
  assert.equal(s.galaxy.credits, credits0, 'los cofres no tocan los créditos de la Galaxia');
  // sin dinero no se abre
  const p = loadFrom(null);
  assert.equal(openCrate(p, 'elite'), null);
});

test('cofres deterministas por número de cofre', () => {
  const a = loadFrom(null), b = loadFrom(null);
  a.coins = b.coins = 1e6;
  assert.deepEqual(openCrate(a, 'std'), openCrate(b, 'std'));
});

test('las monedas que sobran van a tu cartera de monedas, no a los créditos', () => {
  const s = loadFrom(null);
  const c0 = s.coins;
  assert.equal(bankCoins(s, 34.7), 34);
  assert.equal(s.coins, c0 + 34);
  assert.equal(s.galaxy.credits, 0);
});

test('mazo: las cartas nuevas salen solo si las tienes; la maestría sube su peso', async () => {
  const { buyCard, upgradeCard, cardLvl } = await import('../../js/economy.js');
  const { CARDS, availableCards, CARD_LVL_W, baseStats } = await import('../../js/upgrades.js');
  const { makeRng } = await import('../../js/rng.js');
  const locked = CARDS.filter((c) => c.locked);
  assert.equal(locked.length, 8);
  const fake = (deck) => ({ rng: makeRng(1), stats: baseStats(), cards: {}, synergies: new Set(), shields: 0, dashCharges: 1, blockedLane: null, luck: 1, player: { lane: 0 }, deck });
  assert.ok(!availableCards(fake({ owned: {}, lvl: {} })).some((c) => c.locked));
  const s = loadFrom(null);
  s.gems = 1000;
  assert.ok(buyCard(s, 'turbo'));
  assert.equal(buyCard(s, 'turbo'), false, 'no se compra dos veces');
  assert.equal(buyCard(s, 'iman'), false, 'las de siempre no se compran');
  assert.ok(availableCards(fake({ owned: s.cardsOwned, lvl: {} })).some((c) => c.id === 'turbo'));
  assert.equal(upgradeCard(s, 'tesoro'), false, 'no subes una carta que no tienes');
  s.coins = 10000;
  for (let i = 0; i < 3; i++) assert.ok(upgradeCard(s, 'iman'));
  assert.equal(upgradeCard(s, 'iman'), false, 'máximo 3');
  assert.equal(cardLvl(s, 'iman'), 3);
  assert.ok(CARD_LVL_W[3] > CARD_LVL_W[0]);
});

test('arsenal de la arena: las armas nuevas solo se ofrecen desbloqueadas', async () => {
  const { buyWeapon } = await import('../../js/economy.js');
  const { WEAPONS, offerUpgrades } = await import('../../js/arenaData.js');
  const { makeRng } = await import('../../js/rng.js');
  const locked = Object.keys(WEAPONS).filter((id) => WEAPONS[id].locked);
  assert.equal(locked.length, 6);
  const st = (unlocked) => ({ weapons: { blaster: 1 }, passives: {}, evolved: {}, unlocked });
  const seen = (unlocked) => {
    const ids = new Set();
    const rng = makeRng(3);
    for (let i = 0; i < 300; i++) for (const u of offerUpgrades(st(unlocked), rng)) ids.add(u.id);
    return ids;
  };
  assert.ok(!locked.some((id) => seen({}).has(id)));
  const s = loadFrom(null);
  s.gems = 1000;
  assert.ok(buyWeapon(s, 'mines'));
  assert.ok(seen(s.arenaWeapons).has('mines'));
});
