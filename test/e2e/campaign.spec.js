import { test, expect } from '@playwright/test';
import { trackErrors, botInPage } from './helpers.js';

const SAVE = 'overdrive-save-v1';

async function openLevel(page, id, { god = false, seedSave = null } = {}) {
  if (seedSave) {
    await page.addInitScript(([k, v]) => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem(k, JSON.stringify(v));
      }
    }, [SAVE, seedSave]);
  }
  await page.goto('/?debug&nosw');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate((g) => { window.G.manual = true; window.G.god = g; }, god);
  await page.locator('#btnCampaign').click();
  await page.locator(`.lvl[data-level="${id}"]`).click();
  await page.locator('#btnLevelGo').click();
  await page.waitForFunction(() => window.G.mode === 'play');
}

// avanza la simulación hasta que aparezca la pantalla de victoria
const toVictory = () => {
  for (let i = 0; i < 200 && window.G.mode === 'won'; i++) window.D.step(1 / 60, false);
  return window.G.mode;
};

test('el bot supera el nivel 1-1 sin golpes, gana estrellas y abre el 1-2', async ({ page }) => {
  const errors = trackErrors(page);
  await openLevel(page, '1-1');
  const res = await page.evaluate(botInPage, { seconds: 120 });
  expect(res.hits).toEqual([]);
  expect(res.mode).toBe('won');
  expect(await page.evaluate(toVictory)).toBe('victory');
  await expect(page.locator('#victory')).toBeVisible();
  await expect(page.locator('#vTitle')).toHaveText('¡NIVEL SUPERADO!');
  // sin golpes: al menos "meta" y "sin perder escudos"
  expect(await page.locator('#vStars .on').count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator('#btnNext')).toHaveText('SIGUIENTE · 1-2');
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).campaign['1-1'], SAVE);
  expect(saved[0]).toBe(true);
  // el mapa ya deja jugar el 1-2
  await page.locator('#btnMap').click();
  await expect(page.locator('.lvl[data-level="1-2"]')).not.toHaveClass(/locked/);
  await expect(page.locator('.lvl[data-level="1-3"]')).toHaveClass(/locked/);
  expect(errors).toEqual([]);
});

test('un nivel de campaña tiene siempre la misma pista', async ({ page }) => {
  const track = () => window.G.run.objects.slice(0, 40).map((o) => `${o.type}@${o.lane}:${Math.round(o.z)}`).join(',');
  await openLevel(page, '1-1');
  await page.evaluate(() => { for (let i = 0; i < 120; i++) window.D.step(1 / 60, false); });
  const a = await page.evaluate(track);
  await page.goto('/?debug&nosw');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; });
  await page.locator('#btnCampaign').click();
  await page.locator('.lvl[data-level="1-1"]').click();
  await page.locator('#btnLevelGo').click();
  await page.evaluate(() => { for (let i = 0; i < 120; i++) window.D.step(1 / 60, false); });
  expect(await page.evaluate(track)).toBe(a);
});

test('nivel de jefe: derrotarlo da la estrella y la meta aparece después', async ({ page }) => {
  const errors = trackErrors(page);
  const done = [true, false, false];
  await openLevel(page, '1-4', { god: true, seedSave: { v: 2, runs: 5, campaign: { '1-1': done, '1-2': done, '1-3': done } } });
  expect(await page.evaluate(() => window.G.run.boss?.id)).toBe('gusano');
  const res = await page.evaluate(botInPage, { seconds: 150, god: true });
  expect(res.bosses).toBe(1);
  expect(res.mode).toBe('won');
  expect(await page.evaluate(toVictory)).toBe('victory');
  await expect(page.locator('#vStars span').first()).toHaveClass(/on/);
  // primer nivel del sector 2 sigue cerrado (faltan estrellas): no hay "siguiente"
  await expect(page.locator('#btnNext')).toBeHidden();
  expect(errors).toEqual([]);
});

