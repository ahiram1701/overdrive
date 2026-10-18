import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

test.use({ viewport: { width: 375, height: 812 } });

// Desde el hub se llega a cada pantalla y "atrás" (← de la cabecera) vuelve al menú
const SCREENS = [
  ['#btnSettings', '#settings'],
  ['#btnRankBadge', '#achs'],
  ['#btnAch', '#achs'],
  ['#btnCodex', '#codex'],
];
// los modos del Runner cuelgan de su pantalla: su ← vuelve a ella
const RUNNER_SCREENS = [
  ['#btnCampaign', '#campaign'],
  ['#btnMods', '#mods'],
  ['#btnRaces', '#raceCups'],
];

test('hub: cada pantalla se abre y su ← vuelve al menú', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?nosw');
  await expect(page.locator('#bottomNav')).toBeVisible();
  for (const [btn, scr] of SCREENS) {
    await page.locator(btn).click();
    await expect(page.locator(scr)).toBeVisible();
    await page.locator(`${scr} .scr-back`).click();
    await expect(page.locator('#menu')).toBeVisible();
  }
  // RUNNER: su pantalla con el infinito y los 4 modos
  await page.locator('#btnRunner').click();
  await expect(page.locator('#runnerHub')).toBeVisible();
  for (const [btn, scr] of RUNNER_SCREENS) {
    await page.locator(btn).click();
    await expect(page.locator(scr)).toBeVisible();
    await page.locator(`${scr} .scr-back`).click();
    await expect(page.locator('#runnerHub')).toBeVisible();
  }
  await page.locator('#runnerHub .scr-back').click();
  await expect(page.locator('#menu')).toBeVisible();
  // el menú tiene los 3 juegos y ya no hay reto diario
  await expect(page.locator('#menu .game-card')).toHaveCount(3);
  await expect(page.locator('#btnDaily')).toHaveCount(0);
  // el hangar desde la barra inferior, y la barra marca dónde estás
  await page.locator('#btnHangar').click();
  await expect(page.locator('#hangar')).toBeVisible();
  await expect(page.locator('#btnHangar')).toHaveClass(/on/);
  await page.locator('#bottomNav [data-nav=menu]').click();
  await expect(page.locator('#menu')).toBeVisible();
  expect(errors).toEqual([]);
});

test('hub: ningún botón se solapa con otro ni se sale de la pantalla a 375×812', async ({ page }) => {
  await page.goto('/?nosw');
  await expect(page.locator('#menu')).toBeVisible();
  const boxes = await page.evaluate(() => {
    const els = [...document.querySelectorAll('#menu button, #bottomNav button')].filter((e) => e.offsetParent);
    return els.map((e) => { const r = e.getBoundingClientRect(); return { id: e.id || e.dataset.nav, x: r.x, y: r.y, w: r.width, h: r.height, nav: !!e.closest('#bottomNav') }; });
  });
  const ov = (a, b) => a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
  const bad = [];
  for (const b of boxes) {
    if (b.x < 0 || b.x + b.w > 376) bad.push(`${b.id} se sale`);
  }
  // botones del mismo plano (el menú se desplaza bajo la barra fija, así que se comparan por separado)
  for (const nav of [false, true]) {
    const set = boxes.filter((b) => b.nav === nav);
    for (let i = 0; i < set.length; i++) {
      for (let j = i + 1; j < set.length; j++) {
        const [a, b] = [set[i], set[j]];
        if (ov(a, b)) bad.push(`${a.id} ↔ ${b.id}`);
      }
    }
  }
  expect(bad).toEqual([]);
  // la última tarjeta (ARENA) se ve entera, sin quedar tapada por la barra inferior
  await page.locator('#btnArena').scrollIntoViewIfNeeded();
  const ar = await page.locator('#btnArena').boundingBox();
  const nav = await page.locator('#bottomNav').boundingBox();
  expect(ar.y + ar.height).toBeLessThanOrEqual(nav.y + 1);
  // pantalla RUNNER: tampoco se solapa nada
  await page.locator('#btnRunner').click();
  const rb = await page.evaluate(() => [...document.querySelectorAll('#runnerHub button')].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return { id: e.id || e.className, x: r.x, y: r.y, w: r.width, h: r.height }; }));
  const bad2 = [];
  for (let i = 0; i < rb.length; i++) for (let j = i + 1; j < rb.length; j++) if (ov(rb[i], rb[j])) bad2.push(`${rb[i].id} ↔ ${rb[j].id}`);
  expect(bad2).toEqual([]);
});

test('el "atrás" del navegador / Android cierra la pantalla en vez de salir', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?nosw');
  await page.locator('#btnSettings').click();
  await expect(page.locator('#settings')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#menu')).toBeVisible();
  expect(page.url()).toContain('nosw');
  // Esc también cierra
  await page.locator('#btnCodex').click();
  await expect(page.locator('#codex')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu')).toBeVisible();
  // cerrar con ← consume la entrada del historial: un "atrás" después no hace nada raro
  await page.locator('#btnAch').click();
  await page.locator('#achs .scr-back').click();
  await expect(page.locator('#menu')).toBeVisible();
  expect(errors).toEqual([]);
});

test('ajustes: los interruptores y la Galaxia se guardan; las misiones se despliegan', async ({ page }) => {
  await page.goto('/?nosw&debug');
  await page.locator('#btnSettings').click();
  await page.locator('#tgInvert').click();
  await page.locator('#tgLevel').click();
  await page.locator('#setSens').fill('1.4');
  const st = await page.evaluate(() => window.__save.settings);
  expect(st.invertY).toBe(true);
  expect(st.autoLevel).toBe(false);
  expect(st.sens).toBeCloseTo(1.4);
  await page.reload();
  await page.locator('#btnSettings').click();
  await expect(page.locator('#tgInvert')).not.toHaveClass(/off/);
  await expect(page.locator('#tgLevel')).toHaveClass(/off/);
  await page.locator('#settings .scr-back').click();
  await expect(page.locator('#mMissions')).toBeHidden();
  await page.locator('#btnMissions').click();
  await expect(page.locator('#mMissions .mission').first()).toBeVisible();
});
