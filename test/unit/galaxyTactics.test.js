import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dist } from '../../js/space3d.js';
import {
  attackTarget, wingSlot, spots, AGGRO_R, pickDiver, fireStep, BURST, inhibited, INHIBIT_R, stalkerVisible, STALK_R, rareKind, wingsFor, KEEP_R, ORBIT_R,
} from '../../js/galaxyTactics.js';

const me = { pos: { x: 0, y: 0, z: 0 }, f: { x: 0, y: 0, z: 1 }, r: { x: 1, y: 0, z: 0 }, speed: 90 };

test('alerta: te ven de cerca o si les disparas', () => {
  assert.ok(spots(AGGRO_R - 1, false));
  assert.ok(!spots(AGGRO_R + 1, false));
  assert.ok(spots(5000, true));
});

test('interceptor: entra por el costado y remata de cerca', () => {
  const p = { kind: 'interceptor', pos: { x: 0, y: 0, z: 800 }, flank: 1 };
  const t = attackTarget(p, me, 800);
  assert.ok(t.x > 200, 'apunta a tu lado, no a ti');
  const close = attackTarget(p, me, 200);
  assert.ok(Math.abs(close.x) < 1, 'de cerca, a por ti');
  const left = attackTarget({ ...p, flank: -1 }, me, 800);
  assert.ok(left.x < -200, 'el otro de la pareja, por el otro lado');
});

test('bombardero: se queda a distancia de misil', () => {
  const near = { kind: 'bomber', pos: { x: 0, y: 0, z: 300 } };
  assert.ok(dist(attackTarget(near, me, 300), me.pos) > 300, 'si te acercas, se aparta');
  const far = { kind: 'bomber', pos: { x: 0, y: 0, z: 1200 } };
  assert.equal(dist(attackTarget(far, me, 1200), me.pos), 0, 'si está lejos, se acerca');
  const mid = { kind: 'bomber', pos: { x: 0, y: 0, z: 560 } };
  const d = dist(attackTarget(mid, me, 560), me.pos);
  assert.ok(d >= KEEP_R[0] && d <= KEEP_R[1] + 60);
});

test('enjambre: orbitan a tu alrededor y se lanza uno a la vez', () => {
  const t = attackTarget({ kind: 'drone', pos: { x: 0, y: 0, z: 400 }, orbitA: 1 }, me, 400);
  assert.ok(Math.abs(dist(t, me.pos) - ORBIT_R) < 1);
  const drones = [1, 2, 3].map((i) => ({ alive: true, i }));
  const a = pickDiver(drones, 0), b = pickDiver(drones, 2.3);
  assert.ok(a && b && a !== b, 'se turnan');
  drones.forEach((q) => { q.alive = false; });
  assert.equal(pickDiver(drones, 0), null);
});

test('escuadrilla: las alas siguen al líder en V hasta acercarse', () => {
  assert.ok(wingSlot(0).r < 0 && wingSlot(1).r > 0 && wingSlot(0).f < 0, 'una a cada lado, detrás');
  const leader = { alive: true, pos: { x: 0, y: 0, z: 1000 }, f: { x: 0, y: 0, z: -1 } };
  const t = attackTarget({ kind: 'fighter', wing: 0, pos: { x: 0, y: 0, z: 1100 } }, me, 1100, { leader });
  assert.ok(dist(t, leader.pos) < 80, 'junto al líder');
  const solo = attackTarget({ kind: 'fighter', wing: 0, pos: { x: 0, y: 0, z: 1100 } }, me, 1100, { leader: { ...leader, alive: false } });
  assert.ok(dist(solo, me.pos) < 150, 'sin líder, a por ti');
});

test('caza: dispara en ráfagas de 3', () => {
  let p = { kind: 'fighter' };
  const cds = [];
  for (let i = 0; i < BURST.shots * 2; i++) { const r = fireStep(p, 1); cds.push(r.cd); p = { ...p, burstLeft: r.burstLeft }; }
  assert.deepEqual(cds.slice(0, 3), [BURST.gap, BURST.gap, 1.8]);
  assert.equal(fireStep({ kind: 'drone' }, 1).cd, 1);
});

test('inhibidor y acechador', () => {
  const inh = { alive: true, kind: 'inhibitor', pos: { x: 0, y: 0, z: INHIBIT_R - 10 } };
  assert.ok(inhibited([inh], me.pos));
  assert.ok(!inhibited([{ ...inh, pos: { x: 0, y: 0, z: INHIBIT_R + 10 } }], me.pos));
  assert.ok(!stalkerVisible({ kind: 'stalker', flash: 0 }, STALK_R + 1));
  assert.ok(stalkerVisible({ kind: 'stalker', flash: 0 }, STALK_R - 1));
  assert.ok(stalkerVisible({ kind: 'fighter', flash: 0 }, 5000));
});

test('tipos raros solo lejos de ORIGEN; escuadrillas desde peligro 2', () => {
  for (let r = 0; r < 1; r += 0.01) {
    assert.equal(rareKind(1, 1, r), null);
    assert.ok(!['inhibitor', 'stalker'].includes(rareKind(3, 3, r)));
  }
  assert.equal(rareKind(5, 1, 0.01), 'inhibitor');
  assert.equal(rareKind(5, 1, 0.1), 'stalker');
  assert.equal(wingsFor(1, 0), 0);
  assert.equal(wingsFor(3, 0.1), 2);
});
