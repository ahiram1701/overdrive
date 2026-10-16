import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFrom } from '../../js/save.js';
import { MESHES, rotate, projectMesh } from '../../js/mesh3d.js';
import { SHIPS } from '../../js/upgrades.js';
import { PALETTES, TRAILS, BOOMS, GROUPS, isUnlocked, buyCosmetic, equip, equipped } from '../../js/cosmetics.js';
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
  assert.equal(s.gems, 350);
  assert.equal(buyCosmetic(sunset, s), false, 'no se compra dos veces');
  assert.ok(equip('palette', 'sunset', s));
  assert.equal(equipped(s).palette.id, 'sunset');

  const ribbon = TRAILS.find((t) => t.id === 'ribbon');
  assert.equal(isUnlocked(ribbon, s), false);
  assert.equal(equip('trail', 'ribbon', s), false, 'no se equipa lo bloqueado');
  s.xp = xpToNext(1) + xpToNext(2); // rango 3
  assert.ok(isUnlocked(ribbon, s));

  const glitch = BOOMS.find((b) => b.id === 'glitch');
  assert.equal(isUnlocked(glitch, s), false);
  s.ach.syn10 = { p: 10, done: true };
  assert.ok(isUnlocked(glitch, s));
});

test('lo equipado vuelve a lo de serie si deja de estar disponible, y persiste', () => {
  const s = loadFrom(null);
  s.cosmetics = { owned: [], equip: { palette: 'gold', trail: 'nope', boom: 'classic' } };
  const e = equipped(s);
  assert.equal(e.palette.id, 'stock');
  assert.equal(e.trail.id, 'sparks');
  s.gems = 300;
  buyCosmetic(PALETTES.find((p) => p.id === 'ice'), s);
  equip('palette', 'ice', s);
  assert.equal(equipped(loadFrom(JSON.stringify(s))).palette.id, 'ice');
});
