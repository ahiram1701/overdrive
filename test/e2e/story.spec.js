import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

// GALAXIA (E4): fabricación, historia LA SEÑAL y el Devorador de Estrellas
async function startGalaxy(page, extra = {}) {
  await page.addInitScript((x) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('overdrive-save-v1', JSON.stringify({ v: 4, runs: 5, settings: { sound: false }, galaxy: { started: true, credits: 5000, up: { missile: 2 } }, ...x }));
  }, extra);
  await page.goto('/?debug&nosw&seed=3');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; });
  await page.locator('#btnGalaxy').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
}

test('taller: fabricar el láser doble lo monta y dispara dos rayos', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { galaxyMats: { chatarra: 20, circuitos: 5 } });
  await page.evaluate(() => window.D.step(1 / 30, false));
  await page.locator('#btnDock').click();
  await page.locator('[data-gear="laser2"]').click();
  await expect(page.locator('#stSlots .slot.full')).toContainText('Láser doble');
  const sv = await page.evaluate(() => ({ c: window.__save.galaxy.credits, m: window.__save.galaxyMats.chatarra }));
  expect(sv).toEqual({ c: 5000 - 900, m: 12 });
  await page.evaluate(() => document.getElementById('btnUndock').click());
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  const shots = await page.evaluate(() => {
    const s = window.G.space;
    s.bolts = [];
    s.botFire = true;
    window.D.step(1 / 60, false);
    s.botFire = false;
    return s.bolts.length;
  });
  expect(shots).toBe(2);
  expect(errors).toEqual([]);
});

test('historia: el capítulo 1 se cuenta en un diálogo y se completa en la baliza', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  await expect(page.locator('#dialog')).toBeVisible();
  await expect(page.locator('#dlName')).toHaveText('Dra. Ilen');
  await page.locator('#btnDialog').click();
  await page.locator('#btnDialog').click();
  await expect(page.locator('#dialog')).toBeHidden();
  await page.evaluate(() => window.D.step(1 / 30, false));
  await expect(page.locator('#shObjective')).toContainText('Cap. 1');
  // vuela a la baliza y quédate 2 s
  const res = await page.evaluate(() => {
    const s = window.G.space;
    s.ship.pos = { ...s.storyMarker };
    s.ship.throttle = 0;
    for (let i = 0; i < 150; i++) window.D.step(1 / 60, false);
    return window.__save.story.ch;
  });
  expect(res).toBe(1);
  await expect(page.locator('#dlName')).toHaveText('La Señal'); // cierre del capítulo
  expect(errors).toEqual([]);
});

test('el Devorador: invulnerable con ojos, núcleo al caer los 3, furia y derrota', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { story: { ch: 7, n: 0, seen: { 7: true } } });
  const hit = (src) => page.evaluate((x) => {
    const s = window.G.space, d = s.devourer;
    const t = new Function('d', `return ${x}`)(d);
    s.bolts.push({ pos: { ...t.pos }, vel: { x: 0, y: 0, z: 0 }, life: 1, dmg: 400 });
    window.D.step(1 / 60, false);
    return s.devourer ? { phase: s.devourer.phase, hp: s.devourer.hp, eyes: s.devourer.eyes.filter((e) => e.alive).length } : null;
  }, src);
  await page.evaluate(() => { window.G.god = true; window.__devourer(); window.D.step(1 / 60, false); });
  const before = await hit('d');
  expect(before.hp).toBe(4200); // con ojos, el núcleo no recibe daño
  let st = before;
  for (let i = 0; i < 6 && st.eyes > 0; i++) st = await hit('d.eyes.find((e) => e.alive)');
  expect(st.eyes).toBe(0);
  expect(st.phase).toBe(2);
  while (st && st.phase === 2) st = await hit('d');
  expect(st.phase).toBe(3);
  while (st) st = await hit('d');
  expect(await page.evaluate(() => window.G.space.devourer)).toBe(null);
  expect(errors).toEqual([]);
});
