// EXPEDICIÓN: el runner como roguelite con mapa. Módulo puro (mapa, eventos y sus efectos).
// 3 actos; cada uno es un mapa de 7 filas con caminos que se ramifican: empiezas abajo y el jefe
// espera arriba. Eliges tu ruta entre tramos, élites, tiendas, eventos, tesoros y descansos.
import { hashString, makeRng } from './rng.js';

export const ACTS = [
  { name: 'LA PERIFERIA', sub: 'donde empiezan todos' },
  { name: 'EL NÚCLEO FUNDIDO', sub: 'el calor aprieta' },
  { name: 'EL HORIZONTE ROTO', sub: 'más allá no hay nada' },
  { name: 'EL ABISMO', sub: 'solo para quien ya volvió · jefe ÉLITE' },
];
// el 4.º acto solo se abre tras completar una expedición de 3
export const actsTotal = (save) => (save.expedition?.wins > 0 ? ACTS.length : ACTS.length - 1);
export const ROWS = 7; // fila 0: salida; fila 6: jefe

export const NODE = {
  tramo: { icon: '🛣️', name: 'Tramo', desc: 'Un tramo normal. Al final, una carta.' },
  elite: { icon: '☠️', name: 'Élite', desc: 'Tramo duro (x2 puntos, filas más juntas). Premio: carta rara.' },
  shop: { icon: '🛒', name: 'Tienda', desc: 'Compra cartas con tus monedas.' },
  event: { icon: '❓', name: 'Evento', desc: 'Algo pasa. Tú decides.' },
  treasure: { icon: '🎁', name: 'Tesoro', desc: 'Un cofre gratis.' },
  rest: { icon: '🔥', name: 'Descanso', desc: '+1 escudo o mejora una carta.' },
  forge: { icon: '🔨', name: 'Forja', desc: 'Sube tus cartas de nivel o funde monedas en una carta épica.' },
  boss: { icon: '👾', name: 'Jefe', desc: 'Derrótalo para pasar de acto.' },
};

// Tipos por fila (la 1 siempre es un tramo; las élites, a partir de la 3; antes del jefe, más descansos)
function typeFor(rng, row) {
  if (row === 1) return 'tramo';
  const w = [
    { k: 'tramo', w: 40 }, { k: 'event', w: 20 }, { k: 'shop', w: row >= 2 ? 11 : 0 },
    { k: 'treasure', w: 8 }, { k: 'elite', w: row >= 3 ? 14 : 0 }, { k: 'rest', w: row === ROWS - 2 ? 30 : 8 }, { k: 'forge', w: row >= 2 ? 7 : 0 },
  ].filter((x) => x.w > 0);
  return rng.weighted(w).k;
}

// Mapa de un acto: [{ id, row, col (0..1), type, next: [ids] }]. Determinista por semilla y acto.
export function genAct(seed, act) {
  const rng = makeRng(hashString(`exp-${seed}-${act}`));
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    const n = r === 0 || r === ROWS - 1 ? 1 : rng.int(2, 4);
    rows.push(Array.from({ length: n }, (_, i) => ({
      id: `${act}-${r}-${i}`, row: r, col: n === 1 ? 0.5 : (i + 0.5) / n,
      type: r === 0 ? 'tramo' : r === ROWS - 1 ? 'boss' : typeFor(rng, r), next: [],
    })));
  }
  // caminos: cada nodo va a 1-2 de la fila siguiente (los más cercanos), y nadie se queda sin entrada
  for (let r = 0; r < ROWS - 1; r++) {
    const cur = rows[r], nxt = rows[r + 1];
    for (const a of cur) {
      const byDist = [...nxt].sort((p, q) => Math.abs(p.col - a.col) - Math.abs(q.col - a.col));
      const k = Math.min(nxt.length, rng.chance(0.45) ? 2 : 1);
      for (const b of byDist.slice(0, k)) if (!a.next.includes(b.id)) a.next.push(b.id);
    }
    for (const b of nxt) {
      if (cur.some((a) => a.next.includes(b.id))) continue;
      const a = [...cur].sort((p, q) => Math.abs(p.col - b.col) - Math.abs(q.col - b.col))[0];
      a.next.push(b.id);
    }
    for (const a of cur) a.next.sort();
  }
  return rows.flat();
}

export const nodeById = (map, id) => map.find((n) => n.id === id);
export const startOf = (map) => map.find((n) => n.row === 0);

