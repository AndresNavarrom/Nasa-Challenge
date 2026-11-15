# Requisitos — Mejora de resolución del planeta y las capas

Insumos: `intent-statement.md` (declaración de intención aprobada, con los puntos R-01 a R-03 de su revisión), el mapa del código en `aidlc/spaces/default/codekb/Nasa-Challenge/` (`business-overview.md`, `architecture.md`, `code-structure.md`) y las respuestas de `requirements-analysis-questions.md` (Q1–Q4).

## Intent analysis

- **Qué se busca**: que el planeta y las capas de la Jukebox Terrestre se vean nítidos, con datos reales en lugar de cuadros de videos de globo con luz y sombra (`intent-statement.md`, Problem Statement e Initiative Trigger).
- **Qué cambia en las capas**: el humo pasa a PM2.5 de GEOS-CF, el CO2 deja de mostrarse y entra una capa de rayos, y el bosque se toma de los cuadros en 4K de SVS 4950 (`intent-statement.md`, Problem Statement; Q1).
- **Para quién**: Samuel hace la conversión y el cambio del formato en la rama `interfaz`; Andres y Fernando reciben aviso antes de unir a `main` (`intent-statement.md`, Target Customer e Initial Scope Signal).
- **Tipo de trabajo**: mejora de código existente. La revisión del código encontró tres bloqueos: la preparación de datos rechaza cuadrículas de más de 1024 celdas por lado, siempre reduce la imagen base a 2048 × 1024 y solo lee imágenes, no NetCDF ni video (`architecture.md`, `code-structure.md`).

## Functional requirements

### Imagen base del planeta

- **FR1** — La imagen base es Natural Earth I 10m a color con relieve (`NE1_HR_LC_SR_W_DR`) (`intent-statement.md`, Success Metrics; Q1 de la intención).
  - **FR1.1** — La preparación entrega la imagen base en dos tamaños: 8192 × 4096 y 4096 × 2048 (Q4). Pasa si los dos archivos existen en `web/public/data/` con esas medidas exactas.
  - **FR1.2** — La app usa la de 8192 × 4096 cuando la tarjeta gráfica acepta texturas de 8192 píxeles por lado, y la de 4096 × 2048 cuando no; `?lite=1` usa siempre la de 4096 × 2048 (Q4). Si no se puede leer el tamaño máximo de textura, usa la de 4096 × 2048. Pasa si con `?lite=1` la app pide solo la de 4096, y si sin él, en un navegador que acepta 8192, pide la de 8192.
  - **FR1.3** — El mapa de la Amazonía usa un recorte propio de la imagen base para `region.bbox` (oeste −80, sur −20, este −44, norte 8), a la resolución nativa de Natural Earth 10m: 2160 × 1680 píxeles (`intent-statement.md`, Success Metrics). Pasa si el archivo del recorte existe con esas medidas y el mapa plano lo muestra en lugar del pedazo de la imagen global.

### Cuadrículas

- **FR2** — Las cuadrículas globales de las tres capas visibles miden 1440 × 720 celdas (0,25 grados) (`intent-statement.md`, Success Metrics). Pasa si el archivo de datos (`manifest.json`) declara 1440 × 720 en la cuadrícula global de bosque, humo y rayos.
  - **FR2.1** — La preparación de datos acepta cuadrículas de hasta al menos 1440 celdas por lado (hoy el tope es 1024, `config.rs`). Pasa si una prueba de la configuración acepta 1440 × 720 y sigue rechazando tamaños por encima del nuevo tope.
- **FR3** — Las cuadrículas de la Amazonía quedan así (Q3):
  - **FR3.1** — Bosque y rayos: 360 × 280 celdas (0,1 grados). Pasa si el archivo de datos lo declara para las dos capas.
  - **FR3.2** — Humo: 144 × 112 celdas (0,25 grados, la resolución real de GEOS-CF). Pasa si el archivo de datos lo declara para el humo.

### Capa de humo

