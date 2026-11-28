// GALAXIA · EL UNIVERSO COMO LUGAR: cada estación tiene nombre, tipo (y lo que eso cambia) y cada sistema
// su descripción procedural (estrella, edad, historia y un rasgo). Determinista y puro.
import { hashString } from './rng.js';

const h = (s) => hashString(s);
const pick = (arr, key) => arr[h(key) % arr.length];

// TIPOS de estación según quién manda: no son solo nombre, cada uno tiene su ventaja
export const STATION_KINDS = {
  trade: { name: 'Puerto comercial', icon: '🏪', perk: 'vende un 6 % más caro', sell: 1.06, repair: 1 },
  mining: { name: 'Estación minera', icon: '⛏️', perk: 'compra mineral local un 15 % más barato', buy: 0.85, sell: 1, repair: 1 },
  military: { name: 'Fortaleza', icon: '🛡️', perk: 'reparar cuesta un 25 % menos', sell: 1, repair: 0.75 },
  science: { name: 'Laboratorio', icon: '🔬', perk: 'mejoras un 3 % más baratas y reparar un 10 % menos', sell: 1, repair: 0.9, up: 0.97 },
  black: { name: 'Mercado negro', icon: '🕶️', perk: 'compra lo que sea… a un 8 % menos', sell: 0.92, repair: 1.1 },
  shipyard: { name: 'Astillero', icon: '🔩', perk: 'mejoras un 5 % más baratas', sell: 1, repair: 0.9, up: 0.95 },
};
const BY_OWNER = { liga: ['trade', 'trade', 'mining', 'shipyard'], coal: ['military', 'science', 'mining', 'shipyard'], pir: ['black', 'black', 'mining'] };
const PREFIX = { trade: ['Puerto', 'Bazar', 'Lonja'], mining: ['Mina', 'Excavación', 'Pozo'], military: ['Fortaleza', 'Bastión', 'Cuartel'], science: ['Laboratorio', 'Observatorio', 'Instituto'], black: ['Guarida', 'Antro', 'Refugio'], shipyard: ['Astillero', 'Dique', 'Grada'] };

export function stationOf(sys, owner = 'liga', seed = 0) {
  if (!sys) return null;
  if (sys.id === 0 && !sys.sec) return { kind: 'trade', ...STATION_KINDS.trade, sell: 1, perk: 'tu puerto de siempre: precios justos', title: `Puerto ${sys.name}` };
  const list = BY_OWNER[owner] || BY_OWNER.liga;
  const kind = pick(list, `stk-${seed}-${sys.id}`);
  return { kind, ...STATION_KINDS[kind], title: `${pick(PREFIX[kind], `stn-${seed}-${sys.id}`)} ${sys.name}` };
}

const AGE = ['joven', 'antiquísima', 'moribunda', 'inestable', 'tranquila', 'binaria', 'que se apaga', 'rodeada de polvo'];
const PAST = [
  'Aquí se libró la última batalla de la Guerra del Silencio.',
  'Una colonia entera desapareció en una noche; nadie sabe adónde fue.',
  'Los primeros mineros llegaron hace tres siglos y nunca se fueron.',
  'Un convoy de refugiados fundó la estación con lo que pudo salvar.',
  'Los piratas lo usaron de escondite hasta que la Liga lo limpió.',
  'Una señal de origen desconocido se repite aquí cada 19 horas.',
  'Fue un puesto de la Coalición, abandonado tras un motín.',
  'Los comerciantes juran que aquí se hace el mejor licor de la galaxia.',
  'Un científico loco intentó encender una estrella artificial. Casi lo logra.',
  'Las cartas de navegación antiguas lo marcan como "no entrar".',
  'Su cinturón de asteroides es lo que queda de un planeta destruido.',
  'Cada año, miles de naves vienen a ver la conjunción de sus lunas.',
];
const TRAIT = [
  'Las tormentas solares hacen parpadear las luces de la estación.',
  'Los asteroides brillan con vetas de mineral.',
  'Hay restos de naves por todas partes.',
  'El tráfico de cargueros no para ni de noche.',
  'Huele a aceite quemado y a dinero.',
  'Las patrullas vigilan cada puerta.',
  'La radio está llena de canciones viejas.',
  'Los muelles están medio vacíos: malos tiempos.',
];
export function sysLore(sys, seed = 0) {
  if (!sys) return '';
  const k = `${seed}-${sys.id}`;
  return `Estrella ${sys.star?.kind || 'amarilla'} ${pick(AGE, `age-${k}`)}. ${pick(PAST, `past-${k}`)} ${pick(TRAIT, `trait-${k}`)}`;
}
