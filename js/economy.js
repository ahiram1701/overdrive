// ECONOMÍA: cofres de suministros, potenciadores y talentos. Módulo puro (recibe el guardado).
// Monedas 🪙 = la partida; créditos 💰 = la cartera común (Galaxia + lo que sobra de cada partida);
// gemas 💎 = lo permanente.
import { makeRng, hashString } from './rng.js';
import { GROUPS, isUnlocked, grantCosmetic } from './cosmetics.js';
import { CARDS, CARD_BY_ID, CARD_LVL_COST, MAX_CARD_LVL } from './upgrades.js';
import { WEAPONS } from './arenaData.js';

// ---------- Mazo: cartas nuevas y su maestría ----------
export const cardLvl = (save, id) => save.cardLvl?.[id] || 0;
export const cardOwned = (save, c) => !c.locked || !!save.cardsOwned?.[c.id];
export function buyCard(save, id) {
  const c = CARD_BY_ID[id];
  if (!c?.locked || save.cardsOwned[id] || save.gems < c.cost) return false;
  save.gems -= c.cost;
  save.cardsOwned[id] = true;
  return true;
}
export function upgradeCard(save, id) {
  const c = CARD_BY_ID[id], l = cardLvl(save, id);
  if (!c || !cardOwned(save, c) || l >= MAX_CARD_LVL || save.gems < CARD_LVL_COST[l]) return false;
  save.gems -= CARD_LVL_COST[l];
  save.cardLvl[id] = l + 1;
  return true;
}

// ---------- Arsenal de la Arena ----------
export function buyWeapon(save, id) {
  const w = WEAPONS[id];
  if (!w?.locked || save.arenaWeapons[id] || save.gems < w.cost) return false;
  save.gems -= w.cost;
  save.arenaWeapons[id] = true;
  return true;
}

// ---------- Potenciadores (consumibles, se compran con 💎) ----------
export const BOOSTS = {
  shield: { icon: '🛡️', name: 'Escudo extra', desc: 'Empiezas con +1 escudo.', cost: 30 },
  magnet: { icon: '🧲', name: 'Imán', desc: 'Imán de monedas toda la partida.', cost: 25 },
  start: { icon: '🚀', name: 'Arranque', desc: 'Empiezas en el tramo 3 (modo infinito).', cost: 40 },
  life: { icon: '❤️', name: 'Segunda vida', desc: 'Si te estrellas sin escudos, revives una vez.', cost: 60 },
  xp: { icon: '📈', name: 'Doble XP', desc: 'x2 de XP en la partida.', cost: 35 },
  luck: { icon: '🍀', name: 'Carta rara', desc: 'Empiezas eligiendo una carta rara o mejor.', cost: 30 },
};
export const MAX_BOOSTS = 2; // activos a la vez

export const boostCount = (save, id) => save.boosts?.[id] || 0;

export function buyBoost(save, id) {
  const b = BOOSTS[id];
  if (!b || save.gems < b.cost) return false;
  save.gems -= b.cost;
  save.boosts[id] = boostCount(save, id) + 1;
  return true;
}

// Marca/desmarca un potenciador para la próxima partida (máx. 2, y solo si tienes)
export function toggleBoost(save, id) {
  const sel = save.boostSel.filter((x) => boostCount(save, x) > 0);
  const i = sel.indexOf(id);
  if (i >= 0) sel.splice(i, 1);
  else if (boostCount(save, id) > 0 && sel.length < MAX_BOOSTS) sel.push(id);
  save.boostSel = sel;
  return sel.includes(id);
}

// Al empezar una partida: gasta los elegidos y devuelve cuáles se usan. `allowed` filtra por modo.
export function takeBoosts(save, allowed = () => true) {
  const used = [];
  for (const id of save.boostSel) {
    if (boostCount(save, id) <= 0 || !allowed(id)) continue;
    save.boosts[id]--;
    used.push(id);
  }
  save.boostSel = save.boostSel.filter((id) => boostCount(save, id) > 0);
  return used;
}

