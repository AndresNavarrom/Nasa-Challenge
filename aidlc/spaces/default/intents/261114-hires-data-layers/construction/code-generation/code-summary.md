# Resumen de código — Mejora de resolución del planeta y las capas

Construido según `code-generation-plan.md`; los 18 pasos están hechos y marcados. Rama `interfaz`, sin commit ni push.

## Archivos creados

- `tools/fetch/Dockerfile` y `tools/fetch/requirements.txt`: imagen `python:3.12.7-slim-bookworm` con curl, ffmpeg 5.1.9 y unzip, más netCDF4 1.7.2, numpy 2.1.3, Pillow 11.0.0 y pytest 8.3.3.
- `tools/fetch/geoscf_to_png.py`: convierte el NetCDF de GEOS-CF en un PNG gris de 1440 × 720 (FR4.2, FR4.3).
- `tools/fetch/lightning_composite.py`: junta los cuadros del video de rayos en un solo mapa (FR5.1). No estaba en el plan; ver Desvíos.
- `tools/fetch/tests/test_geoscf_to_png.py` (4 pruebas) y `tools/fetch/tests/test_lightning_composite.py` (3 pruebas).
- `web/src/scene/baseImage.ts` y `web/src/scene/baseImage.test.ts` (FR1.2).

## Archivos modificados

- `docker-compose.yml`:
  - servicios `fetch` (perfil `data`) y `fetch-test` (perfil `test`);
  - `prep` compila en `--release`;
  - el encabezado documenta los comandos nuevos.
- `tools/fetch-frames.sh`: corre dentro del contenedor `fetch`. Descarga Natural Earth I 10m, las 24 horas de GEOS-CF, los cuadros de rayos de SVS 5011 y 14 cuadros en 4K de SVS 4950. También reescribe `data/SOURCES.md`.
- `tools/prep/src/config.rs`:
  - `MAX_GRID_SIDE = 2048` (FR2.1);
  - `LayerConfig.grid` opcional (FR3);
  - `EarthConfig.sizes` y `region_file` (FR1);
  - `LAYER_IDS` con `lightning`, conservando `co2` (FR7.2).
- `tools/prep/src/pipeline.rs`:
  - la cuadrícula se toma por capa;
  - `crop_rect`;
  - `prepare_earth` escribe `earth-8k.jpg`, `earth-4k.jpg` y `earth-amazon.jpg`, y abre el TIFF sin tope de memoria.
- `tools/prep/src/sample.rs`: agrega el caso `lightning`.
- `data/prep-config.json`:
  - las fuentes nuevas;
  - cuadrícula global de 1440 × 720 y regional por capa;
  - la capa `co2` sale de la configuración.
- `web/src/data/types.ts`: `LAYER_IDS` con `lightning`.
- `web/src/scene/geo.ts`: `regionUv`.
- `web/src/scene/layerTexture.ts`: rampa de color para `lightning`.
- `web/src/scene/EarthMesh.tsx`:
  - nuevos `uRegionBase` y `uHasRegionBase`;
  - se reutiliza `uBbox`, que ya existía;
  - el recorte se aplica en el planeta y en el mapa.
- `web/src/scene/EarthScene.tsx`:
  - elige la imagen base con `pickBaseImage` y `gl.capabilities.maxTextureSize`;
  - carga el recorte;
  - `?lite=1` ya no reduce la imagen a la mitad.
- Pruebas ampliadas: `web/src/scene/geo.test.ts`, `web/src/data/loadManifest.test.ts`, `web/src/lib/interpolate.test.ts` y `web/src/lib/timeline.test.ts`.
- `docs/PLANET-CHECKLIST.md`: nueva sección con lo que solo se comprueba en el navegador.
- `data/SOURCES.md`: lo reescribe el script.
- Datos en `web/public/data/`:
  - nuevos: `earth-8k.jpg`, `earth-4k.jpg`, `earth-amazon.jpg`, `smoke_global.*` y `lightning_*`;
  - regenerados: `forest_*`, `smoke_region.*` y `manifest.json`;
  - sin tocar: `earth.jpg`, `co2_region.*` y `co2ToBreath`.

## Decisiones clave

- **Humo**:
  - escala lineal fija: 0 µg/m³ da gris 0 y 150 µg/m³ o más da 255; los valores de relleno o ausentes dan 0;
  - variable `PM25_RH35`;
  - cada celda es la media de un bloque de 2 × 2 puntos, para pasar de 721 a 720 filas y correr medio cuadro las columnas;
  - prep lee el PNG con el método `brightness`, entre 0 y 1.
- **Rayos**:
  - 250 cuadros de todo el video, uno cada 0,4 s, unos 10 días entre cada uno;
  - de cada píxel se toma el "amarillo", `min(R,G) − B`, y se promedia;
  - prep lo lee con el método `brightness`, entre 0 y 0,2; el percentil 99,9 queda cerca de 0,2.
- **Bosque**:
  - cuadros 4K `GEDI_global.NNNN.tif`, con número = segundo × 60 + 1;
  - parámetros ortográficos duplicados;
  - la vista de 50,1 s no existe en la serie 4K, que termina en 2999; se usa la 2999 con `center_lon` 147.65;
  - cada TIFF de 16 bits se pasa a PNG de 8 bits con ffmpeg y luego se borra.
