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
