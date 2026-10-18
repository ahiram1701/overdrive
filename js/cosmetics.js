// Personalización POR NAVE: pintura, estela, explosión y emblema. Módulo puro (recibe el guardado).
// Lo que se compra con gemas vale solo para la nave en la que lo compras; lo que da el rango o un
// logro vale para todas; y cada nave tiene pinturas y un emblema EXCLUSIVOS que se ganan usándola.
import { effectiveRank, prestigeOf, ACHIEVEMENTS } from './progress.js';

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
  { id: 'mint', name: 'Menta helada', hull: '#062018', edge: '#7dffb0', glow: '#e0fff0', unlock: { gems: 110 } },
  { id: 'lava2', name: 'Volcán', hull: '#1a0400', alt: '#3a1000', pattern: 'stripes', edge: '#ff5a00', glow: '#ffd60a', unlock: { gems: 170 } },
  { id: 'police', name: 'Patrulla', hull: '#05051a', alt: '#e8e8f0', pattern: 'split', edge: '#2d6bff', glow: '#ff2d55', unlock: { gems: 150 } },
  { id: 'sakura', name: 'Sakura', hull: '#2a0a1a', edge: '#ffb7d5', glow: '#ffffff', unlock: { rank: 9 } },
  { id: 'jungle', name: 'Selva', hull: '#0a1a04', alt: '#1f3a08', pattern: 'stripes', edge: '#a6ff00', glow: '#ffe600', unlock: { gems: 140 } },
  { id: 'royal', name: 'Real', hull: '#0a0628', alt: '#2a0640', pattern: 'fade', edge: '#ffd60a', glow: '#bf5af2', unlock: { rank: 22 } },
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
  // MAESTRÍA: una por nave, al completar su árbol entero
  ...[['viper', '#00e5ff'], ['brick', '#ffd60a'], ['ghost', '#e0e0ff'], ['nova', '#ff375f'], ['kaiju', '#30d158'], ['raptor', '#ff9f0a'],
    ['comet', '#bf5af2'], ['manta', '#64d2ff'], ['spectra', '#ffe600'], ['titan', '#ff6b3d'], ['falcon', '#7dffb0'], ['chimera', '#ff4fd8'], ['wanderer', '#c58cff']].map(([ship, c]) => (
    { id: `m-${ship}`, name: 'Maestro', hull: '#0a0a0a', alt: '#2a2000', pattern: 'fade', edge: c, glow: '#ffd60a', ship, unlock: { mastery: ship } })),
  // de FACCIÓN (se compran con créditos en sus estaciones al ser Amigo/Aliado)
  { id: 'f-liga', name: 'Liga Minera', hull: '#061a0a', alt: '#2a2400', pattern: 'stripes', edge: '#30d158', glow: '#ffd60a', unlock: { faction: 'liga' } },
  { id: 'f-coal', name: 'Coalición Solar', hull: '#06101e', alt: '#1e1a06', pattern: 'split', edge: '#00e5ff', glow: '#ffcc66', unlock: { faction: 'coal' } },
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
  { id: 'x-falcon1', name: 'Plumaje', hull: '#0a1a10', edge: '#7dffb0', glow: '#ffffff', ...X('falcon', 'sections', 30) },
  { id: 'x-falcon2', name: 'Peregrino', hull: '#1a1406', edge: '#ffcf6b', glow: '#7dffb0', ...X('falcon', 'bosses', 5) },
  { id: 'x-wanderer1', name: 'Polvo de estrellas', hull: '#0a0618', edge: '#c58cff', glow: '#ffffff', ...X('wanderer', 'sections', 30) },
  { id: 'x-wanderer2', name: 'Silencio', hull: '#000000', edge: '#7a5cff', glow: '#00e5ff', ...X('wanderer', 'bosses', 5) },
  { id: 'x-chimera1', name: 'Escamas', hull: '#1a0618', edge: '#ff4fd8', glow: '#ffe600', ...X('chimera', 'sections', 30) },
  { id: 'x-chimera2', name: 'Tres cabezas', hull: '#060a1a', edge: '#ff9f0a', glow: '#ff4fd8', ...X('chimera', 'bosses', 5) },
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
  ...['viper', 'brick', 'ghost', 'nova', 'kaiju', 'raptor', 'comet', 'manta', 'spectra', 'titan', 'falcon', 'chimera', 'wanderer'].map((s) => ({ id: `sil-${s}`, name: 'Insignia', ...X(s, 'runs', 20) })),
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
  { id: 'e-orange', name: 'Naranja', color: '#ff9f0a', unlock: { gems: 60 } },
  { id: 'e-lime', name: 'Lima', color: '#a6ff00', unlock: { gems: 70 } },
  { id: 'e-ice', name: 'Hielo azul', color: '#bff6ff', unlock: { rank: 13 } },
  { id: 'f-liga-e', name: 'Llama minera', color: '#b6ff3d', unlock: { faction: 'liga' } },
  { id: 'f-coal-e', name: 'Llama solar', color: '#ffcc66', unlock: { faction: 'coal' } },
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
  { id: 's-cyan', name: 'Cian puro', color: '#00e5ff', unlock: { gems: 50 } },
  { id: 's-orange', name: 'Naranja', color: '#ff9f0a', unlock: { gems: 60 } },
  { id: 's-lime', name: 'Lima', color: '#a6ff00', unlock: { rank: 15 } },
  { id: 'c-s-violet', name: 'Violeta', color: '#bf5af2', unlock: { crate: 'rare' } },
  { id: 'c-s-plasma', name: 'Plasma', color: '#ff9f0a', unlock: { crate: 'epic' } },
];

