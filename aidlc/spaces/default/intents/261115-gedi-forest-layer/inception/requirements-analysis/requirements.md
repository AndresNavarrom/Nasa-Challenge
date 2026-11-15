# Requisitos — Bosque con datos reales de GEDI L3

Insumos:
- `intent-statement.md`: declaración de intención aprobada, con los puntos R-01 a R-03 de su revisión.
- El mapa del código en `aidlc/spaces/default/codekb/Nasa-Challenge/`: `business-overview.md`, `architecture.md` y `code-structure.md`.
- Las respuestas de `requirements-analysis-questions.md` (Q1 y Q2).

## Intent analysis

- **Qué se busca**: que la capa de bosque muestre mediciones reales de GEDI L3 (altura media del dosel) en lugar del color de los cuadros en 4K del video de SVS 4950 (`intent-statement.md`, Problem Statement).
- **Archivo**: `GEDI03_rh100_mean_2019108_2025190_003_01.tif`, de GEDI L3 Gridded Land Surface Metrics Versión 3. Cubre de abril de 2019 a julio de 2025, pesa unos 617 MB y se baja de `https://data.ornldaac.earthdata.nasa.gov/protected/gedi/GEDI_L3_LandSurface_Metrics_V3/data/`, que pide cuenta de Earthdata. Se comprobó en el catálogo CMR de la NASA (`intent-statement.md`, Q1 de la intención).
- **Sin respaldo y relleno** (punto R-01 de la revisión de la intención): son dos usos distintos de SVS 4950.
  - "Sin respaldo" significa que la capa de bosque no vuelve a salir entera de SVS 4950.
  - SVS 4950 sí se usa como relleno, solo en las celdas donde GEDI no tiene medición (Q2 y Q3 de la intención; Q1 aquí).
- **Tipo de trabajo**: mejora de código existente. Según la revisión del código (`architecture.md`, `code-structure.md`):
  - El contenedor `fetch` no lee GeoTIFF en EASE-Grid 2.0.
  - `prep` solo conoce las proyecciones `equirect` y `orthographic`.
  - Al mezclar vistas en `prep` gana siempre la de más peso, así que el relleno no funciona sin un cambio.

## Functional requirements

### Descarga

- **FR1** — El archivo de GEDI L3 se descarga en el contenedor `fetch` con la cuenta de Earthdata del equipo (`intent-statement.md`, Success Metrics).
  - **FR1.1** — `~/.netrc` se monta en solo lectura y solo en el servicio `fetch`. Pasa si `docker compose run --rm fetch` deja `GEDI03_rh100_mean_2019108_2025190_003_01.tif` en `data/raw/` con el tamaño que publica el catálogo.
  - **FR1.2** — Si falta `~/.netrc`, o si el inicio de sesión falla, la descarga se detiene con un mensaje claro que no muestra el usuario ni la contraseña. Pasa si, al correrla sin `~/.netrc`, el mensaje nombra el archivo que falta y termina con error.
  - **FR1.3** — La contraseña no entra al repositorio ni a ninguna imagen de Docker. Pasa si no aparece en `git grep` ni en el historial de capas de la imagen `earth-jukebox-fetch` (`docker history`).

### Conversión

- **FR2** — El GeoTIFF se convierte a la cuadrícula de la app (`intent-statement.md`, Success Metrics).
  - **FR2.1** — Cada celda de la cuadrícula global de 1440 × 720 (0,25°) y de la regional de la Amazonía de 360 × 280 (0,1°) es el promedio de los píxeles de GEDI con dato que caen dentro de ella. La posición de cada píxel se calcula con la georreferencia del propio archivo (EASE-Grid 2.0, EPSG:6933), no con valores fijos. Pasa si una prueba con un raster sintético en EASE-Grid 2.0, de valores conocidos, da el promedio esperado en las celdas esperadas.
  - **FR2.2** — Los píxeles sin dato (el valor de "sin dato" del archivo) no entran en el promedio. Pasa si una prueba con una celda que mezcla píxeles con dato y sin dato da el promedio de los que tienen dato.
  - **FR2.3** — La altura se convierte en escala lineal de 0 a 50 m; lo que pase de 50 m queda en el tope (Q2). Pasa si una prueba da 0 para 0 m, el valor medio para 25 m y el tope para 50 m y para 60 m.

