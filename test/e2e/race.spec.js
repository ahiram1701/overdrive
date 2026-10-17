import { test, expect } from '@playwright/test';
import { trackErrors, botInPage } from './helpers.js';

const SAVE = 'overdrive-save-v1';

async function startCup(page, cup = 'c1') {
  await page.locator('#btnRaces').click();
  await page.evaluate(() => { window.G.manual = true; });
  await page.locator(`[data-cup="${cup}"]`).click();
  await page.waitForFunction(() => window.G.mode === 'play' && !!window.G.run.race);
}
const toPodium = () => {
  for (let i = 0; i < 300 && window.G.mode === 'won'; i++) window.D.step(1 / 60, false);
  return window.G.mode;
};

test('carrera: el bot llega a la meta, hay podio con los 4, puntos y fantasma guardado', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(k, JSON.stringify({ v: 3, runs: 5 }));
    }
  }, SAVE);
  await page.goto('/?debug&nosw');
  await page.waitForFunction(() => !!window.G);
  await startCup(page);
  await expect(page.locator('#raceTag')).toBeVisible();
  const res = await page.evaluate(botInPage, { seconds: 150 });
  expect(res.mode).toBe('won');
  expect(await page.evaluate(toPodium)).toBe('victory');
  await expect(page.locator('#racePodium')).toBeVisible();
  await expect(page.locator('#rpOrder > div')).toHaveCount(4);
  const r = await page.evaluate(() => window.G.run.result);
  // los rivales corren de verdad: todos tienen tiempo de llegada
  expect(r.order.every((x) => x.t > 0)).toBe(true);
  expect(Object.values(r.points).reduce((a, b) => a + b, 0)).toBe(20);
  const s = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE);
  expect(s.ghosts['c1-1'].d.length).toBeGreaterThan(50);
  expect(s.raceBest['c1-1']).toBeGreaterThan(0);

  // la siguiente carrera de la copa arrastra los puntos
  await page.locator('#btnRaceNext').click();
  await page.waitForFunction(() => window.G.mode === 'play');
  const next = await page.evaluate(() => ({ track: window.G.run.race.track.id, pts: window.G.run.race.points }));
  expect(next.track).toBe('c1-2');
  expect(next.pts).toEqual(r.points);
  expect(errors).toEqual([]);
});

test('carrera: repetir una pista carga tu fantasma y chocar no mata', async ({ page }) => {
  const errors = trackErrors(page);
  const ghost = { t: 40, d: Array.from({ length: 400 }, (_, i) => [i * 30, 0, 0]) };
  await page.addInitScript(([k, g]) => localStorage.setItem(k, JSON.stringify({ v: 3, runs: 5, ghosts: { 'c1-1': g }, raceBest: { 'c1-1': 40 } })), [SAVE, ghost]);
  await page.goto('/?debug&nosw');
  await page.waitForFunction(() => !!window.G);
  await startCup(page);
  const res = await page.evaluate(async () => {
    const G = window.G, r = G.run;
    const { onHit } = await import('/js/game.js');
    for (let i = 0; i < 60; i++) window.D.step(1 / 60, false);
    r.shields = 0;
    r.lastStand = false;
    G.player.invuln = 0;
    onHit({ type: 'wall', x: G.player.x, y0: 0, y1: 99, z: r.dist, alive: true });
    window.D.step(1 / 60, true);
    return { ghost: !!r.race.ghost, mode: G.mode, crash: r.crashT > 0, tag: document.getElementById('raceTag').textContent };
  });
  expect(res.ghost).toBe(true);
  expect(res.mode).toBe('play');
  expect(res.crash).toBe(true);
  expect(res.tag).toContain('👻');
  expect(errors).toEqual([]);
});

test('carreras: la copa 2 está cerrada hasta tener medalla en la 1', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ v: 3, runs: 5 })), SAVE);
  await page.goto('/?nosw');
  await page.locator('#btnRaces').click();
  await expect(page.locator('[data-cup="c2"]')).toBeDisabled();
  await expect(page.locator('[data-cup="c1"]')).toBeEnabled();
});
