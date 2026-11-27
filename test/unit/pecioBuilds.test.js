// PECIOS · builds: etiquetas y sinergias, elegir 1 de 3, blindajes con identidad, únicos nuevos y habilidades distintas
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRun, genFloor, updateRun, roomOf, takeOffer, botOffer, selectOffer, offerItems, useAbility, dash, gainKey, ENEMY, COLS, ROWS, MID_C, MID_R, ABILITY } from '../../js/pecio.js';
import { genItem, genChoice, applyGear, tagsOf, tagCounts, synergyLines, itemLines, itemName, PLATINGS, AFFIXES, TAGS, MODULES, SYNERGY_AT } from '../../js/pecioLoot.js';
import { makeRng } from '../../js/rng.js';

const DT = 1 / 30;
const run = (s, sec, input = { x: 0, y: 0 }) => { const ev = []; for (let t = 0; t < sec && !s.offer && !s.over; t += DT) ev.push(...updateRun(s, DT, input)); return ev; };
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
const W = (kind, extra = {}) => ({ id: 'w', slot: 'weapon', kind, tier: 1, dmg: 0, rate: 1, bounces: 0, orbs: 0, ...extra });
const M = (kind, tier = 1, extra = {}) => ({ id: `m${kind}`, slot: 'mod', kind, tier, val: MODULES[kind].val[tier], ...extra });
const PL = (kind, tier = 1, extra = {}) => ({ id: `p${kind}`, slot: 'plating', kind, tier, hp: PLATINGS[kind].hp(tier), shield: PLATINGS[kind].shield(tier), ...extra });
const stunned = { stun: 99, hp: 40, max: 40 };

test('etiquetas: cada pieza lleva las suyas y con 3 iguales se enciende la sinergia', () => {
  assert.deepEqual(tagsOf(W('rapid')), ['fire']);
  assert.deepEqual(tagsOf(W('spread', { affix: 'burn' })), ['fire']);
  assert.deepEqual(tagsOf(M('magnet')).sort(), ['loot']);
  const s = newRun(1, { hp: 6 });
  gear(s, { weapon: W('spread', { affix: 'ricochet' }), plating: PL('reflect'), mod1: M('reflex') });
  assert.equal(tagCounts(s.player.gear).dodge, 3);
  assert.ok(s.player.syn.dodge, 'Danza encendida');
  assert.ok(Math.abs(s.player.dashMax - Math.max(0.45, 1.1 * 0.75 * 0.5)) < 1e-9, 'el esquive recarga el doble de rápido (sin bajar de 0,45 s)');
  assert.ok(synergyLines(s.player.tags).some((l) => l.includes(TAGS.dodge.name) && l.includes(`${SYNERGY_AT}/${SYNERGY_AT}`)));
  // con 2, se ve a medias y no hace nada
  gear(s, { mod1: M('magnet') });
  assert.ok(!s.player.syn.dodge);
  assert.ok(synergyLines(s.player.tags).some((l) => l.includes('2/3')));
});

test('sinergia 🛡️ Fortaleza: +1 de vida máxima y un escudo más por sala; 🧲 Saqueo: más 🔩 y llave por planta', () => {
  const s = newRun(2, { hp: 6 });
  gear(s, { plating: PL('plating', 1), mod1: M('leech'), mod2: M('mirror') });
  const base = s.player.max;
  gear(s, { mod2: M('leech', 2) });
  assert.ok(s.player.syn.guard);
  assert.equal(s.player.max, base + 1);
  assert.equal(s.player.roomShield, 1);
  const s2 = newRun(3, { hp: 6 });
  gear(s2, { mod1: M('magnet'), mod2: M('greed') });
  assert.ok(!s2.player.syn.loot, 'dos módulos no bastan');
  gear(s2, { weapon: W('spread', { set: 'scrap' }) }); // una pieza de set Chatarrero también es 🧲
  assert.ok(s2.player.syn.loot);
  assert.equal(s2.player.mods.setPiezas, 40);
  assert.ok(s2.player.mods.setKeys);
});

test('sinergia 🔥 Incendio: todo quema y la quemadura hace 2', () => {
  const s = newRun(4, { hp: 99 });
  const room = arena(s, ['drone', MID_C + 0.5, MID_R - 2.5, stunned]);
  gear(s, { weapon: W('rapid', { affix: 'burn', unique: 'reactor' }), mod1: M('overcharge') });
  assert.ok(!s.player.syn.fire);
  gear(s, { weapon: W('blast'), plating: PL('plating'), mod1: M('leech') });
  assert.ok(!s.player.syn.fire);
  // arma 🔥 + afijo… cuenta una vez por pieza: hacen falta 3 piezas distintas
  s.player.gear = { weapon: W('rapid'), plating: null, mod1: null, mod2: null };
  applyGear(s.player);
  assert.equal(s.player.burnDmg, 1);
  assert.equal(room.enemies[0].hp, 40);
  // arma 🔥 + dos piezas del set Cazador (también 🔥): Incendio
  gear(s, { plating: PL('plating', 1, { set: 'hunter' }), mod1: M('magnet', 1, { set: 'hunter' }) });
  assert.ok(s.player.syn.fire && s.player.burn);
  assert.equal(s.player.burnDmg, 2);
  s.player.fireCd = 0;
  run(s, 4);
  assert.ok(room.enemies[0].burnT !== undefined && room.enemies[0].hp < 40 - 3, 'arde');
});

