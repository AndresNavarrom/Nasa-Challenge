# Cobertura final de requisitos — Jukebox Terrestre

Este trabajo no se dividió en unidades; la cobertura es de toda la base construida, según `code-summary.md` y `code-generation-plan.md`.

## Veredicto

**No pasa: 13 de 29 requisitos están construidos y 16 no.** Los 16 no construidos corresponden a los Steps 10 a 16 del plan, que el equipo decidió hacer por su cuenta ("en el paso 8 frena el agente, para poder poner al resto de mis compañeros el plan para elaborar tambien"; "dale, para el 9"). No es un defecto de la base, pero la prueba de concepto no está completa hasta que esos pasos existan.

## Requisitos construidos

| ID | Etapa | Archivo |
|---|---|---|
| FR1.1 | code-generation | `web/public/data/manifest.json` |
| FR1.2 | code-generation | `web/public/data/manifest.json` |
| FR1.3 | code-generation | `web/public/data/manifest.json` |
| FR1.4 | code-generation | `tools/prep/src/pipeline.rs` |
| FR1.5 | code-generation | `web/src/lib/interpolate.ts` |
| FR3.1 | code-generation | `web/src/audio/mapping.ts` |
| FR3.2 | code-generation | `web/src/audio/mapping.ts` |
| FR3.3 | code-generation | `web/src/audio/mapping.ts` |
| FR3.4 | code-generation | `web/src/audio/mapping.ts` |
| FR7 | code-generation | `web/src/lib/timeline.ts` |
| FR10.3 | code-generation | `README.md` |
| FR10.4 | code-generation | `README.md` |
| NFR7 | code-generation | `web/src/audio/mapping.test.ts` |

De FR3.1 a FR3.4 y de FR7 existe el cálculo, no lo que se oye ni lo que se ve: el motor de sonido y la línea de tiempo en pantalla son de los pasos pendientes.

## Requisitos sin construir

| ID | Qué es | Paso del plan | Quién |
|---|---|---|---|
| FR2 | La app funciona con los datos empaquetados y sin red | 11, 15 | Fernando |
| FR4 | Las capas suenan a la vez sin saturar | 10 | Samuel |
| FR5.1 | Panel lateral de capas | 13 | Andres Navarro |
| FR5.2 | Transición del planeta a la Amazonía | 12 | Andres Navarro |
| FR6 | Sonido al pasar el cursor o hacer clic | 10, 12 | Samuel y Andres Navarro |
| FR8 | Modo historia | 13 | Andres Navarro |
| FR9.1 | Uso con teclado | 14 | Andres Navarro |
| FR9.2 | Descripciones para lector de pantalla | 14 | Andres Navarro |
| FR10.1 | Video de 30 segundos | fuera del plan de código | Danna |
| FR10.2 | Formulario completo en inglés | 16 | Danna y Fernando |
| NFR1 | Demostración sin internet | 15 | Fernando |
| NFR2 | Latencia de audio de 100 ms o menos | 10 | Samuel |
| NFR3 | 30 cuadros por segundo o más | 12 | Andres Navarro |
| NFR4 | Arranque en 5 segundos o menos; datos de 200 MB o menos | 15 | Fernando |
| NFR5 | 10 minutos de uso sin cortes | 10 | Samuel |
| NFR6 | Sin claves en el repositorio ni datos personales | 11, 16 | Fernando |

Sobre NFR4: los datos preparados pesan 1,2 MB, muy por debajo de 200 MB; el tiempo de arranque no se puede medir sin la app.
