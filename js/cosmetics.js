// Personalización POR NAVE: pintura, estela, explosión y emblema. Módulo puro (recibe el guardado).
// Lo que se compra con gemas vale solo para la nave en la que lo compras; lo que da el rango o un
// logro vale para todas; y cada nave tiene pinturas y un emblema EXCLUSIVOS que se ganan usándola.
import { effectiveRank, prestigeOf } from './progress.js';

const X = (ship, stat, n) => ({ ship, unlock: { stat, n } });

export const PALETTES = [
  { id: 'stock', name: 'De serie', hull: '#0a0a1a', edge: null, glow: '#ff9a3c' }, // edge null = color de la nave
  { id: 'sunset', name: 'Atardecer', hull: '#2a0a24', edge: '#ff6a3d', glow: '#ffd60a', unlock: { gems: 100 } },
  { id: 'ice', name: 'Hielo', hull: '#0a1a2a', edge: '#bff6ff', glow: '#7df9ff', unlock: { gems: 140 } },
  { id: 'toxic', name: 'Tóxico', hull: '#0a1a08', edge: '#a6ff00', glow: '#39ff14', unlock: { rank: 5 } },
  { id: 'chrome', name: 'Cromo', hull: '#3a3a48', edge: '#ffffff', glow: '#9ff', unlock: { gems: 200 } },
  { id: 'void', name: 'Vacío', hull: '#000000', edge: '#bf5af2', glow: '#ff2bd6', unlock: { rank: 12 } },
  { id: 'gold', name: 'Oro', hull: '#3a2a00', edge: '#ffd60a', glow: '#fff3a0', unlock: { ach: 'boss10' } },
  // con patrón (alt = segundo color del casco)
  { id: 'tiger', name: 'Tigre', hull: '#b35f00', alt: '#0a0500', pattern: 'stripes', edge: '#ff9500', glow: '#ffd60a', unlock: { gems: 160 } },
  { id: 'duo', name: 'Dúo', hull: '#0a2a5e', alt: '#6a0058', pattern: 'split', edge: '#00e5ff', glow: '#ff2bd6', unlock: { gems: 160 } },
  { id: 'harlequin', name: 'Arlequín', hull: '#5a0a5a', alt: '#0a4a5a', pattern: 'stripes', edge: '#ffffff', glow: '#ff2bd6', unlock: { prestige: 2 } },
  { id: 'aurora', name: 'Aurora', hull: '#00553f', alt: '#5a1a8a', pattern: 'fade', edge: '#7df9ff', glow: '#bf5af2', unlock: { rank: 18 } },
  // exclusivas: una por usar la nave (tramos) y otra de maestría (jefes con ella)
  { id: 'x-viper1', name: 'Veneno', hull: '#06140a', edge: '#39ff14', glow: '#b6ff00', ...X('viper', 'sections', 30) },
  { id: 'x-viper2', name: 'Cobra real', hull: '#1a1200', edge: '#ffd60a', glow: '#ff3b30', ...X('viper', 'bosses', 5) },
  { id: 'x-brick1', name: 'Óxido', hull: '#1e0e05', edge: '#ff7a1a', glow: '#ffb347', ...X('brick', 'sections', 30) },
  { id: 'x-brick2', name: 'Acero templado', hull: '#20242c', edge: '#9ecbff', glow: '#ffffff', ...X('brick', 'bosses', 5) },
  { id: 'x-ghost1', name: 'Ectoplasma', hull: '#041a16', edge: '#5affd9', glow: '#c8fff2', ...X('ghost', 'sections', 30) },
  { id: 'x-ghost2', name: 'Espectro', hull: '#0d0618', edge: '#e0d0ff', glow: '#9d7bff', ...X('ghost', 'bosses', 5) },
  { id: 'x-nova1', name: 'Púlsar', hull: '#0a0420', edge: '#ff4fd8', glow: '#7df9ff', ...X('nova', 'sections', 30) },
  { id: 'x-nova2', name: 'Gigante roja', hull: '#200402', edge: '#ff3b1f', glow: '#ffcc00', ...X('nova', 'bosses', 5) },
  { id: 'x-kaiju1', name: 'Magma', hull: '#1a0500', edge: '#ff5a00', glow: '#ffd60a', ...X('kaiju', 'sections', 30) },
  { id: 'x-kaiju2', name: 'Fósil', hull: '#2a2418', edge: '#e8dcc0', glow: '#9cff6a', ...X('kaiju', 'bosses', 5) },
  { id: 'x-raptor1', name: 'Camuflaje', hull: '#121a0c', edge: '#8fbf4a', glow: '#ffd60a', ...X('raptor', 'sections', 30) },
  { id: 'x-raptor2', name: 'Depredador', hull: '#1a0000', edge: '#ff1744', glow: '#ff8a80', ...X('raptor', 'bosses', 5) },
  { id: 'x-comet1', name: 'Cola de hielo', hull: '#04121e', edge: '#7fd8ff', glow: '#ffffff', ...X('comet', 'sections', 30) },
  { id: 'x-comet2', name: 'Halley', hull: '#160a26', edge: '#ffa94d', glow: '#fff3a0', ...X('comet', 'bosses', 5) },
  // exclusivos de COFRE (solo salen al abrir cofres de suministros)
  { id: 'c-nebula', name: 'Nebulosa', hull: '#12002a', alt: '#002a3a', pattern: 'fade', edge: '#ff2bd6', glow: '#7df9ff', unlock: { crate: 'legendary' } },
  { id: 'c-carbon', name: 'Carbono', hull: '#111114', alt: '#26262c', pattern: 'stripes', edge: '#9aa0a6', glow: '#ff3b30', unlock: { crate: 'epic' } },
  { id: 'c-candy', name: 'Caramelo', hull: '#3a0a2a', alt: '#0a2a3a', pattern: 'split', edge: '#ff8ad8', glow: '#8affff', unlock: { crate: 'rare' } },
  { id: 'x-manta1', name: 'Abisal', hull: '#02101e', edge: '#3fd0ff', glow: '#9cf6ff', ...X('manta', 'sections', 30) },
  { id: 'x-manta2', name: 'Coral', hull: '#1e0610', edge: '#ff7aa8', glow: '#ffd1e0', ...X('manta', 'bosses', 5) },
  { id: 'x-spectra1', name: 'Tormenta', hull: '#0c0c18', edge: '#fff04a', glow: '#ffffff', ...X('spectra', 'sections', 30) },
  { id: 'x-spectra2', name: 'Prisma roto', hull: '#140020', edge: '#7df9ff', glow: '#ff2bd6', ...X('spectra', 'bosses', 5) },
  { id: 'x-titan1', name: 'Forja', hull: '#1a0c04', edge: '#ff8c3d', glow: '#ffd60a', ...X('titan', 'sections', 30) },
  { id: 'x-titan2', name: 'Obsidiana', hull: '#050505', edge: '#9a9aa8', glow: '#ff3b30', ...X('titan', 'bosses', 5) },
];

