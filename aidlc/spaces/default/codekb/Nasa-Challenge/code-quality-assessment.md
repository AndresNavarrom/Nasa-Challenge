# Code Quality Assessment

## Pruebas

| Área | Archivos | Casos | Qué cubren |
|---|---|---|---|
| Interfaz (Vitest, entorno `node`) | `web/src/data/loadManifest.test.ts` | 3 | Carga correcta, archivo faltante o de tamaño erróneo, manifiesto inválido |
| | `web/src/lib/interpolate.test.ts` | 4 | Bilineal, lineal en tiempo, capa estática, bordes |
| | `web/src/lib/timeline.test.ts` | 3 | Fechas por capa, límites, avance con bucle |
| | `web/src/audio/mapping.test.ts` | 3 | Escala pentatónica, monotonía humo/CO2, límites |
| | `web/src/scene/geo.test.ts` | 6 | Conversiones lon/lat ↔ esfera y plano, bbox, ángulos |
| | `web/src/scene/layerTexture.test.ts` | 2 | Colores y transparencias de una cuadrícula 2×2; error si faltan bytes |
| Rust (`cargo test`) | `color.rs`, `grid.rs`, `project.rs` | 5 | Color → valor, reducción de cuadrícula, tamaños, proyecciones |

Se ejecutan con `docker compose run --rm web-test` y `docker compose run --rm prep-test` (no ejecutados en este escaneo). Los casos de `geo` y `layerTexture` se contaron por nombre, sin leer su cuerpo.

Huecos:

- Sin configuración ni umbral de cobertura.
- Sin entorno DOM (jsdom/Testing Library ausentes): `EarthScene.tsx`, `EarthMesh.tsx` y los shaders no tienen pruebas automáticas; la lógica pura de la escena sí (`geo`, `layerTexture`).
- `pipeline.rs` (incluidos `prepare_earth`, `render`, `remove_stale_global`), `config.rs` (validación, incluido el límite de 1024), `sample.rs` y `main.rs` (argumentos) sin pruebas.
- `sampleLayerAt` con cambio región↔global no tiene caso propio.
- Ningún caso prueba cuadrículas grandes (por ejemplo 1440×720) ni el tiempo de prep.

## Linting y formato

- No hay ESLint, Prettier, `rustfmt.toml`, configuración de clippy ni ruff/black para Python. La comprobación estática es `tsc --noEmit` estricto (`npm run typecheck`, también dentro de `npm run build`).
- El estilo es consistente a mano: camelCase/snake_case idiomáticos, comentarios de documentación en inglés.

## CI/CD

- No hay pipeline (ni `.github/workflows` ni equivalente). Pruebas y compilación son manuales en Docker; la integración entre ramas se hace a mano al cierre de cada bloque.

## Documentación

- `README.md` (inglés): estado, estructura, ejecución con y sin Docker, formato de datos, fuentes y límites, declaración de uso de IA. Buena calidad.
- `TAREAS.md` y `VISION-MISION.md` (español): reparto, propiedad de carpetas, riesgos y alcance POC→MVP.
- `data/SOURCES.md` generado por `fetch-frames.sh` con cada archivo, enlace y método (se pierde cualquier edición a mano).
- `tools/scraping/README.md`: entorno, ejemplos, límites de seguridad y aviso de volumen de datos.
- Comentarios en código claros, con referencias a requisitos (`FR1.x`, `FR2.1`, `FR3.x`, `FR4.x`, `FR5.2`, `FR7`, `FR9`, `NFR1`).

## Manejo de errores y seguridad

- Errores en fronteras bien tratados: `DataLoadError` y `PrepError` con mensajes accionables; `App.tsx` muestra el error con `role="alert"`; `EarthScene` informa si falla `earth.jpg` o una capa y sigue funcionando; `fetch-frames.sh` falla con mensaje y limpia `.part`; los scripts Python reintentan con espera exponencial y reanudan descargas.
- Sin secretos en el código del proyecto. El puerto de desarrollo y el servidor previsto se limitan a `127.0.0.1`.
- `fetch_geos_variable.py` sigue solo enlaces relativos y rechaza `..`; `collect_resources.py` tiene topes `--max-files`/`--max-gb`.
- `docker-entrypoint.sh` puede necesitar internet si cambia `package-lock.json` (riesgo para la demo sin red, documentado).

