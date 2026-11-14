# Resultados de compilación y pruebas — Jukebox Terrestre

Corrida del 14 de noviembre de 2026 sobre la base construida (Steps 1 a 9 y 17 de `code-generation-plan.md`), con los comandos de `build-instructions.md` y de `unit-test-instructions.md`.

## Compilación

| Comando | Resultado |
|---|---|
| `docker compose --profile "*" build` | Correcto: construidas `earth-jukebox-web:dev` y `earth-jukebox-prep:dev` |
| `docker build --target build web` | Correcto: revisión de tipos y empaquetado de la interfaz |

## Pruebas

| Comando | Total | Pasan | Fallan | Omitidas |
|---|---|---|---|---|
| `docker compose run --rm web-test` | 13 | 13 | 0 | 0 |
| `docker compose run --rm prep-test` | 5 | 5 | 0 | 0 |
| `cargo test --manifest-path tools/prep/Cargo.toml` (en la máquina, mismas 5 pruebas) | 5 | 5 | 0 | 0 |

Total de pruebas distintas: 18. Todas pasan.

Detalle de la interfaz (Vitest 3.2.7, corre en Node, no en un navegador):

- `src/lib/interpolate.test.ts`: 4
- `src/lib/timeline.test.ts`: 3
- `src/audio/mapping.test.ts`: 3
- `src/data/loadManifest.test.ts`: 3

Detalle de la preparación de datos (Rust): color a valor con barra de color, brillo como respaldo, reducción a cuadrícula, rechazo de imagen con tamaño inválido, y ubicación de puntos conocidos en las dos proyecciones.

## Comandos que no se corrieron

- `npm --prefix web install` y `npm --prefix web exec -- vitest run …` de `unit-test-instructions.md`: en la máquina no hay Node.js ni npm. Las mismas pruebas corrieron con npm real dentro del contenedor (`web-test`).
- `docker compose run --rm prep`: no se repitió en esta corrida para no reescribir los datos; `code-summary.md` registra que regenera archivos idénticos.

## Fallas

Ninguna.

## Cobertura

No se mide cobertura de líneas: el plan elegido (`poc`) no fija un mínimo y el contrato de pruebas no pide ninguno.

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| TC-1 | `code-generation-plan.md` > Testing Contract > strategy_volume | Una prueba verificable por cada requisito construido que tiene lógica propia | FR1.4 (5 pruebas en Rust), FR1.5 (4), FR7 (3), FR3.1 a FR3.4 (3), más la lectura de datos de FR1.4 y FR2 (3) | `docker compose run --rm web-test` y `docker compose run --rm prep-test` | build-and-test | Met |
| TC-2 | `code-generation-plan.md` > Testing Contract > strategy_volume | Al menos una prueba del camino feliz por componente | Los 5 componentes construidos con lógica tienen la suya: lectura de datos, interpolación, línea de tiempo, mapeo a sonido y preparación de datos | Los mismos dos comandos | build-and-test | Met |
| TC-3 | `code-generation-plan.md` > Testing Contract > scope_floor | El conjunto de pruebas existente se mantiene en verde | 18 de 18 pasan | Los mismos dos comandos | build-and-test | Met |

Los requisitos no funcionales de `requirements.md` que dependen de partes sin construir (funcionar sin internet, latencia de audio, fluidez, tiempo de arranque, estabilidad) no entran en esta matriz: no hay todavía nada que medir. Quedan listados en `build-and-test-summary.md` como pendientes del equipo.
