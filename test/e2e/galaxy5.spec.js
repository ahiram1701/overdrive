// GALAXIA rediseñada: enemigos con táctica (alerta y radio, alto el fuego, inhibidor, acechador, escuadrillas)
import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

const SAVE = 'overdrive-save-v1';
async function startGalaxy(page, seedSave = { v: 3, runs: 5, tips: { galaxy: true, galCombat: true } }) {
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
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  await page.evaluate(() => { const sh = window.G.space.ship; sh.pos = { x: 1500, y: 0, z: 1500 }; sh.throttle = 0; window.D.step(1 / 30, false); });
}
// un pirata del sistema (patrullando, sin verte) a cierta distancia
const patroller = (page, d) => page.evaluate((dd) => {
  const s = window.G.space;
  window.__pirate('fighter', null, dd);
  const p = s.pirates.at(-1);
  Object.assign(p, { aware: false, state: 'patrol', home: { ...p.pos }, caller: false });
  return s.pirates.length;
}, d);

test('alerta: patrullan sin verte; de cerca te ven, uno pide refuerzos y llegan si no lo abates', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  await patroller(page, 1400);
  const far = await page.evaluate(() => { window.D.step(1, false); const p = window.G.space.pirates.at(-1); return { aware: p.aware, state: p.state }; });
  expect(far.aware).toBe(false);
  expect(far.state).toBe('patrol');
  const res = await page.evaluate(() => {
    const s = window.G.space, p = s.pirates.at(-1);
    window.G.god = true;
    p.pos = { x: s.ship.pos.x, y: s.ship.pos.y, z: s.ship.pos.z + 500 };
    window.D.step(0.2, false);
    const called = !!s.call && p.caller;
    const n0 = s.pirates.length;
    window.D.step(21, false);
    return { aware: p.aware, called, more: s.pirates.length - n0, done: s.callDone };
  });
  expect(res.aware).toBe(true);
  expect(res.called).toBe(true);
  expect(res.more).toBeGreaterThanOrEqual(2);
  expect(res.done).toBe(true);
  expect(errors).toEqual([]);
});

test('alerta: abatir al que avisa corta la radio', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  await patroller(page, 400);
  const res = await page.evaluate(() => {
    const s = window.G.space;
    window.G.god = true;
    window.D.step(0.2, false);
    const p = s.pirates.find((q) => q.caller);
    p.hp = 1;
    p.speed = 0;
    const n0 = s.pirates.filter((q) => q.alive).length;
    s.bolts.push({ pos: { ...p.pos }, vel: { x: 0, y: 0, z: 0 }, life: 0.2, dmg: 50 });
    window.D.step(0.1, false);
    window.D.step(22, false);
    return { call: s.call, done: s.callDone, alive: s.pirates.filter((q) => q.alive).length, n0 };
  });
  expect(res.call).toBe(null);
  expect(res.done).toBe(true);
  expect(res.alive).toBeLessThan(res.n0);
  expect(errors).toEqual([]);
});

test('zona segura: alto el fuego (tus disparos no dañan a los piratas desde allí)', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  const res = await page.evaluate(() => {
    const s = window.G.space, st = s.sys.station.pos;
    s.ship.pos = { ...st };
    window.__pirate('fighter', null, 200);
    const p = s.pirates.at(-1);
    p.speed = 0;
    p.pos = { x: st.x, y: st.y, z: st.z + 200 };
    const hp = p.hp;
    const from = { x: st.x, y: st.y, z: st.z + 150 };
    s.bolts.push({ pos: from, vel: { x: 0, y: 0, z: 950 }, life: 0.5, dmg: 30, safe: true });
    window.D.step(0.1, false);
    return { hp0: hp, hp: p.hp };
  });
  expect(res.hp).toBe(res.hp0);
  expect(errors).toEqual([]);
});

test('inhibidor: cerca de él no hay impulso; derribado, vuelve', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  const res = await page.evaluate(() => {
    const s = window.G.space;
    window.G.god = true;
    window.__pirate('inhibitor', null, 200);
    const p = s.pirates.at(-1);
    p.speed = 0;
    window.D.step(0.05, false);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
    const blocked = s.inhibited && s.ship.boostT === 0;
    p.alive = false;
    window.D.step(0.05, false);
    return { blocked, after: s.inhibited };
  });
  expect(res.blocked).toBe(true);
  expect(res.after).toBe(false);
  expect(errors).toEqual([]);
});

test('escuadrillas y enjambres: alas que siguen al líder; si cae, se dispersan', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  const res = await page.evaluate(() => {
    const s = window.G.space;
    window.G.god = true;
    window.__pirate('fighter', null, 900);
    const L = s.pirates.at(-1);
    window.__pirate('fighter', null, 900);
    const W = s.pirates.at(-1);
    Object.assign(W, { leader: L, wing: 0 });
    L.hp = 1;
    s.bolts.push({ pos: { ...L.pos }, vel: { x: 0, y: 0, z: 0 }, life: 0.2, dmg: 50 });
    window.D.step(0.05, false);
    return { leaderDead: !L.alive, wingFree: W.leader === null, state: W.state };
  });
  expect(res.leaderDead).toBe(true);
  expect(res.wingFree).toBe(true);
  expect(['flee', 'evade']).toContain(res.state);
  expect(errors).toEqual([]);
});

test('zona segura: tampoco dañan el equipo fabricado, la torreta ni los misiles', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { v: 3, runs: 5, tips: { galaxy: true, galCombat: true }, galaxy: { up: { missile: 1 }, missiles: 4 }, galaxyGear: { owned: { laser2: true, flak: true, turret: true }, w: ['laser2', 'flak'], m: ['turret'] } });
  const res = await page.evaluate(() => {
    const s = window.G.space, st = s.sys.station.pos, sh = s.ship;
    sh.pos = { ...st };
    sh.throttle = 0;
    window.__pirate('fighter', null, 120);
    const p = s.pirates.at(-1);
    Object.assign(p, { speed: 0, pos: { x: sh.pos.x + sh.f.x * 120, y: sh.pos.y + sh.f.y * 120, z: sh.pos.z + sh.f.z * 120 } });
    const hp = p.hp;
    s.botFire = true;
    for (let i = 0; i < 60; i++) { sh.pos = { ...st }; window.D.step(1 / 30, false); }
    s.botFire = false;
    const ammo = window.__save.galaxy.missiles;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'm' }));
    return { hp0: hp, hp: p.hp, ammo0: ammo, ammo: window.__save.galaxy.missiles };
  });
  expect(res.hp).toBe(res.hp0);
  expect(res.ammo).toBe(res.ammo0);
  expect(errors).toEqual([]);
});
