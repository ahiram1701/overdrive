import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

const SAVE = 'overdrive-save-v1';

// Bot de arena: huye de lo que tiene cerca (repulsión), esquiva balas, va a por gemas si está
// tranquilo y elige siempre la primera mejora.
function arenaBot({ seconds }) {
  const G = window.G, D = window.D;
  let t = 0, ups = 0;
  while (t < seconds) {
    if (G.mode === 'arenaUp') { document.querySelector('#auOptions .au-opt').click(); ups++; continue; }
    if (G.mode !== 'arena') break;
    const a = G.arena;
    let fx = 0, fy = 0;
    for (const e of a.enemies) {
      const dx = a.x - e.x, dy = a.y - e.y, d2 = dx * dx + dy * dy;
      if (d2 > 260 * 260) continue;
      const k = (e.boss ? 4 : e.elite ? 2 : 1) / Math.max(400, d2);
      fx += dx * k; fy += dy * k;
    }
    for (const b of a.ebullets) {
      const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
      if (d2 < 140 * 140) { fx += (dx * 3) / Math.max(200, d2); fy += (dy * 3) / Math.max(200, d2); }
    }
    // embestidor apuntando o cargando: salir de su línea de lado, como un jugador que ve el aviso
    for (const e of a.enemies) {
      if (e.id !== 'dasher' || (e.state !== 'aim' && e.state !== 'dash')) continue;
      const px = a.x - e.x, py = a.y - e.y, along = px * e.dx + py * e.dy, side = px * e.dy - py * e.dx;
      if (along > 0 && along < 330 && Math.abs(side) < 45) { const s = side >= 0 ? 1 : -1; fx += e.dy * s * 0.05; fy += -e.dx * s * 0.05; }
    }
    // como un jugador: huye, pero sin dejar de ir a por las gemas cercanas
    let g = null, gd = 1e9;
    for (const it of [...a.gems, ...a.chests]) { const d = Math.hypot(it.x - a.x, it.y - a.y); if (d < gd) { gd = d; g = it; } }
    const fl = Math.hypot(fx, fy);
    if (g && gd < 400) {
      const w = fl < 0.004 ? 1 : 0.35 * fl;
      fx += ((g.x - a.x) / gd) * w; fy += ((g.y - a.y) / gd) * w;
    }
    const l = Math.hypot(fx, fy);
    a.botInput = l > 1e-6 ? { x: fx / l, y: fy / l } : { x: 0, y: 0 };
    D.step(1 / 30, false);
    t += 1 / 30;
  }
  const a = G.arena;
  return { mode: G.mode, time: a.time, hp: a.hp, level: a.level, kills: a.kills, ups, weapons: a.weapons };
}

async function startArena(page, ship = 'viper', seed = 11) {
  await page.addInitScript(([k, s]) => localStorage.setItem(k, JSON.stringify({ v: 3, runs: 5, ship: s, ships: [s] })), [SAVE, ship]);
  await page.goto(`/?debug&nosw&seed=${seed}`);
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; });
  await page.locator('#btnArena').click();
  await page.waitForFunction(() => window.G.mode === 'arena');
}

test('arena: el bot sobrevive 90 s, sube de nivel a menudo y elige mejoras', async ({ page }) => {
  const errors = trackErrors(page);
  await startArena(page);
  await expect(page.locator('#arenaHud')).toBeVisible();
  const res = await page.evaluate(arenaBot, { seconds: 90 });
  console.log(`ARENA bot 90s: nivel ${res.level}, bajas ${res.kills}, vida ${Math.round(res.hp)}`);
  expect(res.mode).toBe('arena');
  expect(res.level).toBeGreaterThanOrEqual(6);
  expect(res.kills).toBeGreaterThan(100);
  expect(res.ups).toBe(res.level - 1);
  expect(errors).toEqual([]);
});

test('arena: morir lleva a la pantalla final con gemas y XP, y se guarda el récord', async ({ page }) => {
  const errors = trackErrors(page);
  await startArena(page, 'brick');
  await page.evaluate(() => {
    const G = window.G;
    const pick = () => { if (G.mode === 'arenaUp') document.querySelector('#auOptions .au-opt').click(); };
    for (let i = 0; i < 300; i++) { pick(); window.D.step(1 / 30, false); }
    G.arena.hp = 1;
    G.arena.iframes = 0;
    for (let i = 0; i < 900 && (G.mode === 'arena' || G.mode === 'arenaUp'); i++) { pick(); window.D.step(1 / 30, false); }
    for (let i = 0; i < 60; i++) window.D.step(1 / 30, false);
  });
  await expect(page.locator('#arenaEnd')).toBeVisible();
  await expect(page.locator('#aeGems')).toContainText('💎');
  const s = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE);
  expect(s.arena.best).toBeGreaterThan(5);
  expect(s.xp).toBeGreaterThan(0);
  await page.locator('#btnArenaRetry').click();
  await page.waitForFunction(() => window.G.mode === 'arena');
  expect(errors).toEqual([]);
});

test('arena: cada nave arranca con su arma y su habilidad funciona', async ({ page }) => {
  const errors = trackErrors(page);
  await startArena(page, 'nova');
  const res = await page.evaluate(() => {
    const a = window.G.arena;
    for (let i = 0; i < 90; i++) {
      if (window.G.mode === 'arenaUp') document.querySelector('#auOptions .au-opt').click();
      window.D.step(1 / 30, false);
    }
    const before = a.ability.cdLeft;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
    return { first: Object.keys(a.weapons)[0], before, after: a.ability.cdLeft };
  });
  expect(res.first).toBe('pulse');
  expect(res.before).toBe(0);
  expect(res.after).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('arena: rendimiento con 300 enemigos', async ({ page }) => {
  await startArena(page, 'comet');
  const ms = await page.evaluate(() => {
    const a = window.G.arena;
    for (let i = 0; i < 300; i++) {
      const ang = (i / 300) * Math.PI * 2, R = 120 + (i % 7) * 40;
      a.enemies.push({ id: 'chaser', def: { color: '#ff2bd6', shape: 'tri' }, x: Math.cos(ang) * R, y: Math.sin(ang) * R, hp: 1e6, max: 1e6, r: 13, speed: 70, dmg: 0, xp: 1, alive: true, flash: 0, state: 'go', st: 0, cd: 9, phase: 0, vx: 0, vy: 0, orbT: 0 });
    }
    a.weapons = { orbs: 5, pulse: 5, flame: 5, blaster: 5 };
    window.G.god = true;
    const t0 = performance.now();
    for (let i = 0; i < 120; i++) window.D.step(1 / 120, false);
    return (performance.now() - t0) / 120;
  });
  console.log(`ARENA paso medio con 300 enemigos: ${ms.toFixed(2)} ms`);
  expect(ms).toBeLessThan(8);
});
