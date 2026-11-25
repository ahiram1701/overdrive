// GALAXIA · variedad en el juego: fragata con escudo frontal, portanaves, riel que atraviesa, chips y rescate
import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

const SAVE = 'overdrive-save-v1';
async function startGalaxy(page, extra = {}) {
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
  await page.locator('#btnGalaxy').click();
  await page.locator('#btnGalGo').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  await page.evaluate(() => { const sh = window.G.space.ship; sh.pos = { x: 1500, y: 0, z: 1500 }; sh.throttle = 0; window.D.step(1 / 30, false); });
}

test('fragata: de frente casi no le haces nada; el iónico atraviesa su escudo', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  const r = await page.evaluate(() => {
    const s = window.G.space;
    window.__pirate('frigate', null, 300);
    const p = s.pirates.at(-1);
    // mirando hacia la nave
    const d = { x: s.ship.pos.x - p.pos.x, y: s.ship.pos.y - p.pos.y, z: s.ship.pos.z - p.pos.z };
    p.yaw = Math.atan2(d.x, d.z); p.pitch = 0;
    Object.assign(p, { hp: 1000, max: 1000, eShield: 0 });
    return { kind: p.kind };
  });
  expect(r.kind).toBe('frigate');
  const dmg = await page.evaluate(async () => {
    const s = window.G.space, p = s.pirates.at(-1);
    const hit = (opt) => { const h0 = p.hp; s.bolts.push({ pos: { ...p.pos }, vel: { x: 0, y: 0, z: 0 }, life: 0.5, dmg: 100, ...opt }); window.D.step(1 / 60, false); return h0 - p.hp; };
    return { front: hit({}), ion: hit({ ion: true }) };
  });
  expect(dmg.front).toBeLessThan(40);
  expect(dmg.ion).toBeGreaterThanOrEqual(95);
  expect(errors).toEqual([]);
});

test('portanaves: lanza drones; el riel atraviesa a varios', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  const n = await page.evaluate(() => {
    const s = window.G.space;
    window.G.god = true;
    window.__pirate('carrier', null, 500);
    const c = s.pirates.at(-1);
    Object.assign(c, { state: 'attack', aware: true, launchT: 0 });
    window.D.step(1 / 30, false);
    return s.pirates.filter((q) => q.alive && q.mother === c).length;
  });
  expect(n).toBeGreaterThanOrEqual(2);
  expect(n).toBeLessThanOrEqual(5);
  const pierced = await page.evaluate(() => {
    const s = window.G.space;
    const a = s.pirates.filter((q) => q.alive).slice(0, 2);
    a[1].pos = { ...a[0].pos, z: a[0].pos.z + 3 };
    for (const q of a) Object.assign(q, { hp: 999, max: 999, eShield: 0, kind: q.kind === 'frigate' ? 'fighter' : q.kind });
    s.bolts.push({ pos: { ...a[0].pos }, vel: { x: 0, y: 0, z: 1 }, life: 0.5, dmg: 50, pierce: true });
    window.D.step(1 / 60, false);
    return a.filter((q) => q.hp < 999).length;
  });
  expect(pierced).toBe(2);
  expect(errors).toEqual([]);
});

test('chips: un jefe suelta uno, se monta en la estación y sube el daño', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  const before = await page.evaluate(() => window.__spaceStats().dmg);
  await page.evaluate(() => {
    const { addChip } = window;
    window.__save.galaxyChips = { bag: [{ id: 'tst', tier: 2, affixes: [{ k: 'dmg', v: 20 }, { k: 'cargo', v: 5 }] }], on: [] };
    const s = window.G.space;
    s.ship.pos = { ...s.sys.station.pos };
    window.D.step(1 / 30);
    return addChip;
  });
  await page.locator('#btnDock').click();
  await page.locator('.st-jump [data-go="stSecShip"]').click();
  await page.locator('[data-chip="tst"]').click();
  await expect(page.locator('[data-chip="tst"]')).toHaveText('QUITAR');
  const after = await page.evaluate(() => window.__spaceStats().dmg);
  expect(after).toBeGreaterThan(before * 1.15);
  expect(errors).toEqual([]);
});

test('contrato de rescate: aparecen las cápsulas, se recogen y se cobra', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { galaxy: { started: true, missions: [{ id: 'resc', kind: 'rescue', sys: 0, n: 3, progress: 0, reward: 500, text: 'Rescata 3 cápsulas', from: 0 }] } });
  const r = await page.evaluate(() => {
    const s = window.G.space;
    window.D.step(1 / 30, false);
    const caps = s.capsules?.length || 0;
    const c0 = window.__save.galaxy.credits;
    for (const c of s.capsules) { s.ship.pos = { ...c.pos }; window.D.step(1 / 30, false); }
    return { caps, gain: window.__save.galaxy.credits - c0, left: window.__save.galaxy.missions.length };
  });
  expect(r.caps).toBe(3);
  expect(r.gain).toBeGreaterThanOrEqual(500);
  expect(r.left).toBe(0);
  expect(errors).toEqual([]);
});
