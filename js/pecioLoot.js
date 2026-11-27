// PECIOS: el botín. Objetos con rareza (arma, blindaje y 2 módulos), consumibles y lo que cada cosa le hace
// a tu nave. Cada pieza lleva ETIQUETAS (🔥 ⚡ 🧲 💨 🛡️): con 3 de la misma se enciende una SINERGIA.
// Módulo puro (se testea en Node).

export const RARITY = [
  { id: 'common', name: 'Común', color: '#c8d6e5' },
  { id: 'rare', name: 'Raro', color: '#0a84ff' },
  { id: 'epic', name: 'Épico', color: '#bf5af2' },
  { id: 'legendary', name: 'Legendario', color: '#ffcc00' },
];

// Armas: cambian tu disparo automático
export const WEAPONS = {
  spread: { icon: '🔱', name: 'Abanico', desc: 'dispara 3 balas en abanico' },
  pierce: { icon: '🗡️', name: 'Perforador', desc: 'las balas atraviesan a los enemigos' },
  bounce: { icon: '🪃', name: 'Rebote', desc: 'las balas rebotan en las paredes' },
  blast: { icon: '💥', name: 'Estallido', desc: 'cada impacto daña también alrededor' },
  rapid: { icon: '🔥', name: 'Ráfaga', desc: 'dispara mucho más rápido' },
  arc: { icon: '⚡', name: 'Arco', desc: 'cada impacto salta a 2 enemigos cercanos' },
  orbit: { icon: '🌀', name: 'Órbita', desc: 'orbes que giran a tu alrededor y dañan lo que tocan' },
  cannon: { icon: '☄️', name: 'Cañón', desc: 'disparo lento y enorme que lo atraviesa todo' },
  shard: { icon: '💎', name: 'Fragmentador', desc: 'cada bala se parte en dos al impactar' },
  charge: { icon: '🔋', name: 'Acumulador', desc: 'se carga solo (quieto, el doble de rápido): disparo ×3 que lo atraviesa todo' },
};
// Afijos del arma (raras o mejores): un efecto más en cada impacto
export const AFFIXES = {
  burn: { icon: '🔥', name: 'de fuego', desc: 'los impactos queman 3 s' },
  frost: { icon: '❄️', name: 'de hielo', desc: '25 % de congelar 0,6 s' },
  vamp: { icon: '🩸', name: 'de sangre', desc: '5 % de curarte 1 ❤️ por impacto' },
  ricochet: { icon: '🪃', name: 'de muelle', desc: '+1 rebote en las paredes' },
};
// Blindajes: cada uno con su forma de protegerte
export const PLATINGS = {
  plating: { icon: '🛡️', name: 'Blindaje', hp: (t) => 1 + t, shield: (t) => (t >= 2 ? t - 1 : 0), desc: () => '' },
  reflect: { icon: '💠', name: 'Reflectante', hp: (t) => t, shield: () => 0, desc: (t) => `al esquivar, ${2 + t} de daño al enemigo más cercano` },
  thorns: { icon: '🌵', name: 'Espinas', hp: (t) => 1 + t, shield: () => 0, desc: (t) => `si te golpean, ${2 + t} de daño a los que tengas cerca` },
  regen: { icon: '💚', name: 'Regenerativo', hp: (t) => t, shield: () => 0, desc: (t) => `+1 ❤️ cada ${14 - 2 * t} s con la sala cerrada` },
  ablative: { icon: '🧱', name: 'Ablativo', hp: () => 0, shield: (t) => 2 + t, desc: () => 'sin vida extra: todo es escudo' },
};
// Módulos: efectos pasivos (dos ranuras)
export const MODULES = {
  leech: { icon: '🩸', name: 'Sanguijuela', desc: (v) => `+1 ❤️ cada ${v} bajas`, val: [8, 6, 5, 4] },
  keyring: { icon: '🗝️', name: 'Llavero', desc: (v) => `+${v} % de llave al limpiar una sala`, val: [15, 25, 35, 50] },
  scanner: { icon: '🔍', name: 'Escáner', desc: (v) => `ves mímicos y paredes agrietadas · +${v} % 🔩`, val: [0, 10, 20, 30] },
  magnet: { icon: '🧲', name: 'Imán', desc: (v) => `+${v} % de 🔩`, val: [20, 35, 50, 75] },
  reflex: { icon: '💨', name: 'Reflejos', desc: (v) => `esquive ${v} % antes`, val: [15, 25, 35, 50] },
  overcharge: { icon: '🔋', name: 'Sobrecarga', desc: (v) => `habilidad ${v} % antes`, val: [15, 25, 35, 45] },
  mirror: { icon: '🪞', name: 'Espejo', desc: (v) => `${v} % de devolver un golpe al enemigo más cercano`, val: [12, 18, 25, 33] },
  decoy: { icon: '👻', name: 'Señuelo', desc: (v) => `el esquive deja un señuelo que los enemigos persiguen ${v} s`, val: [1.5, 2, 2.5, 3] },
  greed: { icon: '💰', name: 'Avaricia', desc: (v) => `+${v} % de 🔩, pero −1 ❤️ de vida máxima`, val: [30, 45, 65, 90] },
};

