import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pressureOf, pressureGap, pressureEvent, biomeIndex, PRESSURE_FROM, PRESSURE_MAX } from '../../js/pacing.js';
import { waveAt, ENEMIES, ARENA_EVENT_KEYS, arenaEventAt, ARENA_EVENTS } from '../../js/arenaData.js';
import { pecioRewards, exchangePiezas, EXCHANGE } from '../../js/pecio.js';
import { POOL } from '../../js/missions.js';
import { ACHIEVEMENTS } from '../../js/progress.js';

test('runner: la presión empieza en el tramo 9, sube cada 3 y tiene tope', () => {
  assert.equal(pressureOf(PRESSURE_FROM - 1), 0);
  assert.equal(pressureOf(PRESSURE_FROM), 1);
  assert.equal(pressureOf(PRESSURE_FROM + 3), 2);
  assert.equal(pressureOf(999), PRESSURE_MAX);
  assert.equal(pressureGap(0), 1);
  assert.ok(pressureGap(PRESSURE_MAX) >= 0.75, 'las filas se juntan, pero con tope (justo)');
  assert.ok(pressureEvent(PRESSURE_MAX) <= 0.9 && pressureEvent(0) === 0.6);
});

test('runner: los biomas siguen igual las tres primeras vueltas y luego cambian de orden', () => {
  const n = 5;
  for (let s = 0; s < n * 3; s++) assert.equal(biomeIndex(s, n), s % n);
  const lap2 = [15, 16, 17, 18, 19].map((s) => biomeIndex(s, n));
  assert.equal(new Set(lap2).size, n, 'cada vuelta pasa por todos');
  assert.notDeepEqual(lap2, [0, 1, 2, 3, 4], 'en otro orden');
  for (let s = 0; s < 200; s++) assert.ok(biomeIndex(s, n) >= 0 && biomeIndex(s, n) < n);
});

test('arena: enjambre antes, y tres enemigos nuevos desde el minuto 5', () => {
  assert.ok(waveAt(16).weights.some((w) => w.id === 'swarm'), 'el enjambre llega a los 0:15');
  const ids = (t) => waveAt(t).weights.map((w) => w.id);
  assert.ok(!ids(280).includes('guard'));
  assert.ok(ids(300).includes('guard'));
  assert.ok(ids(360).includes('sniper'));
  assert.ok(ids(420).includes('nest'));
  for (const id of ['guard', 'sniper', 'nest']) assert.ok(ENEMIES[id].hp > 0 && ENEMIES[id].shape);
});

test('arena: los sucesos de partida rotan y existen', () => {
  const seen = new Set();
  for (let i = 0; i < ARENA_EVENT_KEYS.length; i++) seen.add(arenaEventAt(i));
  assert.equal(seen.size, ARENA_EVENT_KEYS.length);
  for (const k of seen) assert.ok(ARENA_EVENTS[k].name);
});

test('pecios: da gemas y XP de rango; las 🔩 sobrantes se canjean por 🪙', () => {
  const lose = pecioRewards({ depth: 3, rooms: 10, kills: 40 }), win = pecioRewards({ depth: 9, bosses: 3, rooms: 50, kills: 300, won: true });
  assert.ok(lose.gems > 0 && lose.xp > 0);
  assert.ok(win.gems > lose.gems * 3 && win.xp > lose.xp * 3);
  const save = { pecio: { piezas: EXCHANGE.piezas + 5 }, coins: 0 };
  assert.ok(exchangePiezas(save));
  assert.equal(save.pecio.piezas, 5);
  assert.equal(save.coins, EXCHANGE.coins);
  assert.ok(!exchangePiezas(save), 'sin bastantes 🔩, no');
});

test('misiones diarias y logros: la Galaxia también tiene', () => {
  assert.ok(POOL.some((m) => m.text.includes('GALAXIA') && m.diff === 'easy'));
  assert.ok(POOL.some((m) => m.text.includes('GALAXIA') && m.diff === 'hard'));
  for (const id of ['sec25', 'sec40', 'galStreak', 'galContacts', 'galIncGold']) assert.ok(ACHIEVEMENTS.some((a) => a.id === id), id);
});
