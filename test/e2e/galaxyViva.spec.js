// GALAXIA VIVA: siempre hay en qué gastar (flota, tripulación, seguro, Mk ∞) y la estación tiene su carácter
import { test, expect } from '@playwright/test';
import { trackErrors, stTab } from './helpers.js';

const SAVE = 'overdrive-save-v1';
async function startGalaxy(page, extra = {}) {
  const seedSave = { v: 3, runs: 5, tips: { galaxy: true, galCombat: true, dock: true }, story: { seen: { 0: true } }, ...extra };
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
  await page.locator('#btnGalGo').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
}

test('flota: compras un carguero, contratas tripulación y aseguras la nave; los cargueros pagan al volver', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { galaxy: { started: true, credits: 40000 } });
  await page.evaluate(() => { const s = window.G.space; s.ship.pos = { ...s.sys.station.pos }; window.D.step(1 / 30); });
  await page.locator('#btnDock').click();
  // la estación tiene nombre, tipo y su historia
  await expect(page.locator('#stLore')).toContainText('Puerto ORIGEN');
  await expect(page.locator('#stHist')).toContainText('📜');
  await stTab(page, 'fleet');
  await page.locator('#btnBuyFreighter').click();
  await expect(page.locator('[data-freighter]')).toHaveCount(1);
  await page.locator('[data-crew="pilot"]').click();
  await page.locator('#btnInsure').click();
  const f = await page.evaluate(() => window.__save.galaxyFleet);
  expect(f.ships.length).toBe(1);
  expect(f.crew.pilot).toBe(1);
  expect(f.insure).toBeGreaterThan(0);
  // un viaje por cada salto: se cobra al atracar
  await page.evaluate(() => { const fl = window.__save.galaxyFleet; fl.ships[0].bank = 500; });
  const c0 = await page.evaluate(() => window.__save.galaxy.credits);
  await page.locator('#btnUndock').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  await page.evaluate(() => { const s = window.G.space; s.ship.pos = { ...s.sys.station.pos }; window.D.step(1 / 30); });
  await page.locator('#btnDock').click();
  const c1 = await page.evaluate(() => window.__save.galaxy.credits);
  expect(c1).toBeGreaterThanOrEqual(c0 + 500);
  // y se guarda entero (cargueros y tripulación)
  await page.reload();
  await page.waitForFunction(() => !!window.__save);
  expect(await page.evaluate(() => window.__save.galaxyFleet.crew.pilot)).toBe(1);
  expect(errors).toEqual([]);
});

test('Mk ∞: tras el Mk 10 se sigue mejorando', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { galaxy: { started: true, credits: 9e6, up: { engine: 0, laser: 10, shield: 0, cargo: 0, jump: 0, missile: 0 } }, galaxyMats: { chatarra: 999, circuitos: 999, nucleos: 999 } });
  await page.evaluate(() => { const s = window.G.space; s.ship.pos = { ...s.sys.station.pos }; window.D.step(1 / 30); });
  await page.locator('#btnDock').click();
  await stTab(page, 'ship');
  await expect(page.locator('#stUpgrades [data-up="laser"]')).toContainText('Mk 11');
  await page.locator('#stUpgrades [data-up="laser"]').click();
  expect(await page.evaluate(() => window.__save.galaxy.up.laser)).toBe(11);
  expect(errors).toEqual([]);
});
