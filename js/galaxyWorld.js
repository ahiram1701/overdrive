// GALAXIA: sucesos dinámicos que duran varios saltos. Módulo puro (se testea en Node).
// - OFENSIVAS PIRATAS: atacan un sistema aliado fronterizo; si no lo defiendes a tiempo, cae.
// - INVASIÓN DEL ENJAMBRE: una colmena aparece y se extiende sistema a sistema hasta que destruyes
//   sus nidos.
// Todo avanza una vez por salto (save.galaxy.jumps) y es determinista por ese número.
import { makeRng, hashString } from './rng.js';
import { ownerOf } from './factions.js';

export const WAR_EVERY = 10;     // saltos entre ofensivas
export const WAR_FIRST = 6;      // la primera, tras unos cuantos saltos
export const WAR_TIME = 5;       // saltos que tienes para llegar a defenderlo
export const WAR_KILLS = 6;      // piratas que hay que abatir allí
export const SWARM_FIRST = 12;
export const SWARM_EVERY = 3;    // saltos entre cada expansión
export const SWARM_MAX = 4;      // sistemas como mucho
export const SWARM_PRICE = 0.7;  // en un sistema infectado, el mineral se paga a un 70 %
const NEWS_MAX = 8;

export const world = (save) => {
  const w = (save.galaxyWorld ||= {});
  w.owners ||= {};
  w.news ||= [];
  w.saved ||= 0;
  w.wiped ||= 0;
  w.war ??= null;
  w.swarm ??= null;
  w.nextWar ??= WAR_FIRST;
  w.nextSwarm ??= SWARM_FIRST;
  return w;
};
// dueños con los sucesos: lo que perdiste en una ofensiva es pirata (hasta que lo liberes otra vez)
export const worldTerritory = (save) => ({ ...world(save).owners, ...save.territory });
const own = (save, sys) => ownerOf(sys, worldTerritory(save));

function news(w, jumps, text) {
  w.news = [{ j: jumps, text }, ...w.news].slice(0, NEWS_MAX);
}

// Un salto: avanza los sucesos. Devuelve los titulares nuevos (para el banner)
export function tickWorld(save, gal, jumps) {
  const w = world(save), out = [];
  const rng = makeRng(hashString(`world-${jumps}`));
  const say = (t) => { news(w, jumps, t); out.push(t); };
  // OFENSIVA: si se acabó el plazo, el sistema cae
  if (w.war && jumps >= w.war.until) {
    const sys = w.war.sys;
    w.owners[sys] = 'pir';
    delete save.territory[sys];
    say(`☠️ ${gal[sys].name} ha caído en manos piratas`);
    w.war = null;
  }
  // …y una nueva, contra un sistema aliado que linda con los piratas (nunca ORIGEN)
  if (!w.war && jumps >= w.nextWar) {
    const front = gal.filter((s) => s.id !== 0 && own(save, s) !== 'pir' && !w.swarm?.systems.includes(s.id) && s.links.some((l) => own(save, gal[l]) === 'pir'));
    if (front.length) {
      const sys = rng.pick(front).id;
      w.war = { sys, until: jumps + WAR_TIME, kills: 0, need: WAR_KILLS };
      say(`⚔️ Los piratas atacan ${gal[sys].name}: defiéndelo en ${WAR_TIME} saltos`);
    }
    w.nextWar = jumps + WAR_EVERY;
  }
  // ENJAMBRE: aparece en un sistema no pirata y se extiende a un vecino cada pocos saltos
  if (!w.swarm && jumps >= w.nextSwarm) {
    const pool = gal.filter((s) => s.id !== 0 && s.danger >= 2 && own(save, s) !== 'pir' && w.war?.sys !== s.id);
    if (pool.length) {
      const src = rng.pick(pool).id;
      w.swarm = { systems: [src], nextSpread: jumps + SWARM_EVERY };
      say(`🐝 Una colmena del enjambre infecta ${gal[src].name}`);
    }
    w.nextSwarm = jumps + 15;
  } else if (w.swarm && jumps >= w.swarm.nextSpread) {
    w.swarm.nextSpread = jumps + SWARM_EVERY;
    if (w.swarm.systems.length < SWARM_MAX) {
      const cand = [...new Set(w.swarm.systems.flatMap((id) => gal[id].links))]
        .filter((id) => id !== 0 && !w.swarm.systems.includes(id) && own(save, gal[id]) !== 'pir' && w.war?.sys !== id);
      if (cand.length) {
        const to = rng.pick(cand);
        w.swarm.systems.push(to);
        say(`🐝 El enjambre se extiende a ${gal[to].name}`);
      }
    }
  }
  return out;
}

export const warHere = (save, sys) => (world(save).war?.sys === sys ? world(save).war : null);
export const infected = (save, sys) => !!world(save).swarm?.systems.includes(sys);
export const priceMul = (save, sys) => (infected(save, sys) ? SWARM_PRICE : 1);

// abatir un pirata en el sistema atacado; devuelve 'saved' si ya está a salvo
export function defendKill(save, sys, jumps, gal) {
  const w = world(save), war = w.war;
  if (!war || war.sys !== sys) return null;
  war.kills++;
  if (war.kills < war.need) return 'progress';
  w.war = null;
  w.saved++;
  news(w, jumps, `🛡️ ${gal[sys].name} resiste: ofensiva rechazada`);
  return 'saved';
}

// destruir un nido; devuelve 'wiped' si era el último
export function clearNest(save, sys, jumps, gal) {
  const w = world(save), sw = w.swarm;
  if (!sw || !sw.systems.includes(sys)) return null;
  sw.systems = sw.systems.filter((id) => id !== sys);
  if (sw.systems.length) {
    news(w, jumps, `🔥 Nido destruido en ${gal[sys].name}`);
    return 'cleared';
  }
  w.swarm = null;
  w.wiped++;
  news(w, jumps, '✨ ¡El enjambre ha sido exterminado!');
  return 'wiped';
}

// al liberar un sistema que se perdió en una ofensiva, vuelve a ser tuyo
export function reclaim(save, sys) {
  delete world(save).owners[sys];
}
