## Developer Code Scan Results

Escaneo enfocado (profundidad Minimal) del área del intent `hires-data-layers` en la rama `interfaz`, commit `baf3033c31d6f11c666d751fc03d37854f79d793`, con el árbol de trabajo tal como está. No se ejecutó ninguna prueba, compilación ni programa del proyecto.

### Scan Coverage
- **Analyzed deeply**:
  - tools/prep/src/config.rs
  - tools/prep/src/pipeline.rs
  - tools/prep/src/grid.rs
  - tools/prep/src/main.rs
  - tools/prep/src/project.rs
  - tools/prep/Cargo.toml
  - tools/prep/Dockerfile
  - tools/fetch-frames.sh
  - tools/scraping/fetch_geos_variable.py
  - tools/scraping/README.md
  - tools/scraping/flake.nix
  - data/prep-config.json
  - web/public/data/manifest.json
  - web/src/data/types.ts
  - web/src/data/loadManifest.ts
  - web/src/scene/layerTexture.ts
  - web/src/scene/EarthMesh.tsx
  - web/src/scene/EarthScene.tsx
- **Skimmed only**:
  - tools/prep/src/color.rs, tools/prep/src/sample.rs, tools/prep/src/error.rs (búsqueda de ids y constantes)
  - tools/scraping/collect_resources.py (funciones y argumentos), tools/scraping/flake.lock
  - data/SOURCES.md (encabezados; lo genera `fetch-frames.sh`)
  - web/public/data/ (tamaños de archivo y dimensiones de `earth.jpg`; binarios sin abrir)
  - web/src/scene/geo.ts, web/src/scene/FocusTransition.ts, web/src/scene/listeningPoint.tsx (exportaciones)
  - web/src/scene/geo.test.ts, web/src/scene/layerTexture.test.ts, web/src/data/loadManifest.test.ts (nombres de casos)
  - data/raw/ (solo listado de tipos de archivo: 33 png, 2 jpg, 2 mp4 en `4950/`, `5196/`, `5533/`, `earth/`)
- **Left out**:
  - tools/prep/target/ (salida de compilación, ignorada)
  - tools/scraping/resources/ y `__pycache__/` (ignorados en `.gitignore`)
  - contenido de data/raw/ (ignorado por `data/.gitignore`)
  - tools/prep/Cargo.lock (bloqueo de dependencias, sin abrir)
  - instalación de AI-DLC (`.claude/`, `aidlc/`, etc.)

### Packages Found
- jukebox-prep — CLI por lotes — Rust 2021 — cuadros NASA (PNG/JPEG) → cuadrículas `.bin`, texturas `.png`, `earth.jpg` y `manifest.json`
- tools/fetch-frames.sh — script — Bash — descarga cuadros/videos SVS, extrae fotogramas con `ffmpeg` en el anfitrión y reescribe `data/SOURCES.md`
- tools/scraping/ — scripts de exploración — Python 3 (entorno Nix) — descarga GEOS-FP NetCDF y metadatos SVS; no forma parte de la POC según su README
- web/src/data/ — contrato y cargador — TypeScript
- web/src/scene/ — escena 3D — TypeScript + React Three Fiber + shaders GLSL

### Build System
- **Type**: Cargo (prep, dentro de Docker `rust:1-slim-bookworm`); Vite/npm (web, dentro de Docker); Nix flake (scraping, fuera de Docker)
- **Config Files**: tools/prep/Cargo.toml, tools/prep/Dockerfile, tools/scraping/flake.nix, tools/scraping/flake.lock
- **Build Dependencies**: jukebox-prep → image 0.25, serde 1, serde_json 1; scraping → python3, requests, pandas, xarray, netcdf4, netcdf, cdo; web/src/scene → three, @react-three/fiber

### APIs Discovered
- CLI — `tools/prep/src/main.rs` — `--sample [--out]` y `--config FILE [--raw DIR] [--out DIR]`
- Formato de configuración — `tools/prep/src/config.rs` — `PrepConfig` (bbox, grid, earth, layers[], value method, instants[].views[], projection)
- Contrato de datos — `config.rs` (`Manifest`, `LayerOut`, `GridOut`) ↔ `web/src/data/types.ts` — manifiesto + `.bin`
- CLI Python — `fetch_geos_variable.py --date --group --variable --out`; `collect_resources.py --svs-query --geos-start --geos-ext --max-files --max-gb --dry-run`
- Funciones de escena — `layerTextureFor`, `gridToRgba`, `rampFor`, `LAYER_RAMPS`, `EarthMesh`, `EarthScene`

### Frameworks & Libraries
- image — 0.25 — decodificar y redimensionar PNG/JPEG/TIFF/EXR (sin NetCDF, sin video)
- serde / serde_json — 1 — configuración y manifiesto
- xarray + netcdf4 — nixpkgs unstable — leer/escribir NetCDF en los scripts Python
- three — 0.177.0 — `DataTexture`, `TextureLoader`, `ShaderMaterial`
- @react-three/fiber — 9.8.2 — `Canvas`, `useFrame`

### Test Coverage
- **Test Directories**: `#[cfg(test)]` en `grid.rs`, `project.rs`, `color.rs`; `web/src/data/*.test.ts`, `web/src/scene/*.test.ts`
- **Test Frameworks**: cargo test, Vitest
- **Coverage Config**: absent

