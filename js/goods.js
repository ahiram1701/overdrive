// GALAXIA · ECONOMÍA VIVA: además del mineral, MERCANCÍAS que cada estación fabrica o necesita según su tipo,
// con STOCK que se agota cuando compras y se repone con el tiempo, y precios que cambian con los sucesos
// (una ofensiva dispara la maquinaria, el enjambre la medicina). Puro (se testea en Node).
export const GOODS = ['food', 'machines', 'medicine', 'contraband'];
export const isGood = (k) => GOODS.includes(k);
// qué FABRICA (vende barato) y qué NECESITA (paga caro) cada tipo de estación (galaxyLore.STATION_KINDS)
export const TRADE = {
  trade: { make: ['food'], need: ['machines', 'medicine'] },
  mining: { make: [], need: ['food', 'machines'] },
  military: { make: [], need: ['food', 'medicine'] },
  science: { make: ['medicine'], need: ['machines'] },
  shipyard: { make: ['machines'], need: ['food'] },
  black: { make: ['contraband'], need: ['medicine', 'food'] },
};
export const MAKE_SELL = 0.7; // lo que fabrica, lo paga poco
export const NEED_SELL = 1.45; // lo que necesita, lo paga bien
export const WAR_MACHINES = 1.5; // en guerra, la maquinaria vale más
export const SWARM_MEDICINE = 1.6; // con el enjambre, la medicina
export const CONTRA_LEGAL = 0.5; // el contrabando fuera del mercado negro: a mitad… y te buscan
export const makes = (kind, k) => !!TRADE[kind]?.make.includes(k);
export const needs = (kind, k) => !!TRADE[kind]?.need.includes(k);

// multiplicador de VENTA de una mercancía en una estación (los minerales, 1)
export function goodSellMul(kind, k, ev = {}) {
  if (!isGood(k)) return 1;
  if (k === 'contraband') return kind === 'black' ? 1.5 : CONTRA_LEGAL;
  let m = makes(kind, k) ? MAKE_SELL : needs(kind, k) ? NEED_SELL : 1;
  if (ev.war && k === 'machines') m *= WAR_MACHINES;
  if (ev.swarm && k === 'medicine') m *= SWARM_MEDICINE;
  return m;
}

// ---------- STOCK ----------
export const STOCK_MAX = 60;
export const STOCK_JUMP = 8; // se repone por cada salto tuyo…
export const STOCK_MINUTE = 4; // …y por cada minuto de vuelo
const st = (save) => (save.galaxyStock ||= {});
export function stockOf(save, sys, k) {
  const v = st(save)[sys]?.[k];
  return v == null ? STOCK_MAX : v;
}
export function takeStock(save, sys, k, n) {
  const m = st(save);
  m[sys] ||= {};
  m[sys][k] = Math.max(0, stockOf(save, sys, k) - n);
}
export function regenStock(save, n) {
  const m = st(save);
  for (const sys of Object.keys(m)) {
    for (const k of Object.keys(m[sys])) { m[sys][k] += n; if (m[sys][k] >= STOCK_MAX) delete m[sys][k]; }
    if (!Object.keys(m[sys]).length) delete m[sys];
  }
}
// cuanto menos stock queda, más caro (hasta +60 % con el almacén vacío)
export const stockMul = (stock) => 1 + (0.6 * (STOCK_MAX - Math.max(0, Math.min(STOCK_MAX, stock)))) / STOCK_MAX;