- **Imagen base**: JPEG con calidad 85.

## Desvíos del plan

1. **Rayos (FR5.1)**: el video de SVS 5011 no acumula el periodo. Muestra una ventana móvil de 10 días y su último cuadro está vacío; tampoco reinicia cada año. El mapa acumulado se arma con la media de 250 cuadros de todo el periodo 2017–2023, que da una frecuencia relativa de rayos. Para esto se agregó `lightning_composite.py` con sus pruebas. Se usó la media y no el máximo porque el máximo saturaba los trópicos.
2. **GEOS-CF**: la variable es `PM25_RH35`, no `PM25_RH35_GCC`. La ruta real es `…/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_HH30z.R0.nc4`.
3. **Comando acotado de prep**: el de `unit-test-instructions.md` falla con `error: unexpected argument 'pipeline::' found`. Lo que funciona es `docker compose run --rm prep-test cargo test --locked --manifest-path tools/prep/Cargo.toml -- config:: pipeline::`, con `--` antes de los filtros.
4. **Bosque**: la vista 14 se reemplaza por el cuadro 2999 porque la serie 4K no llega al segundo 50,1.
5. **Idioma**: `data/SOURCES.md`, `docs/PLANET-CHECKLIST.md` y los comentarios del código siguen en inglés, como ya estaban.
6. **Commits del equipo durante el trabajo**: entraron tres commits en la rama (829c53a, 117a700 y 9b5d7c0) sobre `EarthMesh.tsx`, `EarthScene.tsx` y `PLANET-CHECKLIST.md`. Los cambios de este trabajo quedaron encima, sin pisarlos.

## Resultados de pruebas

| Corredor | Antes | Acotado | Completo |
|---|---|---|---|
| fetch-test (pytest) | — | 4 pasan | 7 pasan |
| prep-test (cargo) | 5 pasan | 5 pasan (con `--`) | 10 pasan |
| web-test (Vitest) | 21 pasan | 23 pasan (5 archivos) | 28 pasan (7 archivos) |

Además:
- `npm run typecheck` no da errores.
- `docker build --target build web` compila bien.
- `docker compose run --rm fetch` termina bien; `data/raw` pesa 1,4 GB.
- `docker compose run --rm prep` termina en unos 31 s y deja:
  - `manifest.json` con exactamente `forest`, `smoke` y `lightning`;
  - cuadrículas globales de 1440 × 720;
  - cuadrículas regionales de 360 × 280 para el bosque y los rayos, y de 144 × 112 para el humo;
  - 24 fechas en el humo;
  - las imágenes base de 8192 × 4096 y 4096 × 2048, y el recorte de 2160 × 1680.

## Peso y sin internet

- **NFR4**:
  - con `earth-8k.jpg`, la app descarga al arrancar 33,74 MB;
  - con `earth-4k.jpg`, descarga 29,82 MB;
  - las dos cifras quedan por debajo de 60 MB.
- **NFR2**:
  - no hay direcciones externas en `web/src` ni en `web/index.html`;
  - todo se carga desde `./data/`;
  - la prueba con la red desactivada está en `docs/PLANET-CHECKLIST.md`.

## Pruebas escritas y no ejecutadas

Ninguna. Hay cosas que solo se comprueban en el navegador y están en `docs/PLANET-CHECKLIST.md`:
- la nitidez de la imagen base y del recorte (FR1.1, FR1.3);
- 30 cuadros por segundo y la app lista en 5 s (NFR3);
- el bosque alineado con los ríos (FR6);
- los 24 instantes del humo y la capa de rayos;
- la demo sin internet.

## Riesgos a vigilar

- En el bosque global aparecen triángulos de valor bajo cerca de los ±55–60° de latitud. Ya estaban con los cuadros de 1080p. Se corrigen con `masks` si molestan.
- Los colores de los TIFF en 4K son algo más claros que los del video. La cobertura de la Amazonía es del 79 %.
- `prep` en release recompila sus dependencias en cada corrida, unos 15 s.
- Las imágenes nuevas suman unos 8 MB al repositorio.

## Borrador de los avisos (no enviados)

**Para Andres**: "Hola Andres: cancelamos el encargo del carbono negro de GEOS-FP. El humo ahora sale de GEOS-CF v2 (PM2.5 en superficie, 24 horas del 1 de septiembre de 2026, a 0,25°), descargado y convertido en Docker con `docker compose run --rm fetch`. Gracias por lo que alcanzaste a mirar. Si ya tenías algo bajado, no hace falta seguir."

**Para Fernando**: "Hola Fernando: en la rama `interfaz` la capa `co2` sale del archivo de datos (`manifest.json`) y entra `lightning`: rayos vistos desde la ISS, 2017–2023 acumulado, una capa estática de valores 0..1 como las demás. `co2ToBreath` sigue en el código pero ya no recibe datos de CO2, y el id `co2` sigue aceptado por el cargador. Por ahora el motor de sonido no hace nada con `lightning` (está fuera de alcance). Antes de unir a `main` revisamos juntos qué debe sonar con los rayos."