export const TRAILS = [
  { id: 'sparks', name: 'Chispas' },
  { id: 'ribbon', name: 'Cinta', unlock: { rank: 3 } },
  { id: 'pixels', name: 'Píxeles', unlock: { gems: 100 } },
  { id: 'rainbow', name: 'Arcoíris', unlock: { rank: 10 } },
  { id: 'comet', name: 'Cometa', unlock: { ach: 'mach1' } },
  { id: 'smoke', name: 'Humo', unlock: { gems: 120 } },
  { id: 'lightning', name: 'Relámpago', unlock: { rank: 14 } },
  { id: 'prism', name: 'Prisma', unlock: { prestige: 3 } },
];

export const BOOMS = [
  { id: 'classic', name: 'Clásica' },
  { id: 'pixel', name: 'Píxel', unlock: { rank: 6 } },
  { id: 'confetti', name: 'Confeti', unlock: { gems: 140 } },
  { id: 'supernova', name: 'Supernova', unlock: { gems: 200 } },
  { id: 'glitch', name: 'Glitch', unlock: { ach: 'syn10' } },
  { id: 'blackhole', name: 'Agujero negro', unlock: { gems: 180 } },
  { id: 'fireworks', name: 'Fuegos artificiales', unlock: { rank: 20 } },
  { id: 'singularity', name: 'Singularidad', unlock: { prestige: 10 } },
];

