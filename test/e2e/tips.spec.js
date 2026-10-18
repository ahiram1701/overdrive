import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

const SAVE = 'overdrive-save-v1';
const fresh = (page) => page.addInitScript((k) => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem(k, JSON.stringify({ v: 6, runs: 5 })); }, SAVE);

test('primeros pasos: la GUÍA explica la Galaxia y pausa; luego empieza la historia; no se repite', async ({ page }) => {
  const errors = trackErrors(page);
  await fresh(page);
  await page.goto('/?debug&nosw&tips');
  await page.waitForFunction(() => !!window.G);
  await page.locator('#btnGalaxy').click();
  await expect(page.locator('#dialog')).toBeVisible();
  await expect(page.locator('#dlName')).toHaveText('GUÍA');
  // el fin de un salto pone el modo en 'galaxy': aun así, nada se mueve mientras lees
  const still = await page.evaluate(async () => {
    const s = window.G.space;
    window.G.mode = 'galaxy';
    const p0 = { ...s.ship.pos }, t0 = s.t;
    await new Promise((r) => setTimeout(r, 700));
    return s.t === t0 && s.ship.pos.x === p0.x && s.ship.pos.z === p0.z;
  });
  expect(still).toBe(true);
  for (let i = 0; i < 3; i++) await page.locator('#btnDialog').click();
  // después de la GUÍA, la historia (no se pisan), que también pausa
  await expect(page.locator('#dlName')).toHaveText('Dra. Ilen');
  expect(await page.evaluate(() => window.G.dialogPause)).toBe(true);
  for (let i = 0; i < 2; i++) await page.locator('#btnDialog').click();
  await expect(page.locator('#dialog')).toBeHidden();
  const moves = await page.evaluate(async () => { const t0 = window.G.space.t; await new Promise((r) => setTimeout(r, 500)); return window.G.space.t > t0; });
  expect(moves).toBe(true); // al cerrar, sigue
  expect(await page.evaluate(() => window.__save.tips.galaxy)).toBe(true);
  expect(errors).toEqual([]);
});

test('primeros pasos: la Arena también pausa con su consejo, y en Ajustes se pueden repetir', async ({ page }) => {
  const errors = trackErrors(page);
  await fresh(page);
  await page.goto('/?debug&nosw&tips');
  await page.waitForFunction(() => !!window.G);
  await page.locator('#btnArena').click();
  await page.locator('#arenaMaps [data-map="grid"]').click();
  await expect(page.locator('#dlName')).toHaveText('GUÍA');
  const t0 = await page.evaluate(() => { window.G.mode = 'arena'; return window.G.arena.time; });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.G.arena.time)).toBe(t0); // en pausa de verdad, aunque el modo diga 'arena'
  for (let i = 0; i < 3; i++) await page.locator('#btnDialog').click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.G.arena.time)).toBeGreaterThan(t0);
  // otra partida: ya no sale
  await page.evaluate(async () => { const { newArena } = await import('/js/arena.js'); newArena({ map: 'grid' }); });
  await expect(page.locator('#dialog')).toBeHidden();
  // Ajustes → repetir consejos
  await page.evaluate(async () => { const { ui } = await import('/js/ui.js'); ui.showMenu(); });
  await page.locator('#btnSettings').click();
  await page.locator('#btnTipsReset').click();
  expect(await page.evaluate(() => Object.keys(window.__save.tips).length)).toBe(0);
  expect(errors).toEqual([]);
});

test('primeros pasos: en los tests (sin ?tips) no sale nada', async ({ page }) => {
  await fresh(page);
  await page.goto('/?debug&nosw');
  await page.waitForFunction(() => !!window.G);
  await page.locator('#btnArena').click();
  await page.locator('#arenaMaps [data-map="grid"]').click();
  await expect(page.locator('#dialog')).toBeHidden();
  expect(await page.evaluate(() => window.G.mode)).toBe('arena');
});

test('primeros pasos: en tu primera partida del Runner la GUÍA para la carrera aunque algo la reanude', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem(k, JSON.stringify({ v: 6, runs: 0 })); }, SAVE);
  await page.goto('/?debug&nosw&tips');
  await page.waitForFunction(() => !!window.G);
  await page.locator('#btnRunner').click();
  await page.locator('#btnPlay').click();
  await expect(page.locator('#dlName')).toHaveText('GUÍA');
  const r = await page.evaluate(async () => {
    const { resume } = await import('/js/game.js');
    resume(); // como al elegir una carta: el modo vuelve a 'play'
    const r0 = window.G.run, d0 = r0.dist, t0 = r0.time;
    await new Promise((res) => setTimeout(res, 1000));
    return { d: r0.dist - d0, t: r0.time - t0, mode: window.G.mode };
  });
  expect(r.mode).toBe('play');
  expect(r.d).toBe(0);
  expect(r.t).toBe(0);
  // y si otra pantalla tapa el diálogo, la partida no se queda congelada
  await page.evaluate(() => document.getElementById('dialog').classList.add('hidden'));
  const after = await page.evaluate(async () => { const r0 = window.G.run, d0 = r0.dist; await new Promise((res) => setTimeout(res, 500)); return r0.dist - d0; });
  expect(after).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
