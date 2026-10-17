// Cartas de mejora, sinergias y naves. Las cartas cambian REGLAS, no solo números.
import { MAX_SHIELDS, addShields, shieldCap } from './state.js';
import { STACKS, stackValue, vampireNeed } from './balance.js';
import { makeRng } from './rng.js';

export const VAMPIRE_NEAR = 12; // near-miss por escudo de Vampiro

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
    hitInvuln: 0.45,    // invulnerabilidad tras perder un escudo
  };
}

export const RARITY = {
  common: { name: 'COMÚN', color: '#5ac8fa', w: 60 },
  rare: { name: 'RARA', color: '#bf5af2', w: 30 },
  epic: { name: 'ÉPICA', color: '#ff9f0a', w: 10 },
};

export const CARDS = [
  { id: 'iman', name: 'Imán', icon: '🧲', rarity: 'common', max: 3, desc: 'Atrae las monedas cercanas. Se acumula.', apply: (r) => { r.stats.magnet += 1; } },
  { id: 'carga', name: 'Doble carga', icon: '⚡', rarity: 'rare', max: 1, desc: '+1 carga de DASH.', apply: (r) => { r.stats.dashMax += 1; r.dashCharges += 1; } },
  { id: 'escudo', name: 'Escudo', icon: '🛡️', rarity: 'rare', max: 2, desc: `Aguanta 1 golpe (máximo ${MAX_SHIELDS} escudos).`, apply: (r) => { addShields(r, 1); } },
  { id: 'reflejos', name: 'Reflejos', icon: '👁️', rarity: 'common', max: 3, desc: 'Ventana de near-miss más grande y cámara lenta más larga.', apply: (r) => { r.stats.nearWin += 0.35; } },
  { id: 'adrenalina', name: 'Adrenalina', icon: '💉', rarity: 'rare', max: 1, desc: 'Cada near-miss recarga un cuarto de carga de DASH.', apply: (r) => { r.stats.nearDash = true; } },
  { id: 'terremoto', name: 'Terremoto', icon: '🌋', rarity: 'rare', max: 1, desc: 'Al aterrizar de un salto destruyes lo que tengas delante en tu carril.', apply: (r) => { r.stats.quake = true; } },
  { id: 'doble', name: 'Salto doble', icon: '🦘', rarity: 'rare', max: 1, desc: 'Salta otra vez en el aire. Bien medido, ¡pasas por encima de los muros!', apply: (r) => { r.stats.doubleJump = true; } },
  { id: 'ancho', name: 'Dash ancho', icon: '💥', rarity: 'rare', max: 1, desc: 'Tu DASH destruye obstáculos en los 3 carriles.', apply: (r) => { r.stats.wideDash = true; } },
  { id: 'explosivo', name: 'Explosivo', icon: '🧨', rarity: 'epic', max: 1, desc: 'Lo que rompes explota y arrasa todo lo cercano en cadena.', apply: (r) => { r.stats.explosive = true; } },
  { id: 'odplus', name: 'Overdrive+', icon: '🔥', rarity: 'common', max: 3, desc: 'El OVERDRIVE dura +2 s.', descN: (n) => `El OVERDRIVE dura +${String(stackValue(STACKS.odplus, n)).replace('.', ',')} s.`, apply: (r) => { r.stats.odDur += stackValue(STACKS.odplus, r.cards.odplus); } },
  { id: 'cargador', name: 'Cargador', icon: '🔋', rarity: 'common', max: 3, desc: 'El OVERDRIVE se llena un 35% más rápido.', descN: (n) => `El OVERDRIVE se llena un ${Math.round(stackValue(STACKS.cargador, n) * 100)}% más rápido.`, apply: (r) => { r.stats.odRate += stackValue(STACKS.cargador, r.cards.cargador); } },
  { id: 'oro', name: 'Monedas de oro', icon: '🪙', rarity: 'common', max: 3, desc: 'Cada moneda vale +1.', apply: (r) => { r.stats.coinValue += 1; } },
  { id: 'cristal', name: 'Pacto de cristal', icon: '💎', rarity: 'epic', max: 1, desc: 'x3 PUNTOS… pero pierdes un carril para siempre.', apply: (r) => { r.stats.scoreMult *= 3; r.blockedLane = r.player.lane === 1 ? -1 : 1; } },
  { id: 'nitro', name: 'Nitro loco', icon: '🚀', rarity: 'epic', max: 1, desc: '+50% de velocidad y x2 PUNTOS.', apply: (r) => { r.stats.speedMult *= 1.5; r.stats.scoreMult *= 2; } },
  { id: 'vampiro', name: 'Vampiro', icon: '🧛', rarity: 'rare', max: 1, desc: `Ganas un escudo a los ${vampireNeed(0)} near-miss; cada uno siguiente pide ${vampireNeed(1) - vampireNeed(0)} más.`, apply: (r) => { r.stats.vampire = true; } },
  { id: 'seguro', name: 'Seguro de combo', icon: '🧷', rarity: 'common', max: 1, desc: 'Perder un escudo no reinicia tu combo.', apply: (r) => { r.stats.insurance = true; } },
  { id: 'recarga', name: 'Recarga rápida', icon: '⏱️', rarity: 'common', max: 3, desc: 'El DASH recarga un 20% más rápido.', descN: (n) => `El DASH recarga un ${Math.round((1 - stackValue(STACKS.recarga, n)) * 100)}% más rápido.`, apply: (r) => { r.stats.dashRecharge *= stackValue(STACKS.recarga, r.cards.recarga); } },
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

// Cartas que se pueden ofrecer ahora mismo (sin tirar del RNG).
export function availableCards(run, minRarity = null) {
  return CARDS.filter((c) => (run.cards[c.id] || 0) < c.max)
    .filter((c) => !(c.id === 'cristal' && run.blockedLane !== null))
    .filter((c) => !(c.id === 'escudo' && run.shields >= shieldCap(run))) // con escudos llenos sería una carta muerta
    .filter((c) => !(run.noDash && ['carga', 'ancho', 'recarga'].includes(c.id))) // sin DASH, sus cartas no sirven
    .filter((c) => !minRarity || (minRarity === 'rare' ? c.rarity !== 'common' : c.rarity === 'epic'));
}

export function offerCards(run, n = 3, minRarity = null) {
  const avail = availableCards(run, minRarity);
  const pool = avail.map((c) => ({ c, w: RARITY[c.rarity].w * (c.rarity === 'common' ? 1 : run.luck || 1) }));
  const out = [];
  while (out.length < n && pool.length) {
    const pick = (run.lootRng || run.rng).weighted(pool);
    out.push(pick.c);
    pool.splice(pool.indexOf(pick), 1);
  }
  return out;
}

export const SHIPS = [
  { id: 'viper', name: 'Viper', cost: 0, color: '#00e5ff', ability: 'overclock', desc: 'Equilibrada. La de siempre.', apply: () => {} },
  { id: 'brick', name: 'Brick', cost: 60, color: '#ffd60a', ability: 'ram', desc: 'Empieza con 2 escudos, pero cambia de carril más lento.', apply: (r) => { addShields(r, 2); r.stats.laneTime *= 1.3; } },
  { id: 'ghost', name: 'Ghost', cost: 150, color: '#e0e0ff', ability: 'phase', desc: 'Ventana de near-miss enorme y DASH que recarga rápido.', apply: (r) => { r.stats.nearWin += 0.5; r.stats.dashRecharge *= 0.7; } },
  { id: 'nova', name: 'Nova', cost: 300, color: '#ff375f', ability: 'nova', desc: 'OVERDRIVE se llena un 20% más rápido y dura +1 s.', apply: (r) => { r.stats.odRate += 0.2; r.stats.odDur += 1; } },
  { id: 'kaiju', name: 'Kaiju', cost: 500, color: '#30d158', ability: 'roar', desc: 'Empieza con Dash ancho y Explosivo (¡BULLDOZER!), pero x0.7 puntos.', apply: (r) => { applyCard(r, 'ancho'); applyCard(r, 'explosivo'); r.stats.scoreMult *= 0.7; } },
  { id: 'raptor', name: 'Raptor', cost: 400, color: '#ff9f0a', ability: 'laser', desc: 'Nerviosa: cambia de carril un 20% más rápido y su DASH recarga antes.', apply: (r) => { r.stats.laneTime *= 0.8; r.stats.dashRecharge *= 0.85; } },
  { id: 'comet', name: 'Comet', cost: 650, color: '#bf5af2', ability: 'hook', desc: 'Cazatesoros: cada moneda vale +1 y el imán viene de serie, pero el OVERDRIVE carga un 20% más lento.', apply: (r) => { r.stats.coinValue += 1; r.stats.magnet += 1; r.stats.odRate -= 0.2; } },
  { id: 'manta', name: 'Manta', cost: 800, color: '#64d2ff', ability: 'bubble', desc: 'Planea: ventana de near-miss algo mayor y +20% de invulnerabilidad tras un golpe.', apply: (r) => { r.stats.nearWin += 0.15; r.stats.hitInvuln *= 1.2; } },
  { id: 'spectra', name: 'Spectra', cost: 950, color: '#ffe600', ability: 'blink', desc: 'Rayo: cambia de carril un 15% más rápido y puntúa x1.1, pero su DASH recarga más lento.', apply: (r) => { r.stats.laneTime *= 0.85; r.stats.scoreMult *= 1.1; r.stats.dashRecharge *= 1.2; } },
  { id: 'titan', name: 'Titán', cost: 1100, color: '#ff6b3d', ability: 'hammer', desc: 'Fortaleza: empieza con 1 escudo y más invulnerabilidad tras un golpe, pero x0.85 puntos.', apply: (r) => { addShields(r, 1); r.stats.hitInvuln *= 1.4; r.stats.scoreMult *= 0.85; } },
];

export const META = [
  { id: 'shield', name: 'Escudo inicial', icon: '🛡️', cost: 80, desc: 'Empiezas cada partida con 1 escudo.' },
  { id: 'card', name: 'Carta inicial', icon: '🃏', cost: 120, desc: 'Eliges una carta al empezar cada partida.' },
];

// ---------- Árbol de mejoras por nave (hangar) ----------
// 3 ramas x 3 niveles. Se compran en orden con gemas. A y B son comunes a todas las naves;
// C mejora la habilidad propia de cada nave y su nivel 3 la MUTA.
export const TREE_COSTS = { a: [40, 90, 180], b: [40, 90, 180], c: [60, 130, 260] };

const TREE_A = { name: 'BLINDAJE', icon: '🛡️', nodes: ['+1 escudo al empezar', '+50% de invulnerabilidad tras perder un escudo', 'ÚLTIMO ALIENTO: sobrevives una vez a un golpe sin escudos'] };
const TREE_B = { name: 'MOTOR', icon: '⚙️', nodes: ['Cambias de carril un 10% más rápido', '+1 carga de DASH', 'OVERDRIVE: +20% de carga y +1 s'] };

// nivel 2 y mutación (nivel 3) de la rama de cada habilidad
export const ABILITY_TREE = {
  overclock: { lvl2: '+30% de duración', mut: 'chain', lvl3: 'Cada near-miss alarga la SOBRECARGA 0,3 s' },
  ram: { lvl2: '+30% de duración', mut: 'recharge', lvl3: 'Cada rotura con el ARIETE recarga 1 s' },
  phase: { lvl2: '+30% de duración', mut: 'wave', lvl3: 'Al salir de FASE, una onda rompe lo cercano' },
  nova: { lvl2: '+30% de alcance', mut: 'full', lvl3: 'ESTALLIDO carga un 25% de OVERDRIVE' },
  roar: { lvl2: '+30% de alcance', mut: 'shield', lvl3: 'RUGIDO te da 1 escudo' },
  laser: { lvl2: 'Atraviesa 2 obstáculos', mut: 'triple', lvl3: 'Dispara en los 3 carriles' },
  hook: { lvl2: '0,6 s invulnerable al llegar', mut: 'trail', lvl3: 'El GANCHO arrasa lo que tienes delante' },
  bubble: { lvl2: '+30% de duración', mut: 'pop', lvl3: 'Al estallar, la BURBUJA arrasa lo cercano' },
  blink: { lvl2: '+30% de distancia', mut: 'land', lvl3: 'Al aparecer, rompes lo que tienes delante' },
  hammer: { lvl2: '+30% de alcance', mut: 'triple', lvl3: 'El MARTILLO golpea los 3 carriles' },
};

export const emptyLvls = () => ({ a: 0, b: 0, c: 0 });
export const shipLvls = (map, shipId) => ({ ...emptyLvls(), ...(map && map[shipId]) });

// Descripción completa del árbol de una nave (para el hangar)
export function treeOf(ship, abilityName, abilityIcon) {
  const t = ABILITY_TREE[ship.ability];
  const branch = (key, def) => ({ key, name: def.name, icon: def.icon, nodes: def.nodes.map((desc, i) => ({ desc, cost: TREE_COSTS[key][i] })) });
  return [
    branch('a', TREE_A),
    branch('b', TREE_B),
    branch('c', { name: abilityName, icon: abilityIcon, nodes: ['Recarga −15%', t.lvl2, t.lvl3] }),
  ];
}

// Precio del siguiente nivel de una rama (null si está al máximo)
export const treeCost = (branch, lvl) => (lvl >= 3 ? null : TREE_COSTS[branch][lvl]);

// Aplica las ramas A y B a una partida (la C se aplica a la habilidad con abilityMods)
export function applyShipTree(r, lvls) {
  if (lvls.a >= 1) addShields(r, 1);
  if (lvls.a >= 2) r.stats.hitInvuln *= 1.5;
  if (lvls.a >= 3) r.lastStand = true;
  if (lvls.b >= 1) r.stats.laneTime *= 0.9;
  if (lvls.b >= 2) r.stats.dashMax += 1;
  if (lvls.b >= 3) { r.stats.odRate += 0.2; r.stats.odDur += 1; }
}

export function abilityMods(ship, lvls) {
  return {
    cd: lvls.c >= 1 ? 0.85 : 1,
    dur: lvls.c >= 2 ? 1.3 : 1,
    pow: lvls.c >= 2 ? 1.3 : 1,
    mut: lvls.c >= 3 ? ABILITY_TREE[ship.ability].mut : null,
  };
}

// Perfil de 6 barras (0..1) de una nave con su árbol, calculado APLICANDO las reglas reales a una
// partida simulada: así las barras del hangar nunca se desfasan de lo que de verdad hace la nave.
export const PROFILE_KEYS = ['VELOCIDAD', 'AGILIDAD', 'DASH', 'OVERDRIVE', 'DEFENSA', 'PUNTOS'];

export function shipProfile(shipId, lvls = emptyLvls()) {
  const ship = SHIPS.find((s) => s.id === shipId);
  const r = {
    rng: makeRng(1), stats: baseStats(), cards: {}, synergies: new Set(),
    shields: 0, dashCharges: 1, blockedLane: null, luck: 1, player: { lane: 0 }, lastStand: false,
  };
  ship.apply(r);
  applyShipTree(r, lvls);
  const s = r.stats;
  const k = (v) => Math.max(0, Math.min(1, v));
  return {
    VELOCIDAD: k((s.speedMult - 0.8) / 1.2),
    AGILIDAD: k((0.16 - s.laneTime) / 0.1),
    DASH: k((s.dashMax * (4.5 / s.dashRecharge)) / 4 + (s.wideDash ? 0.25 : 0)),
    OVERDRIVE: k((s.odRate * s.odDur) / 20),
    DEFENSA: k((r.shields + (r.lastStand ? 1 : 0) + (s.hitInvuln / 0.45 - 1)) / 4),
    PUNTOS: k((s.scoreMult * (1 + (s.coinValue - 1) * 0.3)) / 2.5),
  };
}
