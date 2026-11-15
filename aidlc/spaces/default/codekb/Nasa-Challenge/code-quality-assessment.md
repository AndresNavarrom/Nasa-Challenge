# Evaluación de calidad — Earth Jukebox

## Pruebas

| Componente | Framework | Cantidad | Comando |
|---|---|---|---|
| earth-jukebox-web | Vitest (node) | 7 archivos, 28 casos | `docker compose run --rm web-test` |
| jukebox-prep | cargo test | 10 pruebas | `docker compose run --rm prep-test` |
| fetch-tools | pytest | 7 pruebas | `docker compose run --rm fetch-test` |
| jukebox-server, scraping-tools | — | 0 | — |

Sin configuración de cobertura. Las pruebas cubren funciones puras (interpolación, línea de tiempo, mapeo a sonido, geometría, texturas, validación del manifiesto, reducción a cuadrícula, color, proyecciones, conversiones de fetch); los componentes 3D se verifican a mano con `docs/PLANET-CHECKLIST.md`.

## Calidad rápida

| Criterio | Nota | Evidencia |
|---|---|---|
| Claridad de nombres | buena | nombres descriptivos en los tres lenguajes |
| Tamaño de funciones | aceptable | `render()` y `prepare_layer()` en `pipeline.rs`, `SceneContents`/`EarthMesh` largos |
| Manejo de errores | buena | errores tipados con mensaje para la persona; sin silencios |
| Presencia de pruebas | aceptable | lógica pura probada; escena 3D y E/S sin pruebas automáticas |
| Duplicación | aceptable | `LAYER_IDS` y formato del manifiesto duplicados Rust/TS a propósito |
| Código muerto | aceptable | `co2` y archivos `co2_region.*`, `earth.jpg` sin uso; `server/` esqueleto |

## Linting y CI

- Sin ESLint, Prettier, rustfmt ni Ruff configurados; `tsc --noEmit` estricto como única verificación estática.
- Sin pipeline de CI; ninguna marca TODO/FIXME/HACK ni supresiones de linter.

## Documentación

README amplio pero desactualizado (dice que `fetch-frames.sh` no corre en contenedor, cita SVS 5533/3615 y `earth.jpg`, dice que humo y CO2 son solo de la Amazonía, omite rayos). `data/SOURCES.md` al día. Comentarios de módulo claros.

## Deuda técnica

- `server/` sin implementar; `web/src/audio/engine.ts` y `run-demo.sh` citados pero inexistentes.
- `pipeline.rs` (491 líneas) mezcla responsabilidades; render por vecino más cercano y repetido para cuadrícula y textura.
- Un solo método de valor por capa y regla de "mejor vista": no permite combinar fuentes con prioridad (bloquea el relleno de GEDI L3 con SVS 4950).
- "Sin dato" y 0 se confunden en las cuadrículas (`grid.rs` `quantize`; `sampleLayerAt` devuelve 0).
- La capa de bosque actual es intensidad relativa leída de un globo renderizado, georreferenciado a mano (1 a 2 grados de error).

## Riesgos para el intent GEDI L3

- **Lectura del GeoTIFF**: EASE-Grid 2.0 global (EPSG:6933), 1 km, float32, del orden de 34704×14616 píxeles (unos 2 GB en memoria). Pillow lo rechaza por defecto (`DecompressionBombError`) y puede fallar con TIFF en mosaico comprimido en modo `F`; preferir `tifffile`+`imagecodecs` o `rasterio`, lectura por franjas, georreferencia desde las etiquetas GeoTIFF.
- **Reproyección**: promediar por celda (0.25° global, 0.1° región) los píxeles válidos, con x, y de la cilíndrica de áreas iguales; descartar nodata.
- **Escala**: metros / 50 recortado a 0..1 para coincidir con la barra 0–50 m de SVS 4950 usada como relleno.
- **Relleno fuera de ±52°**: requiere cambio en `prep` (prioridad entre fuentes o método por vista); hoy una vista `equirect` gana siempre la "mejor vista" y deja sin dato donde GEDI no mide.
- **Credenciales**: montar `~/.netrc` solo en `fetch`, en solo lectura, con sintaxis larga y `create_host_path: false` (la corta crea un directorio si falta el archivo); cookie jar en `/tmp`; nunca imprimir el archivo; la imagen no debe copiarlo.
- **Datos no verificados**: URL, nombre de archivo, valor nodata y compresión de GEDI L3 V3 en ORNL DAAC no se comprobaron (escaneo sin red).