test('ELIGE 1 DE 3: el cofre ofrece tres objetos de ranuras distintas; eliges uno y los otros se van', () => {
  const items = genChoice(makeRng(5), 4, { bonus: 1 });
  assert.equal(items.length, 3);
  assert.equal(new Set(items.map((i) => i.slot)).size, 3, 'arma, blindaje y módulo');
  const s = newRun(5, { hp: 6 });
  const room = arena(s);
  room.type = 'treasure';
  room.cleared = true;
  room.tiles[2][2] = 'C';
  s.player.keys = 1;
  Object.assign(s.player, { x: 2.5, y: 3.4, ang: 0 });
  run(s, 0.1);
  assert.ok(s.offer, 'se abre el cofre');
  assert.equal(offerItems(s).length, 3);
  const second = offerItems(s)[1];
  selectOffer(s, 1);
  assert.equal(s.offer.item, second);
  takeOffer(s, 'equip');
  assert.equal(s.player.gear[second.slot === 'mod' ? 'mod1' : second.slot], second);
  assert.ok(!roomOf(s).pickups.some((pk) => pk.alts?.length), 'no quedan los otros dos en el suelo');
});

test('bot: de las tres, coge la que más mejora su equipo', () => {
  const s = newRun(6, { hp: 6 });
  const weak = genItem(makeRng(1), 1, { slot: 'mod' });
  weak.tier = 0;
  const strong = { ...genItem(makeRng(2), 9, { slot: 'weapon', minTier: 3 }) };
  s.offer = { item: weak, alts: [strong, { ...weak, id: 'w2' }], pk: null };
  assert.equal(botOffer(s), 'equip');
  assert.equal(s.offer.item, strong);
});

test('el jefe suelta su botín como elección de 3', () => {
  const s = newRun(11, { hp: 99 });
  s.depth = 3;
  s.floor = genFloor(11, 3);
  s.rooms = {};
  s.at = Object.keys(s.floor.rooms).find((k) => s.floor.rooms[k].type === 'boss');
  const room = roomOf(s);
  const boss = room.enemies.find((e) => e.kind === 'boss');
  boss.hp = 1;
  Object.assign(s.player, { x: boss.x, y: boss.y + 2.5, ang: 0, fireCd: 0, inv: 0 });
  run(s, 1.5);
  const pk = room.pickups.find((x) => x.kind === 'item');
  assert.ok(pk && pk.alts.length === 2, 'tres para elegir');
});

test('blindajes: ablativo (todo escudo), espinas (devuelven el daño) y regenerativo (cura con la sala cerrada)', () => {
  const s = newRun(8, { hp: 6 });
  gear(s, { plating: PL('ablative', 2) });
  assert.equal(s.player.max, 6);
  assert.equal(s.player.roomShield, 4);
  const room = arena(s, ['drone', MID_C + 0.5, MID_R - 0.4, { hp: 40, max: 40, cd: 0 }]);
  gear(s, { plating: PL('thorns', 1) });
  assert.equal(s.player.thorns, 3);
  run(s, 3);
  assert.ok(room.enemies[0].hp < 40, 'las espinas pinchan al que te toca');
  // regenerativo
  const s2 = newRun(9, { hp: 6 });
  arena(s2, ['drone', 1.5, 1.5, stunned]);
  gear(s2, { plating: PL('regen', 3) });
  s2.player.hp = 2;
  const ev = run(s2, 9);
  assert.ok(ev.some((e) => e.type === 'regen'));
  assert.ok(s2.player.hp >= 3);
  assert.ok(itemLines(PL('regen', 3)).some((l) => l.includes('8 s')));
});

test('reflectante y Cometa: el esquive golpea', () => {
  const s = newRun(10, { hp: 6 });
  const room = arena(s, ['drone', MID_C + 0.5, MID_R - 2.5, stunned]);
  gear(s, { plating: PL('reflect', 2) });
  const ev = dash(s);
  assert.ok(ev.some((e) => e.type === 'hit'));
  assert.equal(room.enemies[0].hp, 36);
  const s2 = newRun(11, { hp: 6 });
  const r2 = arena(s2, ['drone', MID_C + 0.5, MID_R - 0.6, stunned]);
  gear(s2, { plating: PL('plating', 3, { unique: 'comet' }) });
  dash(s2);
  assert.equal(r2.enemies[0].hp, 37);
});

