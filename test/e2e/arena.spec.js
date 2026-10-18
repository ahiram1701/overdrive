import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

const SAVE = 'overdrive-save-v1';

// Bot de arena: huye de lo que tiene cerca (repulsión), esquiva balas, va a por gemas si está
// tranquilo y elige siempre la primera mejora.
function arenaBot({ seconds }) {
  const G = window.G, D = window.D;
  let t = 0, ups = 0;
  while (t < seconds) {
    if (G.mode === 'arenaUp') { document.querySelector('#auOptions .au-opt').click(); ups++; continue; }
    if (G.mode !== 'arena') break;
    const a = G.arena;
    let fx = 0, fy = 0;
    for (const e of a.enemies) {
      const dx = a.x - e.x, dy = a.y - e.y, d2 = dx * dx + dy * dy;
      if (d2 > 260 * 260) continue;
      const k = (e.boss ? 4 : e.elite ? 2 : 1) / Math.max(400, d2);
      fx += dx * k; fy += dy * k;
    }
    for (const b of a.ebullets) {
      const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
      if (d2 < 140 * 140) { fx += (dx * 3) / Math.max(200, d2); fy += (dy * 3) / Math.max(200, d2); }
    }
    // embestidor apuntando o cargando: salir de su línea de lado, como un jugador que ve el aviso
    for (const e of a.enemies) {
      if (e.id !== 'dasher' || (e.state !== 'aim' && e.state !== 'dash')) continue;
      const px = a.x - e.x, py = a.y - e.y, along = px * e.dx + py * e.dy, side = px * e.dy - py * e.dx;
      if (along > 0 && along < 330 && Math.abs(side) < 45) { const s = side >= 0 ? 1 : -1; fx += e.dy * s * 0.05; fy += -e.dx * s * 0.05; }
    }
    // como un jugador: huye, pero sin dejar de ir a por las gemas cercanas
    let g = null, gd = 1e9;
    for (const it of [...a.gems, ...a.chests]) { const d = Math.hypot(it.x - a.x, it.y - a.y); if (d < gd) { gd = d; g = it; } }
    const fl = Math.hypot(fx, fy);
    if (g && gd < 400) {
      const w = fl < 0.004 ? 1 : 0.35 * fl;
      fx += ((g.x - a.x) / gd) * w; fy += ((g.y - a.y) / gd) * w;
    }
    const l = Math.hypot(fx, fy);
    a.botInput = l > 1e-6 ? { x: fx / l, y: fy / l } : { x: 0, y: 0 };
    D.step(1 / 30, false);
    t += 1 / 30;
  }
  const a = G.arena;
  return { mode: G.mode, time: a.time, hp: a.hp, level: a.level, kills: a.kills, ups, weapons: a.weapons };
}

async function startArena(page, ship = 'viper', seed = 11, map = 'grid', arena = {}) {
  await page.addInitScript(([k, s, ar]) => localStorage.setItem(k, JSON.stringify({ v: 3, runs: 5, ship: s, ships: [s], arena: ar })), [SAVE, ship, arena]);
  await page.goto(`/?debug&nosw&seed=${seed}`);
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; });
  await page.locator('#btnArena').click();
  await page.locator(`#arenaMaps [data-map="${map}"]`).click();
  await page.waitForFunction(() => window.G.mode === 'arena');
}

test('arena: el bot sobrevive 90 s, sube de nivel a menudo y elige mejoras', async ({ page }) => {
  const errors = trackErrors(page);
  await startArena(page);
  await expect(page.locator('#arenaHud')).toBeVisible();
  const res = await page.evaluate(arenaBot, { seconds: 90 });
  console.log(`ARENA bot 90s: nivel ${res.level}, bajas ${res.kills}, vida ${Math.round(res.hp)}`);
  expect(res.mode).toBe('arena');
  expect(res.level).toBeGreaterThanOrEqual(6);
  expect(res.kills).toBeGreaterThan(100);
  expect(res.ups).toBe(res.level - 1);
  expect(errors).toEqual([]);
});

