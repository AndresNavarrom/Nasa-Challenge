# Plan de generación de código — Bosque con datos reales de GEDI L3

## Summary

- Builds: descarga de GEDI L3 V3 (`rh100_mean`) con la cuenta de Earthdata en un servicio Docker aparte; conversión de EASE-Grid 2.0 a una imagen equirectangular de 0,1° con "sin dato"; en prep, una vista principal con su propio método de valor y vistas de relleno (SVS 4950) que solo se usan donde la principal no tiene dato, más el informe de qué parte sale de GEDI
- Touches: `tools/fetch/` (`gedi_l3_to_png.py`, `requirements.txt`, nuevo `fetch-gedi.sh`); `tools/fetch-frames.sh` (texto de fuentes); `docker-compose.yml` (servicio `fetch-gedi`); `tools/prep/src/` (`config.rs`, `pipeline.rs`); `data/prep-config.json`; los datos de `forest` en `web/public/data/`
- Tests: 8 pruebas unitarias nuevas: 4 en Python con pytest (reproyección, "sin dato", escala, georreferencia que falta) y 4 en Rust (vista principal gana, relleno donde falta, configuración de vista con método propio, informe de cobertura)

## Alcance y origen

El plan `poc` no divide el trabajo en unidades ni tiene historias de usuario: cada paso se liga a `requirements.md` (`FR…`, `NFR…`). Orden de pruebas: test-after. Base de código: `aidlc/spaces/default/codekb/Nasa-Challenge/`.

Archivos que ya existían y que este trabajo cambia porque no se puede construir sin ellos:
- `docker-compose.yml`: el servicio nuevo.
- `tools/fetch-frames.sh`: escribe `data/SOURCES.md` (FR4.2).
- `tools/fetch/requirements.txt`: dependencias para leer el GeoTIFF.
- `tools/prep/src/config.rs` y `pipeline.rs`: el relleno (FR3).
- `data/prep-config.json`: la capa `forest`.

La app web no cambia: el formato de la capa (1 byte por celda) y sus tamaños siguen igual (NFR4).

## Decisiones de diseño

- **Servicio aparte para la cuenta (FR1).** `fetch-gedi` usa la misma imagen `earth-jukebox-fetch` y monta `${HOME}/.netrc` en `/root/.netrc` en solo lectura. Usa la sintaxis larga con `create_host_path: false`, para que Docker no cree una carpeta si el archivo falta. Así, `fetch` sigue sin pedir cuenta a nadie del equipo, y solo quien prepara GEDI necesita `~/.netrc`.
  - Si el archivo no existe, Docker se detiene con un error que nombra la ruta.
  - Si el inicio de sesión falla, `fetch-gedi.sh` lo detecta y sale con un mensaje propio: código distinto de 200, o una página HTML en lugar del TIFF.
  - Las cookies van a `/tmp` dentro del contenedor.
  - El script nunca muestra ni copia `~/.netrc` (FR1.2, FR1.3).
- **Tamaño de la descarga (punto R-03 de la revisión de requisitos).** Se compara el tamaño del archivo con el `Content-Length` del servidor; si no coinciden, se borra y falla. Los bytes exactos quedan anotados en `code-summary.md`.
- **Conversión (FR2).** `gedi_l3_to_png.py` lee el GeoTIFF por franjas con `tifffile` e `imagecodecs`. Toma la georreferencia de las etiquetas GeoTIFF (`ModelPixelScale`, `ModelTiepoint`) y el valor de "sin dato" de `GDAL_NODATA`.
  - Con `pyproj` pasa cada columna a longitud y cada fila a latitud. En EPSG:6933 la longitud depende solo de x y la latitud solo de y.
  - Acumula suma y cuenta por celda de una malla equirectangular de 0,1° (3600 × 1800).
  - Escribe un PNG RGBA. El gris es la altura convertida a 0..255 y el alfa es 0 donde no hubo ningún píxel con dato.
