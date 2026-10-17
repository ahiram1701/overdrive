import { test, expect } from '@playwright/test';
import { trackErrors, botInPage } from './helpers.js';

const SAVE = 'overdrive-save-v1';

test('al morir se gana XP, la colección registra las cartas y el menú muestra el rango', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(k, JSON.stringify({ v: 2, runs: 3 }));
    }
  }, SAVE);
  await page.goto('/?debug&nosw&seed=2');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; document.getElementById('btnPlay').click(); });
  // jugar hasta pasar la primera bifurcación (elige carta), y después dejarse matar
  await page.evaluate(botInPage, { seconds: 30 });
  // morir a propósito (sin depender de la suerte: con overdrive se podía llegar a un cofre)
  await page.evaluate(async () => {
    const G = window.G;
    const { onHit } = await import('/js/game.js');
    G.run.shields = 0;
    G.run.lastStand = false;
    G.player.invuln = 0;
    onHit({ type: 'wall', x: G.player.x, y0: 0, y1: 2, z: G.run.dist, alive: true });
    for (let i = 0; i < 40 && G.mode !== 'dead'; i++) window.D.step(0.05, false);
  });
  await expect(page.locator('#death')).toBeVisible();
  await expect(page.locator('#dXp .xp-gain')).toContainText('XP');
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE);
  expect(saved.xp).toBeGreaterThan(0);
  expect(Object.keys(saved.codex.cards || {}).length).toBeGreaterThan(0);
  expect(saved.ach.runs10.p).toBe(1);

  await page.locator('#btnMenu').click();
  await expect(page.locator('#mRank')).toContainText('RANGO');
  await page.locator('#btnAch').click();
  await expect(page.locator('#achList .item')).toHaveCount(43);
  await page.locator('#btnAchBack').click();
  await page.locator('#btnCodex').click();
  await expect(page.locator('#codexCards .cx:not(.unknown)')).not.toHaveCount(0);
  expect(errors).toEqual([]);
});

test('un logro se celebra en plena partida y paga sus gemas', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ v: 2, runs: 3, ach: { near100: { p: 98, done: false } } })), SAVE);
  await page.goto('/?debug&nosw&seed=1');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; document.getElementById('btnPlay').click(); });
  const gems0 = await page.evaluate(async () => (await import('/js/save.js')).save.gems);
  await page.evaluate(botInPage, { seconds: 20 });
  const res = await page.evaluate(async () => {
    const { save } = await import('/js/save.js');
    return { done: save.ach.near100.done, gems: save.gems, inRun: window.G.run.achDone || [] };
  });
  expect(res.done).toBe(true);
  expect(res.inRun).toContain('near100');
  expect(res.gems).toBeGreaterThanOrEqual(gems0 + 20);
});

test('prestigio: en el rango 30 aparece el botón, pide confirmación y renace', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(k, JSON.stringify({ v: 3, runs: 3, xp: 9e6, gems: 10 }));
    }
  }, SAVE);
  await page.goto('/?nosw');
  await expect(page.locator('#btnPrestige')).toBeVisible();
  await page.locator('#btnPrestige').click();
  await expect(page.locator('#btnPrestige')).toContainText('¿SEGURO?');
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).prestige || 0, SAVE)).toBe(0);
  await page.locator('#btnPrestige').click();
  await expect(page.locator('#btnPrestige')).toHaveCount(0);
  await expect(page.locator('#mRank')).toContainText('✨1');
  await expect(page.locator('#mRank')).toContainText('RANGO 1');
  await page.reload();
  const s = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE);
  expect(s.prestige).toBe(1);
  expect(s.xp).toBe(0);
  // el emblema Laurel ya se puede usar y los modificadores siguen abiertos
  await page.locator('#btnHangar').click();
  await page.locator('#hTabs [data-tab="estilo"]').click();
  await expect(page.locator('[data-cos="emblem:laurel"]')).not.toHaveClass(/locked/);
  await page.locator('#btnHangarBack').click();
  await page.locator('#btnMods').click();
  await expect(page.locator('#modList .mod.locked')).toHaveCount(0);
  expect(errors).toEqual([]);
});
