// GALAXIA · exploración: anomalías al escanear, el Ciclo+ y los sistemas ocultos
import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

const SAVE = 'overdrive-save-v1';
async function boot(page, extra = {}) {
  const seedSave = { v: 3, runs: 5, tips: { galaxy: true, galCombat: true, dock: true }, story: { seen: { 0: true } }, ...extra };
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
async function fly(page) {
  await page.locator('#btnGalaxy').click();
  await page.locator('#btnGalGo').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
}

test('anomalía: la reliquia antigua da una pieza de equipo y el Atlas cuenta su texto', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await fly(page);
  const res = await page.evaluate(async () => {
    const { LORE } = await import('/js/galaxyMissions.js');
    const s = window.G.space;
    const before = Object.keys(window.__save.galaxyGear.owned || {}).length;
    s.pois.push({ id: 'test-relic', sys: s.sysId, kind: 'relic', pos: { ...s.ship.pos }, reward: 100, lore: 'x' });
    s.ship.throttle = 0;
    for (let i = 0; i < 160; i++) { s.pois.at(-1).pos = { ...s.ship.pos }; window.D.step(1 / 30, false); } // (la reliquia, pegada a la nave)
    return { after: Object.keys(window.__save.galaxyGear.owned || {}).length, before, atlas: window.__save.galaxyAtlas['test-relic'], lore0: LORE[0] };
  });
  expect(res.after).toBe(res.before + 1);
  expect(typeof res.atlas).toBe('number');
  expect(errors).toEqual([]);
});

test('ciclo+: cerrado sin el final; con él, una galaxia nueva más dura que conserva lo tuyo', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page, { galaxy: { started: true, credits: 5000, hulls: ['explorer', 'warship'], visited: [0, 1, 2], sys: 2 }, territory: { 5: 'coal' } });
  await page.locator('#btnGalaxy').click();
  await expect(page.locator('#ghCycle')).toContainText('Termina LA SEÑAL');
  await expect(page.locator('#btnGhCycle')).toBeHidden();
  await page.evaluate(async () => { window.__save.story.ending = 'liga'; const { ui } = await import('/js/ui.js'); ui.showGalaxyHub(); });
  const before = await page.evaluate(async () => { const { GAL } = await import('/js/spaceGame.js'); return GAL[1].name; });
  await page.locator('#btnGhCycle').click();
  await expect(page.locator('#btnGhCycle')).toContainText('SEGURO');
  await page.locator('#btnGhCycle').click();
  const st = await page.evaluate(async () => {
    const { GAL, threat } = await import('/js/spaceGame.js');
    const g = window.__save.galaxy;
    return { cycle: g.cycle, sys: g.sys, visited: g.visited, credits: g.credits, hulls: g.hulls, terr: Object.keys(window.__save.territory).length, name: GAL[1].name, n: GAL.length, t: threat() };
  });
  expect(st.cycle).toBe(1);
  expect(st.sys).toBe(0);
  expect(st.visited).toEqual([0]);
  expect(st.credits).toBe(5000);
  expect(st.hulls).toContain('warship');
  expect(st.terr).toBe(0);
  expect(st.name).not.toBe(before);
  expect(st.n).toBe(35);
  await expect(page.locator('#ghWhere')).toContainText('ciclo 1');
  await page.locator('#btnGalGo').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  expect(await page.evaluate(() => window.G.space.sysId)).toBe(0);
  expect(errors).toEqual([]);
});

test('sistema oculto: tras un agujero de gusano, con su aviso', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  const hid = await page.evaluate(async () => {
    const { GAL } = await import('/js/spaceGame.js');
    const h = GAL.find((s) => s.hidden);
    const { persist } = await import('/js/save.js');
    Object.assign(window.__save.galaxy, { started: true, sys: h.wormhole, visited: [0, h.wormhole], up: { engine: 0, laser: 0, shield: 0, cargo: 0, jump: 10, missile: 0 } });
    persist();
    return { id: h.id, host: h.wormhole };
  });
  await fly(page);
  // la puerta hacia el sistema oculto existe en el sistema anfitrión
  const gate = await page.evaluate((id) => window.G.space.sys.gates.some((g) => g.to === id), hid.id);
  expect(gate).toBe(true);
  expect(errors).toEqual([]);
});
