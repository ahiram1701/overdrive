import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

test.use({ viewport: { width: 375, height: 812 } });

// Desde el hub se llega a cada pantalla y "atrás" (← de la cabecera) vuelve al menú
const SCREENS = [
  ['#btnSettings', '#settings'],
  ['#btnRankBadge', '#achs'],
  ['#btnAch', '#achs'],
  ['#btnCodex', '#codex'],
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
        // ⚙️ de modificadores va a propósito dentro de la tarjeta RUNNER, encima de su esquina
        if ([a.id, b.id].includes('btnMods') && [a.id, b.id].includes('btnPlay')) continue;
        if (ov(a, b)) bad.push(`${a.id} ↔ ${b.id}`);
      }
    }
  }
  expect(bad).toEqual([]);
  // los modos se pueden ver desplazando, sin quedar tapados por la barra inferior al final
  await page.locator('#btnMutation').scrollIntoViewIfNeeded();
  const mut = await page.locator('#btnMutation').boundingBox();
  const nav = await page.locator('#bottomNav').boundingBox();
  expect(mut.y + mut.height).toBeLessThanOrEqual(nav.y + 1);
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
