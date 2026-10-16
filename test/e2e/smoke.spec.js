import { test, expect } from '@playwright/test';
import { trackErrors, startRun, botInPage } from './helpers.js';

test('el menú carga y JUGAR muestra el HUD sin errores', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?nosw');
  await expect(page.locator('h1.logo')).toBeVisible();
  await page.locator('#btnPlay').click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#menu')).toBeHidden();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

// Equidad: con estas semillas un bot que solo reacciona debe poder sobrevivir.
// Si un cambio en la generación crea un patrón imposible, este test lo detecta.
for (const seed of [1, 42, 2026]) {
  test(`equidad: el bot sobrevive 90 s con la semilla ${seed}`, async ({ page }) => {
    const errors = trackErrors(page);
    await startRun(page, { seed });
    const res = await page.evaluate(botInPage, { seconds: 90 });
    expect(res.hits, `golpes: ${JSON.stringify(res.hits)}`).toEqual([]);
    expect(res.mode).toBe('play');
    expect(res.section).toBeGreaterThanOrEqual(2);
    expect(res.near).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}

// Regresión del exploit de "no jugar": con escudos, Vampiro y Explosivo (el peor caso),
// quedarse quieto sin tocar nada tiene que acabar en muerte en pocos segundos.
// Es la build exacta que daba escudos infinitos: golpe -> overdrive -> roturas en cadena -> Vampiro -> escudo.
test('quedarse quieto mata aunque tengas escudos, Vampiro, Explosivo y overdrive potenciado', async ({ page }) => {
  await startRun(page, { seed: 9 });
  const res = await page.evaluate(() => {
    const G = window.G, r = G.run;
    // un minuto de partida para tener velocidad alta (sin bifurcaciones que abran menús)
    r.sectionEnd = Infinity;
    G.god = true;
    for (let i = 0; i < 3600 && G.mode === 'play'; i++) { G.player.dash = 0.3; window.D.step(1 / 60, false); }
    G.god = false;
    G.player.dash = 0;
    r.shields = 3;
    Object.assign(r.stats, { vampire: true, explosive: true, odRate: 2.05, odDur: 12 });
    let t = 0, maxShields = r.shields;
    while (G.mode === 'play' && t < 30) {
      window.D.step(1 / 60, false);
      t += 1 / 60;
      maxShields = Math.max(maxShields, r.shields);
    }
    return { mode: G.mode, t, shields: r.shields, maxShields };
  });
  expect(res.maxShields).toBeLessThanOrEqual(3);
  expect(res.mode, `seguía vivo tras ${res.t.toFixed(1)} s con ${res.shields} escudos`).not.toBe('play');
});

test('el Cazador aparece al quedarte quieto y se retira si esquivas 2 disparos', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page, { seed: 4 });
  const res = await page.evaluate(() => {
    const G = window.G, r = G.run, p = G.player;
    const key = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    r.sectionEnd = Infinity;
    r.objects.length = 0;
    r.genHold = true; // pista vacía: solo cuenta el Cazador
    let t = 0;
    while (!r.hunter && t < 6) { window.D.step(1 / 60, false); t += 1 / 60; }
    const spawnedAt = t;
    let lastAim = -1, dodges = 0;
    while (r.hunter && !r.hunter.leaving && t < 20 && G.mode === 'play') {
      const h = r.hunter;
      // esquivar: cambiar de carril justo después de que te marque
      if (h.aimT > 0 && h.shots !== lastAim) {
        lastAim = h.shots;
        key(p.lane >= 0 ? 'ArrowLeft' : 'ArrowRight');
        dodges++;
      }
      window.D.step(1 / 60, false);
      t += 1 / 60;
    }
    return { spawnedAt, left: !!r.hunter?.leaving || !r.hunter, mode: G.mode, hits: (G.hits || []).length, dodges };
  });
  expect(res.spawnedAt).toBeGreaterThan(2.9);
  expect(res.spawnedAt).toBeLessThan(3.2);
  expect(res.left).toBe(true);
  expect(res.hits).toBe(0);
  expect(res.mode).toBe('play');
  expect(errors).toEqual([]);
});

test('se llega y se derrota al primer jefe pasando por cartas, cofres y tienda', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page, { seed: 7, god: true });
  const res = await page.evaluate(botInPage, { seconds: 180, god: true, until: 'boss' });
  expect(res.bosses).toBe(1);
  expect(errors).toEqual([]);
});

test('morir muestra la pantalla de resultados y tocar reinicia', async ({ page }) => {
  await startRun(page, { seed: 3 });
  await page.evaluate(() => { for (let i = 0; i < 400 && window.G.mode === 'play'; i++) window.D.step(0.1, false); window.D.step(1.5); });
  await expect(page.locator('#death')).toBeVisible();
  await expect(page.locator('#dScore')).not.toHaveText('');
  await page.waitForTimeout(800);
  await page.locator('#death').click({ position: { x: 50, y: 50 } });
  await page.waitForFunction(() => window.G.mode === 'play');
});

test('PWA: manifest válido, iconos y service worker con caché', async ({ page, request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('fullscreen');
  for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);
  await page.goto('/');
  const cached = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 50; i++) {
      const keys = await caches.keys();
      if (keys.length) {
        const n = (await (await caches.open(keys[0])).keys()).length;
        if (n >= 20) return n;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return 0;
  });
  expect(cached).toBeGreaterThanOrEqual(20);
});
