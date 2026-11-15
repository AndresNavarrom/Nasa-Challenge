# Escaneo de código del desarrollador — Nasa-Challenge (Earth Jukebox)

Escaneo completo (Full rescan) del repositorio en `./`, commit `077c40c3543743539d69533c08ffa1a15b2b0507`, rama `interfaz`, 2026-11-14. Profundidad Minimal. No se ejecutaron pruebas, builds ni programas del proyecto.

## Developer Code Scan Results

### Scan Coverage
- **Analyzed deeply**:
  - `docker-compose.yml`
  - `tools/fetch-frames.sh`
  - `tools/fetch/` (Dockerfile, requirements.txt, geoscf_to_png.py, lightning_composite.py, tests/)
  - `tools/prep/` (Cargo.toml, Dockerfile, .dockerignore, src/main.rs, src/config.rs, src/pipeline.rs, src/project.rs, src/grid.rs, src/color.rs, src/error.rs, src/sample.rs)
  - `data/prep-config.json`
  - `data/SOURCES.md`
  - `web/src/` (App.tsx, main.tsx, data/, lib/, audio/, scene/, ui/, index.css)
  - `web/public/data/manifest.json`
  - `web/` configuración (package.json, Dockerfile, docker-entrypoint.sh, vite.config.ts, vitest.config.ts, tsconfig.json, index.html, .dockerignore)
  - `server/` (Cargo.toml, src/main.rs)
  - `.gitignore`, `.dockerignore`, `data/.gitignore`, `web/.gitignore`, `server/.gitignore`, `tools/prep/.gitignore`
  - `README.md`, `TAREAS.md`, `VISION-MISION.md`
- **Skimmed only**:
  - `tools/scraping/` (README.md, collect_resources.py, fetch_geos_variable.py, flake.nix, flake.lock): herramientas de exploración fuera del POC
  - `docs/PLANET-CHECKLIST.md`: lista de verificación manual
  - Archivos de prueba (`web/src/**/*.test.ts`, `tools/fetch/tests/*.py`, bloques `#[cfg(test)]`): contados y leídos por encima
  - `web/public/data/*.bin|*.png|*.jpg`: datos binarios generados; solo tamaños
  - `web/package-lock.json`, `tools/prep/Cargo.lock`, `server/Cargo.lock`: archivos de bloqueo
- **Left out**:
  - `data/raw/` (datos descargados, ignorados por `data/.gitignore`)
  - `web/node_modules/` (dependencias, ignorado)
  - `web/dist/` (salida de build, ignorado)
  - `tools/prep/target/`, `server/target/` (salida de build de Cargo, ignorados)
  - `tools/scraping/resources/`, `__pycache__/` (cachés y descargas, ignorados)
  - Instalación de AI-DLC: `.claude/`, `.aidlc/`, `.opencode/`, `aidlc/`, `AGENTS.md` (todo el archivo es la sección AI-DLC), `opencode.json`, `.mcp.json`, `aidlc.settings.local.json`, el bloque AI-DLC de `.gitignore`

### Packages Found
- `earth-jukebox-web` — aplicación web (SPA) — TypeScript/React — planeta 3D, mapa de la Amazonía, carga de datos, interpolación y mapeo valor→sonido
- `jukebox-prep` — binario CLI — Rust (edition 2021) — convierte cuadros/imágenes de la NASA en cuadrículas de intensidad (`.bin`), texturas (`.png`), imagen base y `manifest.json`
- `jukebox-server` — binario — Rust — servidor estático local en 127.0.0.1 (solo esqueleto, sale con código 2)
- `tools/fetch` — scripts — Bash + Python 3.12 — descarga de fuentes y conversión de formatos (NetCDF, video, TIFF de 16 bits) a PNG
- `tools/scraping` — scripts — Python — exploración de fuentes NASA (fuera del POC, entorno Nix)

### Build System
- **Type**: Docker Compose (perfiles `test` y `data`) sobre npm (web), Cargo (prep, server) y pip (fetch)
- **Config Files**: `docker-compose.yml`, `web/Dockerfile` (objetivos deps/dev/test/build), `tools/prep/Dockerfile`, `tools/fetch/Dockerfile`, `web/package.json`, `tools/prep/Cargo.toml`, `server/Cargo.toml`, `tools/fetch/requirements.txt`, `tools/scraping/flake.nix`
- **Build Dependencies**: `fetch` escribe `data/raw/` y `data/SOURCES.md` → `prep` lee `data/prep-config.json` + `data/raw/` y escribe `web/public/data/` → `web` sirve `web/public/data/`. No hay dependencias de código entre paquetes; el contrato es el formato de archivos (`manifest.json` + `.bin`).

