import { test, expect } from '@playwright/test';
import { trackErrors, botInPage } from './helpers.js';

const SAVE = 'overdrive-save-v1';
const HIGH_RANK_XP = 9e6; // rango máximo: todo desbloqueado

test('panel de modificadores: se activan, choques, bonus y se guardan', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript(([k, xp]) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(k, JSON.stringify({ v: 3, runs: 3, xp }));
    }
  }, [SAVE, HIGH_RANK_XP]);
  await page.goto('/?nosw');
  if (await page.locator('#btnRunner').isVisible()) await page.locator('#btnRunner').click(); // los modos del Runner están en su pantalla
  await page.locator('#btnMods').click();
  await expect(page.locator('#modList .mod')).toHaveCount(12);
  await page.locator('[data-mod="turbo"]').click();
  await page.locator('[data-mod="glass"]').click();
  await expect(page.locator('#modTotal')).toContainText('x2.08');
  await page.locator('[data-mod="fragile"]').click(); // choca con Cristal: lo sustituye
  await expect(page.locator('[data-mod="glass"]')).not.toHaveClass(/\bon\b/);
  await expect(page.locator('[data-mod="fragile"]')).toHaveClass(/\bon\b/);
  await page.reload();
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).modsLast, SAVE)).toEqual(['turbo', 'fragile']);
  // RUNNER usa lo elegido
  if (await page.locator('#btnRunner').isVisible()) await page.locator('#btnRunner').click(); // los modos del Runner están en su pantalla
  await page.locator('#btnPlay').click();
  await page.waitForFunction(() => window.G?.mode === 'play' || document.querySelector('#hud:not(.hidden)'));
  await expect(page.locator('#modTag')).toHaveText('🚀🩹');
  expect(errors).toEqual([]);
});

test('lo bloqueado no se puede activar ni colar en la partida', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ v: 3, runs: 3, xp: 0, modsLast: ['turbo', 'glass'] })), SAVE);
  await page.goto('/?debug&nosw&seed=4');
  await page.waitForFunction(() => !!window.G);
  if (await page.locator('#btnRunner').isVisible()) await page.locator('#btnRunner').click(); // los modos del Runner están en su pantalla
  await page.locator('#btnMods').click();
  await expect(page.locator('[data-mod="glass"]')).toHaveClass(/locked/);
  await page.locator('[data-mod="glass"]').click();
  await page.evaluate(() => { window.G.manual = true; });
  await page.locator('#btnModsPlay').click();
  expect(await page.evaluate(() => [...window.G.run.mods])).toEqual(['turbo']);
});

test('mutación del día: dos modificadores, misma pista y x1,5 gemas solo la primera vez', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ v: 3, runs: 3 })), SAVE);
  await page.goto('/?debug&nosw');
  await page.waitForFunction(() => !!window.G);
  const run = async () => {
    await page.evaluate(() => { window.G.manual = true; window.G.god = false; });
    if (await page.locator('#btnRunner').isVisible()) await page.locator('#btnRunner').click(); // los modos del Runner están en su pantalla
    await page.locator('#btnMutation').click();
    const track = await page.evaluate(() => {
      for (let i = 0; i < 60; i++) window.D.step(1 / 60, false);
      return { mods: [...window.G.run.mods], objs: window.G.run.objects.slice(0, 20).map((o) => `${o.type}${o.lane}`).join() };
    });
    // morir a propósito para ver el premio
    await page.evaluate(() => {
      const G = window.G;
      G.run.shields = 0; G.run.lastStand = false; G.run.shieldCap = 0;
      G.player.invuln = 0;
      const o = { type: 'wall', x: G.player.x, y0: 0, y1: 2, z: G.run.dist, alive: true };
      import('/js/game.js').then((m) => m.onHit(o));
    });
    await page.waitForFunction(() => window.G.mode === 'dying' || window.G.mode === 'dead');
    const res = await page.evaluate(() => window.G.run.result);
    await page.evaluate(() => document.getElementById('btnMenu').click());
    return { ...track, bonus: res.mutationBonus };
  };
  const a = await run();
  expect(a.mods.length).toBe(2);
  expect(a.bonus).toBe(true);
  const b = await run();
  expect(b.objs).toBe(a.objs);
  expect(b.mods).toEqual(a.mods);
  expect(b.bonus).toBe(false);
});

// Equidad: con cada modificador que cambia la pista, el bot sobrevive sin golpes
for (const mod of ['turbo', 'chaos', 'mines', 'hunter', 'greed', 'lowgrav', 'nodash', 'bosses']) {
  for (const seed of [5, 77]) {
    test(`equidad con ${mod} (semilla ${seed}): el bot sobrevive 60 s sin golpes`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(`/?debug&nosw&seed=${seed}&mods=${mod}`);
      await page.waitForFunction(() => !!window.G);
      await page.evaluate(() => { window.G.manual = true; });
      if (await page.locator('#btnRunner').isVisible()) await page.locator('#btnRunner').click(); // los modos del Runner están en su pantalla
      await page.locator('#btnPlay').click();
      await page.waitForFunction(() => window.G.mode === 'play');
      expect(await page.evaluate(() => [...window.G.run.mods])).toEqual([mod]);
      const res = await page.evaluate(botInPage, { seconds: 60 });
      expect(res.hits, `golpes: ${JSON.stringify(res.hits)}`).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}
