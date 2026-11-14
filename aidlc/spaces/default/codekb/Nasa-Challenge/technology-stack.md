# Technology Stack

## Lenguajes

| Lenguaje | Uso | Configuración |
|---|---|---|
| TypeScript 5.8.3 | Interfaz (`web/src/`) | `tsconfig.json`: `target` ES2022, `moduleResolution` bundler, `jsx` react-jsx, `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters` |
| Rust (edición 2021, toolchain estable de `rust:1-slim-bookworm`) | `tools/prep/`, `server/` | `Cargo.toml` por crate; `opt-level = 2` en dev para prep |
| Bash | `tools/fetch-frames.sh`, `web/docker-entrypoint.sh` (sh) | `set -euo pipefail` / `set -eu` |
| CSS | Tailwind 4 vía `@import "tailwindcss"` | `@theme` con `--color-forest`, `--color-smoke`, `--color-co2` |

## Interfaz (`web/package.json`, versiones exactas)

| Paquete | Versión | Estado de uso |
|---|---|---|
| react / react-dom | 19.3.1 | En uso |
| three | 0.177.0 | Declarado, sin uso aún |
| @react-three/fiber | 9.8.2 | Declarado, sin uso aún |
| gsap | 3.15.1 | Declarado, sin uso aún |
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
| jukebox-prep | image | 0.25 | Decodificar/redimensionar PNG y JPEG |
| | serde (derive), serde_json | 1 | Configuración y manifiesto |
| jukebox-server | axum | 0.8 | Servidor HTTP (pendiente) |
| | tokio (rt-multi-thread, macros, net, signal) | 1 | Runtime |
| | tower-http (fs) | 0.6 | Archivos estáticos |

Versiones resueltas en los `Cargo.lock` (no inspeccionados en detalle).

## Ejecución y herramientas

- Docker Desktop + Docker Compose (proyecto `earth-jukebox`); Node 20 (`node:20-bookworm-slim`) dentro del contenedor web; sin Node en el anfitrión.
- `curl` y `ffmpeg` en el anfitrión solo para `tools/fetch-frames.sh`.
- Alternativa secundaria documentada: Node 20.19+ o Deno 2 para la interfaz, cargo para Rust.
- Sin base de datos, sin nube, sin servicios externos en tiempo de ejecución; fuentes del sistema.
