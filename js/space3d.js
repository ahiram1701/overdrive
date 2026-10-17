// GALAXIA: matemáticas 3D propias (sin librerías). Módulo puro, se testea en Node.
// Ejes del mundo: x derecha, y arriba, z adelante. Las orientaciones son yaw (giro a los lados,
// alrededor de y) y pitch (morro arriba/abajo); el alabeo (roll) es solo visual.

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

// Cámara de persecución: detrás y algo por encima de la nave, siguiéndola con suavidad
export function chaseCam(prev, ship, dt, w, h) {
  const b = basis(ship.yaw, ship.pitch);
  const want = add(add(ship.pos, scale(b.f, -13)), scale(b.u, 3.6));
  const k = Math.min(1, dt * 7);
  const pos = prev ? add(prev.pos, scale(sub(want, prev.pos), k)) : want;
  // se suaviza la orientación SIN el desfase de encuadre (si no, el desfase se acumula cada fotograma)
  const yaw = prev ? prev.sYaw + angDiff(ship.yaw, prev.sYaw) * Math.min(1, dt * 9) : ship.yaw;
  const pitch = prev ? prev.sPitch + (ship.pitch - prev.sPitch) * Math.min(1, dt * 9) : ship.pitch;
  // apunta un poco por encima de la nave: así queda en el tercio inferior y se ve lo que viene
  return { ...makeCam(pos, yaw, pitch + 0.1, w, h), sYaw: yaw, sPitch: pitch };
}

// Ángulo entre la dirección "adelante" y un punto (para el autoapuntado y "lo tengo delante")
export function angleTo(from, yaw, pitch, p) {
  const f = basis(yaw, pitch).f;
  const d = norm(sub(p, from));
  return Math.acos(Math.max(-1, Math.min(1, dot(f, d))));
}
