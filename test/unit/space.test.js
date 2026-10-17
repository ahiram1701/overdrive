import { test } from 'node:test';
import assert from 'node:assert/strict';
import { v3, basis, makeCam, project, projectDir, chaseCam, lookAngles, angleTo, dot, len, quatFromYawPitch, rotateLocal, basisQ, slerp, anglesOf } from '../../js/space3d.js';
import { shipStats, UPGRADES, upgradeCost, MAX_UP, makeSystem, cargoCount, cargoValue, repairCost, objective } from '../../js/galaxyData.js';

const close = (a, b, e = 1e-9) => Math.abs(a - b) < e;

test('base ortonormal y yaw/pitch hacia un punto', () => {
  for (const [y, p] of [[0, 0], [1, 0.3], [-2, -0.9], [3, 1.1]]) {
    const { f, r, u } = basis(y, p);
    for (const a of [f, r, u]) assert.ok(close(len(a), 1));
    assert.ok(close(dot(f, r), 0) && close(dot(f, u), 0) && close(dot(r, u), 0));
    assert.ok(u.y > 0, 'arriba apunta hacia arriba');
  }
  const a = lookAngles(v3(0, 0, 0), v3(10, 10, 0));
  assert.ok(close(a.yaw, Math.PI / 2));
  assert.ok(close(a.pitch, Math.PI / 4));
  assert.ok(angleTo(v3(), a.yaw, a.pitch, v3(10, 10, 0)) < 1e-6, 'mirando justo al punto');
});

test('proyección: derecha a la derecha, arriba arriba, lo de detrás no se ve', () => {
  const cam = makeCam(v3(0, 0, 0), 0, 0, 400, 800);
  const c = project(cam, v3(0, 0, 50));
  assert.ok(close(c.x, 200) && close(c.y, 400));
  assert.ok(project(cam, v3(5, 0, 50)).x > 200);
  assert.ok(project(cam, v3(0, 5, 50)).y < 400);
  assert.equal(project(cam, v3(0, 0, -5)), null);
  assert.ok(project(cam, v3(0, 0, 10)).s > project(cam, v3(0, 0, 100)).s, 'lo cercano, más grande');
  assert.ok(projectDir(cam, { x: 0, y: 0, z: 1 }));
});

test('cámara de persecución: detrás de la nave y sin derivar con el tiempo', () => {
  const ship = { pos: v3(100, 0, 100), yaw: 0.7, pitch: 0.2 };
  let cam = null;
  for (let i = 0; i < 600; i++) cam = chaseCam(cam, ship, 1 / 60, 375, 812);
  // la nave queda delante de la cámara, en la mitad de abajo de la pantalla
  const p = project(cam, ship.pos);
  assert.ok(p && p.z > 5 && p.z < 20);
  assert.ok(close(p.x, 187.5, 0.5));
  assert.ok(p.y > 406, 'tercio inferior');
  assert.ok(close(cam.sPitch, 0.2, 1e-6), 'la orientación no deriva');
});

test('economía: mejoras con coste creciente y stats que suben', () => {
  for (const id of Object.keys(UPGRADES)) {
    for (let l = 1; l < MAX_UP; l++) assert.ok(upgradeCost(id, l) > upgradeCost(id, l - 1));
    assert.equal(upgradeCost(id, MAX_UP), null);
  }
  const a = shipStats({}), b = shipStats({ engine: 5, laser: 5, shield: 5, cargo: 5 });
  for (const k of ['speed', 'turn', 'dmg', 'shield', 'cargo']) assert.ok(b[k] > a[k], k);
  assert.ok(b.fireCd < a.fireCd);
  assert.equal(cargoCount({ iron: 3, crystal: 2 }), 5);
  assert.equal(cargoValue({ iron: 3 }), 24);
  assert.equal(repairCost(100, 100), 0);
  assert.ok(repairCost(50, 100) > 0);
  // un viaje con la bodega llena paga la primera mejora (el primer bucle es rápido)
  const cheapest = Math.min(...Object.keys(UPGRADES).map((k) => upgradeCost(k, 0)));
  assert.ok(cargoValue({ iron: a.cargo }) >= cheapest);
});

