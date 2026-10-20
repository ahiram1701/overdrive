// TEXTOS CENTRADOS EN iPHONE: en Safari de iOS, fillText/strokeText con textAlign 'center' (o 'right'/'end')
// colocan mal el texto cuando lleva emojis (sobre todo los que llevan el selector U+FE0F: 🛡️ 🏚️ 🗝️ ⬇️…): el
// texto empieza en el punto de anclaje y se sale por la derecha, aunque measureText mide bien. Así que aquí se
// alinea "a mano" para TODO el juego: se mide y se dibuja alineado a la izquierda en la posición que toca.
// El texto solo-ASCII no pasa por aquí (no hay emojis que lo descoloquen y no cuesta nada).
const NON_ASCII = /[^\x20-\x7e]/;

function patch(proto) {
  if (!proto || proto.__textfix) return;
  proto.__textfix = true;
  for (const name of ['fillText', 'strokeText']) {
    const orig = proto[name];
    proto[name] = function (str, x, y, maxWidth) {
      const align = this.textAlign;
      const s = String(str);
      if ((align === 'left' || align === 'start') || !NON_ASCII.test(s)) {
        return maxWidth === undefined ? orig.call(this, s, x, y) : orig.call(this, s, x, y, maxWidth);
      }
      let w = this.measureText(s).width;
      if (maxWidth !== undefined && w > maxWidth) w = maxWidth; // con maxWidth el navegador lo estrecha hasta ahí
      const rtl = this.direction === 'rtl';
      const dx = align === 'center' ? w / 2 : align === 'right' || (align === 'end' && !rtl) ? w : 0;
      this.textAlign = 'left';
      try {
        if (maxWidth === undefined) orig.call(this, s, x - dx, y);
        else orig.call(this, s, x - dx, y, maxWidth);
      } finally {
        this.textAlign = align;
      }
    };
  }
}

if (typeof CanvasRenderingContext2D !== 'undefined') patch(CanvasRenderingContext2D.prototype);
if (typeof OffscreenCanvasRenderingContext2D !== 'undefined') patch(OffscreenCanvasRenderingContext2D.prototype);
