# Requisitos — Jukebox Terrestre, prueba de concepto (equipo Sagitta)

Insumo: `intent-statement.md` (declaración de intención aprobada), la descripción inicial del equipo y las respuestas de `requirements-analysis-questions.md` (Q1–Q3).

## Intent analysis

- **Qué se busca**: validar en unas 33 horas que una visualización del Earth Information Center (EIC) puede escucharse, no solo verse, y que esa experiencia crea conciencia sobre la Amazonía como pulmón del mundo: cómo funciona, por qué importa y qué la afecta (`intent-statement.md`, Problem Statement).
- **Para quién**: primero el público general y el jurado (`intent-statement.md`, Target Customer), con un mínimo de accesibilidad para personas ciegas o con baja visión (Q3).
- **Tipo de trabajo**: producto nuevo, varios componentes (datos, sonido, interfaz, entrega), complejidad media con un plazo fijo.
- **Qué significa éxito**: demostración local sin internet, envío a tiempo con todos los entregables en inglés, y una historia que el jurado entienda en 30 segundos (`intent-statement.md`, Success Metrics).
- **Criterio verificable de la historia**: al terminar la demostración, una persona que no conocía el proyecto puede decir con sus palabras las tres ideas: el bosque es la base, el humo de los incendios lo afecta, y el CO2 del planeta es el contexto que hace importante cuidarlo. Se comprueba con al menos 2 personas ajenas al equipo antes de grabar el video. Si se recorta la capa CO2, el criterio pasa a las dos primeras ideas. El tema es la Amazonía, no la contaminación en general.

## Functional requirements

### Datos

- **FR1** — El sistema prepara, antes de la demostración, los datos de tres capas a partir de los cuadros publicados por el Scientific Visualization Studio de la NASA.
  - **FR1.1** — Capa "bosque": altura de bosques GEDI (SVS 4950). Pasa si existe su archivo de datos preparado y se carga en la app.
  - **FR1.2** — Capa "humo": calidad del aire y humo de incendios GEOS-CF, julio–agosto 2024 (SVS 5533). Mismo criterio.
  - **FR1.3** — Capa "CO2": CO2 global DYAMOND, enero–marzo 2020 (SVS 5196). Mismo criterio.
  - **FR1.4** — Cada cuadro se convierte en dos cuadrículas de intensidades entre 0 y 1, usando la barra de color de la visualización cuando exista y el brillo del píxel cuando no: una global de baja resolución para el planeta y una detallada para la Amazonía. Los cuadros de video se extraen con ffmpeg. El rectángulo de latitud y longitud de la Amazonía se fija en B0. Pasa si cada capa produce una cuadrícula global de al menos 72 × 36 celdas y una regional de al menos 32 × 32 celdas por instante.
  - **FR1.5** — Entre celdas se interpola en el espacio en las tres capas. Entre instantes muestreados se interpola en el tiempo solo en humo y CO2; el bosque es una capa fija. Pasa si al mover el cursor o avanzar el tiempo no hay saltos audibles entre valores vecinos.
- **FR2** — Los datos preparados se empaquetan con el proyecto como archivos. Pasa si la app arranca y funciona con el cable de red desconectado.

### Sonido

- **FR3** — Cada capa tiene una voz propia generada en tiempo real a partir de sus valores.
  - **FR3.1** — Bosque: la altura fija la nota y la armonía de fondo, dentro de una escala musical, para que suene agradable.
  - **FR3.2** — Humo: la intensidad añade aspereza y oscurece el timbre; más humo, sonido más turbio.
  - **FR3.3** — CO2: la concentración marca un pulso tipo respiración; más CO2, respiración más rápida y pesada.
  - **FR3.4** — La posición horizontal del punto escuchado mueve el sonido entre izquierda y derecha, y la intensidad controla el volumen.
  - Pasa si, con los ojos cerrados, una persona distingue cuál de las tres capas suena y si su valor es alto o bajo en 4 de 5 intentos.
- **FR4** — Las capas activas suenan a la vez sin saturar. Se comprueba a mano en la lista de verificación de la demo: con las tres capas activas durante 1 minuto, el medidor de salida no llega al máximo y ninguna capa activa deja de oírse.

### Interacción

