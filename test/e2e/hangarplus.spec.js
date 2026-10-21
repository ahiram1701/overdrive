import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

const SAVE = 'overdrive-save-v1';
const ALL = ['viper', 'brick', 'ghost', 'nova', 'kaiju', 'raptor', 'comet', 'manta', 'spectra', 'titan'];

async function play(page, ship, seed = 5) {
  await page.addInitScript(([k, s, all]) => localStorage.setItem(k, JSON.stringify({ v: 3, runs: 3, ship: s, ships: all })), [SAVE, ship, ALL]);
  await page.goto(`/?debug&nosw&seed=${seed}`);
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; document.getElementById('btnPlay').click(); });
  await page.waitForFunction(() => window.G.mode === 'play');
  // avanza hasta que haya obstáculos delante
  await page.evaluate(() => { window.G.god = true; window.D.step(4, false); window.G.god = false; });
}
const useAbility = (page) => page.evaluate(() => { window.G.run.ability.cdLeft = 0; window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' })); });

test('Manta: la BURBUJA absorbe un golpe sin gastar escudo', async ({ page }) => {
  const errors = trackErrors(page);
  await play(page, 'manta');
  await useAbility(page);
  const res = await page.evaluate(async () => {
    const { onHit } = await import('/js/game.js');
    const r = window.G.run;
    const before = r.shields;
    const active = r.ability.active > 0;
    const o = r.objects.find((x) => x.alive && x.type !== 'coin');
    onHit(o);
    return { active, before, after: r.shields, dead: window.G.player.dead, popped: r.ability.active === 0 };
  });
  expect(res.active).toBe(true);
  expect(res.after).toBe(res.before);
  expect(res.dead).toBeFalsy();
  expect(res.popped).toBe(true);
  expect(errors).toEqual([]);
});

test('Spectra: el SALTO CORTO avanza 35 m sin chocar con lo que salta', async ({ page }) => {
  const errors = trackErrors(page);
  await play(page, 'spectra');
  const d0 = await page.evaluate(() => window.G.run.dist);
  await useAbility(page);
  const d1 = await page.evaluate(() => window.G.run.dist);
  expect(d1 - d0).toBeCloseTo(35, 0);
  const hits = await page.evaluate(() => { const r = window.G.run; const h = r.hitsTaken; window.D.step(0.5, false); return r.hitsTaken - h; });
  expect(hits).toBe(0);
  expect(errors).toEqual([]);
});

test('Titán: el MARTILLO vacía tu carril hasta 60 m', async ({ page }) => {
  const errors = trackErrors(page);
  await play(page, 'titan', 9);
  // lo mismo que considera el martillo: obstáculos (no monedas ni rampas) en tu carril, hasta 60 m
  const inLane = () => page.evaluate(async () => {
    const { LANE_W } = await import('/js/state.js');
    const r = window.G.run, px = window.G.player.x * LANE_W;
    const soft = new Set(['coin', 'fork', 'finish', 'core', 'portal', 'ramp']);
    return r.objects.filter((o) => o.alive && !soft.has(o.type) && o.z - r.dist > 0 && o.z - r.dist < 59 && (o.all || Math.abs(o.x - px) < 0.8)).length;
  });
  await useAbility(page);
  expect(await inLane()).toBe(0);
  expect(await page.evaluate(() => window.G.run.ability.cdLeft > 0)).toBe(true);
  expect(errors).toEqual([]);
});

test('hangar: pestaña GALAXIA compra una mejora con créditos y cada nave vuela distinto', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify({ v: 3, runs: 3, ship: 'viper', ships: ['viper', 'titan'], galaxy: { started: true, credits: 500, up: {} } }));
  }, SAVE);
  await page.goto('/?nosw');
  await page.locator('#btnHangar').click();
  await page.locator('#hTabs [data-tab="galaxia"]').click();
  await expect(page.locator('#galTab .stat')).toHaveCount(6);
  await page.locator('#galUps [data-up="engine"]').click();
  await expect(page.locator('#galCredits')).toHaveText('380');
  // Titán: más casco, menos velocidad que la equipada
  await page.locator('#shipCarousel .ship-chip', { hasText: 'Titán' }).click();
  await expect(page.locator('#galTab .stat em.up')).not.toHaveCount(0);
  await expect(page.locator('#galTab .stat em.down')).not.toHaveCount(0);
  await page.reload();
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).galaxy.up.engine, SAVE)).toBe(1);
  expect(errors).toEqual([]);
});

