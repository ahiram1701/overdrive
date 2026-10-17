// Bot de la galaxia (se ejecuta en la página con page.evaluate, autocontenido).
// Vira hacia su objetivo como lo haría un jugador con el dedo: mina el asteroide más cercano hasta
// llenar la bodega y vuelve a la estación a atracar.
export function spaceBotInPage({ seconds, until = 'dock', fill = 0.6 }) {
  const G = window.G, D = window.D;
  let t = 0;
  while (t < seconds) {
    if (G.mode !== 'galaxy') break;
    const s = G.space, sh = s.ship, g = window.__save.galaxy;
    const n = Object.values(g.cargo).reduce((a, b) => a + b, 0);
    const cap = window.__spaceStats().cargo;
    const goHome = n >= cap * fill;
    if (goHome && until === 'dock' && s.canDock) {
      document.getElementById('btnDock').click();
      break;
    }
    let target = null;
    if (goHome) target = s.sys.station.pos;
    else {
      let bd = Infinity;
      for (const a of s.sys.asteroids) {
        const d = Math.hypot(a.pos.x - sh.pos.x, a.pos.y - sh.pos.y, a.pos.z - sh.pos.z);
        if (d < bd) { bd = d; target = a.pos; }
      }
      // si hay mineral suelto cerca, ir a por él
      for (const o of s.ores) {
        const d = Math.hypot(o.pos.x - sh.pos.x, o.pos.y - sh.pos.y, o.pos.z - sh.pos.z);
        if (d < 120) { target = o.pos; break; }
      }
    }
    const dx = target.x - sh.pos.x, dy = target.y - sh.pos.y, dz = target.z - sh.pos.z;
    // como un jugador: el objetivo visto desde la nave (derecha/arriba/delante en SUS ejes)
    const d3 = { x: dx, y: dy, z: dz };
    const loc = (v) => d3.x * v.x + d3.y * v.y + d3.z * v.z;
    const lx = loc(sh.r), ly = loc(sh.u), lz = loc(sh.f);
    const dyaw = Math.atan2(lx, lz), dp = Math.atan2(ly, Math.hypot(lx, lz));
    s.botInput = { x: Math.max(-1, Math.min(1, dyaw * 3)), y: Math.max(-1, Math.min(1, -dp * 3)) };
    const dist = Math.hypot(dx, dy, dz);
    s.botFire = !goHome && Math.abs(dyaw) < 0.25 && Math.abs(dp) < 0.25 && dist < 650;
    D.step(1 / 30, false);
    t += 1 / 30;
  }
  const s = G.space;
  return { mode: G.mode, t, cargo: Object.values(window.__save.galaxy.cargo).reduce((a, b) => a + b, 0), hull: s?.ship.hull, credits: window.__save.galaxy.credits };
}
