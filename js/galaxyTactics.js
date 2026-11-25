// GALAXIA: TÁCTICAS de los piratas. Módulo puro (se testea en Node).
// Cada tipo pelea a su manera y no todos vienen de frente:
// - CAZA: pasadas de justa con ráfagas de 3 tiros.
// - INTERCEPTOR: entra por un costado (nunca de frente) y remata de cerca.
// - DRON: el enjambre te rodea en órbita y se lanza de uno en uno.
// - BOMBARDERO: se queda a distancia de misil y se aparta si te acercas.
// - ESCUADRILLAS: un líder con sus alas en V; si cae el líder, las alas se dispersan.
// - ALERTA: patrullan su zona y no te ven hasta que te acercas (o les disparas). El primero que te ve
//   pide REFUERZOS por radio: si no lo abates a tiempo, llegan más.
// - INHIBIDOR (peligro 4+): cerca de él no hay impulso ni salto. ACECHADOR: invisible hasta que está encima.
import { add, sub, scale, norm, dist, cross } from './space3d.js';

export const AGGRO_R = 900; // a esta distancia te ven
export const CALL_TIME = 20; // segundos que tarda la radio en traer refuerzos
export const CALL_ADDS = 2; // cuántos refuerzos llegan
export const FIRE_CONE = 0.26; // cono de disparo enemigo (antes 0,18: casi nunca te apuntaban)
export const BURST = { shots: 3, gap: 0.13 }; // ráfaga del caza
export const INHIBIT_R = 400;
export const STALK_R = 300; // el acechador se ve a menos de esto
export const ORBIT_R = 150; // radio de la órbita del enjambre
export const KEEP_R = [480, 680]; // el bombardero se queda en esta franja

// posiciones en V detrás del líder (en su sistema de ejes: r derecha, f delante)
export function wingSlot(i) {
  const side = i % 2 ? 1 : -1, row = Math.floor(i / 2) + 1;
  return { r: side * 38 * row, f: -34 * row };
}

// ¿Te ve? por distancia o porque le has dado
export const spots = (d, wasHit) => wasHit || d < AGGRO_R;

// A dónde vuela un pirata que te ataca, según su tipo.
// p: pirata ({ pos, kind, flank, orbitA, dive, leader }), me: tu nave ({ pos, f, r, speed }), d: distancia, dt
export function attackTarget(p, me, d, ctx = {}) {
  const lead = add(me.pos, scale(me.f, (me.speed || 90) * Math.min(1, d / 400)));
  // ALA en formación: sigue al líder hasta que está cerca de ti
  if (ctx.leader && ctx.leader.alive && d > 350) {
    const L = ctx.leader, slot = wingSlot(p.wing || 0);
    const lr = norm(cross(L.f || { x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 0 }));
    return add(add(L.pos, scale(lr, slot.r)), scale(L.f || { x: 0, y: 0, z: 1 }, slot.f));
  }
  switch (p.kind) {
    case 'interceptor': {
      // por el costado: un punto a tu lado (el suyo) hasta que está a menos de 260 m
      if (d < 260) return lead;
      return add(add(me.pos, scale(me.r, (p.flank || 1) * 260)), scale(me.f, 120));
    }
    case 'drone': {
      if (p.dive) return lead; // el que se lanza, a por ti
      const a = p.orbitA || 0;
      const ring = norm(add(scale(me.r, Math.cos(a)), scale({ x: 0, y: 1, z: 0 }, Math.sin(a) * 0.6)));
      return add(me.pos, scale(ring, ORBIT_R));
    }
    case 'carrier': case 'mender': case 'wraith': {
      // se quedan lejos: la nodriza suelta drones, el reparador cura desde atrás, el tirador apunta
      const keep = p.kind === 'wraith' ? 900 : 650;
      if (d < keep - 100) return add(p.pos, scale(norm(sub(p.pos, me.pos)), 300));
      return d > keep + 150 ? me.pos : p.pos;
    }
    case 'bomber': {
      // a distancia de misil: si te acercas, se aparta
      if (d < KEEP_R[0]) return add(p.pos, scale(norm(sub(p.pos, me.pos)), 400));
      if (d > KEEP_R[1]) return me.pos;
      return add(me.pos, scale(norm(sub(p.pos, me.pos)), (KEEP_R[0] + KEEP_R[1]) / 2 + 40));
    }
    default:
      return lead;
  }
}

// ENJAMBRE: un dron a la vez se lanza; los demás orbitan. Devuelve el que se lanza (o null).
export function pickDiver(drones, t) {
  const alive = drones.filter((q) => q.alive);
  if (!alive.length) return null;
  return alive[Math.floor(t / 2.2) % alive.length];
}

// ¿Dispara ya? Los cazas disparan en ráfagas; el resto, un tiro cada vez.
// Devuelve { fire, cd, burstLeft }
export function fireStep(p, baseCd) {
  if (p.kind === 'fighter' && !p.boss) {
    const left = p.burstLeft ?? BURST.shots;
    if (left > 1) return { fire: true, cd: BURST.gap, burstLeft: left - 1 };
    return { fire: true, cd: baseCd * 1.8, burstLeft: BURST.shots };
  }
  return { fire: true, cd: baseCd, burstLeft: p.burstLeft };
}

// Inhibidor cerca: ni impulso ni salto
export const inhibited = (pirates, pos) => pirates.some((p) => p.alive && p.kind === 'inhibitor' && dist(p.pos, pos) < INHIBIT_R);
// El acechador se ve solo de cerca (o un instante al disparar o al recibir)
export const stalkerVisible = (p, d) => (p.kind !== 'stalker' && p.kind !== 'wraith') || d < STALK_R || p.flash > 0 || (p.revealT || 0) > 0 || (p.kind === 'wraith' && p.aimT > 0);

// Tipos nuevos lejos de ORIGEN (se suman a corbeta y minador)
export function rareKind(danger, threat, r) {
  if (danger >= 4 && r < 0.07) return 'inhibitor';
  if (danger >= 4 && r < 0.15) return 'stalker';
  if ((danger >= 3 || threat >= 1.8) && r < 0.23) return 'corvette';
  if ((danger >= 3 || threat >= 1.8) && r < 0.31) return 'minelayer';
  if (danger >= 3 && r < 0.36) return 'frigate';
  if (danger >= 2 && r < 0.4) return 'mender';
  if (danger >= 4 && r < 0.44) return 'carrier';
  if (danger >= 5 && r < 0.48) return 'wraith';
  return null;
}

// Tamaño de escuadrilla: alas que acompañan a un caza o interceptor recién llegado
export const wingsFor = (danger, r) => (danger < 2 ? 0 : r < 0.35 ? 2 : r < 0.7 ? 1 : 0);