test('hangar: nombre propio, motor/aura/disparo y la EXPOSICIÓN con COMPARAR', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify({ v: 3, runs: 3, gems: 500, ship: 'viper', ships: ['viper', 'manta'] }));
  }, SAVE);
  await page.goto('/?nosw');
  await page.locator('#btnHangar').click();
  page.once('dialog', (d) => d.accept('Rayo azul'));
  await page.locator('#btnName').click();
  await expect(page.locator('#shipDetail h3')).toContainText('«Rayo azul»');
  // motor de color: se compra y se equipa
  await page.locator('#hTabs [data-tab="estilo"]').click();
  await page.locator('[data-cos="engine:e-cyan"]').click();
  await page.locator('#btnCosBuy').click();
  await expect(page.locator('[data-cos="engine:e-cyan"]')).toHaveClass(/on/);
  expect(await page.locator('[data-cos^="aura:"]').count()).toBeGreaterThanOrEqual(6);
  expect(await page.locator('[data-cos^="shot:"]').count()).toBeGreaterThanOrEqual(6);
  expect(await page.locator('[data-cos^="stripe:"]').count()).toBeGreaterThanOrEqual(6);
  expect(await page.locator('[data-cos^="cockpit:"]').count()).toBeGreaterThanOrEqual(5);
  await page.reload();
  const sv = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE);
  expect(sv.shipNames.viper).toBe('Rayo azul');
  expect(sv.cosmetics.equip.viper.engine).toBe('e-cyan');
  // exposición
  await page.locator('#btnHangar').click();
  await page.locator('#btnExpo').click();
  await expect(page.locator('#expo')).toBeVisible();
  await expect(page.locator('#expoName')).toHaveText('«Rayo azul»');
  await page.locator('#expoNext').click();
  await expect(page.locator('#expoName')).toHaveText('Brick');
  await page.locator('#expoCompare').click();
  await expect(page.locator('#expoStats .cmp-head')).toContainText('vs');
  await expect(page.locator('#expoStats .b2')).toHaveCount(6);
  await page.locator('#expo .scr-back').click();
  await expect(page.locator('#hangar')).toBeVisible();
  expect(errors).toEqual([]);
});

test('ESTILO: filtro TODO / MÍO / POR CONSEGUIR y aviso cuando puedes comprar algo', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => { try { localStorage.removeItem('od-cos-filter'); } catch { /* */ } localStorage.setItem(k, JSON.stringify({ v: 3, runs: 3, ship: 'viper', ships: ['viper'], gems: 500 })); }, SAVE);
  await page.goto('/?debug&nosw');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => document.getElementById('btnHangar').click());
  await expect(page.locator('#hTabs [data-tab="estilo"]')).toHaveClass(/dot/);
  await page.evaluate(() => document.querySelector('#hTabs [data-tab="estilo"]').click());
  const count = () => page.evaluate(() => ({ all: document.querySelectorAll('#cosmetics .cos').length, locked: document.querySelectorAll('#cosmetics .cos.locked').length }));
  const all = await count();
  expect(all.locked).toBeGreaterThan(0);
  await page.evaluate(() => document.querySelector('.cos-filter [data-f="mine"]').click());
  const mine = await count();
  expect(mine.locked).toBe(0);
  expect(mine.all).toBeLessThan(all.all);
  await page.evaluate(() => document.querySelector('.cos-filter [data-f="locked"]').click());
  const lockedOnly = await count();
  // solo lo bloqueado (más lo equipado de cada grupo, que siempre se ve)
  expect(lockedOnly.all - lockedOnly.locked).toBeLessThanOrEqual(9);
  expect(errors).toEqual([]);
});

