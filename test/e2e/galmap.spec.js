import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

// MAPA GALÁCTICO: insignias, leyenda, ruta con peaje, zoom y capas
const SAVE = 'overdrive-save-v1';
const SEED = {
  v: 6, runs: 5, settings: { sound: false }, story: { ch: 30, n: 0, seen: { 30: true } },
  galaxy: { started: true, credits: 9000, up: { jump: 6 }, sys: 0, home: 0, visited: [0, 4, 9, 14, 15, 16, 5, 12, 17, 1, 7, 8], jumps: 30,
    missions: [{ id: 'm1', kind: 'hunt', sys: 16, n: 3, progress: 0, text: 'Elimina 3 piratas en X', reward: 300 }] },
  territory: { 2: 'liga' }, outposts: { 15: { name: 'Alfa', mods: {} } },
  bounties: { active: { sys: 12, name: 'Pirata X', level: 3, trait: 'blindado', reward: 900 } },
  galaxyWorld: { war: { sys: 14, until: 33, kills: 1, need: 6 }, swarm: { systems: [5, 17], nextSpread: 32 }, nextWar: 40, nextSwarm: 99 },
};

async function openMap(page) {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(([k, v]) => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem(k, JSON.stringify(v)); }, [SAVE, SEED]);
  await page.goto('/?debug&nosw&seed=3');
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; });
  await page.locator('#btnGalaxy').click();
  await page.waitForFunction(() => window.G.mode === 'galaxy');
  await page.locator('#btnGalMap').click();
}

test('mapa: insignias en su sistema, leyenda completa y nombres que no se pisan', async ({ page }) => {
  const errors = trackErrors(page);
  await openMap(page);
  const badge = (sys, k) => page.locator(`.gm-node[data-sys="${sys}"] [data-badge="${k}"]`);
  await expect(badge(16, 'mission')).toHaveCount(1);
  await expect(badge(12, 'bounty')).toHaveCount(1);
  await expect(badge(14, 'war')).toHaveCount(1);
  await expect(badge(5, 'swarm')).toHaveCount(1);
  await expect(badge(15, 'outpost')).toHaveCount(1);
  await expect(badge(0, 'home')).toHaveCount(1);
  // insignias legibles: al menos 14 px en pantalla
  const bb = await badge(14, 'war').boundingBox();
  expect(bb.width).toBeGreaterThanOrEqual(14);
  // leyenda
  await page.locator('#gmLegend summary').click();
  for (const t of ['Color = peligro', 'Anillo = facción', 'Ofensiva pirata', 'Infectado por el enjambre', 'Tu ruta']) await expect(page.locator('#gmLegendBody')).toContainText(t);
  // ningún nombre pisa a otro
  const boxes = await page.evaluate(() => [...document.querySelectorAll('#gmSvg .gm-label')].map((e) => e.getBoundingClientRect()).map((r) => ({ x0: r.left, x1: r.right, y0: r.top, y1: r.bottom })));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    expect(a.x0 < b.x1 - 1 && a.x1 > b.x0 + 1 && a.y0 < b.y1 - 1 && a.y1 > b.y0 + 1, `nombres ${i} y ${j} se pisan`).toBe(false);
  }
  expect(errors).toEqual([]);
});

test('mapa: la ficha dice qué hay; la ruta lleva flechas y peaje; zoom, centrar y capas', async ({ page }) => {
  const errors = trackErrors(page);
  await openMap(page);
  await page.locator('.gm-node[data-sys="16"]').click();
  await expect(page.locator('#gmInfo')).toContainText('📋 Elimina 3 piratas');
  await expect(page.locator('#gmInfo')).toContainText('peaje');
  await page.locator('#btnRoute').click();
  await page.locator('#btnGalMap').click();
  await expect(page.locator('#gmSvg line.gm-arrow').first()).toBeAttached();
  await expect(page.locator('#gmInfo .gm-route')).toContainText('saltos');
  // zoom: el viewBox se estrecha; ⌖ lo devuelve
  const vb0 = await page.locator('#gmSvg').getAttribute('viewBox');
  await page.locator('#gmIn').click();
  const vb1 = await page.locator('#gmSvg').getAttribute('viewBox');
  expect(Number(vb1.split(' ')[2])).toBeLessThan(Number(vb0.split(' ')[2]));
  await page.locator('#gmFit').click();
  expect(await page.locator('#gmSvg').getAttribute('viewBox')).toBe(vb0);
  // capas: ocultar Sucesos quita ⚔️ y 🐝, y se recuerda
  await page.locator('[data-layer="evt"]').click();
  await expect(page.locator('[data-badge="war"]')).toHaveCount(0);
  await expect(page.locator('[data-badge="swarm"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__save.settings.mapLayers.evt)).toBe(false);
  // capa Facciones: sin anillos
  await page.locator('[data-layer="fac"]').click();
  await expect(page.locator('#gmSvg circle.fac')).toHaveCount(0);
  expect(errors).toEqual([]);
});
