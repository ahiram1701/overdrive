// Guardado persistente. localStorage puede fallar (modo privado), así que todo va en try/catch.
// La clave de almacenamiento NO cambia entre versiones: el formato se versiona con el campo `v`.
const KEY = 'overdrive-save-v1';
export const SAVE_VERSION = 3;

const reducedMotion = (() => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
})();

const DEFAULTS = {
  v: SAVE_VERSION,
  gems: 0,
  best: 0,
  bestDist: 0,
  daily: { key: '', best: 0 },
  ships: ['viper'],
  ship: 'viper',
  meta: { shield: false, card: false },
  settings: { sound: true, vibe: true, fx: !reducedMotion, text: 'normal' },
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
  shipStats: {},    // { viper: { runs, sections, bosses } }: desbloquea los exclusivos de cada nave
  campaign: {},     // { '1-1': 3 }
  modsLast: [],     // modificadores elegidos la última vez
  mutation: { key: '', played: false }, // mutación del día: el primer intento da x1,5 gemas
};

// Claves que son MAPAS de contenido libre: se copian enteras. Antes, merge solo copiaba claves
// que ya existían en DEFAULTS, así que { viper: {...} } dentro de un {} vacío se perdía al cargar.
const MAPS = new Set(['shipLvl', 'abilityUses', 'ach', 'codex', 'cosmetics', 'campaign', 'shipStats']);

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
