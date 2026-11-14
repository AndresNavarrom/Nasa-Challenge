# Code Structure

## Organización del repositorio

```
web/                    earth-jukebox-web (Vite + React + TS)
  index.html            punto de entrada HTML (#root)
  src/main.tsx          monta <App/> en StrictMode
  src/App.tsx           carcasa provisional: carga datos y lista capas
  src/index.css         Tailwind 4 (@theme con colores por capa), foco visible, .sr-only
  src/data/             contrato de datos (types.ts) y cargador validado (loadManifest.ts)
  src/lib/              interpolate.ts (muestreo espacio/tiempo), timeline.ts (posición común)
  src/audio/            mapping.ts (valor -> parámetros de sonido, funciones puras)
  public/data/          datos preparados que se sirven tal cual
  Dockerfile            etapas deps, dev, test, build
  docker-entrypoint.sh  reinstala dependencias si cambia package-lock.json
tools/prep/             jukebox-prep (Rust): cuadros -> cuadrículas, texturas, manifiesto
  src/main.rs           CLI y orquestación
  src/config.rs         configuración de entrada y formato del manifiesto (serde)
  src/pipeline.rs       render, reducción, escritura de archivos
  src/project.rs        proyecciones equirect y orthographic
  src/color.rs          color -> valor (colorbar, brightness, warmth)
  src/grid.rs           reducción a cuadrícula, cuantización, validación de tamaños
  src/sample.rs         datos de muestra generados (--sample)
  src/error.rs          PrepError
tools/fetch-frames.sh   descarga de cuadros NASA y reescritura de data/SOURCES.md
server/                 jukebox-server (Rust, Axum): esqueleto
data/                   prep-config.json, SOURCES.md; raw/ ignorado
docker-compose.yml      servicios web, web-test, prep-test, prep
README.md, TAREAS.md, VISION-MISION.md
```

Carpetas previstas que no existen todavía: `web/src/scene/`, `web/src/ui/`, `web/src/audio/engine.ts`, `docs/`, `run-demo.sh`.

## Clasificación de archivos

| Clase | Archivos |
|---|---|
| Vista / entrada | `web/src/main.tsx`, `web/src/App.tsx`, `web/index.html`, `web/src/index.css` |
| Modelo / contrato | `web/src/data/types.ts`, `tools/prep/src/config.rs` |
| Servicio / carga | `web/src/data/loadManifest.ts` |
| Utilidad (pura) | `web/src/lib/interpolate.ts`, `web/src/lib/timeline.ts`, `web/src/audio/mapping.ts`, `tools/prep/src/{color,grid,project}.rs` |
| Proceso por lotes | `tools/prep/src/{main,pipeline,sample}.rs`, `tools/fetch-frames.sh` |
| Configuración | `web/{package.json,vite.config.ts,vitest.config.ts,tsconfig.json}`, `*/Cargo.toml`, `docker-compose.yml`, Dockerfiles, `data/prep-config.json` |
| Pruebas | `web/src/**/*.test.ts`, módulos `#[cfg(test)]` en `color.rs`, `grid.rs`, `project.rs` |
| Datos | `web/public/data/*` |

## Patrones de código

- **Validación en la frontera con errores para personas**: `DataLoadError` (TS) y `PrepError` (Rust) con mensajes que nombran el archivo y la acción (`PREP_HINT`). Funciones `require*` que fallan rápido.
- **Funciones puras con límites**: todas las entradas se limitan a 0..1 y `NaN` cuenta como 0 (`clamp01`, `clampUnit`, `clampPosition`).
- **Inyección de dependencias ligera**: `loadJukeboxData(baseUrl, fetcher)` acepta un `fetch` sustituible para pruebas.
- **Unión discriminada para estado de carga** en `App.tsx` (`loading | ready | error`) con limpieza de efecto (`cancelled`).
- **Enums etiquetados con serde** (`#[serde(tag = "method")]`, `#[serde(tag = "type")]`) para la configuración de prep.
- **`data-testid` en elementos de interfaz** (convención pedida en `TAREAS.md` para el paso 13).
- Nombres idiomáticos: camelCase en TS, snake_case en Rust; comentarios de documentación en inglés.
