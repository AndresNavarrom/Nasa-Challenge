# Instrucciones de compilación — Paso 12

Parten de `code-generation-plan.md`, `unit-test-instructions.md` y `code-summary.md`. Todo corre con Docker.

## Requisitos

- Docker Desktop encendido, en la rama `interfaz`.
- Imágenes construidas: `docker compose --profile "*" build` (necesita internet solo la primera vez).
- Sin variables de entorno, claves ni base de datos. No se agregaron dependencias en este paso.

## Compilar

Revisión de tipos:

```bash
docker compose run --rm web-test npm run typecheck
```

Compilación de la interfaz (revisión de tipos más empaquetado):

```bash
docker build --target build web
```

## Ver el planeta

```bash
docker compose up web
```

Abrir `http://127.0.0.1:5173`. Para el modo liviano del plan B, `http://127.0.0.1:5173/?lite=1`. Se detiene con `docker compose down`.

## Comprobar que quedó bien

- Las pruebas de `unit-test-instructions.md` terminan en verde.
- La revisión de tipos no imprime errores y la compilación termina.
- La revisión manual en el navegador sigue `docs/PLANET-CHECKLIST.md`.

## Problemas comunes

- **Pantalla en blanco o aviso de WebGL**: el navegador no tiene WebGL activo; probar otro navegador o activar la aceleración por hardware.
- **No llega a 30 cuadros por segundo**: probar `?lite=1`. Ese modo solo cubre el primer escalón del plan B; el planeta fijo sin giro no está construido.
- **El valor del indicador no cambia con el planeta girando**: se recalcula solo al mover el cursor; mover el ratón un poco lo actualiza.
- **Unir a `main`**: la rama `interfaz` salió antes de la unión de la PR #1; traer `main` primero.
