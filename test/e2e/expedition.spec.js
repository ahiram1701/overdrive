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

test('reliquias: se eligen en su panel, salen en el mapa y el Escudo de cristal para un golpe; 4.º acto tras ganar', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ v: 6, runs: 5, expedition: { best: 30, wins: 1 } })), SAVE);
  await page.goto('/?debug&nosw&seed=4');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; });
  await page.locator('#btnRunner').click();
  await page.locator('#btnExpedition').click();
  await page.waitForFunction(() => window.G.mode === 'play');
  expect(await page.evaluate(() => window.G.run.exp.total)).toBe(4);
  // elegir una reliquia en el panel (el mismo de los eventos)
  await page.evaluate(async () => {
    const { ui } = await import('/js/ui.js');
    const { relicEvent } = await import('/js/expedition.js');
    window.G.mode = 'event';
    ui.showExpEvent(relicEvent(['cristal', 'avaro', 'brasa']), window.G.run);
  });
  await expect(page.locator('#expEvent')).toContainText('RELIQUIA');
  await page.locator('#eeChoices [data-choice="0"]').click();
  await expect(page.locator('#expMap')).toBeVisible();
  await expect(page.locator('#emStatus .em-relics')).toContainText('🛡️');
  // el Escudo de cristal: el primer golpe del tramo no quita escudo
  const hit = await page.evaluate(async () => {
    const { onHit } = await import('/js/game.js');
    const r = window.G.run;
    r.shields = 1;
    window.G.player.invuln = 0;
    onHit({ type: 'wall', x: 0, y0: 0, y1: 9, alive: true });
    const first = r.shields;
    window.G.player.invuln = 0;
    onHit({ type: 'wall', x: 0, y0: 0, y1: 9, alive: true });
    return { first, second: r.shields, used: r.crystalUsed };
  });
  expect(hit).toEqual({ first: 1, second: 0, used: true });
  // FORJA: sube cartas de nivel
  const forge = await page.evaluate(async () => {
    const { expEventChoice } = await import('/js/game.js');
    const { FORGE } = await import('/js/expedition.js');
    const r = window.G.run;
    r.cards = { iman: 1, chatarrero: 1 };
    const before = Object.values(r.cards).reduce((a, b) => a + b, 0);
    window.G.mode = 'event';
    expEventChoice(FORGE, 0);
    return { gained: Object.values(r.cards).reduce((a, b) => a + b, 0) - before, mode: window.G.mode };
  });
  expect(forge.gained).toBe(2);
  expect(forge.mode).toBe('map');
  expect(errors).toEqual([]);
});
