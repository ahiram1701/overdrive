import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

// GALAXIA (U4): misiles, tonel, sucesos, órbita y rendimiento
const SAVE = 'overdrive-save-v1';
const BASE = { v: 3, runs: 5, settings: { sound: false }, galaxy: { started: true, credits: 100, up: { missile: 3 }, missiles: 8, cargo: { iron: 10 } } };

async function startGalaxy(page, save = BASE) {
  await page.addInitScript(([k, v]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify(v));
  }, [SAVE, save]);
  await page.goto('/?debug&nosw&seed=3');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; });
  await page.locator('#btnGalaxy').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
}

// pone la nave a `d` metros de lo que devuelva pick(s), mirándolo y parada
async function goTo(page, pick, d = 20) {
  await page.evaluate(([src, dd]) => {
    const s = window.G.space, sh = s.ship;
    const t = new Function('s', `return ${src}`)(s);
    const dir = { x: sh.pos.x - t.x, y: sh.pos.y - t.y, z: sh.pos.z - t.z };
    const l = Math.hypot(dir.x, dir.y, dir.z) || 1;
    sh.pos = { x: t.x + (dir.x / l) * dd, y: t.y + (dir.y / l) * dd, z: t.z + (dir.z / l) * dd };
    sh.yaw = Math.atan2(-dir.x, -dir.z);
    sh.pitch = Math.asin(-dir.y / l);
    sh.throttle = 0;
    window.D.step(1 / 30, false);
  }, [pick, d]);
}

test('misil: se fija en el pirata del visor y lo destruye', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  await page.evaluate(() => {
    const s = window.G.space, sh = s.ship;
    sh.throttle = 0;
    const pos = { x: sh.pos.x + sh.f.x * 300, y: sh.pos.y + sh.f.y * 300, z: sh.pos.z + sh.f.z * 300 };
    s.pirates.push({ pos, yaw: 0, pitch: 0, hp: 60, max: 60, boss: false, alive: true, flash: 0, state: 'patrol', t: 0, kind: 'fighter', size: 6,
      speed: 0, turn: 0, fireCd: 99, dmg: 0, missileCd: 0, mesh: 'viper', off: { x: 0, y: 0, z: 0 } });
    window.D.step(0.8, false);
  });
  expect(await page.evaluate(() => window.G.space.lock.locked)).toBe(true);
  await expect(page.locator('#btnMissile')).toHaveClass(/lock/);
  await page.locator('#btnMissile').dispatchEvent('pointerdown');
  const res = await page.evaluate(() => {
    const s = window.G.space;
    for (let i = 0; i < 180 && s.pirates.length; i++) window.D.step(1 / 60, false);
    return { alive: s.pirates.length, ammo: window.__save.galaxy.missiles };
  });
  expect(res.alive).toBe(0);
  expect(res.ammo).toBe(7);
  expect(errors).toEqual([]);
});

test('tonel (X / doble toque): invulnerable mientras gira, luego vuelve a doler', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  // lejos de la estación: en la zona segura no te dan
  await page.evaluate(() => { const sh = window.G.space.ship; sh.pos = { x: 1500, y: 0, z: 1500 }; sh.throttle = 0; window.D.step(1 / 30, false); });
  const shot = () => page.evaluate(() => {
    const s = window.G.space, sh = s.ship, before = sh.shield + sh.hull;
    s.ebolts.push({ pos: { ...sh.pos }, vel: { x: 0, y: 0, z: 0 }, life: 1, dmg: 20 });
    window.D.step(1 / 60, false);
    return before - (sh.shield + sh.hull);
  });
  await page.keyboard.press('x');
  expect(await page.evaluate(() => window.G.space.ship.barrelT > 0)).toBe(true);
  expect(await shot()).toBeLessThan(1);
  await page.evaluate(() => window.D.step(0.7, false));
  expect(await shot()).toBeGreaterThan(15);
  expect(errors).toEqual([]);
});

test('suceso de rescate: recoger la cápsula y atracar paga créditos (la Galaxia no da gemas)', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  await page.evaluate(() => window.__forceEvent('rescue'));
  await page.evaluate(() => window.D.step(1 / 30, false));
  await expect(page.locator('#shObjective')).toContainText('cápsula');
  await goTo(page, 's.event.pod.pos', 5);
  expect(await page.evaluate(() => window.G.space.event.held)).toBe(true);
  const before = await page.evaluate(() => ({ c: window.__save.galaxy.credits, g: window.__save.gems }));
  await goTo(page, 's.sys.station.pos', 60);
  await page.locator('#btnDock').click();
  await expect(page.locator('#station')).toBeVisible();
  const after = await page.evaluate(() => ({ c: window.__save.galaxy.credits, g: window.__save.gems, done: window.G.space.event.done, mis: window.__save.galaxy.missiles }));
  expect(after.c).toBeGreaterThan(before.c);
  expect(after.g).toBe(before.g); // solo créditos
  expect(after.done).toBe(true);
  expect(after.mis).toBe(8); // munición llena al atracar
  expect(errors).toEqual([]);
});

