# Plan de generación de código — Mejora de resolución del planeta y las capas

## Summary

- Builds: descarga y conversión en Docker de Natural Earth 10m, PM2.5 de GEOS-CF (24 horas), rayos de SVS 5011 y bosque en 4K de SVS 4950; cuadrículas globales de 1440 × 720 y regionales por capa; imagen base de 8192 o 4096 según la tarjeta gráfica y recorte propio de la Amazonía en el planeta y el mapa; capa `lightning` en lugar de `co2`
- Touches: rama `interfaz`; nuevo `tools/fetch/` (imagen Docker con curl, ffmpeg y Python); `tools/fetch-frames.sh`; `tools/prep/src/` (`config.rs`, `pipeline.rs`, `sample.rs`); `data/prep-config.json`; `docker-compose.yml`; `web/src/data/types.ts`; `web/src/scene/` (`geo.ts`, nuevo `baseImage.ts`, `EarthScene.tsx`, `EarthMesh.tsx`, `layerTexture.ts`); los datos de `web/public/data/`
- Tests: 14 pruebas unitarias nuevas: 4 en Python con pytest (conversión de GEOS-CF), 3 en Rust (tope de tamaño, cuadrícula por capa, recorte de la imagen base) y 7 en Vitest (elección de imagen base, recorte en el sombreador, lista de capas, muestreo de rayos, línea de tiempo con 24 instantes)

## Alcance y origen

El plan `poc` no divide el trabajo en unidades ni tiene historias de usuario: cada paso se liga a los requisitos de `requirements.md` (`FR…`, `NFR…`). Orden de pruebas: test-after. Base de código: `aidlc/spaces/default/codekb/Nasa-Challenge/`.

Archivos que ya existían y que este trabajo cambia porque no se puede construir sin ellos:
- `tools/fetch-frames.sh`: es el único que escribe `data/SOURCES.md` (NFR6) y hoy necesita curl y ffmpeg instalados en el equipo, lo que choca con NFR1. Pasa a correr dentro del contenedor nuevo.
- `docker-compose.yml`: suma los servicios `fetch` y `fetch-test`, y `prep` pasa a compilar en modo `--release`, porque 24 instantes de 1440 × 720 tardan demasiado en modo de depuración.
- `data/prep-config.json`: las fuentes nuevas.

Los archivos y el código de CO2 se quedan en el repositorio sin usar (FR7.2): los `.bin` de `co2` en `web/public/data/`, `co2ToBreath` y `--color-co2` no se tocan, y `earth.jpg` tampoco se borra.

## Decisiones de diseño

- **Formatos que prep no lee.** Un contenedor nuevo, `tools/fetch/` (Debian con curl, ffmpeg, unzip y Python con netCDF4, numpy y Pillow, con versiones fijas), los convierte en imágenes que prep sí lee:
  - el NetCDF de GEOS-CF pasa a PNG en gris de 1440 × 720;
  - los rayos salen del video como un cuadro PNG con ffmpeg.

  Prep sigue leyendo solo imágenes y no gana dependencias de C.
- **Escala del humo (FR4.3).** El PM2.5 va de forma lineal de 0 µg/m³ (gris 0) a 150 µg/m³ (gris 255). Lo que pasa de 150 queda en 255, y los valores de relleno o ausentes quedan en 0. La escala se escribe en la descripción de la capa y en `data/SOURCES.md`. Prep lee ese gris con el método `brightness` (`low` 0, `high` 1).
- **Cuadrícula por capa (FR3).** `LayerConfig` acepta un `grid` opcional con `global` y `region`, que manda sobre `grid` general. El archivo de datos ya lleva un `GridInfo` por capa, así que su formato no cambia.
- **Imagen base (FR1).** `earth` en la configuración pasa a tener:
  - `file`: el TIFF de Natural Earth;
  - `sizes`: [[8192, 4096], [4096, 2048]];
  - `region_file`.

  Prep escribe `earth-8k.jpg`, `earth-4k.jpg` y `earth-amazon.jpg` (el recorte de `bbox` a resolución nativa) con calidad JPEG 85. Abre el TIFF sin el tope de memoria por defecto del crate `image`, porque el original de 21 600 × 10 800 ocupa unos 700 MB.
