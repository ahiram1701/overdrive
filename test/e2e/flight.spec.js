import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

// Vuelo libre en la Galaxia: rizos, alabeo, acelerador y marcha atrás
async function fly(page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('overdrive-save-v1', JSON.stringify({ v: 3, runs: 5, settings: { sound: false, autoLevel: false } }));
  });
  await page.goto('/?debug&nosw&seed=3');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; });
  await page.locator('#btnGalaxy').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
}

test('un rizo completo deja la nave con el mismo rumbo (y pasa boca abajo)', async ({ page }) => {
  const errors = trackErrors(page);
  await fly(page);
  const res = await page.evaluate(() => {
    const s = window.G.space, sh = s.ship, st = window.__spaceStats();
    const f0 = { ...sh.f };
    const dur = (Math.PI * 2) / (st.turn * 0.8); // tiempo de una vuelta a tope
    let minUp = 1;
    s.botInput = { x: 0, y: -1 }; // tirar del morro hacia arriba
    const steps = Math.round(dur * 120);
    for (let i = 0; i < steps; i++) { window.D.step(dur / steps, false); minUp = Math.min(minUp, sh.u.y); }
    s.botInput = null;
    const f1 = sh.f;
    return { dot: f0.x * f1.x + f0.y * f1.y + f0.z * f1.z, minUp };
  });
  expect(res.minUp).toBeLessThan(-0.9);
  expect(res.dot).toBeGreaterThan(0.995);
  expect(errors).toEqual([]);
});

test('acelerador: a 0 la nave se para y en marcha atrás retrocede', async ({ page }) => {
  const errors = trackErrors(page);
  await fly(page);
  // la palanca del HUD
  await page.locator('#throttle').fill('0');
  const stop = await page.evaluate(() => {
    const sh = window.G.space.ship, p0 = { ...sh.pos };
    window.D.step(1, false);
    return Math.hypot(sh.pos.x - p0.x, sh.pos.y - p0.y, sh.pos.z - p0.z);
  });
  expect(stop).toBeLessThan(0.01);
  await expect(page.locator('#thrVal')).toHaveText('PARADO');
  await page.locator('#throttle').fill('-40');
  const back = await page.evaluate(() => {
    const sh = window.G.space.ship, p0 = { ...sh.pos };
    window.D.step(1, false);
    const d = { x: sh.pos.x - p0.x, y: sh.pos.y - p0.y, z: sh.pos.z - p0.z };
    return d.x * sh.f.x + d.y * sh.f.y + d.z * sh.f.z;
  });
  expect(back).toBeLessThan(-10);
  // el impulso manda aunque vayas hacia atrás
  const boost = await page.evaluate(() => {
    const sh = window.G.space.ship;
    sh.boostCd = 0;
    document.getElementById('btnBoost').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const p0 = { ...sh.pos };
    window.D.step(0.5, false);
    const d = { x: sh.pos.x - p0.x, y: sh.pos.y - p0.y, z: sh.pos.z - p0.z };
    return d.x * sh.f.x + d.y * sh.f.y + d.z * sh.f.z;
  });
  expect(boost).toBeGreaterThan(50);
  expect(errors).toEqual([]);
});

test('alabeo con ↺ y Q/E; la nivelación automática endereza la nave', async ({ page }) => {
  const errors = trackErrors(page);
  await fly(page);
  const btn = page.locator('#btnRollR');
  const box = await btn.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const rolled = await page.evaluate(() => { window.D.step(0.5, false); return window.G.space.ship.r.y; });
  await page.mouse.up();
  expect(rolled).toBeLessThan(-0.5); // ala derecha abajo
  // con nivelación automática vuelve a la horizontal
  const level = await page.evaluate(() => {
    window.__save.settings.autoLevel = true;
    window.D.step(3, false);
    return window.G.space.ship.r.y;
  });
  expect(Math.abs(level)).toBeLessThan(0.1);
  expect(errors).toEqual([]);
});

test('palanca con muesca: cerca del 0 se para (frenando suave), y R se detiene en el 0', async ({ page }) => {
  const errors = trackErrors(page);
  await fly(page);
  // +10% y −10% caen en la muesca: PARADO
  for (const v of ['10', '-10']) {
    await page.locator('#throttle').fill('60');
    await page.locator('#throttle').fill(v);
    expect(await page.evaluate(() => window.G.space.ship.throttle)).toBe(0);
  }
  // frena en unas décimas (no de golpe) y luego no se mueve
  const brake = await page.evaluate(() => {
    const sh = window.G.space.ship;
    sh.throttle = 1;
    for (let i = 0; i < 30; i++) window.D.step(1 / 60, false);
    sh.throttle = 0;
    window.D.step(1 / 60, false);
    const early = Math.abs(sh.speed);
    for (let i = 0; i < 60; i++) window.D.step(1 / 60, false);
    const p0 = { ...sh.pos };
    for (let i = 0; i < 30; i++) window.D.step(1 / 60, false);
    return { early, moved: Math.hypot(sh.pos.x - p0.x, sh.pos.y - p0.y, sh.pos.z - p0.z) };
  });
  expect(brake.early).toBeGreaterThan(10); // aún frenando
  expect(brake.moved).toBeLessThan(0.01); // ya parada
  await page.evaluate(() => window.D.step(1 / 30, false));
  await expect(page.locator('#throttleBox')).toHaveClass(/stop/);
  await expect(page.locator('#thrVal')).toHaveText('PARADO');
  // +30% sí avanza
  await page.locator('#throttle').fill('30');
  expect(await page.evaluate(() => window.G.space.ship.throttle)).toBeCloseTo(0.3);
  // con F mantenida desde +30% se queda en 0 hasta soltar
  await page.keyboard.down('f');
  await page.evaluate(() => { for (let i = 0; i < 120; i++) window.D.step(1 / 60, false); });
  expect(await page.evaluate(() => window.G.space.ship.throttle)).toBe(0);
  await page.keyboard.up('f');
  await page.evaluate(() => window.D.step(1 / 60, false)); // un fotograma con la tecla suelta
  await page.keyboard.down('f');
  await page.evaluate(() => { for (let i = 0; i < 20; i++) window.D.step(1 / 60, false); });
  await page.keyboard.up('f');
  expect(await page.evaluate(() => window.G.space.ship.throttle)).toBeLessThan(0); // otra pulsación: marcha atrás
  expect(errors).toEqual([]);
});
