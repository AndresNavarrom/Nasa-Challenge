# Resultados de compilación y pruebas — Paso 12

Corrida del 14 de noviembre de 2026 en la rama `interfaz`, con los comandos de `build-instructions.md` y `unit-test-instructions.md`.

## Compilación

| Comando | Resultado |
|---|---|
| `docker compose run --rm web-test npm run typecheck` | Sin errores (salida 0) |
| `docker build --target build web` | Correcta |

## Pruebas

| Comando | Total | Pasan | Fallan | Omitidas |
|---|---|---|---|---|
| `docker compose run --rm web-test npx vitest run src/scene/geo.test.ts src/scene/layerTexture.test.ts` | 8 | 8 | 0 | 0 |
| `docker compose run --rm web-test` | 21 | 21 | 0 | 0 |

Detalle de la corrida completa (Vitest 3.2.7, en Node, no en un navegador): `geo.test.ts` 6, `layerTexture.test.ts` 2, `interpolate.test.ts` 4, `timeline.test.ts` 3, `mapping.test.ts` 3, `loadManifest.test.ts` 3.

## Fallas

Ninguna.

## Cobertura

No se mide cobertura de líneas: el plan `poc` no fija mínimo y el contrato de pruebas no pide ninguno.

## Comprobaciones que no se pudieron correr

Aquí no hay un navegador real con WebGL, así que quedan sin comprobar y van en `docs/PLANET-CHECKLIST.md`:

- el aspecto del planeta y que la capa coincida con la imagen base (FR1.1, FR1.2);
- la transición de ida y vuelta en 2 segundos o menos, vista en pantalla (FR2.1, FR2.2);
- los 30 cuadros por segundo (NFR1);
- que nada se cargue de internet (NFR2).

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| TC-1 | `code-generation-plan.md` > Testing Contract > strategy_volume | Una prueba por cada función pura nueva con requisito | 8 pruebas para FR4.1, FR4.2, FR4.3, FR2.1, FR1.2 y FR1.3 | Comando acotado: 8 de 8 | build-and-test | Met |
| TC-2 | `code-generation-plan.md` > Testing Contract > strategy_volume | Al menos una prueba del camino feliz por componente con lógica | `geo.ts` y `layerTexture.ts` tienen la suya; los componentes de escena no tienen lógica pura aparte | Comando acotado: 8 de 8 | build-and-test | Met |
| TC-3 | `code-generation-plan.md` > Testing Contract > scope_floor | Las pruebas existentes siguen en verde | 13 de 13 anteriores pasan, 21 de 21 en total | `docker compose run --rm web-test` | build-and-test | Met |