test('los sectores se abren con estrellas', async ({ page }) => {
  const all = [true, true, true];
  await page.addInitScript(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [SAVE, { v: 2, campaign: { '1-1': all, '1-2': all } }]);
  await page.goto('/?debug&nosw');
  await page.locator('#btnCampaign').click();
  await expect(page.locator('#campStars')).toHaveText('★ 6');
  await expect(page.locator('.sector').nth(1)).not.toHaveClass(/locked/);
  await expect(page.locator('.sector').nth(2)).toHaveClass(/locked/);
  await expect(page.locator('.lvl[data-level="2-1"]')).not.toHaveClass(/locked/);
});

// Cada nivel tiene una pista fija: si una fuera injusta, lo sería para siempre. El bot (sin
// modo dios) tiene que poder llegar a la meta de todos los niveles sin jefe sin un solo golpe.
const ALL = ['1-1', '1-2', '1-3', '2-1', '2-2', '2-3', '3-1', '3-2', '3-3', '4-1', '4-2', '4-3'];
for (const id of ALL) {
  test(`nivel ${id}: justo, el bot llega a la meta sin golpes`, async ({ page }) => {
    const all = [true, true, true];
    const campaign = Object.fromEntries(ALL.map((l) => [l, all]));
    await openLevel(page, id, { seedSave: { v: 2, runs: 5, campaign } });
    const res = await page.evaluate(botInPage, { seconds: 200 });
    expect(res.hits).toEqual([]);
    expect(res.mode).toBe('won');
  });
}

// Campaña infinita: con los 4 sectores fijos superados se abre el 5, y luego uno tras otro
const ALL3 = [true, true, true];
const doneUpTo = (lastSector) => {
  const c = {};
  for (let n = 1; n <= lastSector; n++) for (let k = 1; k <= 4; k++) c[`${n}-${k}`] = ALL3;
  return c;
};

for (const id of ['5-1', '7-1']) {
  test(`sector generado: el bot llega a la meta de ${id} sin golpes`, async ({ page }) => {
    const errors = trackErrors(page);
    const n = Number(id.split('-')[0]);
    await openLevel(page, id, { seedSave: { v: 3, runs: 5, campaign: doneUpTo(n - 1) } });
    const lv = await page.evaluate(() => ({ mods: [...window.G.run.mods], id: window.G.run.camp.level.id }));
    expect(lv.id).toBe(id);
    expect(lv.mods.length).toBeGreaterThan(0);
    const res = await page.evaluate(botInPage, { seconds: 240 });
    expect(res.hits, `golpes: ${JSON.stringify(res.hits)}`).toEqual([]);
    expect(res.mode).toBe('won');
    expect(errors).toEqual([]);
  });
}

test('mapa: enseña los sectores abiertos y uno más; el jefe élite se puede vencer', async ({ page }) => {
  const errors = trackErrors(page);
  await openLevel(page, '6-4', { god: true, seedSave: { v: 3, runs: 5, campaign: { ...doneUpTo(5), '6-1': ALL3, '6-2': ALL3, '6-3': ALL3 } } });
  const b = await page.evaluate(() => ({ elite: window.G.run.boss.def.elite, name: window.G.run.boss.name, hp: window.G.run.boss.max }));
  expect(b.elite).toBe(true);
  expect(b.name).toContain('ÉLITE');
  const res = await page.evaluate(botInPage, { seconds: 200, god: true });
  expect(res.bosses).toBe(1);
  expect(res.mode).toBe('won');
  expect(await page.evaluate(toVictory)).toBe('victory');
  await expect(page.locator('#vStars span').first()).toHaveClass(/on/);
  await expect(page.locator('#btnNext')).toHaveText('SIGUIENTE · 7-1');
  await page.locator('#btnMap').click();
  await expect(page.locator('.sector')).toHaveCount(8, { timeout: 5000 }); // 1..7 abiertos + el 8 cerrado
  await expect(page.locator('.sector[data-sector="8"]')).toHaveClass(/locked/);
  await expect(page.locator('.lvl[data-level="7-1"]')).not.toHaveClass(/locked/);
  expect(errors).toEqual([]);
});
