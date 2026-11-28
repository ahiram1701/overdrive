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
// ESCASEZ: una estación paga un mineral al doble unos saltos (sale en las noticias)
export const SHORT_FIRST = 3;
export const SHORT_EVERY = 7;
export const SHORT_TIME = 6;
export const SHORT_MUL = 2;
// LA GUERRA FRÍA: Liga y Coalición se disputan los sistemas de su frontera (sale en las noticias)
// LOS PIRATAS SE MUEVEN: cada pocos saltos toman un sistema fronterizo… o abandonan uno rodeado
export const PIRATE_FIRST = 10;
export const PIRATE_EVERY = 11;
// LA REPUTACIÓN SE ENFRÍA: cada REP_EVERY saltos, 1 punto hacia 0 (si pasa de ±REP_KEEP)
export const REP_EVERY = 10;
export const REP_KEEP = 20;
export const FRONT_FIRST = 8;
export const FRONT_EVERY = 9;
// CAPITANES RIVALES: pilotos con nombre que comercian, cazan y suben de nivel mientras tú juegas
export const RIVALS = [
  { id: 'vega', name: 'Capitana Vega', f: 'liga', style: 'trade' },
  { id: 'kael', name: 'Kael el Rojo', f: 'pir', style: 'hunt' },
  { id: 'orsa', name: 'Orsa Brannigan', f: 'coal', style: 'hunt' },
  { id: 'ixe', name: 'Ixe-7', f: 'coal', style: 'explore' },
  { id: 'nadia', name: 'Nadia Solís', f: 'liga', style: 'explore' },
  { id: 'dax', name: 'Dax "Chatarra"', f: 'pir', style: 'trade' },
];
const FNAME = { liga: 'la Liga', coal: 'la Coalición', pir: 'los piratas' };
const ORE_NAME = { iron: '⛓️ hierro', crystal: '💎 cristal', plasma: '🔥 plasma', dark: '🌑 materia oscura' };
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
  w.shortage ??= null;
  w.nextShort ??= SHORT_FIRST;
  w.nextFront ??= FRONT_FIRST;
  w.rivals ||= {};
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
    const front = gal.filter((s) => s.id !== 0 && !s.hidden && !s.sec && own(save, s) !== 'pir' && !w.swarm?.systems.includes(s.id) && s.links.some((l) => own(save, gal[l]) === 'pir'));
    if (front.length) {
      const sys = rng.pick(front).id;
      w.war = { sys, until: jumps + WAR_TIME, kills: 0, need: WAR_KILLS };
      say(`⚔️ Los piratas atacan ${gal[sys].name}: defiéndelo en ${WAR_TIME} saltos`);
    }
    w.nextWar = jumps + WAR_EVERY;
  }
  // ESCASEZ: se acaba y, cada pocos saltos, sale otra (nunca del mineral que la estación ya tiene)
  if (w.shortage && jumps >= w.shortage.until) w.shortage = null;
  if (!w.shortage && jumps >= w.nextShort) {
    const pool = gal.filter((s) => s.id !== 0 && !s.hidden && !s.sec && own(save, s) !== 'pir');
    if (pool.length) {
      const sys = rng.pick(pool);
      const ore = rng.pick(Object.keys(ORE_NAME).filter((o) => o !== sys.ore));
      w.shortage = { sys: sys.id, ore, until: jumps + SHORT_TIME };
      say(`📈 Escasez de ${ORE_NAME[ore]} en ${sys.name}: lo pagan ×${SHORT_MUL} durante ${SHORT_TIME} saltos`);
    }
    w.nextShort = jumps + SHORT_EVERY;
  }
  // FRONTERA: Liga y Coalición se quitan un sistema fronterizo (nunca uno que liberaste tú ni ORIGEN)
  if (jumps >= w.nextFront) {
    const frng = makeRng(hashString(`front-${jumps}`)); // (su propio azar: no cambia los otros sucesos)
    const front = gal.filter((s) => s.id !== 0 && !s.hidden && !save.territory[s.id] && w.war?.sys !== s.id && ['liga', 'coal'].includes(own(save, s))
      && s.links.some((l) => { const o = own(save, gal[l]); return o !== own(save, s) && (o === 'liga' || o === 'coal'); }));
    if (front.length) {
      const sys = frng.pick(front), was = own(save, sys), now = was === 'liga' ? 'coal' : 'liga';
      w.owners[sys.id] = now;
      say(`⚔️ ${FNAME[now][0].toUpperCase()}${FNAME[now].slice(1)} arrebata ${sys.name} a ${FNAME[was]}`);
    }
    w.nextFront = jumps + FRONT_EVERY;
  }
  // PIRATAS: avanzan (toman un sistema que linda con ellos) o se retiran (si uno suyo está rodeado)
  if (jumps >= (w.nextPirate ??= PIRATE_FIRST)) {
    const prng = makeRng(hashString(`pir-${jumps}`));
    const okSys = (s) => s.id !== 0 && !s.hidden && !save.territory[s.id] && w.war?.sys !== s.id && !w.swarm?.systems.includes(s.id);
    const theirs = gal.filter((s) => okSys(s) && own(save, s) === 'pir');
    const surrounded = theirs.filter((s) => s.links.filter((l) => own(save, gal[l]) !== 'pir').length >= 3);
    if (surrounded.length && prng.next() < 0.5) {
      const sys = prng.pick(surrounded), to = gal[sys.links.find((l) => own(save, gal[l]) !== 'pir')];
      w.owners[sys.id] = own(save, to) === 'coal' ? 'coal' : 'liga';
      say(`🏳️ Los piratas abandonan ${sys.name}: ahora es de ${FNAME[w.owners[sys.id]]}`);
    } else {
      const edge = gal.filter((s) => okSys(s) && own(save, s) !== 'pir' && s.links.some((l) => own(save, gal[l]) === 'pir'));
      if (edge.length) { const sys = prng.pick(edge); w.owners[sys.id] = 'pir'; say(`☠️ Los piratas toman ${sys.name} sin que nadie lo impida`); }
    }
    w.nextPirate = jumps + PIRATE_EVERY;
  }
  // LA REPUTACIÓN SE ENFRÍA si no haces nada por una facción (lo muy alto o muy bajo baja despacio)
  if (jumps % REP_EVERY === 0 && save.factionRep) {
    for (const f of Object.keys(save.factionRep)) {
      const r = save.factionRep[f];
      if (Math.abs(r) > REP_KEEP) save.factionRep[f] = r - Math.sign(r);
    }
  }
  // RIVALES: cada salto, uno de ellos hace algo (y sube de nivel con el tiempo)
  {
    const rr = makeRng(hashString(`rival-${jumps}`));
    const R = RIVALS[jumps % RIVALS.length], st = (w.rivals[R.id] ||= { lvl: 1, sys: 0, wealth: 0, rel: 0 });
    const here = gal[st.sys] || gal[0];
    const next = here.links.length ? gal[rr.pick(here.links)] : here;
    if (!next.hidden) st.sys = next.id;
    st.wealth += 200 + 150 * st.lvl;
    if (rr.next() < 0.35) {
      const t = R.style === 'trade' ? `💰 ${R.name} cierra un buen trato en ${next.name}` : R.style === 'hunt' ? `🎯 ${R.name} derriba a un pirata cerca de ${next.name}` : `🔭 ${R.name} explora más allá de ${next.name}`;
      news(w, jumps, t);
    }
    if (st.wealth > 2500 * st.lvl) { st.lvl++; st.wealth = 0; news(w, jumps, `⭐ ${R.name} sube a nivel ${st.lvl}`); }
  }
  // ENJAMBRE: aparece en un sistema no pirata y se extiende a un vecino cada pocos saltos
  if (!w.swarm && jumps >= w.nextSwarm) {
    const pool = gal.filter((s) => s.id !== 0 && !s.hidden && !s.sec && s.danger >= 2 && own(save, s) !== 'pir' && w.war?.sys !== s.id);
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

// EL TIEMPO CORRE: cada minuto de vuelo los rivales se mueven (sin noticias: eso, al saltar)
export function tickMinute(save, gal, n) {
  const w = world(save);
  const R = RIVALS[n % RIVALS.length], st = w.rivals[R.id];
  if (!st) return;
  const here = gal[st.sys] || gal[0];
  if (here.links.length) { const to = gal[here.links[n % here.links.length]]; if (!to.hidden) st.sys = to.id; }
  st.wealth += 60;
}
// relación con un rival (saludar la sube): 0 desconocido · 1-2 conocido · 3+ amigo
export function rivalMeet(save, id) {
  const st = world(save).rivals[id];
  if (!st) return null;
  st.rel = (st.rel || 0) + 1;
  return st;
}
export const warHere = (save, sys) => (world(save).war?.sys === sys ? world(save).war : null);
export const infected = (save, sys) => !!world(save).swarm?.systems.includes(sys);
export const priceMul = (save, sys) => (infected(save, sys) ? SWARM_PRICE : 1);
export const oreMul = (save, sys, ore) => { const sh = world(save).shortage; return sh && sh.sys === sys && sh.ore === ore ? SHORT_MUL : 1; };

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
