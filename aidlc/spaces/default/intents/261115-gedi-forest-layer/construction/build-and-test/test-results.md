# Resultados de pruebas — Bosque con GEDI L3

Ejecutado el 15 de noviembre de 2026 en Docker, rama `interfaz`. Las pruebas corren en pytest, cargo y Vitest (entorno `node`). Ninguna corre en un navegador.

## Compilación

| Comando | Resultado |
|---|---|
| `docker compose --profile '*' build` | Bien: las imágenes `fetch`, `prep` y `web` se construyeron |
| `docker build --target build web` | Bien: `tsc --noEmit && vite build` terminó sin errores |

## Comandos acotados (de `unit-test-instructions.md`)

| Comando | Resultado |
|---|---|
| `docker compose run --rm fetch-test pytest -q tools/fetch/tests/test_gedi_l3_to_png.py` | 4 pasan, 0 fallan |
| `docker compose run --rm prep-test cargo test --locked --manifest-path tools/prep/Cargo.toml -- fallback` | 5 pasan, 0 fallan, 9 filtradas. Son las 4 pruebas nuevas más una que ya existía y también lleva `fallback` en el nombre |

## Conjuntos completos

| Comando | Resultado |
|---|---|
| `docker compose run --rm fetch-test` | 11 pasan, 0 fallan |
| `docker compose run --rm prep-test` | 14 pasan, 0 fallan |
| `docker compose run --rm web-test` | 7 archivos, 28 pasan, 0 fallan |

**Total:** 53 pruebas, todas pasan. 8 son nuevas; las 45 que ya existían siguen en verde.

## Cobertura de código

No hay mínimo de líneas (plan `poc`). No se midió.

## Comprobaciones de datos y de la cuenta

- **Peso de los datos (NFR4):** `forest_global.bin` pesa 1 036 800 bytes y `forest_region.bin` pesa 100 800, medidos con `ls -l`.
- **Cobertura (FR4.3):** en la Amazonía el 99,0 % de las celdas sale de GEDI; en el globo, el 76,3 %. Son los datos de la corrida de `prep` de la generación de código; ver `code-summary.md`.
- **Cuenta (FR1.3):**
  - `git ls-files --cached --others --exclude-standard '*netrc*'` no devuelve nada;
  - `docker history --no-trunc earth-jukebox-fetch:dev` no menciona `netrc` (0 coincidencias).

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| TC-1 | `code-generation-plan.md` > Testing Contract > strategy_volume | Una prueba por requisito comprobable | Pruebas para FR2.1, FR2.2, FR2.3, FR3 y FR4.3 (8 nuevas) | Este archivo, comandos acotados | build-and-test | Met |
| TC-2 | `code-generation-plan.md` > Testing Contract > strategy_volume | Al menos una prueba del camino feliz por componente con lógica | `gedi_l3_to_png.py` y el relleno de `pipeline.rs` tienen la suya | Este archivo, conjuntos completos | build-and-test | Met |
| TC-3 | `code-generation-plan.md` > Testing Contract > scope_floor | Las pruebas que ya existían siguen en verde | 45 de 45 | Este archivo, conjuntos completos | build-and-test | Met |
