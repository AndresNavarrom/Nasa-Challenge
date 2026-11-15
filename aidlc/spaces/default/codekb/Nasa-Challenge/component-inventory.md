# Inventario de componentes — Earth Jukebox

Inventario único del repositorio; los demás artefactos lo referencian.

### earth-jukebox-web

- **Ruta**: `web/`
- **Responsabilidad**: SPA del planeta 3D y el mapa de la Amazonía: carga y valida los datos (`src/data/`), interpola en espacio y tiempo (`src/lib/`), mapea valor→sonido (`src/audio/mapping.ts`), dibuja planeta, capa activa y transición (`src/scene/`), HUD con selector de capa, indicador y FPS (`src/ui/`).
- **Depende de**: `web/public/data/` (salida de `jukebox-prep`); React, three.js, @react-three/fiber, GSAP, Tailwind.
- **Pruebas**: 7 archivos Vitest, 28 casos.

### jukebox-prep

- **Ruta**: `tools/prep/`
- **Responsabilidad**: CLI Rust que convierte imágenes de fuentes NASA en cuadrículas de intensidad, texturas, imagen base del planeta y `manifest.json`; modo `--sample` con datos generados.
- **Depende de**: `data/prep-config.json` y `data/raw/`; crates `image`, `serde`, `serde_json`.
- **Pruebas**: 10 pruebas unitarias en `config`, `pipeline`, `project`, `grid`, `color`.

### jukebox-server

- **Ruta**: `server/`
- **Responsabilidad**: futuro servidor estático Axum en 127.0.0.1 para la app compilada; hoy sale con código 2.
- **Depende de**: axum, tokio, tower-http (declaradas, sin uso).
- **Pruebas**: ninguna.

### fetch-tools

- **Ruta**: `tools/fetch-frames.sh`, `tools/fetch/`
- **Responsabilidad**: descargar las fuentes (Natural Earth, GEOS-CF, video SVS 5011, cuadros SVS 4950) a `data/raw/`, convertirlas a PNG legibles por `prep` y reescribir `data/SOURCES.md`.
- **Depende de**: curl, ffmpeg, unzip, Python 3.12 con numpy, Pillow, netCDF4 (imagen `earth-jukebox-fetch`).
- **Pruebas**: 7 pruebas pytest de las conversiones.

### data-config

- **Ruta**: `data/prep-config.json`, `data/SOURCES.md`
- **Responsabilidad**: declara capas, vistas, proyecciones y métodos de valor que lee `prep`; registra fuentes y licencias (generado por `fetch-frames.sh`).
- **Depende de**: esquema de `tools/prep/src/config.rs`.
- **Pruebas**: validado al correr `prep`.

### compose-services

- **Ruta**: `docker-compose.yml`, `web/Dockerfile`, `tools/prep/Dockerfile`, `tools/fetch/Dockerfile`, `.dockerignore`
- **Responsabilidad**: construir y correr todo en Docker: `web` (dev en 127.0.0.1:5173), `web-test`, `prep`, `prep-test`, `fetch`, `fetch-test`.
- **Depende de**: Docker Desktop.
- **Pruebas**: no aplica.

### scraping-tools

- **Ruta**: `tools/scraping/`
- **Responsabilidad**: exploración de fuentes NASA (API de SVS, GISTEMP, portal GEOS-FP); fuera del POC.
- **Depende de**: Python con requests, pandas, xarray, netcdf4; entorno Nix.
- **Pruebas**: ninguna.