- **FR5** — La pantalla abre con el planeta en 3D, que se puede girar, con las tres capas a nivel global.
  - **FR5.1** — Un panel lateral lista las capas y permite cambiar entre ellas y activarlas o desactivarlas, tanto en el planeta como en la vista de la Amazonía.
  - **FR5.2** — Al enfocar la Amazonía (clic sobre la región o botón del panel), el planeta gira hacia ella y la vista se aplana en una transición animada hasta mostrar el mapa detallado de la Amazonía. Un botón regresa al planeta. Pasa si la transición de ida y la de vuelta terminan en 2 segundos o menos y sin cortes de sonido.
- **FR6** — Al pasar el cursor o hacer clic sobre un punto, en el planeta o en el mapa de la Amazonía, se escucha el sonido de las capas activas en ese punto.
- **FR7** — El tiempo se reproduce como una canción: reproducir, pausar y mover una línea de tiempo común de 0 a 1. El humo y el CO2 avanzan cada uno por su propio periodo, con sus fechas visibles en pantalla; el bosque permanece fijo como base. Pasa si la imagen y el sonido avanzan juntos durante toda la secuencia.
- **FR8** — Un modo "historia" recorre en menos de 60 segundos las tres ideas (bosque, humo, CO2) con un texto corto por paso: empieza en el planeta y termina en la Amazonía. Es la base del video de 30 segundos. El CO2 se presenta como contexto global, no como efecto medido de lo que pasa en la Amazonía, y los textos lo dicen así.

### Accesibilidad mínima (Q3)

- **FR9** — Todo se puede usar solo con teclado.
  - **FR9.1** — Activar capas, reproducir y pausar, y mover el punto escuchado con las flechas.
  - **FR9.2** — Cada capa y cada región tienen una descripción en texto que un lector de pantalla lee al seleccionarlas, incluido si el valor es bajo, medio o alto.
  - Pasa si una persona completa el modo historia sin usar el ratón y con el lector de pantalla del sistema activo.

### Entrega

- **FR10** — El proyecto se entrega con todo lo que exige la guía, en inglés.
  - **FR10.1** — Video de 30 segundos o menos, narrado en inglés, en enlace público sin login.
  - **FR10.2** — Formulario completo: resumen, enlace del demo, enlace del proyecto, detalles (qué hace, cómo funciona, beneficios, qué se espera lograr, herramientas), uso de IA, datos de la NASA y referencias. El enlace del demo es el video público de 30 segundos; el enlace del proyecto es el repositorio público. La app no se publica en internet.
  - **FR10.3** — Repositorio público con instrucciones para ejecutar la demostración local.
  - **FR10.4** — Declaración del uso de IA: en el texto del proyecto y en el repositorio para código y datos; marca de agua si alguna imagen o video es generado.

## Non-functional requirements

- **NFR1** — Sin conexión: la demostración completa funciona sin internet en el portátil de la demo.
- **NFR2** — Latencia de audio: desde el clic o movimiento hasta el cambio de sonido pasan como máximo 100 ms.
- **NFR3** — Fluidez: el planeta, la transición a la Amazonía, el mapa y la línea de tiempo se mueven a 30 cuadros por segundo o más en el portátil de la demo.
- **NFR4** — Arranque: desde abrir la app hasta poder escuchar pasan como máximo 5 segundos; los datos empaquetados no superan 200 MB.
- **NFR5** — Estabilidad: 10 minutos seguidos de uso sin recargar ni perder el sonido.
- **NFR6** — Seguridad: no hay claves ni secretos en el repositorio; la app no pide ni guarda datos personales.
- **NFR7** — Pruebas (estrategia mínima): una prueba automática por cada pieza con lógica propia (conversión de color a valor, interpolación, mapeo de valor a sonido) y una lista manual de verificación de la demo.

## Constraints

- **Plazo**: envío oficial antes del domingo 15 de noviembre a las 11:59 p.m., hora de Medellín; límite interno 11:50 p.m.; objetivo de envío 10:00 p.m.
- **Idioma**: interfaz, video, formulario y repositorio en inglés.
- **Demo oficial**: video de máximo 30 segundos; excederse descalifica.
- **Equipo**: seis personas.
- **Tecnología**: React + Tailwind + GSAP en la interfaz, con three.js / react-three-fiber para el planeta; Web Audio API para el sonido; Rust para preparar los datos y para servir la app de forma local.
- **Datos**: solo material del EIC y del SVS de la NASA; todo lo usado se lista en las referencias.

### Decisiones de arquitectura

