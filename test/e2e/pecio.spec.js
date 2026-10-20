import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

// PECIOS: el 4.º juego (acción en tiempo real y en 3D, con la cámara detrás de tu nave)
const SAVE = 'overdrive-save-v1';
async function startPecio(page, extra = {}) {
  await page.addInitScript(([k, x]) => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem(k, JSON.stringify({ v: 6, runs: 5, settings: { sound: false }, ...x })); }, [SAVE, extra]);
  await page.goto('/?debug&nosw&seed=7');
  await page.waitForFunction(() => !!window.G);
  await page.locator('#btnPecio').click();
  await expect(page.locator('#pecioHub')).toBeVisible();
  await page.locator('#btnPecioPlay').click();
  await page.waitForFunction(() => window.G.mode === 'pecio');
}

test('pecios: el teclado mueve la nave y el bot recorre salas y baja plantas', async ({ page }) => {
  const errors = trackErrors(page);
  await startPecio(page);
  await expect(page.locator('#pecioHud')).toBeVisible();
  await expect(page.locator('#pcFloor')).toHaveText('PLANTA 1');
  // flecha arriba mantenida = avanzar (hacia la fila 0)
  const p0 = await page.evaluate(() => ({ y: window.G.pecio.player.y, at: window.G.pecio.at }));
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowUp');
  // avanza hacia la fila 0 (con la máquina cargada puede llegar a cruzar la puerta de arriba: también vale)
  const p1 = await page.evaluate(() => ({ y: window.G.pecio.player.y, at: window.G.pecio.at }));
  expect(p1.at !== p0.at || p1.y < p0.y - 0.4).toBe(true);
  // el bot juega (con vida de sobra): llega a la planta 3
  const r = await page.evaluate(() => {
    window.G.pecio.player.hp = window.G.pecio.player.max = 60;
    let last = null;
    for (let i = 0; i < 900; i++) {
      last = window.__pecioBot(1);
      if (!last || last.over || last.depth >= 3) break;
    }
    return last;
  });
  expect(r.depth).toBeGreaterThanOrEqual(3);
  expect(errors).toEqual([]);
});

test('pecios: puertas cerradas con enemigos, esquive, habilidad y tienda', async ({ page }) => {
  const errors = trackErrors(page);
  await startPecio(page);
  const res = await page.evaluate(async () => {
    const { roomOf, locked, hitsWall, DOOR_TILE } = await import('/js/pecio.js');
    const s = window.G.pecio;
    const id = Object.keys(s.floor.rooms).find((k) => s.floor.rooms[k].type === 'combat');
    s.at = id;
    const room = roomOf(s);
    const [c, r] = DOOR_TILE[Object.keys(s.floor.rooms[id].doors)[0]];
    return { locked: locked(room), blocks: hitsWall(room, c + 0.5, r + 0.5, 0.3) };
  });
  expect(res.locked).toBe(true);
  expect(res.blocks).toBe(true);
  // 💨 y ⚡ desde sus botones
  await page.locator('#pcDash').click();
  expect(await page.evaluate(() => window.G.pecio.player.dashCd)).toBeGreaterThan(0);
  await page.locator('#pcAbility').click();
  expect(await page.evaluate(() => window.G.pecio.player.abCd)).toBeGreaterThan(0);
  // la tienda: con 🔩, una reparación (la partida se para mientras compras)
  await page.evaluate(async () => {
    const { ui } = await import('/js/ui.js');
    const s = window.G.pecio;
    s.depth = 2; s.player.piezas = 50; s.player.hp = 2;
    window.G.mode = 'pecioShop';
    ui.showPecioShop(s);
  });
  const t0 = await page.evaluate(() => window.G.pecio.time);
  await page.locator('[data-buy="repair"]').click();
  expect(await page.evaluate(() => window.G.pecio.player.hp)).toBe(5);
  expect(await page.evaluate(() => window.G.pecio.time)).toBe(t0);
  await page.locator('#btnPecioShopClose').click();
  expect(await page.evaluate(() => window.G.mode)).toBe('pecio');
  expect(errors).toEqual([]);
});

