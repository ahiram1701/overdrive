import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers.js';

async function start(page, url = '/?debug&nosw&seed=7') {
  await page.goto(url);
  await page.waitForFunction(() => !!window.G);
  await page.evaluate(() => { window.G.manual = true; document.getElementById('btnPlay').click(); });
  await page.waitForFunction(() => window.G.mode === 'play');
}

test('tocar un núcleo del jefe SIN dash le hace daño; con dash, doble', async ({ page }) => {
  const errors = trackErrors(page);
  await start(page, '/?debug&nosw&seed=7&start=3&boss=gusano');
  const res = await page.evaluate(async () => {
    const G = window.G, r = G.run, p = G.player;
    const { onCore } = await import('/js/game.js');
    // un núcleo justo en tu carril, sin dash ni overdrive
    for (let i = 0; i < 60; i++) window.D.step(1 / 60, false);
    const hp0 = r.boss.hp;
    p.dash = 0; r.odTime = 0;
    r.objects.push({ type: 'core', lane: p.lane, x: p.x, z: r.dist + 0.5, w: 0.8, y0: 0, y1: 1.2, depth: 0.8, alive: true, rzPrev: Infinity, t: 0, vz: 0, y: 0.3 });
    for (let i = 0; i < 10; i++) window.D.step(1 / 60, false);
    const hp1 = r.boss.hp;
    onCore({ alive: true, shield: false }, true); // con DASH
    return { hp0, hp1, hp2: r.boss.hp };
  });
  expect(res.hp1).toBe(res.hp0 - 1);
  expect(res.hp2).toBe(res.hp1 - 2);
  expect(errors).toEqual([]);
});

test('el núcleo blindado sin dash no cede (y avisa)', async ({ page }) => {
  await start(page, '/?debug&nosw&seed=7&start=3&boss=censor');
  const res = await page.evaluate(async () => {
    const r = window.G.run;
    for (let i = 0; i < 30; i++) window.D.step(1 / 60, false);
    const { onCore } = await import('/js/game.js');
    const hp0 = r.boss.hp;
    const core = { alive: true, shield: true };
    onCore(core, false);
    const hp1 = r.boss.hp;
    onCore(core, true);
    return { hp0, hp1, hp2: r.boss.hp, alive: core.alive };
  });
  expect(res.hp1).toBe(res.hp0);
  expect(res.hp2).toBe(res.hp0 - 2);
  expect(res.alive).toBe(false);
});

test('salto doble: suma impulso y pasa por encima de un muro', async ({ page }) => {
  const errors = trackErrors(page);
  await start(page);
  const res = await page.evaluate(async () => {
    const G = window.G, r = G.run, p = G.player;
    const { pickCard } = await import('/js/game.js');
    pickCard('doble');
    for (let i = 0; i < 30; i++) window.D.step(1 / 60, false);
    // limpiar la pista cercana para medir solo el salto
    for (const o of r.objects) if (o.z - r.dist < 60) o.alive = false;
    const key = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    key('ArrowUp');
    window.D.step(0.05, false);
    key('ArrowUp'); // doble salto pronto: antes casi no se notaba
    let peak = 0;
    for (let i = 0; i < 40; i++) { window.D.step(1 / 60, false); peak = Math.max(peak, p.y); }
    // y un muro por debajo: no golpea
    const hits = (G.hits || []).length;
    r.objects.push({ type: 'wall', lane: p.lane, x: p.x, z: r.dist + 0.3, w: 0.9, y0: 0, y1: 99, depth: 0.8, alive: true, rzPrev: Infinity, t: 0, vz: 0, y: 0, need: 'lane' });
    const shields = r.shields;
    p.y = Math.max(p.y, 2.2);
    for (let i = 0; i < 6; i++) window.D.step(1 / 60, false);
    return { peak, hits: (G.hits || []).length - hits, mode: G.mode, shields, shieldsAfter: r.shields };
  });
  expect(res.peak).toBeGreaterThan(1.9);
  expect(res.hits).toBe(0);
  expect(res.mode).toBe('play');
  expect(res.shieldsAfter).toBe(res.shields);
  expect(errors).toEqual([]);
});

// iPhone: Safari descoloca los textos centrados con emojis (empiezan en el centro y se salen por la derecha).
// textfix.js los alinea "a mano" en todo el juego; aquí se comprueba que está puesto y que centra bien.
test('textos centrados con emojis: el arreglo para iPhone está activo y centra de verdad', async ({ page }) => {
  await page.goto('/?debug&nosw');
  await page.waitForFunction(() => !!window.G);
  const r = await page.evaluate(() => {
    const cv = document.createElement('canvas');
    cv.width = 400; cv.height = 80;
    const ctx = cv.getContext('2d');
    ctx.font = '900 28px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const res = [];
    for (const [str, align, x] of [['🛡️ ¡Rebota! Rodea', 'center', 200], ['🏚️ PECIO', 'center', 200], ['🗝️ +1 llave', 'right', 380]]) {
      ctx.clearRect(0, 0, 400, 80);
      ctx.textAlign = align;
      ctx.fillStyle = '#fff';
      ctx.fillText(str, x, 40);
      const keep = ctx.textAlign; // se restaura tras dibujar
      // dónde hay tinta
      const d = ctx.getImageData(0, 0, 400, 80).data;
      let l = 400, rr = -1;
      for (let px = 0; px < 400; px++) for (let py = 0; py < 80; py++) if (d[(py * 400 + px) * 4 + 3] > 40) { l = Math.min(l, px); rr = Math.max(rr, px); }
      res.push({ str, align, x, l, r: rr, keep, w: ctx.measureText(str).width });
    }
    return { patched: CanvasRenderingContext2D.prototype.__textfix === true, res, canvas: document.getElementById('game').getBoundingClientRect().toJSON(), W: innerWidth, H: innerHeight };
  });
  expect(r.patched).toBe(true);
  for (const t of r.res) {
    expect(t.keep).toBe(t.align);
    if (t.align === 'center') expect(Math.abs((t.l + t.r) / 2 - t.x)).toBeLessThan(6);
    else expect(Math.abs(t.r - t.x)).toBeLessThan(6);
    expect(t.l).toBeGreaterThan(0); // no se sale por ningún lado
    expect(t.r).toBeLessThan(400);
  }
  // el lienzo cubre toda la pantalla (en iPhone 100vh dejaba una franja abajo)
  expect(Math.round(r.canvas.width)).toBe(r.W);
  expect(Math.round(r.canvas.height)).toBe(r.H);
});
