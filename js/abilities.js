// Habilidades activas: una por nave, con recarga. Se lanzan con el botón ⚡ (o E/Q en teclado).
// Módulo puro (sin DOM ni estado global): los efectos los aplica game.js.

export const ABILITIES = {
  overclock: { name: 'SOBRECARGA', icon: '⏩', cd: 18, dur: 4, desc: '4 s de tiempo bala; los near-miss valen el doble.' },
  ram: { name: 'ARIETE', icon: '🐏', cd: 24, dur: 2.5, desc: '2,5 s rompiendo todo lo que tocas (sin poder saltar).' },
  phase: { name: 'FASE', icon: '👻', cd: 18, dur: 1.2, desc: '1,2 s intangible: lo que atraviesas cuenta como PERFECTO.' },
  nova: { name: 'ESTALLIDO', icon: '💥', cd: 25, dur: 0, desc: '+10% de overdrive y arrasa todo lo que tienes delante.' },
  roar: { name: 'RUGIDO', icon: '🦖', cd: 30, dur: 0, desc: 'Limpia los 3 carriles por delante y atrae todas las monedas.' },
  laser: { name: 'LÁSER', icon: '🔫', cd: 6, dur: 0, desc: 'Dispara por tu carril y rompe el primer obstáculo (o daña al jefe).' },
  hook: { name: 'GANCHO', icon: '🪝', cd: 10, dur: 0, desc: 'Te lanza al carril del extremo opuesto al instante.' },
  bubble: { name: 'BURBUJA', icon: '🫧', cd: 20, dur: 5, desc: '5 s dentro de una burbuja que absorbe el próximo golpe.' },
  blink: { name: 'SALTO CORTO', icon: '⚡', cd: 12, dur: 0, desc: 'Te teletransporta 35 m adelante (no con un jefe delante).' },
  barrier: { name: 'ESCUDO DE ENERGÍA', icon: '🔰', cd: 32, dur: 0, desc: '+1 escudo (si ya estás al máximo, 20 🪙).' },
  singularity: { name: 'SINGULARIDAD', icon: '🕳️', cd: 28, dur: 0, desc: 'Un agujero negro arrasa 50 m en los 3 carriles y atrae las monedas.' },
  chaos: { name: 'CAOS', icon: '🌀', cd: 22, dur: 0, desc: 'Arrasa lo que tienes delante (40 m) y cada pieza te da 5 🪙.' },
  hammer: { name: 'MARTILLO', icon: '🔨', cd: 16, dur: 0, desc: 'Rompe todo lo que hay en tu carril hasta 60 m (y golpea al jefe).' },
  // las de las naves EXCLUSIVAS (se ganan con un reto de cada juego)
  surge: { name: 'ESTELA', icon: '☄️', cd: 15, dur: 0, desc: 'Acelerón: 1 s intocable arrasando lo de delante y +6% de overdrive.' },
  quake: { name: 'TERREMOTO', icon: '🌋', cd: 22, dur: 0, desc: 'Sacude la pista: rompe los 3 carriles por delante y cada pieza da 3 🪙.' },
  salvage: { name: 'DESGUACE', icon: '♻️', cd: 19, dur: 0, desc: 'Convierte lo que tienes delante (30 m) en monedas y las atrae todas.' },
};

export const NEAR_MISS_CD = 0.15; // segundos de recarga que quita cada near-miss

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
