// DEPURACIÓN: sobrecarga que se llena y se guarda, incursión aislada, saltos, pecio, Arena sin fin y teclas
import { test, expect } from '@playwright/test';
import { trackErrors, stTab } from './helpers.js';

const SAVE = 'overdrive-save-v1';
const TIPS = { galaxy: true, galCombat: true, galRisk: true, dock: true, arena: true };
async function boot(page, seedSave = { v: 3, runs: 5, tips: TIPS }) {
  await page.addInitScript(([k, v]) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(k, JSON.stringify(v));
    }
  }, [SAVE, seedSave]);
  await page.goto('/?debug&nosw&seed=3');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; });
}
async function galaxy(page) {
  await page.locator('#btnGalaxy').click();
  await page.locator('#btnGalGo').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  await page.evaluate(() => { const sh = window.G.space.ship; sh.pos = { x: 1500, y: 0, z: 1500 }; sh.throttle = 0; window.D.step(1 / 30, false); });
}
const killN = (page, n) => page.evaluate((k) => {
  const s = window.G.space;
  for (let i = 0; i < k; i++) {
    window.__pirate('fighter', null, 150);
    const p = s.pirates.at(-1);
    Object.assign(p, { hp: 1, speed: 0, state: 'patrol' });
    s.bolts.push({ pos: { ...p.pos }, vel: { x: 0, y: 0, z: 0 }, life: 0.1, dmg: 99 });
    window.D.step(0.1, false);
  }
  return s.combat.surge;
}, n);

test('sobrecarga: 5 bajas la llenan, el botón muestra el % y sigue cargada al volver a la Galaxia', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await galaxy(page);
  expect(await killN(page, 2)).toBeCloseTo(0.44, 2);
  await page.evaluate(() => window.D.step(1 / 30));
  await expect(page.locator('#btnSurge .pct')).toHaveText('44%');
  expect(await killN(page, 3)).toBe(1);
  // salir al menú y volver
  await page.locator('#spacePause').click();
  await page.locator('#btnQuit').click();
  await expect(page.locator('#btnGalaxy')).toBeVisible();
  await page.locator('#btnGalaxy').click();
  await page.locator('#btnGalGo').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  await page.evaluate(() => window.D.step(1 / 30));
  expect(await page.evaluate(() => window.G.space.combat.surge)).toBe(1);
  await expect(page.locator('#btnSurge')).toHaveClass(/ready/);
  expect(errors).toEqual([]);
});

test('incursión aislada: tu casco y lo del sistema vuelven al acabar; la baliza no sirve dentro; morir entre oleadas las cuenta', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page, { v: 3, runs: 5, tips: TIPS, galaxyItems: { beacon: 1 } });
  await page.locator('#btnGalaxy').click();
  await page.locator('#btnGalGo').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  const before = await page.evaluate(() => {
    const s = window.G.space;
    window.__pirate('fighter', null, 900);
    s.pirates.at(-1).keep = true;
    s.ship.hull = 30;
    s.ship.pos = { ...s.sys.station.pos };
    window.D.step(1 / 30);
    return s.pirates.length;
  });
  await page.locator('#btnDock').click();
  await stTab(page, 'jobs');
  await page.locator('#btnIncursion').click();
  const res = await page.evaluate(() => {
    const s = window.G.space;
    window.G.god = true;
    const hullIn = s.ship.hull;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '5' })); // baliza (tecla 5)
    window.dispatchEvent(new KeyboardEvent('keyup', { key: '5' }));
    const stillIn = !!s.incursion;
    // superar la oleada 1 y morir en la pausa
    window.D.step(2.2, false);
    for (const p of s.pirates) if (p.alive && p.inc) { p.hp = 1; s.bolts.push({ pos: { ...p.pos }, vel: { x: 0, y: 0, z: 0 }, life: 0.1, dmg: 99 }); }
    window.D.step(0.2, false);
    const paused = s.incursion?.pause > 0;
    window.G.god = false;
    s.ship.shield = 0; s.ship.hull = 1;
    s.ebolts.push({ pos: { ...s.ship.pos }, vel: { x: 0, y: 0, z: 0 }, life: 1, dmg: 99 });
    window.D.step(1 / 60, false);
    return { hullIn, stillIn, paused, over: s.incursion === null, waves: window.__save.galaxy.incursion?.waves, hull: s.ship.hull, kept: s.pirates.some((p) => p.keep && p.alive), n: s.pirates.length };
  });
  expect(res.hullIn).toBe(100); // dentro juegas con la nave a tope…
  expect(res.stillIn).toBe(true);
  expect(res.paused).toBe(true);
  expect(res.over).toBe(true);
  expect(res.waves).toBe(1);
  expect(res.hull).toBe(30); // …y sales como entraste
  expect(res.kept).toBe(true);
  expect(res.n).toBeGreaterThanOrEqual(before);
  expect(errors).toEqual([]);
});

test('salto en curso: no se puede atracar', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await page.locator('#btnGalaxy').click();
  await page.locator('#btnGalGo').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  const res = await page.evaluate(() => {
    const s = window.G.space;
    s.ship.pos = { ...s.sys.station.pos };
    window.D.step(1 / 30);
    const before = s.canDock;
    s.jumpT = 1.1; s.jumpTo = s.sys.gates[0].to;
    window.D.step(0.1);
    return { before, during: s.canDock };
  });
  expect(res.before).toBe(true);
  expect(res.during).toBe(false);
  await expect(page.locator('#btnDock')).toBeHidden();
  expect(errors).toEqual([]);
});

test('pecio propio: con la bodega llena no se pierde', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page, { v: 3, runs: 5, tips: TIPS, galaxy: { cargo: { iron: 20 }, wreck: { sys: 0, pos: { x: 1500, y: 0, z: 1500 }, cargo: { crystal: 5 }, until: 99 } } });
  await galaxy(page);
  const res = await page.evaluate(() => { window.D.step(0.2, false); return { wreck: window.__save.galaxy.wreck?.cargo, crystal: window.__save.galaxy.cargo.crystal }; });
  expect(res.wreck).toEqual({ crystal: 5 });
  expect(res.crystal || 0).toBe(0);
  expect(errors).toEqual([]);
});

test('arena: salir del sin fin desde la pausa cobra la partida', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await page.locator('#btnArena').click();
  await page.locator('#arenaMaps [data-map="grid"]').click();
  await page.waitForFunction(() => window.G.mode === 'arena');
  const gems0 = await page.evaluate(() => { window.G.arena.endless = true; window.G.arena.time = 700; return window.__save.gems; });
  await page.locator('#arenaPause').click();
  await page.locator('#btnQuit').click();
  await page.waitForFunction(() => window.G.mode === 'arenaEnd');
  const res = await page.evaluate(() => ({ gems: window.__save.gems, wins: window.__save.arena.wins, best: window.__save.arena.best }));
  expect(res.gems).toBeGreaterThan(gems0);
  expect(res.best).toBeGreaterThanOrEqual(700);
  expect(errors).toEqual([]);
});

test('teclas: soltar «D» con Shift no deja la nave girando', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await galaxy(page);
  await page.keyboard.down('d');
  await page.keyboard.down('Shift');
  await page.keyboard.up('d');
  await page.keyboard.up('Shift');
  const x = await page.evaluate(() => { window.D.step(1 / 30, false); return window.G.space.input.x; });
  expect(x).toBe(0);
  expect(errors).toEqual([]);
});
