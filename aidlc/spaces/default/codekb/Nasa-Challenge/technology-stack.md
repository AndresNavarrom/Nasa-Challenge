# Technology Stack

## Lenguajes

| Lenguaje | Uso | Configuración |
|---|---|---|
| TypeScript 5.8.3 | Interfaz (`web/src/`) | `tsconfig.json`: `target` ES2022, `moduleResolution` bundler, `jsx` react-jsx, `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters` |
| GLSL (WebGL 1 vía `ShaderMaterial`) | Shaders en línea de `web/src/scene/EarthMesh.tsx` | `texture2D`, `gl_FragColor` |
| Rust (edición 2021, toolchain estable de `rust:1-slim-bookworm`) | `tools/prep/`, `server/` | `Cargo.toml` por crate; `opt-level = 2` en dev para prep |
| Python 3 | `tools/scraping/` | entorno `nix develop` (`flake.nix`, nixpkgs unstable); sin `requirements.txt` ni Dockerfile |
| Bash | `tools/fetch-frames.sh`, `web/docker-entrypoint.sh` (sh) | `set -euo pipefail` / `set -eu` |
| CSS | Tailwind 4 vía `@import "tailwindcss"` | `@theme` con `--color-forest`, `--color-smoke`, `--color-co2` |

## Interfaz (`web/package.json`, versiones exactas)

| Paquete | Versión | Estado de uso |
|---|---|---|
| react / react-dom | 19.3.1 | En uso |
| three | 0.177.0 | En uso en `web/src/scene/` (`DataTexture`, `TextureLoader`, `ShaderMaterial`, `CanvasTexture`) |
| @react-three/fiber | 9.8.2 | En uso (`Canvas`, `useFrame`, `useThree`) |
| gsap | 3.15.1 | Transición globo ↔ mapa (`FocusTransition.ts`) |
| tailwindcss / @tailwindcss/vite | 4.3.5 | En uso |
| vite | 7.3.8 | Servidor de desarrollo y compilación (`base: "./"`, `127.0.0.1:5173`) |
| @vitejs/plugin-react | 4.7.0 | En uso |
| vitest | 3.2.7 | Pruebas, entorno `node` |
| @types/react, @types/react-dom | 19.3.0 | Tipos |
| @types/three | 0.177.0 | Tipos |

No hay `@react-three/drei`, librería de estado global, router, jsdom ni Testing Library.

## Rust

| Crate | Paquete | Versión declarada | Uso |
|---|---|---|---|
| jukebox-prep | image | 0.25 | Decodificar/redimensionar PNG, JPEG (y TIFF, OpenEXR por características por defecto); guardar JPEG y PNG |
| | serde (derive), serde_json | 1 | Configuración y manifiesto |
| jukebox-server | axum | 0.8 | Servidor HTTP (pendiente) |
| | tokio (rt-multi-thread, macros, net, signal) | 1 | Runtime |
| | tower-http (fs) | 0.6 | Archivos estáticos |

Prep no declara ningún crate de NetCDF/HDF5 ni de video. Versiones resueltas en los `Cargo.lock` (no inspeccionados en detalle).

## Python (`tools/scraping/flake.nix`)

| Paquete | Uso |
|---|---|
| requests | Listados HTTP y descargas reanudables |
| xarray, netcdf4 | Abrir, concatenar y escribir NetCDF |
| numpy, pandas | Pesos cos(lat) y CSV de series |
| netcdf, cdo (CLI) | Inspección y operaciones sobre NetCDF |

Sin versiones fijadas fuera de `flake.lock`.

## Ejecución y herramientas

- Docker Desktop + Docker Compose (proyecto `earth-jukebox`); Node 20 (`node:20-bookworm-slim`) dentro del contenedor web; sin Node en el anfitrión.
- `curl` y `ffmpeg` en el anfitrión solo para `tools/fetch-frames.sh`.
- Nix en el anfitrión para `tools/scraping/` (fuera de la regla "todo en Docker" de `project.md`).
- Alternativa secundaria documentada: Node 20.19+ o Deno 2 para la interfaz, cargo para Rust.
- Sin base de datos, sin nube, sin servicios externos en tiempo de ejecución; fuentes del sistema.