// ETIQUETAS y SINERGIAS: 3 piezas con la misma etiqueta encienden su efecto
export const TAGS = {
  fire: { icon: '🔥', name: 'Incendio', desc: 'todo impacto quema, y la quemadura hace 2 por segundo' },
  volt: { icon: '⚡', name: 'Sobretensión', desc: 'habilidad un 30 % antes y cada impacto salta a otro enemigo' },
  loot: { icon: '🧲', name: 'Saqueo', desc: '+40 % de 🔩 y +1 🗝️ en cada planta' },
  dodge: { icon: '💨', name: 'Danza', desc: 'el esquive recarga el doble de rápido y suelta una onda de 2' },
  guard: { icon: '🛡️', name: 'Fortaleza', desc: '+1 ❤️ de vida máxima y 🫧 1 escudo más en cada sala' },
};
export const SYNERGY_AT = 3;
const KIND_TAGS = {
  rapid: 'fire', blast: 'fire', cannon: 'fire', charge: 'fire', arc: 'volt', orbit: 'volt', shard: 'volt',
  plating: 'guard', ablative: 'guard', thorns: 'guard', regen: 'guard', reflect: 'dodge',
  leech: 'guard', keyring: 'loot', scanner: 'loot', magnet: 'loot', greed: 'loot', reflex: 'dodge', decoy: 'dodge', mirror: 'dodge', overcharge: 'volt',
};
const AFFIX_TAGS = { burn: 'fire', frost: 'volt', vamp: 'guard', ricochet: 'dodge' };
const SET_TAGS = { scrap: 'loot', hunter: 'fire', storm: 'volt', ghost: 'dodge', colossus: 'guard', warden: 'guard' };
// las etiquetas de una pieza (sin repetir)
export function tagsOf(it) {
  if (!it) return [];
  const out = new Set();
  if (KIND_TAGS[it.kind]) out.add(KIND_TAGS[it.kind]);
  if (it.affix) out.add(AFFIX_TAGS[it.affix]);
  if (it.unique && UNIQUES[it.unique]?.tag) out.add(UNIQUES[it.unique].tag);
  if (it.set && SET_TAGS[it.set]) out.add(SET_TAGS[it.set]); // las piezas de set también suman a su etiqueta
  return [...out];
}
// cuántas piezas llevas de cada etiqueta
export function tagCounts(gear) {
  const n = {};
  for (const it of [gear.weapon, gear.plating, gear.mod1, gear.mod2]) for (const t of tagsOf(it)) n[t] = (n[t] || 0) + 1;
  return n;
}
// las sinergias, encendidas o a medias (para la pausa)
export function synergyLines(tags = {}) {
  return Object.entries(tags).filter(([, n]) => n >= 2).map(([k, n]) => `${TAGS[k].icon} ${TAGS[k].name} ${Math.min(SYNERGY_AT, n)}/${SYNERGY_AT}${n >= SYNERGY_AT ? ` · ${TAGS[k].desc}` : ''}`);
}

