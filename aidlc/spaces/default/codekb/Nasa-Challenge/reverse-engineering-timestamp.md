# Reverse Engineering Timestamp

## Run Record

- Date: 2026-11-14
- Commit: baf3033c31d6f11c666d751fc03d37854f79d793

Escaneo enfocado, profundidad Minimal, intent `hires-data-layers` (planeta y capas en alta resolución con datos reales), sobre un store previo STALE del intent `globe-transition-ui` (commit `b90f5e3`, escaneo completo). Área analizada: preparación de datos (`tools/prep/`), descarga (`tools/fetch-frames.sh`, `tools/scraping/`), configuración (`data/prep-config.json`), manifiesto publicado (`web/public/data/manifest.json`), contrato y cargador (`web/src/data/`) y escena 3D (`web/src/scene/`). La prosa previa fuera de esa área se conserva; la cobertura profunda anterior (`./`) no se pudo volver a verificar y pasa a `shallow.paths`. Quedaron fuera sin abrir: `tools/prep/target/`, `tools/scraping/resources/`, el contenido de `data/raw/`, `tools/prep/Cargo.lock` y la instalación de AI-DLC.

## Scope of Analysis

```yaml
scope_version: 1
kind: partial
intent: hires-data-layers
fingerprint: 3cf863f0cc878d999f14f69c0df8753937d7942d
analyzed:
  paths:
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
  components:
    - Data Loader
    - Planet Scene
    - Prepared Data
    - Data Prep CLI
    - Frame Fetcher
    - Scraping Tools
shallow:
  paths:
    - ./
    - tools/prep/src/color.rs
    - tools/prep/src/sample.rs
    - tools/prep/src/error.rs
    - tools/scraping/collect_resources.py
    - tools/scraping/flake.lock
    - data/SOURCES.md
    - web/public/data/
    - web/src/scene/geo.ts
    - web/src/scene/FocusTransition.ts
    - web/src/scene/listeningPoint.tsx
    - web/src/scene/geo.test.ts
    - web/src/scene/layerTexture.test.ts
    - web/src/data/loadManifest.test.ts
    - web/package-lock.json
    - tools/prep/Cargo.lock
    - server/Cargo.lock
```
