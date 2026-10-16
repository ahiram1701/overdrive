import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { save } from '../../js/save.js';
import { missions, pickMissions, POOL, GEMS } from '../../js/missions.js';

beforeEach(() => {
  save.missions = { key: '', list: [] };
  save.gems = 0;
});

test('las misiones del día son deterministas: 3, una por dificultad y de tipos distintos', () => {
  for (const key of ['2026-10-16', '2026-10-17', '2027-01-01', '2026-02-28']) {
    const a = pickMissions(key), b = pickMissions(key);
    assert.deepEqual(a, b);
    assert.deepEqual(a.map((m) => m.diff), ['easy', 'medium', 'hard']);
    assert.equal(new Set(a.map((m) => m.kind)).size, 3);
    for (const m of a) assert.equal(m.gems, GEMS[m.diff]);
  }
});

test('días distintos dan combinaciones distintas (al menos a veces)', () => {
  const sets = new Set();
  for (let d = 1; d <= 20; d++) sets.add(pickMissions(`2026-11-${String(d).padStart(2, '0')}`).map((m) => m.text).join('|'));
  assert.ok(sets.size > 10);
});

test('sum acumula, best se queda con el máximo, y se paga una sola vez', () => {
  const key = '2026-10-16';
  save.missions = {
    key,
    list: [
      { ...POOL.find((m) => m.kind === 'near' && m.n === 60), gems: 15, progress: 0, done: false },
      { ...POOL.find((m) => m.kind === 'speed' && m.n === 1000), gems: 25, progress: 0, done: false },
    ],
  };
  for (let i = 0; i < 59; i++) assert.deepEqual(missions.track('near', 1, key), []);
  const done = missions.track('near', 1, key);
  assert.equal(done.length, 1);
  assert.equal(save.gems, 15);
  assert.deepEqual(missions.track('near', 5, key), [], 'no se completa dos veces');
  assert.equal(save.gems, 15);

  missions.track('speed', 800, key);
  missions.track('speed', 500, key);
  assert.equal(save.missions.list[1].progress, 800, 'best no baja');
  assert.equal(missions.track('speed', 1235, key).length, 1);
  assert.equal(save.gems, 40);
});

test('al cambiar de día se reinicia', () => {
  missions.today('2026-10-16');
  const kind = save.missions.list[0].kind;
  missions.track(kind, 999, '2026-10-16');
  assert.ok(save.missions.list[0].done);
  const next = missions.today('2026-10-17');
  assert.equal(save.missions.key, '2026-10-17');
  assert.ok(next.every((m) => !m.done && m.progress === 0));
});