### APIs Discovered
- CLI — `tools/prep/src/main.rs` — 2 modos (`--sample`, `--config FILE`) con `--raw DIR`, `--out DIR`
- CLI — `tools/fetch/geoscf_to_png.py` (INPUT.nc4 OUTPUT.png), `tools/fetch/lightning_composite.py` (WIDTH HEIGHT OUTPUT.png [MIN_FRAMES], stdin rgb24)
- Contrato de archivos — `web/public/data/manifest.json` + `<id>_global.bin`/`<id>_region.bin` — esquema en `tools/prep/src/config.rs` (Manifest/LayerOut/GridOut) y `web/src/data/types.ts`
- Contrato de entrada — `data/prep-config.json` — esquema en `tools/prep/src/config.rs` (PrepConfig/LayerConfig/ValueConfig/Projection)
- API de módulo TS — `loadJukeboxData`, `parseManifest`, `sampleLayerAt`, `sampleGrid`, `framePosition`, `forestToVoice`/`smokeToTimbre`/`co2ToBreath`/`intensityToGain`, `useListeningPoint`
- HTTP — ninguno implementado (`server/` es esqueleto; Vite dev server en 127.0.0.1:5173)

### Frameworks & Libraries
- react / react-dom — 19.3.1 — interfaz
- three — 0.177.0 — render WebGL
- @react-three/fiber — 9.8.2 — three.js en React
- gsap — 3.15.1 — animación de la transición planeta→mapa
- tailwindcss / @tailwindcss/vite — 4.3.5 — estilos
- vite — 7.3.8; @vitejs/plugin-react — 4.7.0 — dev server y build
- typescript — 5.8.3 — tipado estricto
- vitest — 3.2.7 — pruebas web
- image (Rust) — 0.25 — decodificación PNG/JPEG/TIFF y redimensionado
- serde / serde_json (Rust) — 1 — configuración y manifiesto
- axum 0.8, tokio 1, tower-http 0.6 (Rust) — declaradas para el servidor, sin uso
- netCDF4 1.7.2, numpy 2.1.3, Pillow 11.0.0, pytest 8.3.3 (Python) — conversión de fuentes
- Imágenes base: node:20-bookworm-slim, rust:1-slim-bookworm, python:3.12.7-slim-bookworm (con curl, ffmpeg, unzip)

### Test Coverage
- **Test Directories**: `web/src/**/*.test.ts` (7 archivos, 28 casos), `tools/prep/src/*.rs` bloques `#[cfg(test)]` (10 pruebas), `tools/fetch/tests/` (2 archivos, 7 pruebas)
- **Test Frameworks**: Vitest (entorno node), cargo test, pytest
- **Coverage Config**: ausente

### Code Quality Indicators
- **Linting**: no hay configuración de ESLint, Prettier, rustfmt ni Ruff; solo `tsc --noEmit` con `strict`, `noUnusedLocals`, `noUncheckedIndexedAccess`
- **CI/CD**: no hay pipelines (sin `.github/workflows` ni equivalente); las pruebas se corren a mano con `docker compose run --rm web-test|prep-test|fetch-test`
- **Documentation**: README extenso; comentarios de módulo y de función claros en Rust, TS y Python; mensajes de error pensados para la persona que corre la herramienta

### Technical Debt Signals
- `README.md` desactualizado: dice que `tools/fetch-frames.sh` no está en contenedor (ya corre en `fetch`), que humo y CO2 son solo de la Amazonía, cita SVS 5533/3615 y `earth.jpg` y omite rayos (`lightning`)
- `server/src/main.rs`: esqueleto que sale con código 2; dependencias Axum declaradas sin uso
- `web/src/audio/engine.ts` citado en comentarios y README, no existe
- `tools/scraping/README.md` cita `run-demo.sh`, que no existe
- `co2` sigue aceptado en `LAYER_IDS` (Rust y TS) y quedan `co2_region.*` y `earth.jpg` en `web/public/data/` sin uso
- `tools/prep/src/pipeline.rs` (491 líneas) mezcla render de capas, escritura y base del planeta; `render()` usa el píxel más cercano y repite el render para cuadrícula y textura
- La capa de bosque es "intensidad relativa" leída del color de un globo renderizado con georreferencia manual (error de 1 a 2 grados) — motivo del intent
- Sin linter, sin CI y sin configuración de cobertura

