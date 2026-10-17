import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

const SAVE = 'overdrive-save-v1';
const ALL = ['viper', 'brick', 'ghost', 'nova', 'kaiju', 'raptor', 'comet', 'manta', 'spectra', 'titan'];

async function play(page, ship, seed = 5) {
  await page.addInitScript(([k, s, all]) => localStorage.setItem(k, JSON.stringify({ v: 3, runs: 3, ship: s, ships: all })), [SAVE, ship, ALL]);
  await page.goto(`/?debug&nosw&seed=${seed}`);
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; document.getElementById('btnPlay').click(); });
  await page.waitForFunction(() => window.G.mode === 'play');
  // avanza hasta que haya obstáculos delante
  await page.evaluate(() => { window.G.god = true; window.D.step(4, false); window.G.god = false; });
}
const useAbility = (page) => page.evaluate(() => { window.G.run.ability.cdLeft = 0; window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' })); });

test('Manta: la BURBUJA absorbe un golpe sin gastar escudo', async ({ page }) => {
  const errors = trackErrors(page);
  await play(page, 'manta');
  await useAbility(page);
  const res = await page.evaluate(async () => {
    const { onHit } = await import('/js/game.js');
    const r = window.G.run;
    const before = r.shields;
    const active = r.ability.active > 0;
    const o = r.objects.find((x) => x.alive && x.type !== 'coin');
    onHit(o);
    return { active, before, after: r.shields, dead: window.G.player.dead, popped: r.ability.active === 0 };
  });
  expect(res.active).toBe(true);
  expect(res.after).toBe(res.before);
  expect(res.dead).toBeFalsy();
  expect(res.popped).toBe(true);
  expect(errors).toEqual([]);
});

test('Spectra: el SALTO CORTO avanza 35 m sin chocar con lo que salta', async ({ page }) => {
  const errors = trackErrors(page);
  await play(page, 'spectra');
  const d0 = await page.evaluate(() => window.G.run.dist);
  await useAbility(page);
  const d1 = await page.evaluate(() => window.G.run.dist);
  expect(d1 - d0).toBeCloseTo(35, 0);
  const hits = await page.evaluate(() => { const r = window.G.run; const h = r.hitsTaken; window.D.step(0.5, false); return r.hitsTaken - h; });
  expect(hits).toBe(0);
  expect(errors).toEqual([]);
});

test('Titán: el MARTILLO vacía tu carril hasta 60 m', async ({ page }) => {
  const errors = trackErrors(page);
  await play(page, 'titan', 9);
  // lo mismo que considera el martillo: obstáculos (no monedas ni rampas) en tu carril, hasta 60 m
  const inLane = () => page.evaluate(async () => {
    const { LANE_W } = await import('/js/state.js');
    const r = window.G.run, px = window.G.player.x * LANE_W;
    const soft = new Set(['coin', 'fork', 'finish', 'core', 'portal', 'ramp']);
    return r.objects.filter((o) => o.alive && !soft.has(o.type) && o.z - r.dist > 0 && o.z - r.dist < 59 && (o.all || Math.abs(o.x - px) < 0.8)).length;
  });
  await useAbility(page);
  expect(await inLane()).toBe(0);
  expect(await page.evaluate(() => window.G.run.ability.cdLeft > 0)).toBe(true);
  expect(errors).toEqual([]);
});

test('hangar: pestaña GALAXIA compra una mejora con créditos y cada nave vuela distinto', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify({ v: 3, runs: 3, ship: 'viper', ships: ['viper', 'titan'], galaxy: { started: true, credits: 500, up: {} } }));
  }, SAVE);
  await page.goto('/?nosw');
  await page.locator('#btnHangar').click();
  await page.locator('#hTabs [data-tab="galaxia"]').click();
  await expect(page.locator('#galTab .stat')).toHaveCount(6);
  await page.locator('#galUps [data-up="engine"]').click();
  await expect(page.locator('#galCredits')).toHaveText('380');
  // Titán: más casco, menos velocidad que la equipada
  await page.locator('#shipCarousel .ship-chip', { hasText: 'Titán' }).click();
  await expect(page.locator('#galTab .stat em.up')).not.toHaveCount(0);
  await expect(page.locator('#galTab .stat em.down')).not.toHaveCount(0);
  await page.reload();
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).galaxy.up.engine, SAVE)).toBe(1);
  expect(errors).toEqual([]);
});

test('hangar: nombre propio, motor/aura/disparo y la EXPOSICIÓN con COMPARAR', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify({ v: 3, runs: 3, gems: 500, ship: 'viper', ships: ['viper', 'manta'] }));
  }, SAVE);
  await page.goto('/?nosw');
  await page.locator('#btnHangar').click();
  page.once('dialog', (d) => d.accept('Rayo azul'));
  await page.locator('#btnName').click();
  await expect(page.locator('#shipDetail h3')).toContainText('«Rayo azul»');
  // motor de color: se compra y se equipa
  await page.locator('#hTabs [data-tab="estilo"]').click();
  await page.locator('[data-cos="engine:e-cyan"]').click();
  await page.locator('#btnCosBuy').click();
  await expect(page.locator('[data-cos="engine:e-cyan"]')).toHaveClass(/on/);
  await expect(page.locator('[data-cos^="aura:"]')).toHaveCount(6);
  await expect(page.locator('[data-cos^="shot:"]')).toHaveCount(6);
  await page.reload();
  const sv = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE);
  expect(sv.shipNames.viper).toBe('Rayo azul');
  expect(sv.cosmetics.equip.viper.engine).toBe('e-cyan');
  // exposición
  await page.locator('#btnHangar').click();
  await page.locator('#btnExpo').click();
  await expect(page.locator('#expo')).toBeVisible();
  await expect(page.locator('#expoName')).toHaveText('«Rayo azul»');
  await page.locator('#expoNext').click();
  await expect(page.locator('#expoName')).toHaveText('Brick');
  await page.locator('#expoCompare').click();
  await expect(page.locator('#expoStats .cmp-head')).toContainText('vs');
  await expect(page.locator('#expoStats .b2')).toHaveCount(6);
  await page.locator('#expo .scr-back').click();
  await expect(page.locator('#hangar')).toBeVisible();
  expect(errors).toEqual([]);
});