test('orbitar un planeta abre su pantalla; la primera visita paga', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  await page.evaluate(() => {
    const s = window.G.space, pl = s.sys.planets[2];
    s.ship.pos = { x: pl.pos.x + pl.r + 60, y: pl.pos.y, z: pl.pos.z };
    s.ship.throttle = 0;
    window.D.step(1 / 30, false);
  });
  await expect(page.locator('#btnAct')).toHaveText('🪐 ORBITAR');
  const c0 = await page.evaluate(() => window.__save.galaxy.credits);
  await page.locator('#btnAct').click();
  await expect(page.locator('#planet')).toBeVisible();
  await expect(page.locator('#planetInfo h3')).toContainText('ORIGEN III');
  await expect(page.locator('.pl-first')).toBeVisible();
  expect(await page.evaluate(() => window.__save.galaxy.credits)).toBeGreaterThan(c0);
  await page.locator('#btnPlanetLeave').click();
  await expect(page.locator('#spaceHud')).toBeVisible();
  expect(await page.evaluate(() => window.G.mode)).toBe('galaxy');
  // la segunda visita ya no paga
  await page.locator('#btnAct').click();
  await expect(page.locator('#planet')).toBeVisible();
  await expect(page.locator('.pl-first')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('convoy (comercia a +40%), base pirata (botín) y agujero de gusano', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  await page.evaluate(() => window.__forceEvent('convoy'));
  await goTo(page, 's.event.ships[0].pos', 60);
  await expect(page.locator('#btnAct')).toHaveText('🚚 COMERCIAR');
  const c0 = await page.evaluate(() => window.__save.galaxy.credits);
  await page.locator('#btnAct').click();
  const c1 = await page.evaluate(() => window.__save.galaxy.credits);
  expect(c1 - c0).toBeGreaterThanOrEqual(80); // 10 de hierro local (6) a +40%
  expect(await page.evaluate(() => window.__save.galaxy.cargo.iron)).toBe(0);

  await page.evaluate(() => window.__forceEvent('assault'));
  const g0 = await page.evaluate(() => window.__save.gems);
  const base = await page.evaluate(() => {
    const s = window.G.space;
    const had = !!s.base;
    s.bolts.push({ pos: { ...s.base.pos }, vel: { x: 0, y: 0, z: 0 }, life: 1, dmg: 1e6 });
    window.D.step(1 / 60, false);
    return { had, gone: !s.base, loot: s.loot.length > 0, done: s.event.done };
  });
  expect(base).toEqual({ had: true, gone: true, loot: true, done: true });
  expect(await page.evaluate(() => window.__save.gems)).toBe(g0 + 10); // solo el logro DEMOLEDOR (los logros sí dan gemas)

  await page.evaluate(() => window.__forceEvent('wormhole'));
  await goTo(page, 's.event.pos', 5);
  const sys = await page.evaluate(() => { for (let i = 0; i < 90; i++) window.D.step(1 / 60, false); return window.G.space.sysId; });
  expect(sys).not.toBe(0);
  expect(errors).toEqual([]);
});

test('rendimiento: nebulosa, base y 8 enemigos de todos los tipos por debajo de 16 ms', async ({ page }) => {
  await startGalaxy(page);
  const ms = await page.evaluate(() => {
    const s = window.G.space;
    window.G.god = true;
    window.__forceEvent('assault');
    for (let i = 0; i < 8; i++) {
      const p = { x: s.ship.pos.x + 200 + i * 30, y: 0, z: s.ship.pos.z + 300 };
      s.pirates.push({ pos: p, yaw: 0, pitch: 0, hp: 60, max: 60, boss: false, alive: true, flash: 0, state: 'attack', t: 0, kind: ['fighter', 'interceptor', 'bomber', 'drone'][i % 4], size: 6,
        speed: 80, turn: 1.5, fireCd: 1, dmg: 1, missileCd: i % 4 === 2 ? 1 : 0, mesh: ['viper', 'spectra', 'titan', 'manta'][i % 4], off: { x: 0, y: 0, z: 0 } });
    }
    s.botFire = true;
    const t0 = performance.now();
    for (let i = 0; i < 60; i++) window.D.step(1 / 60, true);
    return (performance.now() - t0) / 60;
  });
  console.log(`GALAXIA+ fotograma medio: ${ms.toFixed(2)} ms`);
  expect(ms).toBeLessThan(16);
});

test('🎒 panel de vuelo: inventario y misiones activas; pausa la partida y se abandona desde ahí', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { ...BASE, galaxyMats: { chatarra: 7 }, story: { ch: 1, n: 0, seen: { 0: true, 1: true } } });
  // una misión aceptada y una caza activa
  await page.evaluate(() => window.D.step(1 / 30, false));
  await page.locator('#btnDock').click();
  await page.locator('[data-mission]').first().click();
  await page.locator('#stBounties [data-bounty]').first().click();
  await page.evaluate(() => document.getElementById('btnUndock').click());
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  await page.locator('#btnInv').click();
  await expect(page.locator('#galInv')).toBeVisible();
  expect(await page.evaluate(() => window.G.mode)).toBe('galaxyInv');
  // pausa: la nave no se mueve
  const moved = await page.evaluate(() => { const sh = window.G.space.ship, p0 = { ...sh.pos }; window.D.step(0.5, false); return Math.hypot(sh.pos.x - p0.x, sh.pos.z - p0.z); });
  expect(moved).toBe(0);
  await expect(page.locator('#giBody')).toContainText('Bodega · 10/');
  await expect(page.locator('#giBody')).toContainText('Chatarra');
  await page.locator('#giTabs [data-tab="mis"]').click();
  await expect(page.locator('.gi-mis.story')).toContainText('Ecos');
  await expect(page.locator('.gi-mis.bounty')).toHaveCount(1);
  await expect(page.locator('[data-abandon]')).toHaveCount(1);
  await page.locator('[data-abandon]').click();
  await page.locator('[data-abandon]').click();
  await expect(page.locator('[data-abandon]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__save.galaxy.missions.length)).toBe(0);
  await page.locator('#galInv .scr-back').click();
  await expect(page.locator('#spaceHud')).toBeVisible();
  expect(await page.evaluate(() => window.G.mode)).toBe('galaxy');
  expect(errors).toEqual([]);
});

test('mercado y mantenimiento: vender mucho baja el precio, peaje al saltar, kit y recarga de misiles de pago', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { ...BASE, galaxy: { started: true, credits: 3000, up: { missile: 3, jump: 5 }, missiles: 1, cargo: { iron: 30 } } });
  await page.evaluate(() => window.D.step(1 / 30, false));
  await page.locator('#btnDock').click();
  // primera venta de 30 y otra igual: la segunda paga menos (saturación)
  const c0 = await page.evaluate(() => window.__save.galaxy.credits);
  await page.locator('#btnSell').click();
  const c1 = await page.evaluate(() => window.__save.galaxy.credits);
  await page.evaluate(() => { window.__save.galaxy.cargo.iron = 30; });
  await page.evaluate(() => document.getElementById('btnUndock').click());
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  await page.evaluate(() => window.D.step(1 / 30, false));
  await page.locator('#btnDock').click();
  await expect(page.locator('#stCargo .sat')).toContainText('📉');
  await page.locator('#btnSell').click();
  const c2 = await page.evaluate(() => window.__save.galaxy.credits);
  expect(c2 - c1).toBeLessThan(c1 - c0);
  // recargar misiles cuesta créditos
  const m0 = await page.evaluate(() => ({ c: window.__save.galaxy.credits, m: window.__save.galaxy.missiles }));
  await page.locator('#btnRefill').click();
  const m1 = await page.evaluate(() => ({ c: window.__save.galaxy.credits, m: window.__save.galaxy.missiles }));
  expect(m1.m).toBeGreaterThan(m0.m);
  expect(m1.c).toBeLessThan(m0.c);
  // comprar un kit de reparación y usarlo en vuelo (tecla 1)
  await page.locator('[data-item="repair"]').click();
  await page.evaluate(() => document.getElementById('btnUndock').click());
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  await page.evaluate(() => { window.G.space.ship.hull = 20; });
  await page.keyboard.press('1');
  expect(await page.evaluate(() => ({ hull: window.G.space.ship.hull, kits: window.__save.galaxyItems.repair }))).toEqual({ hull: 60, kits: 0 });
  // peaje al cruzar una puerta
  const cg = await page.evaluate(() => {
    const s = window.G.space, gt = s.sys.gates[0];
    const before = window.__save.galaxy.credits;
    s.ship.pos = { ...gt.pos };
    window.D.step(1 / 60, false);
    return { before, after: window.__save.galaxy.credits };
  });
  expect(cg.after).toBeLessThan(cg.before);
  expect(errors).toEqual([]);
});
