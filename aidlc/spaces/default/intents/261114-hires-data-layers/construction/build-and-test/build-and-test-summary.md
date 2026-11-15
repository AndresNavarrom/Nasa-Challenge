# Resumen de compilación y pruebas — Mejora de resolución

## Estado general

El trabajo descrito en `code-summary.md` y construido según `code-generation-plan.md` compila, pasa la revisión de tipos y aprueba sus 45 pruebas en Docker. De ellas, 19 son nuevas y 26 ya existían. Los comandos están en `build-instructions.md` y en `unit-test-instructions.md`; los resultados, en `test-results.md`.

## Tipos de prueba

| Tipo | Estado |
|---|---|
| Unitarias | 45, todas pasan: 7 en pytest, 10 en cargo y 28 en Vitest |
| Integración, rendimiento y seguridad | No se generaron porque la estrategia es mínima |
| En navegador | Ninguna. Las pruebas corren en Node; lo visual se revisa con `docs/PLANET-CHECKLIST.md` |

## Cobertura esperada

No hay mínimo de cobertura de líneas (plan `poc`). Hay una prueba por cada requisito comprobable fuera del navegador, y se cumple.

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| TC-1 | `code-generation-plan.md` > Testing Contract > strategy_volume | Una prueba por requisito comprobable | 19 pruebas nuevas para FR1.2, FR1.3, FR2.1, FR3, FR4.1, FR4.2, FR4.3, FR5.1, FR5.2 y FR7.2 | `test-results.md` | build-and-test | Met |
| TC-2 | `code-generation-plan.md` > Testing Contract > strategy_volume | Al menos una prueba del camino feliz por componente con lógica | Cada componente nuevo tiene la suya | `test-results.md` | build-and-test | Met |
| TC-3 | `code-generation-plan.md` > Testing Contract > scope_floor | Las pruebas que ya existían siguen en verde | 26 de 26 | `test-results.md` | build-and-test | Met |

## Preparación

| Aspecto | Estado |
|---|---|
| Lista para compilar | Sí |
| Lista para probar | Sí, en lo que se puede automatizar |
| Lista para unir a `main` | Todavía no. Falta la revisión en el navegador y avisar a Andres y Fernando |

## Pendientes y límites conocidos

- **Sin comprobar en un navegador real** (solo se revisa con `docs/PLANET-CHECKLIST.md`):
  - la nitidez de la imagen de 8192 y del recorte (FR1.1, FR1.3);
  - que la app use la imagen de 4096 cuando la tarjeta no acepta 8192 (FR1.2 en pantalla);
  - 30 cuadros por segundo y la app lista en 5 s o menos (NFR3);
  - el bosque alineado con los ríos (FR6);
  - que funcione sin internet (NFR2).
- **El comando acotado de Rust** de `unit-test-instructions.md` no corre tal como está escrito: le falta `--` (R-01, aceptado como riesgo). La forma que funciona está en `test-results.md`.
- **Rayos**: el valor es una frecuencia relativa, promediada a partir del color de 250 cuadros del video (R-03).
- **Descargas**: solo se comprueba que el archivo no esté vacío. Si uno queda dañado, se vuelve a bajar con `FORCE=1` (R-02).
- **Bosque**: hay triángulos de valor bajo cerca de los ±55–60° de latitud, y el bosque cubre el 79 % de la Amazonía.
- **Motor de sonido**: `co2ToBreath` ya no recibe datos y `lightning` todavía no suena. Está fuera de este trabajo y hay que avisarle a Fernando.