test('ESTILO: tocar estilos no mueve nada (ni el orden, ni las filas, ni la página)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ v: 3, runs: 3, ship: 'viper', ships: ['viper'], gems: 500, xp: 60000 })), SAVE);
  await page.goto('/?debug&nosw');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { document.getElementById('btnHangar').click(); document.querySelector('#hTabs [data-tab="estilo"]').click(); });
  await page.evaluate(() => { document.getElementById('hangar').scrollTop = 400; document.querySelector('.cos-chips[data-group="palette"]').scrollLeft = 250; });
  await page.waitForTimeout(500);
  const snap = () => page.evaluate(() => ({
    top: document.getElementById('hangar').scrollTop,
    rows: [...document.querySelectorAll('.cos-chips')].map((r) => r.scrollLeft).join(),
    pos: [...document.querySelectorAll('#cosmetics .cos')].map((c) => `${c.dataset.cos}@${Math.round(c.getBoundingClientRect().left)},${Math.round(c.getBoundingClientRect().top)}`).join('|'),
  }));
  const s0 = await snap();
  const ids = await page.evaluate(() => [...document.querySelectorAll('.cos-chips[data-group="palette"] .cos')].slice(2, 5).map((c) => c.dataset.cos));
  for (const id of ids) {
    await page.evaluate((x) => document.querySelector(`[data-cos="${x}"]`).click(), id);
    await page.waitForTimeout(120);
    expect(await snap()).toEqual(s0);
  }
  expect(errors).toEqual([]);
});

test('vista 3D del hangar: se gira en cualquier dirección y el doble toque la devuelve', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ v: 3, runs: 3, ship: 'viper', ships: ['viper'] })), SAVE);
  await page.goto('/?debug&nosw');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => document.getElementById('btnHangar').click());
  await page.waitForTimeout(300);
  const hv = () => page.evaluate(async () => { const { ui } = await import('/js/ui.js'); return { yaw: ui._hv.yaw, pitch: ui._hv.pitch, zoom: ui._hv.zoom }; });
  const box = await page.locator('#hangarView').boundingBox();
  const a = await hv();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width / 2 + i * 5, box.y + box.height / 2 + i * 6);
  await page.mouse.up();
  const b = await hv();
  expect(Math.abs(b.yaw - a.yaw)).toBeGreaterThan(0.3);
  expect(Math.abs(b.pitch - a.pitch)).toBeGreaterThan(0.3);
  // la nave SIGUE AL DEDO: lo más cercano a la cámara se movió a la derecha y abajo, como el arrastre
  const moved = await page.evaluate(async ([a, b]) => {
    const { MESHES, rotate } = await import('/js/mesh3d.js');
    const near = (r) => MESHES.viper.v.map((v) => rotate(v, r)).sort((p, q) => p[2] - q[2])[0];
    const p0 = near({ yaw: a.yaw, pitch: a.pitch }), p1 = rotate(MESHES.viper.v[MESHES.viper.v.findIndex((v) => { const q = rotate(v, { yaw: a.yaw, pitch: a.pitch }); return q[0] === p0[0] && q[2] === p0[2]; })], { yaw: b.yaw, pitch: b.pitch });
    return { dx: p1[0] - p0[0], dyScreen: -(p1[1] - p0[1]) };
  }, [a, b]);
  expect(moved.dx).toBeGreaterThan(0);
  expect(moved.dyScreen).toBeGreaterThan(0);
  await page.mouse.click(box.x + 30, box.y + 30);
  await page.mouse.click(box.x + 30, box.y + 30);
  const c = await hv();
  expect(c.pitch).toBeCloseTo(-0.42, 2);
  expect(c.zoom).toBe(1);
  expect(errors).toEqual([]);
});

