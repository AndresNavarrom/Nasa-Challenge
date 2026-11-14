# Business Overview

## Propósito

Earth Jukebox (Jukebox Terrestre) es la prueba de concepto del equipo Sagitta para el reto *The Earth Information Jukebox* del NASA Space Apps Challenge 2026. Hace que la ciencia de la Tierra se pueda **ver y escuchar**: combina visualizaciones del Earth Information Center (EIC) de la NASA con sonido generado en tiempo real en el navegador (`VISION-MISION.md`, `README.md`).

La historia de esta versión: **la Amazonía como pulmón del mundo**, contada con tres capas, cada una con su propia voz:

| Capa | Fuente NASA | Cobertura | Voz |
|---|---|---|---|
| Altura del bosque (`forest`) | GEDI, SVS 4950 | Global + Amazonía, fija | Nota en escala pentatónica y armonía |
| Humo de incendios (`smoke`) | GEOS-CF, SVS 5533 | Solo Amazonía, 6 instantes | Aspereza y filtro oscuro |
| CO2 (`co2`) | DYAMOND/GEOS, SVS 5196 | Solo Amazonía, 12 instantes | Ritmo de respiración |

## Funcionalidad clave (prevista y existente)

- Planeta 3D con la capa activa; al enfocar la Amazonía el planeta se aplana en un mapa regional detallado (pendiente: pasos 12-14).
- Sonorización del punto bajo el cursor: valor 0..1 → parámetros de sonido (lógica lista; motor de audio pendiente, paso 10).
- Línea de tiempo común que recorre los instantes de cada capa (lógica lista).
- Funcionamiento local sin internet, servido desde `127.0.0.1` (servidor pendiente, paso 11).
- Accesibilidad con teclado y lector de pantalla (paso 14, pendiente).

Estado por parte: ver la tabla de `README.md` § Status; detalle de componentes en `component-inventory.md`.

## Reglas de dominio que el código respeta

- Los valores son **intensidades relativas** leídas de los colores de los cuadros, no mediciones físicas (`data/SOURCES.md`, comentarios de `tools/prep/src/main.rs`).
- La georreferenciación de las vistas de globo es manual, con error de 1 a 2 grados.
- Humo y CO2 solo existen sobre la Amazonía: fuera de ella el valor es `null` y el volumen es 0.
- El CO2 se presenta como contexto global, no como efecto medido de la Amazonía (`TAREAS.md`).
- Los datos de muestra generados se marcan `sample: true` en el manifiesto.

## Actores y entrega

- Público general y jurado (demo local, sin cuentas).
- Equipo de tres desarrolladores con propiedad por carpetas y una rama por persona (`sonido`, `datos-rust`, `interfaz`), integración a `main` por bloques (`TAREAS.md`). Envío: domingo 15 de noviembre.

## Relevancia para el intent actual (paso 12, interfaz)

El paso 12 (Samuel, rama `interfaz`) construye el planeta que gira con la textura de la capa activa, la transición a la Amazonía (ida y vuelta en 2 s o menos), el mapa regional y la conversión del punto bajo el cursor a longitud/latitud para el sonido. El intent aprobado añade una capa global de aerosoles a partir de datos GEOS-FP cuyos scripts viven en la rama `origin/datos-rust` (`tools/scraping/`), fuera de este árbol; ver riesgos en `code-quality-assessment.md`.
