# Resumen de compilación y pruebas — Paso 12

## Estado general

El paso 12 (descrito en `code-summary.md`, construido según `code-generation-plan.md`) compila, pasa la revisión de tipos y sus 8 pruebas nuevas pasan junto con las 13 anteriores, todo en Docker. Comandos en `build-instructions.md` y `unit-test-instructions.md`.

## Tipos de prueba

| Tipo | Estado |
|---|---|
| Unitarias | 21, todas pasan (8 nuevas de coordenadas y textura) |
| Integración, rendimiento, seguridad | No se generaron: estrategia mínima |
| En navegador | Ninguna. Las pruebas corren en Node; lo visual se revisa con `docs/PLANET-CHECKLIST.md` |

## Cobertura esperada

Sin mínimo de cobertura de líneas (plan `poc`). Una prueba por cada función pura nueva: se cumple.

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| TC-1 | `code-generation-plan.md` > Testing Contract > strategy_volume | Una prueba por cada función pura nueva con requisito | 8 pruebas para FR4.1, FR4.2, FR4.3, FR2.1, FR1.2 y FR1.3 | `test-results.md` | build-and-test | Met |
| TC-2 | `code-generation-plan.md` > Testing Contract > strategy_volume | Al menos una prueba del camino feliz por componente con lógica | `geo.ts` y `layerTexture.ts` tienen la suya | `test-results.md` | build-and-test | Met |
| TC-3 | `code-generation-plan.md` > Testing Contract > scope_floor | Las pruebas existentes siguen en verde | 21 de 21 | `test-results.md` | build-and-test | Met |

## Preparación

| Aspecto | Estado |
|---|---|
| Lista para compilar | Sí |
| Lista para probar | Sí, lo automatizable |
| Lista para la decisión de las 11:00 p.m. | Falta la revisión en el navegador del portátil de la demo |

## Pendientes y límites conocidos

- **Sin comprobar en un navegador real**: aspecto, transición en 2 segundos o menos, 30 cuadros por segundo y que nada se cargue de internet.
- **Punto escuchado con el cursor quieto**: el valor y el punto solo se recalculan al mover el cursor; con el planeta girando solo quedan viejos.
- **Plan B incompleto**: `?lite=1` es el primer escalón; el planeta fijo sin giro no existe.
- **Contador de cuadros**: promedia cada segundo y puede esconder una caída durante la transición; conviene mirar también el monitor de rendimiento del navegador.
- **Capa `aerosol`**: pendiente de Andres Navarro.
- **Rama `interfaz`**: salió de la `main` anterior a la PR #1; hay que traer `main` antes de unirla.
