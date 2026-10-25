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
  // el menú tiene los 4 juegos y ya no hay reto diario
  await expect(page.locator('#menu .game-card')).toHaveCount(4);
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
  expect(st.autoLevel).toBe(true); // viene apagado: un toque lo enciende
  expect(st.sens).toBeCloseTo(1.4);
  await page.reload();
  await page.locator('#btnSettings').click();
  await expect(page.locator('#tgInvert')).not.toHaveClass(/off/);
  await expect(page.locator('#tgLevel')).not.toHaveClass(/off/);
  await page.locator('#settings .scr-back').click();
  await expect(page.locator('#mMissions')).toBeHidden();
  await page.locator('#btnMissions').click();
  await expect(page.locator('#mMissions .mission').first()).toBeVisible();
});

test('la barra de abajo se ve desde el primer pintado, aunque el JS aún no haya cargado', async ({ page }) => {
  await page.route('**/js/main.js', (r) => r.abort()); // simula un iPhone que aún está descargando los módulos
  await page.goto('/?nosw');
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('#bottomNav')).toBeVisible();
  await expect(page.locator('#bottomNav [data-nav="menu"]')).toHaveClass(/on/);
});

test('música: el menú tiene su canción, cada juego la suya, y los volúmenes se guardan', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?debug&nosw');
  await page.waitForFunction(() => !!window.G);
  const song = () => page.evaluate(async () => { const { music } = await import('/js/audio.js'); return music.on ? music.song : null; });
  expect(await song()).toBe('menu');
  await page.evaluate(() => { window.G.manual = true; document.getElementById('btnPlay').click(); });
  await page.waitForFunction(() => window.G.mode === 'play');
  expect(await song()).toBe('runner');
  await page.evaluate(async () => { const { ui } = await import('/js/ui.js'); window.G.manual = false; ui.showMenu(); });
  expect(await song()).toBe('menu');
  await page.evaluate(() => {
    for (const [id, v] of [['setMusicVol', 0.25], ['setSfxVol', 0.6]]) { const r = document.getElementById(id); r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('overdrive-save-v1')).settings);
  expect([st.musicVol, st.sfxVol]).toEqual([0.25, 0.6]);
  expect(errors).toEqual([]);
});

test('AJUSTES desde la pausa: cambias algo y ← vuelve a la pausa con la partida tal cual', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?debug&nosw');
  await page.waitForFunction(() => !!window.G);
  // Runner
  await page.evaluate(() => { window.G.manual = true; document.getElementById('btnPlay').click(); });
  await page.waitForFunction(() => window.G.mode === 'play');
  await page.evaluate(() => { window.G.god = true; window.D.step(2, false); });
  const dist = await page.evaluate(() => window.G.run.dist);
  await page.locator('#pauseBtn').click();
  const paused = await page.evaluate(() => window.G.mode);
  await page.locator('#btnPauseSettings').click();
  await expect(page.locator('#settings')).toBeVisible();
  expect(await page.evaluate(() => window.G.mode)).toBe(paused); // sigue en pausa
  await page.evaluate(() => { const r = document.getElementById('setMusicVol'); r.value = 0.4; r.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#settings .scr-back').click();
  await expect(page.locator('#pause')).toBeVisible();
  await expect(page.locator('#menu')).toBeHidden();
  await page.locator('#btnResume').click();
  await page.waitForFunction(() => window.G.mode === 'play');
  expect(await page.evaluate(() => window.G.run.dist)).toBeGreaterThanOrEqual(dist);
  expect(await page.evaluate(() => window.__save.settings.musicVol)).toBe(0.4);
  // desde el menú, ← sigue llevando al menú
  await page.evaluate(async () => { const { ui } = await import('/js/ui.js'); window.G.manual = false; document.getElementById('btnQuit').click(); ui.showMenu(); });
  await page.locator('#btnSettings').click();
  await page.locator('#settings .scr-back').click();
  await expect(page.locator('#menu')).toBeVisible();
  expect(errors).toEqual([]);
});

test('AJUSTES desde la pausa de Pecios vuelve a su pausa y SEGUIR devuelve la partida', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?debug&nosw');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { document.getElementById('btnPecio').click(); document.getElementById('btnPecioPlay').click(); });
  await page.waitForFunction(() => window.G.mode === 'pecio');
  await page.evaluate(() => document.getElementById('pcPause').click());
  await page.locator('#btnPauseSettings').click();
  expect(await page.evaluate(() => window.G.mode)).toBe('pecioPaused');
  await page.locator('#settings .scr-back').click();
  await expect(page.locator('#pause')).toBeVisible();
  await page.locator('#btnResume').click();
  await page.waitForFunction(() => window.G.mode === 'pecio');
  expect(errors).toEqual([]);
});

