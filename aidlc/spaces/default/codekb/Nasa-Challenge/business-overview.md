# Business Overview

## Propósito

Earth Jukebox (Jukebox Terrestre) es la prueba de concepto del equipo Sagitta para el reto *The Earth Information Jukebox* del NASA Space Apps Challenge 2026. Hace que la ciencia de la Tierra se pueda **ver y escuchar**: combina visualizaciones del Earth Information Center (EIC) de la NASA con sonido generado en tiempo real en el navegador (`VISION-MISION.md`, `README.md`).

La historia de esta versión: **la Amazonía como pulmón del mundo**, contada con capas, cada una con su propia voz. Estado de los datos preparados en `web/public/data/manifest.json` (commit `baf3033`):

| Capa | Fuente NASA | Cobertura actual | Voz |
|---|---|---|---|
| Altura del bosque (`forest`) | GEDI, SVS 4950 (14 vistas de globo) | Global 144×72 + Amazonía 96×72, fija | Nota en escala pentatónica y armonía |
| Humo de incendios (`smoke`) | GEOS-CF, SVS 5533 (cuadros de mapa plano) | Solo Amazonía, 6 instantes | Aspereza y filtro oscuro |
| CO2 (`co2`) | DYAMOND/GEOS, SVS 5196 (globo en órbita) | Solo Amazonía, 12 instantes | Ritmo de respiración |

## Funcionalidad clave (prevista y existente)

- Planeta 3D con la capa activa y transición a un mapa regional de la Amazonía: existe en `web/src/scene/` (ver `component-inventory.md`, Planet Scene).
- Sonorización del punto bajo el cursor: valor 0..1 → parámetros de sonido (lógica lista; motor de audio pendiente, paso 10).
- Línea de tiempo común que recorre los instantes de cada capa (lógica lista; la escena dibuja hoy solo el primer instante).
- Funcionamiento local sin internet, servido desde `127.0.0.1` (servidor pendiente, paso 11).
- Accesibilidad con teclado y lector de pantalla (paso 14, pendiente).

Estado por parte: ver la tabla de `README.md` § Status; detalle de componentes en `component-inventory.md`.

## Reglas de dominio que el código respeta

- Los valores son **intensidades relativas** leídas de los colores de los cuadros, no mediciones físicas (`data/SOURCES.md`, comentarios de `tools/prep/src/main.rs`).
- La georreferenciación de las vistas de globo es manual, con error de 1 a 2 grados.
- Humo y CO2 solo existen sobre la Amazonía: fuera de ella el valor es `null` y el volumen es 0.
- El CO2 se presenta como contexto global, no como efecto medido de la Amazonía (`TAREAS.md`).
- Los datos de muestra generados se marcan `sample: true` en el manifiesto.
- La imagen base del planeta (SVS 3615) es solo fondo: no lleva valores.

## Actores y entrega

- Público general y jurado (demo local, sin cuentas).
- Equipo de tres desarrolladores con propiedad por carpetas y una rama por persona (`sonido`, `datos-rust`, `interfaz`), integración a `main` por bloques (`TAREAS.md`). Envío: domingo 15 de noviembre.

## Relevancia para el intent actual (hires-data-layers)

El intent sube la resolución del planeta y de sus capas con datos reales: imagen base Natural Earth 10 m en color (globo 8192×4096 y recorte de alta resolución de la Amazonía), humo desde GEOS-CF v2 PM2.5 (NetCDF global 1440×721), una capa de rayos (SVS 5011, video de esfera equirectangular) que reemplaza a `co2`, bosque desde los cuadros 4K de SVS 4950 y cuadrículas globales de 1440×720. Lo que el código permite y bloquea hoy está en `architecture.md` (Key Design Decisions) y `code-quality-assessment.md` (Deuda técnica); en resumen: prep solo lee imágenes, limita las cuadrículas a 1024 celdas por lado y fija `earth.jpg` en 2048×1024, y el id `co2` está fijado en Rust y TypeScript.

## Relevancia para el intent anterior (paso 12, interfaz)

El paso 12 (Samuel, rama `interfaz`) construyó el planeta que gira con la textura de la capa activa, la transición a la Amazonía, el mapa regional y la conversión del punto bajo el cursor a longitud/latitud para el sonido. Los scripts GEOS-FP que entonces vivían en `origin/datos-rust` ya están en este árbol (`tools/scraping/`).
