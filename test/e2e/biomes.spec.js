import { test, expect } from '@playwright/test';
import { trackErrors, botInPage } from './helpers.js';

async function start(page, query) {
  await page.addInitScript(() => localStorage.setItem('overdrive-save-v1', JSON.stringify({ v: 2, runs: 3 })));
  await page.goto(`/?debug&nosw&${query}`);
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => {
    window.G.manual = true;
    document.getElementById('btnPlay').click();
    window.__seen = new Set();
    const orig = window.D.step;
    window.D.step = (s, d) => { for (const o of window.G.run.objects) window.__seen.add(o.type); return orig(s, d); };
  });
}

// Mecánica propia de cada bioma, forzada con ?pattern (start elige el bioma)
const BIOME_CASES = [
  { name: 'lava: ríos de lava', q: 'seed=8&start=2&pattern=lavaFlow', type: 'lava' },
  { name: 'glitch: muros que saltan de carril', q: 'seed=8&start=3&pattern=glitchWall', type: 'glitch', biome: 'glitch' },
  { name: 'neón: cortina de láser alto y bajo', q: 'seed=8&start=11&pattern=laserDuo', type: 'laserHigh', biome: 'neon' },
  { name: 'glaciar: carámbanos que caen', q: 'seed=8&start=5&pattern=icicleRain', type: 'icicle', biome: 'ice' },
  { name: 'glaciar: crestas de hielo', q: 'seed=8&start=5&pattern=iceRidge', type: 'iceRidge', biome: 'ice' },
  { name: 'glaciar: el bioma tal cual', q: 'seed=11&start=5', type: 'icicle', biome: 'ice' },
];
for (const c of BIOME_CASES) {
  test(`${c.name}: el bot sobrevive`, async ({ page }) => {
    const errors = trackErrors(page);
    await start(page, c.q);
    if (c.biome) expect(await page.evaluate(() => window.G.run.biome.id)).toBe(c.biome);
    const res = await page.evaluate(botInPage, { seconds: 40 });
    expect(await page.evaluate(() => [...window.__seen])).toContain(c.type);
    expect(res.hits, `golpes: ${JSON.stringify(res.hits)}`).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('hiperespacio: gravedad baja (saltos más largos) y el bot sobrevive', async ({ page }) => {
  await start(page, 'seed=9&start=4');
  const st = await page.evaluate(() => ({ low: window.G.run.lowGrav, g: window.G.run.stats.gravity, biome: window.G.run.biome.id }));
  expect(st.biome).toBe('hyper');
  expect(st.low).toBe(true);
  expect(st.g).toBeLessThan(30);
  const res = await page.evaluate(botInPage, { seconds: 45 });
  expect(res.hits, `golpes: ${JSON.stringify(res.hits)}`).toEqual([]);
});

for (const id of ['tunel', 'estampida', 'meteoritos', 'gusano']) {
  test(`set piece ${id}: se anuncia y el bot lo supera`, async ({ page }) => {
    const errors = trackErrors(page);
    await start(page, `seed=10&start=4&script=${id}`);
    const res = await page.evaluate(botInPage, { seconds: 50 });
    expect(await page.evaluate(() => window.G.run.scriptsSeen || [])).toContain(id);
    expect(res.hits, `golpes: ${JSON.stringify(res.hits)}`).toEqual([]);
    expect(errors).toEqual([]);
  });
}

for (const id of ['blackout', 'magstorm', 'double']) {
  test(`evento ${id}: se activa sin errores`, async ({ page }) => {
    const errors = trackErrors(page);
    await start(page, `seed=11&start=2&event=${id}`);
    const res = await page.evaluate(async (bot) => {
      const run = new Function(`return (${bot})`)();
      let seen = false;
      const G = window.G;
      const orig = window.D.step;
      window.D.step = (s, d) => { if (G.run.event?.id) seen = seen || G.run.event.id; return orig(s, d); };
      const r = await run({ seconds: 15 });
      return { seen, hits: r.hits };
    }, botInPage.toString());
    expect(res.seen).toBe(id);
    expect(errors).toEqual([]);
  });
}