- **Escala (FR2.3, punto R-01).** Se guarda `round_half_up(min(max(h, 0), 50) / 50 × 255)`: 0 m da 0, 25 m da 128, 50 m da 255 y 60 m da 255. Prep la lee con el método `brightness`, entre 0 y 1.
- **Por qué una sola imagen de 0,1°.** Prep la reduce a la cuadrícula global de 1440 × 720 y a la regional de 360 × 280 de la Amazonía. Así no hay dos vistas de GEDI que se pisen.
- **Relleno en prep (FR3).** `ViewConfig` suma dos campos:
  - `value`: el método de valor propio de la vista; si no está, se usa el de la capa;
  - `fallback: bool`: si es verdadero, la vista solo se usa donde las vistas principales no dan dato.

  `render` resuelve primero con las vistas principales. Solo en las celdas sin dato resuelve con las de relleno, sin mezclar las dos. Las vistas leen RGBA, y un píxel con alfa 0 cuenta como "sin dato".
- **Informe de cobertura (FR4.3, punto R-02).** Prep imprime, para el globo y para la Amazonía, el porcentaje de celdas con dato que sale de las vistas principales y el que sale del relleno. Las celdas sin ninguna fuente, como el océano, no entran en la cuenta. Si en la Amazonía GEDI queda por debajo del 90 %, el criterio falla: se informa y no se baja el umbral.

## Pasos

- [x] **Step 1 — Corredores de pruebas.** Confirmar que corren los comandos acotados de `unit-test-instructions.md` en `fetch-test` y `prep-test`. Añadir a `tools/fetch/requirements.txt`, con versiones fijas, `tifffile`, `imagecodecs` y `pyproj`. Reconstruir la imagen `fetch`. (NFR1, NFR3)
- [x] **Step 2 — Conversión de GEDI L3.** `tools/fetch/gedi_l3_to_png.py`, con funciones puras para:
  - leer la georreferencia y el valor de "sin dato" de las etiquetas, y fallar con un mensaje claro si faltan;
  - convertir columnas y filas a longitud y latitud con `pyproj`;
  - acumular el promedio por celda de 0,1°, excluyendo "sin dato";
  - convertir a la escala de 0..255.

  Más un `main` que lee el TIFF por franjas, escribe `data/raw/gedi/gedi_l3_rh100_mean_0p1deg.png` (RGBA, 3600 × 1800) e imprime cuántas celdas tienen dato. (FR2.1, FR2.2, FR2.3)
- [x] **Step 3 — Pruebas de la conversión.** `tools/fetch/tests/test_gedi_l3_to_png.py`:
  - un raster sintético en EPSG:6933 con valores conocidos da el promedio esperado en las celdas esperadas;
  - una celda con píxeles con dato y sin dato da el promedio de los que tienen dato, y una celda sin ninguno queda con alfa 0;
  - la escala da 0, 128, 255 y 255 para 0, 25, 50 y 60 m;
  - un TIFF sin etiquetas de georreferencia falla con mensaje.

  (FR2.1, FR2.2, FR2.3)
- [x] **Step 4 — Vistas con método propio y relleno en prep.** En `config.rs`, `ViewConfig` suma `value` (opcional) y `fallback` (por defecto falso), validados. En `pipeline.rs`:
  - las vistas se cargan en RGBA, y alfa 0 es "sin dato";
  - el método de valor se resuelve por vista;
  - `render` resuelve primero las vistas principales y después las de relleno solo donde falta dato;
  - una función pura `coverage_report` cuenta las celdas de cada origen.

  Si una capa no usa `fallback`, se comporta igual que antes. (FR3, FR4.3)
- [x] **Step 5 — Pruebas de prep.**
  - Una celda con dato en la vista principal toma su valor aunque el relleno también tenga.
  - Una celda sin dato en la principal toma el valor del relleno.
  - Una configuración con `value` y `fallback` en una vista valida, y una con un método inválido falla.
  - `coverage_report` da los porcentajes esperados en una cuadrícula pequeña.

  Correr `prep-test`. (FR3, FR4.3)
- [x] **Step 6 — Descarga con la cuenta.** Nuevo `tools/fetch/fetch-gedi.sh`:
  - comprueba que `/root/.netrc` existe y es legible, sin mostrarlo;
  - baja `GEDI03_rh100_mean_2019108_2025190_003_01.tif` con `curl -f -n -L -c /tmp/... -b /tmp/...` a `data/raw/gedi/`;
  - si recibe HTML o un código distinto de 200, falla con un mensaje propio;
  - compara el tamaño con el `Content-Length` del servidor y, si no coincide, borra el archivo y falla;
  - si el archivo ya está, no lo baja de nuevo (salvo con `FORCE=1`);
  - corre `gedi_l3_to_png.py`.

  En `docker-compose.yml`, servicio `fetch-gedi` (perfil `data`) con el montaje de `~/.netrc` descrito en las decisiones. (FR1.1, FR1.2, FR1.3, NFR1)
