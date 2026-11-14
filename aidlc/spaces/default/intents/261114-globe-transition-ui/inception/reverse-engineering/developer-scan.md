# Escaneo de código del desarrollador — Nasa-Challenge

Escaneo completo (sin store previo) del repositorio en el commit `b90f5e334e155bfdb8b2220b052e94711867a8d2`, profundidad Minimal. Solo lectura: no se ejecutaron pruebas, compilaciones ni programas del proyecto.

## Developer Code Scan Results

### Scan Coverage
- **Analyzed deeply**:
  - `web/src/App.tsx`
  - `web/src/main.tsx`
  - `web/src/index.css`
  - `web/src/data/` (`types.ts`, `loadManifest.ts`, `loadManifest.test.ts`)
  - `web/src/lib/` (`interpolate.ts`, `timeline.ts` y sus pruebas)
  - `web/src/audio/` (`mapping.ts`, `mapping.test.ts`)
  - `web/public/data/manifest.json` (forma completa) y las dimensiones de las texturas de `web/public/data/`
  - `web/package.json`, `web/vite.config.ts`, `web/vitest.config.ts`, `web/tsconfig.json`, `web/index.html`, `web/Dockerfile`, `web/docker-entrypoint.sh`, `web/.dockerignore`, `web/.gitignore`
  - `tools/prep/src/` (`main.rs`, `config.rs`, `pipeline.rs`, `error.rs` leídos completos; `color.rs`, `grid.rs`, `project.rs`, `sample.rs` por firmas, tipos y pruebas)
  - `tools/prep/Cargo.toml`, `tools/prep/Dockerfile`, `tools/prep/.dockerignore`, `tools/prep/.gitignore`
  - `server/Cargo.toml`, `server/src/main.rs`, `server/.gitignore`
  - `docker-compose.yml`, `.dockerignore`
  - `README.md`, `TAREAS.md`, `VISION-MISION.md`
- **Skimmed only**:
  - `tools/fetch-frames.sh` (estructura, herramientas y salidas; no cada URL)
  - `data/prep-config.json` (forma y capa `forest`; las capas `smoke` y `co2` por encabezado)
  - `data/SOURCES.md` (generado por `tools/fetch-frames.sh`)
  - `web/package-lock.json` y los `Cargo.lock` (solo existencia; versiones tomadas de los manifiestos)
  - binarios de `web/public/data/` (`*.bin`, `*.png`, `earth.jpg`: tamaño y dimensiones, sin abrir contenido)
- **Left out**:
  - `web/node_modules/` (carpeta de montaje del volumen de dependencias)
  - `web/dist/`
  - `tools/prep/target/`, `server/target/`
  - `data/raw/` (descargas ignoradas por `data/.gitignore`)
  - Instalación de AI-DLC: `.claude/`, `aidlc/`, las secciones marcadas de `.gitignore` y `.mcp.json` (todo su contenido son servidores MCP que AI-DLC agrega)

### Packages Found
- `earth-jukebox-web` (`web/`) — aplicación web — TypeScript/React — interfaz, carga de datos, interpolación, línea de tiempo y mapeo valor→sonido
- `jukebox-prep` (`tools/prep/`) — binario CLI — Rust — convierte cuadros NASA SVS en cuadrículas de intensidad, texturas y `manifest.json`
- `jukebox-server` (`server/`) — binario — Rust — servidor estático local en 127.0.0.1 (solo esqueleto: `main` sale con código 2)
- `tools/fetch-frames.sh` — script — Bash — descarga los cuadros a `data/raw/` con `curl`/`ffmpeg` y reescribe `data/SOURCES.md`

### Build System
- **Type**: npm + Vite (web), cargo (Rust), Docker Compose como orquestador de ejecución, pruebas y preparación de datos
- **Config Files**: `web/package.json`, `web/vite.config.ts`, `web/vitest.config.ts`, `web/tsconfig.json`, `web/Dockerfile`, `tools/prep/Cargo.toml`, `tools/prep/Dockerfile`, `server/Cargo.toml`, `docker-compose.yml`
- **Build Dependencies**: `tools/fetch-frames.sh` → `data/raw/` → `jukebox-prep` (con `data/prep-config.json`) → `web/public/data/` → `earth-jukebox-web`; `jukebox-server` (paso 11) servirá `web/dist/`. Contrato de datos duplicado en `tools/prep/src/config.rs` (Rust, escribe) y `web/src/data/types.ts` (TS, lee).

### APIs Discovered
- Contrato de archivos estáticos — `web/public/data/manifest.json` + `*.bin` + `*.png` — 1 manifiesto, 4 cuadrículas, 4 texturas, 1 imagen base
- API interna TS — `web/src/data/loadManifest.ts` — 3 exportaciones (`loadJukeboxData`, `parseManifest`, `DataLoadError`)
- API interna TS — `web/src/lib/interpolate.ts` — 7 funciones/constantes (`sampleLayerAt`, `sampleGrid`, `sampleFrame`, `lonLatToUV`, `normalizeLongitude`, `clamp01`, `WORLD_BBOX`)
- API interna TS — `web/src/lib/timeline.ts` — 4 funciones (`clampPosition`, `framePosition`, `dateLabelAt`, `advancePosition`)
- API interna TS — `web/src/audio/mapping.ts` — 7 funciones y constantes asociadas
- CLI — `jukebox-prep` — `--sample | --config FILE [--raw DIR] [--out DIR]`
- HTTP — ninguna todavía (servidor Axum por construir)