- **Qué imagen usa la app (FR1.2).** La escena lee `gl.capabilities.maxTextureSize`:
  - con 8192 o más y sin `?lite=1`, pide `earth-8k.jpg`;
  - si no, o si no puede leer ese valor, pide `earth-4k.jpg`.

  `?lite=1` deja de reducir la imagen a la mitad dentro del navegador.
- **Recorte de la Amazonía (FR1.3).** El sombreador recibe `earth-amazon.jpg` y el rectángulo `bbox`. Dentro del rectángulo toma el color del recorte, en el planeta y en el mapa; fuera, el de la imagen global. Si el recorte no carga, usa la global y avisa en la consola.
- **Rayos (FR5).** Se toma el último cuadro del video, que debe mostrar todo el periodo acumulado.
  - Si al revisarlo se ve que el video reinicia cada año, se toma el último cuadro de cada año y se combinan con el máximo por píxel en el script de descarga.
  - El método de color (`brightness`, o `colorbar` si el video trae una barra de colores) se elige al ver el cuadro y queda anotado en `code-summary.md`.
- **Bosque (FR6).** Se usan los mismos 14 instantes de giro de hoy, con su cuadro en 4K: número de cuadro = segundo × 60. Los parámetros ortográficos se duplican (`cx` 1920, `cy` 1080, `radius` 1040) y se mantiene `min_weight`, que ya favorece las vistas de frente para la región (FR6.2).

## Pasos

- [x] **Step 1 — Corredores de pruebas.** Confirmar que corren los comandos acotados de `unit-test-instructions.md` en `web-test` y `prep-test`. Crear el corredor de Python: `tools/fetch/Dockerfile`, `tools/fetch/requirements.txt` con versiones fijas, y los servicios `fetch` (perfil `data`) y `fetch-test` (perfil `test`) en `docker-compose.yml`. (NFR1, NFR5)
- [x] **Step 2 — Conversión de GEOS-CF.** `tools/fetch/geoscf_to_png.py`:
  - lee `PM25_RH35_GCC`, o la variable PM2.5 que traiga el archivo, nombrada en una constante;
  - voltea las latitudes para que el norte quede primero;
  - pasa las 721 filas con los polos en los extremos a 720 filas centradas, promediando filas vecinas;
  - corre las columnas medio cuadro para que la primera celda empiece en −180;
  - aplica la escala fija de 0 a 150 µg/m³, con valores de relleno o ausentes en 0;
  - escribe un PNG en gris de 1440 × 720.

  Si falta la variable o el tamaño no es 1440 × 721, falla con un mensaje claro. (FR4.2, FR4.3)
- [x] **Step 3 — Pruebas de la conversión.** `tools/fetch/tests/test_geoscf_to_png.py`:
  - una entrada sintética de 721 filas da 720, con la fila del norte primero;
  - la escala da 0 en 0 µg/m³, 255 en 150 y 255 por encima de 150;
  - los valores de relleno o ausentes dan 0;
  - un tamaño equivocado falla con mensaje.

  (FR4.2, FR4.3)
- [x] **Step 4 — Tope de tamaño en prep.** En `tools/prep/src/config.rs`, `MAX_SIDE` pasa de 1024 a 2048. (FR2.1)
- [x] **Step 5 — Cuadrícula por capa.** `LayerConfig.grid` opcional (`global`, `region`), validado con los mismos mínimos y tope. `pipeline.rs` usa el de la capa si existe y el general si no. (FR3.1, FR3.2)
- [x] **Step 6 — Imagen base en dos tamaños y recorte.** En `config.rs`, `EarthConfig` suma `sizes` y `region_file`. En `pipeline.rs`:
  - la función pura `crop_rect(bbox, width, height)` da el rectángulo en píxeles;
  - `prepare_earth` abre la imagen sin tope de memoria, escribe cada tamaño y el recorte, y deja de escribir `earth.jpg`.

  (FR1.1, FR1.3)
- [x] **Step 7 — Lista de capas en prep.** `LAYER_IDS` en `config.rs` suma `lightning` y conserva `co2`. `sample.rs` suma su caso para `lightning`. (FR7.2)
- [x] **Step 8 — Pruebas de prep.** En los módulos de prueba de `config.rs` y `pipeline.rs`:
  - la configuración acepta 1440 × 720 y rechaza 2049;
  - una capa con `grid.region` de 360 × 280 valida y se usa en lugar del general;
  - `crop_rect` con 21 600 × 10 800 da x 6000, y 4920, ancho 2160 y alto 1680.

  Correr `prep-test`. (FR2.1, FR3, FR1.3)
