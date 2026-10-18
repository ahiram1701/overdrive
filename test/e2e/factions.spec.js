import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

// GALAXIA (E3): facciones, territorio y cazarrecompensas
async function startGalaxy(page, extra = {}) {
  await page.addInitScript((x) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('overdrive-save-v1', JSON.stringify({ v: 4, runs: 5, settings: { sound: false }, galaxy: { started: true, credits: 100, up: { jump: 5 } }, ...x }));
  }, extra);
  await page.goto('/?debug&nosw&seed=3');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; });
  await page.locator('#btnGalaxy').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
}
// salta directamente a un sistema (como cruzar su puerta)
const jumpTo = (page, id) => page.evaluate((to) => {
  const s = window.G.space;
  s.jumpT = 0.05;
  s.jumpTo = to;
  for (let i = 0; i < 10; i++) window.D.step(1 / 60, false);
  return s.sysId;
}, id);
// mata a lo que diga `pick` con un disparo enorme
const zap = (page, pick) => page.evaluate((src) => {
  const s = window.G.space;
  const t = new Function('s', `return ${src}`)(s);
  if (!t) return false;
  s.bolts.push({ pos: { ...t.pos }, vel: { x: 0, y: 0, z: 0 }, life: 1, dmg: 1e6 });
  window.D.step(1 / 60, false);
  return true;
}, pick);

test('liberar un sistema pirata: base + 4 piratas, cambia de dueño y el mapa lo pinta', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  const pirId = await page.evaluate(async () => {
    const { genGalaxy } = await import('/js/galaxy.js');
    const { ownerOf } = await import('/js/factions.js');
    return genGalaxy().find((s) => ownerOf(s) === 'pir').id;
  });
  expect(await jumpTo(page, pirId)).toBe(pirId);
  await expect(page.locator('#shObjective')).toContainText('Libera');
  expect(await page.evaluate(() => !!window.G.space.base)).toBe(true);
  await zap(page, 's.base');
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => { // si no quedan, aparece uno de refuerzo
      const s = window.G.space;
      if (!s.pirates.some((p) => p.alive)) { s.pirateT = 0; window.D.step(1 / 60, false); }
    });
    await zap(page, 's.pirates.find((p) => p.alive)');
  }
  const res = await page.evaluate((id) => ({ terr: window.__save.territory[id], owner: window.G.space.owner, rep: window.__save.factionRep }), pirId);
  expect(['liga', 'coal']).toContain(res.terr);
  expect(res.owner).toBe(res.terr);
  expect(res.rep.pir).toBeLessThan(0);
  // el mapa: liberado 1 y el sistema con el color de su nueva facción
  await page.locator('#btnGalMap').click();
  await expect(page.locator('#gmInfo')).toContainText('liberados 1/');
  const style = await page.locator(`.gm-node[data-sys="${pirId}"] circle.fac`).getAttribute('style');
  expect(style).toContain(res.terr === 'liga' ? '#30d158' : '#00e5ff');
  expect(errors).toEqual([]);
});

test('se busca: aceptar en la estación, el objetivo aparece en su sistema y abatirlo paga', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  await page.evaluate(() => window.D.step(1 / 30, false));
  await page.locator('#btnDock').click();
  await expect(page.locator('#stBounties [data-bounty]')).toHaveCount(3);
  await expect(page.locator('#stFaction')).toContainText('Coalición Solar');
  await page.locator('#stBounties [data-bounty]').first().click();
  const b = await page.evaluate(() => window.__save.bounties.active);
  expect(b && b.name).toBeTruthy();
  await page.locator('#btnUndock').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  await page.evaluate(() => window.D.step(1 / 30, false));
  await expect(page.locator('#shObjective')).toContainText(b.name);
  // el objetivo se mueve al saltar: vamos a donde esté
  await jumpTo(page, b.sys);
  const here = await page.evaluate(() => window.__save.bounties.active.sys);
  if (here !== b.sys) await jumpTo(page, here);
  expect(await page.evaluate(() => window.G.space.pirates.some((p) => p.bounty))).toBe(true);
  const c0 = await page.evaluate(() => window.__save.galaxy.credits);
  await zap(page, 's.pirates.find((p) => p.bounty)');
  const after = await page.evaluate(() => ({ c: window.__save.galaxy.credits, active: window.__save.bounties.active, done: Object.keys(window.__save.bounties.done) }));
  expect(after.c).toBeGreaterThanOrEqual(c0 + b.reward);
  expect(after.active).toBe(null);
  expect(after.done).toContain(b.id);
  expect(errors).toEqual([]);
});

test('tienda de facción: con reputación de Amigo se compra su pintura con créditos', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { factionRep: { coal: 25 }, galaxy: { started: true, credits: 3000 } });
  await page.evaluate(() => window.D.step(1 / 30, false));
  await page.locator('#btnDock').click();
  await expect(page.locator('#stFaction')).toContainText('Amigo');
  await page.locator('[data-fshop="f-coal"]').click();
  await expect(page.locator('[data-fshop="f-coal"]')).toBeDisabled();
  expect(await page.evaluate(() => ({ c: window.__save.galaxy.credits, owned: window.__save.crates.owned }))).toEqual({ c: 1000, owned: ['f-coal'] });
  await expect(page.locator('[data-fshop="f-coal-e"]')).toContainText('Aliado');
  expect(errors).toEqual([]);
});

test('talentos de la Galaxia: en la estación y con créditos (las gemas no cambian)', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { gems: 50, galaxy: { started: true, credits: 1500 } });
  await page.evaluate(() => window.D.step(1 / 30, false));
  await page.locator('#btnDock').click();
  await page.locator('#stTalents [data-talent="g1"]').click();
  await expect(page.locator('#stTalents [data-talent="g1"]')).toHaveClass(/bought/);
  expect(await page.evaluate(() => ({ c: window.__save.galaxy.credits, g: window.__save.gems, t: window.__save.talents.g1 }))).toEqual({ c: 500, g: 50, t: true });
  expect(errors).toEqual([]);
});
