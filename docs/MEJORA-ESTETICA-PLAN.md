# Plan — mejora estética de Earth Jukebox

Rama: `mejora-estetica` (sale de `main` en `5b24823`). Todo el trabajo va en esta rama, en varios commits por tema, y entra a `main` con un solo PR.

Fuentes: las notas a mano del equipo, la captura anotada del jukebox y el boceto del iPad (15 de noviembre de 2026).

## 1. Paleta 60-30-10

Se usa la paleta que ya tenemos en `web/src/index.css` (`@theme`); no se agregan colores nuevos, solo se reparten con la regla 60-30-10.

| Peso | Uso | Tokens existentes |
|---|---|---|
| 60 % | Fondo de la app y de la landing, paneles | `--color-landing-deep` `#05070d`, `--color-landing-line` `#16202f` |
| 30 % | Texto, arcos, reglas, bordes, iconos inactivos | `--color-landing-ink` `#e8edf5`, `--color-landing-mist` `#9aa8be`, `--color-landing-label` `#8fa0b8` |
| 10 % | Botón de llamada a la acción, estado activo, cabezal de la línea de tiempo | `--color-landing-accent` `#5ee9b5` |

Color de contraste por capa (lo usa el arco cuando la capa está activa), también de los tokens actuales:

| Capa | Token |
|---|---|
| Earth (sin capa) | `--color-landing-ink` `#e8edf5` |
| Forest height | `--color-forest` `#6fcf6b` |
| Wildfire smoke | `--color-smoke` `#f08a3c` |
| Atmospheric CO2 | `--color-co2` `#7fb4ff` |
| Lightning | `#ffd166` (el amarillo del anillo de foco); se registra como `--color-lightning` |

El jukebox pasa de los grises `slate` y el verde `emerald` de Tailwind a estos tokens, para que la app y la landing se vean iguales.

## 2. Interfaz del jukebox (captura + boceto)

Disposición: el planeta en el centro, enmarcado por dos arcos concéntricos (izquierdo y derecho) dibujados en SVG por encima del canvas, sin capturar el puntero salvo en sus controles.

### 2.1 Arco izquierdo — los 5 comandos de capa
- Cinco botones circulares con icono colocados sobre el arco: Earth, Forest, Smoke, CO2, Lightning. Sustituyen al `<select>` de capa.
- El tramo del arco y el botón activo toman el color de contraste de la capa elegida.
- Se conserva `data-testid="planet-hud-layer-select"` (ahora como `radiogroup`) para las pruebas y el recorrido guiado; flechas del teclado para cambiar de capa.
- Estado de carga de la capa: anillo animado en el botón en lugar del texto “Loading the layer data…”.

### 2.2 Control lateral izquierdo
Columna de botones redondos junto al arco (boceto):
- **Amazon / Back to Earth** en un solo botón que cambia según el modo.
- **Auto-rotate** como icono de giro (sustituye a la casilla).
- **Sonido**: Start sound / Mute como icono de altavoz.
- El título “Earth Jukebox” y el botón `?` quedan arriba a la izquierda, más pequeños.

### 2.3 Lado derecho
- **Arriba a la derecha**: el contador de fps se mantiene tal cual.
- **Brújula** (N, S, E, W) que gira con el planeta, debajo de los fps.
- **Etiquetas de la capa elegida**: latitud, longitud y valor de la capa en el punto (lo que hoy está en el panel “Hover/Selected”), en una caja a la derecha.
- **Espectrograma curvo** que sigue el arco derecho: un `AnalyserNode` del motor de sonido dibujado en un canvas a lo largo del arco, coloreado con el color de la capa. Requiere exponer `getFrequencyData()` en `audio/engine.ts`.

### 2.4 Barra de tiempo retráctil y lateral
- La línea de tiempo pasa a ser una regla vertical sobre el arco derecho (la escala con marcas de la captura), plegable con un botón; plegada solo muestra la fecha.
- Se mantienen el arrastre, el clic y las teclas (flechas, Re Pág/Av Pág, Inicio/Fin) y todos los `data-testid` de `TimelineTrack`.
- Capa fija (forest): la regla atenuada con su periodo, como hoy.

### 2.5 Abajo a la izquierda
- La caja “Hover” se mantiene en esa esquina, con la nueva paleta.

### 2.6 Pantallas estrechas
- Por debajo de `sm` los arcos se ocultan y los controles vuelven a una barra inferior; la línea de tiempo queda horizontal.

## 3. Sonido e imágenes

- **Explicación de los sonidos**: leyenda corta por capa (qué suena y qué significa más agudo, más fuerte o más denso), visible junto a los comandos de capa y en el recorrido.
- **Mejorar los efectos sintetizados**: revisar timbres y envolventes de bosque, humo, CO2 y rayos en `audio/engine.ts` (reverb ligera, filtros más suaves), sin romper las pruebas del motor.
- **Línea y punto de referencia** (marca en el mapa): el punto escuchado se ve como una marca clara sobre el mapa y el planeta, con una línea guía que lo une al borde (latitud/longitud), en el color de la capa.
- **Popups de escena (“el cuadro entra en las imágenes”)**: la tarjeta de texto se integra en la imagen y se quita el fondo oscuro que la rodea.
- **Imagen de los polos deshabilitada**: no dibujar la capa en las latitudes altas donde la proyección se deforma (máscara en el shader de `EarthMesh.tsx`).
- **Auto levels**: estirar los niveles de la imagen base y de las capas para mejorar el contraste (en `tools/` al preparar los datos o en el shader).

## 4. Landing

- Composición por tercios en la portada, con una espiral áurea como referencia visual para colocar el planeta y el texto.
- El título deja de competir con el botón: título más pequeño y ligero, y el botón “Open the jukebox” en verde chillón como único elemento de color fuerte.
- Paleta 60-30-10 en toda la página.
- **Vídeo**: sección nueva en la landing con el vídeo embebido, una frase de agradecimiento y los créditos de los autores (falta el enlace o archivo del vídeo).

## 5. Orden de trabajo y commits

1. Tokens de color y paleta 60-30-10 (`index.css`).
2. Arcos SVG y comandos de capa sobre el arco izquierdo.
3. Control lateral (Amazon/Back, auto-rotate, sonido).
4. Lado derecho: brújula y etiquetas de la capa.
5. Barra de tiempo lateral y retráctil.
6. Espectrograma curvo (engine + canvas).
7. Pantallas estrechas.
8. Recorrido guiado adaptado a la nueva disposición (`tourSteps.ts`).
9. Popups de escena, polos y auto levels.
10. Explicación y mejora de los sonidos.
11. Landing (tercios, CTA, paleta, vídeo).

Cada paso deja `docker compose` compilando con las pruebas en verde (`tsc`, `vitest`, `vite build`).

Se empieza por la interfaz del jukebox (pasos 1 a 8).

## 6. Decisiones y pendientes

- Línea y punto de referencia: marca en el mapa (decidido).
- Vídeo: sección en la landing (decidido); falta el enlace o archivo del vídeo.
- “Espiral fun H”: se interpreta como espiral de Fibonacci (áurea).
