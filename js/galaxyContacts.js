// GALAXIA: VIAJES CON VIDA. Módulo puro (se testea en Node).
// - CONTACTOS en ruta: fuera de la zona segura, cada poco sale algo en el radar (auxilio, contrabandista,
//   anillos de carrera, tormenta iónica, emboscada, contenedor a la deriva).
// - SUPERCRUCERO: con el motor a tope y sin enemigos cerca, la nave acelera poco a poco hasta ×4.
//   Un contacto, un enemigo o un inhibidor te sacan de golpe.
// - INTERDICCIÓN: muy buscado, los piratas te pueden sacar del hiperespacio. Forcejea (toca disparo)
//   para escapar; si no, llegas con cazadores.

export const CONTACTS = {
  distress: { icon: '🆘', name: 'Llamada de auxilio', w: 3, text: 'Acude a la llamada de auxilio' },
  smuggler: { icon: '🏃', name: 'Contrabandista', w: 2, text: '¡Un contrabandista huye con su carga! derríbalo', from: 1 },
  rings: { icon: '💠', name: 'Anillos de carrera', w: 2, text: 'Cruza los anillos a tiempo' },
  storm: { icon: '⚡', name: 'Tormenta iónica', w: 2, text: 'Tormenta iónica: dentro no hay escudo, pero hay mineral raro', from: 2 },
  ambush: { icon: '🪤', name: 'Emboscada', w: 1, text: '¡Emboscada desde el cinturón!', from: 2 },
  container: { icon: '📦', name: 'Contenedor a la deriva', w: 2, text: 'Recoge el contenedor (tiene guardianes)', from: 1 },
};
export const CONTACT_KEYS = Object.keys(CONTACTS);
export const CONTACT_LIFE = 60; // si no vas, se pierde
export const nextContactDelay = (r) => 25 + r * 15;
export function pickContact(danger, r) {
  const pool = CONTACT_KEYS.filter((k) => danger >= (CONTACTS[k].from || 0));
  const total = pool.reduce((a, k) => a + CONTACTS[k].w, 0);
  let x = r * total;
  for (const k of pool) { x -= CONTACTS[k].w; if (x < 0) return k; }
  return pool[pool.length - 1];
}
// AUXILIO: a veces es una trampa (más cuanto más lejos de ORIGEN)
export const trapChance = (danger) => Math.min(0.45, 0.15 + 0.05 * danger);
export const contactReward = (kind, danger) => ({ distress: 160 + 70 * danger, smuggler: 320 + 110 * danger, rings: 140 + 60 * danger, container: 220 + 80 * danger })[kind] || 0;

// ANILLOS: una curva delante de ti; hay que cruzarlos en orden
export const RINGS = { n: 5, gap: 170, r: 26, time: 16 };
export function ringPath(start, f, r, side) {
  const out = [];
  for (let i = 0; i < RINGS.n; i++) {
    const k = (i + 1) * RINGS.gap, curve = Math.sin(i * 0.9) * 90 * side;
    out.push({ x: start.x + f.x * k + r.x * curve, y: start.y + f.y * k + Math.cos(i * 1.3) * 40, z: start.z + f.z * k + r.z * curve });
  }
  return out;
}
// lo que paga según los anillos cruzados (todos: el premio entero y un extra)
export const ringPay = (done, danger) => Math.round(contactReward('rings', danger) * (done / RINGS.n) * (done === RINGS.n ? 1.5 : 1));

// ---------- Supercrucero ----------
export const CRUISE = { max: 4, ramp: 0.55, clearR: 1500, minThr: 0.95 };
// devuelve el multiplicador nuevo: sube despacio si puedes, cae a 1 si no
export function cruiseStep(k, dt, ok) {
  if (!ok) return 1;
  return Math.min(CRUISE.max, (k || 1) + CRUISE.ramp * dt);
}

// ---------- Interdicción ----------
export const INTERDICT = { time: 3.2, taps: 9 };
export const interdictChance = (stars) => (stars < 3 ? 0 : Math.min(0.45, 0.15 * (stars - 2)));