// Emblemas: se dibujan sobre las alas (trazos vectoriales en shipdraw.js, no emoji). 'sil' es la
// silueta de la propia nave: exclusivo de cada una.
export const EMBLEMS = [
  { id: 'none', name: 'Ninguno' },
  { id: 'bolt', name: 'Rayo', unlock: { gems: 60 } },
  { id: 'star', name: 'Estrella', unlock: { gems: 60 } },
  { id: 'flame', name: 'Llama', unlock: { gems: 90 } },
  { id: 'skull', name: 'Calavera', unlock: { gems: 120 } },
  { id: 'eye', name: 'Ojo', unlock: { rank: 8 } },
  { id: 'crown', name: 'Corona', unlock: { ach: 'score1m' } },
  { id: 'tribal', name: 'Tribal', unlock: { rank: 15 } },
  { id: 'laurel', name: 'Laurel', unlock: { prestige: 1 } },
  ...['viper', 'brick', 'ghost', 'nova', 'kaiju', 'raptor', 'comet', 'manta', 'spectra', 'titan'].map((s) => ({ id: `sil-${s}`, name: 'Insignia', ...X(s, 'runs', 20) })),
];

// Color del motor (llama y estela). null = el brillo de la pintura
export const ENGINES = [
  { id: 'e-stock', name: 'De serie', color: null },
  { id: 'e-cyan', name: 'Plasma azul', color: '#00e5ff', unlock: { gems: 60 } },
  { id: 'e-pink', name: 'Neón rosa', color: '#ff2bd6', unlock: { gems: 60 } },
  { id: 'e-green', name: 'Ácido', color: '#39ff14', unlock: { rank: 4 } },
  { id: 'e-white', name: 'Blanco solar', color: '#ffffff', unlock: { gems: 90 } },
  { id: 'e-violet', name: 'Violeta', color: '#bf5af2', unlock: { rank: 9 } },
  { id: 'e-red', name: 'Infierno', color: '#ff2d55', unlock: { ach: 'boss10' } },
  { id: 'c-e-gold', name: 'Oro fundido', color: '#ffd60a', unlock: { crate: 'epic' } },
  { id: 'c-e-mint', name: 'Menta', color: '#7dffb0', unlock: { crate: 'rare' } },
  { id: 'c-e-void', name: 'Antimateria', color: '#7a5cff', unlock: { crate: 'legendary' } },
];

// Aura alrededor de la nave (cosfx.auraFx)
export const AURAS = [
  { id: 'a-none', name: 'Ninguna' },
  { id: 'a-neon', name: 'Neón', color: '#00e5ff', unlock: { gems: 150 } },
  { id: 'a-fire', name: 'Fuego', color: '#ff6a00', unlock: { rank: 7 } },
  { id: 'a-void', name: 'Vacío', color: '#bf5af2', unlock: { gems: 220 } },
  { id: 'a-electric', name: 'Eléctrica', color: '#ffe600', unlock: { rank: 16 } },
  { id: 'a-rainbow', name: 'Arcoíris', color: '#ff2bd6', unlock: { prestige: 1 } },
];

