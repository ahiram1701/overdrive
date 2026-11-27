// GALAXIA · objetivo a largo plazo: campañas de facción en la estación y la historia que no se esconde
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

test('campaña de facción: se acepta en la estación con reputación y guía el objetivo', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { factionRep: { liga: 30, coal: 30, pir: 0 }, story: { seen: { 0: true }, ch: 24 } });
  await page.evaluate(() => { const s = window.G.space; s.ship.pos = { ...s.sys.station.pos }; window.D.step(1 / 30); });
  await page.locator('#btnDock').click();
  await stTab(page, 'faction');
  const btn = page.locator('[data-camp]').first();
  await expect(btn).toContainText('ACEPTAR');
  await btn.click();
  const camp = await page.evaluate(() => window.__save.factionCamp.active);
  expect(['liga', 'coal']).toContain(camp);
  await page.locator('#btnUndock').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  await page.evaluate(() => window.D.step(0.5));
  const obj = await page.evaluate(() => window.G.space.objective);
  expect(obj.kind).toBe('camp');
  expect(obj.text).toContain('1/5');
  expect(errors).toEqual([]);
});

test('historia: si te falta SALTO, el objetivo lo dice en vez de desaparecer', async ({ page }) => {
  const errors = trackErrors(page);
  // capítulo 6 del Acto I (el Heraldo), lejos, con Salto 0: empezamos en el sistema justo antes del salto que no llegas
  await startGalaxy(page, { story: { seen: { 0: true, 5: true }, ch: 5 } });
  await page.evaluate(async () => {
    const { GAL, storyChapter } = await import('/js/spaceGame.js');
    const { route, jumpNeeded } = await import('/js/galaxy.js');
    const { persist } = await import('/js/save.js');
    const path = route(GAL, 0, storyChapter().goal.sys);
    const k = path.findIndex((id, i) => i < path.length - 1 && jumpNeeded(GAL[path[i + 1]]) > 0);
    window.__save.galaxy.sys = path[k];
    persist();
  });
  await page.reload();
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; });
  await page.locator('#btnGalaxy').click();
  await page.locator('#btnGalGo').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  await page.evaluate(() => window.D.step(0.5));
  const obj = await page.evaluate(() => window.G.space.objective);
  expect(obj.kind).toBe('story');
  expect(obj.text).toContain('mejora SALTO');
  expect(errors).toEqual([]);
});
