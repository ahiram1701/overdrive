// Genera las capturas y el GIF del README en docs/ jugando una partida real con semilla fija.
// Uso: npm run screenshots
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import gifenc from 'gifenc'; // paquete CommonJS: sin exports con nombre

const { GIFEncoder, quantize, applyPalette } = gifenc;

const PORT = 4174;
const BASE = `http://localhost:${PORT}`;
const OUT = 'docs';
mkdirSync(OUT, { recursive: true });

// node directo, sin shell ni npx: así server.pid es el proceso que escucha en el puerto y
// kill() lo cierra también en Windows (con shell solo moría cmd.exe y http-server quedaba huérfano)
const httpServerBin = createRequire(import.meta.url).resolve('http-server/bin/http-server');
const server = spawn(process.execPath, [httpServerBin, '-p', String(PORT), '-c-1', '-s', '.'], { stdio: 'ignore' });
const stop = () => { if (server.exitCode === null) try { server.kill(); } catch { /* ya terminado */ } };
process.on('exit', stop);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stop(); process.exit(130); });

async function waitServer() {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(BASE)).ok) return; } catch { /* aún arrancando */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('El servidor no arrancó');
}

// Avanza la simulación hasta que se cumpla la condición, con modo dios y DASH continuo.
async function advance(page, cond, maxSec = 200) {
  return page.evaluate(async ({ cond, maxSec }) => {
    const ok = new Function('G', `return (${cond});`);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let t = 0; t < maxSec; t += 1 / 60) {
      if (ok(window.G)) return true;
      if (window.G.mode === 'cards') {
        document.querySelector('#cardRow .card').click();
        while (window.G.mode === 'cards') await wait(20);
      } else if (window.G.mode === 'shop') document.getElementById('btnShopDone').click();
      else if (window.G.mode === 'chest') {
        while (document.getElementById('btnChestOk').classList.contains('hidden')) await wait(50);
        document.getElementById('btnChestOk').click();
      }
      window.G.player.dash = 0.3;
      window.D.step(1 / 60, false);
    }
    return false;
  }, { cond, maxSec });
}

async function newPage(browser, seed) {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1.5 });
  // partida ya jugada antes: sin tutorial
  await page.addInitScript(() => localStorage.setItem('overdrive-save-v1', JSON.stringify({ runs: 1, best: 1234567, gems: 340 })));
  await page.goto(`${BASE}/?debug&nosw${seed != null ? `&seed=${seed}` : ''}`);
  await page.evaluate(() => { window.G.debug = false; }); // oculta el contador de FPS
  return page;
}

async function play(page) {
  // clic por DOM: el botón JUGAR "respira" y Playwright nunca lo considera estable
  await page.evaluate(() => { window.G.god = true; window.G.manual = true; document.getElementById('btnPlay').click(); });
}

async function shot(page, name) {
  await page.evaluate(() => window.D.step(0.02));
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`✔ ${OUT}/${name}.png`);
}

