# OVERDRIVE

[![CI](https://github.com/ahiram1701/overdrive/actions/workflows/ci.yml/badge.svg)](https://github.com/ahiram1701/overdrive/actions/workflows/ci.yml)
[![Deploy](https://github.com/ahiram1701/overdrive/actions/workflows/deploy.yml/badge.svg)](https://github.com/ahiram1701/overdrive/actions/workflows/deploy.yml)

Runner de velocidad neón hecho como PWA: HTML, CSS y JavaScript puros, sin dependencias ni paso de build.

**▶ Jugar ahora: https://ahiram1701.github.io/overdrive/**

## Cómo se juega
- **Deslizar ← →** para cambiar de carril. **↑** para saltar y **↓** para deslizarte (en el aire hace caída rápida).
- **Doble toque** activa el DASH: rompe lo que tengas delante y recarga con el tiempo.
- Si pasas **rozando** un obstáculo justo después de moverte, haces un NEAR-MISS: ganas puntos, subes el combo y cargas el OVERDRIVE.
- Al final de cada tramo eliges un camino de la **bifurcación** y luego **1 de 3 cartas**. Cada 3 tramos aparece un **jefe**, que se derrota haciendo DASH contra sus núcleos.
- En PC: flechas o WASD para moverte, espacio para el DASH y P para pausar.

## Desarrollo
El juego no necesita build; Node solo hace falta para las herramientas de desarrollo.

```bash
npm ci
npx playwright install chromium
npm run serve
```

Con `npm run serve` el juego queda en http://localhost:8080. Parámetros útiles en la URL:
- `?nosw`: desactiva el service worker para no trabajar contra la caché.
- `?debug`: muestra los FPS y expone `window.G` y `window.D`. `G.god = true` te hace invencible y `D.step(s)` simula `s` segundos.
- `?seed=N`: solo con `?debug`, fija la pista.

`npm test` ejecuta lint (ESLint), tests unitarios (`node:test`) y tests E2E (Playwright). El E2E incluye un bot que juega con semillas fijas y falla si la generación crea un tramo imposible.

### Flujo de trabajo
1. Cada cambio va en su rama y en una PR contra `main`. La CI (`ci.yml`) tiene que pasar para poder hacer merge.
2. Al hacer merge, `deploy.yml` vuelve a pasar la CI, sustituye la versión de caché de `sw.js` por `overdrive-<sha>` y publica en GitHub Pages. Los móviles con el juego instalado reciben la versión nueva en la siguiente carga.

La vibración solo funciona en Android; iOS no soporta `navigator.vibrate`.
