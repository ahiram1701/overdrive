// Cartas de mejora, sinergias y naves. Las cartas cambian REGLAS, no solo números.

export function baseStats() {
  return {
    laneTime: 0.11,     // tiempo de cambio de carril
    jumpV: 9.6,
    gravity: 30,
    dashMax: 1,
    dashRecharge: 4.5,  // segundos por carga
    dashDur: 0.38,
    magnet: 0,
    scoreMult: 1,
    odRate: 1,
    odDur: 6,
    nearWin: 1,
    speedMult: 1,
    coinValue: 1,
    doubleJump: false,
    nearDash: false,
    quake: false,
    wideDash: false,
    explosive: false,
    vampire: false,
    insurance: false,
  };
}

export const RARITY = {
  common: { name: 'COMÚN', color: '#5ac8fa', w: 60 },
  rare: { name: 'RARA', color: '#bf5af2', w: 30 },
  epic: { name: 'ÉPICA', color: '#ff9f0a', w: 10 },
};

export const CARDS = [
  { id: 'iman', name: 'Imán', icon: '🧲', rarity: 'common', max: 3, desc: 'Atrae las monedas cercanas. Se acumula.', apply: (r) => { r.stats.magnet += 1; } },
  { id: 'carga', name: 'Doble carga', icon: '⚡', rarity: 'rare', max: 2, desc: '+1 carga de DASH.', apply: (r) => { r.stats.dashMax += 1; r.dashCharges += 1; } },
  { id: 'escudo', name: 'Escudo', icon: '🛡️', rarity: 'common', max: 99, desc: 'Aguanta 1 golpe.', apply: (r) => { r.shields += 1; } },
  { id: 'reflejos', name: 'Reflejos', icon: '👁️', rarity: 'common', max: 3, desc: 'Ventana de near-miss más grande y cámara lenta más larga.', apply: (r) => { r.stats.nearWin += 0.35; } },
  { id: 'adrenalina', name: 'Adrenalina', icon: '💉', rarity: 'rare', max: 1, desc: 'Cada near-miss recarga media carga de DASH.', apply: (r) => { r.stats.nearDash = true; } },
  { id: 'terremoto', name: 'Terremoto', icon: '🌋', rarity: 'rare', max: 1, desc: 'Al aterrizar de un salto destruyes lo que tengas delante en tu carril.', apply: (r) => { r.stats.quake = true; } },
  { id: 'doble', name: 'Salto doble', icon: '🦘', rarity: 'rare', max: 1, desc: 'Puedes saltar otra vez en el aire.', apply: (r) => { r.stats.doubleJump = true; } },
  { id: 'ancho', name: 'Dash ancho', icon: '💥', rarity: 'rare', max: 1, desc: 'Tu DASH destruye obstáculos en los 3 carriles.', apply: (r) => { r.stats.wideDash = true; } },
  { id: 'explosivo', name: 'Explosivo', icon: '🧨', rarity: 'epic', max: 1, desc: 'Lo que rompes explota y arrasa todo lo cercano en cadena.', apply: (r) => { r.stats.explosive = true; } },
  { id: 'odplus', name: 'Overdrive+', icon: '🔥', rarity: 'common', max: 3, desc: 'El OVERDRIVE dura +2 s.', apply: (r) => { r.stats.odDur += 2; } },
  { id: 'cargador', name: 'Cargador', icon: '🔋', rarity: 'common', max: 3, desc: 'El OVERDRIVE se llena un 35% más rápido.', apply: (r) => { r.stats.odRate += 0.35; } },
  { id: 'oro', name: 'Monedas de oro', icon: '🪙', rarity: 'common', max: 3, desc: 'Cada moneda vale +1.', apply: (r) => { r.stats.coinValue += 1; } },
  { id: 'cristal', name: 'Pacto de cristal', icon: '💎', rarity: 'epic', max: 1, desc: 'x3 PUNTOS… pero pierdes un carril para siempre.', apply: (r) => { r.stats.scoreMult *= 3; r.blockedLane = r.player.lane === 1 ? -1 : 1; } },
  { id: 'nitro', name: 'Nitro loco', icon: '🚀', rarity: 'epic', max: 1, desc: '+50% de velocidad y x2 PUNTOS.', apply: (r) => { r.stats.speedMult *= 1.5; r.stats.scoreMult *= 2; } },
  { id: 'vampiro', name: 'Vampiro', icon: '🧛', rarity: 'rare', max: 1, desc: 'Cada 25 de combo ganas un escudo.', apply: (r) => { r.stats.vampire = true; } },
  { id: 'seguro', name: 'Seguro de combo', icon: '🧷', rarity: 'common', max: 1, desc: 'Perder un escudo no reinicia tu combo.', apply: (r) => { r.stats.insurance = true; } },
  { id: 'recarga', name: 'Recarga rápida', icon: '⏱️', rarity: 'common', max: 3, desc: 'El DASH recarga un 25% más rápido.', apply: (r) => { r.stats.dashRecharge *= 0.75; } },
  { id: 'agil', name: 'Ágil', icon: '🪶', rarity: 'common', max: 2, desc: 'Cambias de carril y saltas más rápido.', apply: (r) => { r.stats.laneTime *= 0.75; r.stats.gravity *= 1.12; r.stats.jumpV *= 1.06; } },
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

export const SYNERGIES = [
  { id: 'supernova', name: 'SUPERNOVA', needs: ['iman', 'odplus'], desc: 'En OVERDRIVE las monedas valen x3 y el imán es gigante.' },
  { id: 'bulldozer', name: 'BULLDOZER', needs: ['explosivo', 'ancho'], desc: 'DASH +50% de duración y recarga un 30% más rápido.', apply: (r) => { r.stats.dashDur *= 1.5; r.stats.dashRecharge *= 0.7; } },
  { id: 'zen', name: 'ZEN', needs: ['reflejos', 'adrenalina'], desc: 'Los near-miss PERFECTOS cargan un 15% extra de OVERDRIVE.' },
  { id: 'meteoro', name: 'METEORO', needs: ['doble', 'terremoto'], desc: 'Terremoto con doble alcance y +500 puntos por golpe.' },
  { id: 'kamikaze', name: 'KAMIKAZE', needs: ['cristal', 'nitro'], desc: 'x2 PUNTOS extra. Sí, otra vez.', apply: (r) => { r.stats.scoreMult *= 2; } },
  { id: 'sangre', name: 'SANGRE DORADA', needs: ['vampiro', 'oro'], desc: 'Cada moneda suma combo extra.' },
];

// Devuelve las sinergias nuevas que se activan.
export function checkSynergies(run) {
  const fresh = [];
  for (const s of SYNERGIES) {
    if (run.synergies.has(s.id)) continue;
    if (s.needs.every((id) => run.cards[id])) {
      run.synergies.add(s.id);
      s.apply?.(run);
      fresh.push(s);
    }
  }
  return fresh;
}

export function synergyHint(run, cardId) {
  for (const s of SYNERGIES) {
    if (run.synergies.has(s.id) || !s.needs.includes(cardId)) continue;
    if (s.needs.every((id) => id === cardId || run.cards[id])) return s.name;
  }
  return null;
}

export function applyCard(run, id) {
  const c = CARD_BY_ID[id];
  run.cards[id] = (run.cards[id] || 0) + 1;
  c.apply(run);
  return checkSynergies(run);
}

export function offerCards(run, n = 3, minRarity = null) {
  const avail = CARDS.filter((c) => (run.cards[c.id] || 0) < c.max)
    .filter((c) => !(c.id === 'cristal' && run.blockedLane !== null))
    .filter((c) => !minRarity || (minRarity === 'rare' ? c.rarity !== 'common' : c.rarity === 'epic'));
  const pool = avail.map((c) => ({ c, w: RARITY[c.rarity].w * (c.rarity === 'common' ? 1 : run.luck || 1) }));
  const out = [];
  while (out.length < n && pool.length) {
    const pick = run.rng.weighted(pool);
    out.push(pick.c);
    pool.splice(pool.indexOf(pick), 1);
  }
  return out;
}

export const SHIPS = [
  { id: 'viper', name: 'Viper', cost: 0, color: '#00e5ff', desc: 'Equilibrada. La de siempre.', apply: () => {} },
  { id: 'brick', name: 'Brick', cost: 60, color: '#ffd60a', desc: 'Empieza con 2 escudos, pero cambia de carril más lento.', apply: (r) => { r.shields += 2; r.stats.laneTime *= 1.3; } },
  { id: 'ghost', name: 'Ghost', cost: 150, color: '#e0e0ff', desc: 'Ventana de near-miss enorme y DASH que recarga rápido.', apply: (r) => { r.stats.nearWin += 0.5; r.stats.dashRecharge *= 0.7; } },
  { id: 'nova', name: 'Nova', cost: 300, color: '#ff375f', desc: 'OVERDRIVE se llena un 60% más rápido y dura +2 s.', apply: (r) => { r.stats.odRate += 0.6; r.stats.odDur += 2; } },
  { id: 'kaiju', name: 'Kaiju', cost: 500, color: '#30d158', desc: 'Empieza con Dash ancho y Explosivo (¡BULLDOZER!), pero x0.7 puntos.', apply: (r) => { applyCard(r, 'ancho'); applyCard(r, 'explosivo'); r.stats.scoreMult *= 0.7; } },
];

export const META = [
  { id: 'shield', name: 'Escudo inicial', icon: '🛡️', cost: 80, desc: 'Empiezas cada partida con 1 escudo.' },
  { id: 'card', name: 'Carta inicial', icon: '🃏', cost: 120, desc: 'Eliges una carta al empezar cada partida.' },
];