// Color de tus disparos (Arena y Galaxia). null = el de siempre
export const SHOTS = [
  { id: 's-stock', name: 'De serie', color: null },
  { id: 's-pink', name: 'Rosa', color: '#ff2bd6', unlock: { gems: 50 } },
  { id: 's-green', name: 'Verde', color: '#39ff14', unlock: { gems: 50 } },
  { id: 's-gold', name: 'Oro', color: '#ffd60a', unlock: { rank: 6 } },
  { id: 's-red', name: 'Rojo', color: '#ff2d55', unlock: { gems: 80 } },
  { id: 's-white', name: 'Blanco', color: '#ffffff', unlock: { rank: 12 } },
  { id: 'c-s-violet', name: 'Violeta', color: '#bf5af2', unlock: { crate: 'rare' } },
  { id: 'c-s-plasma', name: 'Plasma', color: '#ff9f0a', unlock: { crate: 'epic' } },
];

export const GROUPS = { palette: PALETTES, trail: TRAILS, boom: BOOMS, emblem: EMBLEMS, engine: ENGINES, aura: AURAS, shot: SHOTS };
export const DEFAULT_EQUIP = { palette: 'stock', trail: 'sparks', boom: 'classic', emblem: 'none', emblemAt: 'alas', emblemColor: 'auto', engine: 'e-stock', aura: 'a-none', shot: 's-stock' };

// La pintura con el brillo del motor elegido (la llama y la estela salen de pal.glow)
export const tintEngine = (pal, engine) => (engine?.color ? { ...pal, glow: engine.color } : pal);
export const DEFAULT_SHOT = '#7df9ff';

// Estilo del emblema (gratis): dónde va y de qué color ('auto' = el brillo de la pintura)
export const EMBLEM_AT = [['alas', 'Alas'], ['ala', 'Un ala'], ['cola', 'Cola']];
export const EMBLEM_COLORS = {
  auto: null, white: '#ffffff', yellow: '#ffe600', cyan: '#00e5ff', magenta: '#ff2bd6', green: '#39ff14', red: '#ff2d55', black: '#05050a',
};
export const STAT_TEXT = { sections: 'tramos', bosses: 'jefes', runs: 'partidas' };

const cos = (save) => {
  const c = save.cosmetics;
  if (!c.owned || Array.isArray(c.owned)) c.owned = {};
  if (!c.equip || typeof c.equip.palette === 'string') c.equip = {};
  return c;
};
const ownedOf = (save, ship) => cos(save).owned[ship] || [];
export const shipStat = (save, ship, stat) => save.shipStats?.[ship]?.[stat] || 0;

// Lo que se ofrece en el hangar de una nave: lo común más sus exclusivos
export const itemsFor = (group, ship) => GROUPS[group].filter((i) => !i.ship || i.ship === ship);

// ¿Se puede usar ya en esta nave? (los de gemas, si están comprados para ELLA)
export function isUnlocked(item, save, ship = save.ship) {
  if (item.ship && item.ship !== ship) return false;
  const u = item.unlock;
  if (!u) return true;
  if (u.gems) return ownedOf(save, ship).includes(item.id);
  if (u.rank) return effectiveRank(save) >= u.rank;
  if (u.prestige) return prestigeOf(save) >= u.prestige;
  if (u.ach) return !!save.ach[u.ach]?.done;
  if (u.stat) return shipStat(save, ship, u.stat) >= u.n;
  if (u.crate) return (save.crates?.owned || []).includes(item.id);
  return false;
}

export function lockText(item, save = null, ship = null) {
  const u = item.unlock || {};
  if (u.gems) return `💎 ${u.gems}`;
  if (u.rank) return `RANGO ${u.rank}`;
  if (u.ach) return '🏆 logro';
  if (u.prestige) return `✨ PRESTIGIO ${u.prestige}`;
  if (u.stat) return save ? `${Math.min(u.n, shipStat(save, ship, u.stat))}/${u.n} ${STAT_TEXT[u.stat]}` : `${u.n} ${STAT_TEXT[u.stat]}`;
  if (u.crate) return '🎁 cofre';
  return '';
}

