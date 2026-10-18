import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

// GALAXIA: la amenaza crece con tu nave (poder), nivel de búsqueda y cazadores, élites y corbetas
const SAVE = 'overdrive-save-v1';
const MAXED = { engine: 8, laser: 8, shield: 8, cargo: 6, jump: 6, missile: 3 };

async function startGalaxy(page, galaxy, extra = {}) {
  await page.addInitScript(([k, g, x]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify({ v: 6, runs: 5, settings: { sound: false }, galaxy: { started: true, credits: 20000, ...g }, ...x }));
  }, [SAVE, galaxy, extra]);
  await page.goto('/?debug&nosw&seed=3');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; });
  await page.locator('#btnGalaxy').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
}
const jumpTo = (page, id) => page.evaluate((to) => {
  const s = window.G.space;
  s.jumpT = 0.05;
  s.jumpTo = to;
  for (let i = 0; i < 10; i++) window.D.step(1 / 60, false);
  return s.sysId;
}, id);
const pirates = (page) => page.evaluate(() => window.G.space.pirates.filter((p) => p.alive && !p.boss && !p.hunter).map((p) => ({ hp: p.max, kind: p.kind })));

test('amenaza: con la nave muy mejorada, el mismo sistema tiene más piratas y más duros', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { up: { jump: 6 } });
  await jumpTo(page, 5);
  const weak = await pirates(page);
  await page.evaluate((up) => { window.__save.galaxy.up = up; }, MAXED);
  await jumpTo(page, 0);
  await jumpTo(page, 5);
  const strong = await pirates(page);
  expect(strong.length).toBeGreaterThan(weak.length);
  const avg = (a) => a.reduce((t, p) => t + p.hp, 0) / a.length;
  expect(avg(strong)).toBeGreaterThan(avg(weak) * 2);
  await expect(page.locator('#shSystem')).toContainText('▲');
  expect(errors).toEqual([]);
});

test('búsqueda: con 5 ⭐ te esperan cazadores (y su jefe); en la estación, el soborno quita una', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { up: { jump: 6 }, wanted: 5 }, { ach: {} });
  await page.evaluate(() => window.D.step(1 / 30, true));
  await expect(page.locator('#shWanted')).toHaveText('⭐⭐⭐⭐⭐');
  // a algún sistema llegarán: probamos unos cuantos saltos hasta que salgan
  let hunters = 0;
  for (const id of [4, 9, 4, 9, 4, 9, 4, 9]) {
    await page.evaluate(() => { window.__save.galaxy.wanted = 5; });
    await jumpTo(page, id);
    hunters = await page.evaluate(() => window.G.space.pirates.filter((p) => p.hunter).length);
    if (hunters) break;
  }
  expect(hunters).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => window.G.space.pirates.some((p) => p.name === '🚨 JEFE DE CAZA'))).toBe(true);
  expect(await page.evaluate(() => !!window.__save.ach.wanted5?.done)).toBe(true);
  // soborno
  await jumpTo(page, 0);
  await page.evaluate(() => { const s = window.G.space; window.__save.galaxy.wanted = 2.5; s.pirates = []; s.ship.pos = { x: s.sys.station.pos.x, y: s.sys.station.pos.y, z: s.sys.station.pos.z - 40 }; s.ship.throttle = 0; window.D.step(1 / 30, true); });
  await page.locator('#btnDock').click();
  const c0 = await page.evaluate(() => window.__save.galaxy.credits);
  await page.locator('#btnBribe').click();
  const after = await page.evaluate(() => ({ w: window.__save.galaxy.wanted, c: window.__save.galaxy.credits }));
  expect(Math.floor(after.w)).toBe(1);
  expect(after.c).toBeLessThan(c0);
  expect(errors).toEqual([]);
});

test('élites: el blindado para el daño con su escudo, el kamikaze estalla y la corbeta protege a los suyos', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { up: { jump: 6 } });
  await jumpTo(page, 5);
  const hit = (sel, dmg) => page.evaluate(([f, d]) => {
    const s = window.G.space, p = s.pirates.find(new Function('p', `return ${f}`));
    const hp0 = p.hp, sh0 = p.eShield;
    s.bolts.push({ pos: { ...p.pos }, vel: { x: 0, y: 0, z: 0 }, life: 0.5, dmg: d });
    window.D.step(1 / 60, false);
    return { hp: hp0 - p.hp, shield: sh0 - p.eShield, alive: p.alive };
  }, [sel, dmg]);
  // BLINDADO: el primer daño se lo come el escudo
  await page.evaluate(() => { window.G.space.pirates = []; window.G.god = true; window.__pirate('fighter', 'shielded', 400); });
  const sh = await hit("p.elite === 'shielded'", 10);
  expect(sh.hp).toBe(0);
  expect(sh.shield).toBeGreaterThan(0);
  // KAMIKAZE: al tocarte estalla y te hace daño
  const kam = await page.evaluate(() => {
    window.G.god = false;
    const s = window.G.space;
    s.pirates = [];
    window.__pirate('fighter', 'kamikaze', 10);
    const sh0 = s.ship.shield + s.ship.hull;
    for (let i = 0; i < 20; i++) window.D.step(1 / 60, false);
    return { gone: !s.pirates.some((p) => p.elite === 'kamikaze' && p.alive), lost: sh0 - (s.ship.shield + s.ship.hull) };
  });
  expect(kam.gone).toBe(true);
  expect(kam.lost).toBeGreaterThan(0);
  // CORBETA: un pirata cerca de ella recibe la mitad de daño
  await page.evaluate(() => { window.G.god = true; const s = window.G.space; s.pirates = []; window.__pirate('fighter', null, 500); window.__pirate('corvette', null, 520); });
  const half = await hit("p.kind === 'fighter'", 20);
  expect(half.hp).toBeCloseTo(10, 5);
  await page.evaluate(() => { const s = window.G.space; s.pirates = s.pirates.filter((p) => p.kind !== 'corvette'); });
  const full = await hit("p.kind === 'fighter'", 20);
  expect(full.hp).toBeCloseTo(20, 5);
  expect(errors).toEqual([]);
});

test('rendimiento: 12 piratas con élites, corbeta, minador y minas por debajo de 16 ms', async ({ page }) => {
  await startGalaxy(page, { up: MAXED });
  await jumpTo(page, 5);
  const ms = await page.evaluate(() => {
    window.G.god = true;
    for (const [k, t] of [['corvette', null], ['minelayer', null], ['fighter', 'sniper'], ['fighter', 'regen'], ['interceptor', 'shielded'], ['bomber', 'kamikaze']]) window.__pirate(k, t, 600);
    for (let i = 0; i < 120; i++) window.D.step(1 / 60, false);
    let best = Infinity;
    for (let k = 0; k < 6; k++) {
      const t0 = performance.now();
      for (let i = 0; i < 20; i++) window.D.step(1 / 60, true);
      best = Math.min(best, (performance.now() - t0) / 20);
    }
    return best;
  });
  console.log(`GALAXIA amenaza fotograma: ${ms.toFixed(2)} ms`);
  expect(ms).toBeLessThan(16);
});
