// Utilidades compartidas por los tests E2E. Las funciones *InPage se ejecutan dentro del navegador
// con page.evaluate, así que deben ser autocontenidas (sin referencias a este módulo).

export function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

export async function startRun(page, { seed, god = false } = {}) {
  await page.goto(`/?debug&nosw${seed != null ? `&seed=${seed}` : ''}`);
  await page.waitForFunction(() => !!window.G);
  // modo manual ANTES de empezar: si no, requestAnimationFrame avanzaría el juego por su cuenta
  // (al arrancar y mientras el bot espera a la UI) y el resultado dependería de la carga de la máquina
  await page.evaluate((god) => { window.G.manual = true; window.G.god = god; }, god);
  await page.locator('#btnPlay').click();
  await page.waitForFunction(() => window.G.mode === 'play');
}

// Bot que esquiva leyendo los obstáculos y pulsando teclas, como haría un jugador.
// Avanza la simulación con D.step(1/60) sin depender de requestAnimationFrame.
export async function botInPage({ seconds, god = false, until = null, ability = false }) {
  const G = window.G, D = window.D;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const key = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
  const solid = { wall: 'lane', mover: 'lane', mine: 'lane', shot: 'lane', barrier: 'jump', laserLow: 'jump', overhead: 'slide', laserHigh: 'slide' };
  // cada obstáculo dice cómo se esquiva (o.need, desde DIM en world.js); la tabla es solo respaldo
  const needOf = (o) => o.need || solid[o.type];
  const visible = (id) => !document.getElementById(id).classList.contains('hidden');
  let t = 0, uses = 0;
  while (t < seconds) {
    if (until === 'boss' && G.run.bosses >= 1) break;
    if (G.mode === 'cards') {
      document.querySelector('#cardRow .card').click();
      while (G.mode === 'cards') await wait(20);
      continue;
    }
    if (G.mode === 'shop') { document.getElementById('btnShopDone').click(); continue; }
    if (G.mode === 'chest') {
      while (!visible('btnChestOk')) await wait(50);
      document.getElementById('btnChestOk').click();
      continue;
    }
    if (G.mode !== 'play') break;

    const r = G.run, p = G.player, inv = r.event?.id === 'invert';
    if (god) p.dash = 0.4;
    const sp = r.speed * (r.odTime > 0 ? 1.5 : 1);
    // tiempo hasta el impacto: los disparos del jefe se acercan más rápido (vz)
    const tti = (o) => (o.z - r.dist) / (sp + (o.vz || 0));
    const inLane = (o, lane) => o.all || Math.abs(o.x - lane) < 0.75;
    const danger = (lane, a, b) => r.objects.filter((o) => o.alive && needOf(o) && inLane(o, lane) && tti(o) > a && tti(o) < b);
    const blocksLane = (lane, a, b) => danger(lane, a, b).some((o) => needOf(o) === 'lane');
    const near = danger(p.lane, 0, 0.4).sort((a, b) => tti(a) - tti(b))[0];
    if (near && p.dash <= 0 && r.odTime <= 0) {
      const need = needOf(near);
      const tt = tti(near);
      if (need === 'lane') {
        // carril libre más cercano; si hay que cruzar uno intermedio, que esté libre ahora
        const target = [-1, 0, 1]
          .filter((l) => l !== p.lane && l !== r.blockedLane && !blocksLane(l, -0.05, 0.5))
          .filter((l) => Math.abs(l - p.lane) === 1 || !blocksLane((l + p.lane) / 2, -0.05, 0.25))
          .sort((a, b) => Math.abs(a - p.lane) - Math.abs(b - p.lane))[0];
        if (target !== undefined) key((target < p.lane) !== inv ? 'ArrowLeft' : 'ArrowRight');
        // sin carril libre: lo bajo (minas, disparos bajos) se salta; si no, DASH
        else if (near.y1 <= 0.55 && !p.air && tt < 0.2) key(inv ? 'ArrowDown' : 'ArrowUp');
        else if (r.dashCharges >= 1 && tt < 0.15) key(' ');
      } else if (need === 'jump' && !p.air && tt < 0.2) key(inv ? 'ArrowDown' : 'ArrowUp');
      else if (need === 'slide' && p.slide <= 0.05 && tt < 0.25) key(inv ? 'ArrowUp' : 'ArrowDown');
    }
    // habilidad: solo en momentos tranquilos (nada que esquivar en 0.7 s en ningún carril),
    // para que el Gancho no lance al bot contra un muro
    if (ability && r.ability.cdLeft <= 0 && r.ability.active <= 0 && [-1, 0, 1].every((l) => !danger(l, -0.05, 0.7).length)) {
      key('e');
      uses++;
    }
    D.step(1 / 60, false);
    t += 1 / 60;
  }
  const r = G.run;
  return {
    t, mode: G.mode, section: r.section, bosses: r.bosses, near: r.nearMisses,
    maxMult: r.maxMult, score: r.score, hits: G.hits || [], uses,
  };
}
