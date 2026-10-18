// Guardado persistente. localStorage puede fallar (modo privado), así que todo va en try/catch.
// La clave de almacenamiento NO cambia entre versiones: el formato se versiona con el campo `v`.
const KEY = 'overdrive-save-v1';
export const SAVE_VERSION = 6;

const reducedMotion = (() => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
})();

const DEFAULTS = {
  v: SAVE_VERSION,
  gems: 0,
  coins: 0,         // 🪙 cartera de RUNNER y ARENA (lo que sobra de cada partida)
  best: 0,
  bestDist: 0,
  daily: { key: '', best: 0 },
  ships: ['viper'],
  ship: 'viper',
  boosts: {},       // potenciadores que tienes { life: 2 }
  boostSel: [],     // los elegidos para la próxima partida (máx. 2)
  talents: {},      // talentos comprados { r1: true }
  treeResets: 0,    // reinicios del árbol hechos (el primero es gratis)
  cardsOwned: {},   // cartas del mazo desbloqueadas { turbo: true }
  cardLvl: {},      // maestría de cada carta (0-3) { iman: 2 }
  arenaWeapons: {}, // armas del arsenal desbloqueadas { twin: true }
  factionRep: {},   // reputación con cada facción { liga: 25 }
  territory: {},    // sistemas piratas liberados y a quién se dieron { 14: 'coal' }
  bounties: {},     // cazarrecompensas { active, done: { id: true }, seq }
  galaxyMats: {},   // materiales { chatarra: 12 }
  galaxyGear: {},   // fabricado y montado { owned: { laser2: true }, w: ['laser2'], m: [] }
  story: {},        // historia LA SEÑAL { ch, n, seen, choice }
  galaxyMarket: {}, // saturación del mercado { sys: { ore: unidades vendidas } }
  galaxyItems: {},  // consumibles de vuelo { repair: 2 }
  tips: {},         // consejos ya vistos { galaxy: true }
  galaxyWorld: {},  // sucesos de la galaxia: ofensiva pirata, enjambre, dueños perdidos, noticias
  outposts: {},     // puestos avanzados { sys: { name, mods: { radar: 2 }, store } }
  crates: { n: 0, pity: 0, owned: [] }, // cofres abiertos, racha sin épico y exclusivos de cofre
  settings: { sound: true, vibe: true, fx: !reducedMotion, text: 'normal', sens: 1, invertY: false, autoLevel: false },
  runs: 0,
  missions: { key: '', list: [] },
  // v2: progreso para la expansión (se reservan ya para no migrar en cada fase)
  xp: 0,
  prestige: 0,      // niveles de prestigio (rango 30 -> vuelta al 1)
  shipLvl: {},      // { viper: { a: 1, b: 0, c: 2 } }
  abilityUses: {},  // { overclock: 12 }
  ach: {},          // logros
  codex: {},        // colección
  cosmetics: {},    // v3, por nave: { owned: { viper: ['ice'] }, equip: { viper: { palette, ... } } }
  shipNames: {},    // { viper: 'Rayo azul' }
  shipStats: {},    // { viper: { runs, sections, bosses } }: desbloquea los exclusivos de cada nave
  campaign: {},     // { '1-1': 3 }
  arena: { best: 0, kills: 0, wins: 0, bossBest: 0, map: 'grid' },
  arenaUp: {},      // taller de la ARENA { hp: 2, reroll: 1 }
  arenaMaps: {},    // { belt: { best: 412, wins: 1 } } récord y victorias de cada mapa de la ARENA
  expedition: { best: 0, wins: 0 },
  // GALAXIA: créditos, mejoras de la nave espacial, carga y progreso
  galaxy: { credits: 0, up: { engine: 0, laser: 0, shield: 0, cargo: 0, jump: 0, missile: 0 }, missiles: 0, jumps: 0, wanted: 0, chassis: 'explorer', hulls: ['explorer'], cargo: { iron: 0, crystal: 0, plasma: 0, dark: 0 }, hull: 100, sold: false, started: false, earned: 0, sys: 0, home: 0, visited: [0], missions: [], boardSeq: 0 },
  galaxyBoss: {},
  galaxyPlanets: {}, // { '3-1': true } planetas ya orbitados (su primera visita paga)
  galaxyAtlas: {},  // { '3-1': true } puntos de interés descubiertos (ATLAS)   // { 12: true } jefes piratas derrotados por sistema
  raceCups: {},     // { c1: 0 } mejor medalla de cada copa (0 oro, 1 plata, 2 bronce)
  raceBest: {},     // { 'c1-1': 48.2 } mejor tiempo de cada pista
  raceTT: {},       // { 'c1-1': 0 } mejor medalla de CONTRARRELOJ de cada pista
  ghosts: {},       // { 'c1-1': { t, d: [[dist, x, y]…] } } tu mejor carrera, para correr contra ella // mejor progreso (acto*10 + fila) y expediciones completadas // mejor tiempo (s), más bajas y victorias en la ARENA
  modsLast: [],     // modificadores elegidos la última vez
  mutation: { key: '', played: false }, // mutación del día: el primer intento da x1,5 gemas
};

