// GALAXIA VIVA: siempre hay en qué gastar (flota, tripulación, seguro, Mk ∞) y la estación tiene su carácter
import { test, expect } from '@playwright/test';
import { trackErrors, stTab } from './helpers.js';

const SAVE = 'overdrive-save-v1';
async function startGalaxy(page, extra = {}) {
  const seedSave = { v: 3, runs: 5, tips: { galaxy: true, galCombat: true, dock: true }, story: { seen: { 0: true } }, ...extra };
  await page.addInitScript(([k, v]) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(k, JSON.stringify(v));
    }
  }, [SAVE, seedSave]);
  await page.goto('/?debug&nosw&seed=3');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; });
  await page.locator('#btnGalaxy').click();
  await page.locator('#btnGalGo').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
}

test('flota: compras un carguero, contratas tripulación y aseguras la nave; los cargueros pagan al volver', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { galaxy: { started: true, credits: 40000 } });
  await page.evaluate(() => { const s = window.G.space; s.ship.pos = { ...s.sys.station.pos }; window.D.step(1 / 30); });
  await page.locator('#btnDock').click();
  // la estación tiene nombre, tipo y su historia
  await expect(page.locator('#stLore')).toContainText('Puerto ORIGEN');
  await expect(page.locator('#stHist')).toContainText('📜');
  await stTab(page, 'fleet');
  await page.locator('#btnBuyFreighter').click();
  await expect(page.locator('[data-freighter]')).toHaveCount(1);
  await page.locator('[data-crew="pilot"]').click();
  await page.locator('#btnInsure').click();
  const f = await page.evaluate(() => window.__save.galaxyFleet);
  expect(f.ships.length).toBe(1);
  expect(f.crew.pilot).toBe(1);
  expect(f.insure).toBeGreaterThan(0);
  // un viaje por cada salto: se cobra al atracar
  await page.evaluate(() => { const fl = window.__save.galaxyFleet; fl.ships[0].bank = 500; });
  const c0 = await page.evaluate(() => window.__save.galaxy.credits);
  await page.locator('#btnUndock').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  await page.evaluate(() => { const s = window.G.space; s.ship.pos = { ...s.sys.station.pos }; window.D.step(1 / 30); });
  await page.locator('#btnDock').click();
  const c1 = await page.evaluate(() => window.__save.galaxy.credits);
  expect(c1).toBeGreaterThanOrEqual(c0 + 500);
  // y se guarda entero (cargueros y tripulación)
  await page.reload();
  await page.waitForFunction(() => !!window.__save);
  expect(await page.evaluate(() => window.__save.galaxyFleet.crew.pilot)).toBe(1);
  expect(errors).toEqual([]);
});

test('Mk ∞: tras el Mk 10 se sigue mejorando', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { galaxy: { started: true, credits: 9e6, up: { engine: 0, laser: 10, shield: 0, cargo: 0, jump: 0, missile: 0 } }, galaxyMats: { chatarra: 999, circuitos: 999, nucleos: 999 } });
  await page.evaluate(() => { const s = window.G.space; s.ship.pos = { ...s.sys.station.pos }; window.D.step(1 / 30); });
  await page.locator('#btnDock').click();
  await stTab(page, 'ship');
  await expect(page.locator('#stUpgrades [data-up="laser"]')).toContainText('Mk 11');
  await page.locator('#stUpgrades [data-up="laser"]').click();
  expect(await page.evaluate(() => window.__save.galaxy.up.laser)).toBe(11);
  expect(errors).toEqual([]);
});

test('economía viva: víveres con stock en el puerto, sonda, carta de navegación y el mapa con su sector', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { galaxy: { started: true, credits: 50000 } });
  await page.evaluate(() => { const s = window.G.space; s.ship.pos = { ...s.sys.station.pos }; window.D.step(1 / 30); });
  await page.locator('#btnDock').click();
  // ORIGEN es un puerto comercial: fabrica víveres (y se agotan al comprar)
  await stTab(page, 'market');
  const food = page.locator('[data-buy-good="food"]');
  await expect(food).toContainText('quedan 60');
  await food.click();
  expect(await page.evaluate(() => window.__save.galaxy.cargo.food)).toBe(5);
  await expect(page.locator('[data-buy-good="food"]')).toContainText('quedan 55');
  // (y el stock se guarda: al recargar sigue igual)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('overdrive-save-v1')).galaxyStock['0'].food)).toBe(55);
  // exploración de pago
  await stTab(page, 'fleet');
  await page.locator('#btnProbe').click();
  await page.locator('#btnChart').click();
  const g = await page.evaluate(() => ({ charted: window.__save.galaxy.charted.length, sectors: window.__save.galaxy.sectors.length, charts: window.__save.galaxy.charts }));
  expect(g.charted).toBeGreaterThan(20);
  expect(g.sectors).toBe(1);
  expect(g.charts).toBe(1);
  // acciones y pinturas
  await page.locator('#btnShare').click();
  await page.locator('[data-paint="g-deriva"]').click();
  expect(await page.evaluate(() => window.__save.crates.owned.includes('g-deriva'))).toBe(true);
  // el mapa: el sector nuevo con su nombre y el botón de centrar
  await page.locator('#btnUndock').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  await page.locator('#btnGalMap').click();
  await expect(page.locator('#gmSvg .gm-sector').first()).toBeAttached();
  await page.locator('#gmMe').click();
  expect(errors).toEqual([]);
});

test('tráfico: asaltar a un carguero lo derriba, suelta créditos y te sube la búsqueda', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem(k, JSON.stringify(v)); } },
    [SAVE, { v: 3, runs: 5, tips: { galaxy: true, galCombat: true, dock: true }, story: { seen: { 0: true } }, galaxy: { started: true, credits: 1000 } }]);
  await page.goto('/?debug&nosw&seed=3&traffic');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; });
  await page.locator('#btnGalaxy').click();
  await page.locator('#btnGalGo').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy' && window.G.space.traffic?.length > 0);
  const r = await page.evaluate(() => {
    const s = window.G.space, n = s.traffic.find((x) => x.kind === 'trader');
    const w0 = window.__save.galaxy.wanted || 0, loot0 = s.loot.length;
    for (let i = 0; i < 40 && n.away <= 0; i++) {
      s.bolts.push({ pos: { ...n.pos }, vel: { x: 0, y: 0, z: 0 }, life: 0.5, dmg: 50 });
      window.D.step(1 / 30);
    }
    return { gone: n.away > 0, wanted: (window.__save.galaxy.wanted || 0) - w0, loot: s.loot.length - loot0 };
  });
  expect(r.gone).toBe(true);
  expect(r.wanted).toBe(1);
  expect(r.loot).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
