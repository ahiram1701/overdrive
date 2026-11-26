// NOVEDADES de cada modo: una tarjeta en su menú que cuenta lo nuevo (con un punto hasta que la abres)
export const NEWS_V = 1;
export const NEWS = {
  pecio: {
    title: '✨ NOVEDADES DE PECIOS',
    items: [
      '🎁 Cofres y jefes: <b>elige 1 de 3</b> objetos (o desguázalo por 🔩).',
      '🔫 Armas nuevas: <b>Cañón</b>, <b>Fragmentador</b> (se parte al impactar) y <b>Acumulador</b> (se carga; quieto, el doble).',
      '💠 Blindajes con efecto: Reflectante, Espinas, Regenerativo y Ablativo. 6 sets y 8 únicos.',
      '🔥⚡🧲💨🛡️ <b>Sinergias</b>: junta 3 piezas de la misma etiqueta y se activa un bonus.',
      '🗺️ 18 formas de sala con trampas (pinchos, cintas, láser que barre) y salas de <b>élite</b>.',
      '☠️ A la salida, la <b>escotilla peligrosa</b>: maldición a cambio de ×1,5 🔩 y mejor botín.',
      '👹 Jefes al azar en las plantas 3, 6 y 9, y 4 enemigos nuevos: Divisor, Sanador, Saltador y Minador.',
      '⚡ Racha por limpiar rápido; si tardas, el pecio se inunda.',
      '🛠️ Taller en 3 ramas (18 mejoras), 4 cargamentos, <b>Profundidad</b> 1-10, bóveda de hasta 3 huecos e <b>Inmersión del día</b>.',
    ],
  },
  galaxy: {
    title: '✨ NOVEDADES DE GALAXIA',
    items: [
      '📖 La historia tiene <b>3 finales</b> según lo que elijas, cada uno con su nave.',
      '🏳️ <b>Campañas de facción</b> (pestaña Facción de la estación): 5 misiones y un chasis exclusivo.',
      '🌀 <b>Ciclo+</b>: tras el final y con la galaxia libre de piratas, otra galaxia más dura y mejor pagada.',
      '🔭 5 <b>sistemas ocultos</b> tras agujeros de gusano (Salto Mk 6-10) y anomalías nuevas: estación abandonada, reliquia, nebulosa y baliza.',
      '👾 Enemigos nuevos: Reparador, Fragata (escudo frontal), Portanaves y Tirador fantasma.',
      '🎯 Armas nuevas en Fabricación: riel, flak de área, haz continuo e iónico.',
      '💠 <b>Chips</b> con afijos que sueltan los piratas: se montan en la estación.',
      '🛟 Contratos de rescate y de asesinato.',
      '📈 Cada estación paga distinto y cambia cada 6 saltos (mira el 📈 del mapa), y tus puestos rinden créditos.',
    ],
  },
};
// la tarjeta: abierta la primera vez; al abrirla, ya no sale el punto
export function newsCard(save, mode, persist) {
  const N = NEWS[mode], seen = (save.news?.[mode] || 0) >= NEWS_V;
  const d = document.createElement('details');
  d.className = 'news-card';
  d.id = `news-${mode}`;
  d.open = !seen;
  d.innerHTML = `<summary>${N.title}${seen ? '' : '<span class="news-dot">NUEVO</span>'}</summary><ul>${N.items.map((t) => `<li>${t}</li>`).join('')}</ul>`;
  const mark = () => {
    if ((save.news?.[mode] || 0) >= NEWS_V) return;
    save.news = { ...(save.news || {}), [mode]: NEWS_V };
    persist?.();
    d.querySelector('.news-dot')?.remove();
  };
  d.addEventListener('toggle', mark);
  if (!seen) setTimeout(mark, 0); // verla una vez basta
  return d;
}
