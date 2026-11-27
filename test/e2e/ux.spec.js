// UX/UI: atrás del sistema, entrada de la Galaxia, estación con ZARPAR a mano, ajustes nuevos, botones de 44 px y contraste
import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

const SAVE = 'overdrive-save-v1';
async function boot(page, seedSave = { v: 3, runs: 5, tips: { galaxy: true, galCombat: true, dock: true, arena: true, runner: true } }) {
  await page.addInitScript(([k, v]) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(k, JSON.stringify(v));
    }
  }, [SAVE, seedSave]);
  await page.goto('/?debug&nosw&seed=3');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; });
}

test('atrás del sistema en plena partida: pausa (no cierra la app)', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await page.locator('#btnArena').click();
  await page.locator('#arenaMaps [data-map="grid"]').click();
  await page.waitForFunction(() => window.G.mode === 'arena');
  await page.goBack();
  await page.waitForFunction(() => window.G.mode === 'arenaPaused');
  expect(page.url()).toContain('debug');
  expect(errors).toEqual([]);
});

test('galaxia: pantalla de entrada con la dificultad; despegar desde ahí', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await page.locator('#btnGalaxy').click();
  await expect(page.locator('#galaxyHub')).toBeVisible();
  await expect(page.locator('#ghDiff [data-diff="pilot"]')).toHaveAttribute('aria-checked', 'true');
  await page.locator('#ghDiff [data-diff="relaxed"]').click();
  expect(await page.evaluate(() => window.__save.galaxy.difficulty)).toBe('relaxed');
  await page.locator('#btnGalGo').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  expect(errors).toEqual([]);
});

test('estación: ZARPAR siempre a la vista; REPARAR aparece con el casco dañado; pestañas por sección', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await page.locator('#btnGalaxy').click();
  await page.locator('#btnGalGo').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  await page.evaluate(() => { const s = window.G.space; s.ship.hull = 40; s.ship.pos = { ...s.sys.station.pos }; window.D.step(1 / 30); });
  await page.locator('#btnDock').click();
  await expect(page.locator('#btnUndock')).toBeInViewport();
  await expect(page.locator('#btnRepair')).toBeInViewport();
  // pestañas: solo se ve lo de la elegida, y se recuerda al volver a atracar
  await expect(page.locator('#btnSell')).toBeVisible();
  await expect(page.locator('#btnIncursion')).toBeHidden();
  await page.locator('#stTabBar [data-st-tab="jobs"]').click();
  await expect(page.locator('#stTabBar [data-st-tab="jobs"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#btnIncursion')).toBeInViewport();
  await expect(page.locator('#btnSell')).toBeHidden();
  await expect(page.locator('#btnUndock')).toBeInViewport();
  for (const b of await page.locator('#stTabBar button').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
  // no te alcanza: tiembla y avisa del motivo
  await page.evaluate(() => { window.__save.galaxy.credits = 0; });
  await page.locator('#stTabBar [data-st-tab="ship"]').click();
  await page.locator('#stUpgrades [data-up="cargo"]').click();
  await expect(page.locator('#toast')).toContainText('Faltan');
  await expect(page.locator('#toast')).toHaveClass(/err/);
  expect(errors).toEqual([]);
});

test('ajustes: opciones nuevas que se guardan y se aplican', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await page.locator('#btnSettings').click();
  // (las pruebas emulan «movimiento reducido»: se parte de animaciones apagadas)
  const motion0 = await page.evaluate(() => window.__save.settings.motion !== false);
  if (motion0) await page.locator('#tgMotion').click();
  await page.locator('#tgRollBtns').click();
  await page.locator('#btnTextSize').click(); // Normal → Grande
  await expect(page.locator('#tgMotion')).toHaveAttribute('aria-checked', 'false');
  const st = await page.evaluate(() => ({ s: window.__save.settings, body: document.body.className }));
  expect(st.s.motion).toBe(false);
  expect(st.s.rollBtns).toBe(false);
  expect(st.s.textSize).toBe('l');
  expect(st.body).toContain('reduce-motion');
  expect(st.body).toContain('no-roll');
  expect(st.body).toContain('text-l');
  expect(errors).toEqual([]);
});

test('accesibilidad: botones del HUD de al menos 44 px y texto apagado con contraste AA', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  const contrast = await page.evaluate(() => {
    const hex = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
    const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    return (lum(hex) + 0.05) / (lum('#07010f') + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await page.locator('#btnGalaxy').click();
  await page.locator('#btnGalGo').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  const sizes = await page.evaluate(() => ['spacePause', 'btnGalMap', 'btnInv', 'btnItems'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return Math.min(r.width, r.height); }));
  for (const s of sizes) expect(s).toBeGreaterThanOrEqual(44);
  expect(errors).toEqual([]);
});

test('runner: la pantalla final tiene REINTENTAR y tocar fuera no reinicia', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await page.locator('#btnRunner').click();
  await page.locator('#btnPlay').click();
  await page.waitForFunction(() => window.G.mode === 'play');
  await page.evaluate(() => { const r = window.G.run; r.shields = 0; r.extraLife = 0; for (let i = 0; i < 2000 && window.G.mode === 'play'; i++) window.D.step(0.1); for (let i = 0; i < 40 && window.G.mode !== 'dead'; i++) window.D.step(0.1); });
  await expect(page.locator('#death')).toBeVisible();
  await page.waitForTimeout(750);
  await page.locator('#dScore').click();
  expect(await page.evaluate(() => window.G.mode)).toBe('dead');
  await page.locator('#btnDeathRetry').click();
  await page.waitForFunction(() => window.G.mode === 'play' || window.G.mode === 'cards');
  expect(errors).toEqual([]);
});
