// Habilidades activas: una por nave, con recarga. Se lanzan con el botón ⚡ (o E/Q en teclado).
// Módulo puro (sin DOM ni estado global): los efectos los aplica game.js.

export const ABILITIES = {
  overclock: { name: 'SOBRECARGA', icon: '⏩', cd: 18, dur: 4, desc: '4 s de tiempo bala; los near-miss valen el doble.' },
  ram: { name: 'ARIETE', icon: '🐏', cd: 20, dur: 2.5, desc: '2,5 s rompiendo todo lo que tocas (sin poder saltar).' },
  phase: { name: 'FASE', icon: '👻', cd: 16, dur: 1.2, desc: '1,2 s intangible: lo que atraviesas cuenta como PERFECTO.' },
  nova: { name: 'ESTALLIDO', icon: '💥', cd: 25, dur: 0, desc: '+50% de overdrive y arrasa todo lo que tienes delante.' },
  roar: { name: 'RUGIDO', icon: '🦖', cd: 30, dur: 0, desc: 'Limpia los 3 carriles por delante y atrae todas las monedas.' },
  laser: { name: 'LÁSER', icon: '🔫', cd: 6, dur: 0, desc: 'Dispara por tu carril y rompe el primer obstáculo (o daña al jefe).' },
  hook: { name: 'GANCHO', icon: '🪝', cd: 10, dur: 0, desc: 'Te lanza al carril del extremo opuesto al instante.' },
};

export const NEAR_MISS_CD = 0.3; // segundos de recarga que quita cada near-miss

// mods: { cd, dur, pow: multiplicadores; mut: id de mutación } (árbol de mejoras del hangar)
export function newAbility(id, mods = {}) {
  const d = ABILITIES[id];
  return { id, cd: d.cd * (mods.cd ?? 1), dur: d.dur * (mods.dur ?? 1), pow: mods.pow ?? 1, mut: mods.mut || null, cdLeft: 0, active: 0 };
}

export const canUse = (a) => a.cdLeft <= 0 && a.active <= 0;

// Lanza la habilidad. La recarga empieza cuando termina el efecto.
export function trigger(a) {
  if (!canUse(a)) return false;
  a.active = a.dur;
  a.cdLeft = a.cd;
  return true;
}

// Devuelve 'ended' en el paso en que termina el efecto y 'ready' en el que vuelve a estar lista.
export function tickAbility(a, dt) {
  if (a.active > 0) {
    a.active -= dt;
    if (a.active <= 0) { a.active = 0; return 'ended'; }
    return null;
  }
  if (a.cdLeft > 0) {
    a.cdLeft -= dt;
    if (a.cdLeft <= 0) { a.cdLeft = 0; return 'ready'; }
  }
  return null;
}

export function onNearMissCd(a) {
  if (a.active > 0 || a.cdLeft <= 0) return false;
  a.cdLeft = Math.max(0, a.cdLeft - NEAR_MISS_CD);
  return a.cdLeft === 0;
}

export const isActive = (a, id) => !!a && a.id === id && a.active > 0;

// Fracción para el anillo del botón: 1 = lista (o activa)
export const readiness = (a) => (a.active > 0 || a.cdLeft <= 0 ? 1 : 1 - a.cdLeft / a.cd);
