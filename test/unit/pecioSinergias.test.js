import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRun, updateRun, roomOf, gainPiezas, ENEMY, COLS, ROWS, MID_C, MID_R, dash } from '../../js/pecio.js';
import { genItem, applyGear, itemLines, itemName, setLines, SETS, UNIQUES, WEAPONS, MODULES } from '../../js/pecioLoot.js';
import { makeRng } from '../../js/rng.js';

const DT = 1 / 30;
const run = (s, sec, input = { x: 0, y: 0 }) => { const ev = []; for (let t = 0; t < sec && !s.offer && !s.over && !s.choice; t += DT) ev.push(...updateRun(s, DT, input)); return ev; };
function arena(s, ...foes) {
  const room = roomOf(s);
  room.tiles = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (__, c) => (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 ? '#' : '.')));
  Object.assign(room, { type: 'combat', wake: 0, cleared: false, pickups: [], mimic: false, opened: false, freeChest: false });
  room.enemies = foes.map(([kind, x, y, extra = {}], i) => ({ id: `t${i}`, kind, x, y, ang: 0, hp: ENEMY[kind].hp, max: ENEMY[kind].hp, r: ENEMY[kind].r, cd: 0, charge: 0, aim: null, fuse: null, stun: 0, hitT: 0, alive: true, ...extra }));
  s.floor.event = null;
  Object.assign(s.player, { x: MID_C + 0.5, y: MID_R + 0.5, ang: 0, fireCd: 99, inv: 0 });
  return room;
}
const gear = (s, g) => { Object.assign(s.player.gear, g); applyGear(s.player); };
const W = (kind, extra = {}) => ({ id: 'w', slot: 'weapon', kind, tier: 1, dmg: 0, rate: 1, bounces: 0, orbs: kind === 'orbit' ? 2 : 0, ...extra });
const M = (kind, tier = 1) => ({ id: `m${kind}`, slot: 'mod', kind, tier, val: MODULES[kind].val[tier] });

test('Arco: el impacto salta a los enemigos de al lado', () => {
  const s = newRun(1, { hp: 99 });
  const room = arena(s, ['drone', MID_C + 0.5, MID_R - 2.5, { stun: 99, hp: 20, max: 20 }], ['drone', MID_C + 1.6, MID_R - 2.5, { stun: 99, hp: 20, max: 20 }], ['drone', MID_C + 2.7, MID_R - 2.5, { stun: 99, hp: 20, max: 20 }]);
  gear(s, { weapon: W('arc') });
  s.player.fireCd = 0;
  const ev = run(s, 0.5);
  assert.ok(ev.some((e) => e.type === 'arc'));
  assert.ok(room.enemies.filter((e) => e.hp < 20).length >= 2, 'el rayo alcanza a otro');
});

test('Órbita: los orbes que giran dañan a quien tocan (aunque no dispares)', () => {
  const s = newRun(2, { hp: 99 });
  const room = arena(s, ['drone', MID_C + 0.5 + 1.05, MID_R + 0.5, { stun: 99, hp: 20, max: 20 }]);
  gear(s, { weapon: W('orbit') });
  assert.equal(s.player.orbs, 2);
  run(s, 2);
  assert.ok(room.enemies[0].hp < 20);
});

test('Corazón del Reactor: las balas queman con el tiempo', () => {
  const s = newRun(3, { hp: 99 });
  const room = arena(s, ['drone', MID_C + 0.5, MID_R - 2, { stun: 99, hp: 30, max: 30 }]);
  gear(s, { weapon: W('spread', { unique: 'reactor' }) });
  assert.ok(s.player.burn);
  s.player.fireCd = 0;
  for (let i = 0; i < 40 && !(room.enemies[0].burnT > 0); i++) run(s, DT);
  s.player.fireCd = 999;
  s.player.rate = 0.0001;
  assert.ok(room.enemies[0].burnT > 0, 'arde');
  const hp = room.enemies[0].hp;
  run(s, 2.2);
  assert.ok(room.enemies[0].hp <= hp - 2, `la quemadura resta (${hp} → ${room.enemies[0].hp})`);
});

