# Instrucciones de compilación — Jukebox Terrestre

Parten de `code-generation-plan.md` (Step 17), `unit-test-instructions.md` y `code-summary.md`. Todo se corre con Docker; los comandos sin Docker quedan como alternativa.

## Requisitos

- Docker Desktop encendido.
- Internet solo la primera vez, para descargar las imágenes base de Node 20 y de Rust (la de Rust tardó unos 35 minutos con la red de la máquina de trabajo).
- No hacen falta variables de entorno, claves ni base de datos.

## Instalar dependencias y construir las imágenes

Desde la raíz del proyecto:

```bash
docker compose --profile "*" build
```

Construye las dos imágenes: `earth-jukebox-web:dev` (interfaz, con sus dependencias de npm instaladas desde `web/package-lock.json`) y `earth-jukebox-prep:dev` (preparación de datos en Rust, con sus dependencias ya compiladas).

`docker compose build` a secas solo construye la imagen de la interfaz, porque los servicios de pruebas y de datos están detrás de perfiles.

## Compilar

Interfaz (revisa tipos con `tsc --noEmit` y empaqueta con Vite):

```bash
docker build --target build web
```

Preparación de datos: se compila sola al correr sus pruebas o al regenerar los datos.

```bash
docker compose run --rm prep
```

Este último vuelve a escribir `web/public/data/` a partir de `data/prep-config.json` y de los cuadros en `data/raw/`.

## Levantar la interfaz

```bash
docker compose up web
```

Queda en `http://127.0.0.1:5173`, con recarga en vivo al editar el código. Se detiene con `docker compose down`.

## Comprobar que quedó bien

- `docker compose config --quiet` no imprime errores.
- `docker compose run --rm web-test` y `docker compose run --rm prep-test` terminan con todas las pruebas en verde.
- `http://127.0.0.1:5173/data/manifest.json` responde con las tres capas.

## Sin Docker (alternativa)

Requiere Node.js 20 o superior y Rust estable:

```bash
npm --prefix web install
npm --prefix web run build
cargo build --manifest-path tools/prep/Cargo.toml
```

## Problemas comunes

- **`docker compose build` no construye la imagen de Rust**: usar `--profile "*"`, con comillas dobles.
- **Cambió `package.json`, `package-lock.json`, `Cargo.toml` o `Cargo.lock`**: hay que reconstruir las imágenes. Los cambios de código no lo requieren.
- **Dos personas reinstalan a la vez tras cambiar `package-lock.json`**: bajar la interfaz con `docker compose down` antes de correr `web-test`.
- **Agregar un paquete de npm**: `docker compose run --rm web npm install <nombre>` y subir `package.json` y `package-lock.json`.
- **La demo va sin internet**: construir todas las imágenes antes de desconectar el portátil.
- **Volver a descargar los cuadros de la NASA**: `tools/fetch-frames.sh` corre en la máquina, no en contenedor, y necesita `curl` y `ffmpeg`.