test('ESTILO: probar varias cosas a la vez y COMPRAR TODO; looks guardados', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ v: 3, runs: 3, ship: 'viper', ships: ['viper', 'brick'], gems: 500, xp: 60000 })), SAVE);
  await page.goto('/?debug&nosw');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { document.getElementById('btnHangar').click(); document.querySelector('#hTabs [data-tab="estilo"]').click(); });
  await page.evaluate(() => document.querySelector('.look-save[data-i="0"]').click());
  for (const id of ['palette:sunset', 'trail:stars']) await page.evaluate((x) => document.querySelector(`[data-cos="${x}"]`).click(), id);
  await expect(page.locator('#cosPreview')).toContainText('Atardecer + Estrellas');
  await expect(page.locator('#btnCosBuy')).toContainText('COMPRAR TODO');
  await page.evaluate(() => document.getElementById('btnCosBuy').click());
  await expect(page.locator('#cosPreview')).toBeHidden();
  const lk = await page.evaluate(async () => { const { save } = await import('/js/save.js'); const { equipped } = await import('/js/cosmetics.js'); const e = equipped(save, 'viper'); return [e.basePalette.id, e.trail.id, save.gems]; });
  expect(lk).toEqual(['sunset', 'stars', 500 - 100 - 130]);
  // el look 1 (de serie) vuelve a ponerse con un toque
  await page.evaluate(() => document.querySelector('.look-use[data-i="0"]').click());
  const back = await page.evaluate(async () => { const { save } = await import('/js/save.js'); const { equipped } = await import('/js/cosmetics.js'); return equipped(save, 'viper').basePalette.id; });
  expect(back).toBe('stock');
  expect(errors).toEqual([]);
});

test('EXPO: VUELO, SOLO MÍAS y EQUIPAR / COMPRAR desde la exposición', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ v: 3, runs: 3, ship: 'viper', ships: ['viper', 'brick'], gems: 400 })), SAVE);
  await page.goto('/?debug&nosw');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { document.getElementById('btnHangar').click(); document.getElementById('btnExpo').click(); });
  await expect(page.locator('#expoAct')).toHaveText('EN USO');
  // vuelo: dispara y se dibuja sin errores
  await page.locator('#expoFly').click();
  await expect(page.locator('#expoFly')).toHaveClass(/on/);
  await page.waitForTimeout(800);
  expect(await page.evaluate(async () => (await import('/js/ui.js')).ui._expo.shots.length)).toBeGreaterThan(0);
  await page.locator('#expoFly').click();
  // solo mías: ‹ › solo pasan por Viper y Brick
  await page.locator('#expoMine').click();
  const names = [];
  for (let i = 0; i < 3; i++) { await page.locator('#expoNext').click(); names.push(await page.locator('#expoName').textContent()); }
  expect(new Set(names)).toEqual(new Set(['Viper', 'Brick']));
  // equipar la Brick desde aquí
  if ((await page.locator('#expoName').textContent()) !== 'Brick') await page.locator('#expoNext').click();
  await page.locator('#expoAct').click();
  await expect(page.locator('#expoAct')).toHaveText('EN USO');
  expect(await page.evaluate(async () => (await import('/js/save.js')).save.ship)).toBe('brick');
  // comprar la Ghost (150 💎)
  await page.locator('#expoMine').click();
  for (let i = 0; i < 20 && (await page.locator('#expoName').textContent()) !== 'Ghost'; i++) await page.locator('#expoNext').click();
  await expect(page.locator('#expoAct')).toContainText('COMPRAR');
  await page.locator('#expoAct').click();
  expect(await page.evaluate(async () => { const { save } = await import('/js/save.js'); return [save.ships.includes('ghost'), save.gems]; })).toEqual([true, 250]);
  expect(errors).toEqual([]);
});