// Regalo (cofre): lo de gemas, para esta nave; lo exclusivo de cofre, para todas
export function grantCosmetic(item, save, ship = save.ship) {
  if (item.unlock?.crate) {
    save.crates.owned = [...(save.crates.owned || []), item.id];
    return;
  }
  const c = cos(save);
  c.owned[ship] = [...ownedOf(save, ship), item.id];
}

// Compra con gemas, solo para esta nave. Devuelve true si se compró.
export function buyCosmetic(item, save, ship = save.ship) {
  if (!item.unlock?.gems || item.ship || isUnlocked(item, save, ship) || save.gems < item.unlock.gems) return false;
  save.gems -= item.unlock.gems;
  const c = cos(save);
  c.owned[ship] = [...ownedOf(save, ship), item.id];
  return true;
}

export function equip(group, id, save, ship = save.ship) {
  const item = GROUPS[group].find((i) => i.id === id);
  if (!item || !isUnlocked(item, save, ship)) return false;
  const c = cos(save);
  c.equip[ship] = { ...DEFAULT_EQUIP, ...c.equip[ship], [group]: id };
  return true;
}

// Lo que lleva puesto una nave (con respaldo a lo de serie si algo dejó de estar disponible)
export function equipped(save, ship = save.ship) {
  const e = { ...DEFAULT_EQUIP, ...cos(save).equip[ship] };
  const pick = (group) => {
    const it = GROUPS[group].find((i) => i.id === e[group]);
    return it && isUnlocked(it, save, ship) ? it : GROUPS[group][0];
  };
  const engine = pick('engine');
  return {
    palette: tintEngine(pick('palette'), engine), basePalette: pick('palette'), engine, aura: pick('aura'), shot: pick('shot'),
    trail: pick('trail'), boom: pick('boom'), emblem: pick('emblem'),
    emblemAt: EMBLEM_AT.some(([k]) => k === e.emblemAt) ? e.emblemAt : 'alas',
    emblemColor: e.emblemColor in EMBLEM_COLORS ? e.emblemColor : 'auto',
  };
}

// Cambia dónde va el emblema o su color (gratis)
export function setEmblemStyle(save, ship, { at, color } = {}) {
  const c = cos(save);
  const cur = { ...DEFAULT_EQUIP, ...c.equip[ship] };
  if (at && EMBLEM_AT.some(([k]) => k === at)) cur.emblemAt = at;
  if (color && color in EMBLEM_COLORS) cur.emblemColor = color;
  c.equip[ship] = cur;
}

// Opciones de drawShip para el emblema de un aspecto (lo que devuelve equipped)
export const emblemOpts = (lk) => ({ emblem: lk.emblem.id, emblemAt: lk.emblemAt, emblemColor: EMBLEM_COLORS[lk.emblemColor] || null });

// Estadística de uso de una nave. Devuelve los exclusivos que se acaban de desbloquear.
export function addShipStat(save, ship, stat, n = 1) {
  const before = Object.values(GROUPS).flat().filter((i) => i.ship === ship && i.unlock.stat === stat && !isUnlocked(i, save, ship));
  const st = (save.shipStats[ship] ||= {});
  st[stat] = (st[stat] || 0) + n;
  return before.filter((i) => isUnlocked(i, save, ship));
}

// Nombre propio de la nave (se ve en el hangar y en la Galaxia)
export const MAX_NAME = 14;
export const shipName = (save, ship) => save.shipNames?.[ship] || '';
export function setShipName(save, ship, name) {
  const clean = String(name || '').replace(/[<>&"]/g, '').trim().slice(0, MAX_NAME);
  save.shipNames ||= {};
  if (clean) save.shipNames[ship] = clean;
  else delete save.shipNames[ship];
  return clean;
}