test('sistema determinista y objetivo según lo que llevas', () => {
  assert.deepEqual(makeSystem(1), makeSystem(1));
  const sys = makeSystem(1);
  assert.equal(sys.asteroids.length, 80);
  assert.equal(objective({ cargo: { iron: 0 }, cargoMax: 20, credits: 0, up: {}, sold: false }).kind, 'mine');
  assert.equal(objective({ cargo: { iron: 20 }, cargoMax: 20, credits: 0, up: {}, sold: false }).kind, 'sell');
  assert.equal(objective({ cargo: { iron: 0 }, cargoMax: 20, credits: 500, up: {}, sold: true }).kind, 'upgrade');
});

test('cuaterniones: equivalen a yaw/pitch, se mantienen normalizados y un rizo vuelve al rumbo', () => {
  for (const [y, p] of [[0, 0], [1, 0.3], [-2, -0.9]]) {
    const a = basis(y, p), b = basisQ(quatFromYawPitch(y, p));
    for (const k of ['f', 'r', 'u']) for (const c of ['x', 'y', 'z']) assert.ok(close(a[k][c], b[k][c], 1e-9), `${k}.${c}`);
  }
  let q = quatFromYawPitch(0.4, 0);
  const f0 = basisQ(q).f;
  // rizo completo en 600 pasos: nunca se desnormaliza y vuelve exactamente al mismo rumbo
  for (let i = 0; i < 600; i++) {
    q = rotateLocal(q, (Math.PI * 2) / 600, 0, 0);
    assert.ok(close(Math.hypot(q.w, q.x, q.y, q.z), 1, 1e-9));
  }
  const f1 = basisQ(q).f;
  assert.ok(close(dot(f0, f1), 1, 1e-9), 'mismo rumbo tras 360°');
  // a mitad del rizo vas boca abajo, mirando hacia atrás
  const half = rotateLocal(quatFromYawPitch(0, 0), Math.PI, 0, 0);
  assert.ok(basisQ(half).u.y < -0.99 && basisQ(half).f.z < -0.99);
  // alabeo a la derecha: el ala derecha baja; guiñada a la derecha: el morro va a +x
  assert.ok(basisQ(rotateLocal(quat0(), 0, 0, 0.3)).r.y < 0);
  assert.ok(basisQ(rotateLocal(quat0(), 0, 0.3, 0)).f.x > 0);
  assert.ok(basisQ(rotateLocal(quat0(), 0.3, 0, 0)).f.y > 0, 'cabeceo positivo = morro arriba');
  for (const k of ['f', 'r', 'u']) assert.ok(close(len(basisQ(q)[k]), 1));
  // slerp en los extremos
  const a = quatFromYawPitch(0, 0), b = quatFromYawPitch(1, 0.5);
  assert.ok(close(anglesOf(basisQ(slerp(a, b, 1)).f).yaw, 1, 1e-6));
  assert.ok(close(anglesOf(basisQ(slerp(a, b, 0)).f).yaw, 0, 1e-6));
});

test('cámara de persecución boca abajo: sigue el "arriba" de la nave', () => {
  const q = rotateLocal(quatFromYawPitch(0, 0), Math.PI, 0, 0);
  const ship = { pos: v3(), q };
  let cam = null;
  for (let i = 0; i < 300; i++) cam = chaseCam(cam, ship, 1 / 60, 375, 812);
  assert.ok(cam.u.y < -0.9, 'la cámara también está invertida');
  const p = project(cam, ship.pos);
  assert.ok(p && p.y > 406, 'la nave sigue en el tercio inferior de la pantalla');
});

function quat0() { return quatFromYawPitch(0, 0); }
