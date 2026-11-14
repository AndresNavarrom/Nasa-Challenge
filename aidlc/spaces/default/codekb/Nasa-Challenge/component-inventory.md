# Component Inventory

Responsable según `TAREAS.md`. Las interfaces públicas se detallan en `api-documentation.md`; las versiones en `technology-stack.md`.

## Web App Shell

- **Ubicación**: `web/src/App.tsx`, `web/src/main.tsx`, `web/src/index.css`, `web/index.html`
- **Responsabilidad**: montar React y, por ahora, cargar los datos y listar las capas con estados de carga y error (`data-testid` `data-loading`, `data-error`, `layer-list`). Los pasos 12-14 reemplazan el cuerpo de `App`.
- **Depende de**: Data Loader
- **Responsable**: Samuel (`web/src/App.tsx`, futuras `web/src/scene/` y `web/src/ui/`)

## Data Loader

- **Ubicación**: `web/src/data/types.ts`, `web/src/data/loadManifest.ts`
- **Responsabilidad**: tipos del contrato de datos y carga validada del manifiesto y las cuadrículas.
- **Depende de**: Prepared Data
- **Responsable**: compartido; el formato no cambia sin acuerdo de los tres

## Interpolation

- **Ubicación**: `web/src/lib/interpolate.ts`
- **Responsabilidad**: valor 0..1 (o `null`) de una capa en lon/lat e instante; bilineal en espacio, lineal en tiempo; elige cuadrícula regional o global.
- **Depende de**: Data Loader (tipos)
- **Responsable**: Fernando

## Timeline

- **Ubicación**: `web/src/lib/timeline.ts`
- **Responsabilidad**: posición común 0..1 → índice de instante y etiqueta de fecha por capa; avance de reproducción con bucle.
- **Depende de**: Data Loader (tipos)
- **Responsable**: Fernando

## Audio Mapping

- **Ubicación**: `web/src/audio/mapping.ts`
- **Responsabilidad**: funciones puras valor → nota/armonía (bosque), aspereza/filtro/ruido (humo), respiración (CO2), paneo y volumen.
- **Depende de**: nada
- **Responsable**: Fernando (el motor `engine.ts` está pendiente, paso 10)

## Prepared Data

- **Ubicación**: `web/public/data/`
- **Responsabilidad**: `manifest.json`, 4 cuadrículas `.bin`, 4 texturas `.png` y `earth.jpg` (1.2 MB) servidos tal cual.
- **Depende de**: Data Prep CLI (los genera)
- **Responsable**: Andres

## Data Prep CLI

- **Ubicación**: `tools/prep/` (`jukebox-prep`)
- **Responsabilidad**: proyectar cuadros NASA, convertir color en valor, reducir/cuantizar y escribir los datos preparados y el manifiesto; modo `--sample`.
- **Depende de**: Frame Fetcher (entradas en `data/raw/`), `data/prep-config.json`, crates `image`, `serde`, `serde_json`
- **Responsable**: Andres

## Frame Fetcher

- **Ubicación**: `tools/fetch-frames.sh`
- **Responsabilidad**: descargar cuadros y videos de NASA SVS, extraer fotogramas con `ffmpeg` y reescribir `data/SOURCES.md`. Corre en el anfitrión (necesita `curl` y `ffmpeg`), no en Docker.
- **Depende de**: red, `curl`, `ffmpeg`
- **Responsable**: Andres

## Local Server

- **Ubicación**: `server/` (`jukebox-server`)
- **Responsabilidad**: servir la interfaz compilada y los datos en `127.0.0.1` (paso 11). Hoy es un esqueleto que sale con código 2.
- **Depende de**: `axum`, `tokio`, `tower-http` (declarados)
- **Responsable**: Andres

## Container Setup

- **Ubicación**: `docker-compose.yml`, `web/Dockerfile`, `web/docker-entrypoint.sh`, `tools/prep/Dockerfile`, `.dockerignore`, `web/.dockerignore`, `tools/prep/.dockerignore`
- **Responsabilidad**: ejecutar la interfaz con recarga en vivo (`web`, `127.0.0.1:5173`), las pruebas (`web-test`, `prep-test`) y la preparación (`prep`); dependencias npm en el volumen `web_node_modules`. El contenedor final (interfaz compilada + servidor) está pendiente.
- **Depende de**: Docker Desktop, imágenes `node:20-bookworm-slim` y `rust:1-slim-bookworm`
- **Responsable**: Andres

## Componentes previstos (no existen)

- `web/src/scene/` y `web/src/ui/` (planeta, mapa, transición, paneles, modo historia, accesibilidad): Samuel, pasos 12-14.
- `web/src/audio/engine.ts` (Web Audio): Fernando, paso 10.
- `run-demo.sh`, `docs/DEMO-CHECKLIST.md`, `docs/SUBMISSION.md`: Andres, pasos 15-16.
- Scripts GEOS-FP (`tools/scraping/`) en la rama `origin/datos-rust`, sin integrar.
