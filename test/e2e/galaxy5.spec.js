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

// ---------- Riesgo real (dificultad Piloto) ----------
test('piloto: morir cuesta el remolque y medio casco; la carga queda en tu pecio y se recupera', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { v: 3, runs: 5, tips: { galaxy: true, galCombat: true, galRisk: true }, galaxy: { credits: 1000, cargo: { iron: 12 }, sys: 1, home: 1, visited: [0, 1] } });
  const res = await page.evaluate(() => {
    const s = window.G.space, g = window.__save.galaxy;
    window.G.god = false;
    const deathAt = { x: 1500, y: 0, z: 1500 };
    s.ship.pos = { ...deathAt };
    s.ship.shield = 0;
    s.ship.hull = 1;
    s.ebolts.push({ pos: { ...s.ship.pos }, vel: { x: 0, y: 0, z: 0 }, life: 1, dmg: 50 });
    window.D.step(1 / 60, false);
    const after = { credits: g.credits, hull: s.ship.hull, max: window.__spaceStats().hull, cargo: g.cargo.iron, wreck: !!g.wreck, inSys: !!s.wreck };
    // volver a por la carga
    s.ship.pos = { ...g.wreck.pos };
    window.D.step(1 / 30, false);
    return { ...after, recovered: g.cargo.iron, gone: g.wreck === null };
  });
  expect(res.credits).toBeLessThan(1000);
  expect(res.hull).toBeLessThan(res.max);
  expect(res.cargo).toBe(0);
  expect(res.wreck).toBe(true);
  expect(res.inSys).toBe(true);
  expect(res.recovered).toBe(12);
  expect(res.gone).toBe(true);
  expect(errors).toEqual([]);
});

test('ajustes: la dificultad de la Galaxia se cambia en ciclo y se guarda', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?debug&nosw&seed=3');
  await page.waitForFunction(() => !!window.G);
  await page.locator('#btnSettings').click();
  const name = page.locator('#galDiffName');
  await expect(name).toHaveText('Piloto');
  await page.locator('#btnGalDiff').click();
  await expect(name).toHaveText('Veterano');
  await page.locator('#btnGalDiff').click();
  await expect(name).toHaveText('Relajado');
  expect(await page.evaluate(() => window.__save.galaxy.difficulty)).toBe('relaxed');
  expect(errors).toEqual([]);
});