test('únicos nuevos: Cañón de Cristal, Prisma, Relicario y Pluma de Fénix', () => {
  const s = newRun(12, { hp: 6 });
  gear(s, { weapon: W('spread', { unique: 'glass' }) });
  assert.equal(s.player.dmg, 4);
  assert.equal(s.player.max, 4);
  assert.equal(itemName(s.player.gear.weapon), 'Cañón de Cristal');
  // prisma: lo que matas estalla en 3 balas
  const s2 = newRun(13, { hp: 99 });
  arena(s2, ['drone', MID_C + 0.5, MID_R - 2.5, { stun: 99, hp: 1, max: 1 }]);
  gear(s2, { weapon: W('spread', { unique: 'prism' }) });
  s2.player.fireCd = 0;
  let split = 0;
  for (let i = 0; i < 30 && !split; i++) { updateRun(s2, DT); split = s2.shots.filter((b) => b.split).length; }
  assert.equal(split, 3);
  // relicario
  const s3 = newRun(14, { hp: 6 });
  gear(s3, { mod1: M('keyring', 3, { unique: 'reliquary' }) });
  s3.player.hp = 3;
  gainKey(s3);
  assert.equal(s3.player.hp, 4);
  // fénix: una vez
  const s4 = newRun(15, { hp: 3 });
  arena(s4, ['drone', MID_C + 0.5, MID_R - 0.4, { hp: 40, max: 40, cd: 0 }]);
  gear(s4, { mod1: M('magnet', 3, { unique: 'phoenix' }) });
  const ev = run(s4, 30);
  assert.ok(ev.some((e) => e.type === 'phoenix'));
  assert.equal(ev.filter((e) => e.type === 'phoenix').length, 1);
});

test('armas: el Cañón dispara lento, grande y atraviesa; los afijos se ven en el nombre', () => {
  const rng = makeRng(3);
  let it;
  for (let i = 0; i < 400 && !(it && it.kind === 'cannon'); i++) it = genItem(rng, 5, { slot: 'weapon' });
  assert.equal(it.kind, 'cannon');
  assert.ok(it.dmg >= 3 && it.rate < 0.5);
  const s = newRun(16, { hp: 99 });
  arena(s, ['drone', MID_C + 0.5, MID_R - 2.5, stunned], ['drone', MID_C + 0.5, MID_R - 3.5, stunned]);
  gear(s, { weapon: it });
  s.player.fireCd = 0;
  updateRun(s, DT);
  assert.ok(s.shots[0].big && s.shots[0].pierce);
  // con afijo
  let af;
  for (let i = 0; i < 400 && !af?.affix; i++) af = genItem(rng, 6, { slot: 'weapon', minTier: 2 });
  assert.ok(af.affix in AFFIXES);
  assert.ok(itemName(af).includes(AFFIXES[af.affix].name));
});

test('habilidades: ya no hay dos iguales', () => {
  const descs = Object.values(ABILITY).map((a) => a.desc);
  assert.equal(new Set(descs).size, descs.length);
  // caos: una corona de 12 balas
  const s = newRun(17, { hp: 99, ability: 'chaos' });
  arena(s, ['drone', 1.5, 1.5, stunned]);
  useAbility(s);
  assert.equal(s.shots.length, 12);
  // martillo: golpea en cono delante, no detrás
  const s2 = newRun(18, { hp: 99, ability: 'hammer' });
  const r2 = arena(s2, ['drone', MID_C + 0.5, MID_R - 1.5, stunned], ['drone', MID_C + 0.5, MID_R + 2.5, stunned]);
  useAbility(s2);
  assert.ok(r2.enemies[0].hp < 40 && r2.enemies[1].hp === 40);
  // singularidad: los atrae y estalla
  const s3 = newRun(19, { hp: 99, ability: 'singularity' });
  const r3 = arena(s3, ['drone', MID_C + 0.5, MID_R - 3.5, stunned]);
  useAbility(s3);
  assert.ok(r3.enemies[0].hp < 40);
  // gancho: trae al más cercano
  const s4 = newRun(20, { hp: 99, ability: 'hook' });
  const r4 = arena(s4, ['drone', MID_C + 0.5, MID_R - 3.5, { stun: 0, hp: 40, max: 40 }]);
  useAbility(s4);
  assert.ok(Math.abs(r4.enemies[0].y - s4.player.y) < 2 && r4.enemies[0].stun > 0);
});