// ---------- Eventos ----------
// Efecto: { coins, shields, card: 'common'|'rare'|'epic', cards: n, risk, mod, od, gems,
//           chance: { p, win: efecto, lose: efecto } }. Los textos dicen siempre lo que hacen.
export const EVENTS = [
  { id: 'scrap', title: 'Chatarrero', text: 'Un dron oxidado te ofrece una carta… a cambio de monedas.', choices: [
    { label: 'Pagar 40 🪙 · carta', need: { coins: 40 }, eff: { coins: -40, card: 'common' } }, { label: 'Seguir', eff: {} }] },
  { id: 'altar', title: 'Altar de cristal', text: 'El altar pide algo que te proteja.', choices: [
    { label: 'Dar 1 🛡️ · carta ÉPICA', need: { shields: 1 }, eff: { shields: -1, card: 'epic' } }, { label: 'Irse', eff: {} }] },
  { id: 'sos', title: 'Señal de socorro', text: 'Alguien pide ayuda en una zona minada.', choices: [
    { label: 'Ayudar · +60 🪙 y el próximo tramo con minas', eff: { coins: 60, mod: 'mines' } }, { label: 'Ignorar', eff: {} }] },
  { id: 'shortcut', title: 'Atajo', text: 'Un túnel sin señalizar. Más rápido, más peligroso.', choices: [
    { label: 'Tomarlo · próximo tramo RIESGO x2', eff: { risk: true } }, { label: 'Por la ruta segura', eff: { coins: 15 } }] },
  { id: 'gemtrader', title: 'Mercader de gemas', text: 'Cambia monedas por gemas de verdad.', choices: [
    { label: 'Cambiar 50 🪙 por 15 💎', need: { coins: 50 }, eff: { coins: -50, gems: 15 } }, { label: 'No', eff: {} }] },
  { id: 'fountain', title: 'Fuente de energía', text: 'Plasma puro, burbujeando.', choices: [
    { label: 'Beber · OVERDRIVE lleno al empezar', eff: { od: true } }, { label: 'Embotellar · +30 🪙', eff: { coins: 30 } }] },
  { id: 'wreck', title: 'Nave abandonada', text: 'Podría tener algo bueno… o una trampa.', choices: [
    { label: 'Saquear · 50%: carta rara · 50%: −1 🛡️', eff: { chance: { p: 0.5, win: { card: 'rare' }, lose: { shields: -1 } } } }, { label: 'Pasar de largo', eff: {} }] },
  { id: 'casino', title: 'Casino neón', text: 'Doble o nada. Las luces parpadean.', choices: [
    { label: 'Apostar 30 🪙 · 50%: +80', need: { coins: 30 }, eff: { coins: -30, chance: { p: 0.5, win: { coins: 80 }, lose: {} } } }, { label: 'Irse', eff: {} }] },
  { id: 'workshop', title: 'Taller', text: 'Un mecánico te deja elegir.', choices: [
    { label: 'Reparar · +1 🛡️', eff: { shields: 1 } }, { label: 'Ajustar · carta', eff: { card: 'common' } }] },
  { id: 'storm', title: 'Tormenta', text: 'Rayos y niebla. Al otro lado brilla algo.', choices: [
    { label: 'Atravesarla · carta rara y próximo tramo con niebla', eff: { card: 'rare', mod: 'fog' } }, { label: 'Rodearla', eff: {} }] },
  { id: 'lab', title: 'Laboratorio', text: '"¿Probamos algo?" dice una voz.', choices: [
    { label: 'Experimento · 2 cartas y próximo tramo con caos', eff: { cards: 2, mod: 'chaos' } }, { label: 'No, gracias', eff: { coins: 10 } }] },
  { id: 'beggar', title: 'Piloto varado', text: 'Le falta combustible para volver.', choices: [
    { label: 'Dar 20 🪙 · +1 🛡️', need: { coins: 20 }, eff: { coins: -20, shields: 1 } }, { label: 'Seguir', eff: {} }] },
  { id: 'oracle', title: 'Oráculo', text: 'Ve tu futuro… por un precio.', choices: [
    { label: 'Pagar 30 🪙 · una RELIQUIA', need: { coins: 30 }, eff: { coins: -30, relic: 'pick' } }, { label: 'Irse', eff: {} }] },
  { id: 'smuggler', title: 'Contrabandista', text: 'Vende reliquias robadas. Solo acepta escudos.', choices: [
    { label: 'Dar 1 🛡️ · una RELIQUIA', need: { shields: 1 }, eff: { shields: -1, relic: 'pick' } }, { label: 'No', eff: {} }] },
  { id: 'cursed', title: 'Reliquia maldita', text: 'Brilla demasiado. Algo pesa sobre ella.', choices: [
    { label: 'Cogerla · RELIQUIA y próximo tramo FRÁGIL', eff: { relic: 'pick', mod: 'fragile' } }, { label: 'Dejarla · +10 🪙', eff: { coins: 10 } }] },
  { id: 'twin', title: 'Espejo gemelo', text: 'Tu reflejo lleva tus mismas cartas… un poco mejores.', choices: [
    { label: 'Mirarse · sube 1 carta de nivel', eff: { upgrade: 1 } }, { label: 'Romperlo · +25 🪙', eff: { coins: 25 } }] },
  { id: 'roulette', title: 'Ruleta', text: 'Una rueda con un solo premio de verdad.', choices: [
    { label: 'Girar (20 🪙) · 33%: carta ÉPICA', need: { coins: 20 }, eff: { coins: -20, chance: { p: 0.33, win: { card: 'epic' }, lose: {} } } }, { label: 'No', eff: {} }] },
  { id: 'pilgrim', title: 'Peregrino', text: 'Te pide un escudo para su viaje. Promete pagarte bien.', choices: [
    { label: 'Dar 1 🛡️ · +60 🪙 y sube 1 carta', need: { shields: 1 }, eff: { shields: -1, coins: 60, upgrade: 1 } }, { label: 'Seguir', eff: {} }] },
];
// FORJA (nodo): opciones fijas
export const FORGE = { id: 'forge', title: '🔨 Forja', text: 'El yunque aún está caliente.', choices: [
  { label: 'Templar · sube 2 cartas de nivel', eff: { upgrade: 2 } },
  { label: 'Fundir 40 🪙 · carta ÉPICA', need: { coins: 40 }, eff: { coins: -40, card: 'epic' } },
  { label: 'Seguir', eff: {} }] };