test('pecios: al caer, pantalla final y te llevas parte de las 🔩', async ({ page }) => {
  const errors = trackErrors(page);
  await startPecio(page);
  await page.evaluate(() => {
    const s = window.G.pecio;
    s.player.piezas = 40;
    s.player.hp = 1;
    s.player.inv = 0;
    const room = s.rooms[s.at];
    room.wake = 0;
    room.enemies = [{ id: 'x', kind: 'drone', x: s.player.x + 0.6, y: s.player.y, ang: 0, hp: 4, max: 4, r: 0.32, cd: 0, charge: 0, aim: null, fuse: null, stun: 0, hitT: 0, alive: true }];
  });
  await expect(page.locator('#pecioEnd')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#peTitle')).toHaveText('DESTRUIDO');
  expect(await page.evaluate(() => window.__save.pecio.piezas)).toBe(20);
  await page.locator('#btnPecioMenu').click();
  await expect(page.locator('#pecioHub')).toBeVisible();
  await expect(page.locator('#phPiezas')).toHaveText('20');
  expect(errors).toEqual([]);
});

test('pecios: rendimiento de un fotograma completo en 3D (simular + dibujar)', async ({ page }) => {
  await startPecio(page);
  // a una sala con enemigos, para medir lo más cargado
  await page.evaluate(() => {
    window.G.pecio.player.hp = window.G.pecio.player.max = 60;
    for (let i = 0; i < 300; i++) { window.__pecioBot(0.2); const s = window.G.pecio; if (s.rooms[s.at].enemies.some((e) => e.alive)) break; }
  });
  // lo mejor de varias tandas: el primer dibujo calienta cachés y el CI comparte máquina
  const ms = await page.evaluate(() => {
    let best = Infinity;
    for (let k = 0; k < 4; k++) {
      const t0 = performance.now();
      for (let i = 0; i < 30; i++) window.D.step(1 / 60, true);
      best = Math.min(best, (performance.now() - t0) / 30);
    }
    return best;
  });
  console.log(`PECIOS fotograma medio: ${ms.toFixed(2)} ms`);
  expect(ms).toBeLessThan(16);
});

for (const vp of [{ width: 360, height: 640 }, { width: 375, height: 812 }]) {
  test(`pecios: el cartel y los avisos no pisan la barra ni el minimapa, y no se pisan entre sí (${vp.width}×${vp.height})`, async ({ page }) => {
    await page.setViewportSize(vp);
    const errors = trackErrors(page);
    await startPecio(page);
    const r = await page.evaluate(async () => {
      const { textLayout } = await import('/js/pecioRender.js');
      const { fx } = await import('/js/fx.js');
      const { ui } = await import('/js/ui.js');
      const s = window.G.pecio;
      s.player.max = 12; s.player.hp = 9; s.player.shield = 2; // muchas vidas: la barra no debe crecer
      ui.updatePecioHUD();
      s.hudBottom = 0; // que vuelva a medir
      const L = textLayout(s, innerHeight);
      const bar = document.querySelector('#pecioHud .pc-top').getBoundingClientRect();
      fx.notice('✔ Sala limpia · +1 ❤️');
      fx.notice('🗝️ +1 llave');
      fx.notice('🗝️ +1 llave'); // repetido: no se duplica
      return { L, barBottom: bar.bottom, hearts: document.getElementById('pcHearts').textContent, notices: fx.noticeList, H: innerHeight };
    });
    expect(r.hearts).toContain('9/12');
    expect(r.L.bannerY - 30).toBeGreaterThanOrEqual(r.barBottom); // la mitad de arriba del cartel, bajo la barra
    expect(r.L.bannerY - 30).toBeGreaterThanOrEqual(64 + 90); // y bajo el minimapa
    expect(r.L.noticeY).toBeGreaterThan(r.L.bannerY + 40); // los avisos, bajo el subtítulo del cartel
    expect(r.L.noticeY + 2 * 30).toBeLessThan(r.H * 0.6); // los 3 avisos caben antes de la nave
    expect(r.notices).toEqual(['✔ Sala limpia · +1 ❤️', '🗝️ +1 llave']);
    expect(errors).toEqual([]);
  });
}

test('pecios: con la sala limpia, una puerta se cruza aunque llegues descentrado y sin aviso de "limpia la sala"', async ({ page }) => {
  const errors = trackErrors(page);
  await startPecio(page);
  const r = await page.evaluate(async () => {
    const { DOOR_TILE } = await import('/js/pecio.js');
    const { fx } = await import('/js/fx.js');
    const s = window.G.pecio;
    const from = s.at, dir = Object.keys(s.floor.rooms[from].doors)[0];
    const [c, r] = DOOR_TILE[dir];
    // a 3 casillas de la puerta, 0,35 fuera de su eje, mirando hacia ella
    const ang = { up: 0, down: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 }[dir];
    const back = { up: [0, 3], down: [0, -3], left: [3, 0], right: [-3, 0] }[dir];
    const side = dir === 'up' || dir === 'down' ? [0.35, 0] : [0, 0.35];
    Object.assign(s.player, { x: c + 0.5 + back[0] + side[0], y: r + 0.5 + back[1] + side[1], ang, vel: 0 });
    s.botInput = { x: 0, y: -1 }; // "joystick arriba" mantenido (el bucle usa botInput cuando no hay dedo ni teclas)
    for (let i = 0; i < 90 && s.at === from; i++) window.D.step(1 / 30, false);
    s.botInput = null;
    return { moved: s.at !== from, notices: fx.noticeList };
  });
  expect(r.moved).toBe(true);
  expect(r.notices.some((n) => n.includes('Limpia la sala'))).toBe(false);
  expect(errors).toEqual([]);
});

for (const vp of [{ width: 320, height: 568 }, { width: 360, height: 640 }]) {
  test(`pecios: el cartel grande nunca se sale por los lados, ni durante su animación (${vp.width}×${vp.height})`, async ({ page }) => {
    await page.setViewportSize(vp);
    await startPecio(page);
    const boxes = await page.evaluate(async () => {
      const { fx } = await import('/js/fx.js');
      window.G.pecio.introBanner = null;
      const out = [];
      for (const [t, sub] of [['🏚️ ESTACIÓN MÉDICA', 'planta 4'], ['🏆 ¡HAS SALIDO!', 'nueve plantas de pecio, superadas'], ['✨ BENDICIÓN', '+1 de daño del disparo']]) {
        fx.banner(t, sub, '#fff', true, 2);
        for (let i = 0; i < 12; i++) { window.D.step(1 / 60, true); out.push({ ...fx.lastBannerBox }); }
      }
      return out;
    });
    for (const b of boxes) {
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(b.W);
    }
  });
}

test('pecios P2: botín con su pantalla, mochila desde su botón y la bóveda entre partidas', async ({ page }) => {
  const errors = trackErrors(page);
  await startPecio(page, { pecio: { best: 2, runs: 1, piezas: 300, wins: 0, vault: null, vaultOpen: false } });
  // un objeto legendario en el suelo, justo delante: al tocarlo se abre la pantalla de comparar
  await page.evaluate(async () => {
    const { genItem } = await import('/js/pecioLoot.js');
    const { makeRng } = await import('/js/rng.js');
    const s = window.G.pecio;
    s.rooms[s.at].pickups.push({ id: 'x', kind: 'item', item: genItem(makeRng(5), 9, { slot: 'weapon', minTier: 3 }), x: s.player.x, y: s.player.y - 0.2 });
    s.player.bag.kit = 1;
    s.player.hp = 2;
  });
  await expect(page.locator('#pecioShop')).toBeVisible();
  await expect(page.locator('#psTitle')).toHaveText('🎁 BOTÍN');
  await expect(page.locator('#pecioHud')).toBeHidden(); // los botones de la partida no tapan los de la pantalla
  await page.locator('[data-offer="equip"]').click();
  await expect(page.locator('#pecioShop')).toBeHidden();
  expect(await page.evaluate(() => ({ w: window.G.pecio.player.gear.weapon?.tier, mode: window.G.mode }))).toEqual({ w: 3, mode: 'pecio' });
  await expect(page.locator('#pcGear .pg-it')).toHaveCount(1);
  // la mochila: su botón usa el kit
  await page.locator('[data-cons="kit"]').click();
  expect(await page.evaluate(() => window.G.pecio.player.hp)).toBe(5);
  // fin de la partida (sin bóveda abierta: solo el aviso)
  await page.evaluate(() => { const s = window.G.pecio; s.player.hp = 1; s.player.inv = 0; s.rooms[s.at].wake = 0; s.rooms[s.at].enemies = [{ id: 'k', kind: 'drone', x: s.player.x + 0.6, y: s.player.y, ang: 0, hp: 999, max: 999, r: 0.32, cd: 0, charge: 0, aim: null, fuse: null, stun: 0, hitT: 0, alive: true }]; s.player.shield = 0; });
  await expect(page.locator('#pecioEnd')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#peVault')).toContainText('Abre la bóveda');
  // abrir la bóveda en el menú de Pecios (150 🔩)
  await page.locator('#btnPecioMenu').click();
  await page.locator('#btnPecioVault').click();
  expect(await page.evaluate(() => window.__save.pecio.vaultOpen)).toBe(true);
  // otra partida: equipar y caer; ahora sí se guarda en la bóveda
  await page.locator('#btnPecioPlay').click();
  await page.waitForFunction(() => window.G.mode === 'pecio');
  await page.evaluate(async () => {
    const { genItem } = await import('/js/pecioLoot.js');
    const { makeRng } = await import('/js/rng.js');
    const { pecioTakeOffer } = await import('/js/pecioGame.js');
    const s = window.G.pecio;
    s.offer = { item: genItem(makeRng(9), 9, { slot: 'plating', minTier: 2 }), pk: null };
    pecioTakeOffer('equip');
    s.player.hp = 1; s.player.inv = 0; s.rooms[s.at].wake = 0;
    s.player.shield = 0;
    s.rooms[s.at].enemies = [{ id: 'k', kind: 'drone', x: s.player.x + 0.6, y: s.player.y, ang: 0, hp: 999, max: 999, r: 0.32, cd: 0, charge: 0, aim: null, fuse: null, stun: 0, hitT: 0, alive: true }];
  });
  await expect(page.locator('#pecioEnd')).toBeVisible({ timeout: 8000 });
  await page.locator('[data-vault="plating"]').click();
  await expect(page.locator('#peVault')).toContainText('Guardado');
  expect(await page.evaluate(() => window.__save.pecio.vault?.slot)).toBe('plating');
  // la siguiente partida empieza con él puesto, y la bóveda queda vacía
  await page.locator('#btnPecioRetry').click();
  await page.waitForFunction(() => window.G.mode === 'pecio');
  expect(await page.evaluate(() => ({ pl: window.G.pecio.player.gear.plating?.slot, vault: window.__save.pecio.vault }))).toEqual({ pl: 'plating', vault: null });
  expect(errors).toEqual([]);
});

test('pecios P3: el taller mejora la nave al empezar, y tras la planta 9 se elige seguir en el modo sin fin', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript(([k]) => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem(k, JSON.stringify({ v: 6, runs: 5, settings: { sound: false }, pecio: { best: 3, runs: 2, piezas: 500, wins: 0, vault: null, vaultOpen: false } })); }, [SAVE]);
  await page.goto('/?debug&nosw&seed=7');
  await page.waitForFunction(() => !!window.G);
  await page.locator('#btnPecio').click();
  // taller: casco (+1 vida) y llavero (1 llave)
  await page.locator('[data-pup="hull"]').click();
  await page.locator('[data-pup="keys"]').click();
  expect(await page.evaluate(() => ({ up: window.__save.pecioUp, piezas: window.__save.pecio.piezas }))).toEqual({ up: { hull: 1, keys: 1 }, piezas: 400 });
  const base = await page.evaluate(async () => {
    const { SHIPS } = await import('/js/upgrades.js');
    const { SHIP_ARENA } = await import('/js/arenaData.js');
    const ship = SHIPS.find((x) => x.id === window.__save.ship) || SHIPS[0];
    return 6 + Math.round(((SHIP_ARENA[ship.id]?.hp || 100) - 100) / 25);
  });
  await page.locator('#btnPecioPlay').click();
  await page.waitForFunction(() => window.G.mode === 'pecio');
  expect(await page.evaluate(() => ({ max: window.G.pecio.player.max, keys: window.G.pecio.player.keys }))).toEqual({ max: base + 1, keys: 1 });
  // planta 9 con la escotilla a los pies: sale la elección
  await page.evaluate(() => {
    const s = window.G.pecio;
    s.depth = 9;
    const room = s.rooms[s.at];
    room.enemies = [];
    room.tiles[5][4] = 'X';
    Object.assign(s.player, { x: 4.5, y: 5.5 });
  });
  await expect(page.locator('#psTitle')).toHaveText('🏆 ¡PLANTA 9 SUPERADA!');
  await page.locator('[data-exit="continue"]').click();
  await page.waitForFunction(() => window.G.mode === 'pecio');
  expect(await page.evaluate(() => ({ depth: window.G.pecio.depth, endless: window.G.pecio.endless }))).toEqual({ depth: 10, endless: true });
  expect(await page.evaluate(() => window.__save.ach.pecioWin?.done)).toBe(true);
  expect(errors).toEqual([]);
});

