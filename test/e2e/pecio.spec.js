import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

// PECIOS: el 4.º juego (mazmorras por turnos con tu nave)
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

test('pecios: el bot recorre salas y baja plantas; la partida responde a gestos y teclas', async ({ page }) => {
  const errors = trackErrors(page);
  await startPecio(page);
  await expect(page.locator('#pecioHud')).toBeVisible();
  await expect(page.locator('#pcFloor')).toHaveText('PLANTA 1');
  // una tecla = un paso (un turno)
  const t0 = await page.evaluate(() => window.G.pecio.turn);
  await page.keyboard.press('ArrowUp');
  expect(await page.evaluate(() => window.G.pecio.turn)).toBe(t0 + 1);
  // el bot juega: llega a otra planta (o cae intentándolo, pero nunca se queda quieto)
  const r = await page.evaluate(() => {
    window.G.pecio.player.hp = window.G.pecio.player.max = 40;
    let last = null;
    for (let i = 0; i < 1500; i++) {
      last = window.__pecioBot(1);
      if (!last || last.over || last.depth >= 3) break;
    }
    return { ...last, visited: window.G.pecio.visited.length };
  });
  expect(r.depth).toBeGreaterThanOrEqual(3);
  expect(errors).toEqual([]);
});

test('pecios: las puertas se cierran con enemigos, el disparo apunta y la tienda vende', async ({ page }) => {
  const errors = trackErrors(page);
  await startPecio(page);
  // en una sala de combate, la puerta no deja salir mientras quede alguien
  const locked = await page.evaluate(async () => {
    const { roomOf, locked: isLocked, act } = await import('/js/pecio.js');
    const s = window.G.pecio;
    const id = Object.keys(s.floor.rooms).find((k) => s.floor.rooms[k].type === 'combat');
    s.at = id;
    const room = roomOf(s);
    const door = Object.keys(s.floor.rooms[id].doors)[0];
    const pos = { up: [4, 1], down: [4, 9], left: [1, 5], right: [7, 5] }[door];
    s.player.x = pos[0]; s.player.y = pos[1];
    room.enemies.forEach((e, i) => { e.x = 1 + (i % 2) * 6; e.y = 2 + Math.floor(i / 2); });
    const ev = act(s, { type: 'move', dir: door });
    return { locked: isLocked(room), stayed: s.at === id, ev: ev.map((e) => e.type) };
  });
  expect(locked.locked).toBe(true);
  expect(locked.stayed).toBe(true);
  expect(locked.ev).toContain('locked');
  // ⚡: el botón activa apuntar y la siguiente dirección dispara
  await page.locator('#pcShoot').click();
  await expect(page.locator('#pcShootTxt')).toHaveText('¿HACIA DÓNDE?');
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => window.G.pecio.player.shotCd)).toBeGreaterThan(0);
  // la tienda: con 🔩, una reparación
  await page.evaluate(async () => {
    const { ui } = await import('/js/ui.js');
    const s = window.G.pecio;
    s.depth = 2; s.player.piezas = 50; s.player.hp = 2;
    window.G.mode = 'pecioShop';
    ui.showPecioShop(s);
  });
  await page.locator('[data-buy="repair"]').click();
  expect(await page.evaluate(() => window.G.pecio.player.hp)).toBe(5);
  await page.locator('#btnPecioShopClose').click();
  expect(await page.evaluate(() => window.G.mode)).toBe('pecio');
  expect(errors).toEqual([]);
});

test('pecios: al caer, pantalla final y te llevas parte de las 🔩', async ({ page }) => {
  const errors = trackErrors(page);
  await startPecio(page);
  await page.evaluate(async () => {
    const { pecioAct } = await import('/js/pecioGame.js');
    const s = window.G.pecio;
    s.player.piezas = 40;
    s.player.hp = 1;
    const room = s.rooms[s.at];
    room.enemies = [{ id: 'x', kind: 'drone', x: s.player.x + 1, y: s.player.y, hp: 2, max: 2, facing: 'left', fuse: null, charge: null, cd: 0, stun: 0, alive: true }];
    pecioAct({ type: 'wait' });
  });
  await expect(page.locator('#pecioEnd')).toBeVisible();
  await expect(page.locator('#peTitle')).toHaveText('DESTRUIDO');
  expect(await page.evaluate(() => window.__save.pecio.piezas)).toBe(20);
  await page.locator('#btnPecioMenu').click();
  await expect(page.locator('#pecioHub')).toBeVisible();
  await expect(page.locator('#phPiezas')).toHaveText('20');
  expect(errors).toEqual([]);
});
