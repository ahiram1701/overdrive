// GALAXIA · economía: los puestos rinden y se cobran al atracar; los precios de cada estación se mueven
import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

const SAVE = 'overdrive-save-v1';
test('puestos: al atracar se cobra lo que han rendido por salto; el precio de venta lleva su variación', async ({ page }) => {
  const errors = trackErrors(page);
  const seedSave = { v: 3, runs: 5, tips: { galaxy: true, galCombat: true, dock: true }, story: { seen: { 0: true } },
    galaxy: { started: true, jumps: 12, incomeAt: 2, credits: 0 }, outposts: { 5: { name: 'P', mods: { radar: 2 }, store: { cargo: {}, mats: {} } } } };
  await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem(k, JSON.stringify(v)); } }, [SAVE, seedSave]);
  await page.goto('/?debug&nosw&seed=3');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; });
  await page.locator('#btnGalaxy').click();
  await page.locator('#btnGalGo').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  await page.evaluate(() => { const s = window.G.space; s.ship.pos = { ...s.sys.station.pos }; window.D.step(1 / 30); });
  await page.locator('#btnDock').click();
  // 10 saltos × (30 + 15 × 2) = 600
  expect(await page.evaluate(() => window.__save.galaxy.credits)).toBe(600);
  const r = await page.evaluate(async () => {
    const { marketPrice, stationPrices } = await import('/js/spaceGame.js');
    const { priceDrift } = await import('/js/market.js');
    const d = priceDrift(0, 'iron', window.__save.galaxy.jumps);
    return { price: marketPrice('iron', 0), base: stationPrices(0).iron, d };
  });
  expect(Math.abs(r.price - Math.round(r.base * r.d))).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
