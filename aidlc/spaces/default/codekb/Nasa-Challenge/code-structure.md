# Code Structure

## Organización del repositorio

```
web/                    earth-jukebox-web (Vite + React + TS)
  index.html            punto de entrada HTML (#root)
  src/main.tsx          monta <App/> en StrictMode
  src/App.tsx           carga datos y monta la escena y el HUD
  src/index.css         Tailwind 4 (@theme con colores por capa), foco visible, .sr-only
  src/data/             contrato de datos (types.ts) y cargador validado (loadManifest.ts)
  src/scene/            planeta 3D: EarthScene.tsx, EarthMesh.tsx, layerTexture.ts, geo.ts,
                        FocusTransition.ts, listeningPoint.tsx (+ pruebas geo, layerTexture)
  src/ui/               PlanetHud.tsx
  src/lib/              interpolate.ts (muestreo espacio/tiempo), timeline.ts (posición común)
  src/audio/            mapping.ts (valor -> parámetros de sonido, funciones puras)
  public/data/          datos preparados que se sirven tal cual
  Dockerfile            etapas deps, dev, test, build
  docker-entrypoint.sh  reinstala dependencias si cambia package-lock.json
tools/prep/             jukebox-prep (Rust): cuadros -> cuadrículas, texturas, manifiesto
  src/main.rs           CLI y orquestación
  src/config.rs         configuración de entrada, LAYER_IDS, límites de tamaño y formato del manifiesto (serde)
  src/pipeline.rs       carga de imágenes, render, reducción, escritura de archivos, earth.jpg
  src/project.rs        proyecciones equirect y orthographic
  src/color.rs          color -> valor (colorbar, brightness, warmth)
  src/grid.rs           reducción a cuadrícula, cuantización, mínimos de tamaño
  src/sample.rs         datos de muestra generados (--sample), con ids forest/smoke/co2
  src/error.rs          PrepError
tools/fetch-frames.sh   descarga de cuadros NASA y reescritura de data/SOURCES.md (anfitrión)
tools/scraping/         scripts Python de exploración (GEOS-FP, SVS, GISTEMP) con entorno Nix
  fetch_geos_variable.py  una variable GEOS-FP de un día -> NetCDF + CSV de media global
  collect_resources.py    recolector genérico con límites --max-files / --max-gb
  flake.nix, flake.lock   entorno Python + netcdf + cdo
  README.md
server/                 jukebox-server (Rust, Axum): esqueleto
data/                   prep-config.json, SOURCES.md (generado); raw/ ignorado (png, jpg, mp4 por SVS)
docker-compose.yml      servicios web, web-test, prep-test, prep
README.md, TAREAS.md, VISION-MISION.md
```

Carpetas previstas que no existen todavía: `web/src/audio/engine.ts`, `docs/`, `run-demo.sh`.

## Clasificación de archivos

| Clase | Archivos |
|---|---|
| Vista / entrada | `web/src/main.tsx`, `web/src/App.tsx`, `web/index.html`, `web/src/index.css`, `web/src/ui/PlanetHud.tsx` |
| Vista 3D | `web/src/scene/EarthScene.tsx`, `web/src/scene/EarthMesh.tsx` (shaders GLSL en línea) |
| Modelo / contrato | `web/src/data/types.ts`, `tools/prep/src/config.rs` |
| Servicio / carga | `web/src/data/loadManifest.ts` |
| Utilidad (pura) | `web/src/lib/interpolate.ts`, `web/src/lib/timeline.ts`, `web/src/audio/mapping.ts`, `web/src/scene/{geo,layerTexture,FocusTransition}.ts`, `tools/prep/src/{color,grid,project}.rs` |
| Estado compartido | `web/src/scene/listeningPoint.tsx` (contexto React) |
| Proceso por lotes | `tools/prep/src/{main,pipeline,sample}.rs`, `tools/fetch-frames.sh`, `tools/scraping/*.py` |
| Configuración | `web/{package.json,vite.config.ts,vitest.config.ts,tsconfig.json}`, `*/Cargo.toml`, `docker-compose.yml`, Dockerfiles, `data/prep-config.json`, `tools/scraping/flake.nix` |
| Pruebas | `web/src/**/*.test.ts`, módulos `#[cfg(test)]` en `color.rs`, `grid.rs`, `project.rs` |
| Datos | `web/public/data/*` |

## Patrones de código

- **Validación en la frontera con errores para personas**: `DataLoadError` (TS) y `PrepError` (Rust) con mensajes que nombran el archivo y la acción (`PREP_HINT`). Funciones `require*` que fallan rápido. `gridToRgba` lanza un `Error` que nombra la capa; `EarthScene` lo convierte en aviso visible y dibuja sin capa.
- **Funciones puras con límites**: todas las entradas se limitan a 0..1 y `NaN` cuenta como 0 (`clamp01`, `clampUnit`, `clampPosition`).
- **Inyección de dependencias ligera**: `loadJukeboxData(baseUrl, fetcher)` acepta un `fetch` sustituible para pruebas.
- **Unión discriminada para estado de carga** en `App.tsx` (`loading | ready | error`) con limpieza de efecto (`cancelled`); el mismo patrón en `useBaseTexture`.
- **Enums etiquetados con serde** (`#[serde(tag = "method")]`, `#[serde(tag = "type")]`) para la configuración de prep; valores por defecto con `#[serde(default = ...)]`.
- **Geometría morfable en GPU**: un solo `BufferGeometry` con la esfera en `position` y el mapa en `aPlane`, mezclados por `uFlatten` en el shader.
- **Datos abiertos a ids nuevos en la escena**: `rampFor(id)` devuelve `NEUTRAL_RAMP` para ids sin rampa propia.
- **`data-testid` en elementos de interfaz** (convención pedida en `TAREAS.md`).
- Nombres idiomáticos: camelCase en TS, snake_case en Rust y Python; comentarios de documentación en inglés.