// ---------- Reliquias ----------
// Objetos pasivos para toda la expedición: los dan los élites y tesoros (a veces), los jefes (siempre)
// y algunos eventos. Se elige 1 de 3.
export const RELICS = {
  cristal: { icon: '🛡️', name: 'Escudo de cristal', desc: 'el primer golpe de cada tramo no cuenta' },
  avaro: { icon: '💰', name: 'Avaro', desc: '+25% de monedas' },
  brasa: { icon: '🔥', name: 'Brasa eterna', desc: 'cada tramo empieza con medio overdrive' },
  coleccionista: { icon: '🎴', name: 'Coleccionista', desc: 'una carta más para elegir' },
  corazon: { icon: '❤️', name: 'Corazón de reserva', desc: '+1 🛡️ al empezar cada acto' },
  hucha: { icon: '🐷', name: 'Hucha', desc: '+25 🪙 al acabar cada tramo' },
  iman: { icon: '🧲', name: 'Imán eterno', desc: 'más alcance del imán' },
  gema: { icon: '💎', name: 'Gema del viajero', desc: '+10 💎 por cada acto' },
  mapa: { icon: '🗺️', name: 'Cartógrafo', desc: '+20 🪙 en cada evento' },
  fenix: { icon: '🪶', name: 'Pluma de fénix', desc: 'una vida extra' },
};
export const RELIC_KEYS = Object.keys(RELICS);
export function offerRelics(owned, rng, n = 3) {
  return rng.shuffle(RELIC_KEYS.filter((k) => !owned.includes(k))).slice(0, n);
}
// la elección de reliquia se muestra como un evento (mismo panel)
export const relicEvent = (ids) => ({ id: 'relic', title: '🏺 RELIQUIA', text: 'Elige una: te acompaña el resto de la expedición.', choices: [
  ...ids.map((id) => ({ label: `${RELICS[id].icon} ${RELICS[id].name} · ${RELICS[id].desc}`, eff: { relic: id } })),
  { label: 'Ninguna', eff: {} }] });
export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

// ¿Se puede elegir? (monedas o escudos suficientes)
export const canChoose = (choice, st) => !choice.need || ((st.coins ?? 0) >= (choice.need.coins ?? 0) && (st.shields ?? 0) >= (choice.need.shields ?? 0));

// Resuelve el azar de un efecto: devuelve el efecto final, sin "chance"
export function resolveEffect(eff, rng) {
  if (!eff.chance) return { ...eff };
  const { chance, ...rest } = eff;
  const won = rng.next() < chance.p;
  return { ...rest, ...(won ? chance.win : chance.lose), lucky: won };
}

// Evento de un nodo (determinista: siempre el mismo para el mismo nodo)
export const eventFor = (seed, nodeId) => EVENTS[makeRng(hashString(`ev-${seed}-${nodeId}`)).int(0, EVENTS.length - 1)];

// Progreso comparable de una expedición (para el récord): acto * 10 + fila
export const progressOf = (act, row) => act * 10 + row;
