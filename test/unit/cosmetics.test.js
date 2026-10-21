import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFrom, migrateCosmetics } from '../../js/save.js';
import { MESHES, rotate, projectMesh } from '../../js/mesh3d.js';
import { SHIPS } from '../../js/upgrades.js';
import { PALETTES, TRAILS, BOOMS, EMBLEMS, GROUPS, isUnlocked, buyCosmetic, equip, equipped, itemsFor, addShipStat, lockText, setEmblemStyle } from '../../js/cosmetics.js';
import { decalFrame, GLYPH_R, emblemPath, hullColor, KEEP_OUT, SPINE_EDGES } from '../../js/shipdraw.js';
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
  const viperOnly = itemsFor('palette', 'viper').filter((i) => i.ship && !i.unlock.mastery);
  assert.equal(viperOnly.length, 2);
  assert.ok(itemsFor('palette', 'viper').some((i) => i.unlock?.mastery === 'viper'), 'pintura de maestro');
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

test('ids únicos de todos los cosméticos', () => {
  const ids = Object.values(GROUPS).flat().map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(EMBLEMS.length >= 8);
});

// distancia de un punto a la recta PQ (en 3D)
const distToLine = (c, P, Q) => {
  const d = Q.map((k, i) => k - P[i]), w = c.map((k, i) => k - P[i]);
  const cr = [d[1] * w[2] - d[2] * w[1], d[2] * w[0] - d[0] * w[2], d[0] * w[1] - d[1] * w[0]];
  return Math.hypot(...cr) / Math.hypot(...d);
};

test('el emblema CABE en su cara en todas las naves y posiciones (no se sale)', () => {
  for (const ship of SHIPS) {
    const m = MESHES[ship.id];
    for (const [at, tris] of Object.entries(m.decalSets)) {
      assert.ok(tris.length >= 1, `${ship.id}/${at}`);
      for (const tri of tris) {
        for (const flip of [false, true]) {
          const { c, u, v, s, n } = decalFrame(m, tri, flip);
          const [A, B, C] = tri.map((k) => m.v[k]);
          const R = s * GLYPH_R;
          assert.ok(R > 0.01, `${ship.id}/${at}: emblema visible`);
          for (const [P, Q] of [[A, B], [B, C], [C, A]]) {
            assert.ok(distToLine(c, P, Q) >= R * 1.2, `${ship.id}/${at}: el emblema toca un borde`);
          }
          // marco ortonormal dentro del plano de la cara
          const dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
          assert.ok(Math.abs(dt(u, n)) < 1e-9 && Math.abs(dt(v, n)) < 1e-9 && Math.abs(dt(u, v)) < 1e-9);
        }
      }
    }
  }
});

test('con cabina o rayas, el emblema se aparta del lomo y sigue cabiendo en su cara', () => {
  for (const ship of SHIPS) {
    const m = MESHES[ship.id];
    for (const [at, tris] of Object.entries(m.decalSets)) {
      for (const tri of tris) {
        const spine = SPINE_EDGES.find(([p, q]) => tri.includes(p) && tri.includes(q));
        if (!spine) continue;
        for (const flip of [false, true]) {
          const { c, s } = decalFrame(m, tri, flip, true);
          const R = s * GLYPH_R;
          const [A, B, C] = tri.map((k) => m.v[k]);
          assert.ok(R > 0.01, `${ship.id}/${at}: sigue viéndose`);
          for (const [P, Q] of [[A, B], [B, C], [C, A]]) assert.ok(distToLine(c, P, Q) >= R * 1.2, `${ship.id}/${at}: se sale de la cara`);
          // la franja del lomo (rayas hasta el 38%, cabina hasta ~28%) queda libre
          const side = m.v[tri.find((k) => !spine.includes(k))];
          const h = distToLine(side, m.v[spine[0]], m.v[spine[1]]);
          assert.ok(distToLine(c, m.v[spine[0]], m.v[spine[1]]) - R >= 0.38 * h, `${ship.id}/${at}: pisa la cabina o las rayas`);
        }
      }
    }
  }
  assert.ok(KEEP_OUT > 0.38);
});

test('los trazos de los emblemas caben en su círculo', () => {
  for (const e of EMBLEMS) {
    const d = emblemPath(e.id);
    if (!d || !/^[MLZ0-9.\s-]+$/.test(d)) continue; // los polígonos (estrella, corona, siluetas)
    const nums = d.match(/-?\d*\.?\d+/g).map(Number);
    for (let i = 0; i < nums.length; i += 2) assert.ok(Math.hypot(nums[i], nums[i + 1]) <= GLYPH_R + 1e-6, `${e.id}`);
  }
});