| Decisión | Elegido | Alternativa descartada | Por qué |
|---|---|---|---|
| Almacenamiento | Archivos preparados y empaquetados | MongoDB | No hay escrituras ni consultas; una base de datos añade instalación y un punto de falla en la demo, sin beneficio |
| Vista | Planeta en 3D con las capas globales, que se aplana en el mapa de la Amazonía al enfocarla | Solo mapa plano regional | El equipo quiere mostrar las capas a nivel global y luego la región; cuesta más horas de interfaz y añade riesgo de rendimiento, cubierto con un plan B |
| Extracción de datos | Procesamiento clásico: barra de color a valor, más brillo | Modelo de visión artificial | Los cuadros ya codifican el dato en el color; un modelo no aporta precisión y sí riesgo de tiempo |
| Formato de entrada | png, jpg, tif y cuadros de mp4 | .exr | No se encontraron .exr publicados para estas visualizaciones; si aparecen al descargar, se leen con el mismo flujo |
| Papel de Rust | Preparar datos y servidor local de archivos | Servicio con lógica en tiempo real | El sonido se genera en el navegador; el servidor solo entrega archivos |

Implicación de seguridad: la app corre solo en la máquina local, no expone servicios a internet y no maneja datos personales.

## Plan de trabajo en bloques (hora de Colombia)

| Bloque | Horario | Meta | Listo cuando |
|---|---|---|---|
| B0 Arranque | Sáb 3:30–5:30 p.m. | Descargar cuadros de las 3 capas (vista global plana y vista de Sudamérica), fijar el rectángulo de la Amazonía, acordar el formato del archivo de datos, crear el repositorio | Hay un archivo de datos de ejemplo que todos usan |
| B1 Tramo completo mínimo | Sáb 5:30–11:00 p.m. | Una capa (bosque) de punta a punta: dato → interpolación → sonido al pasar el cursor, sobre el planeta en 3D y con la transición a la Amazonía | Se escucha el bosque en el planeta y en el mapa de la Amazonía. **Decisión a las 11:00 p.m.: si el planeta o la transición no corren fluidos, se pasa al plan B de vista** |
| Descanso | Sáb 11:00 p.m.–Dom 7:00 a.m. | Dormir | — |
| B2 Tres capas | Dom 7:00 a.m.–1:00 p.m. | Humo y CO2, línea de tiempo, mezcla, modo historia, teclado y descripciones | Las tres capas suenan y el modo historia corre completo |
| B3 Pulido y congelación | Dom 1:00–5:00 p.m. | Ajuste del sonido, prueba sin internet, prueba con 2 personas ajenas. **5:00 p.m.: no entra nada nuevo** | Lista de verificación de la demo en verde |
| B4 Entregables | Dom 5:00–9:00 p.m. | Grabar y editar el video, completar el formulario, publicar el repositorio, declarar el uso de IA | Enlaces probados en ventana privada |
| B5 Envío | Dom 9:00–10:00 p.m. | "Submit for Judging" | Aparece el mensaje de confirmación. Margen hasta 11:50 p.m. |

Regla de recorte, en este orden si un bloque se atrasa: primero se cae la capa CO2 (queda bosque + humo), luego la línea de tiempo se reduce a 3 instantes fijos, luego el modo historia pasa a ser un guion leído en vivo. El video y el formulario no se recortan.

## Reparto por rol

| Persona | Frente | Entrega |
|---|---|---|
| Alberto Jaimes Pulido | Datos (líder) | Descarga de cuadros, elección de instantes, lectura de las barras de color, región de la Amazonía |
| Andres David Osorno Vasquez | Datos y ciencia | Verificar que los valores tengan sentido, textos científicos de cada capa, lista de datos y referencias para el formulario |
| Samuel Betancur Muñoz | Sonido | Motor de sonido en el navegador: las tres voces, mezcla, paneo, escala musical |
| Fernando Gonzalez Rivero | Rust e integración | Programa que convierte cuadros en cuadrículas e interpola, servidor local, formato del archivo de datos, unir las piezas |
| Andres Navarro Marin | Interfaz | Planeta en 3D, transición a la Amazonía, mapa regional, panel lateral de capas, cursor, línea de tiempo, modo historia, teclado y descripciones |
| Danna Vergara | Producto y entregables | Guion de la historia, video de 30 segundos, formulario en inglés, prueba con personas ajenas, envío |

