// PRIMEROS PASOS: consejos de la GUÍA la primera vez que pasa algo. Módulo puro.
// Cada consejo sale una sola vez (save.tips); en Ajustes se pueden volver a ver todos.
export const TIPS = {
  // al empezar cada juego por primera vez
  runner: [
    ['guia', '¡Bienvenido a OVERDRIVE! Corres solo: tú esquivas. Desliza (o ← →) para cambiar de carril.'],
    ['guia', 'Los colores dicen qué hacer: MAGENTA = cambia de carril · AMARILLO = salta (↑) · CIAN = deslízate (↓).'],
    ['guia', 'Doble toque = DASH: rompe lo que tengas delante. Y pasa ROZANDO los obstáculos: los near-miss llenan el OVERDRIVE.'],
  ],
  galaxy: [
    ['guia', 'Esto es la GALAXIA. Arrastra para girar la nave en todas direcciones y usa la palanca de la izquierda para acelerar o frenar (en 0 se para).'],
    ['guia', 'Dispara a los asteroides para minar. Con la bodega llena, vuelve a la estación: al acercarte sale 🛰️ ATRACAR para vender, mejorar y reparar.'],
    ['guia', 'El 🗺️ mapa te lleva a otros sistemas por sus puertas. En 🎒 tienes tu inventario, las misiones y las noticias de la galaxia.'],
  ],
  arena: [
    ['guia', 'La ARENA: arrastra para moverte (o WASD). Tu nave dispara sola al enemigo más cercano.'],
    ['guia', 'Recoge las gemas azules para subir de nivel y elegir mejoras. Un arma al máximo con su pasiva EVOLUCIONA.'],
    ['guia', 'Sobrevive 10:00: en el 5:00 y el 10:00 llega un jefe. Doble toque = DASH para salir de un apuro.'],
  ],
  pecio: [
    ['guia', 'PECIOS va por TURNOS: cada vez que te mueves (desliza o toca una casilla al lado), los enemigos se mueven una vez.'],
    ['guia', 'Choca con un enemigo para golpearlo. ⚡ DISPARO y luego una dirección dispara en línea recta. Toca tu nave (o ⏳) para esperar un turno.'],
    ['guia', 'Mira sus intenciones: la línea roja de la torreta es por donde va a disparar, la bomba cuenta 2-1. Limpia cada sala para abrir sus puertas y busca la escotilla ⬇️.'],
  ],
  // la primera vez que pasa algo
  boss: [['guia', '¡Un JEFE! Esquiva sus ataques (siempre deja un carril libre) y pasa por su NÚCLEO brillante para dañarlo. Con DASH, doble daño.']],
  arenaLevel: [['guia', '¡Subes de nivel! Elige una mejora: un arma nueva, subir una que tienes o una pasiva. Piensa en combinarlas para evolucionar.']],
  evolve: [['guia', '¡Evolución! Esa arma ya es mucho más potente. Cada arma evoluciona con una pasiva concreta: búscalas.']],
  dock: [['guia', 'Atracado. Vende la carga en el MERCADO (cuanto más vendas aquí, menos paga: prueba otras estaciones), mejora la nave y acepta misiones del tablón.']],
  pirate: [['guia', 'Sistema PIRATA: su estación no te deja atracar. Destruye su base y abate 4 piratas para liberarlo: será de tus aliados.']],
  expedition: [['guia', 'EXPEDICIÓN: elige tu ruta por el mapa, de abajo arriba. Si caes, se acaba; las cartas, escudos y monedas te acompañan todo el viaje.']],
  race: [['guia', 'CARRERA: llega primero. Aquí chocar no mata, pero frena. Con DASH u overdrive sacas a los rivales de la pista.']],
  campaign: [['guia', 'CAMPAÑA: cada nivel tiene META y 3 estrellas. Las pistas son siempre las mismas: apréndetelas.']],
  relic: [['guia', 'Una RELIQUIA: dura toda la expedición. Las ves arriba del mapa.']],
  worldEvent: [['guia', 'La galaxia está viva: ofensivas piratas y el enjambre avanzan con cada salto. Míralo en 🎒 → NOTICIAS.']],
};
export const TIP_KEYS = Object.keys(TIPS);
export const tipSeen = (save, id) => !!save.tips?.[id];
export function markTip(save, id) {
  save.tips = { ...(save.tips || {}), [id]: true };
}
export function resetTips(save) {
  save.tips = {};
}
