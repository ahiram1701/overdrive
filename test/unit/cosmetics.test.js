import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFrom, migrateCosmetics } from '../../js/save.js';
import { MESHES, rotate, projectMesh } from '../../js/mesh3d.js';
import { SHIPS } from '../../js/upgrades.js';
import { PALETTES, TRAILS, BOOMS, EMBLEMS, GROUPS, isUnlocked, buyCosmetic, equip, equipped, itemsFor, addShipStat, lockText } from '../../js/cosmetics.js';
import { xpToNext } from '../../js/progress.js';

test('cada nave tiene malla y todas las caras usan vértices válidos', () => {
  for (const s of SHIPS) {
    const m = MESHES[s.id];
    assert.ok(m, `falta la malla de ${s.id}`);
    assert.ok(m.f.length >= 14 && m.f.length <= 40);
    for (const [a, b, c, role] of m.f) {
      for (const i of [a, b, c]) assert.ok(i >= 0 && i < m.v.length, `${s.id}: índice ${i}`);
      assert.ok(['hull', 'edge', 'glow'].includes(role));
    }
  }
  // las siluetas son distintas
  assert.equal(new Set(SHIPS.map((s) => JSON.stringify(MESHES[s.id].v))).size, SHIPS.length);
});

test('rotate conserva las longitudes y projectMesh ordena de lejos a cerca', () => {
  const p = [0.3, -0.7, 1.2];
  const q = rotate(p, { yaw: 1.1, pitch: -0.6, roll: 0.4 });
  assert.ok(Math.abs(Math.hypot(...p) - Math.hypot(...q)) < 1e-9);
  const faces = projectMesh(MESHES.viper, { yaw: 0.5, pitch: -0.4 }, 100, 100, 50);
  for (let i = 1; i < faces.length; i++) assert.ok(faces[i - 1].depth >= faces[i].depth);
  for (const f of faces) assert.ok(f.shade >= 0.35 && f.shade <= 1.0001);
});

test('cosméticos: lo de serie está libre; gemas se compran; rango y logro desbloquean solos', () => {
  const s = loadFrom(null);
  for (const g of Object.values(GROUPS)) assert.ok(isUnlocked(g[0], s), 'el primero de cada grupo es gratis');
  const sunset = PALETTES.find((p) => p.id === 'sunset');
  assert.equal(isUnlocked(sunset, s), false);
  assert.equal(buyCosmetic(sunset, s), false, 'sin gemas no se compra');
  s.gems = 500;
  assert.equal(buyCosmetic(sunset, s), true);
  assert.equal(s.gems, 400);
  assert.equal(buyCosmetic(sunset, s), false, 'no se compra dos veces');
  assert.ok(equip('palette', 'sunset', s));
  assert.equal(equipped(s).palette.id, 'sunset');

  const ribbon = TRAILS.find((t) => t.id === 'ribbon');
  assert.equal(isUnlocked(ribbon, s), false);
  assert.equal(equip('trail', 'ribbon', s), false, 'no se equipa lo bloqueado');
  s.xp = xpToNext(1) + xpToNext(2); // rango 3
  assert.ok(isUnlocked(ribbon, s));
  assert.ok(isUnlocked(ribbon, s, 'kaiju'), 'lo del rango vale para todas las naves');

  const glitch = BOOMS.find((b) => b.id === 'glitch');
  assert.equal(isUnlocked(glitch, s), false);
  s.ach.syn10 = { p: 10, done: true };
  assert.ok(isUnlocked(glitch, s));
});

