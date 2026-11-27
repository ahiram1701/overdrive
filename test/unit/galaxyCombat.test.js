import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newCombat, bumpStreak, breakStreak, streakMul, streakWord, STREAK, addSurge, startSurge, surgeOn, tickCombat, SURGE,
  ROLL, rollCooldown, rollInvuln, HEAT, shotHeat, vent, leadPos,
} from '../../js/galaxyCombat.js';
import { gearDpsK, power } from '../../js/galaxyThreat.js';
import { shipStats } from '../../js/galaxyData.js';

test('racha: sube con cada baja hasta el tope, paga más y caduca sin acción', () => {
  const c = newCombat();
  assert.equal(streakMul(0), 1);
  assert.equal(streakMul(1), 1, 'una baja sola no multiplica');
  for (let i = 0; i < 30; i++) bumpStreak(c);
  assert.equal(c.streak, STREAK.max);
  assert.ok(streakMul(c.streak) > 1.7 && streakMul(c.streak) <= 1.8, 'con la racha llena, hasta x1,8');
  assert.equal(c.best, STREAK.max);
  assert.ok(streakWord(20).length && streakWord(2).length && !streakWord(1));
  const out = tickCombat(c, STREAK.window + 0.1);
  assert.equal(out.lost, STREAK.max, 'caduca sin acción');
  assert.equal(c.streak, 0);
  bumpStreak(c);
  bumpStreak(c);
  assert.equal(breakStreak(c), 2);
  assert.equal(c.best, STREAK.max, 'la mejor racha se guarda');
});

test('racha: la palabra se anuncia solo al cruzar un umbral', () => {
  const c = newCombat();
  const said = [];
  for (let i = 0; i < 20; i++) { const w = bumpStreak(c); if (w) said.push(w); }
  assert.equal(new Set(said).size, said.length, 'sin repetir');
  assert.ok(said.length >= 4);
});

test('sobrecarga: se carga con bajas y roces, se activa llena y se agota', () => {
  const c = newCombat();
  assert.equal(startSurge(c), false, 'vacía no arranca');
  let full = false;
  for (let i = 0; i < 20 && !full; i++) full = addSurge(c, 'kill');
  assert.ok(full && c.surge === 1);
  assert.equal(addSurge(c, 'kill'), false, 'llena no avisa otra vez');
  assert.equal(startSurge(c), true);
  assert.ok(surgeOn(c));
  assert.equal(c.surge, 0);
  assert.equal(addSurge(c, 'graze'), false, 'durante la sobrecarga no se carga');
  const out = tickCombat(c, SURGE.dur + 0.01);
  assert.ok(out.surgeEnd && !surgeOn(c));
  const g = newCombat();
  let n = 0;
  while (!addSurge(g, 'graze')) n++;
  assert.ok(n > 5, `los roces cargan poco a poco (${n + 1})`);
});

test('tonel: invulnerable solo al principio y encadenarlo cansa', () => {
  assert.ok(rollInvuln(ROLL.anim));
  assert.ok(rollInvuln(ROLL.anim - ROLL.invuln + 0.01));
  assert.ok(!rollInvuln(ROLL.anim - ROLL.invuln - 0.01));
  assert.ok(!rollInvuln(0));
  const c = newCombat();
  const first = rollCooldown(c, 10);
  assert.equal(first, ROLL.cd);
  const second = rollCooldown(c, 11.4);
  const third = rollCooldown(c, 11.4 + second + 0.2);
  assert.ok(second > first && third > second, 'encadenado: cada vez tarda más');
  for (let i = 0, t = 20; i < 10; i++) { const cd = rollCooldown(c, t); assert.ok(cd <= ROLL.maxCd, 'con tope'); t += cd + 0.05; }
  assert.equal(rollCooldown(c, 100), ROLL.cd, 'descansando vuelve a lo normal');
  // spamearlo ya no da casi la mitad del tiempo invulnerable
  const uptime = ROLL.invuln / ROLL.maxCd;
  assert.ok(uptime < 0.12, `invulnerable ${Math.round(uptime * 100)}% del tiempo como mucho`);
});

test('calor: la nave nueva se sobrecalienta disparando sin parar, la rápida antes; ventilar en la franja', () => {
  const secsToOverheat = (fireCd) => {
    let h = 0, t = 0;
    while (h < 1 && t < 120) { h = Math.max(0, h - fireCd * HEAT.cool) + shotHeat(fireCd); t += fireCd; }
    return t;
  };
  const base = shipStats({}, 'viper', 'explorer');
  const top = shipStats({ laser: 5 }, 'viper', 'explorer');
  const tBase = secsToOverheat(base.fireCd), tTop = secsToOverheat(top.fireCd);
  assert.ok(tBase < 120, `nave nueva: ${tBase.toFixed(1)} s`);
  assert.ok(tTop < tBase && tTop > 2, `láser 5: ${tTop.toFixed(1)} s`);
  const ok = vent((HEAT.ventLo + HEAT.ventHi) / 2);
  assert.deepEqual(ok, { heat: 0, overheat: false, ok: true });
  const jam = vent(0.95);
  assert.ok(!jam.ok && jam.overheat && jam.heat === 1);
});

test('puntería: se adelanta al blanco que se mueve', () => {
  const p = leadPos({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 950 }, { x: 100, y: 0, z: 0 }, 950);
  assert.equal(p.z, 950);
  assert.ok(Math.abs(p.x - 100) < 1e-9, 'un segundo de vuelo: 100 m por delante');
});

test('poder: el equipo fabricado y los misiles cuentan para la amenaza', () => {
  const st = shipStats({}, 'viper', 'explorer');
  const none = { galaxyGear: {} };
  assert.equal(gearDpsK(none), 1);
  const armed = { galaxyGear: { owned: { laser2: true, plasma: true }, w: ['laser2', 'plasma'], m: [] } };
  assert.ok(gearDpsK(armed, 3) > 2, 'láser doble + plasma + misiles: más del doble');
  assert.ok(power(st, gearDpsK(armed, 3)) > power(st), 'una nave armada es más poderosa');
});

test('sobrecarga: se llena con unas 5 bajas y lo cargado sobrevive a una sesión nueva', async () => {
  const c = newCombat();
  let n = 0;
  while (!addSurge(c, 'kill')) n++;
  assert.ok(n + 1 <= 5, `${n + 1} bajas`);
  const again = newCombat(0.6);
  assert.equal(again.surge, 0.6, 'empieza con lo que llevabas');
  assert.equal(newCombat(7).surge, 1, 'con tope');
  const { loadFrom } = await import('../../js/save.js');
  assert.equal(loadFrom(JSON.stringify({ v: 6, galaxy: { credits: 5 } })).galaxy.surge, 0, 'guardado antiguo: 0');
});