await waitServer();
const browser = await chromium.launch();
try {
  // Menú
  let page = await newPage(browser, 11);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/menu.png` });
  console.log(`✔ ${OUT}/menu.png`);

  // Hangar con algo de progreso para que se vea el árbol
  await page.evaluate(async () => {
    const { save } = await import('/js/save.js');
    // cada nave con su propia personalización (Viper con su pintura exclusiva y un emblema)
    const eq = (palette, emblem) => ({ palette, trail: 'sparks', boom: 'classic', emblem });
    Object.assign(save, {
      gems: 340, ships: ['viper', 'brick', 'raptor'], shipLvl: { viper: { a: 2, b: 1, c: 1 } },
      shipStats: { viper: { sections: 34, runs: 12 } },
      cosmetics: { owned: { viper: ['skull'], brick: ['tiger', 'bolt'], raptor: ['chrome'] },
        equip: { viper: { ...eq('x-viper1', 'skull'), emblemColor: 'yellow' }, brick: eq('tiger', 'bolt'), raptor: eq('chrome', 'none') } },
    });
    document.getElementById('btnHangar').click();
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/hangar.png` });
  console.log(`✔ ${OUT}/hangar.png`);
  await page.evaluate(() => document.getElementById('btnHangarBack').click());

  // Mapa de campaña con el primer sector a medias
  await page.evaluate(async () => {
    const { save } = await import('/js/save.js');
    const all = [true, true, true];
    save.campaign = { '1-1': all, '1-2': all, '1-3': [true, false, true], '1-4': [true, true, false], '2-1': [true, false, false] };
    document.getElementById('btnCampaign').click();
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/campaign.png` });
  console.log(`✔ ${OUT}/campaign.png`);
  await page.evaluate(() => document.getElementById('btnCampBack').click());

  // Arena en plena partida (simulada, con algunas mejoras)
  await page.evaluate(() => { window.G.manual = true; });
  await page.evaluate(() => document.getElementById('btnArena').click());
  await page.evaluate(() => {
    const G = window.G;
    for (let i = 0; i < 70 * 20; i++) {
      if (G.mode === 'arenaUp') document.querySelector('#auOptions .au-opt').click();
      G.arena.botInput = { x: Math.cos(i / 30), y: Math.sin(i / 30) };
      window.D.step(1 / 20, false);
      if (G.mode !== 'arena' && G.mode !== 'arenaUp') break;
    }
    window.D.step(1 / 60, true);
  });
  await page.screenshot({ path: `${OUT}/arena.png` });
  console.log(`✔ ${OUT}/arena.png`);
  await page.evaluate(() => { window.G.manual = false; document.getElementById('btnQuit').click(); });

  // Expedición: el mapa del primer acto, tras el primer tramo
  await page.evaluate(() => { window.G.manual = true; window.G.god = true; document.getElementById('btnExpedition').click(); });
  await page.evaluate(() => {
    const G = window.G;
    for (let i = 0; i < 60 * 60 && G.mode === 'play'; i++) window.D.step(1 / 60, false);
    if (G.mode === 'cards') document.querySelector('#cardRow .card').click();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/expedition.png` });
  console.log(`✔ ${OUT}/expedition.png`);
  await page.evaluate(() => { window.G.manual = false; window.G.god = false; document.getElementById('btnExpMenu').click(); });

  // Carrera: al poco de salir, con los rivales delante
  await page.evaluate(() => { window.G.manual = true; document.getElementById('btnRaces').click(); });
  await page.evaluate(() => document.querySelector('[data-cup="c1"]').click());
  await page.evaluate(() => { for (let i = 0; i < 150; i++) window.D.step(1 / 60, false); window.D.step(1 / 60, true); });
  await page.screenshot({ path: `${OUT}/race.png` });
  console.log(`✔ ${OUT}/race.png`);
  await page.evaluate(() => { window.G.manual = false; document.getElementById('btnQuit').click(); });

  // Modificadores con algunos activos
  await page.evaluate(async () => {
    const { save } = await import('/js/save.js');
    Object.assign(save, { xp: 40000, modsLast: ['turbo', 'mines', 'glass'] });
    document.getElementById('btnMods').click();
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/modifiers.png` });
  console.log(`✔ ${OUT}/modifiers.png`);
  await page.evaluate(() => document.getElementById('btnModsBack').click());

  // Partida: un obstáculo "deslízate" cerca y algo de combo
  await play(page);
  await advance(page, "G.run.time > 25 && G.run.objects.some(o => o.alive && o.type === 'overhead' && o.z - G.run.dist > 8 && o.z - G.run.dist < 13)");
  await shot(page, 'gameplay');

  // Cartas al final del tramo
  await advance(page, "G.mode === 'cards'");
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/cards.png` });
  console.log(`✔ ${OUT}/cards.png`);

  // Jefe
  await advance(page, 'G.run.boss && G.run.boss.t > 4 && G.run.boss.hp === G.run.boss.max');
  await shot(page, 'boss');
  await page.close();

  // GIF de gameplay: frames del canvas reducidos a 270x585, 15 fps
  page = await newPage(browser, 5);
  await play(page);
  await advance(page, 'G.run.time > 40');
  const W = 270, H = 585, FRAMES = 75;
  const gif = GIFEncoder();
  for (let i = 0; i < FRAMES; i++) {
    const b64 = await page.evaluate(({ W, H, i }) => {
      const G = window.G;
      if (i % 9 === 0) window.dispatchEvent(new KeyboardEvent('keydown', { key: G.player.lane >= 0 ? 'ArrowLeft' : 'ArrowRight' }));
      if (i % 13 === 5) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      if (G.mode === 'play') { G.player.dash = 0.3; window.D.step(1 / 15); }
      const o = (window.__gifCanvas ||= Object.assign(document.createElement('canvas'), { width: W, height: H }));
      const x = o.getContext('2d');
      x.drawImage(document.getElementById('game'), 0, 0, W, H);
      const d = x.getImageData(0, 0, W, H).data;
      let s = '';
      for (let k = 0; k < d.length; k += 0x8000) s += String.fromCharCode.apply(null, d.subarray(k, k + 0x8000));
      return btoa(s);
    }, { W, H, i });
    const rgba = new Uint8Array(Buffer.from(b64, 'base64'));
    const palette = quantize(rgba, 128);
    gif.writeFrame(applyPalette(rgba, palette), W, H, { palette, delay: 66 });
  }
  gif.finish();
  writeFileSync(`${OUT}/gameplay.gif`, gif.bytes());
  console.log(`✔ ${OUT}/gameplay.gif`);
} finally {
  await browser.close();
  stop();
}
