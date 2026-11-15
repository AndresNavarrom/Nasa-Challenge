# Resumen de código — Bosque con datos reales de GEDI L3

Construido según `code-generation-plan.md`; los 12 pasos están hechos y marcados. Rama `interfaz`, sin commit ni push.

## Archivos creados

- `tools/fetch/gedi_l3_to_png.py`: conversión de EASE-Grid 2.0 a un PNG RGBA de 0,1° (3600 × 1800). Tiene funciones puras y un `main` (FR2).
- `tools/fetch/fetch-gedi.sh`: descarga con la cuenta de Earthdata, comprueba el tamaño y convierte (FR1).
- `tools/fetch/tests/test_gedi_l3_to_png.py`: 4 pruebas.

## Archivos modificados

- `tools/fetch/requirements.txt`: `tifffile==2024.9.20`, `imagecodecs==2024.9.22` y `pyproj==3.7.0`.
- `docker-compose.yml`: el servicio `fetch-gedi` (perfil `data`). Monta `${HOME}/.netrc` en `/root/.netrc` en solo lectura, con `create_host_path: false`. Su línea está en el encabezado.
- `tools/fetch-frames.sh` y `data/SOURCES.md`: la fuente GEDI L3 V3 (DOI 10.3334/ORNLDAAC/2525), la escala de 0 a 50 m, SVS 4950 como relleno y el comando `fetch-gedi`.
- `tools/prep/src/config.rs`:
  - `ViewConfig.value`, opcional, y `ViewConfig.fallback`;
  - `ValueConfig::validate`;
  - cada instante debe tener al menos una vista principal.
- `tools/prep/src/pipeline.rs`:
  - las vistas se cargan en RGBA, y alfa 0 cuenta como "sin dato";
  - el método de valor se toma por vista;
  - el relleno no se mezcla ni en cada muestra ni al reducir a la cuadrícula;
  - `coverage_report`;
  - cache con `Rc<RgbaImage>`.
- `data/prep-config.json`: la capa `forest` tiene como vista principal la imagen de GEDI, con `brightness` 0..1. Las 14 vistas 4K de SVS 4950 quedan con `fallback: true`. La fecha es "Apr 2019 - Jul 2025".
- `docs/PLANET-CHECKLIST.md`: una línea para revisar en el navegador el bosque de GEDI.
- `web/public/data/`: `forest_global.bin`, `forest_global.png`, `forest_region.bin`, `forest_region.png` y `manifest.json`. Los archivos de humo, rayos y planeta quedaron idénticos byte a byte.

## Decisiones clave

- **GeoTIFF real**:
  - EPSG:6933, declarado en la GeoKey 3072;
  - píxel de 1000,895 m;
  - "sin dato" = −9999;
  - 34 704 × 14 616 en float32, en mosaicos de 256 × 256 con LZW.
- **Lectura por mosaicos** con `page.segments()`. La conversión rechaza un EPSG distinto de 6933.
- **Escala**: `floor(clip(h, 0, 50)/50·255 + 0.5)`. 0 m da 0, 25 m da 128 y 50 m o más da 255.
- **Relleno a dos niveles (FR3)**:
  - En cada muestra deciden primero las vistas principales.
  - Al reducir a la cuadrícula, una celda que tiene al menos una muestra de GEDI usa solo GEDI.

## Desvíos del plan

1. La reducción a la cuadrícula también prefiere GEDI. Precisa FR3 y no agrega alcance.
2. `ValueConfig::validate` y la regla de "al menos una vista principal" se añadieron en `config.rs`.
3. La conversión comprueba la GeoKey de proyección.
4. Prep guarda las imágenes en cache con `Rc` para no duplicar las 14 imágenes 4K.
5. El filtro acotado `-- fallback` selecciona también una prueba que ya existía en `color.rs`, así que da 5 pruebas y no 4.

## Resultados de pruebas

| Corredor | Antes | Acotado | Completo |
|---|---|---|---|
| fetch-test (pytest) | 7 pasan | 4 pasan | 11 pasan |
| prep-test (cargo) | 10 pasan | 5 pasan | 14 pasan |
| web-test (Vitest) | 28 pasan | — | 28 pasan |

`docker build --target build web` compila sin errores.

## Descarga, memoria y cobertura

- **Descarga (FR1.1)**: se bajaron 616 958 182 bytes, igual al `Content-Length`. La descarga más la conversión tardó 1 min 45 s.
- **Memoria (NFR2)**: el pico del proceso de conversión fue de 1 543 MB, por debajo de 4 GB. El contenedor no tenía un tope de memoria impuesto.
- **Conversión**: 1 039 236 de 6 480 000 celdas de 0,1° tienen dato de GEDI.
- **Cobertura (FR4.3)**:
  - En el globo, 76,3 % GEDI y 23,7 % relleno, sobre 228 398 celdas con dato.
  - En la Amazonía, **99,0 % GEDI** y 1,0 % relleno, sobre 86 984 celdas con dato. El umbral era 90 %.
- **Tamaños (NFR4, FR4.1)**: `forest_global.bin` pesa 1 036 800 bytes y `forest_region.bin` 100 800. El archivo de datos declara 1440 × 720 y 360 × 280.

## Cuenta fuera del repositorio y de la imagen (FR1.3)

- `git ls-files --cached --others --exclude-standard '*netrc*'` no da nada.
- `git grep` de líneas con formato netrc no encuentra credenciales.
- `docker history --no-trunc earth-jukebox-fetch:dev` no menciona `netrc`.
- `/root` de la imagen tiene solo los archivos de la imagen base.

## Pruebas no ejecutadas

- **FR1.2 en el nivel de Docker** (el servicio `fetch-gedi` sin `~/.netrc`): no se probó, para no mover el archivo del usuario. Sí se probó la comprobación del propio script: sin la cuenta montada sale con código 1 y el mensaje "the Earthdata login file is missing: /root/.netrc".
- **Fallo de permisos 401/403**: no ocurrió, así que ese camino no se ejecutó.
- **Revisión en el navegador** (que el bosque coincida con la Amazonía y no deje franjas): queda en `docs/PLANET-CHECKLIST.md`.

## Borrador del aviso a Andres y Fernando (no enviado)

> Hola Andres y Fernando: en la rama `interfaz` la capa de bosque ya sale de datos reales de GEDI L3 Versión 3 (altura media del dosel, rh100, abril de 2019 a julio de 2025, DOI 10.3334/ORNLDAAC/2525), en lugar de los colores del video de SVS 4950. La escala es fija: 0 m abajo y 50 m o más arriba. SVS 4950 queda solo como relleno donde GEDI no tiene medición (sobre todo más allá de unos 52° N y S), sin mezclarse con GEDI. En la Amazonía, el 99 % de las celdas sale de GEDI; en el globo, el 76 %. El formato y el tamaño de los datos no cambian, así que la app y el sonido no cambian. Para regenerar todo: `docker compose run --rm fetch`, `docker compose run --rm fetch-gedi` (pide una cuenta de Earthdata en `~/.netrc`; solo hace falta para volver a bajar GEDI) y `docker compose run --rm prep`. Antes de unir a `main`, ¿pueden revisar en el navegador la línea nueva de `docs/PLANET-CHECKLIST.md`?
