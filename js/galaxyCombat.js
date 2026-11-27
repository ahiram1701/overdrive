// GALAXIA: el COMBATE con sensación. Módulo puro (se testea en Node).
// - RACHA: bajas, impactos de misil y esquives perfectos seguidos la suben (x1 → x20); paga más por baja.
//   Se pierde si pasan unos segundos sin acción o si te dan en el casco.
// - SOBRECARGA: el OVERDRIVE de la Galaxia. Se carga con bajas, roces y esquives perfectos; al soltarla,
//   unos segundos sin calor, con más daño y más cadencia.
// - TONEL con técnica: invulnerable solo al principio; repetirlo seguido lo cansa (más enfriamiento).
//   Si algo te iba a dar justo en esa ventana: ESQUIVE PERFECTO.
// - CALOR que importa desde el principio y VENTILACIÓN activa: sobrecalentado, toca disparo en la franja
//   y se enfría al momento; fuera de ella, se atasca.

// el escudo empieza a regenerarse tras este rato sin daño
export const SHIELD_DELAY = 3.5;
// ---------- Racha ----------
export const STREAK = { max: 20, window: 5 };
const WORDS = [[20, '¡LEYENDA!'], [15, '¡IMPARABLE!'], [10, '¡AS DEL VACÍO!'], [6, '¡FURIA!'], [3, '¡EN RACHA!'], [2, '¡DOBLE!']];
export const streakWord = (n) => WORDS.find(([k]) => n >= k)?.[1] || '';
// x1 sin racha; +4% por cada eslabón, hasta x1,8 con la racha llena
export const streakMul = (n) => 1 + Math.min(STREAK.max, Math.max(0, n - 1)) * 0.042;

// surge: lo que ya llevabas cargado (se guarda entre sesiones)
export function newCombat(surge = 0) {
  return { streak: 0, streakT: 0, best: 0, surge: Math.max(0, Math.min(1, surge || 0)), surgeT: 0, rollReady: -99, rollChain: 0 };
}
// sube la racha; devuelve la palabra si toca anunciarla (al cruzar un umbral)
export function bumpStreak(c, n = 1) {
  const before = streakWord(c.streak);
  c.streak = Math.min(STREAK.max, c.streak + n);
  c.streakT = STREAK.window;
  c.best = Math.max(c.best, c.streak);
  const now = streakWord(c.streak);
  return now !== before ? now : '';
}
// se pierde: devuelve cuánto tenías (para avisar si era una racha de verdad)
export function breakStreak(c) {
  const had = c.streak;
  c.streak = 0;
  c.streakT = 0;
  return had;
}

// ---------- Sobrecarga ----------
export const SURGE = { dur: 6, dmgMul: 1.5, fireMul: 1.4 };
// (unas 5 bajas la llenan; minar y los misiles también suman un poco)
export const SURGE_GAIN = { kill: 0.22, elite: 0.4, boss: 0.7, graze: 0.1, perfect: 0.3, vent: 0.1, missile: 0.05, rock: 0.02 };
export const surgeOn = (c) => c.surgeT > 0;
// carga la sobrecarga; devuelve true justo cuando se llena
export function addSurge(c, kind) {
  if (surgeOn(c) || c.surge >= 1) return false;
  c.surge = Math.min(1, c.surge + (SURGE_GAIN[kind] || 0));
  return c.surge >= 1;
}
export function startSurge(c) {
  if (c.surge < 1 || surgeOn(c)) return false;
  c.surge = 0;
  c.surgeT = SURGE.dur;
  return true;
}

// avanza el tiempo: la racha caduca y la sobrecarga se agota. Devuelve lo que pasó.
export function tickCombat(c, dt) {
  const out = { lost: 0, surgeEnd: false };
  if (c.streak > 0) {
    c.streakT -= dt;
    if (c.streakT <= 0) out.lost = breakStreak(c);
  }
  if (c.surgeT > 0) {
    c.surgeT -= dt;
    if (c.surgeT <= 0) { c.surgeT = 0; out.surgeEnd = true; }
  }
  return out;
}

// ---------- Tonel ----------
export const ROLL = { anim: 0.55, invuln: 0.22, cd: 1.3, chainWin: 1, chainAdd: 0.55, maxCd: 3.5 };
// enfriamiento del tonel: si lo encadenas (en cuanto vuelve a estar listo, antes de chainWin), cada vez tarda más
export function rollCooldown(c, now) {
  c.rollChain = now - c.rollReady < ROLL.chainWin ? c.rollChain + 1 : 0;
  const cd = Math.min(ROLL.maxCd, ROLL.cd + c.rollChain * ROLL.chainAdd);
  c.rollReady = now + cd;
  return cd;
}
// ¿sigue siendo invulnerable? barrelT cuenta hacia atrás desde ROLL.anim
export const rollInvuln = (barrelT) => barrelT > ROLL.anim - ROLL.invuln;

// ---------- Calor ----------
export const HEAT = { cool: 0.45, release: 0.35, ventLo: 0.6, ventHi: 0.78 };
// calor por disparo: a más cadencia, menos por tiro (pero más por segundo)
export const shotHeat = (fireCd) => 0.1 * Math.sqrt(fireCd / 0.2);
export const GEAR_HEAT = { laser2: 0.035, flak: 0.03, plasma: 0.06, rail: 0.05, burst: 0.025, ion: 0.015 };
// Sobrecalentado y pulsas disparo: en la franja se ventila (frío al instante); fuera, se atasca.
export const inVent = (heat) => heat >= HEAT.ventLo && heat <= HEAT.ventHi;
export function vent(heat) {
  return inVent(heat) ? { heat: 0, overheat: false, ok: true } : { heat: 1, overheat: true, ok: false };
}

// ---------- Puntería ----------
export const AIM_CONE = 0.22;
export const BOLT_SPEED = 950;
// a dónde disparar para dar a un blanco que se mueve (una iteración basta a estas velocidades)
export function leadPos(from, pos, vel, speed = BOLT_SPEED) {
  const d = Math.hypot(pos.x - from.x, pos.y - from.y, pos.z - from.z);
  const t = d / speed;
  return { x: pos.x + vel.x * t, y: pos.y + vel.y * t, z: pos.z + vel.z * t };
}

// ---------- Roces ----------
export const GRAZE_R = 16; // una bala enemiga que pasa a menos de esto sin darte (6) es un roce
