// UI/UX: el menú de Pecios con su GUÍA aparte, el botín con ▲/▼, botones de al menos 44 px en el HUD de Pecios,
// avisos de «no te alcanza» con su motivo y la pantalla final ordenada
import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

const SAVE = 'overdrive-save-v1';
async function boot(page, extra = {}) {
  await page.addInitScript(([k, x]) => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem(k, JSON.stringify({ v: 6, runs: 5, settings: { sound: false }, ...x })); }, [SAVE, extra]);
  await page.goto('/?debug&nosw&seed=7');
  await page.waitForFunction(() => !!window.G);
}

test('Pecios: el menú va al grano y la guía tiene su pantalla; el taller avisa si no te alcanza', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page, { pecio: { best: 2, runs: 1, piezas: 10, wins: 0 } });
  await page.locator('#btnPecio').click();
  await expect(page.locator('#pecioHub')).toBeVisible();
  await expect(page.locator('#pecioHub')).not.toContainText('Enemigos');
  await page.locator('[data-pup="hull"]').click();
  await expect(page.locator('#toast')).toContainText('Faltan');
  await page.locator('#btnPecioGuide').click();
  await expect(page.locator('#pecioGuide')).toBeVisible();
  await expect(page.locator('#pecioGuide')).toContainText('Enemigos');
  await expect(page.locator('#pecioGuide')).toContainText('Jefes');
  await page.locator('#pecioGuide .scr-back').click();
  await expect(page.locator('#pecioHub')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Pecios: el botín compara estadística a estadística (▲/▼) y el HUD tiene botones de 44 px', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await page.locator('#btnPecio').click();
  await page.locator('#btnPecioPlay').click();
  await page.waitForFunction(() => window.G.mode === 'pecio');
  await page.evaluate(() => { const s = window.G.pecio; s.player.bag.kit = 1; s.hudSig = null; });
  await expect(page.locator('#pcBagBar .pc-cons')).toHaveCount(1);
  for (const b of await page.locator('#pecioHud .pc-btn, #pecioHud .pc-cons').all()) {
    const bb = await b.boundingBox();
    expect(Math.min(bb.width, bb.height)).toBeGreaterThanOrEqual(44);
  }
  // un arma peor que la que llevas: ▼ en lo que pierdes
  await page.evaluate(() => {
    const s = window.G.pecio;
    s.player.gear.weapon = { id: 'mine', slot: 'weapon', kind: 'rapid', tier: 2, dmg: 3, rate: 1.2, bounces: 0, orbs: 0 };
    s.rooms[s.at].pickups.push({ id: 'x', kind: 'item', item: { id: 'new', slot: 'weapon', kind: 'rapid', tier: 0, dmg: 1, rate: 1, bounces: 0, orbs: 0 }, x: s.player.x, y: s.player.y - 0.2 });
  });
  await expect(page.locator('#pecioShop')).toBeVisible();
  await expect(page.locator('.loot-diff li.down')).not.toHaveCount(0);
  await expect(page.locator('.loot-diff')).toContainText('de daño');
  expect(errors).toEqual([]);
});

test('Pecios: la pantalla final pone las 4 cifras en una fila y los premios en filas', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await page.locator('#btnPecio').click();
  await page.locator('#btnPecioPlay').click();
  await page.waitForFunction(() => window.G.mode === 'pecio');
  await page.evaluate(() => {
    const s = window.G.pecio;
    s.player.hp = 1; s.player.inv = 0; s.player.piezas = 30;
    const room = s.rooms[s.at];
    room.wake = 0;
    room.enemies = [{ id: 'x', kind: 'drone', x: s.player.x + 0.6, y: s.player.y, ang: 0, hp: 999, max: 999, r: 0.32, cd: 0, charge: 0, aim: null, fuse: null, stun: 0, hitT: 0, alive: true }];
  });
  await expect(page.locator('#pecioEnd')).toBeVisible({ timeout: 15000 });
  const tops = await page.locator('#peGrid > div').evaluateAll((d) => d.map((x) => Math.round(x.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  await expect(page.locator('#pePiezas .pe-row').first()).toContainText('🔩');
  expect(errors).toEqual([]);
});