test('patrones de pintura y estilo del emblema', () => {
  const tiger = PALETTES.find((p) => p.id === 'tiger');
  assert.notEqual(hullColor(tiger, 0, [0, 0, 0], [0, 1]), hullColor(tiger, 1, [0, 0, 0], [0, 1]), 'franjas alternas');
  const duo = PALETTES.find((p) => p.id === 'duo');
  assert.equal(hullColor(duo, 0, [-0.5, 0, 0], [0, 1]), duo.alt);
  assert.equal(hullColor(duo, 0, [0.5, 0, 0], [0, 1]), duo.hull);
  const aurora = PALETTES.find((p) => p.id === 'aurora');
  assert.equal(hullColor(aurora, 0, [0, 0, 0], [0, 1]), aurora.hull);
  assert.equal(hullColor(aurora, 0, [0, 0, 1], [0, 1]), aurora.alt);
  assert.equal(hullColor(PALETTES[0], 3, [0, 0, 0], [0, 1]), PALETTES[0].hull, 'sin patrón');

  const s = loadFrom(null);
  assert.equal(equipped(s).emblemAt, 'alas');
  assert.equal(equipped(s).emblemColor, 'auto');
  setEmblemStyle(s, 'viper', { at: 'cola', color: 'cyan' });
  setEmblemStyle(s, 'viper', { at: 'nope', color: 'nope' });
  const again = loadFrom(JSON.stringify(s));
  assert.equal(equipped(again, 'viper').emblemAt, 'cola');
  assert.equal(equipped(again, 'viper').emblemColor, 'cyan');
  assert.equal(equipped(again, 'brick').emblemAt, 'alas', 'por nave');
});

test('en cada nave, nada se ve igual con distinto nombre: colores distinguibles y nombres únicos', async () => {
  const { itemsFor, lookGap, GROUPS } = await import('../../js/cosmetics.js');
  const { SHIPS } = await import('../../js/upgrades.js');
  for (const ship of SHIPS.map((x) => x.id)) {
    for (const g of ['palette', 'engine', 'shot', 'stripe', 'cockpit', 'aura']) {
      const it = itemsFor(g, ship);
      for (let i = 0; i < it.length; i++) {
        for (let j = i + 1; j < it.length; j++) {
          const d = lookGap(g, it[i], it[j]);
          assert.ok(d >= 90, `${ship} · ${g}: «${it[i].name}» y «${it[j].name}» se parecen demasiado (${d.toFixed(0)})`);
        }
      }
    }
    for (const g of Object.keys(GROUPS)) {
      const names = itemsFor(g, ship).map((x) => x.name);
      assert.equal(new Set(names).size, names.length, `${ship} · ${g}: nombres repetidos`);
    }
  }
});

test('los estilos de logro conservan su id (nadie pierde lo que tenía)', async () => {
  const { ACH_STYLES, achStyle } = await import('../../js/cosmetics.js');
  const { ACHIEVEMENTS } = await import('../../js/progress.js');
  assert.equal(ACH_STYLES.length, ACHIEVEMENTS.length);
  for (const a of ACHIEVEMENTS) assert.equal(achStyle(a.id)?.id, `ach-${a.id}`);
});

test('todas las estelas, explosiones, diseños y emblemas se dibujan sin errores', async () => {
  const { trailFx, boomFx, makeParticles } = await import('../../js/cosfx.js');
  const { drawShip, emblemPath } = await import('../../js/shipdraw.js');
  const { TRAILS: T, BOOMS: B, STRIPES, EMBLEMS: E } = await import('../../js/cosmetics.js');
  const ctx = new Proxy({}, { get: (_, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
  for (const t of T) {
    const parts = makeParticles();
    for (let i = 0; i < 10; i++) { trailFx(parts, ctx, t.id, 50, 50, 40, '#00e5ff', 10, i / 30); parts.update(1 / 60); }
    parts.draw(ctx, 100, 100);
  }
  for (const b of B) { const parts = makeParticles(); boomFx(parts, b.id, 50, 50, '#00e5ff', '#ff2bd6', 0.3); parts.update(0.1); parts.draw(ctx, 100, 100); }
  for (const st of STRIPES.filter((x) => x.style !== 'none')) {
    drawShip(ctx, 'viper', { hull: '#111111', edge: '#00e5ff', glow: '#ffffff' }, 50, 50, 40, { yaw: 0.5, pitch: -0.5, roll: 0 }, { stripe: st, cockpit: '#7df9ff' });
  }
  for (const e of E.filter((x) => x.id !== 'none')) assert.ok(emblemPath(e.id), `el emblema ${e.id} tiene dibujo`);
});
