// GALAXIA: matemáticas 3D propias (sin librerías). Módulo puro, se testea en Node.
// Ejes del mundo: x derecha, y arriba, z adelante. La nave se orienta con un CUATERNIÓN (sin tope de
// cabeceo: rizos, vuelo invertido y alabeo); yaw/pitch quedan para lo que solo necesita una dirección.

export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const len = (a) => Math.hypot(a.x, a.y, a.z);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const norm = (a) => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
export const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

// Base (adelante, derecha, arriba) de una orientación yaw/pitch
export function basis(yaw, pitch) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
  const f = { x: cp * sy, y: sp, z: cp * cy };
  const r = { x: cy, y: 0, z: -sy };
  const u = cross(f, r); // arriba = adelante × derecha (con estos ejes sale hacia +y)
  return { f, r, u };
}

// ---------- Cuaterniones { w, x, y, z } ----------
// Ejes locales de la nave: +z adelante, +x derecha, +y arriba.
export const quat = (w = 1, x = 0, y = 0, z = 0) => ({ w, x, y, z });
export function qmul(a, b) {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}
export function qnorm(q) {
  const l = Math.hypot(q.w, q.x, q.y, q.z) || 1;
  return { w: q.w / l, x: q.x / l, y: q.y / l, z: q.z / l };
}
export const qaxis = (ax, ang) => { const s = Math.sin(ang / 2); return { w: Math.cos(ang / 2), x: ax.x * s, y: ax.y * s, z: ax.z * s }; };
// gira un vector con el cuaternión
export function qrot(q, v) {
  const tx = 2 * (q.y * v.z - q.z * v.y), ty = 2 * (q.z * v.x - q.x * v.z), tz = 2 * (q.x * v.y - q.y * v.x);
  return { x: v.x + q.w * tx + (q.y * tz - q.z * ty), y: v.y + q.w * ty + (q.z * tx - q.x * tz), z: v.z + q.w * tz + (q.x * ty - q.y * tx) };
}
const X = { x: 1, y: 0, z: 0 }, Y = { x: 0, y: 1, z: 0 }, Z = { x: 0, y: 0, z: 1 };
// orientación equivalente a yaw/pitch (sin alabeo)
export const quatFromYawPitch = (yaw, pitch) => qmul(qaxis(Y, yaw), qaxis(X, -pitch));
// gira en los ejes DE LA NAVE: pitch>0 morro arriba, yaw>0 a la derecha, roll>0 ala derecha abajo
export function rotateLocal(q, pitch, yaw, roll) {
  let r = q;
  if (pitch) r = qmul(r, qaxis(X, -pitch));
  if (yaw) r = qmul(r, qaxis(Y, yaw));
  if (roll) r = qmul(r, qaxis(Z, -roll));
  return qnorm(r);
}
export const basisQ = (q) => ({ f: qrot(q, Z), r: qrot(q, X), u: qrot(q, Y) });
// interpolación esférica (cámara suave)
export function slerp(a, b, t) {
  let d = a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;
  let c = b;
  if (d < 0) { d = -d; c = { w: -b.w, x: -b.x, y: -b.y, z: -b.z }; }
  if (d > 0.9995) return qnorm({ w: a.w + (c.w - a.w) * t, x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t, z: a.z + (c.z - a.z) * t });
  const th = Math.acos(d), s0 = Math.sin((1 - t) * th) / Math.sin(th), s1 = Math.sin(t * th) / Math.sin(th);
  return { w: a.w * s0 + c.w * s1, x: a.x * s0 + c.x * s1, y: a.y * s0 + c.y * s1, z: a.z * s0 + c.z * s1 };
}
// yaw/pitch de una dirección (para el código que solo necesita "hacia dónde mira")
export const anglesOf = (f) => ({ yaw: Math.atan2(f.x, f.z), pitch: Math.asin(Math.max(-1, Math.min(1, f.y))) });

// yaw/pitch que miran desde a hacia b
export function lookAngles(a, b) {
  const d = sub(b, a);
  return { yaw: Math.atan2(d.x, d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) };
}

// diferencia de ángulos en (-π, π]
export const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// ---------- Cámara ----------
// cam = { pos, yaw, pitch, focal, w, h }. Devuelve { x, y, s (escala), z (profundidad) } o null si
// está detrás de la cámara.
export function makeCam(pos, yaw, pitch, w, h, fov = 1.15) {
  const b = basis(yaw, pitch);
  return { pos, yaw, pitch, ...b, w, h, focal: (Math.min(w, h * 1.1) / 2) / Math.tan(fov / 2) };
}

export function project(cam, p, near = 0.5) {
  const d = sub(p, cam.pos);
  const z = dot(d, cam.f);
  if (z < near) return null;
  const s = cam.focal / z;
  return { x: cam.w / 2 + dot(d, cam.r) * s, y: cam.h / 2 - dot(d, cam.u) * s, s, z };
}

// Una dirección (sin posición): para estrellas "en el infinito"
export function projectDir(cam, dir) {
  const z = dot(dir, cam.f);
  if (z < 0.05) return null;
  const s = cam.focal / z;
  return { x: cam.w / 2 + dot(dir, cam.r) * s, y: cam.h / 2 - dot(dir, cam.u) * s };
}

// Cámara con una base cualquiera (f, r, u)
export const makeCamB = (pos, b, w, h, fov = 1.15) => ({ pos, ...b, w, h, focal: (Math.min(w, h * 1.1) / 2) / Math.tan(fov / 2) });

// Cámara de persecución: detrás y algo por encima de la nave, con SU "arriba" (los rizos y el
// vuelo invertido se ven como tales) y siguiéndola con suavidad
export function chaseCam(prev, ship, dt, w, h) {
  const q = ship.q || quatFromYawPitch(ship.yaw, ship.pitch);
  const b = basisQ(q);
  const want = add(add(ship.pos, scale(b.f, -13)), scale(b.u, 3.6));
  const k = Math.min(1, dt * 7);
  const pos = prev ? add(prev.pos, scale(sub(want, prev.pos), k)) : want;
  // se suaviza la orientación SIN el desfase de encuadre (si no, el desfase se acumula cada fotograma)
  const sq = prev?.sq ? slerp(prev.sq, q, Math.min(1, dt * 9)) : q;
  // apunta un poco por encima de la nave: así queda en el tercio inferior y se ve lo que viene
  const look = basisQ(rotateLocal(sq, 0.1, 0, 0));
  const a = anglesOf(basisQ(sq).f);
  return { ...makeCamB(pos, look, w, h), sq, sYaw: a.yaw, sPitch: a.pitch };
}

// Ángulo entre la dirección "adelante" y un punto (para el autoapuntado y "lo tengo delante")
export function angleTo(from, yaw, pitch, p) {
  const f = basis(yaw, pitch).f;
  const d = norm(sub(p, from));
  return Math.acos(Math.max(-1, Math.min(1, dot(f, d))));
}
