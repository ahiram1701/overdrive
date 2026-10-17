// GALAXIA: sucesos de sistema, misiles, tipos de enemigo y planetas. Módulo puro (se testea en Node).
import { makeRng, hashString } from './rng.js';
import { ORES } from './galaxyData.js';

// ---------- Sucesos al entrar en un sistema ----------
export const EVENTS = {
  meteor: { icon: '☄️', name: 'LLUVIA DE METEORITOS', desc: 'mina rápido: dan el doble, pero duelen', time: 40 },
  rescue: { icon: '🆘', name: 'CÁPSULA DE RESCATE', desc: 'recógela y llévala a la estación' },
  convoy: { icon: '🚚', name: 'CONVOY MERCANTE', desc: 'acércate: compran tu carga a +40%' },
  wormhole: { icon: '🌀', name: 'AGUJERO DE GUSANO', desc: 'un atajo a un sistema al azar' },
  assault: { icon: '🏴‍☠️', name: 'BASE PIRATA', desc: 'destrúyela: sus torretas disparan' },
};

// ¿Qué pasa al llegar? Determinista por sistema y número de salto. ORIGEN siempre está tranquilo.
export function eventFor(sysId, jumpN, danger) {
  if (!sysId) return null;
  const rng = makeRng(hashString(`ev-${sysId}-${jumpN}`));
  if (rng.next() > 0.55) return null;
  const pool = ['meteor', 'rescue', 'convoy', 'wormhole'];
  if (danger >= 2) pool.push('assault', 'assault');
  return { kind: rng.pick(pool), id: `${sysId}-${jumpN}` };
}

// ---------- Misiles teledirigidos ----------
export const MISSILE = { speed: 420, turn: 3.2, life: 6, lockTime: 0.6, lockAng: 0.3, lockR: 900 };
export const missileAmmo = (lvl) => (lvl ? 2 + lvl * 2 : 0);
export const missileDmg = (lvl) => 50 + lvl * 15;

const len = (v) => Math.hypot(v.x, v.y, v.z);
const nrm = (v) => { const l = len(v) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };

// Gira la velocidad hacia el objetivo como mucho `turn` rad/s y avanza (misiles tuyos y del bombardero)
export function steerMissile(m, target, dt, turn = MISSILE.turn) {
  const speed = len(m.vel);
  if (target) {
    const want = nrm({ x: target.x - m.pos.x, y: target.y - m.pos.y, z: target.z - m.pos.z });
    const cur = nrm(m.vel);
    const d = Math.max(-1, Math.min(1, cur.x * want.x + cur.y * want.y + cur.z * want.z));
    const ang = Math.acos(d), step = turn * dt;
    const k = ang <= step || ang < 1e-6 ? 1 : step / ang;
    const dir = nrm({ x: cur.x + (want.x - cur.x) * k, y: cur.y + (want.y - cur.y) * k, z: cur.z + (want.z - cur.z) * k });
    m.vel = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
  }
  m.pos = { x: m.pos.x + m.vel.x * dt, y: m.pos.y + m.vel.y * dt, z: m.pos.z + m.vel.z * dt };
  m.life -= dt;
}

// Fijar blanco: mantén algo dentro del cono del visor `lockTime` segundos.
// cands: [{ ref, pos }]. Devuelve el estado { ref, t, locked }.
export function lockStep(lock, cands, from, f, dt) {
  let best = null, bestA = MISSILE.lockAng;
  for (const c of cands) {
    const d = { x: c.pos.x - from.x, y: c.pos.y - from.y, z: c.pos.z - from.z };
    const l = len(d);
    if (l > MISSILE.lockR || l < 1) continue;
    const a = Math.acos(Math.max(-1, Math.min(1, (d.x * f.x + d.y * f.y + d.z * f.z) / l)));
    if (a < bestA) { bestA = a; best = c.ref; }
  }
  // un blanco ya fijado se conserva aunque salga un poco del cono (si sigue a tiro)
  if (lock.locked && lock.ref && cands.some((c) => c.ref === lock.ref && len({ x: c.pos.x - from.x, y: c.pos.y - from.y, z: c.pos.z - from.z }) < MISSILE.lockR * 1.2)) {
    return lock;
  }
  if (!best) return { ref: null, t: 0, locked: false };
  const t = best === lock.ref ? lock.t + dt : dt;
  return { ref: best, t, locked: t >= MISSILE.lockTime };
}

// ---------- Enemigos ----------
export const ENEMY_KINDS = {
  fighter: { name: 'Caza', hpK: 1, speedK: 1, turnK: 1, size: 6 },
  interceptor: { name: 'Interceptor', hpK: 0.6, speedK: 1.6, turnK: 1.5, size: 5, mesh: 'spectra' },
  bomber: { name: 'Bombardero', hpK: 2.2, speedK: 0.65, turnK: 0.6, size: 9, mesh: 'titan', missiles: true },
  drone: { name: 'Dron', hpK: 0.35, speedK: 1.25, turnK: 1.8, size: 3.5, mesh: 'manta' },
};

// Mezcla según el peligro: lo nuevo aparece al alejarse de ORIGEN
export function enemyKind(danger, r) {
  if (danger < 2) return 'fighter';
  if (danger >= 3 && r < 0.2) return 'bomber';
  if (r < 0.45) return 'interceptor';
  if (r < 0.6) return 'drone';
  return 'fighter';
}

// ---------- Planetas (ORBITAR) ----------
const TYPES = [
  { type: 'Mundo oceánico', desc: 'Archipiélagos flotantes y tormentas que duran siglos.' },
  { type: 'Desierto ardiente', desc: 'Dunas de vidrio y ciudades enterradas bajo la arena.' },
  { type: 'Mundo selvático', desc: 'Una sola selva que cubre el planeta entero. Se oye respirar.' },
  { type: 'Gigante violeta', desc: 'Nubes de amoniaco y estaciones colgadas de globos.' },
];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

export function planetInfo(sysId, idx, sysName, danger) {
  const rng = makeRng(hashString(`pl-${sysId}-${idx}`));
  const t = TYPES[idx % TYPES.length];
  const ores = Object.keys(ORES);
  return {
    key: `${sysId}-${idx}`, name: `${sysName} ${ROMAN[idx] || idx + 1}`, ...t,
    buys: rng.pick(ores), mult: 1.5, reward: 80 + danger * 40,
  };
}
