import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../js/rng.js';
import { rollTier, genItem, applyGear, itemLines, itemPower, RARITY, BAG_MAX } from '../../js/pecioLoot.js';
import {
  newRun, updateRun, roomOf, genFloor, takeOffer, botOffer, useCons, buy, pray, openDoors, ENEMY, COLS, ROWS, MID_C, MID_R, DOOR_TILE,
} from '../../js/pecio.js';

const DT = 1 / 30;
const run = (s, sec, input = { x: 0, y: 0 }) => { const ev = []; for (let t = 0; t < sec && !s.offer; t += DT) ev.push(...updateRun(s, DT, input)); return ev; };
function emptyRoom(s, type = 'combat') {
  const room = roomOf(s);
  room.tiles = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (__, c) => (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 ? '#' : '.')));
  Object.assign(room, { type, enemies: [], cleared: true, wake: 0, pickups: [], mimic: false, freeChest: false, opened: false });
  Object.assign(s.player, { x: MID_C + 0.5, y: MID_R + 0.5, ang: 0, fireCd: 99, inv: 0 });
  return room;
}

test('rareza: más hondo, mejor botín; y los cofres empujan hacia arriba', () => {
  const avg = (depth, bonus) => { const rng = makeRng(7); let t = 0; for (let i = 0; i < 4000; i++) t += rollTier(rng, depth, bonus); return t / 4000; };
  assert.ok(avg(1, 0) < avg(5, 0) && avg(5, 0) < avg(9, 0), 'sube con la planta');
  assert.ok(avg(3, 1) > avg(3, 0) + 0.3, 'el cofre da mejor');
  const leg = (() => { const rng = makeRng(3); let n = 0; for (let i = 0; i < 4000; i++) if (rollTier(rng, 1, 0) === 3) n++; return n / 4000; })();
  assert.ok(leg < 0.04, `legendarios raros al principio (${(leg * 100).toFixed(1)} %)`);
  // minTier y ranura forzada
  const rng = makeRng(1);
  for (let i = 0; i < 50; i++) {
    const it = genItem(rng, 1, { minTier: 2, slot: 'weapon' });
    assert.ok(it.tier >= 2 && it.slot === 'weapon');
    assert.ok(itemLines(it).length >= 1);
  }
  assert.equal(RARITY.length, 4);
});

test('equipo: el arma cambia el disparo, el blindaje da vida y escudo, los módulos sus efectos', () => {
  const s = newRun(2, { hp: 6 });
  const p = s.player;
  assert.equal(p.weapon, 'basic');
  p.gear.weapon = { id: 'w', slot: 'weapon', kind: 'spread', tier: 2, dmg: 1, rate: 0.9, bounces: 0 };
  p.gear.plating = { id: 'p', slot: 'plating', kind: 'plating', tier: 3, hp: 4, shield: 2 };
  p.gear.mod1 = { id: 'm1', slot: 'mod', kind: 'reflex', tier: 3, val: 50 };
  p.gear.mod2 = { id: 'm2', slot: 'mod', kind: 'magnet', tier: 1, val: 35 };
  applyGear(p);
  assert.equal(p.dmg, 3);
  assert.equal(p.max, 10);
  assert.equal(p.roomShield, 2);
  assert.ok(Math.abs(p.dashMax - 0.55) < 1e-9);
  assert.equal(p.mods.magnet, 35);
  // el abanico dispara 3 balas
  const room = (() => { const r = roomOf(s); r.enemies = [{ id: 'e', kind: 'drone', x: MID_C + 0.5, y: 2.5, ang: 0, hp: 99, max: 99, r: 0.32, cd: 9, charge: 0, aim: null, fuse: null, stun: 99, hitT: 0, alive: true }]; r.wake = 0; r.cleared = false; return r; })();
  Object.assign(p, { x: MID_C + 0.5, y: MID_R + 0.5, fireCd: 0 });
  room.tiles = room.tiles.map((row, r) => row.map((t, c) => (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 ? '#' : '.')));
  updateRun(s, DT, { x: 0, y: 0 });
  assert.equal(s.shots.length, 3);
});