- [x] **Step 9 — Script de descarga en Docker.** `tools/fetch-frames.sh` corre en el contenedor `fetch` y descarga:
  - **Natural Earth I 10m**: el zip y su TIFF descomprimido, en `data/raw/naturalearth/`;
  - **GEOS-CF**: los 24 archivos horarios `aqc_tavg_1hr_glo_L1440x721_slv` del 1 de septiembre de 2026, que convierte con `geoscf_to_png.py` en `data/raw/geoscf/pm25_HHMM.png`;
  - **Rayos de SVS 5011**: el último cuadro del video, sacado a distancia con ffmpeg, en `data/raw/5011/`;
  - **Bosque de SVS 4950**: los 14 cuadros en 4K de `GEDI_global` que corresponden a los instantes de hoy, en `data/raw/4950/4k/`.

  Los nombres exactos se leen del listado de cada carpeta pública antes de escribirlos en el script. Deja de bajar los cuadros de SVS 5533 y SVS 5196; los archivos que ya están en `data/raw/` no se borran. Reescribe `data/SOURCES.md` con las cuatro fuentes nuevas, su enlace, su licencia y la escala del humo, y dice que el CO2 queda sin usar. Ninguna descarga pide inicio de sesión. (NFR1, NFR6, FR4, FR5, FR6, FR1)
- [x] **Step 10 — Descargar.** Correr `docker compose build fetch` y `docker compose run --rm fetch`. Revisar a ojo el cuadro de rayos y uno del bosque en 4K, y decidir el método de color de los rayos y si hay que combinar cuadros por año, según las decisiones de diseño. (FR5.1, FR6)
- [x] **Step 11 — Configuración de datos.** En `data/prep-config.json`:
  - `grid` general pasa a global [1440, 720] y región [360, 280];
  - `earth` apunta al TIFF de Natural Earth, con `sizes` y `region_file`;
  - `forest`: los 14 cuadros en 4K con parámetros duplicados, `grid.region` [360, 280];
  - `smoke`: 24 instantes de GEOS-CF con fechas "Sep 1, 2026 HH:30 UTC", `global: true`, `brightness` (`low` 0, `high` 1), `grid.region` [144, 112] y una descripción en inglés con la escala;
  - `lightning`: estática, un instante "2017 - 2023 (accumulated)", global, `grid.region` [360, 280], con su fuente SVS 5011;
  - la capa `co2` sale de la configuración.

  (FR1, FR2, FR3, FR4, FR5, FR7.1)
- [x] **Step 12 — Preparar.** Correr `docker compose run --rm prep`. Comprobar que:
  - `manifest.json` lista exactamente `forest`, `smoke` y `lightning`, con los tamaños de FR2 y FR3 y 24 fechas en `smoke`;
  - existen `earth-8k.jpg`, `earth-4k.jpg` y `earth-amazon.jpg` con sus medidas;
  - los `.bin` de `co2` siguen ahí.

  (FR1.1, FR1.3, FR2, FR3, FR4.1, FR5.1, FR7)
- [x] **Step 13 — Lista de capas en la app.** `LAYER_IDS` en `web/src/data/types.ts` suma `lightning` y conserva `co2`, igual que en prep. `layerTexture.ts` suma una rampa para `lightning` (de azul oscuro a blanco eléctrico). (FR7.2, FR5.2)
- [x] **Step 14 — Elección de imagen base.** Nuevo `web/src/scene/baseImage.ts` con `pickBaseImage(maxTextureSize: number | null, lite: boolean)`, que devuelve `earth-8k.jpg` o `earth-4k.jpg` según FR1.2. (FR1.2)
- [x] **Step 15 — Recorte en el planeta y el mapa.** En `geo.ts`, la función pura `regionUv(lon, lat, bbox)` da la coordenada dentro del recorte, o nula fuera. `EarthMesh.tsx` suma los uniformes `uRegionBase`, `uHasRegionBase` y `uBbox`, y el sombreador repite esa cuenta. `EarthScene.tsx`:
  - elige la imagen con `pickBaseImage` y `gl.capabilities.maxTextureSize`;
  - carga `earth-amazon.jpg` y la pasa a la malla;
  - quita la reducción a la mitad en `?lite=1`;
  - si una imagen no carga, avisa con el mensaje de escena que ya existe.

  (FR1.2, FR1.3)