// SETS: piezas de un mismo set dan un efecto extra con 2 y con 3 equipadas
export const SETS = {
  scrap: { icon: '🔩', name: 'Chatarrero', b2: '+30 % de 🔩', b3: 'y +1 🗝️ en cada planta' },
  hunter: { icon: '🎯', name: 'Cazador', b2: '+1 de daño', b3: 'y cadencia ×1,2' },
  colossus: { icon: '🗿', name: 'Coloso', b2: '+2 ❤️ de vida máxima', b3: 'y 🫧 1 escudo más al entrar en cada sala' },
  storm: { icon: '⛈️', name: 'Tormenta', b2: 'cadencia ×1,15', b3: 'y 20 % de aturdir 0,6 s al golpear' },
  ghost: { icon: '🌙', name: 'Espectro', b2: 'esquive un 20 % antes', b3: 'y 1 s intocable después de esquivar' },
  warden: { icon: '🏰', name: 'Guardián', b2: '🫧 1 escudo más al entrar en cada sala', b3: 'y al romperse, aturde a los que tengas cerca' },
};
// los sets que llevas puestos y qué te dan ahora mismo (para la pausa)
export function setLines(sets = {}) {
  return Object.entries(sets).map(([k, n]) => {
    const S = SETS[k];
    return `${S.icon} ${S.name} ${Math.min(3, n)}/3${n >= 3 ? ` · ${S.b2} ${S.b3}` : n >= 2 ? ` · ${S.b2}` : ''}`;
  });
}
// LEGENDARIOS ÚNICOS: con nombre propio y un efecto que no tiene nada más (algunos cambian las reglas)
export const UNIQUES = {
  reactor: { slot: 'weapon', name: 'Corazón del Reactor', tag: 'fire', desc: 'tus balas QUEMAN: 1 de daño por segundo durante 3 s' },
  prism: { slot: 'weapon', name: 'Prisma', tag: 'volt', desc: 'lo que matas con una bala estalla en 3 balas más' },
  glass: { slot: 'weapon', name: 'Cañón de Cristal', desc: 'el doble de daño, pero −2 ❤️ de vida máxima' },
  anchor: { slot: 'plating', name: 'Ancla', desc: 'los pozos no te tragan: pasas por encima' },
  comet: { slot: 'plating', name: 'Cometa', tag: 'dodge', desc: 'cada esquive suelta una onda de 3 de daño' },
  masterkey: { slot: 'mod', name: 'Llave maestra', tag: 'loot', desc: 'abres los cofres sin llave' },
  reliquary: { slot: 'mod', name: 'Relicario', tag: 'loot', desc: 'cada 🗝️ que consigues te cura 1 ❤️' },
  phoenix: { slot: 'mod', name: 'Pluma de Fénix', tag: 'guard', desc: 'la primera vez que caes, vuelves con 3 ❤️' },
};
export const SLOTS = ['weapon', 'plating', 'mod1', 'mod2'];
export const SLOT_NAME = { weapon: 'Arma', plating: 'Blindaje', mod1: 'Módulo 1', mod2: 'Módulo 2' };

// Consumibles: se llevan en la mochila (3 de cada como mucho) y se usan con su botón
export const CONS = {
  kit: { icon: '🧰', name: 'Kit de reparación', desc: '+3 ❤️' },
  emp: { icon: '📡', name: 'Pulso EMP', desc: 'aturde a todos los de la sala 3 s' },
  warp: { icon: '🌀', name: 'Teletransporte', desc: 'vuelves a la entrada de la planta' },
};
export const CONS_KEYS = Object.keys(CONS);
export const BAG_MAX = 3;

// Rareza según la planta (más hondo, mejor) y un empujón (cofres, mímicos, cajas: bonus 1-2)
export function rollTier(rng, depth, bonus = 0) {
  const d = Math.max(1, depth);
  const w = [Math.max(12, 66 - 6 * d), 26 + 2 * d, 6 + 2.4 * d, 0.8 + 0.7 * d];
  for (let i = 0; i < bonus; i++) { w[3] += w[0] * 0.06; w[2] += w[0] * 0.2; w[1] += w[0] * 0.34; w[0] *= 0.4; }
  let r = rng.next() * w.reduce((a, b) => a + b, 0);
  for (let t = 0; t < 4; t++) if ((r -= w[t]) <= 0) return t;
  return 3;
}

