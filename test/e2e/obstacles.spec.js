import { test, expect } from '@playwright/test';
import { trackErrors, botInPage } from './helpers.js';

// Cada elemento nuevo, forzado en una de cada dos filas (?pattern=): el bot debe sobrevivir
// sin golpes y la mecánica tiene que llegar a ocurrir de verdad.
const CASES = [
  { pattern: 'pinch', type: 'crusher' },
  { pattern: 'rollers', type: 'roller' },
  { pattern: 'dropRow', type: 'dropper' },
  { pattern: 'portalSwap', type: 'portal', check: (s) => s.portals > 0 },
  { pattern: 'rampJump', type: 'ramp', check: (s) => s.ramps > 0 },
  { pattern: 'railRun', type: 'rail', check: (s) => s.grindT > 0.5 },
  { pattern: 'droneLine', type: 'drone' },
];

for (const c of CASES) {
  test(`${c.pattern}: aparece, el bot sobrevive y la mecánica ocurre`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.addInitScript(() => localStorage.setItem('overdrive-save-v1', JSON.stringify({ v: 2, runs: 3 })));
    await page.goto(`/?debug&nosw&seed=6&start=2&pattern=${c.pattern}`);
    await page.waitForFunction(() => !!window.G);
    const seen = await page.evaluate(() => {
      window.G.manual = true;
      document.getElementById('btnPlay').click();
      window.__seen = new Set();
      const orig = window.D.step;
      window.D.step = (s, d) => { for (const o of window.G.run.objects) window.__seen.add(o.type); return orig(s, d); };
      return true;
    });
    expect(seen).toBe(true);
    const res = await page.evaluate(botInPage, { seconds: 40 });
    const st = await page.evaluate(() => ({
      types: [...window.__seen], portals: window.G.run.portals || 0, ramps: window.G.run.ramps || 0, grindT: window.G.run.grindT || 0,
    }));
    expect(st.types).toContain(c.type);
    expect(res.hits, `golpes: ${JSON.stringify(res.hits)}`).toEqual([]);
    if (c.check) expect(c.check(st), JSON.stringify(st)).toBe(true);
    expect(errors).toEqual([]);
  });
}