- [x] **Step 7 — Fuentes.** En el texto de `data/SOURCES.md` que escribe `tools/fetch-frames.sh`:
  - la fila de la capa de bosque nombra GEDI L3 Versión 3, su DOI (10.3334/ORNLDAAC/2525) y su página, la escala de 0 a 50 m y SVS 4950 como relleno donde GEDI no tiene medición;
  - se dice que esa descarga corre con `docker compose run --rm fetch-gedi` y pide cuenta de Earthdata.

  Correr `docker compose run --rm fetch` para reescribir el archivo. (FR4.2)
- [x] **Step 8 — Descargar y convertir.** Correr `docker compose run --rm fetch-gedi`. Anotar los bytes del archivo y del `Content-Length`, el tiempo, la memoria que usó (`docker stats` o el máximo que informe el sistema) y cuántas celdas tienen dato. Si la descarga falla por permisos de la cuenta, detenerse y reportar sin probar otras credenciales. (FR1.1, NFR2)
- [x] **Step 9 — Configuración de la capa.** En `data/prep-config.json`, la capa `forest`:
  - la vista principal es `gedi/gedi_l3_rh100_mean_0p1deg.png`, `equirect` global, con `value` `brightness` (`low` 0, `high` 1);
  - las 14 vistas en 4K de SVS 4950 quedan como `fallback: true`, con su método `colorbar`;
  - `description`, `source` y `instants[].date` (Apr 2019 - Jul 2025) en inglés, con la escala y el relleno;
  - la cuadrícula regional sigue en 360 × 280.

  (FR4.1, FR4.2, FR3)
- [x] **Step 10 — Preparar.** Correr `docker compose run --rm prep`. Comprobar que:
  - `manifest.json` declara `forest` global de 1440 × 720 y regional de 360 × 280;
  - `forest_global.bin` pesa 1 036 800 bytes y `forest_region.bin` 100 800;
  - el informe de cobertura muestra el porcentaje de GEDI y de relleno, con al menos el 90 % de GEDI en la Amazonía.

  (FR4.1, FR4.3, NFR4)
- [x] **Step 11 — Pruebas y compilación.** Correr los comandos acotados, los conjuntos completos (`fetch-test`, `prep-test`, `web-test`) y `docker build --target build web`. Comprobar que `.netrc` no está en `git ls-files` ni `git grep`, y que `docker history earth-jukebox-fetch:dev` no lo menciona. (NFR3, FR1.3)
- [x] **Step 12 — Documentación y aviso.**
  - Encabezado de `docker-compose.yml`: el comando `fetch-gedi` y que pide `~/.netrc`.
  - Añadir a `docs/PLANET-CHECKLIST.md` una línea para revisar en el navegador que el bosque de GEDI coincide con la Amazonía y no deja franjas.
  - Dejar en `code-summary.md` el borrador del aviso a Andres y Fernando.

  No se envía nada, no se hace commit ni push. (FR4.2)

## Lo que este plan no construye

- Cambios en el motor de sonido.
- La biomasa de GEDI L4B.
- Cambios en la app web.

## Riesgos del plan

- **Permisos de la cuenta.** ORNL DAAC puede pedir que se autorice la aplicación en el perfil de Earthdata la primera vez. Si la descarga falla por eso, se avisa a Samuel para que la autorice; no se prueba nada más.
- **Memoria.** El TIFF global de 1 km en float32 ocupa unos 2 GB. Se lee por franjas, pero si el archivo trae una sola franja sin mosaico, `tifffile` puede necesitar cargarlo entero. En ese caso, se lee con `memmap` o por mosaicos.
- **Menos del 90 % de GEDI en la Amazonía.** Se informa como criterio no cumplido, sin bajar el umbral.
- **Lo visual** (que el bosque coincida con los ríos y no deje franjas) solo se comprueba en el navegador.

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
