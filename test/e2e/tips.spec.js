import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

const SAVE = 'overdrive-save-v1';
const fresh = (page) => page.addInitScript((k) => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem(k, JSON.stringify({ v: 6, runs: 5 })); }, SAVE);

test('primeros pasos: la GUÍA explica la Galaxia y pausa; luego empieza la historia; no se repite', async ({ page }) => {
  const errors = trackErrors(page);
  await fresh(page);
  await page.goto('/?debug&nosw&tips');
  await page.waitForFunction(() => !!window.G);
  await page.locator('#btnGalaxy').click();
  await expect(page.locator('#dialog')).toBeVisible();
  await expect(page.locator('#dlName')).toHaveText('GUÍA');
  expect(await page.evaluate(() => window.G.mode)).toBe('galaxyPaused');
  for (let i = 0; i < 3; i++) await page.locator('#btnDialog').click();
  // después de la GUÍA, la historia (no se pisan)
  await expect(page.locator('#dlName')).toHaveText('Dra. Ilen');
  expect(await page.evaluate(() => window.G.mode)).toBe('galaxy');
  expect(await page.evaluate(() => window.__save.tips.galaxy)).toBe(true);
  expect(errors).toEqual([]);
});

test('primeros pasos: la Arena también pausa con su consejo, y en Ajustes se pueden repetir', async ({ page }) => {
  const errors = trackErrors(page);
  await fresh(page);
  await page.goto('/?debug&nosw&tips');
  await page.waitForFunction(() => !!window.G);
  await page.locator('#btnArena').click();
  await page.locator('#arenaMaps [data-map="grid"]').click();
  await expect(page.locator('#dlName')).toHaveText('GUÍA');
  expect(await page.evaluate(() => window.G.mode)).toBe('arenaPaused');
  const t0 = await page.evaluate(() => window.G.arena.time);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.G.arena.time)).toBe(t0); // en pausa de verdad
  for (let i = 0; i < 3; i++) await page.locator('#btnDialog').click();
  expect(await page.evaluate(() => window.G.mode)).toBe('arena');
  // otra partida: ya no sale
  await page.evaluate(async () => { const { newArena } = await import('/js/arena.js'); newArena({ map: 'grid' }); });
  await expect(page.locator('#dialog')).toBeHidden();
  // Ajustes → repetir consejos
  await page.evaluate(async () => { const { ui } = await import('/js/ui.js'); ui.showMenu(); });
  await page.locator('#btnSettings').click();
  await page.locator('#btnTipsReset').click();
  expect(await page.evaluate(() => Object.keys(window.__save.tips).length)).toBe(0);
  expect(errors).toEqual([]);
});

test('primeros pasos: en los tests (sin ?tips) no sale nada', async ({ page }) => {
  await fresh(page);
  await page.goto('/?debug&nosw');
  await page.waitForFunction(() => !!window.G);
  await page.locator('#btnArena').click();
  await page.locator('#arenaMaps [data-map="grid"]').click();
  await expect(page.locator('#dialog')).toBeHidden();
  expect(await page.evaluate(() => window.G.mode)).toBe('arena');
});
