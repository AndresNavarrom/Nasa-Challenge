## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-14T00:00:00Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | aidlc/spaces/default/intents/261114-hires-data-layers/construction/code-generation/unit-test-instructions.md > línea 30, comando acotado de prep-test | El comando acotado sigue sin el `--` antes de los filtros (`config:: pipeline::`). El propio resumen reconoce que así falla con `unexpected argument 'pipeline::' found`. Quien siga las instrucciones tropieza con el mismo error. | Corregir la línea con `... tools/prep/Cargo.toml -- config:: pipeline::`, como ya figura en el resumen. | New |
| R-02 | Minor | tools/fetch-frames.sh > función `download` y extracción del TIFF de Natural Earth | Las descargas (zip de 324 MB, 24 NetCDF, 14 TIFF) no se verifican más que por `curl -f` y por que el archivo no esté vacío. Un archivo truncado pero no vacío que acabara en `data/raw/` se tomaría luego por bueno gracias a `have`. El `.part` y el `mv` reducen el riesgo, pero no lo eliminan. Los errores del límite de red sí se tratan bien: `set -e`, `pipefail`, `MIN_FRAMES=240`, reintentos y límite de tiempo. | Opcional para un POC: anotar el tamaño o el hash esperado de los archivos grandes, o decir en el encabezado que `FORCE=1` es la salida si un archivo queda corrupto. | New |
| R-03 | Minor | tools/fetch/lightning_composite.py y data/prep-config.json > capa `lightning`, `value` (`low` 0, `high` 0.2) | La capa de rayos sale de la media de "amarillez" de 250 cuadros de un video de ventana móvil. Es una frecuencia relativa derivada del color, no un conteo. La descripción de la capa y `SOURCES.md` lo dicen con claridad, y el desvío del requisito FR5.1 (el último cuadro no acumula) está justificado y documentado. El techo 0,2 depende del percentil observado. Si la fuente se regenera, el techo puede dejar de coincidir. | Ninguna acción bloqueante. Recordar en el aviso a Fernando que el valor es relativo, como ya dice el borrador. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Revisión de código (sin ejecutar nada) | Las convenciones de coordenadas son consistentes. | El recorte del sombreador usa `cropUv = ((lon-west)/(east-west), (lat-south)/(north-south))`. Coincide con `regionUv` en `geo.ts`: v crece hacia el norte, que es lo que da el `flipY=true` de TextureLoader con `earth-amazon.jpg`. La capa regional sigue usando `(north-lat)/(north-south)`, con la fila norte primero. `crop_rect` da 6000, 4920, 2160 × 1680 en el TIFF de 21600 × 10800, con una prueba que lo comprueba. |
| Revisión de `geoscf_to_png.py` | 721 a 720 y medio cuadro de longitud correctos. | Cada celda es la media de un bloque de 2 × 2: filas k y k+1 (centro a −90 + 0,25·(k+0,5)) y columnas i e i+1 mediante `np.roll(-1)` sobre el eje de longitud. Después se invierte a fila norte primero. El centro cae a −180 + 0,25·i + 0,125, como exige el formato. Escala lineal fija 0..150, con relleno y NaN en 0. Los errores de apertura de archivo y de variable ausente se tratan. |
| Revisión de `fetch-frames.sh` y de los cuadros del bosque | Numeración y proyección coherentes. | Cuadro = segundo × 60 + 1 (3,3 s da 199; 46,5 s da 2791). `cx`, `cy` y `radius` valen exactamente el doble que en 1080p. La vista 14 pasa de 146,70 a 147,65 por 0,13 s × 7,12°/s, ≈ 147,63: correcto. No hay credenciales ni direcciones externas en `web/src`. |
| Revisión de `config.rs` y `EarthScene.tsx` | Entradas validadas. | Tope de rejilla 2048, tamaños de la imagen base entre 512 × 256 y 16384, y `region_file` limitado a un nombre `.jpg` sin separadores. `pickBaseImage` cae a 4K si no puede leer el límite de textura, y `?lite=1` usa siempre 4K. Si falla una imagen se informa y la escena sigue. `LAYER_IDS` es igual en ambas copias. |
| Pruebas (web-test, prep-test, fetch-test) | No las volví a ejecutar. | Me baso en los resultados del resumen: 28 de Vitest, 10 de cargo y 7 de pytest. Esta pasada no tiene permiso de escritura. La nitidez, los 30 cuadros por segundo y la alineación del bosque quedan para el navegador, y están en `docs/PLANET-CHECKLIST.md`. |

### Summary

No encontré defectos de corrección ni requisitos incumplidos: el recorte, el volteo de texturas, la conversión 721 a 720 con medio cuadro de longitud y la escala del humo son coherentes entre el script, `prep` y el sombreador. Los cuatro desvíos documentados (rayos por media de cuadros, `PM25_RH35`, `--` en cargo, cuadro 2999) están justificados y no contradicen los requisitos. Solo quedan tres menores: el comando de pruebas de `unit-test-instructions.md`, la falta de verificación de integridad en las descargas y el carácter relativo del valor de los rayos.
