// Personalización: pintura, estela y explosión. Módulo puro (recibe el guardado).
// Cada objeto se desbloquea con gemas (hay que comprarlo), con un rango de piloto o con un logro.
import { rankOf } from './progress.js';

export const PALETTES = [
  { id: 'stock', name: 'De serie', hull: '#0a0a1a', edge: null, glow: '#ff9a3c' }, // edge null = color de la nave
  { id: 'sunset', name: 'Atardecer', hull: '#2a0a24', edge: '#ff6a3d', glow: '#ffd60a', unlock: { gems: 150 } },
  { id: 'ice', name: 'Hielo', hull: '#0a1a2a', edge: '#bff6ff', glow: '#7df9ff', unlock: { gems: 200 } },
  { id: 'toxic', name: 'Tóxico', hull: '#0a1a08', edge: '#a6ff00', glow: '#39ff14', unlock: { rank: 5 } },
  { id: 'chrome', name: 'Cromo', hull: '#3a3a48', edge: '#ffffff', glow: '#9ff', unlock: { gems: 300 } },
  { id: 'void', name: 'Vacío', hull: '#000000', edge: '#bf5af2', glow: '#ff2bd6', unlock: { rank: 12 } },
  { id: 'gold', name: 'Oro', hull: '#3a2a00', edge: '#ffd60a', glow: '#fff3a0', unlock: { ach: 'boss10' } },
];

export const TRAILS = [
  { id: 'sparks', name: 'Chispas' },
  { id: 'ribbon', name: 'Cinta', unlock: { rank: 3 } },
  { id: 'pixels', name: 'Píxeles', unlock: { gems: 150 } },
  { id: 'rainbow', name: 'Arcoíris', unlock: { rank: 10 } },
  { id: 'comet', name: 'Cometa', unlock: { ach: 'mach1' } },
];

export const BOOMS = [
  { id: 'classic', name: 'Clásica' },
  { id: 'pixel', name: 'Píxel', unlock: { rank: 6 } },
  { id: 'confetti', name: 'Confeti', unlock: { gems: 200 } },
  { id: 'supernova', name: 'Supernova', unlock: { gems: 300 } },
  { id: 'glitch', name: 'Glitch', unlock: { ach: 'syn10' } },
];

export const GROUPS = { palette: PALETTES, trail: TRAILS, boom: BOOMS };
export const DEFAULT_EQUIP = { palette: 'stock', trail: 'sparks', boom: 'classic' };

const cos = (save) => {
  const c = save.cosmetics;
  if (!c.owned) c.owned = [];
  if (!c.equip) c.equip = { ...DEFAULT_EQUIP };
  return c;
};

// ¿Se puede usar ya? (los de gemas, si están comprados)
export function isUnlocked(item, save) {
  const u = item.unlock;
  if (!u) return true;
  if (u.gems) return cos(save).owned.includes(item.id);
  if (u.rank) return rankOf(save.xp).rank >= u.rank;
  if (u.ach) return !!save.ach[u.ach]?.done;
  return false;
}

export function lockText(item) {
  const u = item.unlock || {};
  if (u.gems) return `💎 ${u.gems}`;
  if (u.rank) return `RANGO ${u.rank}`;
  if (u.ach) return '🏆 logro';
  return '';
}

// Compra con gemas. Devuelve true si se compró.
export function buyCosmetic(item, save) {
  if (!item.unlock?.gems || isUnlocked(item, save) || save.gems < item.unlock.gems) return false;
  save.gems -= item.unlock.gems;
  cos(save).owned.push(item.id);
  return true;
}

export function equip(group, id, save) {
  const item = GROUPS[group].find((i) => i.id === id);
  if (!item || !isUnlocked(item, save)) return false;
  cos(save).equip[group] = id;
  return true;
}

// Lo equipado (con respaldo a lo de serie si algo dejó de estar disponible)
export function equipped(save) {
  const e = { ...DEFAULT_EQUIP, ...cos(save).equip };
  const pick = (group) => {
    const it = GROUPS[group].find((i) => i.id === e[group]);
    return it && isUnlocked(it, save) ? it : GROUPS[group][0];
  };
  return { palette: pick('palette'), trail: pick('trail'), boom: pick('boom') };
}
