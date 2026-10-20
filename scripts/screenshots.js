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
      if (window.G.run) window.G.run.nextEventAt = 1e9; // sin sucesos: las fotos, sin el mundo al revés
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
  await page.evaluate(async () => {
    window.G.debug = false; // oculta el contador de FPS
    // la GUÍA ya vista: que ningún consejo tape las capturas
    const { TIPS, markTip } = await import('/js/tips.js');
    const { save } = await import('/js/save.js');
    for (const id of Object.keys(TIPS)) markTip(save, id);
  });
  return page;
}

async function play(page) {
  // clic por DOM: el botón RUNNER "respira" y Playwright nunca lo considera estable
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
      gems: 340, ships: ['viper', 'brick', 'raptor', 'centella', 'gladiador', 'carronero', 'wanderer'], ship: 'carronero',
      shipLvl: { viper: { a: 2, b: 1, c: 1 }, carronero: { a: 1, b: 1, c: 0 } },
      shipStats: { viper: { sections: 34, runs: 12 }, carronero: { sections: 9, runs: 3 } },
      cosmetics: { owned: { viper: ['skull'], brick: ['tiger', 'bolt'], raptor: ['chrome'] },
        equip: { viper: { ...eq('x-viper1', 'skull'), emblemColor: 'yellow' }, brick: eq('tiger', 'bolt'), raptor: eq('chrome', 'none') } },
    });
    document.getElementById('btnHangar').click();
  });
  await page.waitForTimeout(300);
  // el carrusel, en las 4 naves exclusivas (se ganan jugando cada juego)
  await page.evaluate(async () => { const { SHIPS } = await import('/js/upgrades.js'); const c = document.getElementById('shipCarousel'), k = c.children[SHIPS.findIndex((x) => x.id === 'centella')]; c.scrollLeft = k ? k.offsetLeft - 12 : c.scrollWidth; });
  await page.waitForTimeout(200);
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
  await page.evaluate(() => document.querySelector('#campaign .scr-back').click());

  // Arena en plena partida (simulada, con algunas mejoras)
  await page.evaluate(() => { window.G.manual = true; });
  await page.evaluate(async () => {
    const { save } = await import('/js/save.js');
    save.ship = 'gladiador'; // la nave exclusiva de la Arena
    save.arenaMaps = { ...(save.arenaMaps || {}), grid: { wins: 1, best: 600 }, belt: { wins: 0, best: 410 } }; // un mapa ganado, otro abierto
    document.getElementById('btnArena').click();
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/arena-maps.png` });
  console.log(`✔ ${OUT}/arena-maps.png`);
  await page.evaluate(() => document.querySelector('#arenaMaps .arena-map:not(.locked)').click());
  await page.evaluate(() => {
    const G = window.G;
    for (let i = 0; i < 125 * 20; i++) {
      if (G.mode === 'arenaUp') document.querySelector('#auOptions .au-opt').click();
      G.arena.botInput = { x: Math.cos(i / 30), y: Math.sin(i / 30) };
      window.D.step(1 / 20, false);
      if (G.mode !== 'arena' && G.mode !== 'arenaUp') break;
    }
    window.D.step(1 / 60, true);
  });
  await page.screenshot({ path: `${OUT}/arena.png` });
  console.log(`✔ ${OUT}/arena.png`);
  await page.evaluate(async () => { window.G.manual = false; document.getElementById('btnQuit').click(); (await import('/js/save.js')).save.ship = 'carronero'; });

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
  await page.evaluate(() => {
    const G = window.G;
    G.god = true;
    for (let i = 0; i < 260; i++) { G.player.dash = 0.3; if (G.run) G.run.nextEventAt = 1e9; window.D.step(1 / 60, false); }
    // en cabeza: los rivales, justo detrás y en los carriles de al lado
    G.run.race.rivals.forEach((rv, i) => { rv.z = G.run.dist - 1.2 - i * 3.5; });
    for (let i = 0; i < 20; i++) window.D.step(1 / 60, false);
    window.D.step(1 / 60, true);
    G.god = false;
  });
  await page.screenshot({ path: `${OUT}/race.png` });
  console.log(`✔ ${OUT}/race.png`);
  await page.evaluate(() => { window.G.manual = false; document.getElementById('btnQuit').click(); });

  // Galaxia: recién salido de la estación, con asteroides delante
  await page.evaluate(() => { window.G.manual = true; document.getElementById('btnGalaxy').click(); });
  await page.evaluate(() => {
    const s = window.G.space;
    s.botInput = { x: 0.15, y: 0 };
    s.botFire = true;
    for (let i = 0; i < 70; i++) window.D.step(1 / 30, false);
    window.D.step(1 / 60, true);
  });
  await page.screenshot({ path: `${OUT}/galaxy.png` });
  console.log(`✔ ${OUT}/galaxy.png`);
  await page.evaluate(async () => {
    const { save } = await import('/js/save.js');
    save.galaxy.visited = Array.from({ length: 16 }, (_, i) => i); // media galaxia explorada: el mapa con vida
    document.getElementById('btnGalMap').click();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/galaxy-map.png` });
  console.log(`✔ ${OUT}/galaxy-map.png`);
  await page.evaluate(() => { const b = document.querySelector('#galMap .scr-back, #galMap [data-close], #btnGalMapClose'); if (b) b.click(); else window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
  await page.evaluate(() => { window.G.manual = false; document.getElementById('btnQuit').click(); });

  // PECIOS: una sala en 3D con equipo y botín en el suelo, y un jefe
  await page.evaluate(async () => {
    const { save } = await import('/js/save.js');
    Object.assign(save.pecio, { piezas: 860, best: 9, wins: 1 });
    save.pecioUp = { hull: 2, keys: 1, pack: 1, luck: 1 };
    document.getElementById('btnPecio').click();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('phWorkshop').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/pecio-workshop.png` });
  console.log(`✔ ${OUT}/pecio-workshop.png`);
  await page.evaluate(() => { window.G.manual = true; document.getElementById('btnPecioPlay').click(); });
  await page.evaluate(async () => {
    const { genItem, applyGear } = await import('/js/pecioLoot.js');
    const { makeRng } = await import('/js/rng.js');
    const s = window.G.pecio, rng = makeRng(42), pl = s.player;
    pl.gear.weapon = genItem(rng, 9, { slot: 'weapon', minTier: 3 });
    pl.gear.plating = genItem(rng, 5, { slot: 'plating', minTier: 2 });
    pl.gear.mod1 = genItem(rng, 5, { slot: 'mod', minTier: 1 });
    applyGear(pl);
    pl.hp = pl.max;
    pl.bag = { kit: 2, emp: 1, warp: 0 };
    s.introBanner = null;
    s.rooms[s.at].pickups.push({ id: 'a', kind: 'item', item: genItem(rng, 9, { minTier: 3 }), x: 4.5, y: 3.2 }, { id: 'b', kind: 'item', item: genItem(rng, 6, { minTier: 2 }), x: 2.8, y: 4.4 }, { id: 'c', kind: 'cons', cons: 'emp', x: 6.2, y: 4.4 });
    for (let i = 0; i < 20; i++) window.D.step(1 / 60, false);
    (await import('/js/fx.js')).fx.clear(); // sin el cartel de la planta tapando la sala
    window.D.step(1 / 60, true);
  });
  await page.screenshot({ path: `${OUT}/pecio.png` });
  console.log(`✔ ${OUT}/pecio.png`);
  await page.evaluate(async () => {
    const { genItem } = await import('/js/pecioLoot.js');
    const { makeRng } = await import('/js/rng.js');
    const { ui } = await import('/js/ui.js');
    const s = window.G.pecio, it = genItem(makeRng(7), 9, { slot: 'weapon', minTier: 3 });
    it.kind = 'orbit'; it.orbs = 3; it.rate = 0.75; it.unique = 'reactor'; it.set = 'hunter';
    s.player.gear.weapon = { ...genItem(makeRng(3), 6, { slot: 'weapon', minTier: 2 }), kind: 'spread', unique: undefined, set: undefined, rate: 0.9 };
    s.player.gear.mod1.set = 'hunter';
    s.player.sets = { hunter: 1 };
    s.offer = { item: it, pk: null };
    window.G.mode = 'pecioShop';
    ui.showPecioOffer(s);
  });
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}/pecio-loot.png` });
  console.log(`✔ ${OUT}/pecio-loot.png`);
  await page.evaluate(async () => {
    const { pecioTakeOffer } = await import('/js/pecioGame.js');
    pecioTakeOffer('leave');
  });
  await page.evaluate(async () => {
    const { genFloor, roomOf } = await import('/js/pecio.js');
    const s = window.G.pecio;
    s.depth = 9; s.floor = genFloor(s.seed, 9); s.rooms = {};
    s.at = Object.keys(s.floor.rooms).find((k) => s.floor.rooms[k].type === 'boss');
    const room = roomOf(s), boss = room.enemies.find((e) => e.kind === 'boss');
    s.player.hp = s.player.max = 99;
    Object.assign(s.player, { x: 4.5, y: 8.5, ang: 0 });
    s.camSnap = true;
    boss.hp = Math.round(boss.max * 0.7);
    boss.cd = 0;
    s.visited = [s.at];
    for (let i = 0; i < 30; i++) window.D.step(1 / 60, false);
    (await import('/js/fx.js')).fx.clear();
    window.D.step(1 / 60, true);
  });
  await page.screenshot({ path: `${OUT}/pecio-boss.png` });
  console.log(`✔ ${OUT}/pecio-boss.png`);
  await page.evaluate(() => { window.G.manual = false; document.getElementById('pcPause').click(); document.getElementById('btnQuit').click(); });

  // Modificadores con algunos activos
  await page.evaluate(async () => {
    const { save } = await import('/js/save.js');
    Object.assign(save, { xp: 40000, modsLast: ['turbo', 'mines', 'glass'] });
    document.getElementById('btnMods').click();
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/modifiers.png` });
  console.log(`✔ ${OUT}/modifiers.png`);
  await page.evaluate(() => document.querySelector('#mods .scr-back').click());

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
