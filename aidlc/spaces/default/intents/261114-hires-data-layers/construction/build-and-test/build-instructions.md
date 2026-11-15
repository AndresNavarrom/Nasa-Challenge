# Instrucciones de compilación — Mejora de resolución

Todo corre en Docker (Docker Desktop). En el equipo no hace falta Node, Rust, Python ni ffmpeg.

## Dependencias y entorno

- Docker Desktop con al menos 4 GB de memoria para los contenedores. Abrir el TIFF de Natural Earth necesita unos 1,5 GB.
- Internet solo para construir las imágenes y descargar los datos. La demo no lo necesita.
- No hay variables de entorno ni credenciales. Ninguna descarga pide inicio de sesión.

## Construir las imágenes

```bash
docker compose --profile '*' build
```

Construye `earth-jukebox-web:dev`, `earth-jukebox-prep:dev` y la imagen nueva `earth-jukebox-fetch:dev`.

## Descargar y preparar los datos

Solo hace falta para regenerarlos; los datos ya preparados están en `web/public/data/`.

```bash
docker compose run --rm fetch    # descarga a data/raw/ (unos 1,4 GB) y reescribe data/SOURCES.md
docker compose run --rm prep     # escribe las cuadrículas, las imágenes y manifest.json en web/public/data/
```

Si un archivo de `data/raw/` quedó dañado, se vuelve a bajar con `docker compose run --rm -e FORCE=1 fetch`.

## Compilar la app

```bash
docker build --target build web
```

Corre `tsc --noEmit && vite build`.

## Verificar la compilación

- La compilación termina sin errores de tipos.
- `web/public/data/manifest.json` lista exactamente `forest`, `smoke` y `lightning`.
- Existen `earth-8k.jpg` (8192 × 4096), `earth-4k.jpg` (4096 × 2048) y `earth-amazon.jpg` (2160 × 1680).

## Problemas comunes

- **`prep` se queda sin memoria al abrir el TIFF**: sube la memoria de Docker Desktop.
- **`cargo test ... config:: pipeline::` falla con `unexpected argument`**: falta `--` antes de los filtros. Ver `test-results.md`.
- **`prep` tarda unos 15 s más de lo esperado**: compila sus dependencias en modo `--release` en cada corrida.
