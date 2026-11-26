// Lo que faltaba del plan, en el juego: novedades en los menús, bóveda de varios huecos, la estación abandonada
// con oleadas, la nebulosa sin radar y la comparación de chips
import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

const SAVE = 'overdrive-save-v1';
async function boot(page, extra = {}) {
  const seedSave = { v: 6, runs: 5, settings: { sound: false }, tips: { galaxy: true, galCombat: true, dock: true, pecio: true }, story: { seen: { 0: true } }, ...extra };
  await page.addInitScript(([k, v]) => {
    if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem(k, JSON.stringify(v)); }
  }, [SAVE, seedSave]);
  await page.goto('/?debug&nosw&seed=3');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; });
}
async function fly(page) {
  await page.locator('#btnGalaxy').click();
  await page.locator('#btnGalGo').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
}

test('novedades: tarjeta en Pecios y en Galaxia, abierta la primera vez y con su punto', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page, { pecio: { best: 3, runs: 2, piezas: 0, wins: 0, vaultOpen: true }, pecioUp: { vaultPlus: 2 } });
  await page.locator('#btnPecio').click();
  const pn = page.locator('#news-pecio');
  await expect(pn).toBeVisible();
  await expect(pn).toContainText('NOVEDADES DE PECIOS');
  await expect(pn).toContainText('Fragmentador');
  expect(await pn.evaluate((d) => d.open)).toBe(true);
  // la bóveda ampliada: 3 huecos
  await expect(page.locator('#phVault')).toContainText('3 huecos');
  expect(await page.evaluate(() => window.__save.news.pecio)).toBe(1);
  await page.goto('/?debug&nosw&seed=3');
  await page.waitForFunction(() => !!window.G);
  await page.locator('#btnGalaxy').click();
  await expect(page.locator('#news-galaxy')).toContainText('Ciclo+');
  // la de Pecios ya vista: cerrada y sin punto
  await page.goto('/?debug&nosw&seed=3');
  await page.waitForFunction(() => !!window.G);
  await page.locator('#btnPecio').click();
  expect(await page.locator('#news-pecio').evaluate((d) => d.open)).toBe(false);
  await expect(page.locator('#news-pecio .news-dot')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('estación abandonada: 3 oleadas de guardianes y luego su botín', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page, { galaxy: { started: true, credits: 1000 } });
  await fly(page);
  const res = await page.evaluate(() => {
    const s = window.G.space, g = window.__save.galaxy;
    s.pois.push({ id: 'test-derelict', sys: s.sysId, kind: 'derelict', pos: { ...s.ship.pos }, reward: 100, lore: 'x' });
    s.ship.throttle = 0;
    const waves = [];
    for (let i = 0; i < 160 && !s.derelict; i++) { s.pois.at(-1).pos = { ...s.ship.pos }; window.D.step(1 / 30, false); }
    const c0 = g.credits;
    for (let k = 0; k < 6 && s.derelict; k++) {
      waves.push(s.derelict.wave);
      for (const p of s.pirates) if (p.derelict) p.alive = false;
      window.D.step(1 / 30, false);
    }
    return { waves, done: !s.derelict, gain: g.credits - c0 };
  });
  expect(res.waves).toEqual([1, 2, 3]);
  expect(res.done).toBe(true);
  expect(res.gain).toBeGreaterThan(300);
  expect(errors).toEqual([]);
});

test('nebulosa: dentro, sin radar (y avisa)', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page, { galaxy: { started: true } });
  await fly(page);
  const r = await page.evaluate(async () => {
    const { NEBULA_R } = await import('/js/spaceGame.js');
    const s = window.G.space;
    s.ship.throttle = 0;
    window.D.step(1 / 30, false);
    const before = !!s.fogged;
    s.pois.push({ id: 'test-neb', sys: s.sysId, kind: 'nebula', pos: { x: s.ship.pos.x + NEBULA_R / 2, y: s.ship.pos.y, z: s.ship.pos.z }, reward: 0, lore: 'x' });
    window.D.step(1 / 30, false);
    return { before, after: !!s.fogged };
  });
  expect(r).toEqual({ before: false, after: true });
  expect(errors).toEqual([]);
});

test('chips: se comparan con los montados (suma total y ▲/▼)', async ({ page }) => {
  const errors = trackErrors(page);
  const chip = (id, tier, v) => ({ id, tier, affixes: [{ k: 'dmg', v }] });
  await boot(page, { galaxy: { started: true }, galaxyChips: { bag: [chip('a', 1, 6), chip('b', 1, 5), chip('c', 2, 12), chip('d', 0, 2)], on: ['a', 'b'] } });
  await fly(page);
  await page.evaluate(() => { const s = window.G.space; s.ship.pos = { ...s.sys.station.pos }; window.D.step(1 / 30, false); });
  await page.locator('#btnDock').click();
  await expect(page.locator('#stChips .chip-total')).toContainText('+11% daño');
  await expect(page.locator('#stChips')).toContainText('▲ mejor que uno montado');
  await expect(page.locator('#stChips')).toContainText('▼ peor que los montados');
  expect(errors).toEqual([]);
});