test('arena: morir lleva a la pantalla final con gemas y XP, y se guarda el récord', async ({ page }) => {
  const errors = trackErrors(page);
  await startArena(page, 'brick');
  await page.evaluate(() => {
    const G = window.G;
    const pick = () => { if (G.mode === 'arenaUp') document.querySelector('#auOptions .au-opt').click(); };
    for (let i = 0; i < 300; i++) { pick(); window.D.step(1 / 30, false); }
    G.arena.hp = 1;
    G.arena.iframes = 0;
    for (let i = 0; i < 900 && (G.mode === 'arena' || G.mode === 'arenaUp'); i++) { pick(); window.D.step(1 / 30, false); }
    for (let i = 0; i < 60; i++) window.D.step(1 / 30, false);
  });
  await expect(page.locator('#arenaEnd')).toBeVisible();
  await expect(page.locator('#aeGems')).toContainText('💎');
  const s = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE);
  expect(s.arena.best).toBeGreaterThan(5);
  expect(s.xp).toBeGreaterThan(0);
  await page.locator('#btnArenaRetry').click();
  await page.waitForFunction(() => window.G.mode === 'arena');
  expect(errors).toEqual([]);
});

test('arena: cada nave arranca con su arma y su habilidad funciona', async ({ page }) => {
  const errors = trackErrors(page);
  await startArena(page, 'nova');
  const res = await page.evaluate(() => {
    const a = window.G.arena;
    for (let i = 0; i < 90; i++) {
      if (window.G.mode === 'arenaUp') document.querySelector('#auOptions .au-opt').click();
      window.D.step(1 / 30, false);
    }
    const before = a.ability.cdLeft;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
    return { first: Object.keys(a.weapons)[0], before, after: a.ability.cdLeft };
  });
  expect(res.first).toBe('pulse');
  expect(res.before).toBe(0);
  expect(res.after).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('arena: rendimiento con 300 enemigos', async ({ page }) => {
  await startArena(page, 'comet');
  const ms = await page.evaluate(() => {
    const a = window.G.arena;
    for (let i = 0; i < 300; i++) {
      const ang = (i / 300) * Math.PI * 2, R = 120 + (i % 7) * 40;
      a.enemies.push({ id: 'chaser', def: { color: '#ff2bd6', shape: 'tri' }, x: Math.cos(ang) * R, y: Math.sin(ang) * R, hp: 1e6, max: 1e6, r: 13, speed: 70, dmg: 0, xp: 1, alive: true, flash: 0, state: 'go', st: 0, cd: 9, phase: 0, vx: 0, vy: 0, orbT: 0 });
    }
    a.weapons = { orbs: 5, pulse: 5, flame: 5, blaster: 5 };
    window.G.god = true;
    const t0 = performance.now();
    for (let i = 0; i < 120; i++) window.D.step(1 / 120, false);
    return (performance.now() - t0) / 120;
  });
  console.log(`ARENA paso medio con 300 enemigos: ${ms.toFixed(2)} ms`);
  expect(ms).toBeLessThan(8);
});

test('mapas: se abren por logros; en el Cinturón las rocas paran la nave y las balas', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ v: 3, runs: 5, arena: { best: 320, kills: 0, wins: 0 } })), SAVE);
  await page.goto('/?debug&nosw&seed=11');
  await page.waitForFunction(() => !!window.G);
  await page.locator('#btnArena').click();
  await expect(page.locator('#arenaMaps [data-map="belt"]')).not.toBeDisabled();
  await expect(page.locator('#arenaMaps [data-map="forge"]')).toBeDisabled();
  await expect(page.locator('#arenaMaps [data-map="void"]')).toContainText('Gana la Arena');
  await page.evaluate(() => { window.G.manual = true; });
  await page.locator('#arenaMaps [data-map="belt"]').click();
  await page.waitForFunction(() => window.G.mode === 'arena');
  const r = await page.evaluate(() => {
    const a = window.G.arena, k = a.feat.rocks[0];
    // ponte junto a la roca y empuja contra ella
    a.x = k.x + k.r + 40; a.y = k.y; a.enemies = [];
    a.input = { x: -1, y: 0 };
    for (let i = 0; i < 60; i++) window.D.step(1 / 60, false);
    const inside = Math.hypot(a.x - k.x, a.y - k.y) < k.r;
    // una bala tuya contra la roca desaparece
    a.bullets = [{ x: k.x + k.r + 4, y: k.y, vx: -400, vy: 0, r: 4, dmg: 1, life: 2, pierce: 1, probe: true }];
    window.D.step(1 / 30, false);
    window.D.step(1 / 30, false);
    const probe = a.bullets.some((b) => b.probe);
    // y nadie sale del círculo
    a.input = { x: 0, y: 0 };
    a.x = 5000; a.y = 0;
    window.D.step(1 / 60, false);
    return { inside, probe, x: a.x, R: a.M.radius, map: window.__save.arena.map };
  });
  expect(r.inside).toBe(false);
  expect(r.probe).toBe(false);
  expect(r.x).toBeLessThanOrEqual(r.R);
  expect(r.map).toBe('belt');
  expect(errors).toEqual([]);
});