## Handoff Summary
- **Intent-relevant finding**: Hoy el bosque entra así: `tools/fetch-frames.sh:116-141` descarga 14 TIFF 4K de SVS 4950 (sin login, `curl` sin `-n`) y la barra de color, y los pasa a PNG de 8 bits con ffmpeg; `data/prep-config.json:10-44` declara la capa `forest` con `value.method: "colorbar"` (barra 0–50 m, `max_distance` 60), `grid.region [360, 280]` (la global 1440×720 viene del `grid` general) y 14 vistas `orthographic`; `tools/prep/src/pipeline.rs:136-186` (`render`) mezcla las vistas por peso al cuadrado y la vista con mayor peso decide si hay dato. Un único `ValueMethod` por capa (`pipeline.rs:271`, `config.rs:229-260`) y la regla de "mejor vista" (`pipeline.rs:149-173`) impiden hoy combinar GEDI L3 con un relleno de SVS 4950 fuera de ±52°: una vista `equirect` tiene peso 1.0 y siempre gana, así que donde GEDI no tiene dato el punto queda sin dato en vez de tomar SVS. `prep` no lee GeoTIFF en flotante ni EASE-Grid 2.0 (`load_rgb` hace `to_rgb8`, `pipeline.rs:68-73`; solo proyecciones `equirect` y `orthographic`, `project.rs:10-41`). El contenedor `fetch` (`tools/fetch/Dockerfile`) tiene Python 3.12 con numpy, Pillow y netCDF4, sin GDAL/rasterio/tifffile, y corre como root (HOME `/root`). El servicio `fetch` (`docker-compose.yml:99-105`) monta `./tools` en solo lectura y `./data` en escritura; ahí iría `~/.netrc` → `/root/.netrc:ro`. `data/SOURCES.md` se reescribe entero desde el heredoc de `fetch-frames.sh:143-214`, así que el texto de la fuente se cambia en el script. El formato de salida (1440×720 global, 360×280 región, 1 byte por celda) ya es el del bosque actual, así que la web (`web/src/data/types.ts`, `loadManifest.ts`, `layerTexture.ts`) no necesita cambios de formato.
- **Risks / follow-up**:
  - Leer el GeoTIFF de GEDI L3 (EASE-Grid 2.0 global, EPSG:6933, 1 km, float32, unos 34704×14616 píxeles, unos 2 GB descomprimido): Pillow lanza `DecompressionBombError` por encima de unos 179 M píxeles salvo `Image.MAX_IMAGE_PIXELS = None`, y puede no leer bien TIFF en mosaico comprimido en modo `F`; conviene añadir `tifffile` (con `imagecodecs`) o `rasterio` a `requirements.txt` y leer por franjas para no agotar la memoria de Docker Desktop. Tomar la georreferencia de las etiquetas GeoTIFF (ModelPixelScale/ModelTiepoint) y no de valores fijos.
  - Reproyección: por cada celda de 0.25° (global) o 0.1° (región) calcular x, y de EASE-Grid 2.0 (cilíndrica de áreas iguales, paralelo estándar 30°) y promediar los píxeles válidos; ignorar el valor de relleno (nodata) de GEDI. Escala recomendada: metros / 50 recortado a 0..1, para coincidir con la barra 0–50 m de SVS 4950 que rellena fuera de ±52°.
  - `prep` necesita un cambio para el relleno: prioridad entre fuentes (GEDI primero, SVS donde GEDI no tiene dato) o un método de valor por vista; sin eso, mezclar ambas fuentes en una capa pinta mal o deja huecos. Alternativa: que `fetch` produzca una imagen equirectangular ya combinada, pero el relleno de SVS hoy sale del render de `prep`.
  - El bind mount de `~/.netrc` en sintaxis corta crea un directorio `~/.netrc/` en el host si el archivo no existe; usar sintaxis larga con `create_host_path: false` o comprobar el archivo en `fetch-frames.sh` con un mensaje claro. El montaje es de solo lectura: el cookie jar de Earthdata (`curl -n -L -c/-b`) debe ir a `/tmp`. Solo `fetch` debe montar `.netrc`, no `fetch-test`. Nunca imprimir el archivo.
  - Earthdata Login: la ruta exacta y el nombre de archivo de GEDI L3 V3 en ORNL DAAC no se comprobaron en este escaneo (no se usó red); verificar URL, valor de nodata, compresión y que la cuenta tenga acceso antes de codificar.
  - Textos a actualizar: `fetch-frames.sh` (cabecera "No download needs a login", heredoc de SOURCES), `data/prep-config.json` (`description`, `source`, `instants[].date`), y opcionalmente `README.md`.
  - Valor 0 = "sin dato" y 0 m se confunden en la cuadrícula (`grid.rs:quantize` y web `sampleLayerAt` devuelve 0, no `null`); comportamiento actual, no cambia con GEDI.