test('botín: lo coges, lo comparas, te lo pones y lo de antes queda en el suelo', () => {
  const s = newRun(3, { hp: 6 });
  const room = emptyRoom(s);
  const old = { id: 'old', slot: 'plating', kind: 'plating', tier: 0, hp: 1, shield: 0 };
  const nw = { id: 'new', slot: 'plating', kind: 'plating', tier: 2, hp: 3, shield: 1 };
  s.player.gear.plating = old; applyGear(s.player); s.player.hp = s.player.max;
  room.pickups.push({ id: 'pk', kind: 'item', item: nw, x: s.player.x, y: s.player.y - 0.3 });
  const ev = run(s, 0.2);
  assert.ok(ev.some((e) => e.type === 'offer'));
  assert.equal(s.offer.item, nw);
  // mientras eliges, la partida no avanza
  const t0 = s.time; updateRun(s, 1, { x: 0, y: -1 }); assert.equal(s.time, t0);
  assert.equal(botOffer(s), 'equip');
  const hp0 = s.player.hp;
  takeOffer(s, 'equip');
  assert.equal(s.player.gear.plating, nw);
  assert.equal(s.player.hp, hp0 + 2, 'el blindaje nuevo trae su vida');
  assert.ok(room.pickups.some((x) => x.item === old && x.cool), 'el viejo, en el suelo (sin volver a ofrecerse al momento)');
  // dejar uno: se queda en el suelo
  room.pickups = [{ id: 'pk2', kind: 'item', item: { id: 'w0', slot: 'weapon', kind: 'pierce', tier: 0, dmg: 0, rate: 0.85, bounces: 0 }, x: s.player.x + 0.2, y: s.player.y }];
  run(s, 0.1);
  assert.ok(s.offer);
  takeOffer(s, 'leave');
  assert.equal(room.pickups.length, 1);
  assert.equal(s.offer, null);
  assert.ok(itemPower(nw) > itemPower(old));
});

test('mímico: el cofre muerde, cierra la sala y suelta un objeto al menos raro', () => {
  const s = newRun(4, { hp: 30 });
  const room = emptyRoom(s, 'treasure');
  room.tiles[2][2] = 'C'; room.mimic = true; room.opened = false;
  Object.assign(s.player, { x: 2.5, y: 3.4, ang: 0 });
  const ev = run(s, 0.1);
  assert.ok(ev.some((e) => e.type === 'mimic'));
  const m = room.enemies.find((e) => e.kind === 'mimic');
  assert.ok(m && m.alive);
  room.tiles[0][MID_C] = 'D';
  assert.ok(openDoors(s, s.at), 'puertas');
  assert.equal(room.tiles[2][2], '.');
  m.hp = 1; s.player.fireCd = 0;
  run(s, 1.5);
  assert.equal(m.alive, false);
  const loot = room.pickups.find((x) => x.kind === 'item');
  assert.ok(loot && loot.item.tier >= 1, 'botín bueno');
  assert.ok(ENEMY.mimic.hp > ENEMY.drone.hp);
});

test('cofre con llave: piezas, vida y un objeto; el de la sala oculta no pide llave', () => {
  const s = newRun(5, { hp: 6 });
  const room = emptyRoom(s, 'treasure');
  room.tiles[2][2] = 'C';
  Object.assign(s.player, { x: 2.5, y: 3.4, ang: 0, keys: 0 });
  let ev = run(s, 0.1);
  assert.ok(ev.some((e) => e.type === 'needKey'));
  s.player.keys = 1; s.touch = null;
  ev = run(s, 0.1);
  assert.ok(ev.some((e) => e.type === 'chest'));
  assert.ok(s.offer && s.offer.item);
  assert.equal(s.player.keys, 0);
  takeOffer(s, 'leave');
  // sala oculta: gratis
  const s2 = newRun(6, { hp: 6 });
  const r2 = emptyRoom(s2, 'hidden');
  r2.tiles[2][2] = 'C'; r2.freeChest = true;
  Object.assign(s2.player, { x: 2.5, y: 3.4, ang: 0, keys: 0 });
  ev = run(s2, 0.1);
  assert.ok(ev.some((e) => e.type === 'chest'));
});

test('interruptor: apaga el suelo eléctrico de la sala para siempre', () => {
  const s = newRun(7, { hp: 20 });
  const room = emptyRoom(s, 'traps');
  room.tiles[MID_R][MID_C + 1] = 'E';
  room.tiles[MID_R - 2][MID_C] = 'S';
  // con corriente, el suelo eléctrico duele (en algún momento del ciclo)
  Object.assign(s.player, { x: MID_C + 1.5, y: MID_R + 0.5 });
  let ev = run(s, 4);
  assert.ok(ev.some((e) => e.type === 'hurt' && e.src === 'electricidad'));
  // pisa el interruptor
  Object.assign(s.player, { x: MID_C + 0.5, y: MID_R - 1.5, inv: 0 });
  ev = run(s, 0.1);
  assert.ok(ev.some((e) => e.type === 'switch'));
  assert.equal(room.powerOff, true);
  Object.assign(s.player, { x: MID_C + 1.5, y: MID_R + 0.5, inv: 0 });
  ev = run(s, 5);
  assert.ok(!ev.some((e) => e.type === 'hurt' && e.src === 'electricidad'), 'apagado');
});