// ---------- Talentos (mejoras permanentes, 💎, en orden dentro de cada árbol) ----------
export const TALENTS = {
  runner: { name: 'RUNNER', icon: '🏁', nodes: [
    { id: 'r1', name: 'Escudo inicial', desc: 'Empiezas cada partida con 1 escudo.', cost: 80 },
    { id: 'r2', name: 'Carta inicial', desc: 'Eliges una carta al empezar cada partida.', cost: 120 },
    { id: 'r3', name: 'Bolsillos', desc: 'Empiezas cada partida con 60 🪙.', cost: 150 },
    { id: 'r4', name: 'Regateo', desc: 'La tienda de la partida es un 20% más barata.', cost: 220 },
    { id: 'r5', name: 'Cuarta carta', desc: 'Eliges entre 4 cartas en vez de 3.', cost: 380 },
  ] },
  arena: { name: 'ARENA', icon: '⚔️', nodes: [
    { id: 'a1', name: 'Blindaje', desc: '+20 de vida.', cost: 100 },
    { id: 'a2', name: 'Calibre', desc: '+10% de daño.', cost: 150 },
    { id: 'a3', name: 'Atracción', desc: '+40% de alcance para recoger XP.', cost: 150 },
    { id: 'a4', name: 'Arsenal', desc: 'Tu arma inicial empieza en nivel 2.', cost: 250 },
    { id: 'a5', name: 'Fénix', desc: 'Revives una vez por partida con media vida.', cost: 380 },
  ] },
  galaxy: { name: 'GALAXIA', icon: '🌌', nodes: [
    { id: 'g1', name: 'Bodega ampliada', desc: '+10 de bodega.', cost: 100 },
    { id: 'g2', name: 'Santabárbara', desc: '+2 misiles de munición.', cost: 150 },
    { id: 'g3', name: 'Contactos', desc: 'Vendes mineral un 10% más caro.', cost: 200 },
    { id: 'g4', name: 'Mecánico propio', desc: 'Reparar cuesta la mitad.', cost: 120 },
    { id: 'g5', name: 'Escudo deflector', desc: '+20 de escudo.', cost: 250 },
  ] },
};
export const TALENT_BY_ID = Object.fromEntries(Object.values(TALENTS).flatMap((t) => t.nodes.map((n) => [n.id, n])));
export const hasTalent = (save, id) => !!save.talents?.[id];

// Solo se compra el siguiente de su árbol
export function nextTalent(save, tree) {
  return TALENTS[tree].nodes.find((n) => !hasTalent(save, n.id)) || null;
}
export function buyTalent(save, id) {
  const tree = Object.keys(TALENTS).find((k) => TALENTS[k].nodes.some((n) => n.id === id));
  const n = tree && nextTalent(save, tree);
  if (!n || n.id !== id || save.gems < n.cost) return false;
  save.gems -= n.cost;
  save.talents[id] = true;
  return true;
}

// ---------- Cofres de suministros ----------
export const RARITIES = {
  common: { name: 'Común', color: '#b8c2cc' },
  rare: { name: 'Raro', color: '#00e5ff' },
  epic: { name: 'Épico', color: '#bf5af2' },
  legendary: { name: 'Legendario', color: '#ffd60a' },
};
const ORDER = ['common', 'rare', 'epic', 'legendary'];
export const CRATES = {
  std: { name: 'Cofre estándar', icon: '📦', cost: { credits: 1500 }, items: 3, odds: { common: 0.62, rare: 0.28, epic: 0.08, legendary: 0.02 } },
  elite: { name: 'Cofre de élite', icon: '🎁', cost: { gems: 150 }, items: 3, odds: { common: 0.25, rare: 0.45, epic: 0.22, legendary: 0.08 } },
};
export const PITY = 10; // como mucho 10 cofres seguidos sin algo épico o mejor

// Rareza de un estilo: los exclusivos de cofre llevan la suya; los de gemas, según el precio
export function styleRarity(item) {
  if (item.unlock?.crate) return item.unlock.crate;
  const g = item.unlock?.gems;
  if (!g) return null;
  return g <= 90 ? 'common' : g <= 150 ? 'rare' : 'epic';
}

// Estilos que el cofre puede dar en esta nave (nunca uno que ya tengas)
export function crateStyles(save, ship) {
  return Object.entries(GROUPS).flatMap(([group, items]) => items
    .filter((it) => !it.ship && styleRarity(it) && !isUnlocked(it, save, ship))
    .map((it) => ({ group, it, rarity: styleRarity(it) })));
}

