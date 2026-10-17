import { test, expect } from '@playwright/test';
import { trackErrors, botInPage } from './helpers.js';

const SAVE = 'overdrive-save-v1';
const SHIPS = ['viper', 'brick', 'ghost', 'nova', 'kaiju', 'raptor', 'comet'];
const MAX_TREE = Object.fromEntries(SHIPS.map((s) => [s, { a: 3, b: 3, c: 3 }]));
// la build "rota": todo lo que alarga y recarga el overdrive y el dash, y Vampiro
const BROKEN = ['cargador', 'cargador', 'cargador', 'odplus', 'odplus', 'odplus', 'carga', 'carga', 'recarga', 'recarga', 'recarga', 'adrenalina', 'vampiro'];

// Antes del ajuste: Viper 64%, Nova 84% y Nova con la build rota 96% del tiempo invulnerable.
// Mide en la página: % del tiempo invulnerable (overdrive, dash o Ariete/Fase activos) y escudos ganados
async function measure(page, { ship, cards = [], seconds = 120, seed = 21 }) {
  await page.addInitScript(([k, s, tree]) => localStorage.setItem(k, JSON.stringify({ v: 3, runs: 5, ship: s, ships: Object.keys(tree), shipLvl: tree })), [SAVE, ship, MAX_TREE]);
  await page.goto(`/?debug&nosw&seed=${seed}`);
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; });
  await page.locator('#btnPlay').click();
  await page.waitForFunction(() => window.G.mode === 'play');
  await page.evaluate(async (ids) => {
    const { pickCard } = await import('/js/game.js');
    for (const id of ids) pickCard(id);
    // medidor: cada paso de simulación anota si eres invulnerable
    const G = window.G, D = window.D;
    const step = D.step;
    window.__inv = { t: 0, inv: 0, od: 0, dash: 0, abil: 0, shields: 0, last: G.run.shields };
    D.step = (dt, draw) => {
      step(dt, draw);
      const r = G.run, p = G.player, a = r.ability;
      if (!r || G.mode !== 'play') return;
      window.__inv.t += dt;
      const abil = a && a.active > 0 && (a.id === 'ram' || a.id === 'phase');
      if (r.odTime > 0 || p.dash > 0 || abil) window.__inv.inv += dt;
      if (r.odTime > 0) window.__inv.od += dt;
      if (p.dash > 0) window.__inv.dash += dt;
      if (abil) window.__inv.abil += dt;
      if (r.shields > window.__inv.last) window.__inv.shields += r.shields - window.__inv.last;
      window.__inv.last = r.shields;
    };
  }, cards);
  await page.evaluate(botInPage, { seconds, ability: true });
  return page.evaluate(() => {
    const m = window.__inv;
    return { uptime: m.inv / m.t, od: m.od / m.t, shields: m.shields, t: m.t, split: `od ${(100 * m.od / m.t).toFixed(0)}% · dash ${(100 * m.dash / m.t).toFixed(0)}% · hab ${(100 * m.abil / m.t).toFixed(0)}%` };
  });
}

test('Nova con la build rota no vive en overdrive', async ({ page }) => {
  const errors = trackErrors(page);
  const m = await measure(page, { ship: 'nova', cards: BROKEN });
  console.log(`BALANCE nova+rota uptime=${(m.uptime * 100).toFixed(1)}% escudos=${m.shields} t=${m.t.toFixed(0)}s (${m.split})`);
  expect(m.uptime).toBeLessThanOrEqual(0.35);
  expect(errors).toEqual([]);
});

for (const ship of SHIPS) {
  test(`${ship} con árbol al máximo y sin cartas: invulnerable poco tiempo`, async ({ page }) => {
    const m = await measure(page, { ship });
    console.log(`BALANCE ${ship} uptime=${(m.uptime * 100).toFixed(1)}% escudos=${m.shields} t=${m.t.toFixed(0)}s (${m.split})`);
    // el overdrive, igual de raro en todas; Ariete y Fase suman lo suyo, pero con tope
    expect(m.od).toBeLessThanOrEqual(0.28);
    expect(m.uptime).toBeLessThanOrEqual(0.35);
  });
}
