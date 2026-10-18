// Jefes: cada uno con forma, color, ataques propios y una segunda fase al bajar al 50% de vida.
// Módulo puro (datos y reglas); los ataques los ejecuta world.js.

export const BOSSES = [
  { id: 'gusano', name: 'GUSANO DE NEÓN', color: '#ff2bd6', shape: 'worm', phases: [['shots'], ['shots', 'wallRain']] },
  { id: 'ojo', name: 'OJO DEL VACÍO', color: '#39ff14', shape: 'eye', phases: [['beam'], ['beam', 'shots']] },
  { id: 'devorador', name: 'DEVORADOR', color: '#ff9500', shape: 'maw', phases: [['mines', 'suction'], ['mines', 'suction', 'shots']] },
  { id: 'censor', name: 'EL CENSOR', color: '#5ac8fa', shape: 'cube', shieldedCore: true, phases: [['barrage'], ['barrage', 'beam']] },
  { id: 'ovni', name: 'MAMÁ OVNI', color: '#bf5af2', shape: 'ufo', phases: [['shots', 'drones'], ['barrage', 'drones', 'mines']] },
  { id: 'leviatan', name: 'LEVIATÁN DE HIELO', color: '#7df9ff', shape: 'serpent', phases: [['icicles', 'shots'], ['icicles', 'freeze', 'shots']] },
];

export const BOSS_BY_ID = Object.fromEntries(BOSSES.map((b) => [b.id, b]));

// Cada cuánto lanza cada ataque (segundos, antes de escalar con el tramo y la fase)
export const ATTACK_EVERY = { shots: 1.35, wallRain: 3, beam: 2.6, mines: 2.3, suction: 3.6, barrage: 2.9, drones: 4.2, icicles: 2.6, freeze: 4.2 };

// Jefe del n-ésimo encuentro (cada 3 tramos sale el siguiente)
export const bossFor = (encounter) => BOSSES[encounter % BOSSES.length];

export const phaseOf = (hp, max) => (hp / max <= 0.5 ? 1 : 0);

// Recarga de un ataque: más rápida en tramos avanzados y en la fase 2
export function attackCooldown(attack, section, phase) {
  return ATTACK_EVERY[attack] * Math.max(0.55, 1 - section * 0.025) * (phase ? 0.8 : 1);
}

// JEFE ÉLITE: sus ataques de la fase 2 desde el principio, más uno prestado de otro jefe.
// Las dos "fases" son iguales: ya no hay respiro a mitad de combate.
export function makeElite(def, extraAttack) {
  const atks = [...new Set([...def.phases[1], ...(extraAttack ? [extraAttack] : [])])];
  return { ...def, elite: true, name: `${def.name} ÉLITE`, phases: [atks, atks] };
}

// Vida de un jefe: crece con el tramo, con tope (en la campaña infinita el tramo sube mucho)
export const bossHp = (section, elite = false) => {
  const hp = Math.min(elite ? 7 : 10, 3 + Math.floor(section / 3));
  return elite ? Math.round(hp * 1.5) : hp;
};