### Code Quality Indicators
- **Linting**: ninguno en el área (sin clippy, ruff ni ESLint configurados)
- **CI/CD**: ninguno
- **Documentation**: comentarios de módulo claros en Rust y TS; `tools/scraping/README.md` documenta uso y límites; `data/SOURCES.md` generado

### Technical Debt Signals
- Límite `MAX_SIDE = 1024` celdas por lado — `tools/prep/src/config.rs:78` — impide la cuadrícula global 1440×720
- `LAYER_IDS` cerrado y duplicado — `tools/prep/src/config.rs:10`, `web/src/data/types.ts:4`; `co2` también en `tools/prep/src/sample.rs:87`, `web/src/scene/layerTexture.ts:26`, `web/src/audio/mapping.ts:88`, `web/src/index.css:9`
- `earth.jpg` siempre redimensionada a 2048×1024 fija — `tools/prep/src/pipeline.rs:21` y `:383`
- Prep solo lee imágenes raster (`image::open`) — `pipeline.rs:66`; sin lector NetCDF ni de video
- Supermuestreo fijo 4×4 — `pipeline.rs:18` — a 1440×720 cada instante global rasteriza 5760×2880 puntos por vista
- Texturas PNG de prep escritas y validadas en el manifiesto pero no usadas por la escena (la escena dibuja desde las cuadrículas) — `loadManifest.ts:60`, `layerTexture.ts:89`
- Scripts de scraping fuera de Docker (Nix) y apuntan a GEOS-FP `das/`, no a GEOS-CF — `fetch_geos_variable.py:11`, `flake.nix`

## Handoff Summary
- **Intent-relevant finding**: El camino de datos actual es imagen → valor por color: `jukebox-prep` solo abre imágenes con el crate `image` (`pipeline.rs:66-71`), proyecta cada celda con `equirect` u `orthographic` (`project.rs:12-41`) y convierte color en valor con `colorbar | brightness | warmth` (`config.rs:150-182`). No lee NetCDF ni video: los fotogramas los extrae `ffmpeg` en el anfitrión (`fetch-frames.sh:48-75`). Los tamaños de cuadrícula vienen de `grid.global`/`grid.region` en `data/prep-config.json:3` (hoy 144×72 y 96×72) y se validan contra mínimos 72×36 / 32×32 (`grid.rs:6-7`) y un máximo de 1024 por lado (`config.rs:78`), así que 1440×720 hoy se rechaza. `earth.jpg` sale siempre a 2048×1024 (`pipeline.rs:21,383`) y la escena la carga sin límite de tamaño con `TextureLoader` (`EarthScene.tsx:75-110`), la muestrea con `vUv` en un único `uBase` (`EarthMesh.tsx:102`) y en modo lite la reduce a la mitad con un canvas. No existe hoy ningún lugar para una segunda imagen base (recorte de la Amazonía).
- **Risks / follow-up**:
  - Reemplazar `co2` por una capa de rayos exige cambiar `LAYER_IDS` en `config.rs:10` y `types.ts:4` a la vez (el cargador rechaza ids desconocidos, `loadManifest.ts:70`), además de `sample.rs`, el color de `layerTexture.ts:26`, `--color-co2` en `index.css:9` y la voz `co2ToBreath` en `mapping.ts:88`. La escena en sí no depende de `co2`: `rampFor` usa una rampa neutra para ids nuevos.
  - La escena no asume tamaños de cuadrícula: crea `DataTexture` del tamaño que diga el manifiesto (`layerTexture.ts:66-76`, filtro lineal, sin mipmaps) y solo dibuja el primer instante (`FIRST_INSTANT`). Un 1440×720 global son 1 036 800 bytes por instante; con varios instantes crece en múltiplos (el cargador baja todas las cuadrículas al iniciar, `loadManifest.ts:189-195`).
  - GEOS-CF v2 PM2.5 da 1440×721 con filas en los polos (centradas en la latitud), mientras que prep produce celdas centradas con 720 filas norte→sur: hace falta un remuestreo explícito (o un nuevo método de entrada) y decidir quién convierte NetCDF → imagen o → cuadrícula.
  - `fetch_geos_variable.py` descarga GEOS-FP (`portal.nccs.nasa.gov/datashare/gmao/geos-fp/das/`), produce `<VAR>_<fecha>.nc4` (time, lat, lon) y un CSV de media global ponderada por cos(lat) en `tools/scraping/resources/` (ignorado). No apunta a GEOS-CF ni produce cuadrículas para prep, y corre con Nix, no con Docker (la regla del proyecto pide Docker para todo).
  - El video equirectangular de SVS 5011 y los cuadros 4K de SVS 4950 entrarían por `fetch-frames.sh` (anfitrión con `curl` y `ffmpeg`); con proyección `equirect` prep ya los puede leer si se dan como PNG/JPEG.
  - A 1440×720 con supermuestreo 4×4 y 14 vistas ortográficas (bosque actual) el tiempo de prep crece mucho; con fuentes equirectangulares de una sola vista es lineal en píxeles.
  - `data/SOURCES.md` lo reescribe entero `fetch-frames.sh`: los textos sobre fuentes nuevas deben ir en el script, no a mano.