// LO DESBLOQUEADO en el taller (Arsenal). Sin `pool` (tests, bots), sale todo
export const BASE_SETS = ['scrap', 'hunter', 'colossus'];
export const BASE_UNIQUES = ['reactor', 'anchor', 'masterkey'];
const RATE = { rapid: 1.4, pierce: 0.85, blast: 0.8, bounce: 0.95, spread: 0.9, arc: 0.9, orbit: 0.75, cannon: 0.42, shard: 0.85, charge: 1 };
// Un objeto al azar (slot opcional para forzar uno; minTier para "al menos raro")
export function genItem(rng, depth, { bonus = 0, slot = null, minTier = 0, pool = null } = {}) {
  const tier = Math.max(minTier, rollTier(rng, depth, bonus));
  const sl = slot || rng.weighted([{ k: 'weapon', w: 4 }, { k: 'plating', w: 3 }, { k: 'mod', w: 4 }]).k;
  const id = `it${Math.floor(rng.next() * 1e9).toString(36)}`;
  if (sl === 'weapon') {
    const kind = rng.pick(Object.keys(WEAPONS));
    const dmg = kind === 'spread' || kind === 'rapid' ? Math.max(0, tier - 1) : kind === 'cannon' ? 3 + tier : tier;
    const rate = RATE[kind] + (kind === 'rapid' ? 0.1 * tier : 0);
    const it = { id, slot: 'weapon', kind, tier, dmg, rate, bounces: kind === 'bounce' ? 1 + Math.min(2, tier) : 0, orbs: kind === 'orbit' ? 2 + Math.floor(tier / 2) : 0 };
    if (tier >= 1 && rng.chance((0.25 + 0.15 * tier) * (pool?.affixPlus ? 2 : 1))) it.affix = rng.pick(Object.keys(AFFIXES));
    return extras(rng, it, pool);
  }
  if (sl === 'plating') {
    const kind = rng.pick(['plating', 'plating', 'reflect', 'thorns', 'regen', 'ablative']);
    const P = PLATINGS[kind], temper = pool?.plateTemper && kind !== 'plating' ? 1 : 0;
    return extras(rng, { id, slot: 'plating', kind, tier, hp: P.hp(tier) + temper, shield: P.shield(tier) + temper }, pool);
  }
  const kind = rng.pick(Object.keys(MODULES));
  return extras(rng, { id, slot: 'mod', kind, tier, val: MODULES[kind].val[tier] }, pool);
}
// DESGUACE: las 🔩 que te dan por un objeto que no quieres
export const scrapValue = (it, depth = 1) => 2 + 3 * it.tier + Math.floor(depth / 3) + (it.unique ? 5 : 0);
// ELIGE 1 DE 3: tres objetos (procura que no sean de la misma ranura)
export function genChoice(rng, depth, opts = {}) {
  const out = [genItem(rng, depth, opts)];
  for (let i = 1; i < (opts.n || 3); i++) {
    const used = new Set(out.map((it) => it.slot));
    const free = ['weapon', 'plating', 'mod'].filter((k) => !used.has(k));
    out.push(genItem(rng, depth, { ...opts, slot: opts.slot || (free.length ? rng.pick(free) : null) }));
  }
  return out;
}
// a veces, parte de un SET (raros o mejores) o un LEGENDARIO ÚNICO
function extras(rng, it, pool = null) {
  if (it.tier >= 1 && rng.chance(pool?.setsPlus ? 0.5 : 0.3)) it.set = rng.pick(Object.keys(SETS));
  if ((it.tier === 3 && rng.chance(pool?.uniquesPlus ? 0.6 : 0.35)) || (it.tier === 2 && pool?.uniquesPlus && rng.chance(0.12))) {
    const ids = Object.keys(UNIQUES).filter((k) => UNIQUES[k].slot === it.slot);
    if (ids.length) it.unique = rng.pick(ids);
  }
  return it;
}