for (const vp of [{ width: 360, height: 640 }, { width: 375, height: 812 }]) {
  test(`pecios: en pausa, con 4 objetos, ABANDONAR se ve y funciona (sin el HUD encima) (${vp.width}×${vp.height})`, async ({ page }) => {
    await page.setViewportSize(vp);
    const errors = trackErrors(page);
    await startPecio(page);
    await page.evaluate(async () => {
      const { genItem, applyGear } = await import('/js/pecioLoot.js');
      const { makeRng } = await import('/js/rng.js');
      const p = window.G.pecio.player, rng = makeRng(3);
      p.gear = { weapon: genItem(rng, 5, { slot: 'weapon' }), plating: genItem(rng, 5, { slot: 'plating' }), mod1: genItem(rng, 5, { slot: 'mod' }), mod2: genItem(rng, 5, { slot: 'mod' }) };
      p.bag = { kit: 2, emp: 0, warp: 1 };
      applyGear(p);
    });
    await page.locator('#pcPause').click();
    await expect(page.locator('#pause')).toBeVisible();
    await expect(page.locator('#pecioHud')).toBeHidden();
    await expect(page.locator('.pause-gear .pg-row')).toHaveCount(4);
    // ABANDONAR, entero en pantalla
    const q = await page.locator('#btnQuit').boundingBox();
    expect(q.y + q.height).toBeLessThanOrEqual(vp.height);
    // SEGUIR devuelve el HUD
    await page.locator('#btnResume').click();
    await expect(page.locator('#pecioHud')).toBeVisible();
    // y ABANDONAR lleva al menú
    await page.locator('#pcPause').click();
    await page.locator('#btnQuit').click();
    await expect(page.locator('#menu')).toBeVisible();
    await expect(page.locator('#pecioHud')).toBeHidden();
    expect(errors).toEqual([]);
  });
}

test('pecios: el aviso de caer al pozo se queda en pantalla el tiempo de leerlo', async ({ page }) => {
  await startPecio(page);
  const r = await page.evaluate(async () => {
    const { fx } = await import('/js/fx.js');
    const s = window.G.pecio, room = s.rooms[s.at];
    room.tiles[Math.floor(s.player.y)][Math.floor(s.player.x)] = 'P';
    window.D.step(0.05, false);
    const now = fx.noticeList.some((n) => n.includes('pozo'));
    window.D.step(2.5, false);
    return { now, later: fx.noticeList.some((n) => n.includes('pozo')) };
  });
  expect(r).toEqual({ now: true, later: true });
});
