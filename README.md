# OVERDRIVE

Runner de velocidad neón hecho como PWA: HTML, CSS y JavaScript puros, sin dependencias ni paso de build.

## Cómo se juega
- **Deslizar ← →** para cambiar de carril. **↑** para saltar y **↓** para deslizarte (en el aire hace caída rápida).
- **Doble toque** activa el DASH: rompe lo que tengas delante y recarga con el tiempo.
- Si pasas **rozando** un obstáculo justo después de moverte, haces un NEAR-MISS: ganas puntos, subes el combo y cargas el OVERDRIVE.
- Al final de cada tramo eliges un camino de la **bifurcación** y luego **1 de 3 cartas**. Cada 3 tramos aparece un **jefe**, que se derrota haciendo DASH contra sus núcleos.
- En PC: flechas o WASD para moverte, espacio para el DASH y P para pausar.

## Ejecutar en local
Los service workers solo funcionan sobre `http://localhost` o `https`, así que hay que servir la carpeta (abrir `index.html` con doble clic no basta):

```bash
python -m http.server 8080
```

Después abre http://localhost:8080. Si añades `?debug`, verás los FPS y tendrás `window.G` en la consola.

## Publicar e instalar en el móvil
1. Sube la carpeta a un repositorio de GitHub y activa **Settings → Pages** (rama `main`, carpeta raíz).
2. Abre la URL en el móvil y elige **Añadir a pantalla de inicio**.
3. Cada vez que publiques cambios, sube la versión de `CACHE` en `sw.js` para que los móviles descarguen la nueva.

La vibración solo funciona en Android; iOS no soporta `navigator.vibrate`.
