# Component Inventory

Responsable según `TAREAS.md`. Las interfaces públicas se detallan en `api-documentation.md`; las versiones en `technology-stack.md`.

## Web App Shell

- **Ubicación**: `web/src/App.tsx`, `web/src/main.tsx`, `web/src/index.css`, `web/index.html`, `web/src/ui/PlanetHud.tsx`
- **Responsabilidad**: montar React, cargar los datos con estados de carga y error (`data-testid` `data-loading`, `data-error`), y montar `EarthScene` dentro de `ListeningPointProvider` junto con el HUD `PlanetHud`. `index.css` define un color por id de capa (`--color-forest`, `--color-smoke`, `--color-co2`).
- **Depende de**: Data Loader, Planet Scene
- **Responsable**: Samuel (`web/src/App.tsx`, `web/src/scene/`, `web/src/ui/`)

## Data Loader

- **Ubicación**: `web/src/data/types.ts`, `web/src/data/loadManifest.ts`
- **Responsabilidad**: tipos del contrato de datos (incluido el conjunto cerrado `LAYER_IDS`) y carga validada del manifiesto y de todas las cuadrículas al iniciar. Rechaza ids de capa fuera de `LAYER_IDS`; no limita tamaños de cuadrícula.
- **Depende de**: Prepared Data
- **Responsable**: compartido; el formato no cambia sin acuerdo de los tres

## Planet Scene

- **Ubicación**: `web/src/scene/` (`EarthScene.tsx`, `EarthMesh.tsx`, `layerTexture.ts`, `geo.ts`, `FocusTransition.ts`, `listeningPoint.tsx`)
- **Responsabilidad**: canvas de React Three Fiber, planeta que se aplana en mapa de la Amazonía (malla morfable en GPU), carga de `earth.jpg` (mitad de resolución en modo lite), texturas de la capa activa dibujadas desde las cuadrículas (primer instante, rampa por id; rampa neutra para ids nuevos), selección del punto bajo el cursor, valor de la capa en ese punto y publicación del punto de escucha.
- **Depende de**: Data Loader (tipos y datos), Interpolation (`sampleLayerAt`), Prepared Data (`earth.jpg`), three, @react-three/fiber, gsap (transición)
- **Responsable**: Samuel

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
- **Responsabilidad**: funciones puras valor → nota/armonía (bosque), aspereza/filtro/ruido (humo), respiración (CO2, `co2ToBreath`), paneo y volumen.
- **Depende de**: nada
- **Responsable**: Fernando (el motor `engine.ts` está pendiente, paso 10)

## Prepared Data

- **Ubicación**: `web/public/data/`
- **Responsabilidad**: `manifest.json`, 4 cuadrículas `.bin`, 4 texturas `.png` (no usadas por la escena) y `earth.jpg` 2048×1024 (unos 1.3 MB en total) servidos tal cual.
- **Depende de**: Data Prep CLI (los genera)
- **Responsable**: Andres

## Data Prep CLI

- **Ubicación**: `tools/prep/` (`jukebox-prep`)
- **Responsabilidad**: abrir cuadros NASA como imágenes raster, proyectarlos (`equirect`, `orthographic`), convertir color en valor (`colorbar`, `brightness`, `warmth`), reducir/cuantizar a cuadrículas de tamaño configurable (72×36 a 1024 por lado), redimensionar la imagen base a `earth.jpg` 2048×1024 y escribir datos preparados y manifiesto; modo `--sample`. No lee NetCDF ni video.
- **Depende de**: Frame Fetcher (entradas en `data/raw/`), `data/prep-config.json`, crates `image`, `serde`, `serde_json`
- **Responsable**: Andres

## Frame Fetcher

- **Ubicación**: `tools/fetch-frames.sh`
- **Responsabilidad**: descargar cuadros y videos de NASA SVS (4950, 5533, 5196, 3615), extraer fotogramas con `ffmpeg` (local o remoto con escala) y reescribir entero `data/SOURCES.md`. Corre en el anfitrión (necesita `curl` y `ffmpeg`), no en Docker.
- **Depende de**: red, `curl`, `ffmpeg`
- **Responsable**: Andres

## Scraping Tools

- **Ubicación**: `tools/scraping/` (`fetch_geos_variable.py`, `collect_resources.py`, `flake.nix`, `flake.lock`, `README.md`)
- **Responsabilidad**: exploración de fuentes: descargar una variable GEOS-FP de un día y escribir un NetCDF de una variable más un CSV de media global ponderada; recolectar metadatos SVS, el CSV de GISTEMP y archivos del portal GEOS-FP con límites. Salida en `tools/scraping/resources/` (ignorada). Según su README no forma parte de la POC.
- **Depende de**: red, Python 3 con `requests`, `pandas`, `xarray`, `netcdf4`, `numpy`; herramientas `netcdf` y `cdo`; entorno Nix (no Docker)
- **Responsable**: Fernando (llegó por su PR)

## Local Server

- **Ubicación**: `server/` (`jukebox-server`)
- **Responsabilidad**: servir la interfaz compilada y los datos en `127.0.0.1` (paso 11). Hoy es un esqueleto que sale con código 2.
- **Depende de**: `axum`, `tokio`, `tower-http` (declarados)
- **Responsable**: Andres

## Container Setup

- **Ubicación**: `docker-compose.yml`, `web/Dockerfile`, `web/docker-entrypoint.sh`, `tools/prep/Dockerfile`, `.dockerignore`, `web/.dockerignore`, `tools/prep/.dockerignore`
- **Responsabilidad**: ejecutar la interfaz con recarga en vivo (`web`, `127.0.0.1:5173`), las pruebas (`web-test`, `prep-test`) y la preparación (`prep`); dependencias npm en el volumen `web_node_modules`; la imagen de prep compila las dependencias y deja el código montado para compilarse en cada ejecución. El contenedor final (interfaz compilada + servidor) está pendiente.
- **Depende de**: Docker Desktop, imágenes `node:20-bookworm-slim` y `rust:1-slim-bookworm`
- **Responsable**: Andres

## Componentes previstos (no existen)

- `web/src/audio/engine.ts` (Web Audio): Fernando, paso 10.
- `run-demo.sh`, `docs/DEMO-CHECKLIST.md`, `docs/SUBMISSION.md`: Andres, pasos 15-16.