// Claves que son MAPAS de contenido libre: se copian enteras. Antes, merge solo copiaba claves
// que ya existían en DEFAULTS, así que { viper: {...} } dentro de un {} vacío se perdía al cargar.
const MAPS = new Set(['shipLvl', 'abilityUses', 'ach', 'codex', 'cosmetics', 'campaign', 'shipStats', 'raceCups', 'raceBest', 'ghosts', 'galaxyBoss', 'galaxyAtlas', 'shipNames', 'galaxyPlanets', 'boosts', 'talents', 'cardsOwned', 'cardLvl', 'arenaWeapons', 'factionRep', 'territory', 'bounties', 'galaxyMats', 'galaxyGear', 'story', 'galaxyMarket', 'galaxyItems', 'outposts', 'arenaMaps', 'arenaUp', 'raceTT', 'galaxyWorld', 'tips']);

const clone = (o) => JSON.parse(JSON.stringify(o));
const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);

function merge(base, src, top = true) {
  for (const k in src) {
    if (top && MAPS.has(k)) {
      if (isObj(src[k])) base[k] = clone(src[k]);
    } else if (isObj(src[k]) && isObj(base[k])) {
      merge(base[k], src[k], false);
    } else if (k in base) {
      base[k] = src[k];
    }
  }
  return base;
}

// v2 -> v3: la personalización era común a todas las naves; ahora es de cada una. Lo comprado
// se pagó con las reglas antiguas, así que queda comprado en TODAS las naves que ya tenías.
export function migrateCosmetics(c, ships) {
  if (!c || !Array.isArray(c.owned)) return c || {};
  const owned = {}, equip = {};
  for (const s of ships) {
    owned[s] = [...c.owned];
    if (c.equip) equip[s] = { ...c.equip };
  }
  return { owned, equip };
}

// Lleva un guardado antiguo al formato actual. Pura: se testea en Node.
export function migrate(data) {
  const v = data.v || 1;
  if (v < 2) {
    // v1 no tenía campos de progreso: los valores por defecto bastan
  }
  if (v < 3) data.cosmetics = migrateCosmetics(data.cosmetics, data.ships || ['viper']);
  if (v < 4) {
    // v4: las "mejoras globales" del hangar pasan a ser los dos primeros talentos del RUNNER
    data.talents = { ...(data.talents || {}) };
    if (data.meta?.shield) data.talents.r1 = true;
    if (data.meta?.card) data.talents.r2 = true;
    delete data.meta;
  }
  if (v < 5) {
    // v5: las monedas que sobraban se convertían en créditos de la Galaxia; ahora tienen su propia
    // cartera. No se puede saber qué créditos venían del Runner: un regalo de bienvenida.
    data.coins = (data.coins || 0) + 500;
  }
  if (v < 6 && data.settings) {
    // v6: "Nivelar la nave sola" pasa a venir apagado (vuelo libre de verdad); se aplica también a
    // los guardados de antes, que lo tenían encendido por defecto
    data.settings.autoLevel = false;
  }
  data.v = SAVE_VERSION;
  return data;
}

// Construye el guardado completo a partir del texto almacenado (o null). Pura.
export function loadFrom(raw) {
  const data = clone(DEFAULTS);
  if (raw) {
    try { merge(data, migrate(JSON.parse(raw))); } catch { /* guardado corrupto: se empieza de cero */ }
  }
  data.v = SAVE_VERSION;
  return data;
}

function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { /* sin almacenamiento: se juega igual */ }
  return loadFrom(raw);
}

export const save = load();

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignorar */ }
}
