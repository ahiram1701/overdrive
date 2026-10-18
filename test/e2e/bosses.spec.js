import { test, expect } from '@playwright/test';
import { trackErrors, botInPage } from './helpers.js';

const IDS = ['gusano', 'ojo', 'devorador', 'censor', 'ovni', 'leviatan'];

async function startBoss(page, id, seed) {
  await page.addInitScript(() => localStorage.setItem('overdrive-save-v1', JSON.stringify({ v: 2, runs: 3 })));
  // start=3 → el tramo 3 es de jefe
  await page.goto(`/?debug&nosw&seed=${seed}&start=3&boss=${id}`);
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; document.getElementById('btnPlay').click(); });
  expect(await page.evaluate(() => window.G.run.boss && window.G.run.boss.id)).toBe(id);
}

// Equidad: el bot (que no ataca al jefe) aguanta hasta que el jefe se escapa, sin golpes
for (const id of IDS) {
  test(`jefe ${id}: el bot sobrevive a todos sus ataques sin golpes`, async ({ page }) => {
    const errors = trackErrors(page);
    await startBoss(page, id, 21);
    const res = await page.evaluate(async (bot) => {
      const run = new Function(`return (${bot})`)();
      const G = window.G;
      const orig = window.D.step;
      let forced = false;
      window.D.step = (s, d) => {
        const b = G.run.boss;
        if (b && !forced && b.t > 15) { forced = true; b.hp = Math.ceil(b.max / 2); b.phase = 1; b.calm = 1.2; b.timers = {}; }
        return orig(s, d);
      };
      const r = await run({ seconds: 50 });
      return { hits: r.hits, forced, boss: !!G.run.boss };
    }, botInPage.toString());
    expect(res.forced).toBe(true);
    expect(res.hits, `golpes: ${JSON.stringify(res.hits)}`).toEqual([]);
    expect(errors).toEqual([]);
  });

  test(`jefe ${id}: se le puede derrotar y pasa a la fase 2`, async ({ page }) => {
    const errors = trackErrors(page);
    await startBoss(page, id, 22);
    const res = await page.evaluate(() => {
      const G = window.G;
      G.god = true;
      let phase2 = false;
      for (let i = 0; i < 60 * 60 && G.run.boss; i++) {
        G.player.dash = 0.3;
        // ir hacia el carril del núcleo más cercano
        const core = G.run.objects.filter((o) => o.alive && o.type === 'core' && o.z - G.run.dist > 0).sort((a, b) => a.z - b.z)[0];
        if (core) G.player.lane = core.lane;
        window.D.step(1 / 60, false);
        if (G.run.boss && G.run.boss.phase === 1) phase2 = true;
      }
      return { defeated: G.run.bosses, phase2 };
    });
    expect(res.phase2).toBe(true);
    expect(res.defeated).toBe(1);
    expect(errors).toEqual([]);
  });
}
