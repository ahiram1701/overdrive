<div align="center">

# ⚡ OVERDRIVE

**Runner de velocidad neón para el móvil. Dopamina a lo bruto.**

### [▶ JUGAR AHORA](https://ahiram1701.github.io/overdrive/)

[![CI](https://github.com/ahiram1701/overdrive/actions/workflows/ci.yml/badge.svg)](https://github.com/ahiram1701/overdrive/actions/workflows/ci.yml)
[![Deploy](https://github.com/ahiram1701/overdrive/actions/workflows/deploy.yml/badge.svg)](https://github.com/ahiram1701/overdrive/actions/workflows/deploy.yml)
![PWA](https://img.shields.io/badge/PWA-offline-5a0fc8)
![Sin dependencias](https://img.shields.io/badge/runtime-0%20dependencias-ff2bd6)

<img src="docs/gameplay.gif" width="270" alt="Partida a toda velocidad con explosiones y combo">

<img src="docs/menu.png" width="200" alt="Menú"> <img src="docs/gameplay.png" width="200" alt="Partida con obstáculos"> <img src="docs/cards.png" width="200" alt="Elección de cartas"> <img src="docs/boss.png" width="200" alt="Jefe"> <img src="docs/hangar.png" width="200" alt="Hangar con árbol de mejoras"> <img src="docs/campaign.png" width="200" alt="Mapa de campaña"> <img src="docs/modifiers.png" width="200" alt="Modificadores"> <img src="docs/arena.png" width="200" alt="Modo Arena"> <img src="docs/expedition.png" width="200" alt="Mapa de la Expedición"> <img src="docs/race.png" width="200" alt="Carrera contra rivales"> <img src="docs/galaxy.png" width="200" alt="Galaxia en 3D">

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
El **cuerpo** te dice qué es y el **chevrón** (▲ ▼) qué hacer, igual en todos los biomas:

| Aspecto | Qué hacer | Qué es |
|---|---|---|
| 🟥 **Magenta** con X | Cambia de carril o haz DASH (no se puede saltar) | muros, muros móviles (▶ indica hacia dónde van), puertas |
| 🟨 **Amarillo ▲** | Salta | barreras, láser bajo |
| 🟦 **Cian ▼** | Deslízate por debajo (tampoco se salta) | barra colgante, láser alto |
| 🔴 **Rojo con picos** | Esquiva; si lleva ▲, también se puede saltar | disparos del jefe y del Cazador, minas |
| 🟢 **Verde** | ¡Ve a por él con DASH! | núcleo del jefe |
| 🟡 **Rombo dorado** con destello | Cógelo | monedas (lo único dorado de la pista) |

**Elementos especiales:**
- **Pinzas** (magenta ▶◀): dos mandíbulas cierran un carril justo antes de llegar.
- **Rodillos** (amarillo ▲): ruedan hacia ti más rápido que la pista.
- **Plataformas que caen** (cian ▼): bajan del techo en el último momento.
- 🌀 **Portales**: te cambian de carril; la flecha indica a cuál.
- 🟢 **Rampas**: te lanzan por los aires con un arco de monedas.
- **Rieles**: súbete saltando su punta y haz *grind*, que suma puntos, combo y overdrive mientras lo recorres.
- 🎯 **Dianas**: rómpelas con DASH, láser u overdrive para un bonus.

## 🔥 Cómo sacar puntos
- **Near-miss:** pasa rozando un obstáculo justo después de moverte. Si lo haces en el último instante es un **¡PERFECTO!**, con cámara lenta incluida.
- **Combo (x1 → x99):** sube con near-miss, roturas y monedas. Si pasan 3 s sin hacer nada empieza a bajar, y un golpe lo reinicia.
- **OVERDRIVE:** se carga con near-miss y roturas. Durante unos segundos eres invencible, todo lo que tocas explota, vas un 50% más rápido y puntúas el doble.
- **Escudos (máx. 3):** cada uno aguanta un golpe, pero un golpe nunca da nada: pierdes el escudo, el combo y medio overdrive. Solo se consiguen en bifurcaciones, cofres, cartas o con **Vampiro**, que da uno cada 12 near-miss.
- **El Cazador:** si pasas 3 s sin tocar nada aparece un dron que marca tu carril en rojo y dispara. Sus disparos atraviesan la invulnerabilidad. Esquiva 2 seguidos y se retira con un **¡ESCAPASTE!** y bonus. Cada vez que vuelve, tarda menos en aparecer.
- **Velocidad:** no para de subir. Hay avisos a los 500 km/h, en MACH 1, en MACH 2…

## 🌍 Biomas, set pieces y eventos
- **Cada bioma tiene su mecánica:**
  - **Túnel de lava:** ríos de lava que recorren un carril.
  - **Vacío glitch:** muros que saltan de carril; un fantasma verde marca el destino antes.
  - **Hiperespacio:** gravedad baja, con saltos más largos y flotantes.
  - **Neón urbano:** cortinas de láser bajo y alto seguidas.
- **Set pieces:** desde el tramo 3, a veces aparece una secuencia guionizada con aviso: **TÚNEL** (rieles y portales), **ESTAMPIDA** (oleada de rodillos), **LLUVIA DE MINAS** o **AGUJERO DE GUSANO** (el mundo gira).
- **Eventos:** controles invertidos, mundo al revés, lluvia de monedas, solo near-miss, **apagón** (solo ves lo cercano), **tormenta magnética** (todas las monedas vienen a ti) y **combo doble**.

## 👾 Jefes
Cada 3 tramos aparece un jefe. Hay 5, cada uno con su forma, sus ataques y una **segunda fase** al llegar al 50% de vida:

| Jefe | Fase 1 | Fase 2 |
|---|---|---|
| **Gusano de neón** | disparos | + lluvia de muros |
| **Ojo del vacío** | rayo (marca los carriles en rojo antes de disparar) | + disparos |
| **Devorador** | minas + succión hacia su carril | + disparos |
| **El Censor** | ráfaga en todos los carriles menos uno; núcleo **blindado** (el láser rebota: solo DASH) | + rayo |
| **Mamá Ovni** | disparos + dianas | ráfaga + dianas + minas |

## 🌌 Modo GALAXIA (nuevo)
Un juego de naves en **3D**, con la cámara detrás de tu nave, en una galaxia que se explora a tu ritmo.
- **Vuelo libre:** la nave gira en **sus propios ejes**, así que puedes dar **rizos completos**, volar boca abajo y alabear.
  - **Joystick** donde apoyes el dedo: arriba/abajo = cabeceo sin tope, a los lados = giro.
  - **↺ ↻** para alabear sobre ti misma. Si activas la **nivelación automática** en Ajustes (viene apagada), el ala vuelve sola a la horizontal.
  - **Palanca MOTOR** (izquierda): de **marcha atrás** (−40%) a **parado** y **a tope**. ⏩ da un impulso aparte.
    - Tiene una **muesca en el 0** (la raya verde): cerca del 0 se engancha en **PARADO**, vibra al llegar y no se escapa sin querer.
    - La nave **frena suave** en unas décimas.
    - Con el teclado, R/F se paran en el 0 hasta que sueltas la tecla.
  - **🎒 Panel de vuelo** (botón bajo el mapa, o **I**), que pausa la partida:
    - **inventario:** bodega con su valor aquí, materiales, misiles, equipo montado y mejoras;
    - **misiones activas:** capítulo de la historia, caza, misiones de las estaciones (con su progreso, a cuántos saltos están y ✕ para abandonar), el suceso del sistema y la liberación.
  - 🔫 dispara, con autoapuntado suave hacia lo que tengas delante.
  - En teclado: **WASD**/flechas = cabeceo y giro, **Q/E** = alabeo, **R/F** = acelerador, espacio = disparar, Shift = impulso.
  - Sensibilidad y eje vertical invertido, en ⚙️ Ajustes.
- **Sistema ORIGEN:** un sol (no te acerques demasiado), 3 planetas, un cinturón de asteroides y una estación que gira.
- **Espectáculo:** nebulosas de fondo con el color de cada estrella, planetas con atmósfera, bandas de nubes y lado nocturno, estela 3D con el color de tu motor, explosiones con onda expansiva, chispas al impactar y el escudo que brilla al recibir.
- **Combate:**
  - **🚀 Misiles teledirigidos** (mejora *Misiles*): mantén un enemigo en el visor hasta que ponga **FIJADO** y dispara. La munición se recarga al atracar. En teclado: **M**.
  - **🌀 Tonel** (doble toque o **X**): una vuelta de campana hacia un lado, invulnerable mientras dura. Esquiva balas y misiles.
  - **Enemigos:** cazas, **interceptores** rápidos y frágiles, **bombarderos** lentos que lanzan misiles (derríbalos a tiros) y **enjambres de drones**. Aparecen más tipos al alejarte de ORIGEN.
  - **🏴‍☠️ Bases piratas** con 4 torretas: destruirlas da un gran botín de créditos.
- **Sucesos al llegar a un sistema** (con aviso):
  - ☄️ **lluvia de meteoritos**: minería rápida, el doble de mineral, pero duelen;
  - 🆘 **cápsula de rescate**: llévala a la estación (créditos);
  - 🚚 **convoy mercante**: alcánzalo y te compra la carga a +40%;
  - 🌀 **agujero de gusano**: un atajo a un sistema al azar;
  - 🏴‍☠️ **asalto a una base pirata**.
- **🏳️ Facciones y territorio:** cada sistema tiene dueño (el anillo de color en el mapa):
  - **⛏️ Liga Minera**, **☀️ Coalición Solar** o **☠️ Piratas del Vacío** (lo más lejano);
  - en los sistemas **piratas** su estación no te deja atracar y hay una **base pirata**. **Libéralos** destruyendo la base y 4 piratas: pasan a la facción con la que te llevas mejor y el mapa cambia de color ("liberados x/12");
  - a veces los piratas contraatacan: **⚔️ ASEDIO**, defiende la estación;
  - **reputación** con cada facción (sus misiones, cazar piratas, liberar). Como **Amigo** o **Aliado** te pagan más el mineral, el taller y la reparación salen más baratos, y su **tienda de facción** vende pinturas y motores exclusivos con créditos.
- **🎯 SE BUSCA:** en cada estación hay carteles con **piratas con nombre** ("Vex el Rojo"), con nivel, un rasgo (escurridizo, blindado, enjambre o artillero) y recompensa.
  - Acepta una caza y la brújula te lleva hasta él. **Se mueve** de sistema cada pocos saltos.
  - Si te destruye, **sube de nivel** y su recompensa también.
- **🔧 Fabricación:** los piratas, bases, jefes y descubrimientos sueltan **materiales**:
  - 🔩 chatarra, 🔌 circuitos, ⚛️ núcleos y 🗿 artefactos.

  En el taller de cada estación, con **créditos y materiales**, se fabrican y se montan en **2 huecos de arma y 2 de módulo** (también desde la pestaña GALAXIA del hangar):
  - **armas:** láser doble, metralla, cañón de plasma y torreta automática;
  - **módulos:** escudo reactivo, imán grande, motor de curvatura, bodega extra y lanzamisiles rápido.
- **📖 Historia LA SEÑAL:** 8 capítulos con diálogos (la Dra. Ilen, el capataz Brak, la propia Señal…) que te llevan de ORIGEN al sistema más lejano.
  - Por el camino: balizas, una entrega, una **elección de facción**, una emboscada, **el Heraldo** y una base pirata.
  - Al final, el jefe **🌑 El Devorador de Estrellas**, en 3 fases:
    1. sus tres ojos lo hacen invulnerable;
    2. destruidos los ojos, el núcleo queda al descubierto, con drones y misiles;
    3. FURIA, con anillos de balas.
  - El premio: la nave **Errante**, para todos los modos.
  - Los capítulos se ven en el ATLAS.
  - **Acto II · El Enjambre** (8 capítulos más, en otros sistemas): sin el Devorador, su colmena despierta con una **Reina**. Llega **Vex**, un pirata desertor, y decides quién lo protege.
    - Objetivos nuevos: **vender** mineral en un sistema (cuenta por unidades) y **escanear** una baliza corrupta (5 s a su lado).
    - Jefe **🐝 La Reina del Enjambre**: pone drones y, mientras la protejan 3, su escudo lo aguanta todo. Abate a sus hijas y ataca antes de que las reponga.
    - Premio: 8.000 💰, 3 núcleos y el logro **La Reina caída** (con su estilo exclusivo).
  - **Acto III · El Origen** (8 capítulos): la Señal no era una víctima. Vuelven Ilen, Brak y Vex; el **Heraldo renacido** (con el doble de vida) y el jefe final **🌑 El Devorador Primordial**, con 4 ojos, más vida y dos anillos de balas en la furia.
    - Premio: 15.000 💰, el logro **Origen** y el chasis **🌌 Errante Mk II** (solo por la historia; en el astillero aparece como «📖 Acto III» hasta ganarlo): lo mejor de todos los chasis, 3 + 3 huecos.
  - **📜 La Crónica** (sin fin): tras el Acto III siguen capítulos generados: balizas, escaneos, entregas, ventas, cazas y bases por toda la galaxia, cada vez más duros y mejor pagados. Cada 5, un jefe (ecos del Heraldo y de la Reina, más fuertes en cada vuelta). Logro **Cronista** por 10.
  - El HUD y el panel 🎒 dicen dónde vas: «Acto II · 3/8» o «Crónica #12».
- **🪐 ORBITAR planetas:** al acercarte a uno aparece ORBITAR. Cada planeta tiene nombre, tipo e historia; el primer sobrevuelo paga y cada uno compra un mineral a ×1,5.
- **Minar:** dispara a los asteroides. Los grandes se parten en dos y sueltan mineral, que el imán lleva a tu bodega.
- **Estación:** al acercarte aparece 🛰️ ATRACAR. Dentro:
  - vendes el mineral;
  - mejoras **motor, láser, escudo, bodega, salto y misiles** (5 niveles cada uno);
  - reparas el casco.
- **30 sistemas** unidos por **puertas de salto**: crúzalas y llegas al vecino, con un túnel de hiperespacio. El **peligro** crece con la distancia a ORIGEN, y el mineral también vale más (hierro, cristal, plasma, materia oscura). La mejora **Salto** te deja llegar más lejos.
- **🗺️ Mapa galáctico:** ves lo visitado y sus vecinos (lo demás es niebla). Toca un sistema y **traza la ruta**: la brújula te guía de puerta en puerta.
- **Piratas:** atacan en pasadas, esquivan y huyen con poca vida. Llevan corchetes rojos para verlos siempre, y sueltan 💰. En los sistemas más peligrosos hay **jefes piratas**. Tu láser se **sobrecalienta** si no paras.
- **Comercio:** cada estación paga distinto. Compra barato el mineral local y véndelo donde lo paguen más.
  - **Mercado vivo:** cada estación paga las 10 primeras unidades de un mineral a precio completo. A partir de ahí, cada una baja un 2% (hasta −60%, la estación muestra "📉 −34%"). El precio se recupera mientras vuelas. Vaciar la bodega siempre en el mismo sitio sale caro; repartir entre sistemas, no.
- **Mantenimiento:**
  - **peaje** en cada puerta de salto (25 + 15 × el peligro del destino; si no te llega, te lo perdonan);
  - **recargar misiles** cuesta 40 💰 cada uno, en los Suministros de las estaciones;
  - reparar cuesta más.
- **🚀 Astillero** (en cualquier estación): **chasis espaciales** que se compran con créditos y se cambian cuando quieras. Tu nave del hangar conserva su aspecto; el chasis cambia stats, huecos y tamaño.
  - **Explorador** (el tuyo);
  - **Carguero** (15K): bodega ×2,2, lento;
  - **Interceptor** (22K): +30% velocidad y giro, frágil, 3 armas;
  - **Acorazado** (40K): casco y escudo ×1,7, 3 + 3 huecos;
  - **Corsario** (60K): +4 misiles, fija antes, impulso rapidísimo.
- **Mejoras sin techo:** cada mejora de la nave sigue del nivel 5 al **Mk 10** (◆ naranja). Cada Mk es más caro y pide materiales, y rinde la mitad que un nivel normal. El **Salto** Mk 6+ abarata los peajes.
- **Equipo con niveles:** cada pieza fabricada sube de nivel 1 a 5 con créditos y materiales (+12% por nivel: más daño, más cadencia, más alcance…).
- **🏗️ Puestos avanzados:** en un sistema que **liberaste**, funda tu propia estación por **20K** (verde, con su nombre; 🏗️ en el mapa). Atraca en ella o en la del sistema para ampliarla con **módulos de 3 niveles** (6K–30K cada uno):
  - 🔧 **Taller**: fabricar y subir equipo allí sale un 20–40% más barato;
  - 📦 **Almacén**: guarda 100–300 de carga y materiales a salvo;
  - 📡 **Radar**: el mapa revela los sistemas a 2–4 saltos;
  - 🗼 **Torretas**: disparan solas a los piratas cercanos;
  - 🛒 **Mercado propio**: sus precios se recuperan 2–4 veces más rápido y pagan un 5–15% más.

  Logros: **Colono** (primer puesto) y **Gobernador** (un puesto con todo al nivel 3).
- **🛒 Suministros** (en las estaciones, hasta 5 de cada uno). En vuelo, con el botón **🧰** o las teclas **1–5**:
  - 🧰 kit de reparación (+40% de casco);
  - 🔋 escudo de emergencia;
  - 💣 minas (3 detrás de ti);
  - 🎈 señuelo (los piratas lo persiguen 6 s);
  - 🏠 baliza de retorno (a tu estación base).
- **Zona segura:** junto a las estaciones los piratas no entran.
- **Tablón de misiones** en cada estación (hasta 3 activas, pagan créditos):
  - 🎯 caza: elimina N piratas en un sistema;
  - 📦 entrega: lleva un paquete a otra estación;
  - 📡 exploración: escanea un punto de interés;
  - 🛡️ escolta: protege un carguero hasta una puerta mientras lo atacan incursores.

  La brújula te lleva de un objetivo al siguiente.
- **Descubrimientos y ATLAS:** cada sistema esconde anomalías, pecios, señales y planetas raros. Vuela cerca unos segundos para **escanearlos**: pagan, cuentan su historia y llenan el **ATLAS**. Con 3, 8 y 15 descubrimientos ganas mejoras únicas (Motor de curvatura, Blindaje alienígena, Ojo del oráculo).
- **Relajado:** si te destruyen, te remolcan a la última estación donde atracaste. Pierdes la carga, nunca los créditos ni las mejoras.
- Arriba siempre está el **siguiente paso** ("Vuelve a la estación a vender") y una flecha que te lleva hasta él.
- Un motor 3D propio sobre Canvas 2D, sin librerías: ~2 ms por fotograma en el móvil.

## ⚔️ Modo ARENA
Un juego distinto dentro de OVERDRIVE, al estilo *survivors*.
- **Vista cenital:** te mueves libre (arrastra el dedo como un joystick, o WASD/flechas) y **tu nave dispara sola**.
- **Oleadas cada vez más grandes** de 6 tipos de enemigo: el Embestidor avisa con una línea antes de cargar, el Divisor se parte en dos al morir… Un **élite** por minuto suelta un cofre con una mejora gratis.
- **Subes de nivel cada pocos segundos** y eliges 1 de 3 mejoras:
  - hasta 4 armas (Blásteres, Escopeta, Lanza, Pulso, Lanzallamas, Misiles, Orbes);
  - hasta 4 pasivas, cada una de 5 niveles;
  - un arma al máximo con su pasiva **evoluciona**: Tormenta, Supernova, Infierno…
- **Cada nave empieza con su arma**, y su habilidad ⚡ funciona en la arena: tiempo bala, embestida, fase, onda, empuje, rayo, salto. Doble toque = DASH.
- **4 mapas** (la tarjeta ARENA abre la elección; cada uno con récord y victorias):
  - ▦ **Rejilla**: abierta, la de siempre;
  - ☄️ **Cinturón** (sobrevive 5:00): cerrado, con rocas que paran naves y balas (las tuyas y las suyas);
  - 🔥 **Forja** (derrota a un jefe): charcos de lava que queman; cada 20 s un **pulso** los agranda (avisa antes);
  - 🕳️ **Vacío** (gana una vez): cerrado, con 2 agujeros negros que atraen a todos y aplastan a los enemigos.
- **Sobrevive 10:00.** En el 5:00 y el 10:00 llega el jefe de ese mapa, y un **anillo de energía** cierra el combate hasta que cae. Cada jefe tiene sus ataques y una **FASE 2** a media vida:
  - **Coloso**: embiste avisando con una línea, anillos y abanicos de balas;
  - **La Colmena**: pone crías; con 4 vivas, su **escudo** lo para todo;
  - **Tejedora**: láseres que giran (finos un momento antes de quemar);
  - **Núcleo**: espirales de balas que cambian de sentido;
  - **Devorador**: te atrae (el DASH te suelta) y siembra minas.
- Gemas y XP para el hangar y el rango. Récord, logros y misiones propias.

## 🗺️ Modo EXPEDICIÓN
El runner convertido en **roguelite con mapa**: 3 actos, y en cada uno eliges tu ruta por un mapa que se ramifica (la salida abajo, el jefe arriba).
- **Nodos:**
  - 🛣️ Tramo (al final, una carta);
  - ☠️ Élite: tramo duro, con carta rara;
  - 🛒 Tienda;
  - ❓ Evento: 12 decisiones de riesgo y recompensa, como un casino, un altar o una nave abandonada;
  - 🎁 Tesoro;
  - 🔥 Descanso: +1 escudo o sube de nivel una carta;
  - 👾 Jefe.
- Escudos, monedas y cartas te acompañan todo el viaje. Si caes, se acaba.
- Cada acto superado da gemas; completar la expedición da un buen premio de XP. Logros propios.

## 🏁 Modo CARRERAS
- **3 copas de 3 pistas** (Neón, Magma y Vacío) contra **3 rivales IA con personalidad**:
  - **BRUTO** busca tu carril y empuja;
  - **SEDA** corre limpio;
  - **CHISPA** mete acelerones.
- Los rivales corren por la **misma pista** y esquivan sus obstáculos (cada copa los hace más hábiles). Con DASH u overdrive **los sacas de la pista**.
- **Chocar frena, no mata**: la carrera siempre acaba. Posición en directo y podio con puntos (10/6/3/1); al final de la copa, medalla. Cada medalla abre la copa siguiente.
- **Tu fantasma:** se guarda tu mejor carrera de cada pista y la próxima vez corres contra ella (el HUD dice a cuántos segundos vas).

## 🧪 Modificadores y mutación del día
- **12 modificadores** que cambian las reglas a cambio de **más puntos y gemas**:
  - Turbo, Caos, Campo minado, Cristal, Jefazos, Cazador voraz;
  - Avaricia, Ingravidez, Frágil, Sin DASH, Niebla y Al revés.
- Se activan con el ⚙️ de la tarjeta **RUNNER**, y se recuerdan para la próxima partida.
- El bonus se multiplica: Turbo + Cristal = x2,08 puntos. Las gemas suben la mitad, con tope x3.
- Se **desbloquean con el rango**, uno cada pocos rangos: siempre hay uno nuevo a la vista.
- **🧬 Mutación del día:** cada día, 2 modificadores y la misma pista para todos. El primer intento paga **x1,5 gemas**.
- Los tests comprueban que el bot sobrevive sin golpes con cada modificador que cambia la pista.

## 🗺️ Campaña
Además del modo infinito hay una **campaña de 16 niveles** en 4 sectores (Distrito neón, Forja de lava, El vacío e Hiperespacio):
- Cada nivel tiene **pista fija** (siempre la misma, para aprendértela), un número de tramos y una **línea de META**. El 4.º nivel de cada sector es un **jefe**.
- **3 estrellas por nivel:** llegar a la meta (o derrotar al jefe) y dos objetivos más, como "sin perder escudos", "25 near-miss", "combo x35" o "120 monedas". Las estrellas se guardan: nunca se pierden.
- Superar un nivel abre el siguiente; los **sectores se abren con estrellas** (6, 15 y 26).
- La primera vez que superas un nivel ganas sus gemas, y cada estrella nueva da +5 💎.
- Los tests comprueban que el bot llega a la meta de **todos** los niveles sin un solo golpe: ninguna pista fija es injusta.
- **Y no se acaba:** tras el sector 4 llegan los **sectores generados** (5, 6, 7…), siempre los mismos para todos:
  - cada uno con nombre propio, a veces con **dos biomas que se alternan**;
  - cada nivel trae **1–2 modificadores fijos**, y la dificultad sigue subiendo;
  - desde el sector 6, uno de cada dos acaba en un **JEFE ÉLITE**: ataques de su fase 2 desde el principio, uno prestado de otro jefe y +50% de vida;
  - cada sector se abre al vencer al jefe del anterior, y el mapa enseña siempre el siguiente cerrado.

## 🛣️ Estructura de una partida
1. **Tramos** con biomas que rotan: Neón urbano, Túnel de lava, Vacío glitch e Hiperespacio. En mitad de un tramo puede saltar un **evento**: controles invertidos, mundo al revés, lluvia de monedas o "solo near-miss".
2. Al final de cada tramo, una **bifurcación**: elige carril según la recompensa (☠️ Riesgo x2, 🛒 Tienda, 🎁 Cofre, 🛡️ Escudo, 🪙 Monedas, 🃏 Cartas raras).
3. Después **eliges 1 de 3 cartas**. Las cartas cambian las reglas y se combinan en sinergias.
4. **Cada 3 tramos, un jefe.** Esquiva sus disparos y **pasa por sus núcleos verdes** antes de que escape: tocarlos le hace daño, y con DASH el golpe es **crítico (doble)**. El núcleo blindado del Censor solo cede al DASH.
5. Al morir ganas **gemas 💎** para el hangar, y las **🪙 que no gastaste** van a tu cartera.

## ⚡ Habilidades y hangar
- **Cada nave tiene una habilidad activa propia.** Se lanza con el botón ⚡ (abajo a la derecha) o con **E**/**Q** en el teclado. Tiene un tiempo de recarga, que se ve en el anillo del botón, y **cada near-miss lo recorta 0,15 s**.
- **Árbol de mejoras por nave** en el hangar (pestaña MEJORAS): 3 ramas de **5 niveles** que se compran con gemas, en orden.
  - 🛡️ **BLINDAJE:** escudo inicial, más invulnerabilidad, ÚLTIMO ALIENTO, SEGURO de combo y ÚLTIMO ALIENTO doble.
  - ⚙️ **MOTOR:** agilidad, una carga extra de DASH, más OVERDRIVE, DASH que recarga antes y aún más agilidad.
  - **La rama de la habilidad:** recarga, duración y, en el nivel 3, una **mutación** que cambia cómo funciona; los niveles 4 y 5 dan potencia.
  - **★ MAESTRÍA:** con las 3 ramas completas: +10% de puntos, habilidad más fuerte y la **pintura de maestro** exclusiva de la nave.
  - **Ficha antes de comprar:** tocar un nodo muestra las 6 barras antes → después y lo que cambia la habilidad; se paga con MEJORAR.
  - **↺ Reiniciar árbol:** devuelve todas las gemas de esa nave (gratis la primera vez, luego 💎 50).
- **Ficha de cada nave:** 6 barras (velocidad, agilidad, DASH, overdrive, defensa y puntos), calculadas con las reglas reales del juego y comparadas con tu nave equipada (▲ mejor, ▼ peor).
- **Hangar por pestañas:** NAVE (ficha y compra), MEJORAS (árbol), ESTILO (personalización) y **GALAXIA**.
  - **GALAXIA:** cómo vuela cada nave en la Galaxia (cada una tiene su perfil: el Titán aguanta más, la Spectra corre más…) y las mejoras de la nave espacial, compradas con créditos sin salir del hangar.
  - La cabecera con el carrusel y la **vista 3D queda fija**: ves la nave mientras la mejoras o la personalizas.
  - Un puntito avisa de qué pestaña tiene algo que ya puedes comprar.
- **Vista 3D:** la nave gira en el hangar (arrástrala para girarla) con su pintura, su emblema y su estela; al comprar una mejora destella y da una vuelta.
- **🏛️ EXPOSICIÓN:** tu nave a pantalla completa sobre una plataforma giratoria, con focos y reflejo. Desliza para ver otra y pulsa **COMPARAR** para ponerla junto a la equipada con sus barras.
- **Nombre propio:** ✏️ en la ficha. Se ve en el hangar, la exposición y la estación de la Galaxia.
- **Personalización por nave:** cada nave lleva su propia **pintura, color del motor, estela, aura, color de disparo, explosión y emblema**.
  - Lo que compras con gemas vale **solo para esa nave**. Lo que da el rango o un logro vale para todas.
  - **Exclusivos** que se ganan usando la nave: 2 pinturas (30 tramos y 5 jefes con ella) y su **insignia**, la silueta de la propia nave (20 partidas).
  - **Pruébalo antes de comprar:** tocar cualquier objeto lo pone en la vista 3D. La explosión estalla y la nave se vuelve a montar.
  - **Emblema a tu gusto:** en las dos alas, en una sola o en la cola, y en el color que quieras (gratis). Siempre cabe dentro de su cara: se centra en el incentro del triángulo y se recorta a su contorno.
  - **Pinturas con patrón** (Tigre a franjas, Dúo partida, Aurora en degradado), estelas de **Humo** y **Relámpago**, y explosiones **Agujero negro** y **Fuegos artificiales**.

## 🏠 Menú
El menú tiene los **3 juegos**:
- **🏁 RUNNER** abre su pantalla con el modo **Infinito** (con ⚙️ modificadores y tus potenciadores) y sus 4 modos: **🗺️ Campaña**, **🧭 Expedición**, **🏆 Carreras** y **🧬 Mutación** del día;
- **🌌 GALAXIA**;
- **⚔️ ARENA**.

Debajo están las misiones del día, y en la barra inferior: Inicio · Hangar · Tienda · Logros · Colección.

## 💰 Economía y 🛒 Tienda
Dos economías separadas (toca 💎 o 🪙 en el menú para verlo):

| Moneda | Juegos | Se gana | Se gasta |
|---|---|---|---|
| 🪙 **Monedas** | Runner y Arena | lo que **no gastas** en la tienda de cada partida, las bajas de la Arena y los cofres | **potenciadores**, **cofres estándar**, **maestría de cartas**, **talentos** de Runner y Arena |
| 💎 **Gemas** | Runner y Arena | partidas, campaña, misiones, rangos y logros | naves, árbol de mejoras, estilos, **cofres de élite**, **cartas nuevas**, **armas del arsenal** |
| 💰 **Créditos** | solo Galaxia | minería, comercio, misiones, cazas, bases e historia | nave espacial, taller de fabricación, reparaciones, tienda de facción y **talentos de la Galaxia** (en sus estaciones) |

En la **🛒 TIENDA** (barra inferior):
- **🎁 Cofres de suministros:** estándar (🪙 1.500) o de élite (💎 150). Cada uno trae 3 objetos con rareza (común, raro, épico, legendario): estilos que **aún no tienes** (nunca repetidos, incluidos exclusivos de cofre), potenciadores, maestrías de carta, monedas o gemas. **Épico garantizado** como mucho cada 10 cofres.
- **⚡ Potenciadores** (con 🪙): consumibles de un solo uso. Marca hasta 2 para tu próxima partida (Infinito, campaña, mutación o expedición; no en carreras):
  - 🛡️ escudo extra;
  - 🧲 imán;
  - 🚀 arranque en el tramo 3;
  - ❤️ **segunda vida**;
  - 📈 doble XP;
  - 🍀 carta rara al empezar.
- **🌟 Talentos:** mejoras permanentes, en orden, en tres árboles de 5 (Runner y Arena con 🪙 en la Tienda; Galaxia con 💰 en sus estaciones):
  - **Runner:** escudo inicial, carta inicial, 60 🪙 al empezar, tienda más barata y elegir entre 4 cartas;
  - **Arena:** vida, daño, alcance de XP, arma inicial a nivel 2 y Fénix (revivir);
  - **Galaxia:** bodega, misiles, mejor precio de venta, reparación a mitad y escudo.

  Las antiguas "mejoras globales" del hangar son ahora los dos primeros talentos del Runner (si ya las tenías, se conservan).
- **🔱 Arsenal de la Arena** (en Talentos): 4 armas nuevas que, una vez compradas, pueden salir al subir de nivel: Rayo gemelo, Relámpago, Minas y Bumerán, cada una con su evolución.
- **🃏 Mazo** (en Colección): **8 cartas nuevas** que se desbloquean con gemas (Turbo, Chatarrero, Fortuna, Aerodinámica, Trofeo, Mecánico, Parachoques y Tesoro) y **maestría** de 3 niveles para cada carta (con 🪙): cuanto más alta, más a menudo te sale. Los cofres también suben maestrías.
- **Más estilo:** grupos nuevos **🏁 Rayas** (de carreras, sobre el lomo) y **🪟 Cabina**, y más pinturas, motores y disparos.

## ⚖️ Balance
El juego engancha mientras haya que esquivar. Por eso **ninguna build puede vivir invulnerable**, y un test del bot lo comprueba:
- **Overdrive:** carga más despacio y, al acabar, se **recalienta 5 s** (barra gris: "RECALENTANDO"); no se puede encadenar uno tras otro.
- **Topes:** cargas de overdrive x1,5, duración 7 s, 3 cargas de DASH y recarga mínima de 2,4 s.
- **Cartas repetidas, menos efecto:** Cargador +35/+25/+15%, Overdrive+ +2/+1,5/+1 s, Recarga rápida −20/−15/−10%. La carta dice cuánto da la siguiente copia.
- **Vampiro** pide cada vez más near-miss por escudo (12, 18, 24…), y Doble carga solo se puede coger una vez.
- **Medido con el bot** en 120 s, con el árbol al máximo:
  - ninguna nave pasa del 28% del tiempo en overdrive ni del 35% invulnerable en total;
  - Nova con la build más rota se queda en ~34%;
  - antes: Viper 64%, Nova 84% y Nova rota 96%.

## 🏆 Rango, logros y colección
- **Rango de piloto (1-30):** cada partida da XP según distancia, near-miss, tramos, jefes y misiones. Cada rango nuevo da gemas.
- **69 logros** de bronce, plata y oro: de "100 near-miss" a "100 millones de puntos en una partida", pasando por cofres, talentos, maestrías y la Galaxia.
  - **Cada logro desbloquea un estilo exclusivo** con su nombre ("Pintura Leyenda", "Motor Cazajefes"…), que vale para **todas las naves**: los de oro dan pinturas con patrón; los de plata, rayas, motores o pinturas; y los de bronce, disparos, cabinas o motores. Además dan unas gemas (5/10/20 💎).
  - En **🏆 Logros** cada uno enseña su premio, y los conseguidos tienen **EQUIPAR** para ponértelo al momento.
  - Al desbloquear uno en plena partida se celebra en el momento, con el estilo que acabas de ganar.
- **Colección:** las cartas, sinergias y jefes que has visto. Lo que te falta aparece en silueta.

## ✨ Prestigio
- Al llegar al **rango 30** aparece **PRESTIGIO** en el menú; pide confirmación con un segundo toque.
- Vuelves al rango 1, con **+5% de gemas para siempre** por cada nivel (hasta +50%), y los rangos se vuelven a pagar.
- **Lo desbloqueado por rango no se pierde.**
- **Premios exclusivos:**
  - prestigio 1: emblema *Laurel*;
  - prestigio 2: pintura *Arlequín*;
  - prestigio 3: estela *Prisma*;
  - prestigio 5: marco dorado en el hangar;
  - prestigio 10: explosión *Singularidad*;
  - en los demás niveles, 200 💎.
- No tiene límite.

## 🎯 Misiones diarias
Cada día hay **3 misiones**, una fácil (+15 💎), una media (+25 💎) y una difícil (+40 💎). Son las mismas para todos y cambian a medianoche. Algunas se acumulan durante el día ("haz 60 near-miss") y otras hay que lograrlas en una sola partida ("llega a x50 de combo"). Al completar una en plena partida se celebra en el momento y las gemas se suman al instante. El progreso se ve en el menú y en la pantalla final.

<!-- CARDS:START -->
### Cartas
| | Carta | Rareza | Efecto | Máx. |
|---|---|---|---|---|
| 🧲 | **Imán** | común | Atrae las monedas cercanas. Se acumula. | 3 |
| ⚡ | **Doble carga** | rara | +1 carga de DASH. | 1 |
| 🛡️ | **Escudo** | rara | Aguanta 1 golpe (máximo 3 escudos). | 2 |
| 👁️ | **Reflejos** | común | Ventana de near-miss más grande y cámara lenta más larga. | 3 |
| 💉 | **Adrenalina** | rara | Cada near-miss recarga un cuarto de carga de DASH. | 1 |
| 🌋 | **Terremoto** | rara | Al aterrizar de un salto destruyes lo que tengas delante en tu carril. | 1 |
| 🦘 | **Salto doble** | rara | Salta otra vez en el aire. Bien medido, ¡pasas por encima de los muros! | 1 |
| 💥 | **Dash ancho** | rara | Tu DASH destruye obstáculos en los 3 carriles. | 1 |
| 🧨 | **Explosivo** | épica | Lo que rompes explota y arrasa todo lo cercano en cadena. | 1 |
| 🔥 | **Overdrive+** | común | El OVERDRIVE dura +2 s. | 3 |
| 🔋 | **Cargador** | común | El OVERDRIVE se llena un 35% más rápido. | 3 |
| 🪙 | **Monedas de oro** | común | Cada moneda vale +1. | 3 |
| 💎 | **Pacto de cristal** | épica | x3 PUNTOS… pero pierdes un carril para siempre. | 1 |
| 🚀 | **Nitro loco** | épica | +50% de velocidad y x2 PUNTOS. | 1 |
| 🧛 | **Vampiro** | rara | Ganas un escudo a los 12 near-miss; cada uno siguiente pide 6 más. | 1 |
| 🧷 | **Seguro de combo** | común | Perder un escudo no reinicia tu combo. | 1 |
| ⏱️ | **Recarga rápida** | común | El DASH recarga un 20% más rápido. | 3 |
| 🪶 | **Ágil** | común | Cambias de carril y saltas más rápido. | 2 |
| 🏎️ | **Turbo** | común | +10% de velocidad y +10% de puntos. | 2 |
| 🔩 | **Chatarrero** | común | +15 🪙 al empezar cada tramo. Se acumula. | 2 |
| 🍀 | **Fortuna** | común | Más cartas raras y épicas en las elecciones. | 2 |
| 🪁 | **Aerodinámica** | común | Saltas más alto y caes más despacio. | 2 |
| 🎯 | **Trofeo** | rara | Escapar del Cazador te da 1 escudo. | 1 |
| 🔧 | **Mecánico** | rara | Cada 3 tramos sin perder escudos, ganas 1. | 1 |
| 🧱 | **Parachoques** | épica | El primer golpe de cada tramo no te quita escudo (sí combo y overdrive). | 1 |
| 💰 | **Tesoro** | épica | x1,5 gemas al acabar la partida. | 1 |

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
| Nave | Coste | Pasiva | Habilidad activa ⚡ | ★ Mutación (árbol, nivel 3) |
|---|---|---|---|---|
| **Viper** | gratis | Equilibrada. La de siempre. | ⏩ **SOBRECARGA** (18 s): 4 s de tiempo bala; los near-miss valen el doble. | Cada near-miss alarga la SOBRECARGA 0,3 s |
| **Brick** | 💎 60 | Empieza con 2 escudos, pero cambia de carril más lento. | 🐏 **ARIETE** (24 s): 2,5 s rompiendo todo lo que tocas (sin poder saltar). | Cada rotura con el ARIETE recarga 1 s |
| **Ghost** | 💎 150 | Ventana de near-miss enorme y DASH que recarga rápido. | 👻 **FASE** (18 s): 1,2 s intangible: lo que atraviesas cuenta como PERFECTO. | Al salir de FASE, una onda rompe lo cercano |
| **Nova** | 💎 300 | OVERDRIVE se llena un 20% más rápido y dura +1 s. | 💥 **ESTALLIDO** (25 s): +10% de overdrive y arrasa todo lo que tienes delante. | ESTALLIDO carga un 25% de OVERDRIVE |
| **Kaiju** | 💎 500 | Empieza con Dash ancho y Explosivo (¡BULLDOZER!), pero x0.7 puntos. | 🦖 **RUGIDO** (30 s): Limpia los 3 carriles por delante y atrae todas las monedas. | RUGIDO te da 1 escudo |
| **Raptor** | 💎 400 | Nerviosa: cambia de carril un 20% más rápido y su DASH recarga antes. | 🔫 **LÁSER** (6 s): Dispara por tu carril y rompe el primer obstáculo (o daña al jefe). | Dispara en los 3 carriles |
| **Comet** | 💎 650 | Cazatesoros: cada moneda vale +1 y el imán viene de serie, pero el OVERDRIVE carga un 20% más lento. | 🪝 **GANCHO** (10 s): Te lanza al carril del extremo opuesto al instante. | El GANCHO arrasa lo que tienes delante |
| **Manta** | 💎 800 | Planea: ventana de near-miss algo mayor y +20% de invulnerabilidad tras un golpe. | 🫧 **BURBUJA** (20 s): 5 s dentro de una burbuja que absorbe el próximo golpe. | Al estallar, la BURBUJA arrasa lo cercano |
| **Spectra** | 💎 950 | Rayo: cambia de carril un 15% más rápido y puntúa x1.1, pero su DASH recarga más lento. | ⚡ **SALTO CORTO** (12 s): Te teletransporta 35 m adelante (no con un jefe delante). | Al aparecer, rompes lo que tienes delante |
| **Titán** | 💎 1100 | Fortaleza: empieza con 1 escudo y más invulnerabilidad tras un golpe, pero x0.85 puntos. | 🔨 **MARTILLO** (16 s): Rompe todo lo que hay en tu carril hasta 60 m (y golpea al jefe). | El MARTILLO golpea los 3 carriles |
| **Halcón** | 💎 1300 | Ligera: el DASH recarga un 10% antes, pero x0.95 puntos. | 🔰 **ESCUDO DE ENERGÍA** (32 s): +1 escudo (si ya estás al máximo, 20 🪙). | Al activarla, una onda rompe lo cercano |
| **Quimera** | 💎 1500 | Codiciosa: +20% de puntos, pero el DASH recarga un 15% más lento. | 🌀 **CAOS** (22 s): Arrasa lo que tienes delante (40 m) y cada pieza te da 5 🪙. | CAOS atrae todas las monedas de la pista |
| **Errante** | gratis | La nave de La Señal: +10% en todo lo que importa (agilidad, OVERDRIVE y puntos). | 🕳️ **SINGULARIDAD** (28 s): Un agujero negro arrasa 50 m en los 3 carriles y atrae las monedas. | La SINGULARIDAD te da 1 escudo |
<!-- CARDS:END -->

### Ajustes del menú
En **⚙️ Ajustes** (arriba a la derecha del menú): 🔊 sonido · 📳 vibración · ✨ efectos intensos (shake, flashes) · **Aa** textos en pantalla: normal o mínimo · y para la Galaxia: sensibilidad, invertir el eje vertical y nivelación automática.

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
