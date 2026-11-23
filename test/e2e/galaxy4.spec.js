// GALAXIA rediseñada: combate con sensación (racha, sobrecarga, esquive perfecto, ventilación)
import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

const SAVE = 'overdrive-save-v1';
async function startGalaxy(page, seedSave = { v: 3, runs: 5, tips: { galaxy: true, galCombat: true } }) {
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
  // lejos de la estación (en la zona segura no pasa nada)
  await page.evaluate(() => { const sh = window.G.space.ship; sh.pos = { x: 1500, y: 0, z: 1500 }; sh.throttle = 0; window.D.step(1 / 30, false); });
}

test('racha: bajas seguidas multiplican lo que paga cada pirata; un golpe en el casco la rompe', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  const res = await page.evaluate(() => {
    const s = window.G.space;
    for (let i = 0; i < 5; i++) window.__pirate('fighter', null, 150);
    for (const p of s.pirates) Object.assign(p, { hp: 5, max: 1000, speed: 0, state: 'patrol' });
    s.botFire = true;
    window.D.step(2, false);
    s.botFire = false;
    const loot = s.loot.map((l) => l.credits);
    const streak = s.combat.streak;
    s.ship.shield = 0;
    s.ebolts.push({ pos: { ...s.ship.pos }, vel: { x: 0, y: 0, z: 0 }, life: 1, dmg: 10 });
    window.D.step(1 / 60, false);
    return { loot, streak, after: s.combat.streak, best: s.combat.best };
  });
  expect(res.streak).toBe(5);
  expect(res.loot.at(-1)).toBeGreaterThan(res.loot[0]);
  expect(res.after).toBe(0);
  expect(res.best).toBe(5);
  await expect(page.locator('#shStreak')).toBeHidden();
  expect(errors).toEqual([]);
});

test('sobrecarga: llena, el botón ⚡ la suelta y el láser no se calienta', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  await page.evaluate(() => { window.G.space.combat.surge = 1; window.D.step(1 / 30); });
  await expect(page.locator('#btnSurge')).toHaveClass(/ready/);
  await page.locator('#btnSurge').dispatchEvent('pointerdown');
  const res = await page.evaluate(() => {
    const s = window.G.space;
    const on = s.combat.surgeT > 0;
    s.botFire = true;
    window.D.step(3, false);
    s.botFire = false;
    return { on, heat: s.heat };
  });
  expect(res.on).toBe(true);
  expect(res.heat).toBe(0);
  await page.evaluate(() => window.D.step(4));
  await expect(page.locator('#btnSurge')).not.toHaveClass(/on/);
  expect(errors).toEqual([]);
});

test('tonel: esquive perfecto al principio (carga la sobrecarga); al final del giro ya duele; encadenarlo cansa', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  const shot = () => page.evaluate(() => {
    const s = window.G.space, sh = s.ship, before = sh.shield + sh.hull;
    s.ebolts.push({ pos: { ...sh.pos }, vel: { x: 0, y: 0, z: 0 }, life: 1, dmg: 20 });
    window.D.step(1 / 60, false);
    return before - (sh.shield + sh.hull);
  });
  await page.keyboard.press('x');
  expect(await shot()).toBeLessThan(1);
  // el esquive perfecto carga la sobrecarga (y da cámara lenta, que corre en tiempo real)
  expect(await page.evaluate(() => window.G.space.combat.surge)).toBeGreaterThan(0);
  await page.evaluate(() => window.D.step(0.35, false)); // sigue girando, pero ya sin invulnerabilidad
  expect(await page.evaluate(() => window.G.space.ship.barrelT > 0)).toBe(true);
  expect(await shot()).toBeGreaterThan(15);
  // encadenar toneles cansa
  const cds = await page.evaluate(() => {
    const out = [];
    for (let i = 0; i < 3; i++) { window.D.step(window.G.space.ship.rollCd + 0.02, false); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' })); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'x' })); out.push(window.G.space.ship.rollCd); }
    return out;
  });
  expect(cds[2]).toBeGreaterThan(cds[0]);
  expect(errors).toEqual([]);
});

test('calor: sin parar se sobrecalienta; pulsar en la franja ventila y fuera se atasca', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  const res = await page.evaluate(() => {
    const s = window.G.space;
    s.botFire = true;
    let t = 0;
    while (!s.overheat && t < 60) { window.D.step(0.25, false); t += 0.25; }
    s.botFire = false;
    window.D.step(1 / 60, false);
    const over = s.overheat;
    // atasco: pulsar enseguida (calor alto)
    s.botFire = true; window.D.step(1 / 60, false); s.botFire = false; window.D.step(1 / 60, false);
    const jam = s.heat;
    // esperar a la franja y pulsar
    while (s.heat > 0.7) window.D.step(1 / 60, false);
    s.botFire = true; window.D.step(1 / 60, false); s.botFire = false;
    return { t, over, jam, vented: !s.overheat };
  });
  expect(res.over).toBe(true);
  expect(res.t).toBeLessThan(60);
  expect(res.jam).toBeGreaterThan(0.95);
  expect(res.vented).toBe(true);
  expect(errors).toEqual([]);
});
