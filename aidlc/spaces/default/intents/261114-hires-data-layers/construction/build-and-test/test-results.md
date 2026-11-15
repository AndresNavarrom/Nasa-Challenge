# Resultados de pruebas — Mejora de resolución

Ejecutado el 15 de noviembre de 2026 en Docker, rama `interfaz`. Todas las pruebas corren en Node (Vitest con entorno `node`), en pytest y en cargo. Ninguna corre en un navegador.

## Compilación

| Comando | Resultado |
|---|---|
| `docker compose --profile '*' build` | Bien: `earth-jukebox-web:dev`, `earth-jukebox-fetch:dev` y `earth-jukebox-prep:dev` construidas |
| `docker build --target build web` | Bien: `tsc --noEmit && vite build` terminó sin errores |

## Comandos acotados (de `unit-test-instructions.md`)

| Comando | Resultado |
|---|---|
| `docker compose run --rm fetch-test pytest -q tools/fetch/tests/test_geoscf_to_png.py` | 4 pasan, 0 fallan |
| `docker compose run --rm prep-test cargo test --locked --manifest-path tools/prep/Cargo.toml config:: pipeline::` (tal como está escrito) | No corre: cargo rechaza el segundo filtro (`unexpected argument`). No falló ninguna prueba. Es el hallazgo R-01 de la revisión del código, aceptado como riesgo |
| `docker compose run --rm prep-test cargo test --locked --manifest-path tools/prep/Cargo.toml -- config:: pipeline::` (arreglo dentro de esta etapa: `--` antes de los filtros) | 5 pasan, 0 fallan, 5 filtradas |
| `docker compose run --rm web-test npx vitest run src/scene/baseImage.test.ts src/scene/geo.test.ts src/data/loadManifest.test.ts src/lib/interpolate.test.ts src/lib/timeline.test.ts` | 5 archivos; 23 pasan, 0 fallan |

## Conjuntos completos

| Comando | Resultado |
|---|---|
| `docker compose run --rm fetch-test pytest -q tools/fetch/tests` | 7 pasan, 0 fallan |
| `docker compose run --rm prep-test` | 10 pasan, 0 fallan |
| `docker compose run --rm web-test` | 7 archivos; 28 pasan, 0 fallan |

**Total**: 45 pruebas; 45 pasan, 0 fallan, 0 se omiten. Antes de este trabajo había 26 (21 en la app y 5 en prep), y siguen todas en verde.

## Cobertura

No se pide cobertura de líneas (plan `poc`, sin mínimo). No se midió.

## Peso de los datos al arrancar (NFR4)

Medido con `ls -l` sobre `web/public/data/`:

| Conjunto | Bytes |
|---|---|
| Cuadrículas y manifiesto | 27 549 266 |
| Más `earth-8k.jpg` (5 237 119) y `earth-amazon.jpg` (949 730) | 33 736 115 (33,7 MB) |
| Más `earth-4k.jpg` (1 325 376) y `earth-amazon.jpg` | 29 824 372 (29,8 MB) |

Los dos casos quedan por debajo del tope de 60 MB.

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| TC-1 | `code-generation-plan.md` > Testing Contract > strategy_volume | Una prueba por requisito comprobable | Pruebas para FR1.2, FR1.3, FR2.1, FR3, FR4.1, FR4.2, FR4.3, FR5.1, FR5.2 y FR7.2 (19 nuevas) | Este archivo, comandos acotados | build-and-test | Met |
| TC-2 | `code-generation-plan.md` > Testing Contract > strategy_volume | Al menos una prueba del camino feliz por componente con lógica | `geoscf_to_png.py`, `lightning_composite.py`, `config.rs`, `pipeline.rs`, `baseImage.ts` y `geo.ts` tienen la suya | Este archivo, conjuntos completos | build-and-test | Met |
| TC-3 | `code-generation-plan.md` > Testing Contract > scope_floor | Las pruebas que ya existían siguen en verde | 26 de 26 siguen en verde, dentro de 45 de 45 | Este archivo, conjuntos completos | build-and-test | Met |
