// Jefes: cada uno con forma, color, ataques propios y una segunda fase al bajar al 50% de vida.
// Módulo puro (datos y reglas); los ataques los ejecuta world.js.

export const BOSSES = [
  { id: 'gusano', name: 'GUSANO DE NEÓN', color: '#ff2bd6', shape: 'worm', phases: [['shots'], ['shots', 'wallRain']] },
  { id: 'ojo', name: 'OJO DEL VACÍO', color: '#39ff14', shape: 'eye', phases: [['beam'], ['beam', 'shots']] },
  { id: 'devorador', name: 'DEVORADOR', color: '#ff9500', shape: 'maw', phases: [['mines', 'suction'], ['mines', 'suction', 'shots']] },
  { id: 'censor', name: 'EL CENSOR', color: '#5ac8fa', shape: 'cube', shieldedCore: true, phases: [['barrage'], ['barrage', 'beam']] },
  { id: 'ovni', name: 'MAMÁ OVNI', color: '#bf5af2', shape: 'ufo', phases: [['shots', 'drones'], ['barrage', 'drones', 'mines']] },
];

export const BOSS_BY_ID = Object.fromEntries(BOSSES.map((b) => [b.id, b]));

// Cada cuánto lanza cada ataque (segundos, antes de escalar con el tramo y la fase)
export const ATTACK_EVERY = { shots: 1.35, wallRain: 3, beam: 2.6, mines: 2.3, suction: 3.6, barrage: 2.9, drones: 4.2 };

// Jefe del n-ésimo encuentro (cada 3 tramos sale el siguiente)
export const bossFor = (encounter) => BOSSES[encounter % BOSSES.length];

export const phaseOf = (hp, max) => (hp / max <= 0.5 ? 1 : 0);

// Recarga de un ataque: más rápida en tramos avanzados y en la fase 2
export function attackCooldown(attack, section, phase) {
  return ATTACK_EVERY[attack] * Math.max(0.55, 1 - section * 0.025) * (phase ? 0.8 : 1);
}