// RAYAS de carreras a lo largo del lomo y color de la CABINA (shipdraw los pinta en el casco)
export const STRIPES = [
  { id: 'st-none', name: 'Sin rayas', style: 'none' },
  { id: 'st-single-w', name: 'Raya blanca', style: 'single', color: '#ffffff', unlock: { gems: 60 } },
  { id: 'st-double-r', name: 'Doble roja', style: 'double', color: '#ff2d55', unlock: { gems: 90 } },
  { id: 'st-double-y', name: 'Doble amarilla', style: 'double', color: '#ffe600', unlock: { gems: 90 } },
  { id: 'st-wide-c', name: 'Ancha cian', style: 'wide', color: '#00e5ff', unlock: { gems: 130 } },
  { id: 'st-wide-k', name: 'Ancha negra', style: 'wide', color: '#050508', unlock: { rank: 11 } },
  { id: 'st-gold', name: 'Filete de oro', style: 'double', color: '#ffd60a', unlock: { crate: 'epic' } },
];
export const COCKPITS = [
  { id: 'ck-stock', name: 'De serie', color: null },
  { id: 'ck-amber', name: 'Ámbar', color: '#ffb340', unlock: { gems: 50 } },
  { id: 'ck-ice', name: 'Hielo', color: '#bff6ff', unlock: { gems: 50 } },
  { id: 'ck-rose', name: 'Rosa', color: '#ff8ad8', unlock: { gems: 70 } },
  { id: 'ck-black', name: 'Tintada', color: '#101018', unlock: { rank: 7 } },
  { id: 'ck-gold', name: 'Dorada', color: '#ffd60a', unlock: { crate: 'rare' } },
];