const platingOf = (it) => PLATINGS[it.kind] || PLATINGS.plating;
export const itemIcon = (it) => (it.slot === 'weapon' ? WEAPONS[it.kind].icon : it.slot === 'plating' ? platingOf(it).icon : MODULES[it.kind].icon);
export const itemName = (it) => {
  if (it.unique) return UNIQUES[it.unique].name;
  if (it.slot === 'weapon') return `${WEAPONS[it.kind].name}${it.affix ? ` ${AFFIXES[it.affix].name}` : ''}`;
  return it.slot === 'plating' ? platingOf(it).name : MODULES[it.kind].name;
};
// Lo que hace, en líneas cortas (para la pantalla de comparar)
export function itemLines(it) {
  if (!it) return [];
  const extra = [...(it.unique ? [`★ ${UNIQUES[it.unique].desc}`] : []), ...(it.set ? [`${SETS[it.set].icon} Set ${SETS[it.set].name}: 2 → ${SETS[it.set].b2}; 3 → ${SETS[it.set].b3}`] : [])];
  return [...baseLines(it), ...extra];
}
function baseLines(it) {
  if (it.slot === 'weapon') {
    const out = [WEAPONS[it.kind].desc];
    if (it.dmg) out.push(`+${it.dmg} de daño`);
    if (it.rate !== 1) out.push(`cadencia ×${it.rate.toFixed(2).replace(/0$/, '')}`);
    if (it.bounces) out.push(`rebota ${it.bounces} ${it.bounces > 1 ? 'veces' : 'vez'}`);
    if (it.affix) out.push(`${AFFIXES[it.affix].icon} ${AFFIXES[it.affix].desc}`);
    return out;
  }
  if (it.slot === 'plating') {
    const d = platingOf(it).desc(it.tier);
    return [...(it.hp ? [`+${it.hp} ❤️ de vida máxima`] : []), ...(it.shield ? [`🫧 ${it.shield} de escudo al entrar en cada sala`] : []), ...(d ? [d] : [])];
  }
  return [MODULES[it.kind].desc(it.val)];
}
// COMPARAR con lo que llevas, estadística a estadística: [{ txt, up }] (up: true ▲ mejor, false ▼ peor)
export function statDiff(it, cur) {
  if (!it) return [];
  const out = [];
  const num = (k, label, fmt = (v) => `${v > 0 ? '+' : ''}${v}`) => {
    const d = (it[k] || 0) - (cur?.[k] || 0);
    if (Math.abs(d) > 1e-9) out.push({ txt: `${fmt(+d.toFixed(2))} ${label}`, up: d > 0 });
  };
  if (it.tier !== (cur?.tier ?? -1)) out.push({ txt: `rareza ${RARITY[it.tier].name.toLowerCase()}`, up: it.tier > (cur?.tier ?? -1) });
  if (it.slot === 'weapon') {
    num('dmg', 'de daño');
    if (cur && Math.abs((it.rate || 1) - (cur.rate || 1)) > 1e-9) out.push({ txt: `cadencia ×${(it.rate || 1).toFixed(2).replace(/0$/, '').replace('.', ',')} (llevas ×${(cur.rate || 1).toFixed(2).replace(/0$/, '').replace('.', ',')})`, up: (it.rate || 1) > (cur.rate || 1) });
    num('bounces', 'rebotes');
  } else if (it.slot === 'plating') {
    num('hp', '❤️ de vida máxima');
    num('shield', '🫧 de escudo');
  } else if (cur && cur.kind === it.kind) num('val', '% de efecto');
  return out;
}
// Para comparar (y para que el bot elija): cuanto más raro, mejor
export const itemPower = (it) => (it ? 10 + it.tier * 10 + (it.dmg || 0) + (it.hp || 0) + (it.shield || 0) + (it.affix ? 3 : 0) + (it.unique ? 12 : 0) + (it.set ? 3 : 0) : 0);