test('Forja: la lava quema', async ({ page }) => {
  const errors = trackErrors(page);
  await startArena(page, 'viper', 11, 'forge', { best: 600, kills: 0, wins: 1, bossBest: 2 });
  const lava = await page.evaluate(() => {
    const a = window.G.arena, p = a.feat.pools[0];
    a.enemies = []; a.x = p.x; a.y = p.y; a.input = { x: 0, y: 0 };
    const hp0 = a.hp;
    window.D.step(1 / 30, false);
    return hp0 - a.hp;
  });
  expect(lava).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('Vacío: los agujeros negros te atraen', async ({ page }) => {
  const errors = trackErrors(page);
  await startArena(page, 'viper', 11, 'void', { best: 600, kills: 0, wins: 1, bossBest: 2 });
  const hole = await page.evaluate(async () => {
    const { holePos } = await import('/js/arena.js');
    const a = window.G.arena, c = holePos(a, a.feat.holes[0]);
    a.enemies = [];
    window.G.god = true;
    a.x = c.x + 300; a.y = c.y; a.input = { x: 0, y: 0 };
    window.D.step(0.5, false);
    const c2 = holePos(a, a.feat.holes[0]);
    return Math.hypot(a.x - c2.x, a.y - c2.y);
  });
  expect(hole).toBeLessThan(300);
  expect(errors).toEqual([]);
});

test('jefes: cada uno con sus ataques y su fase 2; la Colmena es inmune con sus crías', async ({ page }) => {
  const errors = trackErrors(page);
  await startArena(page);
  for (const id of ['coloso', 'colmena', 'tejedora', 'nucleo', 'devorador']) {
    const r = await page.evaluate((bid) => {
      const a = window.G.arena;
      window.G.god = true;
      a.enemies = []; a.ebullets = []; a.ring = null;
      window.__arenaBoss(bid);
      const b = a.enemies.find((e) => e.boss);
      b.x = a.x + 200; b.y = a.y;
      for (let i = 0; i < 240; i++) window.D.step(1 / 60, false);
      const out = { bid: b.bid, shots: a.ebullets.length, lasers: !!b.lasersOn, charged: b.cds.charge !== undefined, kids: a.enemies.filter((e) => e.kid === b && e.alive).length, shield: !!b.shield };
      // con escudo, ni un golpe enorme le entra
      const hp0 = b.hp;
      if (b.shield) {
        a.bullets.push({ x: b.x, y: b.y, vx: 0, vy: 0, r: 30, dmg: 99999, life: 0.5, pierce: 1 });
        window.D.step(1 / 60, false);
        out.immune = b.alive && b.hp === hp0;
      }
      // a media vida, fase 2
      for (const e of a.enemies) if (e.kid === b) e.alive = false;
      b.shield = false;
      b.hp = b.max * 0.51;
      a.bullets.push({ x: b.x, y: b.y, vx: 0, vy: 0, r: 30, dmg: b.max * 0.03, life: 0.5, pierce: 1 });
      window.D.step(1 / 60, false);
      out.p2 = b.p2;
      b.alive = false;
      window.D.step(1 / 60, false);
      return out;
    }, id);
    expect(r.bid).toBe(id);
    expect(r.p2).toBe(true);
    if (id === 'tejedora') expect(r.lasers).toBe(true);
    else if (id === 'colmena') { expect(r.kids).toBeGreaterThanOrEqual(4); expect(r.shield).toBe(true); expect(r.immune).toBe(true); }
    else if (id === 'coloso') expect(r.charged).toBe(true);
    else expect(r.shots).toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
});

test('ganar ofrece SEGUIR: el sin fin trae un jefe más fuerte cada 3:00 y al caer cuenta como victoria', async ({ page }) => {
  const errors = trackErrors(page);
  await startArena(page);
  // vence al jefe final
  await page.evaluate(() => {
    const a = window.G.arena;
    window.G.god = true;
    a.enemies = []; a.time = 600; a.bossIdx = 1;
    window.D.step(1 / 30, false);
    const b = a.enemies.find((e) => e.boss);
    a.bullets.push({ x: b.x, y: b.y, vx: 0, vy: 0, r: 40, dmg: 1e9, life: 0.5, pierce: 1 });
    window.D.step(1 / 60, false);
  });
  await expect(page.locator('#arenaChoice')).toBeVisible();
  await page.locator('#btnEndless').click();
  const r = await page.evaluate(() => {
    const a = window.G.arena;
    a.enemies = [];
    a.time = 600 + 180;
    window.D.step(1 / 30, false);
    const b = a.enemies.find((e) => e.boss);
    return { mode: window.G.mode, endless: a.endless, boss: !!b, hp: b?.max };
  });
  expect(r).toMatchObject({ mode: 'arena', endless: true, boss: true });
  expect(r.hp).toBeGreaterThan(2400);
  await expect(page.locator('#ahGoal')).toContainText('♾️');
  // caer en el sin fin: victoria, con 🪙 en la pantalla final
  await page.evaluate(() => { const a = window.G.arena; window.G.god = false; a.iframes = 0; a.hp = 1; a.phoenix = 0; a.ebullets.push({ x: a.x, y: a.y, vx: 0, vy: 0, r: 20, dmg: 50, life: 1 }); for (let i = 0; i < 120; i++) window.D.step(1 / 30, false); });
  await expect(page.locator('#arenaEnd')).toBeVisible();
  await expect(page.locator('#aeTitle')).toContainText('SIN FIN');
  await expect(page.locator('#aeGems')).toContainText('🪙');
  expect(await page.evaluate(() => window.__save.arena.wins)).toBe(1);
  expect(errors).toEqual([]);
});

test('taller de la arena: se compra con 🪙 en la tienda y da cambios y vetos al subir de nivel', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript((k) => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', 1); localStorage.setItem(k, JSON.stringify({ v: 6, runs: 5, coins: 5000 })); }, SAVE);
  await page.goto('/?debug&nosw&seed=11');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { document.querySelector('[data-nav="store"]')?.click(); });
  await page.locator('#stTabs [data-tab="talents"]').click();
  await page.locator('[data-arena-up="reroll"]').dispatchEvent('click');
  await page.locator('[data-arena-up="banish"]').dispatchEvent('click');
  await page.locator('[data-arena-up="hp"]').dispatchEvent('click');
  const sv = await page.evaluate(() => ({ up: window.__save.arenaUp, coins: window.__save.coins }));
  expect(sv.up).toEqual({ reroll: 1, banish: 1, hp: 1 });
  expect(sv.coins).toBe(5000 - 800 - 900 - 400);
  await page.evaluate(() => { window.G.manual = true; });
  await page.locator('[data-nav="menu"]').click();
  await page.locator('#btnArena').click();
  await page.locator('#arenaMaps [data-map="grid"]').click();
  await page.waitForFunction(() => window.G.mode === 'arena');
  expect(await page.evaluate(() => window.G.arena.maxHpBase)).toBeGreaterThanOrEqual(110);
  await page.evaluate(() => { const a = window.G.arena; a.xp = 999; window.D.step(1 / 30, false); });
  await expect(page.locator('#arenaUp')).toBeVisible();
  const before = await page.evaluate(() => window.G.arena.offers.map((o) => `${o.kind}:${o.id}`).join());
  await page.locator('#btnAuReroll').click();
  expect(await page.evaluate(() => window.G.arena.rerolls)).toBe(0);
  await expect(page.locator('#btnAuReroll')).toBeHidden();
  void before;
  // vetar: la elegida no vuelve a salir
  await page.locator('#btnAuBanish').click();
  const idx = await page.evaluate(() => window.G.arena.offers.findIndex((o) => o.kind === 'weapon' || o.kind === 'passive'));
  const banned = await page.evaluate((i) => { const o = window.G.arena.offers[i]; return `${o.kind}:${o.id}`; }, idx);
  await page.locator(`#auOptions .au-opt[data-i="${idx}"]`).click();
  const after = await page.evaluate(() => ({ banned: window.G.arena.banned, offers: window.G.arena.offers.map((o) => `${o.kind}:${o.id}`), hp: window.G.arena.maxHpBase }));
  expect(after.banned[banned]).toBe(true);
  expect(after.offers).not.toContain(banned);
  expect(errors).toEqual([]);
});