- [x] **Step 16 — Pruebas de la app.** Pruebas nuevas en Vitest:
  - `baseImage.test.ts`: `?lite=1` da 4k; 8192 sin lite da 8k; 4096 o nulo dan 4k (FR1.2).
  - En `geo.test.ts`: `regionUv` da (0, 0) y (1, 1) en esquinas opuestas del rectángulo y nulo fuera (FR1.3).
  - En la prueba del cargador: un archivo de datos con `lightning` se acepta (FR7.2).
  - En `interpolate.test.ts`: con una cuadrícula sintética de rayos, `sampleLayerAt` da más de 0 en una celda con rayos y 0 en una sin rayos, dentro y fuera de la Amazonía (FR5.2).
  - En `timeline.test.ts`: con 24 fechas, la posición 1 da la fecha 24 y `framePosition` da 23, mientras una capa estática sigue dando su única fecha (FR4.1).

  Correr el comando acotado, todo el conjunto y la compilación con `docker build --target build web`. (NFR5)
- [x] **Step 17 — Peso y sin internet.** Sumar el tamaño de las cuadrículas, de `earth-8k.jpg` y de `earth-amazon.jpg`, que debe quedar en 60 MB o menos (NFR4). Comprobar que la app no pide nada fuera de `web/public/data/` (NFR2). Anotar los dos resultados en `code-summary.md`.
- [x] **Step 18 — Documentación y avisos.**
  - Actualizar el encabezado de `docker-compose.yml` con los comandos `fetch` y `fetch-test`.
  - Añadir a `docs/PLANET-CHECKLIST.md` lo que solo se ve en el navegador: nitidez de la imagen de 8192 y del recorte, 30 cuadros por segundo con la de 8192, la app lista en 5 segundos o menos, el bosque alineado con los ríos y los 24 instantes del humo.
  - Dejar en `code-summary.md` el borrador del aviso para Andres (se cancela su encargo de GEOS-FP) y para Fernando (`co2` sale del archivo de datos y entra `lightning`; `co2ToBreath` se queda sin datos).

  No se envía ningún mensaje, no se hace commit ni push. (NFR3, NFR6)

## Lo que este plan no construye

- Cambios en el motor de sonido (`co2ToBreath` y la capa de rayos en el sonido).
- El bosque con GEDI L3: queda en espera de una cuenta de Earthdata.
- Borrar los archivos de CO2.
- Dibujar en el planeta el instante que marca la línea de tiempo: la escena sigue dibujando el primer instante, y la línea de tiempo es del paso 13.

## Riesgos del plan

- **Memoria de Docker Desktop.** Abrir el TIFF de 21 600 × 10 800 necesita unos 1,5 GB. Si el contenedor se queda sin memoria, se sube la memoria de Docker Desktop o se reduce primero el TIFF con ffmpeg en el contenedor `fetch`.
- **Nombres de archivos en los portales.** Los nombres exactos de GEOS-CF, SVS 5011 y SVS 4950 se confirman en el Step 9. Si un archivo no existe, el script falla con la dirección que no encontró.
- **Cuadro de rayos.** Si el último cuadro no acumula el periodo o trae un mapa de fondo que confunde el método de color, se aplica la alternativa de las decisiones de diseño, y si no basta, una máscara de fondo con `masks` en la vista.
- **Lo visual** (nitidez, alineación, 30 cuadros por segundo, 5 segundos de carga) solo se comprueba en el navegador, con `docs/PLANET-CHECKLIST.md`.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "org",
  "ordering": "implement each applicable testable layer, then write and run that layer's tests.",
  "scope": "poc",
  "test_strategy": "minimal",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop`, `classic` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    }
  ],
  "obligations": {
    "strategy": "minimal",
    "strategy_volume": [
      "One verifiable test per requirement at the narrowest effective level.",
      "At least one happy-path unit test per component.",
      "Unit tests are the default; a bugfix/security scope floor may require an integration or E2E regression when that is the narrowest level that reproduces the defect."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:04b9b96625a5fdb1ca6669f4c5c779aaa2bc58912cd9db366657d591f9f98c84",
  "contract_sha256": "sha256:c039c687da4f6501d518118720bb16501c074a1cc249b5a2ccada81243a04a32"
}
```