## Deuda técnica

| Señal | Ubicación | Impacto para el intent `hires-data-layers` |
|---|---|---|
| Máximo de 1024 celdas por lado | `tools/prep/src/config.rs:78` | La cuadrícula global 1440×720 se rechaza hasta subir el límite |
| `earth.jpg` fija en 2048×1024 | `tools/prep/src/pipeline.rs:21`, `:383` | La imagen base de 8192×4096 se reduciría; hace falta un tamaño configurable (y revisar la calidad JPEG por defecto del crate) |
| Una sola imagen base, sin recorte regional | `web/src/scene/EarthMesh.tsx:102`, `EarthScene.tsx:147` | Un recorte de alta resolución de la Amazonía necesita uniforme, archivo y campo de manifiesto nuevos |
| Prep solo lee imágenes raster | `tools/prep/src/pipeline.rs:66`, `Cargo.toml` | GEOS-CF PM2.5 (NetCDF 1440×721) necesita un lector nuevo o una conversión previa; 721 filas en los polos vs 720 celdas centradas |
| Supermuestreo fijo 4×4 | `tools/prep/src/pipeline.rs:18` | A 1440×720 cada instante global rasteriza 5760×2880 puntos por vista (unos 66 MB de `f32`); con 14 vistas ortográficas el tiempo crece mucho |
| Conjunto cerrado `LAYER_IDS` duplicado | `web/src/data/types.ts:4`, `tools/prep/src/config.rs:10`, `web/src/data/loadManifest.ts:70` | Reemplazar `co2` por rayos exige cambiar TS y Rust a la vez y regenerar datos; además `sample.rs:87`, `layerTexture.ts:26`, `mapping.ts:88`, `index.css:9` |
| Scripts de scraping fuera de Docker y sobre GEOS-FP | `tools/scraping/flake.nix`, `fetch_geos_variable.py:11` | No cumplen la regla "todo en Docker" y no apuntan a GEOS-CF; no escriben en `data/raw/` |
| Texturas de prep sin uso | `tools/prep/src/pipeline.rs:307-316`, `loadManifest.ts:60` | Prep gasta tiempo en PNG que la escena ignora; el manifiesto exige `texture` igualmente |
| Texturas de capas con tiempo solo del primer instante | `web/src/scene/layerTexture.ts:67` (`FIRST_INSTANT`) | Imagen y sonido no avanzan juntos todavía |
| Humo y CO2 sin cuadrícula global | `web/public/data/manifest.json` (`global: null`) | En el planeta solo el bosque tiene textura y valor fuera de la Amazonía |
| Todas las cuadrículas se descargan al iniciar | `web/src/data/loadManifest.ts:189-195` | Con 1440×720 y varios instantes la carga inicial crece (1 036 800 bytes por instante global) |
| Instantes de humo equiespaciados aunque el video no lo está | `manifest.json` (`dates` con tiempos de clip) | Las etiquetas muestran tiempo de clip, no fecha |
| Salto de resolución en el borde de la Amazonía (96×72 regional vs 144×72 global) | `web/src/lib/interpolate.ts` (`sampleLayerAt`), `EarthMesh.tsx:106-112` | Con global 1440×720 la global sería más fina que la regional (unos 0.25° frente a 0.375°×0.39°) |
| Servidor esqueleto | `server/src/main.rs` | Fuera de este intent |
| Sin linter ni CI | raíz | Regresiones solo se detectan ejecutando pruebas a mano |

## Valoración general

Base pequeña, limpia y bien documentada, con lógica pura probada y fronteras validadas. La escena 3D ya acepta cualquier tamaño de cuadrícula e ids nuevos. Las debilidades para subir la resolución están en prep (límites y tamaños fijos, entrada solo por imagen) y en el contrato (ids cerrados y duplicados, imagen base fuera del manifiesto), además de las de proceso (sin CI ni linter, cobertura sin medir).
