// Personalización POR NAVE: pintura, estela, explosión y emblema. Módulo puro (recibe el guardado).
// Lo que se compra con gemas vale solo para la nave en la que lo compras; lo que da el rango o un
// logro vale para todas; y cada nave tiene pinturas y un emblema EXCLUSIVOS que se ganan usándola.
import { rankOf } from './progress.js';

const X = (ship, stat, n) => ({ ship, unlock: { stat, n } });

export const PALETTES = [
  { id: 'stock', name: 'De serie', hull: '#0a0a1a', edge: null, glow: '#ff9a3c' }, // edge null = color de la nave
  { id: 'sunset', name: 'Atardecer', hull: '#2a0a24', edge: '#ff6a3d', glow: '#ffd60a', unlock: { gems: 100 } },
  { id: 'ice', name: 'Hielo', hull: '#0a1a2a', edge: '#bff6ff', glow: '#7df9ff', unlock: { gems: 140 } },
  { id: 'toxic', name: 'Tóxico', hull: '#0a1a08', edge: '#a6ff00', glow: '#39ff14', unlock: { rank: 5 } },
  { id: 'chrome', name: 'Cromo', hull: '#3a3a48', edge: '#ffffff', glow: '#9ff', unlock: { gems: 200 } },
  { id: 'void', name: 'Vacío', hull: '#000000', edge: '#bf5af2', glow: '#ff2bd6', unlock: { rank: 12 } },
  { id: 'gold', name: 'Oro', hull: '#3a2a00', edge: '#ffd60a', glow: '#fff3a0', unlock: { ach: 'boss10' } },
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
];

export const TRAILS = [
  { id: 'sparks', name: 'Chispas' },
  { id: 'ribbon', name: 'Cinta', unlock: { rank: 3 } },
  { id: 'pixels', name: 'Píxeles', unlock: { gems: 100 } },
  { id: 'rainbow', name: 'Arcoíris', unlock: { rank: 10 } },
  { id: 'comet', name: 'Cometa', unlock: { ach: 'mach1' } },
];

export const BOOMS = [
  { id: 'classic', name: 'Clásica' },
  { id: 'pixel', name: 'Píxel', unlock: { rank: 6 } },
  { id: 'confetti', name: 'Confeti', unlock: { gems: 140 } },
  { id: 'supernova', name: 'Supernova', unlock: { gems: 200 } },
  { id: 'glitch', name: 'Glitch', unlock: { ach: 'syn10' } },
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
  ...['viper', 'brick', 'ghost', 'nova', 'kaiju', 'raptor', 'comet'].map((s) => ({ id: `sil-${s}`, name: 'Insignia', ...X(s, 'runs', 20) })),
];

export const GROUPS = { palette: PALETTES, trail: TRAILS, boom: BOOMS, emblem: EMBLEMS };
export const DEFAULT_EQUIP = { palette: 'stock', trail: 'sparks', boom: 'classic', emblem: 'none' };
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
  if (u.rank) return rankOf(save.xp).rank >= u.rank;
  if (u.ach) return !!save.ach[u.ach]?.done;
  if (u.stat) return shipStat(save, ship, u.stat) >= u.n;
  return false;
}

export function lockText(item, save = null, ship = null) {
  const u = item.unlock || {};
  if (u.gems) return `💎 ${u.gems}`;
  if (u.rank) return `RANGO ${u.rank}`;
  if (u.ach) return '🏆 logro';
  if (u.stat) return save ? `${Math.min(u.n, shipStat(save, ship, u.stat))}/${u.n} ${STAT_TEXT[u.stat]}` : `${u.n} ${STAT_TEXT[u.stat]}`;
  return '';
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
  return { palette: pick('palette'), trail: pick('trail'), boom: pick('boom'), emblem: pick('emblem') };
}

// Estadística de uso de una nave. Devuelve los exclusivos que se acaban de desbloquear.
export function addShipStat(save, ship, stat, n = 1) {
  const before = Object.values(GROUPS).flat().filter((i) => i.ship === ship && i.unlock.stat === stat && !isUnlocked(i, save, ship));
  const st = (save.shipStats[ship] ||= {});
  st[stat] = (st[stat] || 0) + n;
  return before.filter((i) => isUnlocked(i, save, ship));
}
