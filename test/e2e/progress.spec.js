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
  await expect(page.locator('#achList .item')).toHaveCount(83);
  await page.locator('#achs .scr-back').click();
  await page.locator('#btnCodex').click();
  await expect(page.locator('#codexCards .cx:not(.unknown)')).not.toHaveCount(0);
  expect(errors).toEqual([]);
});

test('un logro se celebra en plena partida y da su estilo (y unas gemas)', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ v: 2, runs: 3, ach: { near100: { p: 98, done: false } } })), SAVE);
  await page.goto('/?debug&nosw&seed=1');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; document.getElementById('btnPlay').click(); });
  const gems0 = await page.evaluate(async () => (await import('/js/save.js')).save.gems);
  await page.evaluate(botInPage, { seconds: 20 });
  const res = await page.evaluate(async () => {
    const { save } = await import('/js/save.js');
    const { isUnlocked, achStyle } = await import('/js/cosmetics.js');
    return { done: save.ach.near100.done, gems: save.gems, inRun: window.G.run.achDone || [], style: isUnlocked(achStyle('near100'), save, save.ship) };
  });
  expect(res.done).toBe(true);
  expect(res.inRun).toContain('near100');
  expect(res.style).toBe(true);
  expect(res.gems).toBeGreaterThanOrEqual(gems0 + 5);
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
  if (await page.locator('#btnRunner').isVisible()) await page.locator('#btnRunner').click(); // los modos del Runner están en su pantalla
  await page.locator('#btnMods').click();
  await expect(page.locator('#modList .mod.locked')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('logros: el premio es un estilo exclusivo que se equipa desde la lista', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('overdrive-save-v1', JSON.stringify({ v: 4, runs: 3, ship: 'viper', ach: { boss1: { p: 1, done: true } } }));
  });
  await page.goto('/?nosw');
  await page.locator('#btnAch').click();
  const row = page.locator('[data-ach="boss1"]');
  await expect(row.locator('.ach-prize')).toContainText('Cazajefes');
  await row.locator('.ach-eq').click();
  await expect(page.locator('[data-ach="boss1"] .ach-eq')).toHaveText('PUESTO');
  const eq = await page.evaluate(() => JSON.parse(localStorage.getItem('overdrive-save-v1')).cosmetics.equip.viper);
  expect(Object.values(eq)).toContain('ach-boss1');
  // los que faltan enseñan su premio pero no se equipan
  await expect(page.locator('[data-ach="boss50"] .ach-eq')).toHaveCount(0);
  expect(errors).toEqual([]);
});
