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

// ---------- Viajes con vida ----------
test('supercrucero: motor a tope y sin enemigos acelera hasta ×4; un contacto lo corta', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  const res = await page.evaluate(() => {
    const s = window.G.space, sh = s.ship;
    window.G.god = true;
    s.routeTo = null;
    sh.throttle = 1;
    // volando por espacio abierto (se le devuelve al mismo sitio para no llegar a nada)
    for (let i = 0; i < 80; i++) { sh.pos = { x: 0, y: 500, z: 0 }; window.D.step(0.1, false); }
    const k = s.cruiseK, v = sh.speed;
    window.__contact('distress');
    window.D.step(1 / 60, false);
    return { k, v, after: s.cruiseK, base: window.__spaceStats().speed, contact: s.contact?.kind };
  });
  expect(res.k).toBeGreaterThan(3.5);
  expect(res.v).toBeGreaterThan(res.base * 3);
  expect(res.after).toBeLessThan(1.1);
  expect(res.contact).toBe('distress');
  await expect(page.locator('#shObjective')).toContainText('auxilio');
  expect(errors).toEqual([]);
});

test('contactos: rescate, anillos y contenedor pagan; el contrabandista paga al derribarlo', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  const res = await page.evaluate(() => {
    const s = window.G.space, g = window.__save.galaxy;
    window.G.god = true;
    const out = {};
    // auxilio (sin trampa)
    window.__contact('distress');
    s.contact.trap = false;
    let c0 = g.credits;
    s.ship.pos = { ...s.contact.pos };
    window.D.step(1 / 30, false);
    out.distress = g.credits - c0;
    // anillos: cruzarlos todos
    window.__contact('rings');
    c0 = g.credits;
    for (let i = 0; i < 5 && s.contact; i++) { s.ship.pos = { ...s.contact.rings[s.contact.next] }; window.D.step(1 / 30, false); }
    out.rings = g.credits - c0;
    // contenedor
    window.__contact('container');
    c0 = g.credits;
    s.ship.pos = { ...s.contact.pos };
    window.D.step(1 / 30, false);
    out.container = g.credits - c0;
    // contrabandista
    window.__contact('smuggler');
    const p = s.contact.ref;
    out.flees = p.state === 'flee';
    p.hp = 1;
    s.bolts.push({ pos: { ...p.pos }, vel: { x: 0, y: 0, z: 0 }, life: 0.2, dmg: 50 });
    window.D.step(1 / 60, false);
    out.smugglerLoot = s.loot.some((l) => l.credits >= 300);
    out.left = s.contact;
    return out;
  });
  expect(res.distress).toBeGreaterThan(0);
  expect(res.rings).toBeGreaterThan(0);
  expect(res.container).toBeGreaterThan(0);
  expect(res.flees).toBe(true);
  expect(res.smugglerLoot).toBe(true);
  expect(res.left).toBe(null);
  expect(errors).toEqual([]);
});