- **FR4** — El humo muestra PM2.5 de GEOS-CF v2 (`aqc_tavg_1hr_glo_L1440x721_slv`) del 1 de septiembre de 2026 (`intent-statement.md`, Problem Statement).
  - **FR4.1** — La capa tiene los 24 instantes del día, uno por hora, que avanzan en la línea de tiempo (Q2). Pasa si el archivo de datos declara 24 fechas para el humo y la cuadrícula global pesa 24 × 1440 × 720 bytes, y si la línea de tiempo recorre los 24 instantes del humo mientras bosque y rayos, de un solo instante, siguen visibles.
  - **FR4.2** — Las 721 filas de GEOS-CF (con los polos en las filas extremas) se convierten a las 720 filas centradas del formato de la app (`architecture.md`, formato de cuadrícula). Pasa si una prueba con una entrada sintética de 721 filas da 720 filas, con la fila del norte primero.
  - **FR4.3** — La escala de PM2.5 a byte es fija y queda escrita en la descripción de la capa y en las fuentes. Pasa si el archivo de datos y `data/SOURCES.md` dicen qué valor de PM2.5 corresponde a 0 y a 255.

### Capa de rayos

- **FR5** — Una capa `lightning` muestra los rayos detectados desde la Estación Espacial, a partir del video para esfera de SVS 5011 (`iss_lightning_sos_yearly_07312023_2048p60.mp4`, 4096 × 2048 equirectangular) (`intent-statement.md`, Problem Statement).
  - **FR5.1** — Es un solo mapa estático con todo el periodo 2017–2023 acumulado (`intent-statement.md`, Success Metrics; Q4 de la intención). Pasa si el archivo de datos declara la capa como estática con un solo instante y menciona el periodo 2017–2023.
  - **FR5.2** — La capa se puede elegir en el planeta y en el mapa como cualquier otra, y entrega su valor en cualquier punto con la función de muestreo que ya existe (`sampleLayerAt`), sin cambios en el motor de sonido (Q5 de la intención). Pasa si una prueba de `sampleLayerAt` con la capa de rayos devuelve un valor mayor que 0 en una celda con rayos y 0 en una celda sin rayos, tanto dentro como fuera de la Amazonía.

### Capa de bosque

- **FR6** — El bosque se toma de los cuadros en 4K de SVS 4950 (`frames/3840x2160_16x9_60p/GEDI_global/`, globo en proyección ortográfica) (`intent-statement.md`, Problem Statement; Q6 de la intención).
  - **FR6.1** — La cuadrícula global se arma con varios cuadros tomados en distintas rotaciones del globo, para cubrir todas las longitudes. Pasa si en la cuadrícula global no queda ninguna franja de longitud sin datos entre las latitudes que el video muestra.
  - **FR6.2** — La cuadrícula de la Amazonía sale del cuadro donde la región se ve más de frente. Pasa si el bosque en el mapa coincide con los ríos y bordes de la imagen base, revisado en el navegador.

### CO2 y formato de datos

- **FR7** — El CO2 deja de mostrarse (Q1).
  - **FR7.1** — El archivo de datos ya no lista la capa `co2`; el panel y el planeta muestran bosque, humo y rayos. Pasa si `manifest.json` lista exactamente `forest`, `smoke` y `lightning`.
  - **FR7.2** — Los archivos y el código de CO2 se quedan en el repositorio sin usar, incluido `co2ToBreath` (Q1). La lista de capas permitidas, en sus dos copias (`web/src/data/types.ts` y `tools/prep/src/config.rs`), suma `lightning` y conserva `co2`. Pasa si las dos copias son iguales y el cargador acepta un archivo de datos con `lightning`.

## Non-functional requirements

