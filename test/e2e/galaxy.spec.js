import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';
import { spaceBotInPage } from './spaceBot.js';

const SAVE = 'overdrive-save-v1';

async function startGalaxy(page, seedSave = { v: 3, runs: 5 }) {
  await page.addInitScript(([k, v]) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(k, JSON.stringify(v));
    }
  }, [SAVE, seedSave]);
  await page.goto('/?debug&nosw&seed=3');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; });
  await page.locator('#btnGalaxy').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
}

test('galaxia: el bot mina, vuelve, atraca, vende y compra una mejora; se guarda', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  await expect(page.locator('#spaceHud')).toBeVisible();
  const res = await page.evaluate(spaceBotInPage, { seconds: 180, until: 'dock', fill: 0.8 });
  expect(res.mode).toBe('station');
  expect(res.cargo).toBeGreaterThanOrEqual(15);
  await expect(page.locator('#station')).toBeVisible();
  await page.locator('#btnSell').click();
  const credits = await page.evaluate(() => window.__save.galaxy.credits);
  expect(credits).toBeGreaterThan(100);
  await page.locator('[data-up="cargo"]').click();
  const g = await page.evaluate(() => window.__save.galaxy);
  expect(g.up.cargo).toBe(1);
  expect(g.credits).toBe(credits - 90);
  // zarpar y seguir
  await page.locator('#btnUndock').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  await expect(page.locator('#spaceHud')).toBeVisible();
  // persistencia
  await page.reload();
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).galaxy, SAVE);
  expect(saved.up.cargo).toBe(1);
  expect(saved.sold).toBe(true);
  expect(errors).toEqual([]);
});

test('galaxia: si te destruyen, reapareces en la estación sin la carga (relajado)', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { v: 3, runs: 5, galaxy: { credits: 50, cargo: { iron: 12 } } });
  const res = await page.evaluate(() => {
    const s = window.G.space;
    s.ship.shield = 0;
    s.ship.hull = 5;
    // chocar contra un asteroide
    const a = s.sys.asteroids[0];
    s.ship.pos = { ...a.pos };
    for (let i = 0; i < 5; i++) window.D.step(1 / 30, false);
    const st = s.sys.station.pos;
    return { mode: window.G.mode, hull: s.ship.hull, cargo: window.__save.galaxy.cargo.iron, credits: window.__save.galaxy.credits, nearStation: Math.hypot(s.ship.pos.x - st.x, s.ship.pos.z - st.z) < 200 };
  });
  expect(res.mode).toBe('galaxy');
  expect(res.hull).toBe(100);
  expect(res.cargo).toBe(0);
  expect(res.credits).toBe(50, 'los créditos no se pierden');
  expect(res.nearStation).toBe(true);
  expect(errors).toEqual([]);
});

test('galaxia: rendimiento de un fotograma completo (simular + dibujar)', async ({ page }) => {
  await startGalaxy(page);
  const ms = await page.evaluate(() => {
    const t0 = performance.now();
    for (let i = 0; i < 60; i++) window.D.step(1 / 60, true);
    return (performance.now() - t0) / 60;
  });
  console.log(`GALAXIA fotograma medio: ${ms.toFixed(2)} ms`);
  expect(ms).toBeLessThan(16);
});

test('galaxia: cruzar una puerta salta al sistema vecino; el mapa lo muestra y traza ruta', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { v: 3, runs: 5, galaxy: { credits: 0, up: { engine: 1 }, started: true } });
  const res = await page.evaluate(() => {
    const s = window.G.space;
    const gt = s.sys.gates[0];
    s.ship.pos = { x: gt.pos.x * 0.95, y: 0, z: gt.pos.z * 0.95 };
    s.ship.yaw = Math.atan2(gt.pos.x, gt.pos.z);
    s.ship.pitch = 0;
    for (let i = 0; i < 90 && s.sysId === 0; i++) window.D.step(1 / 30, false);
    return { sys: s.sysId, to: gt.to, visited: window.__save.galaxy.visited };
  });
  expect(res.sys).toBe(res.to);
  expect(res.visited).toContain(res.to);
  await page.locator('#btnGalMap').click();
  await expect(page.locator('#galMap')).toBeVisible();
  await page.locator('#gmSvg .gm-node[data-sys="0"]').click();
  await page.locator('#btnRoute').click();
  const obj = await page.evaluate(() => { window.D.step(1 / 30, false); return window.G.space.objective; });
  expect(obj.kind).toBe('route');
  expect(errors).toEqual([]);
});

test('galaxia: los piratas caen, sueltan créditos y al morir vuelves a tu estación base', async ({ page }) => {
  const errors = trackErrors(page);
  // en NIMMOR (peligro 1), con base allí
  await startGalaxy(page, { v: 3, runs: 5, galaxy: { credits: 0, up: { laser: 3 }, visited: [0, 4], sys: 4, home: 4, started: true, cargo: { iron: 5 } } });
  const res = await page.evaluate(() => {
    const s = window.G.space;
    window.G.god = true;
    const p = s.pirates[0];
    const before = window.__save.galaxy.credits;
    // un pirata quieto delante
    for (let i = 0; i < 400 && p.alive; i++) {
      const f = { x: Math.sin(s.ship.yaw), z: Math.cos(s.ship.yaw) };
      p.pos = { x: s.ship.pos.x + f.x * 60, y: s.ship.pos.y, z: s.ship.pos.z + f.z * 60 };
      p.speed = 0;
      s.botFire = true;
      window.D.step(1 / 30, false);
    }
    s.botFire = false;
    // recoger el botín
    for (let i = 0; i < 90; i++) { if (s.loot[0]) s.loot[0].pos = { ...s.ship.pos }; window.D.step(1 / 30, false); }
    const gained = window.__save.galaxy.credits - before;
    // y ahora, morir lejos de la estación
    window.G.god = false;
    s.ship.pos = { x: 2000, y: 0, z: 0 };
    s.ship.shield = 0;
    s.ship.hull = 1;
    s.ebolts.push({ pos: { ...s.ship.pos }, vel: { x: 0, y: 0, z: 0 }, life: 1, dmg: 50 });
    window.D.step(1 / 30, false);
    return { dead: !p.alive, gained, sys: s.sysId, cargo: window.__save.galaxy.cargo.iron, hull: s.ship.hull };
  });
  expect(res.dead).toBe(true);
  expect(res.gained).toBeGreaterThan(0);
  expect(res.sys).toBe(4);
  expect(res.cargo).toBe(0);
  expect(res.hull).toBe(100);
  expect(errors).toEqual([]);
});

test('galaxia: comercio, comprar mineral local en la estación', async ({ page }) => {
  await startGalaxy(page, { v: 3, runs: 5, galaxy: { credits: 500, started: true } });
  await page.evaluate(() => { const s = window.G.space; s.ship.pos = { ...s.sys.station.pos }; window.D.step(1 / 30, false); document.getElementById('btnDock').click(); });
  await expect(page.locator('#station')).toBeVisible();
  await page.locator('#btnBuyOre').click();
  const g = await page.evaluate(() => window.__save.galaxy);
  expect(g.cargo.iron).toBe(5);
  expect(g.credits).toBeLessThan(500);
});
