# Resumen de compilación y pruebas — Jukebox Terrestre

## Estado general

La base construida (Steps 1 a 9 y 17 de `code-generation-plan.md`, descrita en `code-summary.md`) compila y sus 18 pruebas pasan, todo dentro de contenedores de Docker. Requisito único: Docker Desktop. Los comandos están en `build-instructions.md` y en `unit-test-instructions.md`.

La prueba de concepto no está terminada: faltan los Steps 10 a 16, que hace el equipo.

## Tipos de prueba

| Tipo | Estado |
|---|---|
| Unitarias | 18, todas pasan (13 de la interfaz en Vitest, 5 de la preparación de datos en Rust) |
| Integración, rendimiento, seguridad | No se generaron: la estrategia de pruebas es mínima |
| En navegador | Ninguna. Las pruebas de la interfaz corren en Node; nada se probó en un navegador real, ni la pantalla ni el sonido |

## Cobertura esperada

Sin mínimo de cobertura de líneas (plan `poc`). El objetivo es una prueba por cada pieza con lógica propia, y se cumple en lo construido.

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| TC-1 | `code-generation-plan.md` > Testing Contract > strategy_volume | Una prueba verificable por cada requisito construido que tiene lógica propia | FR1.4, FR1.5, FR7 y FR3.1 a FR3.4 tienen pruebas | `test-results.md` | build-and-test | Met |
| TC-2 | `code-generation-plan.md` > Testing Contract > strategy_volume | Al menos una prueba del camino feliz por componente | Los 5 componentes construidos con lógica tienen la suya | `test-results.md` | build-and-test | Met |
| TC-3 | `code-generation-plan.md` > Testing Contract > scope_floor | El conjunto de pruebas existente se mantiene en verde | 18 de 18 pasan | `test-results.md` | build-and-test | Met |

## Preparación

| Aspecto | Estado |
|---|---|
| Lista para compilar | Sí |
| Lista para probar | Sí, lo construido |
| Lista para la demo | No: faltan el sonido, el planeta, el servidor local y los entregables |

## Pendientes y límites conocidos

- **16 de 29 requisitos sin construir**, detallados en `cross-unit-traceability.md` con el paso del plan y la persona de cada uno.
- **Requisitos no funcionales sin medir**: funcionar sin internet, latencia de audio de 100 ms, 30 cuadros por segundo, arranque en 5 segundos y 10 minutos sin cortes. No se pueden medir hasta que exista la app; quedan para la lista de verificación de la demo.
- **El arranque sin red no se comprobó** con la red cortada.
- **El humo y el CO2 solo cubren la Amazonía**; en el planeta solo el bosque tiene datos globales.
- **Salto posible en el sonido del bosque** al cruzar el borde de la Amazonía, por el cambio de cuadrícula regional a global. Lo debe tener en cuenta quien haga el motor de sonido.
- **El título "Global CO2"** no describe una capa que solo cubre la Amazonía; se cambia en `data/prep-config.json`.
- **Los instantes del humo** se reparten a intervalos iguales aunque sus tiempos en el video son desiguales.
- **Partes de la preparación de datos sin prueba propia**: la lectura de la configuración y la generación de datos de ejemplo se ejercitan al regenerar los datos, no con pruebas unitarias.
- **Contenedor final de la app**: no existe; depende del servidor local.
