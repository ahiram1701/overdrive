import { test, expect } from '@playwright/test';
import { trackErrors, startRun, botInPage } from './helpers.js';

test('el menú carga y JUGAR muestra el HUD sin errores', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?nosw');
  await expect(page.locator('h1.logo')).toBeVisible();
  await page.locator('#btnPlay').click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#menu')).toBeHidden();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

// Equidad: con estas semillas un bot que solo reacciona debe poder sobrevivir.
// Si un cambio en la generación crea un patrón imposible, este test lo detecta.
for (const seed of [1, 42, 2026]) {
  test(`equidad: el bot sobrevive 90 s con la semilla ${seed}`, async ({ page }) => {
    const errors = trackErrors(page);
    await startRun(page, { seed });
    const res = await page.evaluate(botInPage, { seconds: 90 });
    expect(res.hits, `golpes: ${JSON.stringify(res.hits)}`).toEqual([]);
    expect(res.mode).toBe('play');
    expect(res.section).toBeGreaterThanOrEqual(2);
    expect(res.near).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}

test('se llega y se derrota al primer jefe pasando por cartas, cofres y tienda', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page, { seed: 7, god: true });
  const res = await page.evaluate(botInPage, { seconds: 180, god: true, until: 'boss' });
  expect(res.bosses).toBe(1);
  expect(errors).toEqual([]);
});

test('morir muestra la pantalla de resultados y tocar reinicia', async ({ page }) => {
  await startRun(page, { seed: 3 });
  await page.evaluate(() => { for (let i = 0; i < 400 && window.G.mode === 'play'; i++) window.D.step(0.1, false); window.D.step(1.5); });
  await expect(page.locator('#death')).toBeVisible();
  await expect(page.locator('#dScore')).not.toHaveText('');
  await page.waitForTimeout(800);
  await page.locator('#death').click({ position: { x: 50, y: 50 } });
  await page.waitForFunction(() => window.G.mode === 'play');
});

test('PWA: manifest válido, iconos y service worker con caché', async ({ page, request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('fullscreen');
  for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);
  await page.goto('/');
  const cached = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 50; i++) {
      const keys = await caches.keys();
      if (keys.length) {
        const n = (await (await caches.open(keys[0])).keys()).length;
        if (n >= 20) return n;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return 0;
  });
  expect(cached).toBeGreaterThanOrEqual(20);
});