// ---------- ESTILOS DE LOGRO: cada logro desbloquea uno propio (para todas las naves) ----------
// El color sale del id del logro (determinista); el tipo, de su rareza: los de oro dan pinturas con
// patrón, los de plata rayas, motores o pinturas, y los de bronce disparos, cabinas o motores.
function hsl2hex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0');
  return `#${f(0)}${f(8)}${f(4)}`;
}
const hueOf = (id) => { let h = 7; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 360; };
const ACH_KIND = { bronze: ['shot', 'cockpit', 'engine'], silver: ['stripe', 'engine', 'palette'], gold: ['palette'] };
const KIND_NAME = { palette: 'Pintura', stripe: 'Rayas', engine: 'Motor', shot: 'Disparo', cockpit: 'Cabina' };
export const ACH_STYLES = ACHIEVEMENTS.map((a, i) => {
  const group = ACH_KIND[a.tier][i % ACH_KIND[a.tier].length];
  const h = hueOf(a.id), c = hsl2hex(h, 100, 60), c2 = hsl2hex((h + 50) % 360, 100, 70);
  const base = { id: `ach-${a.id}`, name: `${KIND_NAME[group]} ${a.name}`, group, achId: a.id, unlock: { ach: a.id } };
  if (group === 'palette') {
    const gold = a.tier === 'gold';
    return { ...base, hull: hsl2hex(h, 60, 9), ...(gold ? { alt: hsl2hex((h + 180) % 360, 55, 14), pattern: ['fade', 'split', 'stripes'][i % 3] } : {}), edge: c, glow: c2 };
  }
  if (group === 'stripe') return { ...base, style: ['double', 'wide', 'single'][i % 3], color: c };
  return { ...base, color: c };
});
export const achStyle = (achId) => ACH_STYLES.find((x) => x.achId === achId);
const byGroup = (g) => ACH_STYLES.filter((x) => x.group === g);
PALETTES.push(...byGroup('palette'));
ENGINES.push(...byGroup('engine'));
SHOTS.push(...byGroup('shot'));
STRIPES.push(...byGroup('stripe'));
COCKPITS.push(...byGroup('cockpit'));

export const GROUPS = { palette: PALETTES, trail: TRAILS, boom: BOOMS, emblem: EMBLEMS, engine: ENGINES, aura: AURAS, shot: SHOTS, stripe: STRIPES, cockpit: COCKPITS };
export const DEFAULT_EQUIP = { palette: 'stock', trail: 'sparks', boom: 'classic', emblem: 'none', emblemAt: 'alas', emblemColor: 'auto', engine: 'e-stock', aura: 'a-none', shot: 's-stock', stripe: 'st-none', cockpit: 'ck-stock' };

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
  if (u.mastery) return !!save.shipLvl?.[u.mastery]?.m;
  if (u.faction) return (save.crates?.owned || []).includes(item.id);
  return false;
}

export function lockText(item, save = null, ship = null) {
  const u = item.unlock || {};
  if (u.gems) return `💎 ${u.gems}`;
  if (u.rank) return `RANGO ${u.rank}`;
  if (u.ach) return `🏆 ${ACHIEVEMENTS.find((a) => a.id === u.ach)?.name || 'logro'}`;
  if (u.prestige) return `✨ PRESTIGIO ${u.prestige}`;
  if (u.stat) return save ? `${Math.min(u.n, shipStat(save, ship, u.stat))}/${u.n} ${STAT_TEXT[u.stat]}` : `${u.n} ${STAT_TEXT[u.stat]}`;
  if (u.crate) return '🎁 cofre';
  if (u.mastery) return '★ maestría';
  if (u.faction) return u.faction === 'liga' ? '⛏️ Liga Minera' : '☀️ Coalición';
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
    palette: tintEngine(pick('palette'), engine), basePalette: pick('palette'), engine, aura: pick('aura'), shot: pick('shot'), stripe: pick('stripe'), cockpit: pick('cockpit'),
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
export const emblemOpts = (lk) => ({ emblem: lk.emblem.id, emblemAt: lk.emblemAt, emblemColor: EMBLEM_COLORS[lk.emblemColor] || null,
  stripe: lk.stripe && lk.stripe.style !== 'none' ? lk.stripe : null, cockpit: lk.cockpit?.color || null });

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
