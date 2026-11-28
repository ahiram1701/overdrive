// MÚSICA sin cortes, en un navegador de verdad: el sidechain del bombo nunca deja el bajo hundido
import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

test('el bajo y los pads no se quedan agachados: con bombos seguidos vuelven antes del siguiente', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?debug&nosw');
  await page.waitForFunction(() => !!window.G);
  await page.mouse.click(50, 50); // el primer toque enciende el audio
  const r = await page.evaluate(async () => {
    const a = await import('/js/audio.js');
    a.unlockAudio();
    a.setSound(true);
    // la canción de jefe de Pecios: bombos cada 2-3 semicorcheas (la que más cortaba)
    a.music.pecio = 3;
    a.music.intensity = 3;
    a.musicStart('pecio');
    await new Promise((res) => setTimeout(res, 1500));
    const xs = [];
    for (let i = 0; i < 150; i++) { xs.push(a.duckLevel()); await new Promise((res) => setTimeout(res, 20)); }
    return { playing: a.music.playing, low: xs.filter((v) => v < 0.6).length / xs.length, min: Math.min(...xs), avg: xs.reduce((s, v) => s + v, 0) / xs.length };
  });
  expect(r.playing).toBe('pecioBoss');
  // antes del arreglo se quedaba por debajo de 0,6 casi todo el tiempo (0,25 medio compás)
  expect(r.low).toBeLessThan(0.25);
  expect(r.avg).toBeGreaterThan(0.8);
  expect(errors).toEqual([]);
});