test('cada nave tiene su personalización: lo comprado en una no vale en otra', () => {
  const s = loadFrom(null);
  s.gems = 1000;
  s.ships.push('brick');
  const ice = PALETTES.find((p) => p.id === 'ice');
  assert.ok(buyCosmetic(ice, s, 'viper'));
  assert.ok(equip('palette', 'ice', s, 'viper'));
  assert.equal(isUnlocked(ice, s, 'brick'), false, 'comprado para Viper, no para Brick');
  assert.equal(equip('palette', 'ice', s, 'brick'), false);
  assert.equal(equipped(s, 'viper').palette.id, 'ice');
  assert.equal(equipped(s, 'brick').palette.id, 'stock', 'cada nave lleva lo suyo');
  assert.ok(equip('emblem', 'none', s, 'brick'));
  assert.equal(equipped(s, 'brick').palette.id, 'stock', 'equipar un grupo no toca los demás');
  const again = loadFrom(JSON.stringify(s));
  assert.equal(equipped(again, 'viper').palette.id, 'ice', 'persiste');
  assert.equal(equipped(again, 'brick').palette.id, 'stock');
});

test('exclusivos: solo en su nave, se ganan usándola y no se compran', () => {
  const s = loadFrom(null);
  s.gems = 9999;
  const viperOnly = itemsFor('palette', 'viper').filter((i) => i.ship);
  assert.equal(viperOnly.length, 2);
  assert.ok(itemsFor('palette', 'brick').every((i) => i.ship !== 'viper'), 'no aparecen en otras naves');
  for (const g of ['palette', 'emblem']) {
    for (const ship of SHIPS) assert.ok(itemsFor(g, ship.id).some((i) => i.ship === ship.id), `${ship.id}: exclusivo de ${g}`);
  }
  const venom = viperOnly.find((i) => i.unlock.stat === 'sections');
  assert.equal(buyCosmetic(venom, s, 'viper'), false, 'no se compra');
  assert.equal(lockText(venom, s, 'viper'), '0/30 tramos');
  let got = addShipStat(s, 'viper', 'sections', 29);
  assert.deepEqual(got, []);
  got = addShipStat(s, 'viper', 'sections');
  assert.deepEqual(got.map((i) => i.id), [venom.id], 'avisa al desbloquearse');
  assert.ok(isUnlocked(venom, s, 'viper'));
  assert.equal(isUnlocked(venom, s, 'brick'), false);
  assert.deepEqual(addShipStat(s, 'viper', 'sections'), [], 'solo avisa una vez');
  assert.equal(loadFrom(JSON.stringify(s)).shipStats.viper.sections, 31, 'las estadísticas persisten');
});

test('migración v2 -> v3: lo comprado queda en todas tus naves y se conserva lo equipado', () => {
  const v2 = { v: 2, gems: 50, ships: ['viper', 'ghost'], ship: 'ghost', cosmetics: { owned: ['ice', 'confetti'], equip: { palette: 'ice', trail: 'sparks', boom: 'confetti' } } };
  const s = loadFrom(JSON.stringify(v2));
  for (const ship of ['viper', 'ghost']) {
    assert.ok(isUnlocked(PALETTES.find((p) => p.id === 'ice'), s, ship));
    assert.equal(equipped(s, ship).palette.id, 'ice');
    assert.equal(equipped(s, ship).boom.id, 'confetti');
    assert.equal(equipped(s, ship).emblem.id, 'none');
  }
  assert.equal(isUnlocked(PALETTES.find((p) => p.id === 'ice'), s, 'kaiju'), false, 'una nave nueva empieza de cero');
  assert.deepEqual(migrateCosmetics({ owned: {}, equip: {} }, ['viper']), { owned: {}, equip: {} }, 'v3 no se toca');
});

test('lo equipado vuelve a lo de serie si deja de estar disponible', () => {
  const s = loadFrom(null);
  s.cosmetics = { owned: {}, equip: { viper: { palette: 'gold', trail: 'nope', boom: 'classic', emblem: 'x-brick1' } } };
  const e = equipped(s);
  assert.equal(e.palette.id, 'stock');
  assert.equal(e.trail.id, 'sparks');
  assert.equal(e.emblem.id, 'none');
});

test('ids únicos y cada malla tiene alas para el emblema', () => {
  const ids = Object.values(GROUPS).flat().map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(EMBLEMS.length >= 8);
  for (const s of SHIPS) {
    const m = MESHES[s.id];
    assert.ok(m.decals.length >= 1);
    for (const d of m.decals) for (const i of d) assert.ok(i >= 0 && i < m.v.length);
  }
});
