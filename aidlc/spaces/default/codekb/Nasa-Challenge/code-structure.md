# Estructura del código — Earth Jukebox

## Organización

```
docker-compose.yml       servicios web, web-test, prep, prep-test, fetch, fetch-test
data/                    prep-config.json (entrada de prep), SOURCES.md (generado por fetch), raw/ (ignorado)
tools/fetch-frames.sh    descarga y conversión de fuentes (corre en el contenedor fetch)
tools/fetch/             Dockerfile, requirements.txt, geoscf_to_png.py, lightning_composite.py, tests/
tools/prep/              crate Rust jukebox-prep (src/: main, config, pipeline, project, grid, color, error, sample)
tools/scraping/          exploración fuera del POC (Python + Nix)
server/                  crate Rust jukebox-server (esqueleto)
web/                     SPA (Vite, React, three.js, Tailwind, Vitest)
web/src/data/            types.ts, loadManifest.ts
web/src/lib/             interpolate.ts, timeline.ts
web/src/audio/           mapping.ts
web/src/scene/           EarthScene.tsx, EarthMesh.tsx, FocusTransition.ts, geo.ts, layerTexture.ts, baseImage.ts, listeningPoint.tsx
web/src/ui/              PlanetHud.tsx
web/public/data/         datos preparados (manifest.json, *.bin, *.png, earth-*.jpg)
docs/                    PLANET-CHECKLIST.md
```

## Clasificación de archivos

| Categoría | Archivos |
|---|---|
| Model/Entity | `tools/prep/src/config.rs` (PrepConfig, LayerConfig, ValueConfig, Manifest), `tools/prep/src/project.rs` (Projection), `web/src/data/types.ts` |
| Controller/Handler | `tools/prep/src/main.rs` (CLI), `main()` de los scripts Python, `web/src/App.tsx` |
| Service/UseCase | `tools/prep/src/pipeline.rs`, `tools/prep/src/sample.rs`, `tools/fetch-frames.sh`, `tools/fetch/geoscf_to_png.py`, `tools/fetch/lightning_composite.py`, `web/src/data/loadManifest.ts` |
| Utility/Helper | `tools/prep/src/grid.rs`, `color.rs`, `error.rs`; `web/src/lib/*.ts`, `web/src/audio/mapping.ts`, `web/src/scene/geo.ts`, `layerTexture.ts`, `baseImage.ts`, `FocusTransition.ts` |
| UI/Static | `web/src/scene/EarthScene.tsx`, `EarthMesh.tsx`, `listeningPoint.tsx`, `web/src/ui/PlanetHud.tsx`, `web/src/index.css`, `web/index.html`, `web/public/data/*` |
| Configuration | `docker-compose.yml`, Dockerfiles, `data/prep-config.json`, `package.json`, `Cargo.toml`, `requirements.txt`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json` |
| Test | `web/src/**/*.test.ts`, `tools/fetch/tests/*.py`, bloques `#[cfg(test)]` en Rust |

## Patrones

- **Funciones puras + bordes delgados**: la lógica (interpolación, mapeo a sonido, geometría, conversión de color, reducción a cuadrícula, conversión PM2.5) está en funciones puras probadas; la E/S queda en `main`, `load*`, `write*`.
- **Errores con mensaje para la persona**: `PrepError` (Rust), `ConversionError`/`CompositeError` (Python), `DataLoadError` (TS) con pistas de cómo arreglarlo.
- **Configuración por enumeraciones etiquetadas** (`#[serde(tag = "method")]`, `#[serde(tag = "type")]`) para métodos de valor y proyecciones.
- **Constantes compartidas a mano entre Rust y TS** (`LAYER_IDS`), con comentarios "keep in step".
- **Estado mutable de vista + GSAP** en la escena; React solo para el modo y la UI.

## Dependencias internas

- `main.rs` → `config`, `pipeline`, `sample`, `error`; `pipeline` → `color`, `config`, `grid`, `project`, `error`; `sample` → `pipeline`, `grid`, `config`.
- `App.tsx` → `data/loadManifest`, `scene/EarthScene`, `scene/listeningPoint`, `ui/PlanetHud`; `EarthScene` → `EarthMesh`, `FocusTransition`, `layerTexture`, `baseImage`, `geo`, `lib/interpolate`; `geo` → `lib/interpolate`.
- Sin referencias circulares detectadas.
