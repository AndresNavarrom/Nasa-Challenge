# Instrucciones de pruebas unitarias — Bosque con GEDI L3

Estrategia mínima (plan `poc`): una prueba por requisito comprobable fuera del navegador y al menos una del camino feliz por componente con lógica. Todo corre en Docker.

## Corredores y configuración

| Parte | Corredor | Configuración |
|---|---|---|
| Conversión de GEDI L3 (`tools/fetch/`) | pytest, imagen `earth-jukebox-fetch` | `tools/fetch/requirements.txt` con versiones fijas; servicio `fetch-test` (perfil `test`) |
| Preparación de datos (`tools/prep/`) | `cargo test` | La que ya existe: servicio `prep-test` |
| App (`web/`) | Vitest | Sin cambios; solo se corre todo el conjunto para comprobar que sigue en verde |

## Comandos acotados a este trabajo

Antes de la primera prueba nueva, reconstruir la imagen de descarga:

```bash
docker compose --profile '*' build fetch-test
```

Conversión de GEDI L3 (FR2.1, FR2.2, FR2.3):

```bash
docker compose run --rm fetch-test pytest -q tools/fetch/tests/test_gedi_l3_to_png.py
```

Relleno, vistas con método propio e informe de cobertura en prep (FR3, FR4.3). El `--` va antes del filtro:

```bash
docker compose run --rm prep-test cargo test --locked --manifest-path tools/prep/Cargo.toml -- fallback
```

Todas las pruebas nuevas de prep llevan `fallback` en su nombre para que este filtro las seleccione.

## Cobertura esperada

No hay mínimo de cobertura de líneas (plan `poc`). La meta es una prueba por cada requisito comprobable fuera del navegador (FR2.1, FR2.2, FR2.3, FR3 y FR4.3), y que las pruebas que ya existían sigan en verde. FR1 se comprueba al correr `fetch-gedi`; NFR2 y NFR4, al preparar los datos.

## Simulaciones y sustitutos

- Ninguna prueba descarga nada, lee `data/raw/` ni usa `~/.netrc`.
- Las pruebas de Python arman en memoria un raster pequeño de numpy con su georreferencia de EPSG:6933 y llaman a las funciones puras de `gedi_l3_to_png.py`. Para el caso de las etiquetas que faltan, escriben un TIFF sintético en la carpeta temporal de pytest (`tmp_path`).
- Las pruebas de Rust usan configuraciones JSON escritas en la propia prueba e imágenes RGBA pequeñas creadas en memoria.

## Datos de prueba

- Raster EASE-Grid 2.0 de unas pocas filas y columnas, con valores conocidos y algunos píxeles en el valor de "sin dato".
- Alturas 0, 25, 50 y 60 m para la escala.
- Dos vistas sintéticas para prep: una principal con alfa 0 en algunas celdas y una de relleno con valor en todas.
