// GALAXIA · TRÁFICO: el sistema no está vacío. Cargueros, mineros y patrullas van y vienen entre la estación,
// los planetas, el cinturón y las puertas (y SALTAN: desaparecen en la puerta y otros llegan por ella).
// Las patrullas de tu lado atacan a los piratas que tengan cerca. Con un carguero cerca puedes SALUDAR:
// te cuenta dónde pagan bien (un chivatazo de precios). Puro salvo el azar (rng).
const v = (x, y, z) => ({ x, y, z });
const sub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);
const len = (a) => Math.hypot(a.x, a.y, a.z);

export const TRAFFIC_KINDS = {
  trader: { name: 'Carguero', icon: '🚚', mesh: 'brick', size: 9, speed: 55, pal: { hull: '#0b2a14', edge: '#ffe600', glow: '#30d158' } },
  miner: { name: 'Minero', icon: '⛏️', mesh: 'titan', size: 7, speed: 45, pal: { hull: '#1a1400', edge: '#ffd60a', glow: '#ff9f0a' } },
  patrol: { name: 'Patrulla', icon: '🛡️', mesh: 'spectra', size: 6, speed: 110, pal: { hull: '#00141a', edge: '#7df9ff', glow: '#0a84ff' } },
  smuggler: { name: 'Contrabandista', icon: '🕶️', mesh: 'raptor', size: 6, speed: 95, pal: { hull: '#140014', edge: '#bf5af2', glow: '#ff2bd6' } },
};
const CAPTAINS = ['Vega', 'Orsa', 'Kael', 'Nadia', 'Bruno', 'Ixe', 'Tamsin', 'Rook', 'Luma', 'Sorel', 'Petra', 'Dax', 'Yara', 'Corvo', 'Mila', 'Fenn'];

// cuántos y cuáles según quién manda y el peligro (en un sistema pirata: contrabandistas y poco más)
export function trafficMix(owner, danger) {
  if (owner === 'pir') return ['smuggler', 'smuggler', 'miner'];
  const n = Math.max(2, 6 - Math.floor(danger / 2));
  const out = [];
  for (let i = 0; i < n; i++) out.push(i % 3 === 2 ? 'patrol' : i % 2 ? 'miner' : 'trader');
  return out;
}
// lugares a los que va el tráfico
export function waypoints(sys) {
  const out = [{ kind: 'station', pos: sys.station.pos }];
  for (const p of sys.planets) out.push({ kind: 'planet', pos: v(p.pos.x + p.r + 80, p.pos.y, p.pos.z) });
  for (const g of sys.gates) out.push({ kind: 'gate', pos: g.pos });
  out.push({ kind: 'belt', pos: v(sys.beltR, 0, 0) }, { kind: 'belt', pos: v(-sys.beltR, 0, 0) });
  return out;
}
function pickTarget(rng, wps, kind, from) {
  const pool = wps.filter((w) => w.pos !== from && (kind === 'miner' ? w.kind !== 'planet' : kind === 'patrol' ? true : w.kind !== 'belt'));
  return rng.pick(pool.length ? pool : wps);
}
export function spawnTraffic(rng, sys, owner, danger) {
  const wps = waypoints(sys);
  return trafficMix(owner, danger).map((kind, i) => {
    const at = rng.pick(wps).pos, to = pickTarget(rng, wps, kind, at);
    return { id: i, kind, name: `${TRAFFIC_KINDS[kind].name} ${rng.pick(CAPTAINS)}`, pos: v(at.x + rng.range(-200, 200), at.y + rng.range(-40, 40), at.z + rng.range(-200, 200)), to, yaw: 0, wait: rng.range(0, 3), cd: 0, hailed: false, away: 0 };
  });
}
// un paso: se mueven, esperan un poco en cada sitio, saltan por las puertas y las patrullas disparan.
// pirates: [{ pos, alive }]; shoot(npc, pirate) aplica el daño; devuelve los disparos para dibujarlos
export function updateTraffic(rng, sys, list, pirates, dt, shoot) {
  const wps = waypoints(sys), shots = [];
  for (const n of list) {
    const K = TRAFFIC_KINDS[n.kind];
    if (n.away > 0) { // saltó: vuelve más tarde por otra puerta
      n.away -= dt;
      if (n.away <= 0) { const g = rng.pick(sys.gates.length ? sys.gates : [{ pos: sys.station.pos }]); n.pos = { ...g.pos }; n.to = pickTarget(rng, wps, n.kind, g.pos); n.hailed = false; }
      continue;
    }
    // PATRULLA: si hay un pirata cerca, va a por él y le dispara
    let target = null;
    if (n.kind === 'patrol') {
      let bd = 700;
      for (const p of pirates) { if (!p.alive) continue; const d = len(sub(p.pos, n.pos)); if (d < bd) { bd = d; target = p; } }
    }
    const goal = target ? target.pos : n.to.pos, dv = sub(goal, n.pos), d = len(dv);
    if (target) {
      n.cd -= dt;
      if (d < 420 && n.cd <= 0) { n.cd = 0.9; shoot(n, target); shots.push({ from: { ...n.pos }, to: { ...target.pos } }); }
    }
    if (!target && d < 60) {
      if (n.wait > 0) { n.wait -= dt; continue; }
      if (n.to.kind === 'gate') { n.away = rng.range(6, 16); continue; } // ¡salta!
      n.to = pickTarget(rng, wps, n.kind, n.to.pos);
      n.wait = rng.range(1.5, 5);
      continue;
    }
    if (target && d < 180) continue; // no se le echa encima
    const k = Math.min(1, (K.speed * dt) / Math.max(1, d));
    n.pos = v(n.pos.x + dv.x * k, n.pos.y + dv.y * k, n.pos.z + dv.z * k);
    n.yaw = Math.atan2(dv.x, dv.z);
  }
  return shots;
}
// SALUDAR a un carguero: un chivatazo con el mejor precio que conoce para lo que llevas (o para algo)
export function rumor(prices, cargo, names) {
  const own = Object.entries(cargo || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const ore = own[0] || Object.keys(prices[0]?.p || {})[0];
  if (!ore || !prices.length) return null;
  const best = [...prices].sort((a, b) => b.p[ore] - a.p[ore])[0];
  return { ore, sys: best.id, name: names[best.id], price: best.p[ore] };
}
