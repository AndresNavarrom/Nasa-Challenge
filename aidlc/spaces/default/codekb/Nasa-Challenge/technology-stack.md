# Pila tecnológica — Earth Jukebox

## Lenguajes

| Lenguaje | Versión | Dónde |
|---|---|---|
| TypeScript | 5.8.3 (target ES2022, `strict`) | `web/src/` |
| Rust | edition 2021, toolchain `rust:1-slim-bookworm` | `tools/prep/`, `server/` |
| Python | 3.12.7 | `tools/fetch/`, `tools/scraping/` |
| Bash | — | `tools/fetch-frames.sh`, `web/docker-entrypoint.sh` |
| GLSL | WebGL 1 (`texture2D`) | shaders en `web/src/scene/EarthMesh.tsx` |

## Frameworks y librerías

| Nombre | Versión | Uso |
|---|---|---|
| React / react-dom | 19.3.1 | interfaz |
| three / @types/three | 0.177.0 | render 3D |
| @react-three/fiber | 9.8.2 | three.js declarativo |
| gsap | 3.15.1 | animación |
| tailwindcss, @tailwindcss/vite | 4.3.5 | estilos |
| vite | 7.3.8 | dev server y build |
| @vitejs/plugin-react | 4.7.0 | JSX/Fast Refresh |
| vitest | 3.2.7 | pruebas web |
| image (crate) | 0.25 | PNG/JPEG/TIFF, redimensionado |
| serde, serde_json | 1 | configuración y manifiesto |
| axum / tokio / tower-http | 0.8 / 1 / 0.6 | servidor (sin uso aún) |
| netCDF4 | 1.7.2 | lectura GEOS-CF |
| numpy | 2.1.3 | conversiones |
| Pillow | 11.0.0 | escritura PNG |
| pytest | 8.3.3 | pruebas fetch |
| ffmpeg, curl, unzip | paquetes Debian bookworm | descarga y conversión |

## Infraestructura y herramientas

- Docker Desktop + Docker Compose (proyecto `earth-jukebox`); imágenes base `node:20-bookworm-slim`, `rust:1-slim-bookworm`, `python:3.12.7-slim-bookworm`.
- Nix flake solo para `tools/scraping/`.
- Sin nube, sin base de datos, sin CI.

## Notas para GEDI L3

- El contenedor `fetch` no tiene GDAL, rasterio ni tifffile; leer un GeoTIFF float32 en EASE-Grid 2.0 requiere añadir una de ellas a `tools/fetch/requirements.txt` (y reconstruir la imagen) o depender de Pillow con `MAX_IMAGE_PIXELS = None`.
- El crate `image` 0.25 de `prep` decodifica TIFF pero `prep` convierte todo a RGB de 8 bits (`load_rgb`), sin georreferencia.