### Frameworks & Libraries
- react / react-dom — 19.3.1 — interfaz
- three — 0.177.0 (@types/three 0.177.0) — escena 3D (aún sin usar en el código)
- @react-three/fiber — 9.8.2 — React para three.js (aún sin usar)
- gsap — 3.15.1 — animación de la transición (aún sin usar)
- tailwindcss / @tailwindcss/vite — 4.3.5 — estilos
- vite — 7.3.8; @vitejs/plugin-react — 4.7.0; typescript — 5.8.3; vitest — 3.2.7
- No hay `@react-three/drei` ni librería de controles de cámara
- Rust: image 0.25, serde 1, serde_json 1 (prep); axum 0.8, tokio 1, tower-http 0.6 (server)
- Imágenes base: `node:20-bookworm-slim`, `rust:1-slim-bookworm`

### Test Coverage
- **Test Directories**: pruebas junto al código en `web/src/**/*.test.ts` (4 archivos, 13 casos); módulos `#[cfg(test)]` en `tools/prep/src/color.rs`, `grid.rs`, `project.rs` (5 casos)
- **Test Frameworks**: Vitest (entorno `node`), `cargo test`
- **Coverage Config**: ausente (ni Vitest coverage ni umbral)

### Code Quality Indicators
- **Linting**: no hay ESLint, Prettier, rustfmt.toml ni clippy configurados; la verificación estática es `tsc --noEmit` con `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`
- **CI/CD**: ninguno (sin `.github/workflows` ni otro pipeline)
- **Documentation**: `README.md` completo (en inglés) con ejecución por Docker, formato de datos y límites; `TAREAS.md` y `VISION-MISION.md` en español; comentarios de documentación claros en TS y Rust

### Technical Debt Signals
- Conjunto cerrado de capas duplicado: `LAYER_IDS = ["forest","smoke","co2"]` en `web/src/data/types.ts:4` y `tools/prep/src/config.rs:10`; `parseManifest` rechaza cualquier otro id (`web/src/data/loadManifest.ts:70`)
- Las texturas de capas con tiempo son solo del primer instante (`tools/prep/src/pipeline.rs`, comentario "Textures are drawn from the first instant only")
- `server/src/main.rs` es un esqueleto que sale con código 2
- `web/src/App.tsx` es una carcasa provisional que lista capas
- El título "Global CO2" en `data/prep-config.json` contradice la cobertura solo-Amazonía (señalado en `TAREAS.md:95`)
- `pipeline.rs`, `config.rs`, `sample.rs` y `main.rs` no tienen pruebas unitarias
- Sin linter ni CI: la calidad depende de `tsc` y de ejecutar las pruebas a mano en Docker

## Handoff Summary
- **Intent-relevant finding**: el paso 12 parte de una carcasa (`web/src/App.tsx:15-77`) y de una capa de datos lista: `loadJukeboxData()` entrega `layers` y `bbox` (`web/src/data/loadManifest.ts:175`), y `sampleLayerAt(layer, bbox, lon, lat, framePosition)` (`web/src/lib/interpolate.ts:94`) es el punto de entrada para convertir el lon/lat bajo el cursor en valor 0..1 (o `null`). Las texturas son equirectangulares: `earth.jpg` 2048x1024 y `forest_global.png` 1024x512 cubren -180..180/-90..90 (aptas para el UV estándar de una esfera); las regionales (512x398) cubren `bbox` = oeste -80, sur -20, este -44, norte 8. three 0.177.0, @react-three/fiber 9.8.2 y gsap 3.15.1 ya están declarados pero sin uso, y no hay drei.
- **Risks / follow-up**: (1) una capa global de aerosoles GEOS-FP exige ampliar `LAYER_IDS` en TS y Rust y regenerar el manifiesto; `TAREAS.md:35` prohíbe cambiar el formato de datos sin avisar a los tres, y `web/src/data/` y `data/` no son carpetas de Samuel (`TAREAS.md:56-58`); los scripts de GEOS-FP están en `origin/datos-rust` (`tools/scraping/`), no en este árbol. (2) Humo y CO2 no tienen cuadrícula global (`global: null`): en el planeta no se ven ni suenan fuera de la Amazonía. (3) Las texturas de humo/CO2 son de un solo instante; para sincronizar imagen y sonido hay que dibujarlas desde las cuadrículas. (4) El motor de sonido (`web/src/audio/engine.ts`) no existe; la interfaz del paso 12 debe entregar lon/lat sin depender de él. (5) Vitest corre en `node`: los componentes 3D no tienen entorno de prueba (sin jsdom ni Testing Library).