test('Espejo: devuelve el golpe; Señuelo: el esquive deja un señuelo que se apaga', () => {
  const s = newRun(4, { hp: 10 });
  const room = arena(s, ['drone', MID_C + 0.5, MID_R + 0.1, { hp: 20, max: 20 }]);
  gear(s, { mod1: M('mirror'), mod2: M('decoy') });
  s.player.mods.mirror = 100;
  const hp = s.player.hp;
  const ev = run(s, 0.4);
  assert.ok(ev.some((e) => e.type === 'mirror'));
  assert.equal(s.player.hp, hp);
  assert.ok(room.enemies[0].hp < 20);
  s.player.dashCd = 0;
  dash(s);
  assert.ok(s.decoy && s.decoy.t > 0);
  run(s, MODULES.decoy.val[1] + 0.3);
  assert.equal(s.decoy, null);
});

test('Avaricia: más 🔩 pero una vida menos', () => {
  const s = newRun(5, {});
  s.floor.event = null;
  const max = s.player.max, base = gainPiezas(s, 20);
  gear(s, { mod1: M('greed', 2) });
  assert.equal(s.player.max, max - 1);
  assert.ok(gainPiezas(s, 20) > base);
});

test('sets: 2 y 3 piezas dan su efecto', () => {
  const s = newRun(6, {});
  const d0 = s.player.dmg, r0 = s.player.rate, m0 = s.player.max, sh0 = s.player.roomShield;
  gear(s, { weapon: W('spread', { set: 'hunter' }), mod1: { ...M('magnet'), set: 'hunter' } });
  assert.equal(s.player.dmg, d0 + 1);
  assert.equal(s.player.rate, r0, '2 piezas: la cadencia no cambia');
  gear(s, { mod2: { ...M('leech'), set: 'hunter' } });
  assert.ok(Math.abs(s.player.rate - r0 * 1.2) < 1e-9);
  assert.deepEqual(s.player.sets, { hunter: 3 });
  assert.match(setLines(s.player.sets)[0], /Cazador 3\/3/);
  gear(s, { weapon: W('spread', { set: 'colossus' }), mod1: { ...M('magnet'), set: 'colossus' }, mod2: { ...M('leech'), set: 'colossus' } });
  assert.equal(s.player.max, m0 + 2);
  assert.equal(s.player.roomShield, sh0 + 1);
  gear(s, { weapon: W('spread', { set: 'scrap' }), mod1: { ...M('magnet'), set: 'scrap' }, mod2: { ...M('leech'), set: 'scrap' } });
  assert.equal(s.player.mods.setPiezas, 30);
  assert.ok(s.player.mods.setKeys);
});

test('Ancla: no caes al pozo; Llave maestra: abre cofres sin llave', () => {
  const s = newRun(7, { hp: 10 });
  const room = arena(s);
  room.tiles[MID_R][MID_C] = 'P';
  gear(s, { plating: { id: 'p', slot: 'plating', kind: 'plating', tier: 3, hp: 4, shield: 2, unique: 'anchor' } });
  const ev = run(s, 0.5);
  assert.ok(!ev.some((e) => e.type === 'fall'));
  // llave maestra
  room.tiles[MID_R][MID_C] = '.';
  room.tiles[MID_R - 1][MID_C] = 'C';
  room.type = 'treasure';
  room.cleared = true;
  s.player.keys = 0;
  s.player.y = MID_R + 0.3;
  gear(s, { mod1: { ...M('keyring', 3), unique: 'masterkey' } });
  run(s, 0.4);
  assert.ok(s.offer, 'el cofre se abre');
  assert.equal(s.player.keys, 0);
});

test('botín: aparecen las armas nuevas, sets y únicos (con nombre propio y su texto)', () => {
  const rng = makeRng(99), seen = new Set(), sets = new Set(), uniq = new Set();
  for (let i = 0; i < 1500; i++) {
    const it = genItem(rng, 9, { bonus: 2 });
    seen.add(it.kind);
    if (it.set) { sets.add(it.set); assert.ok(it.tier >= 1); }
    if (it.unique) {
      uniq.add(it.unique);
      assert.equal(it.tier, 3);
      assert.equal(UNIQUES[it.unique].slot, it.slot);
      assert.equal(itemName(it), UNIQUES[it.unique].name);
      assert.ok(itemLines(it).some((l) => l.startsWith('★')));
    }
  }
  for (const k of [...Object.keys(WEAPONS), ...Object.keys(MODULES)]) assert.ok(seen.has(k), `sale ${k}`);
  assert.deepEqual([...sets].sort(), Object.keys(SETS).sort());
  assert.deepEqual([...uniq].sort(), Object.keys(UNIQUES).sort());
});
