import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';
import { genGalaxy } from '../../js/galaxy.js';
import { chapters } from '../../js/story.js';

// GALAXIA (E4): fabricación, historia LA SEÑAL y el Devorador de Estrellas
async function startGalaxy(page, extra = {}) {
  await page.addInitScript((x) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('overdrive-save-v1', JSON.stringify({ v: 4, runs: 5, settings: { sound: false }, galaxy: { started: true, credits: 5000, up: { missile: 2 } }, ...x }));
  }, extra);
  await page.goto('/?debug&nosw&seed=3');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; });
  await page.locator('#btnGalaxy').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
}

test('taller: fabricar el láser doble lo monta y dispara dos rayos', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { galaxyMats: { chatarra: 20, circuitos: 5 } });
  await page.evaluate(() => window.D.step(1 / 30, false));
  await page.locator('#btnDock').click();
  await page.locator('[data-gear="laser2"]').click();
  await expect(page.locator('#stSlots .slot.full')).toContainText('Láser doble');
  const sv = await page.evaluate(() => ({ c: window.__save.galaxy.credits, m: window.__save.galaxyMats.chatarra }));
  expect(sv).toEqual({ c: 5000 - 900, m: 12 });
  await page.evaluate(() => document.getElementById('btnUndock').click());
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  const shots = await page.evaluate(() => {
    const s = window.G.space;
    s.bolts = [];
    s.botFire = true;
    window.D.step(1 / 60, false);
    s.botFire = false;
    return s.bolts.length;
  });
  expect(shots).toBe(2);
  expect(errors).toEqual([]);
});

test('historia: el capítulo 1 se cuenta en un diálogo y se completa en la baliza', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  await expect(page.locator('#dialog')).toBeVisible();
  await expect(page.locator('#dlName')).toHaveText('Dra. Ilen');
  await page.locator('#btnDialog').click();
  await page.locator('#btnDialog').click();
  await expect(page.locator('#dialog')).toBeHidden();
  await page.evaluate(() => window.D.step(1 / 30, false));
  await expect(page.locator('#shObjective')).toContainText('Acto I · 1/8');
  // vuela a la baliza y quédate 2 s
  const res = await page.evaluate(() => {
    const s = window.G.space;
    s.ship.pos = { ...s.storyMarker };
    s.ship.throttle = 0;
    for (let i = 0; i < 150; i++) window.D.step(1 / 60, false);
    return window.__save.story.ch;
  });
  expect(res).toBe(1);
  await expect(page.locator('#dlName')).toHaveText('La Señal'); // cierre del capítulo
  expect(errors).toEqual([]);
});

test('el Devorador: invulnerable con ojos, núcleo al caer los 3, furia y derrota', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { story: { ch: 7, n: 0, seen: { 7: true } } });
  const hit = (src) => page.evaluate((x) => {
    const s = window.G.space, d = s.devourer;
    const t = new Function('d', `return ${x}`)(d);
    s.bolts.push({ pos: { ...t.pos }, vel: { x: 0, y: 0, z: 0 }, life: 1, dmg: 400 });
    window.D.step(1 / 60, false);
    return s.devourer ? { phase: s.devourer.phase, hp: s.devourer.hp, eyes: s.devourer.eyes.filter((e) => e.alive).length } : null;
  }, src);
  await page.evaluate(() => { window.G.god = true; window.__devourer(); window.D.step(1 / 60, false); });
  const before = await hit('d');
  expect(before.hp).toBe(4200); // con ojos, el núcleo no recibe daño
  let st = before;
  for (let i = 0; i < 6 && st.eyes > 0; i++) st = await hit('d.eyes.find((e) => e.alive)');
  expect(st.eyes).toBe(0);
  expect(st.phase).toBe(2);
  while (st && st.phase === 2) st = await hit('d');
  expect(st.phase).toBe(3);
  while (st) st = await hit('d');
  expect(await page.evaluate(() => window.G.space.devourer)).toBe(null);
  expect(errors).toEqual([]);
});

// el Acto II: los sistemas salen de la galaxia fija (se calculan aquí, en Node)
const GAL2 = genGalaxy();
const QUEEN = chapters(GAL2).findIndex((c) => c.goal.boss === 'queen');

test('Acto II: una partida que acabó el Acto I lo empieza con su diálogo', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { story: { ch: 8, n: 0, seen: {} } });
  await expect(page.locator('#dialog')).toBeVisible();
  await expect(page.locator('#dialog')).toContainText('zumbido');
  await page.locator('#btnInv').click();
  await page.locator('#giTabs [data-tab="mis"]').click();
  await expect(page.locator('#galInv .gi-mis.story')).toContainText('Acto II · 1/8');
  expect(errors).toEqual([]);
});

test('la Reina del Enjambre: inmune con 3 drones, cae sin ellos y cierra el Acto II', async ({ page }) => {
  const errors = trackErrors(page);
  const sys = chapters(GAL2)[QUEEN].goal.sys;
  await startGalaxy(page, { galaxy: { started: true, credits: 5000, up: { missile: 2, jump: 5 }, sys }, story: { ch: QUEEN, n: 0, seen: { [QUEEN]: true } } });
  for (let i = 0; i < 90; i++) await page.evaluate(() => window.D.step(1 / 30, false));
  const st = await page.evaluate(() => {
    const s = window.G.space, q = s.pirates.find((p) => p.alive && p.story === 'queen');
    return { queen: !!q, kids: s.pirates.filter((p) => p.alive && p.queenKid).length, shield: q?.shield };
  });
  expect(st.queen).toBe(true);
  expect(st.kids).toBeGreaterThanOrEqual(3);
  expect(st.shield).toBe(true);
  // con el escudo, ni un golpe enorme la mata
  const immune = await page.evaluate(() => {
    const s = window.G.space, q = s.pirates.find((p) => p.alive && p.story === 'queen');
    s.bolts.push({ pos: { ...q.pos }, vel: { x: 0, y: 0, z: 0 }, life: 0.5, dmg: 99999 });
    window.D.step(1 / 30, false);
    return q.alive && q.hp > 0;
  });
  expect(immune).toBe(true);
  // sin drones: cae, el Acto II se acaba y da su logro
  const done = await page.evaluate(() => {
    const s = window.G.space;
    s.pirates = s.pirates.filter((p) => !p.queenKid);
    const q = s.pirates.find((p) => p.story === 'queen');
    q.broodT = 99;
    window.D.step(1 / 30, false);
    s.bolts.push({ pos: { ...q.pos }, vel: { x: 0, y: 0, z: 0 }, life: 0.5, dmg: 99999 });
    window.D.step(1 / 30, false);
    return { alive: q.alive, ch: window.__save.story.ch, ach: !!window.__save.ach.act2?.done };
  });
  expect(done.alive).toBe(false);
  expect(done.ch).toBe(QUEEN + 1);
  expect(done.ach).toBe(true);
  expect(errors).toEqual([]);
});
