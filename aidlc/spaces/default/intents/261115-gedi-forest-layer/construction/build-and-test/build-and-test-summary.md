# Resumen de compilación y pruebas — Bosque con GEDI L3

## Estado general

El trabajo descrito en `code-summary.md` y construido según `code-generation-plan.md` compila y pasa sus 53 pruebas en Docker. Los comandos están en `build-instructions.md` y en `unit-test-instructions.md`; los resultados, en `test-results.md`.

## Tipos de prueba

| Tipo | Estado |
|---|---|
| Unitarias | 53, todas pasan: 11 en pytest, 14 en cargo y 28 en Vitest |
| Integración, rendimiento y seguridad | No se generaron, porque la estrategia es mínima |
| En navegador | Ninguna. El aspecto del bosque se revisa con `docs/PLANET-CHECKLIST.md` |

## Cobertura esperada

No hay mínimo de líneas (plan `poc`). Cada requisito que se puede comprobar fuera del navegador tiene su prueba.

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| TC-1 | `code-generation-plan.md` > Testing Contract > strategy_volume | Una prueba por requisito comprobable | 8 pruebas nuevas, para FR2.1, FR2.2, FR2.3, FR3 y FR4.3 | `test-results.md` | build-and-test | Met |
| TC-2 | `code-generation-plan.md` > Testing Contract > strategy_volume | Al menos una prueba del camino feliz por componente con lógica | Cada componente nuevo tiene la suya | `test-results.md` | build-and-test | Met |
| TC-3 | `code-generation-plan.md` > Testing Contract > scope_floor | Las pruebas que ya existían siguen en verde | 45 de 45 | `test-results.md` | build-and-test | Met |

## Preparación

| Aspecto | Estado |
|---|---|
| Lista para compilar | Sí |
| Lista para probar | Sí, en todo lo que se puede automatizar |
| Lista para unir a `main` | Falta la revisión en el navegador y el aviso a Andres y Fernando |

## Pendientes y límites conocidos

- **Revisión en el navegador:** falta comprobar que el bosque de GEDI coincide con la Amazonía y no deja franjas.
- **FR1.2 sin `~/.netrc` a nivel de Docker:** no se probó, para no mover el archivo del usuario. La comprobación propia del script sí se probó.
- **Memoria (NFR2):** la conversión llegó a 1,5 GB, pero el contenedor corrió sin tope de memoria impuesto.
- **Riesgos aceptados en la revisión del código:**
  - R-01: un alfa 0 ahora cuenta como "sin dato" en todas las capas. Hoy no cambia ninguna otra capa.
  - R-02: si el servidor no manda `Content-Length`, la descarga se borra.
  - R-03: se monta `~/.netrc` entero; conviene que solo tenga la línea de Earthdata.
