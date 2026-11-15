# Instrucciones de pruebas unitarias — Mejora de resolución

Estrategia mínima (plan `poc`): una prueba por requisito comprobable fuera del navegador, y al menos una del camino feliz por componente con lógica. Todo corre en Docker.

## Corredores y configuración

| Parte | Corredor | Configuración |
|---|---|---|
| Conversión de GEOS-CF (`tools/fetch/`) | pytest, en la imagen nueva `earth-jukebox-fetch` | `tools/fetch/requirements.txt` con versiones fijas; servicio `fetch-test` (perfil `test`) en `docker-compose.yml` |
| Preparación de datos (`tools/prep/`) | `cargo test` | La que ya existe: servicio `prep-test` |
| App (`web/`) | Vitest 3.2.7, entorno `node` | La que ya existe: servicio `web-test` |

## Comandos acotados a este trabajo

Antes de la primera prueba nueva, construir las imágenes:

```bash
docker compose --profile '*' build
```

Conversión de GEOS-CF (FR4.2, FR4.3):

```bash
docker compose run --rm fetch-test pytest -q tools/fetch/tests/test_geoscf_to_png.py
```

Preparación de datos: tope de tamaño, cuadrícula por capa y recorte (FR2.1, FR3, FR1.3):

```bash
docker compose run --rm prep-test cargo test --locked --manifest-path tools/prep/Cargo.toml config:: pipeline::
```

App: imagen base, recorte, lista de capas, muestreo de rayos y línea de tiempo (FR1.2, FR1.3, FR7.2, FR5.2, FR4.1):

```bash
docker compose run --rm web-test npx vitest run src/scene/baseImage.test.ts src/scene/geo.test.ts src/data/loadManifest.test.ts src/lib/interpolate.test.ts src/lib/timeline.test.ts
```

Si la prueba del cargador está en otro archivo, se usa ese archivo exacto y se anota en `code-summary.md`.

## Cobertura esperada

Sin mínimo de cobertura de líneas (plan `poc`). La meta es una prueba por cada requisito comprobable fuera del navegador: FR1.2, FR1.3, FR2.1, FR3, FR4.1, FR4.2, FR4.3, FR5.2 y FR7.2. Las pruebas que ya existían siguen en verde. Lo visual (FR1.1 en pantalla, FR6, NFR3) se revisa en el navegador con `docs/PLANET-CHECKLIST.md`.

## Simulaciones y sustitutos

- Ninguna prueba descarga nada ni lee `data/raw/`.
- Las pruebas de Python arman un arreglo de numpy en memoria y llaman a las funciones puras de `geoscf_to_png.py`; no leen archivos NetCDF.
- Las pruebas de Rust usan configuraciones escritas como texto JSON en la propia prueba.
- Las pruebas de Vitest arman capas y cuadrículas pequeñas con `Uint8Array`. `pickBaseImage` recibe el tamaño máximo de textura como número o nulo, sin WebGL.

## Datos de prueba

- GEOS-CF: un arreglo de 721 × 1440 con valores conocidos por fila; uno con valores de relleno o `NaN`; uno de 720 × 1440 para el caso de error.
- Rayos: una cuadrícula global y una regional pequeñas, con una celda en 200 y el resto en 0.
- Línea de tiempo: una capa con 24 fechas y otra estática con una fecha.