Para trabajar en paralelo desde B0, el formato del archivo de datos se acuerda primero y el frente de sonido y el de interfaz usan datos de ejemplo hasta que lleguen los reales.

## Riesgos y plan B

| Riesgo | Señal de alarma | Plan B |
|---|---|---|
| No hay .exr, o no se pueden leer | En B0 no aparecen o fallan al abrir | Usar png, jpg, tif y cuadros de mp4; el flujo no depende del formato |
| Las visualizaciones tienen la cámara en movimiento y no se puede ubicar la Amazonía | En B0 no hay una vista estable sobre Sudamérica para una capa | Usar los cuadros fijos o la vista plana de esa visualización; si no hay, tratar la capa como una serie en el tiempo para toda la región, sin detalle por punto |
| El color no se traduce bien a valor | Los valores no siguen la barra de color | Usar el brillo como intensidad relativa y decirlo en la documentación |
| Rendimiento del planeta en 3D o de la transición | Menos de 30 cuadros por segundo al cierre de B1 | Primero: bajar la resolución de las texturas y dibujar las capas como imágenes ya preparadas. Si no basta: planeta fijo sin giro libre y cambio directo al mapa de la Amazonía, sin animación de aplanado |
| No hay una vista global plana de alguna capa para envolver el planeta | En B0 solo hay vistas con la cámara en movimiento | Esa capa se muestra y se escucha solo en el mapa de la Amazonía; en el planeta aparece como una sola voz para toda la región |
| La interfaz es mucho trabajo para una sola persona | Al cierre de B1 falta el planeta o la transición | Fernando Gonzalez Rivero pasa a apoyar la interfaz y la preparación de datos queda en un script |
| Latencia o cortes de audio | Más de 100 ms o chasquidos | Cambiar los parámetros con rampas suaves; usar muestras precargadas para el fondo y dejar la síntesis solo para la voz principal |
| El navegador bloquea el audio hasta un clic | Silencio al abrir | Pantalla de inicio con un botón "Start listening" |
| El sonido resulta ruidoso | En la prueba con personas ajenas no distinguen las capas | Limitar las notas a una escala de cinco notas y bajar el número de voces simultáneas |
| El trabajo en Rust se atrasa | En el cierre de B1 no hay archivo de datos real | Preparar los datos con un script de Python y dejar Rust solo como servidor local |
| Falla el portátil o el navegador en la demo | — | Segundo portátil preparado y una grabación de pantalla de respaldo |
| El video excede 30 segundos o el enlace pide login | Prueba en ventana privada | Recortar a 28 segundos; subirlo como video público no listado |

## Assumptions

- La interfaz va en inglés porque el formulario y los materiales enlazados deben estar en inglés y el video se narra en inglés. Razón: evita doble trabajo de traducción.
- Los valores de cada capa son intensidades relativas tomadas de los cuadros visuales, no mediciones físicas. Razón: el reto pide traducir los cuadros del EIC a sonido; se documenta así para no afirmar más de lo que los datos permiten.
- El portátil de la demo tiene un navegador reciente con salida de audio estéreo. Razón: es la condición normal de una demostración local.
- Las capas son de fechas distintas (2019–2020, 2020 y 2024); la línea de tiempo recorre cada capa en su propio periodo. Razón: son las fechas que publica la NASA.

## Out of scope

Pasa a la lista del MVP:

- Cuentas de usuario o guardar información de quien la usa.
- Publicación en internet para uso público.
- Vista detallada de otras regiones además de la Amazonía.
- Más capas (rayos, aerosoles, corrientes del mar, luces nocturnas, río atmosférico).
- Visión artificial o aprendizaje automático para extraer datos.
- Base de datos y servicio con lógica propia.
- Accesibilidad completa: respuesta táctil, narración hablada, pruebas con personas ciegas o con baja visión.
- Exportar el sonido como archivo y compartir una "canción".
- Interfaz en español y otros idiomas.

## Open questions

- ¿Existe para cada una de las tres capas una vista global plana (para envolver el planeta) y una vista estable sobre Sudamérica? Se responde en B0 al descargar; define si la capa tiene detalle por punto o solo por región.
- ¿Qué portátil se usa en la demo y con qué salida de audio? Lo define el equipo antes de B3.
- ¿Quién narra el video en inglés? Lo define Danna Vergara antes de B4.
