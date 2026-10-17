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