### Relleno con SVS 4950

- **FR3** — Toda celda sin ninguna medición de GEDI, dentro o fuera de la franja de unos 52°, toma el valor de SVS 4950. Una celda con medición de GEDI usa solo GEDI, sin mezclarlo con SVS 4950 (Q1; Q3 de la intención). Pasa si una prueba con una celda con GEDI y otra sin GEDI da el valor de GEDI en la primera y el de SVS 4950 en la segunda.

### Capa de bosque

- **FR4** — La capa `forest` del archivo de datos sale de GEDI L3 (`intent-statement.md`, Problem Statement y Success Metrics).
  - **FR4.1** — `manifest.json` declara para `forest` una cuadrícula global de 1440 × 720 y una regional de 360 × 280. Pasa si el archivo de datos lo dice.
  - **FR4.2** — La descripción y la fuente de la capa nombran GEDI L3 Versión 3 y el relleno con SVS 4950, y `data/SOURCES.md` las registra (lo escribe `tools/fetch-frames.sh`). Pasa si los dos archivos nombran GEDI L3 Versión 3, su DOI o su página y SVS 4950 como relleno.
  - **FR4.3** — La conversión informa qué parte de las celdas sale de GEDI y qué parte del relleno, en el globo y en la Amazonía. Así se comprueba que los valores salen de GEDI (punto R-02 de la revisión de la intención). Pasa si la salida de la conversión muestra los dos porcentajes y en la Amazonía al menos el 90 % de las celdas sale de GEDI.

## Non-functional requirements

- **NFR1** — Todo corre en Docker, con comandos `docker compose` documentados (regla del proyecto). Pasa si la descarga y la conversión no piden instalar nada en el equipo salvo Docker.
- **NFR2** — La conversión termina con un contenedor de 4 GB de memoria o menos, leyendo el GeoTIFF por partes. Umbral supuesto: ver Assumptions. Pasa si `docker compose run --rm fetch` termina con 4 GB asignados a Docker Desktop.
- **NFR3** — Las pruebas que ya existían siguen en verde y cada función nueva de conversión tiene su prueba (estrategia mínima, plan `poc`). Pasa si `fetch-test`, `prep-test` y `web-test` pasan.
- **NFR4** — La demo sigue funcionando sin internet y el peso de la capa de bosque no cambia (mismos tamaños de cuadrícula). Pasa si `forest_global.bin` pesa 1 036 800 bytes y `forest_region.bin` 100 800 bytes.

## Constraints

- La revisión del planeta en el navegador va primero, y GEDI L3 no frena la decisión de las 11:00 p.m. (`intent-statement.md`, Initial Scope Signal).
- El trabajo debe quedar listo antes del congelamiento de funciones de las 5:00 p.m. del 15 de noviembre de 2026 (punto R-02 de la revisión de la intención; plan del equipo).
- Rama `interfaz`. Antes de unir a `main` se avisa a Andres y Fernando (`intent-statement.md`, Initial Scope Signal).
- Ni el código ni los documentos de este trabajo leen, muestran ni copian el contenido de `~/.netrc`.

## Assumptions

- **4 GB de memoria (NFR2)**: es la memoria que el proyecto ya pide para abrir el TIFF de Natural Earth. Razón: no conviene subir lo que se pide al equipo de la demo.
- **90 % de la Amazonía con dato de GEDI (FR4.3)**: GEDI cubre bien los trópicos, y al promediar a 0,1° se llenan los huecos entre pasadas. Razón: es un mínimo comprobable para decir que la capa sale de GEDI. Si no se alcanza, se informa sin bajar el umbral.
- **Valor de "sin dato"**: se lee de la etiqueta del propio GeoTIFF. Razón: no se pudo abrir el archivo sin la cuenta.

## Out of scope

- Cambios en el motor de sonido para la capa de bosque (Q5 de la intención).
- La biomasa de GEDI L4B (Q5 de la intención).

## Open questions

None.
