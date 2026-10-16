import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../js/rng.js';
import { MAX_SHIELDS } from '../../js/state.js';
import { baseStats, CARDS, CARD_BY_ID, SYNERGIES, SHIPS, applyCard, offerCards, synergyHint } from '../../js/upgrades.js';

function fakeRun(seed = 1) {
  return {
    rng: makeRng(seed), stats: baseStats(), cards: {}, synergies: new Set(),
    shields: 0, dashCharges: 1, blockedLane: null, luck: 1, player: { lane: 0 },
  };
}

test('offerCards devuelve cartas distintas y nunca una al máximo', () => {
  for (let seed = 1; seed < 200; seed++) {
    const r = fakeRun(seed);
    for (const c of CARDS) if (seed % 2 && c.max === 1) r.cards[c.id] = 1;
    const offers = offerCards(r, 3);
    assert.equal(new Set(offers.map((c) => c.id)).size, offers.length);
    for (const c of offers) assert.ok((r.cards[c.id] || 0) < c.max, `${c.id} ya está al máximo`);
  }
});

test('offerCards con rareza mínima respeta el filtro', () => {
  const r = fakeRun(3);
  for (let i = 0; i < 50; i++) {
    for (const c of offerCards(r, 3, 'rare')) assert.notEqual(c.rarity, 'common');
    for (const c of offerCards(r, 3, 'epic')) assert.equal(c.rarity, 'epic');
  }
});

test('cada sinergia se activa al tener sus dos cartas', () => {
  for (const s of SYNERGIES) {
    const r = fakeRun();
    assert.equal(synergyHint(r, s.needs[1]), null);
    applyCard(r, s.needs[0]);
    assert.equal(synergyHint(r, s.needs[1]), s.name);
    const fresh = applyCard(r, s.needs[1]);
    assert.ok(fresh.some((f) => f.id === s.id), `${s.id} no se activó`);
    assert.ok(r.synergies.has(s.id));
  }
});

test('el Pacto de cristal bloquea un carril que no es el actual', () => {
  for (const lane of [-1, 0, 1]) {
    const r = fakeRun();
    r.player.lane = lane;
    applyCard(r, 'cristal');
    assert.notEqual(r.blockedLane, lane);
    assert.equal(r.stats.scoreMult, 3);
    assert.ok(!offerCards(r, 20).some((c) => c.id === 'cristal'));
  }
});

test('nunca se superan los escudos máximos (carta, nave Brick)', () => {
  const r = fakeRun();
  SHIPS.find((s) => s.id === 'brick').apply(r);
  applyCard(r, 'escudo');
  applyCard(r, 'escudo');
  assert.equal(r.shields, MAX_SHIELDS);
  assert.ok(!offerCards(r, 30).some((c) => c.id === 'escudo'), 'la carta Escudo tiene máximo 2');
});

test('todas las naves se aplican sin errores y los ids de cartas son únicos', () => {
  assert.equal(Object.keys(CARD_BY_ID).length, CARDS.length);
  for (const s of SHIPS) {
    const r = fakeRun();
    s.apply(r);
    assert.ok(r.stats.scoreMult > 0);
  }
});
