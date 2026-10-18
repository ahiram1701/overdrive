import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

const SAVE = 'overdrive-save-v1';
const seed = (page, v) => page.addInitScript(([k, val]) => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.setItem(k, JSON.stringify(val));
}, [SAVE, v]);

test('tienda: abrir un cofre de élite da un estilo nuevo que aparece en el hangar', async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page, { v: 4, runs: 3, gems: 2000 });
  await page.goto('/?nosw');
  await page.locator('#btnStore').click();
  await expect(page.locator('#store')).toBeVisible();
  await page.locator('[data-crate="elite"]').click();
  await expect(page.locator('#crateOpen')).toBeVisible();
  await expect(page.locator('#coItems .co-item')).toHaveCount(3);
  const sv = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE);
  expect(sv.gems).toBeLessThanOrEqual(2000 - 150 + 150); // cobra 150 (y quizá devuelve gemas de premio)
  expect(sv.crates.n).toBe(1);
  await page.locator('#btnCrateOk').click();
  await expect(page.locator('#store')).toBeVisible();
  expect(errors).toEqual([]);
});

test('potenciadores: comprar, activar y gastarse al empezar; Segunda vida revive', async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page, { v: 5, runs: 3, coins: 1000 });
  await page.goto('/?debug&nosw&seed=7');
  await page.waitForFunction(() => !!window.G);
  await page.locator('#btnStore').click();
  await page.locator('#stTabs [data-tab="boosts"]').click();
  await page.locator('[data-boost="life"] .bs-buy').click();
  await page.locator('[data-boost="life"] .bs-use').click();
  await expect(page.locator('[data-boost="life"]')).toHaveClass(/on/);
  await page.locator('#store .scr-back').click();
  await page.locator('#btnRunner').click();
  await expect(page.locator('#mBoosts')).toHaveText('❤️');
  expect(await page.evaluate(() => window.__save.coins)).toBe(1000 - 600);
  await page.evaluate(() => { window.G.manual = true; document.getElementById('btnPlay').click(); });
  await page.waitForFunction(() => window.G.mode === 'play');
  const res = await page.evaluate(async () => {
    const { onHit } = await import('/js/game.js');
    const r = window.G.run;
    r.shields = 0;
    const o = r.objects.find((x) => x.alive && x.type !== 'coin') || { type: 'wall', x: 0, z: r.dist + 1, y0: 0, y1: 1, alive: true };
    onHit(o);
    return { mode: window.G.mode, dead: !!window.G.player.dead, left: r.extraLife, stock: window.__save.boosts.life };
  });
  expect(res).toEqual({ mode: 'play', dead: false, left: 0, stock: 0 });
  expect(errors).toEqual([]);
});

test('las monedas que sobran al morir van a tu cartera de 🪙 y los créditos no cambian', async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page, { v: 5, runs: 3 });
  await page.goto('/?debug&nosw&seed=7');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; document.getElementById('btnPlay').click(); });
  await page.waitForFunction(() => window.G.mode === 'play');
  await page.evaluate(async () => {
    const { onHit } = await import('/js/game.js');
    const r = window.G.run;
    r.coins = 77;
    r.shields = 0;
    onHit(r.objects.find((x) => x.alive && x.type !== 'coin') || { type: 'wall', x: 0, z: r.dist + 1, y0: 0, y1: 1, alive: true });
    window.D.step(2, false);
  });
  await expect(page.locator('#death')).toBeVisible();
  await expect(page.locator('#dGems')).toContainText('+77 🪙');
  expect(await page.evaluate(() => ({ coins: window.__save.coins, credits: window.__save.galaxy.credits }))).toEqual({ coins: 77, credits: 0 });
  expect(errors).toEqual([]);
});

test('talentos: se compran en orden y el hangar ya no tiene la pestaña GLOBAL', async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page, { v: 5, runs: 3, coins: 4000 });
  await page.goto('/?nosw');
  await page.locator('#btnHangar').click();
  await expect(page.locator('#hTabs button')).toHaveCount(4);
  await page.locator('#btnStore').click();
  await page.locator('#stTabs [data-tab="talents"]').click();
  await page.locator('[data-talent="r2"]').click();
  await expect(page.locator('[data-talent="r2"]')).not.toHaveClass(/bought/);
  await page.locator('[data-talent="r1"]').click();
  await expect(page.locator('[data-talent="r1"]')).toHaveClass(/bought/);
  await expect(page.locator('#stCoinsW')).toHaveText('3.2K');
  await expect(page.locator('[data-talent^="g"]')).toHaveCount(0); // los de la Galaxia están en sus estaciones
  expect(errors).toEqual([]);
});

test('mazo y arsenal: desbloquear una carta, subir su maestría y comprar un arma de la Arena', async ({ page }) => {
  const errors = trackErrors(page);
  await seed(page, { v: 5, runs: 3, gems: 600, coins: 1000 });
  await page.goto('/?nosw');
  await page.locator('#btnCodex').click();
  await page.locator('[data-card="turbo"] .dk-buy').click();
  await expect(page.locator('[data-card="turbo"] .dk-up')).toBeVisible();
  await page.locator('[data-card="iman"] .dk-up').click();
  await expect(page.locator('[data-card="iman"] .dk-body i')).toHaveText('★☆☆');
  await page.locator('#btnStore').click();
  await page.locator('#stTabs [data-tab="talents"]').click();
  await page.locator('[data-weapon="mines"]').click();
  await expect(page.locator('[data-weapon="mines"]')).toHaveClass(/bought/);
  const sv = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE);
  expect(sv.cardsOwned.turbo).toBe(true);
  expect(sv.cardLvl.iman).toBe(1);
  expect(sv.arenaWeapons.mines).toBe(true);
  expect(sv.gems).toBe(600 - 60 - 250);
  expect(sv.coins).toBe(1000 - 400);
  expect(errors).toEqual([]);
});
