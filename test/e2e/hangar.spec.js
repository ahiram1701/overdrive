import { test, expect } from '@playwright/test';
import { trackErrors, botInPage } from './helpers.js';

const SAVE = 'overdrive-save-v1';

test('hangar: comprar un nodo del árbol descuenta gemas y persiste tras recargar', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(k, JSON.stringify({ v: 2, runs: 3, gems: 200, ship: 'viper', ships: ['viper'] }));
    }
  }, SAVE);
  await page.goto('/?nosw');
  await page.locator('#btnHangar').click();
  await expect(page.locator('#shipCarousel .ship-chip')).toHaveCount(7);
  await expect(page.locator('#shipTree .node')).toHaveCount(9);

  // BLINDAJE nivel 1 (40 💎) y luego nivel 2 (90 💎)
  await page.locator('#shipTree .b-a .node').nth(0).click();
  await page.locator('#shipTree .b-a .node').nth(1).click();
  await expect(page.locator('#hGems')).toHaveText('70');
  await expect(page.locator('#shipTree .b-a .node.bought')).toHaveCount(2);

  // nivel 3 cuesta 180: no hay gemas, no se compra
  await page.locator('#shipTree .b-a .node').nth(2).click();
  await expect(page.locator('#shipTree .b-a .node.bought')).toHaveCount(2);

  await page.reload();
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE);
  expect(saved.gems).toBe(70);
  expect(saved.shipLvl.viper).toEqual({ a: 2, b: 0, c: 0 });
  await page.locator('#btnHangar').click();
  await expect(page.locator('#shipTree .b-a .node.bought')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('hangar: no se puede mejorar una nave que no tienes', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ v: 2, runs: 3, gems: 999, ship: 'viper', ships: ['viper'] })), SAVE);
  await page.goto('/?nosw');
  await page.locator('#btnHangar').click();
  await page.locator('#shipCarousel .ship-chip').nth(5).click(); // Raptor, sin comprar
  await expect(page.locator('#btnBuyShip')).toBeVisible();
  await page.locator('#shipTree .b-a .node').nth(0).click();
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).gems, SAVE)).toBe(999);
  await page.locator('#btnBuyShip').click();
  await expect(page.locator('#shipCarousel .ship-chip.equipped b')).toHaveText('Raptor');
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).gems, SAVE)).toBe(599);
});

// Con el árbol al máximo (Último aliento, dash extra, habilidad mutada) el juego sigue siendo justo
for (const ship of ['viper', 'raptor', 'comet']) {
  test(`${ship} con el árbol al máximo: el bot usa la habilidad mutada y sobrevive`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.addInitScript(([k, s]) => localStorage.setItem(k, JSON.stringify({
      v: 2, runs: 3, ship: s, ships: ['viper', 'raptor', 'comet'], shipLvl: { [s]: { a: 3, b: 3, c: 3 } },
    })), [SAVE, ship]);
    await page.goto('/?debug&nosw&seed=17');
    await page.waitForFunction(() => !!window.G);
    await page.evaluate(() => { window.G.manual = true; document.getElementById('btnPlay').click(); });
    const st = await page.evaluate(() => ({ mut: window.G.run.ability.mut, last: window.G.run.lastStand, dash: window.G.run.stats.dashMax }));
    expect(st.mut).toBeTruthy();
    expect(st.last).toBe(true);
    expect(st.dash).toBe(2);
    const res = await page.evaluate(botInPage, { seconds: 60, ability: true });
    expect(res.uses).toBeGreaterThan(0);
    expect(res.hits, `golpes: ${JSON.stringify(res.hits)}`).toEqual([]);
    expect(errors).toEqual([]);
  });
}
