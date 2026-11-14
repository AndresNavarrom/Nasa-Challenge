# Code Quality Assessment

## Pruebas

| Área | Archivos | Casos | Qué cubren |
|---|---|---|---|
| Interfaz (Vitest, entorno `node`) | `web/src/data/loadManifest.test.ts` | 3 | Carga correcta, archivo faltante o de tamaño erróneo, manifiesto inválido |
| | `web/src/lib/interpolate.test.ts` | 4 | Bilineal, lineal en tiempo, capa estática, bordes |
| | `web/src/lib/timeline.test.ts` | 3 | Fechas por capa, límites, avance con bucle |
| | `web/src/audio/mapping.test.ts` | 3 | Escala pentatónica, monotonía humo/CO2, límites |
| Rust (`cargo test`) | `color.rs`, `grid.rs`, `project.rs` | 5 | Color → valor, reducción de cuadrícula, tamaños, proyecciones |

Total 18 casos, coincide con `TAREAS.md`. Se ejecutan con `docker compose run --rm web-test` y `docker compose run --rm prep-test` (no ejecutados en este escaneo).

Huecos:

- Sin configuración ni umbral de cobertura.
- Sin pruebas de `App.tsx` ni entorno DOM (jsdom/Testing Library ausentes); los componentes 3D del paso 12 no tendrán dónde probarse sin añadirlo o sin extraer lógica pura.
- `pipeline.rs`, `config.rs` (validación), `sample.rs` y `main.rs` (argumentos) sin pruebas.
- `sampleLayerAt` con cambio región↔global no tiene caso propio.

## Linting y formato

- No hay ESLint, Prettier, `rustfmt.toml` ni configuración de clippy. La comprobación estática es `tsc --noEmit` estricto (`npm run typecheck`, también dentro de `npm run build`).
- El estilo es consistente a mano: camelCase/snake_case idiomáticos, comentarios de documentación en inglés.

## CI/CD

- No hay pipeline (ni `.github/workflows` ni equivalente). Pruebas y compilación son manuales en Docker; la integración entre ramas se hace a mano al cierre de cada bloque.

## Documentación

- `README.md` (inglés): estado, estructura, ejecución con y sin Docker, formato de datos, fuentes y límites, declaración de uso de IA. Buena calidad.
- `TAREAS.md` y `VISION-MISION.md` (español): reparto, propiedad de carpetas, riesgos y alcance POC→MVP.
- `data/SOURCES.md` generado con cada archivo, enlace y método.
- Comentarios en código claros, con referencias a requisitos (`FR1.5`, `FR3.x`, `FR7`, `FR9`).

## Manejo de errores y seguridad

- Errores en fronteras bien tratados: `DataLoadError` y `PrepError` con mensajes accionables; `App.tsx` muestra el error con `role="alert"` y lo registra en consola; `fetch-frames.sh` falla con mensaje y limpia `.part`.
- Sin secretos en el código del proyecto. El puerto de desarrollo y el servidor previsto se limitan a `127.0.0.1`.
- `docker-entrypoint.sh` puede necesitar internet si cambia `package-lock.json` (riesgo para la demo sin red, documentado).

## Deuda técnica

| Señal | Ubicación | Impacto para el paso 12 |
|---|---|---|
| Conjunto cerrado `LAYER_IDS` duplicado | `web/src/data/types.ts:4`, `tools/prep/src/config.rs:10`, `web/src/data/loadManifest.ts:70` | Una capa de aerosoles exige cambiar TS y Rust y regenerar datos; carpetas ajenas a Samuel y cambio de formato que requiere acuerdo de los tres |
| Texturas de capas con tiempo solo del primer instante | `tools/prep/src/pipeline.rs` (`prepare_layer`) | Para que imagen y sonido avancen juntos hay que dibujar desde las cuadrículas |
| Humo y CO2 sin cuadrícula global | `web/public/data/manifest.json` (`global: null`) | En el planeta solo el bosque tiene textura y valor fuera de la Amazonía |
| Título "Global CO2" engañoso | `data/prep-config.json` | Corregir y regenerar antes de mostrarlo (`TAREAS.md:95`) |
| Instantes de humo equiespaciados aunque el video no lo está | `manifest.json` (`dates` con tiempos de clip) | Las etiquetas muestran tiempo de clip, no fecha |
| Salto de resolución en el borde de la Amazonía (96×72 regional vs 144×72 global) | `web/src/lib/interpolate.ts` (`sampleLayerAt`) | Posible salto audible/visible al cruzar el borde |
| Carcasa provisional | `web/src/App.tsx` | Se reemplaza en el paso 12 |
| Servidor esqueleto | `server/src/main.rs` | Fuera del paso 12 |
| Sin linter ni CI | raíz | Regresiones solo se detectan ejecutando pruebas a mano |

## Valoración general

Base pequeña, limpia y bien documentada, con lógica pura probada y fronteras validadas. Las debilidades son de proceso (sin CI ni linter, cobertura sin medir) y de contrato (capas cerradas y duplicadas), además de lo que falta por construir (escena, sonido, servidor).
