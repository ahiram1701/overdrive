<div align="center">

# ⚡ OVERDRIVE

**Runner de velocidad neón para el móvil. Dopamina a lo bruto.**

### [▶ JUGAR AHORA](https://ahiram1701.github.io/overdrive/)

[![CI](https://github.com/ahiram1701/overdrive/actions/workflows/ci.yml/badge.svg)](https://github.com/ahiram1701/overdrive/actions/workflows/ci.yml)
[![Deploy](https://github.com/ahiram1701/overdrive/actions/workflows/deploy.yml/badge.svg)](https://github.com/ahiram1701/overdrive/actions/workflows/deploy.yml)
![PWA](https://img.shields.io/badge/PWA-offline-5a0fc8)
![Sin dependencias](https://img.shields.io/badge/runtime-0%20dependencias-ff2bd6)

<img src="docs/gameplay.gif" width="270" alt="Partida a toda velocidad con explosiones y combo">

<img src="docs/menu.png" width="200" alt="Menú"> <img src="docs/gameplay.png" width="200" alt="Partida con obstáculos"> <img src="docs/cards.png" width="200" alt="Elección de cartas"> <img src="docs/boss.png" width="200" alt="Jefe">

</div>

## 📲 Instalar en el móvil
1. Abre **https://ahiram1701.github.io/overdrive/** en Chrome (Android) o Safari (iOS).
2. Elige **Añadir a pantalla de inicio** o **Instalar app**.
3. Se abre a pantalla completa y funciona **sin conexión**.

La vibración solo funciona en Android; iOS no soporta `navigator.vibrate`.

## 🎮 Controles

| Acción | Móvil | Teclado |
|---|---|---|
| Cambiar de carril | deslizar ← → | ← → / A D |
| Saltar | deslizar ↑ | ↑ / W |
| Deslizarse (en el aire: caída rápida) | deslizar ↓ | ↓ / S |
| **DASH**: rompe lo que tengas delante | doble toque | Espacio |
| Pausa | botón ❚❚ | P / Esc |

Puedes encadenar swipes sin levantar el dedo.

## 🚦 Leer los obstáculos
Cada color te dice qué hacer, en todos los biomas:

| Color | Qué hacer | Obstáculos |
|---|---|---|
| 🟥 **Magenta** con X | Cambia de carril o haz DASH | muros, muros móviles (▶ indica hacia dónde van), puertas |
| 🟨 **Amarillo ▲** | Salta | barreras, láser bajo, minas |
| 🟦 **Cian ▼** | Deslízate por debajo | barra colgante, láser alto |

## 🔥 Cómo sacar puntos
- **Near-miss:** pasa rozando un obstáculo justo después de moverte. Si lo haces en el último instante es un **¡PERFECTO!**, con cámara lenta incluida.
- **Combo (x1 → x99):** sube con near-miss, roturas y monedas. Si pasan 3 s sin hacer nada empieza a bajar, y un golpe lo reinicia.
- **OVERDRIVE:** se carga con near-miss y roturas. Durante unos segundos eres invencible, todo lo que tocas explota, vas un 50% más rápido y puntúas el doble.
- **Escudos (máx. 3):** cada uno aguanta un golpe, pero un golpe nunca da nada: pierdes el escudo, el combo y medio overdrive. Solo se consiguen en bifurcaciones, cofres, cartas o con **Vampiro**, que da uno cada 12 near-miss.
- **El Cazador:** si pasas 3 s sin tocar nada aparece un dron que marca tu carril en rojo y dispara. Sus disparos atraviesan la invulnerabilidad. Esquiva 2 seguidos y se retira con un **¡ESCAPASTE!** y bonus. Cada vez que vuelve, tarda menos en aparecer.
- **Velocidad:** no para de subir. Hay avisos a los 500 km/h, en MACH 1, en MACH 2…

## 🛣️ Estructura de una partida
1. **Tramos** con biomas que rotan: Neón urbano, Túnel de lava, Vacío glitch e Hiperespacio. En mitad de un tramo puede saltar un **evento**: controles invertidos, mundo al revés, lluvia de monedas o "solo near-miss".
2. Al final de cada tramo, una **bifurcación**: elige carril según la recompensa (☠️ Riesgo x2, 🛒 Tienda, 🎁 Cofre, 🛡️ Escudo, 🪙 Monedas, 🃏 Cartas raras).
3. Después **eliges 1 de 3 cartas**. Las cartas cambian las reglas y se combinan en sinergias.
4. **Cada 3 tramos, un jefe.** Esquiva sus disparos y haz **DASH contra sus núcleos rojos** antes de que escape.
5. Al morir ganas **gemas 💎** para el hangar: naves nuevas y mejoras permanentes.
6. **Reto diario:** la misma pista para todo el mundo durante el día.

<!-- CARDS:START -->
### Cartas
| | Carta | Rareza | Efecto | Máx. |
|---|---|---|---|---|
| 🧲 | **Imán** | común | Atrae las monedas cercanas. Se acumula. | 3 |
| ⚡ | **Doble carga** | rara | +1 carga de DASH. | 2 |
| 🛡️ | **Escudo** | rara | Aguanta 1 golpe (máximo 3 escudos). | 2 |
| 👁️ | **Reflejos** | común | Ventana de near-miss más grande y cámara lenta más larga. | 3 |
| 💉 | **Adrenalina** | rara | Cada near-miss recarga media carga de DASH. | 1 |
| 🌋 | **Terremoto** | rara | Al aterrizar de un salto destruyes lo que tengas delante en tu carril. | 1 |
| 🦘 | **Salto doble** | rara | Puedes saltar otra vez en el aire. | 1 |
| 💥 | **Dash ancho** | rara | Tu DASH destruye obstáculos en los 3 carriles. | 1 |
| 🧨 | **Explosivo** | épica | Lo que rompes explota y arrasa todo lo cercano en cadena. | 1 |
| 🔥 | **Overdrive+** | común | El OVERDRIVE dura +2 s. | 3 |
| 🔋 | **Cargador** | común | El OVERDRIVE se llena un 35% más rápido. | 3 |
| 🪙 | **Monedas de oro** | común | Cada moneda vale +1. | 3 |
| 💎 | **Pacto de cristal** | épica | x3 PUNTOS… pero pierdes un carril para siempre. | 1 |
| 🚀 | **Nitro loco** | épica | +50% de velocidad y x2 PUNTOS. | 1 |
| 🧛 | **Vampiro** | rara | Cada 12 near-miss ganas un escudo. | 1 |
| 🧷 | **Seguro de combo** | común | Perder un escudo no reinicia tu combo. | 1 |
| ⏱️ | **Recarga rápida** | común | El DASH recarga un 25% más rápido. | 3 |
| 🪶 | **Ágil** | común | Cambias de carril y saltas más rápido. | 2 |

### Sinergias
Si tienes las dos cartas de una sinergia, se activa un efecto extra.

| Sinergia | Combina | Efecto |
|---|---|---|
| **SUPERNOVA** | 🧲 Imán + 🔥 Overdrive+ | En OVERDRIVE las monedas valen x3 y el imán es gigante. |
| **BULLDOZER** | 🧨 Explosivo + 💥 Dash ancho | DASH +50% de duración y recarga un 30% más rápido. |
| **ZEN** | 👁️ Reflejos + 💉 Adrenalina | Los near-miss PERFECTOS cargan un 15% extra de OVERDRIVE. |
| **METEORO** | 🦘 Salto doble + 🌋 Terremoto | Terremoto con doble alcance y +500 puntos por golpe. |
| **KAMIKAZE** | 💎 Pacto de cristal + 🚀 Nitro loco | x2 PUNTOS extra. Sí, otra vez. |
| **SANGRE DORADA** | 🧛 Vampiro + 🪙 Monedas de oro | Cada moneda suma combo extra. |

### Naves (hangar)
| Nave | Coste | Habilidad |
|---|---|---|
| **Viper** | gratis | Equilibrada. La de siempre. |
| **Brick** | 💎 60 | Empieza con 2 escudos, pero cambia de carril más lento. |
| **Ghost** | 💎 150 | Ventana de near-miss enorme y DASH que recarga rápido. |
| **Nova** | 💎 300 | OVERDRIVE se llena un 60% más rápido y dura +2 s. |
| **Kaiju** | 💎 500 | Empieza con Dash ancho y Explosivo (¡BULLDOZER!), pero x0.7 puntos. |
<!-- CARDS:END -->

### Ajustes del menú
🔊 sonido · 📳 vibración · ✨ efectos intensos (shake, flashes) · **Aa** textos en pantalla: normal o mínimo.

## 🛠️ Desarrollo
El juego no necesita build (HTML, CSS y JS nativos); Node solo hace falta para las herramientas.

```bash
npm ci
npx playwright install chromium
npm run serve
```

Con `npm run serve` el juego queda en http://localhost:8080.

| Comando | Qué hace |
|---|---|
| `npm test` | Lint + tests unitarios + E2E (un bot juega con semillas fijas y falla si la pista se vuelve imposible) |
| `npm run screenshots` | Regenera las capturas y el GIF de `docs/` |
| `npm run docs:cards` | Regenera las tablas de cartas, sinergias y naves de este README |

URL de desarrollo: `?nosw` desactiva la caché offline; `?debug` muestra los FPS y expone `G` y `D` en la consola; `?debug&seed=N` fija la pista.

**Flujo:** rama → PR (la CI tiene que pasar) → merge a `main` → despliegue automático en GitHub Pages, con la caché del service worker versionada por commit.