// AJUSTES desde la pausa: ningún control de la partida queda por encima (Galaxia, Arena, Runner y Pecios)
for (const [game, start, pause, controls] of [
  ['Galaxia', () => document.getElementById('btnGalaxy').click(), 'spacePause', ['btnFire', 'btnBoost', 'btnRollL', 'throttleBox', 'btnGalMap']],
  ['Arena', () => { document.getElementById('btnArena').click(); document.querySelector('#arenaMaps .arena-map:not(.locked)').click(); }, 'arenaPause', ['arenaAbility', 'ahTime']],
  ['Runner', () => document.getElementById('btnPlay').click(), 'pauseBtn', ['abilityBtn', 'speed']],
  ['Pecios', () => { document.getElementById('btnPecio').click(); document.getElementById('btnPecioPlay').click(); }, 'pcPause', ['pcPause']],
]) {
  test(`${game}: con AJUSTES abiertos desde la pausa no asoma ningún control de la partida`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/?debug&nosw');
    await page.waitForFunction(() => !!window.G);
    await page.evaluate((fn) => { window.G.manual = true; (0, eval)(`(${fn})`)(); }, start.toString());
    await page.waitForTimeout(500);
    // los rectángulos de los controles mientras se juega
    const rects = await page.evaluate((ids) => ids.map((id) => { const r = document.getElementById(id)?.getBoundingClientRect(); return r && r.width ? [id, r.x + r.width / 2, r.y + r.height / 2] : null; }).filter(Boolean), controls);
    expect(rects.length).toBeGreaterThan(0);
    await page.evaluate((id) => document.getElementById(id).click(), pause);
    await expect(page.locator('#pause')).toBeVisible();
    await page.locator('#btnPauseSettings').click();
    await expect(page.locator('#settings')).toBeVisible();
    // en el centro de cada control, lo que hay delante es Ajustes (o la barra de abajo), nunca la partida
    const hits = await page.evaluate((rs) => rs.map(([id, x, y]) => { const el = document.elementFromPoint(x, y); return [id, !!el && !!el.closest('#settings')]; }), rects);
    for (const [id, ok] of hits) expect(ok, `${id} asoma sobre Ajustes`).toBe(true);
    await page.locator('#settings .scr-back').click();
    await expect(page.locator('#pause')).toBeVisible();
    expect(await page.evaluate(() => document.body.classList.contains('in-settings'))).toBe(false);
    expect(errors).toEqual([]);
  });
}

test('Runner: el HUD dice en qué tramo vas, con su barra, y cambia al pasar al siguiente', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?debug&nosw&seed=3');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; window.G.god = true; document.getElementById('btnPlay').click(); });
  await page.waitForFunction(() => window.G.mode === 'play');
  await page.evaluate(() => window.D.step(1 / 60));
  await expect(page.locator('#secTxt')).toHaveText('TRAMO 1');
  const bar = () => page.evaluate(() => Number(/scaleX\(([\d.]+)\)/.exec(document.querySelector('#secTag b').style.transform)?.[1] || 0));
  const b0 = await bar();
  await page.evaluate(() => { for (let i = 0; i < 240; i++) { window.G.player.dash = 0.3; window.D.step(1 / 60, false); } window.D.step(1 / 60); });
  expect(await bar()).toBeGreaterThan(b0);
  // hasta el tramo siguiente (las cartas del final de tramo se eligen solas)
  await page.evaluate(async () => {
    const G = window.G;
    for (let i = 0; i < 60 * 90 && G.run.section < 1; i++) {
      if (G.mode === 'cards') document.querySelector('#cardRow .card').click();
      else if (G.mode === 'shop') document.getElementById('btnShopDone').click();
      G.player.dash = 0.3;
      window.D.step(1 / 60, false);
    }
    window.D.step(1 / 60);
  });
  await expect(page.locator('#secTxt')).toContainText('TRAMO 2');
  expect(errors).toEqual([]);
});
