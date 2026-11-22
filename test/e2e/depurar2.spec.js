// DEPURACIÓN 2: salto corto con la meta cerca, jefe de la expedición, velocidad tras salir, abandonar la expedición
import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

const SAVE = 'overdrive-save-v1';
async function boot(page, seedSave = { v: 3, runs: 5, tips: { runner: true, expedition: true, relic: true } }) {
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

test('salto corto: nunca atraviesa una bifurcación (la partida sigue)', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await page.locator('#btnRunner').click();
  await page.locator('#btnPlay').click();
  await page.waitForFunction(() => window.G.mode === 'play');
  const res = await page.evaluate(() => {
    const r = window.G.run;
    window.G.god = true;
    // avanzar hasta que haya una bifurcación delante
    let fork = null;
    for (let i = 0; i < 4000 && !fork; i++) { window.D.step(0.05, false); fork = r.objects.find((o) => o.alive && o.type === 'fork' && o.z - r.dist > 0); }
    if (!fork) return { noFork: true };
    while (fork.z - r.dist > 20) window.D.step(1 / 120, false);
    r.ability = { id: 'blink', cd: 12, dur: 0, pow: 1, mut: null, cdLeft: 0, active: 0 };
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'e' }));
    const ahead = fork.z - r.dist;
    for (let i = 0; i < 240 && window.G.mode === 'play'; i++) window.D.step(1 / 60, false);
    return { ahead, mode: window.G.mode };
  });
  expect(res.noFork).toBeUndefined();
  expect(res.ahead).toBeGreaterThan(0); // el salto se paró antes de la bifurcación
  expect(res.mode).not.toBe('play'); // la bifurcación se resolvió (cartas/tienda)
  expect(errors).toEqual([]);
});

test('velocidad: la SOBRECARGA del Runner no se arrastra a otro juego', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await page.evaluate(() => { window.G.timeWarp = 0.55; });
  await page.locator('#btnPecio').click();
  await page.locator('#btnPecioPlay').click();
  expect(await page.evaluate(() => window.G.timeWarp)).toBe(1);
  expect(errors).toEqual([]);
});

test('expedición: el jefe del acto vuelve si escapa, y se puede abandonar desde el mapa', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await page.evaluate(async () => { const m = await import('/js/game.js'); m.newRun({ mode: 'expedition' }); });
  await page.waitForFunction(() => ['expMap', 'cards', 'play'].includes(window.G.mode));
  const esc = await page.evaluate(async () => {
    const r = window.G.run, m = await import('/js/game.js'), ex = await import('/js/expedition.js');
    const node = ex.nodeById(r.exp.map, r.exp.at);
    node.type = 'boss';
    const w = await import('/js/world.js');
    w.spawnBoss(r);
    m.bossEscaped();
    return { boss: !!r.boss, sectionEnd: r.sectionEnd };
  });
  expect(esc.boss).toBe(true); // ha vuelto
  // al mapa y abandonar
  await page.evaluate(async () => { (await import('/js/ui.js')).ui.showExpMap(window.G.run.exp); });
  await page.locator('#btnExpQuit').click();
  await expect(page.locator('#btnExpQuit')).toHaveText(/SEGURO/);
  await page.locator('#btnExpQuit').click();
  for (let i = 0; i < 20 && (await page.evaluate(() => window.G.mode)) !== 'dead'; i++) await page.evaluate(() => window.D.step(0.25));
  expect(await page.evaluate(() => window.G.mode)).toBe('dead'); // la pantalla final de siempre
  expect(errors).toEqual([]);
});