function rollRarity(rng, odds) {
  let x = rng.next();
  for (const k of ORDER) { if (x < odds[k]) return k; x -= odds[k]; }
  return 'common';
}

const FILLER = {
  common: [{ kind: 'credits', n: 400 }, { kind: 'boost', n: 1 }],
  rare: [{ kind: 'credits', n: 900 }, { kind: 'gems', n: 25 }, { kind: 'boost', n: 2 }, { kind: 'card', n: 1 }],
  epic: [{ kind: 'gems', n: 60 }, { kind: 'credits', n: 2500 }, { kind: 'card', n: 1 }],
  legendary: [{ kind: 'gems', n: 150 }],
};

// Abre un cofre (sin cobrar: eso lo hace openCrate). Determinista por número de cofre.
// Devuelve [{ rarity, kind: 'style'|'credits'|'gems'|'boost', ... }] y lo aplica al guardado.
export function rollCrate(save, kind, ship = save.ship) {
  const C = CRATES[kind];
  const c = save.crates;
  const rng = makeRng(hashString(`crate-${c.n}-${kind}`));
  c.n++;
  const out = [];
  let pool = crateStyles(save, ship);
  for (let i = 0; i < C.items; i++) {
    let rarity = rollRarity(rng, C.odds);
    // garantía: el último objeto del cofre que agota la paciencia sale épico o mejor
    const last = i === C.items - 1;
    if (last && c.pity >= PITY - 1 && ORDER.indexOf(rarity) < 2) rarity = 'epic';
    const styles = pool.filter((s) => s.rarity === rarity);
    // la mitad de las veces (si quedan) toca un estilo; si no, relleno de su rareza
    if (styles.length && rng.next() < 0.6) {
      const s = rng.pick(styles);
      pool = pool.filter((x) => x !== s);
      grantCosmetic(s.it, save, ship);
      out.push({ rarity, kind: 'style', group: s.group, id: s.it.id, name: s.it.name });
    } else {
      let f = rng.pick(FILLER[rarity]);
      // maestría de carta: +1 nivel a una de tus cartas (si no queda ninguna por subir, créditos)
      if (f.kind === 'card') {
        const cs = CARDS.filter((cd) => cardOwned(save, cd) && cardLvl(save, cd.id) < MAX_CARD_LVL);
        if (cs.length) {
          const card = rng.pick(cs);
          save.cardLvl[card.id] = cardLvl(save, card.id) + 1;
          out.push({ rarity, kind: 'card', id: card.id, name: `${card.icon} ${card.name} · maestría ${save.cardLvl[card.id]}` });
          continue;
        }
        f = { kind: 'credits', n: 900 };
      }
      if (f.kind === 'credits') save.galaxy.credits += f.n;
      else if (f.kind === 'gems') save.gems += f.n;
      else {
        const id = rng.pick(Object.keys(BOOSTS));
        save.boosts[id] = boostCount(save, id) + f.n;
        out.push({ rarity, kind: 'boost', id, n: f.n, name: `${BOOSTS[id].icon} ${BOOSTS[id].name} x${f.n}` });
        continue;
      }
      out.push({ rarity, kind: f.kind, n: f.n, name: f.kind === 'gems' ? `+${f.n} 💎` : `+${f.n} 💰` });
    }
  }
  const best = Math.max(...out.map((o) => ORDER.indexOf(o.rarity)));
  c.pity = best >= 2 ? 0 : c.pity + 1;
  return out;
}

export function canAfford(save, kind) {
  const cost = CRATES[kind].cost;
  return cost.gems ? save.gems >= cost.gems : save.galaxy.credits >= cost.credits;
}

export function openCrate(save, kind, ship = save.ship) {
  if (!canAfford(save, kind)) return null;
  const cost = CRATES[kind].cost;
  if (cost.gems) save.gems -= cost.gems;
  else save.galaxy.credits -= cost.credits;
  return rollCrate(save, kind, ship);
}

// ---------- Monedas -> créditos ----------
// Lo que sobra de la partida pasa a tu cartera (1:1)
export function bankCoins(save, coins) {
  const n = Math.max(0, Math.floor(coins || 0));
  save.galaxy.credits += n;
  return n;
}