- **NFR1** — Todo corre en Docker: la descarga, la conversión, las pruebas y la app (`intent-statement.md`, Success Metrics; regla del proyecto). Pasa si la preparación completa se hace con comandos `docker compose` documentados, sin instalar nada en el equipo salvo Docker.
- **NFR2** — La demo funciona sin internet (`business-overview.md`). Pasa si con la red desactivada la app carga todas las capas y las imágenes desde `web/public/data/`.
- **NFR3** — Rendimiento en el portátil de la demo: el planeta sigue a 30 cuadros por segundo o más con la imagen de 8192 × 4096 (el mismo umbral que el NFR1 del paso 12, `261114-globe-transition-ui`), y la app queda lista en 5 segundos o menos después de abrir la página (umbral supuesto, ver Assumptions). Pasa si el contador de cuadros y el monitor del navegador lo confirman con `docs/PLANET-CHECKLIST.md`.
- **NFR4** — Peso de los datos: lo que la app descarga al arrancar (cuadrículas más la imagen base elegida y el recorte) pesa 60 MB o menos (umbral supuesto, ver Assumptions). Pasa si la suma de esos archivos en `web/public/data/` es de 60 MB o menos.
- **NFR5** — Las pruebas existentes siguen en verde y cada función nueva de conversión tiene su prueba (estrategia mínima, plan `poc`). Pasa si `docker compose run --rm web-test` y `docker compose run --rm prep-test` pasan.
- **NFR6** — Las fuentes nuevas (Natural Earth, GEOS-CF, SVS 5011, SVS 4950) quedan registradas con su enlace y licencia en `data/SOURCES.md`, escritas desde el script que lo genera (`code-structure.md`: `fetch-frames.sh` reescribe ese archivo). Pasa si al correr el script `data/SOURCES.md` incluye las cuatro fuentes.

## Constraints

- No se usan credenciales de nadie; ninguna descarga de este trabajo pide inicio de sesión (`intent-statement.md`, Problem Statement).
- La preparación actual solo lee imágenes. El PM2.5 viene en NetCDF y los rayos en video, así que hace falta un paso de conversión previo que corra en Docker (`architecture.md`).
- La escena dibuja cualquier capa con el tamaño que declare el archivo de datos; no hace falta cambiar el dibujo de capas, sí la carga de la imagen base y del recorte (`architecture.md`).
- El trabajo se hace en la rama `interfaz` y no se une a `main` sin avisar antes a Andres y Fernando (`intent-statement.md`, Initial Scope Signal).
- Fecha límite: congelamiento de funciones a las 5:00 p.m. del 15 de noviembre de 2026.

## Comunicación

- Avisar a Andres Navarro que su encargo de carbono negro de GEOS-FP se cancela, porque lo reemplaza el humo de GEOS-CF (`intent-statement.md`, Problem Statement).
- Avisar a Fernando que la capa `co2` deja de estar en el archivo de datos y que entra `lightning`. `co2ToBreath` sigue en el código, pero ya no recibe datos de CO2 (Q1).

## Assumptions

- **Rayos acumulados**: el último cuadro del video de SVS 5011 muestra el periodo completo acumulado. Si no lo muestra, se combinan los cuadros de cada año. Razón: el video avanza año por año sobre el mismo mapa.
- **Bosque fuera de la vista**: las zonas que el video ortográfico nunca muestra de frente, cerca de los polos, quedan en 0 (sin bosque). Razón: el formato de la app no tiene un valor de "sin dato", y cerca de los polos no hay bosque tropical.
- **Umbrales de carga (NFR3 y NFR4)**: 5 segundos para quedar lista y 60 MB de descarga al arrancar. Razón: la demo es local y en vivo frente al jurado; con las capas elegidas se esperan unos 30 MB (25 MB de humo, más las demás capas y las imágenes), así que 60 MB deja margen sin permitir crecimientos sin control.
- **Detección de la tarjeta gráfica**: se lee el tamaño máximo de textura que informa el navegador (WebGL). Razón: es la única forma de saberlo antes de cargar la imagen.

## Out of scope

- Cambios en el motor de sonido para la capa de rayos o para reemplazar `co2ToBreath` (`intent-statement.md`, Initial Scope Signal; Q5 de la intención).
- El bosque con GEDI L3: queda **diferido** hasta que el equipo tenga una cuenta de Earthdata, no descartado (punto R-03 de la revisión de la intención).
- Borrar los archivos y el código de CO2 (Q1).
- La versión en grises de Natural Earth (Q1 de la intención).

## Open questions

None.
