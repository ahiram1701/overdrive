import { test, expect } from '@playwright/test';
import { trackErrors, botInPage } from './helpers.js';

const SAVE = 'overdrive-save-v1';

test.setTimeout(240000);

test('expedición: el bot recorre el acto 1 eligiendo en el mapa y llega al acto 2', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ v: 3, runs: 5 })), SAVE);
  await page.goto('/?debug&nosw&seed=4');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; window.G.god = true; });
  if (await page.locator('#btnRunner').isVisible()) await page.locator('#btnRunner').click(); // los modos del Runner están en su pantalla
  await page.locator('#btnExpedition').click();
  await page.waitForFunction(() => window.G.mode === 'play');
  expect(await page.evaluate(() => window.G.run.exp.act)).toBe(0);

  const seen = new Set();
  for (let step = 0; step < 80; step++) {
    const st = await page.evaluate(() => ({ mode: window.G.mode, act: window.G.run?.exp?.act }));
    if (st.act >= 1) break;
    seen.add(st.mode);
    if (st.mode === 'play') {
      await page.evaluate(botInPage, { seconds: 120, god: true });
    } else if (st.mode === 'map') {
      await expect(page.locator('#expMap')).toBeVisible();
      await page.locator('#emMap .em-node.open').first().click();
    } else if (st.mode === 'event') {
      await page.locator('#eeChoices button:not([disabled])').first().click();
    } else if (st.mode === 'rest') {
      await page.locator('#btnRestShield').click();
    } else if (st.mode === 'cards') {
      await page.locator('#cardRow .card').first().click();
    } else if (st.mode === 'shop') {
      await page.evaluate(() => document.getElementById('btnShopDone').click());
    } else if (st.mode === 'chest') {
      await page.locator('#btnChestOk').click({ timeout: 5000 }).catch(() => page.evaluate(() => document.getElementById('btnChestOk').click()));
    } else {
      throw new Error(`modo inesperado: ${st.mode}`);
    }
  }
  const e = await page.evaluate(() => ({ act: window.G.run.exp.act, acts: window.G.run.exp.acts, path: window.G.run.exp.path.length }));
  expect(e.act).toBe(1);
  expect(e.acts).toBe(1);
  expect(seen.has('map')).toBe(true);
  expect(errors).toEqual([]);
});

test('expedición: un evento aplica su efecto y vuelve al mapa; el descanso da un escudo', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?debug&nosw&seed=4');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; });
  if (await page.locator('#btnRunner').isVisible()) await page.locator('#btnRunner').click(); // los modos del Runner están en su pantalla
  await page.locator('#btnExpedition').click();
  await page.waitForFunction(() => window.G.mode === 'play');
  const res = await page.evaluate(async () => {
    const G = window.G, r = G.run;
    const { expEventChoice, expRest } = await import('/js/game.js');
    const { EVENT_BY_ID } = await import('/js/expedition.js');
    r.coins = 100;
    G.mode = 'event';
    expEventChoice(EVENT_BY_ID.gemtrader, 0); // 50 monedas por 15 gemas
    const afterEvent = { mode: G.mode, coins: r.coins };
    G.mode = 'rest';
    const sh = r.shields;
    expRest('shield');
    return { afterEvent, shieldsGained: r.shields - sh, mode: G.mode };
  });
  expect(res.afterEvent).toEqual({ mode: 'map', coins: 50 });
  expect(res.shieldsGained).toBe(1);
  expect(res.mode).toBe('map');
  await expect(page.locator('#expMap')).toBeVisible();
  await expect(page.locator('#emMap .em-node.open').first()).toBeVisible();
  expect(errors).toEqual([]);
});