test('interdicción: forcejear tocando disparo te suelta; si no, llegas con cazadores', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  const res = await page.evaluate(() => {
    const s = window.G.space;
    window.G.god = true;
    const jump = () => { s.jumpT = 1.1; s.jumpTo = s.sys.gates[0].to; s.interdict = { t: 3.2, taps: 0 }; s.firingWas = true; };
    // 1) forcejear
    jump();
    for (let i = 0; i < 12; i++) { s.botFire = true; window.D.step(1 / 60, false); s.botFire = false; window.D.step(1 / 60, false); }
    const escaped = s.interdict === null && !s.interdictFail;
    window.D.step(1.5, false);
    const n1 = s.pirates.filter((p) => p.hunter).length;
    // 2) no hacer nada
    jump();
    s.jumpTo = s.sys.gates.find((gt) => gt.to !== 0)?.to ?? s.jumpTo;
    window.D.step(3.4, false);
    window.D.step(1.3, false);
    return { escaped, n1, hunters: s.pirates.filter((p) => p.hunter).length, mode: window.G.mode };
  });
  expect(res.escaped).toBe(true);
  expect(res.n1).toBe(0);
  expect(res.hunters).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

// ---------- Economía sin grind y retos ----------
test('incursión del día: oleadas en un sector sellado, puntos con la racha, medalla con gemas', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page);
  await page.evaluate(() => { const s = window.G.space; s.ship.pos = { ...s.sys.station.pos }; window.D.step(1 / 30); });
  await page.locator('#btnDock').click();
  await expect(page.locator('#btnIncursion')).toBeVisible();
  await page.locator('#btnIncursion').click();
  const res = await page.evaluate(() => {
    const s = window.G.space;
    window.G.god = true;
    const gems0 = window.__save.gems;
    // limpiar oleadas a lo bruto: cada pirata de la incursión cae al instante
    for (let i = 0; i < 400 && s.incursion && s.incursion.wave < 4; i++) {
      for (const p of s.pirates) if (p.alive && p.inc) { p.hp = 1; s.bolts.push({ pos: { ...p.pos }, vel: { x: 0, y: 0, z: 0 }, life: 0.1, dmg: 99 }); }
      window.D.step(0.25, false);
    }
    const mid = { wave: s.incursion?.wave, score: s.incursion?.score, mode: window.G.mode };
    // y ahora, caer
    window.G.god = false;
    s.ship.shield = 0; s.ship.hull = 1;
    s.ebolts.push({ pos: { ...s.ship.pos }, vel: { x: 0, y: 0, z: 0 }, life: 1, dmg: 99 });
    window.D.step(1 / 60, false);
    return { ...mid, over: s.incursion === null, rec: window.__save.galaxy.incursion, gems: window.__save.gems - gems0, credits: window.__save.galaxy.credits };
  });
  expect(res.mode).toBe('galaxy');
  expect(res.wave).toBeGreaterThanOrEqual(4);
  expect(res.score).toBeGreaterThan(0);
  expect(res.over).toBe(true);
  expect(res.rec.waves).toBeGreaterThanOrEqual(3);
  expect(res.credits).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('contratos: un ★★ «sin daño en el casco» se pierde si te dan', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { v: 3, runs: 5, tips: { galaxy: true, galCombat: true }, galaxy: { missions: [{ id: 'c1', kind: 'hunt', sys: 4, n: 3, progress: 0, text: '★★ Elimina 3 piratas · 🛡️ sin daño en el casco', reward: 900, tier: 2, mods: ['clean'], jumps: 4, deadline: 4 }] } });
  const res = await page.evaluate(() => {
    const s = window.G.space;
    s.ship.shield = 0;
    s.ebolts.push({ pos: { ...s.ship.pos }, vel: { x: 0, y: 0, z: 0 }, life: 1, dmg: 5 });
    window.D.step(1 / 60, false);
    return window.__save.galaxy.missions.length;
  });
  expect(res).toBe(0);
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

test('piloto: también en ORIGEN la carga queda en tu pecio', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { v: 3, runs: 5, tips: { galaxy: true, galCombat: true, galRisk: true }, galaxy: { credits: 100, cargo: { iron: 6 } } });
  const res = await page.evaluate(() => {
    const s = window.G.space, g = window.__save.galaxy;
    s.ship.pos = { x: 1500, y: 0, z: 1500 };
    s.ship.shield = 0;
    s.ship.hull = 1;
    s.ebolts.push({ pos: { ...s.ship.pos }, vel: { x: 0, y: 0, z: 0 }, life: 1, dmg: 50 });
    window.D.step(1 / 60, false);
    return { sys: s.sysId, wreck: g.wreck && g.wreck.cargo.iron, inSys: !!s.wreck };
  });
  expect(res.sys).toBe(0);
  expect(res.wreck).toBe(6);
  expect(res.inSys).toBe(true);
  expect(errors).toEqual([]);
});

test('incursión: sus bajas no cuentan para los contratos ni la búsqueda del sistema', async ({ page }) => {
  const errors = trackErrors(page);
  await startGalaxy(page, { v: 3, runs: 5, tips: { galaxy: true, galCombat: true }, galaxy: { missions: [{ id: 'h1', kind: 'hunt', sys: 0, n: 2, progress: 0, text: '★ Elimina 2 piratas en ORIGEN', reward: 300, tier: 1, mods: [], jumps: 2, deadline: 9 }] } });
  await page.evaluate(() => { const s = window.G.space; s.ship.pos = { ...s.sys.station.pos }; window.D.step(1 / 30); });
  await page.locator('#btnDock').click();
  await page.locator('#btnIncursion').click();
  const res = await page.evaluate(() => {
    const s = window.G.space, g = window.__save.galaxy;
    window.G.god = true;
    window.D.step(2.2, false);
    for (const p of s.pirates) if (p.alive && p.inc) { p.hp = 1; s.bolts.push({ pos: { ...p.pos }, vel: { x: 0, y: 0, z: 0 }, life: 0.1, dmg: 99 }); }
    window.D.step(0.1, false);
    return { progress: g.missions[0]?.progress, wanted: g.wanted || 0, score: s.incursion?.score };
  });
  expect(res.score).toBeGreaterThan(0);
  expect(res.progress).toBe(0);
  expect(res.wanted).toBe(0);
  expect(errors).toEqual([]);
});