// Recalcula lo que da tu equipo (y las bendiciones del altar) sobre las bases de tu nave
export function applyGear(p) {
  const g = p.gear, w = g.weapon, pl = g.plating;
  const all = [g.weapon, g.plating, g.mod1, g.mod2].filter(Boolean);
  const has = (u) => all.some((it) => it.unique === u);
  // SETS: cuántas piezas de cada uno llevas
  const sets = {};
  for (const it of all) if (it.set) sets[it.set] = (sets[it.set] || 0) + 1;
  p.sets = sets;
  const set = (k, n) => (sets[k] || 0) >= n;
  // ETIQUETAS: con 3 iguales, la sinergia
  const tags = tagCounts(g);
  p.tags = tags;
  const syn = {};
  for (const k of Object.keys(TAGS)) syn[k] = (tags[k] || 0) >= SYNERGY_AT;
  p.syn = syn;
  const greed = [g.mod1, g.mod2].some((it) => it?.kind === 'greed') ? 1 : 0;
  p.max = Math.max(1, p.baseMax + (p.bonusMax || 0) + (pl ? pl.hp : 0) + (set('colossus', 2) ? 2 : 0) + (syn.guard ? 1 : 0) - greed - (has('glass') ? 2 : 0));
  p.hp = Math.min(p.hp, p.max);
  p.dmg = (2 + (p.bonusDmg || 0) + (w ? w.dmg : 0) + (set('hunter', 2) ? 1 : 0)) * (has('glass') ? 2 : 1);
  p.rate = 2.4 * (w ? w.rate : 1) * (set('hunter', 3) ? 1.2 : 1) * (set('storm', 2) ? 1.15 : 1);
  p.weapon = w ? w.kind : 'basic';
  p.bounces = (w ? w.bounces : 0) + (w?.affix === 'ricochet' ? 1 : 0);
  p.orbs = w?.kind === 'orbit' ? w.orbs : 0;
  // efectos al golpear
  p.burn = has('reactor') || w?.affix === 'burn' || syn.fire;
  p.burnDmg = syn.fire ? 2 : 1;
  p.stunChance = (w?.affix === 'frost' ? 0.25 : 0) + (set('storm', 3) ? 0.2 : 0);
  p.vamp = w?.affix === 'vamp' ? 0.05 : 0;
  p.chain = (p.weapon === 'arc' ? 2 : 0) + (syn.volt ? 1 : 0);
  p.prism = has('prism');
  // blindajes con identidad
  const pk = pl?.kind;
  p.reflect = pk === 'reflect' ? 2 + pl.tier : 0;
  p.thorns = pk === 'thorns' ? 2 + pl.tier : 0;
  p.regen = pk === 'regen' ? 14 - 2 * pl.tier : 0;
  p.dashNova = Math.max(syn.dodge ? 2 : 0, has('comet') ? 3 : 0);
  p.dashInv = set('ghost', 3) ? 1 : 0;
  p.wardenStun = set('warden', 3);
  // ÚNICOS
  p.anchor = has('anchor');
  p.masterkey = has('masterkey');
  p.reliquary = has('reliquary');
  p.phoenix = has('phoenix');
  const m = { leech: 0, keyring: 0, scanner: 0, magnet: 0, reflex: 0, overcharge: 0, mirror: 0, decoy: 0, greed: 0, hasScanner: false, setPiezas: (set('scrap', 2) ? 30 : 0) + (syn.loot ? 40 : 0), setKeys: set('scrap', 3) || syn.loot };
  for (const it of [g.mod1, g.mod2]) {
    if (!it) continue;
    if (it.kind === 'leech') m.leech = m.leech ? Math.min(m.leech, it.val) - 1 : it.val; // dos sanguijuelas: aún más a menudo
    else m[it.kind] += it.val;
    if (it.kind === 'scanner') m.hasScanner = true;
  }
  if (set('ghost', 2)) m.reflex += 20;
  m.reflex = Math.min(70, m.reflex);
  m.overcharge = Math.min(65, m.overcharge + (syn.volt ? 30 : 0));
  p.mods = m;
  p.dashMax = Math.max(0.45, 1.1 * (1 - m.reflex / 100) * (syn.dodge ? 0.5 : 1));
  p.abMax = 10 * (1 - m.overcharge / 100);
  p.roomShield = (pl ? pl.shield : 0) + (set('colossus', 3) ? 1 : 0) + (set('warden', 2) ? 1 : 0) + (syn.guard ? 1 : 0);
}

// ¿En qué ranura entra? (los módulos: la libre, o la que elijas)
export function slotFor(p, it, prefer = null) {
  if (it.slot !== 'mod') return it.slot;
  if (prefer) return prefer;
  return !p.gear.mod1 ? 'mod1' : !p.gear.mod2 ? 'mod2' : 'mod1';
}
// Con qué lo comparas
export function currentFor(p, it) {
  if (it.slot !== 'mod') return p.gear[it.slot];
  if (!p.gear.mod1 || !p.gear.mod2) return null;
  return itemPower(p.gear.mod1) <= itemPower(p.gear.mod2) ? p.gear.mod1 : p.gear.mod2;
}
// Las etiquetas que tendrías si te pones `it` (para avisar en la comparación de qué sinergia completas)
export function tagsIfEquipped(p, it, slot = slotFor(p, it)) {
  return tagCounts({ ...p.gear, [slot]: it });
}
