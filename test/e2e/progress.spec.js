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
  await page.evaluate(() => {
    const G = window.G;
    G.run.shields = 0;
    for (let i = 0; i < 600 && G.mode === 'play'; i++) window.D.step(0.05, false);
    window.D.step(1.5);
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
  await expect(page.locator('#achList .item')).toHaveCount(37);
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
