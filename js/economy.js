// ECONOMÍA de RUNNER y ARENA: cofres, potenciadores, talentos, mazo y arsenal. Módulo puro.
// 🪙 monedas = lo de cada día (lo que sobra de cada partida y las bajas de la Arena);
// 💎 gemas = lo especial. Los 💰 créditos son SOLO de la Galaxia (su taller, sus talentos).
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
  if (!c || !cardOwned(save, c) || l >= MAX_CARD_LVL || save.coins < CARD_LVL_COST[l]) return false;
  save.coins -= CARD_LVL_COST[l];
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
  shield: { icon: '🛡️', name: 'Escudo extra', desc: 'Empiezas con +1 escudo.', cost: 300 },
  magnet: { icon: '🧲', name: 'Imán', desc: 'Imán de monedas toda la partida.', cost: 250 },
  start: { icon: '🚀', name: 'Arranque', desc: 'Empiezas en el tramo 3 (modo infinito).', cost: 400 },
  life: { icon: '❤️', name: 'Segunda vida', desc: 'Si te estrellas sin escudos, revives una vez.', cost: 600 },
  xp: { icon: '📈', name: 'Doble XP', desc: 'x2 de XP en la partida.', cost: 350 },
  luck: { icon: '🍀', name: 'Carta rara', desc: 'Empiezas eligiendo una carta rara o mejor.', cost: 300 },
};
export const MAX_BOOSTS = 2; // activos a la vez

export const boostCount = (save, id) => save.boosts?.[id] || 0;

export function buyBoost(save, id) {
  const b = BOOSTS[id];
  if (!b || save.coins < b.cost) return false;
  save.coins -= b.cost;
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
  runner: { name: 'RUNNER', icon: '🏁', cur: 'coins', nodes: [
    { id: 'r1', name: 'Escudo inicial', desc: 'Empiezas cada partida con 1 escudo.', cost: 800 },
    { id: 'r2', name: 'Carta inicial', desc: 'Eliges una carta al empezar cada partida.', cost: 1200 },
    { id: 'r3', name: 'Bolsillos', desc: 'Empiezas cada partida con 60 🪙.', cost: 1500 },
    { id: 'r4', name: 'Regateo', desc: 'La tienda de la partida es un 20% más barata.', cost: 2200 },
    { id: 'r5', name: 'Cuarta carta', desc: 'Eliges entre 4 cartas en vez de 3.', cost: 3800 },
  ] },
  arena: { name: 'ARENA', icon: '⚔️', cur: 'coins', nodes: [
    { id: 'a1', name: 'Blindaje', desc: '+20 de vida.', cost: 1000 },
    { id: 'a2', name: 'Calibre', desc: '+10% de daño.', cost: 1500 },
    { id: 'a3', name: 'Atracción', desc: '+40% de alcance para recoger XP.', cost: 1500 },
    { id: 'a4', name: 'Arsenal', desc: 'Tu arma inicial empieza en nivel 2.', cost: 2500 },
    { id: 'a5', name: 'Fénix', desc: 'Revives una vez por partida con media vida.', cost: 3800 },
  ] },
  galaxy: { name: 'GALAXIA', icon: '🌌', cur: 'credits', nodes: [
    { id: 'g1', name: 'Bodega ampliada', desc: '+10 de bodega.', cost: 1000 },
    { id: 'g2', name: 'Santabárbara', desc: '+2 misiles de munición.', cost: 1500 },
    { id: 'g3', name: 'Contactos', desc: 'Vendes mineral un 10% más caro.', cost: 2000 },
    { id: 'g4', name: 'Mecánico propio', desc: 'Reparar cuesta la mitad.', cost: 1200 },
    { id: 'g5', name: 'Escudo deflector', desc: '+20 de escudo.', cost: 2500 },
  ] },
};
export const TALENT_BY_ID = Object.fromEntries(Object.values(TALENTS).flatMap((t) => t.nodes.map((n) => [n.id, n])));
export const hasTalent = (save, id) => !!save.talents?.[id];

// Solo se compra el siguiente de su árbol
export function nextTalent(save, tree) {
  return TALENTS[tree].nodes.find((n) => !hasTalent(save, n.id)) || null;
}
// Cartera de cada árbol: Runner y Arena con 🪙, Galaxia con 💰
export const wallet = (save, cur) => (cur === 'credits' ? save.galaxy.credits : save.coins);
function pay(save, cur, n) {
  if (cur === 'credits') save.galaxy.credits -= n;
  else save.coins -= n;
}
export function buyTalent(save, id) {
  const tree = Object.keys(TALENTS).find((k) => TALENTS[k].nodes.some((n) => n.id === id));
  const n = tree && nextTalent(save, tree);
  const cur = tree && TALENTS[tree].cur;
  if (!n || n.id !== id || wallet(save, cur) < n.cost) return false;
  pay(save, cur, n.cost);
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
  std: { name: 'Cofre estándar', icon: '📦', cost: { coins: 1500 }, items: 3, odds: { common: 0.62, rare: 0.28, epic: 0.08, legendary: 0.02 } },
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
  common: [{ kind: 'coins', n: 400 }, { kind: 'boost', n: 1 }],
  rare: [{ kind: 'coins', n: 900 }, { kind: 'gems', n: 25 }, { kind: 'boost', n: 2 }, { kind: 'card', n: 1 }],
  epic: [{ kind: 'gems', n: 60 }, { kind: 'coins', n: 2500 }, { kind: 'card', n: 1 }],
  legendary: [{ kind: 'gems', n: 150 }],
};

// Abre un cofre (sin cobrar: eso lo hace openCrate). Determinista por número de cofre.
// Devuelve [{ rarity, kind: 'style'|'coins'|'gems'|'boost'|'card', ... }] y lo aplica al guardado.
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
        f = { kind: 'coins', n: 900 };
      }
      if (f.kind === 'coins') save.coins += f.n;
      else if (f.kind === 'gems') save.gems += f.n;
      else {
        const id = rng.pick(Object.keys(BOOSTS));
        save.boosts[id] = boostCount(save, id) + f.n;
        out.push({ rarity, kind: 'boost', id, n: f.n, name: `${BOOSTS[id].icon} ${BOOSTS[id].name} x${f.n}` });
        continue;
      }
      out.push({ rarity, kind: f.kind, n: f.n, name: f.kind === 'gems' ? `+${f.n} 💎` : `+${f.n} 🪙` });
    }
  }
  const best = Math.max(...out.map((o) => ORDER.indexOf(o.rarity)));
  c.pity = best >= 2 ? 0 : c.pity + 1;
  return out;
}

export function canAfford(save, kind) {
  const cost = CRATES[kind].cost;
  return cost.gems ? save.gems >= cost.gems : save.coins >= cost.coins;
}

export function openCrate(save, kind, ship = save.ship) {
  if (!canAfford(save, kind)) return null;
  const cost = CRATES[kind].cost;
  if (cost.gems) save.gems -= cost.gems;
  else save.coins -= cost.coins;
  return rollCrate(save, kind, ship);
}

// ---------- Monedas que sobran ----------
// Lo que no gastas en la tienda de la partida pasa a tu cartera de 🪙 (no a los créditos de la Galaxia)
export function bankCoins(save, coins) {
  const n = Math.max(0, Math.floor(coins || 0));
  save.coins += n;
  return n;
}