test('sala oculta: tras una pared agrietada que se rompe con el esquive, y no cuenta para el camino', () => {
  let found = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const f = genFloor(seed, 5);
    const host = Object.values(f.rooms).find((r) => r.secret);
    if (!host) continue;
    found++;
    const hid = host.doors[host.secret];
    assert.equal(f.rooms[hid].type, 'hidden');
    assert.equal(f.rooms[hid].doors[{ up: 'down', down: 'up', left: 'right', right: 'left' }[host.secret]], host.id);
    assert.notEqual(hid, f.exit);
  }
  assert.ok(found > 25, `hay salas ocultas a menudo (${found}/60)`);
  // romperla: embestir con el esquive
  for (let seed = 1; seed <= 60; seed++) {
    const s = newRun(seed, { hp: 20 });
    const host = Object.values(s.floor.rooms).find((r) => r.secret);
    if (!host) continue;
    s.at = host.id; s.visited.push(host.id);
    const room = roomOf(s);
    room.enemies = []; room.cleared = true;
    const k = host.secret, [c, r] = DOOR_TILE[k];
    assert.equal(room.tiles[r][c], 'K');
    assert.ok(!(k in openDoors(s, host.id)), 'cerrada mientras no la rompas');
    const pos = { up: [c + 0.5, r + 1.4, 0], down: [c + 0.5, r - 0.4, Math.PI], left: [c + 1.4, r + 0.5, -Math.PI / 2], right: [c - 0.4, r + 0.5, Math.PI / 2] }[k];
    Object.assign(s.player, { x: pos[0], y: pos[1], ang: pos[2], dashCd: 0 });
    s.player.dashT = 0.22;
    const ev = run(s, 0.3, { x: 0, y: -1 });
    assert.ok(ev.some((e) => e.type === 'secret'));
    assert.equal(room.tiles[r][c], 'D');
    assert.ok(k in openDoors(s, host.id));
    return;
  }
  assert.fail('ninguna planta con sala oculta');
});

test('mochila: kit, EMP y teletransporte; como mucho 3 de cada; tienda y pacto del altar', () => {
  const s = newRun(8, { hp: 6 });
  const room = emptyRoom(s);
  const p = s.player;
  p.bag = { kit: 1, emp: 1, warp: 1 };
  p.hp = 2;
  useCons(s, 'kit');
  assert.equal(p.hp, 5);
  assert.deepEqual(useCons(s, 'kit').map((e) => e.type), ['noCons']);
  room.enemies = [{ id: 'e', kind: 'drone', x: 2.5, y: 2.5, ang: 0, hp: 9, max: 9, r: 0.32, cd: 0, charge: 0, aim: null, fuse: null, stun: 0, hitT: 0, alive: true }];
  useCons(s, 'emp');
  assert.ok(room.enemies[0].stun >= 3);
  s.at = Object.keys(s.floor.rooms).find((k) => k !== s.floor.start);
  roomOf(s);
  useCons(s, 'warp');
  assert.equal(s.at, s.floor.start);
  // a la mochila, como mucho 3
  p.piezas = 999;
  for (let i = 0; i < 5; i++) buy(s, 'emp');
  assert.equal(p.bag.emp, BAG_MAX);
  // la caja misteriosa da un objeto, al menos raro
  const ev = buy(s, 'box');
  assert.ok(ev.some((e) => e.type === 'offer'));
  assert.ok(s.offer.item.tier >= 1);
  takeOffer(s, 'leave');
  // PACTO: −1 de vida máxima por un objeto épico o mejor
  const sh = roomOf(s);
  sh.type = 'shrine'; sh.used = false;
  const max0 = p.max;
  const ev2 = pray(s, 'pact');
  assert.equal(p.max, max0 - 1);
  assert.ok(ev2.some((e) => e.type === 'offer'));
  assert.ok(s.offer.item.tier >= 2);
});

test('la bóveda: un objeto guardado empieza la partida puesto', () => {
  const it = { id: 'v', slot: 'weapon', kind: 'pierce', tier: 3, dmg: 3, rate: 0.85, bounces: 0 };
  const s = newRun(9, { hp: 6, gear: [it] });
  assert.equal(s.player.gear.weapon, it);
  assert.equal(s.player.weapon, 'pierce');
  assert.equal(s.player.dmg, 5);
});
