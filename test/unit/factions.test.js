import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genGalaxy } from '../../js/galaxy.js';
import { loadFrom } from '../../js/save.js';
import { FACTIONS, ownerOf, addRep, repOf, repLevel, bestAlly, pirateSystemsTotal, bountyBoard, moveBounty, bountyStats, nemesisUp, lvlAtLeast } from '../../js/factions.js';

const gal = genGalaxy();

test('dueños: ORIGEN y su vecindad nunca son piratas; lo lejano sí; liberar cambia el dueño', () => {
  assert.equal(ownerOf(gal[0]), 'coal');
  for (const s of gal) {
    assert.ok(FACTIONS[ownerOf(s)], s.name);
    if (s.danger <= 3) assert.notEqual(ownerOf(s), 'pir', `${s.name} demasiado cerca para ser pirata`);
    if (s.danger >= 5) assert.equal(ownerOf(s), 'pir');
  }
  const pir = gal.find((s) => ownerOf(s) === 'pir');
  assert.ok(pir && pirateSystemsTotal(gal) >= 3);
  assert.equal(ownerOf(pir, { [pir.id]: 'liga' }), 'liga');
});

test('reputación: con tope, niveles y a quién van los sistemas liberados', () => {
  const s = loadFrom(null);
  assert.equal(repLevel(repOf(s, 'liga')).id, 'neutral');
  assert.equal(addRep(s, 'liga', 25).id, 'amigo', 'avisa al subir de nivel');
  assert.equal(addRep(s, 'liga', 1), null);
  addRep(s, 'liga', 500);
  assert.equal(repOf(s, 'liga'), 100);
  assert.ok(lvlAtLeast(repOf(s, 'liga'), 'aliado'));
  assert.equal(bestAlly(s), 'liga');
  addRep(s, 'pir', -500);
  assert.equal(repLevel(repOf(s, 'pir')).id, 'hostil');
  assert.ok(repLevel(100).sell > repLevel(0).sell && repLevel(100).disc < 1);
});

test('cazarrecompensas: carteles deterministas, objetivos que se mueven y némesis', () => {
  const b = bountyBoard(gal, 0, 0);
  assert.equal(b.length, 3);
  assert.deepEqual(b, bountyBoard(gal, 0, 0));
  for (const x of b) {
    assert.ok(gal[x.sys].danger >= 2 && x.level >= 1 && x.reward > 0);
    assert.ok(bountyStats(x).hp > 0);
  }
  assert.equal(bountyBoard(gal, 0, 0, { [b[0].id]: true }).length, 2, 'los cazados no vuelven a salir');
  const t = b[0];
  assert.equal(moveBounty(gal, t, 1), t.sys, 'solo se mueve cada 3 saltos');
  const moved = moveBounty(gal, t, 3);
  assert.ok(gal[t.sys].links.includes(moved) || moved === t.sys);
  const n = nemesisUp(t);
  assert.equal(n.level, t.level + 1);
  assert.ok(n.reward > t.reward);
  assert.ok(bountyStats({ ...t, trait: 'blindado' }).hp > bountyStats({ ...t, trait: 'artillero' }).hp);
});
