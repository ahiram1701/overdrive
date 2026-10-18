// GALAXIA: la AMENAZA crece con tu nave. Módulo puro (se testea en Node).
// - PODER: lo fuerte que es tu nave (ataque y aguante) respecto a una nave nueva (= 1).
// - AMENAZA: cuánto se refuerzan los piratas para que una nave muy mejorada siga teniendo rival.
// - NIVEL DE BÚSQUEDA (⭐): sube al hacer daño a los piratas; con ⭐⭐ o más, te mandan cazadores.
// - ÉLITES con rasgos: más frecuentes cuanto mayor es la amenaza.
import { shipStats } from './galaxyData.js';

// ---------- Poder y amenaza ----------
const BASE = shipStats({}, 'viper', 'explorer');
const dps = (st) => st.dmg / st.fireCd;
export function power(st) {
  const off = dps(st) / dps(BASE);
  const tough = (st.shield + st.hull) / (BASE.shield + BASE.hull);
  return (off + tough) / 2;
}
// hasta un poco de mejora no cambia nada (el principio sigue igual); después sube, con tope
export const THREAT_FREE = 1.3;
export const THREAT_MAX = 4;
export const threatOf = (pw) => Math.min(THREAT_MAX, 1 + Math.max(0, pw - THREAT_FREE) * 0.55);
export const extraPirates = (t) => Math.min(4, Math.floor((t - 1) * 1.5));
export const rewardMul = (t) => Math.sqrt(t);
// marcas de amenaza para el HUD: ▲ (de 0 a 4)
export const threatTier = (t) => Math.max(0, Math.min(4, Math.round((t - 1) / 0.75)));

// ---------- Nivel de búsqueda ----------
export const WANTED_MAX = 5;
export const WANTED_GAIN = { kill: 0.06, base: 0.5, bounty: 0.4, defend: 0.3 };
export function addWanted(g, kind) {
  g.wanted = Math.min(WANTED_MAX, (g.wanted || 0) + (WANTED_GAIN[kind] || 0));
  return g.wanted;
}
// un salto sin abatir a nadie: se van olvidando de ti
export function jumpWanted(g, killed) {
  if (!killed) g.wanted = Math.max(0, (g.wanted || 0) - 0.4);
  return g.wanted || 0;
}
export const stars = (g) => Math.floor(g.wanted || 0);
// probabilidad de que te esperen CAZADORES al llegar y cuántos
export const hunterChance = (w) => (w < 2 ? 0 : 0.25 + 0.15 * (Math.floor(w) - 2));
export const hunterCount = (w) => Math.min(4, Math.max(2, Math.floor(w)));
// SOBORNO en una estación: quita una estrella (sumidero de créditos)
export const bribeCost = (g, t = 1) => Math.round(((800 + 600 * stars(g)) * t) / 10) * 10;
export function bribe(g, t = 1) {
  const c = bribeCost(g, t);
  if (stars(g) < 1 || g.credits < c) return false;
  g.credits -= c;
  g.wanted = Math.max(0, Math.floor(g.wanted) - 1);
  return c;
}

// ---------- Élites ----------
export const TRAITS = {
  shielded: { icon: '🛡️', name: 'Blindado', desc: 'escudo que hay que romper primero (y se recarga)' },
  regen: { icon: '✚', name: 'Regenerador', desc: 'recupera vida si dejas de darle' },
  kamikaze: { icon: '💥', name: 'Kamikaze', desc: 'se lanza contra ti y explota' },
  sniper: { icon: '🎯', name: 'Francotirador', desc: 'dispara de lejos: avisa antes con una línea' },
};
export const TRAIT_KEYS = Object.keys(TRAITS);
// cerca de ORIGEN y con la nave casi nueva, ninguno; luego, más cuanto más amenaza y peligro
export const eliteChance = (t, danger) => (t < 1.15 && danger < 2 ? 0 : Math.min(0.45, 0.06 * t + 0.02 * danger));
