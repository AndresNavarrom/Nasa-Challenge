# Instrucciones de compilación — Bosque con GEDI L3

Todo corre en Docker (Docker Desktop). No hace falta instalar nada más en el equipo.

## Dependencias y entorno

- Docker Desktop con al menos 4 GB de memoria.
- Para volver a bajar GEDI L3:
  - una cuenta de NASA Earthdata;
  - un archivo `~/.netrc` con permisos 600 y una sola línea: `machine urs.earthdata.nasa.gov login <usuario> password <clave>`.

  Ese archivo nunca va al repositorio.
- La demo no necesita internet.

## Construir las imágenes

```bash
docker compose --profile '*' build
```

## Descargar y preparar los datos

Solo hace falta para regenerarlos; los datos preparados están en `web/public/data/`.

```bash
docker compose run --rm fetch        # fuentes públicas y data/SOURCES.md
docker compose run --rm fetch-gedi   # GEDI L3 (pide ~/.netrc): unos 617 MB, cerca de 2 min
docker compose run --rm prep         # cuadrículas, imágenes, manifest.json e informe de cobertura
```

Para volver a bajar GEDI: `docker compose run --rm -e FORCE=1 fetch-gedi`.

## Compilar la app

```bash
docker build --target build web
```

## Verificar la compilación

- `forest_global.bin` pesa 1 036 800 bytes y `forest_region.bin` pesa 100 800.
- El informe de `prep` muestra al menos el 90 % de GEDI en la Amazonía.

## Problemas comunes

- **Docker dice que no existe `~/.netrc`**: créalo como se indica arriba. `fetch-gedi` no lo crea por ti.
- **`fetch-gedi` falla con 401 o 403**: autoriza la aplicación de ORNL DAAC en tu perfil de Earthdata (Applications → Authorized Apps).
