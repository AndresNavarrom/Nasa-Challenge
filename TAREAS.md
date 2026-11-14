# Reparto de tareas — Samuel, Fernando y Andres Navarro

Jukebox Terrestre (equipo Sagitta). Envío: domingo 15 de noviembre, objetivo 10:00 p.m., límite interno 11:50 p.m. (hora de Colombia).

El detalle de qué se construye está en
`aidlc/spaces/default/intents/261114-earth-jukebox-poc/inception/requirements-analysis/requirements.md`
y el plan de código paso a paso en
`aidlc/spaces/default/intents/261114-earth-jukebox-poc/construction/code-generation/code-generation-plan.md`.

## Cómo trabajamos

- **El código base se está generando** a partir del plan de código y se sube a `main` en cuanto esté. Hasta entonces, cada uno lee su parte del plan y prepara su entorno (Node.js 20 o superior, Rust estable, ffmpeg).
- **Cada uno es dueño de sus carpetas.** Si necesitas un cambio en la carpeta de otro, pídeselo; no lo edites por tu cuenta.
- **Una rama por persona**: `sonido`, `datos-rust`, `interfaz`. Se integra a `main` al cierre de cada bloque, no antes.
- **El formato del archivo de datos no se cambia sin avisar a los tres.** Es lo que une las tres partes. Está descrito en el plan de código, sección "Formato del archivo de datos".
- Mientras no haya datos reales, sonido e interfaz trabajan con los datos de ejemplo (`--sample`).

## Quién hace qué

| Persona | Frente | Carpetas propias |
|---|---|---|
| Samuel Betancur Muñoz | Sonido e interpolación | `web/src/audio/`, `web/src/lib/` |
| Fernando Gonzalez Rivero | Datos en Rust, servidor local e integración | `tools/`, `server/`, `data/`, `web/public/data/`, `run-demo.sh` |
| Andres Navarro Marin | Interfaz: planeta 3D, mapa, panel, accesibilidad | `web/src/scene/`, `web/src/ui/` |

## Samuel — Sonido

| Bloque | Tarea | Listo cuando |
|---|---|---|
| B1 · Sáb hasta 11:00 p.m. | Voz del bosque: la altura fija la nota dentro de una escala de cinco notas; paneo según la posición; volumen según la intensidad. Botón de inicio que desbloquea el audio. | Al mover el cursor sobre datos de ejemplo se oye el bosque cambiar de nota sin chasquidos |
| B2 · Dom 7:00 a.m.–1:00 p.m. | Voz del humo (aspereza y timbre más oscuro) y voz del CO2 (pulso de respiración que se acelera). Mezcla de las tres con limitador. Interpolación en el tiempo para humo y CO2. | Con los ojos cerrados, alguien distingue qué capa suena y si el valor es alto o bajo en 4 de 5 intentos |
| B3 · Dom 1:00–5:00 p.m. | Afinar el sonido con las 2 personas ajenas al equipo. Medir la latencia (máximo 100 ms) y probar 10 minutos seguidos sin cortes. | La lista de verificación de la demo queda en verde en la parte de sonido |

Plan B: si hay chasquidos o latencia, cambiar parámetros con rampas suaves y usar muestras precargadas para el fondo. Si suena ruidoso, menos voces a la vez.

## Fernando — Datos en Rust, servidor e integración

| Bloque | Tarea | Listo cuando |
|---|---|---|
| B0 · Sáb hasta 5:30 p.m. | Con Alberto y Andres David: descargar los cuadros de las tres visualizaciones (SVS 4950 bosque, 5533 humo, 5196 CO2) y fijar el rectángulo de la Amazonía. Generar los datos de ejemplo. | Hay un `manifest.json` de ejemplo que Samuel y Andres ya usan |
| B1 · Sáb hasta 11:00 p.m. | Programa de preparación: de cuadro a cuadrícula de intensidades (barra de color o brillo), una global y una de la Amazonía, para la capa bosque. Servidor local que entrega la app. | La app carga datos reales del bosque desde el servidor local |
| B2 · Dom 7:00 a.m.–1:00 p.m. | Capas humo y CO2 con sus instantes y fechas. Anotar cada archivo usado y su enlace en `data/SOURCES.md`. | Las tres capas cargan con datos reales y pesan menos de 200 MB en total |
| B3 · Dom 1:00–5:00 p.m. | Integrar las tres ramas, `run-demo.sh`, y prueba con el cable de red desconectado en el portátil de la demo y en el de respaldo. | La app arranca y funciona sin internet en menos de 5 segundos |

Plan B: si el trabajo en Rust se atrasa al cierre de B1, preparar los datos con un script y dejar Rust solo como servidor. Si una capa no tiene vista global plana, dejarla solo en el mapa de la Amazonía. Si a Andres le falta el planeta o la transición al cierre de B1, pasas a apoyar la interfaz.

## Andres Navarro — Interfaz

| Bloque | Tarea | Listo cuando |
|---|---|---|
| B1 · Sáb hasta 11:00 p.m. | Planeta en 3D que gira, con la textura de la capa activa. Transición a la Amazonía: giro y aplanado, ida y vuelta en 2 segundos o menos. El punto bajo el cursor se convierte en latitud y longitud y se le pasa al sonido. | Se ve el bosque en el planeta y en el mapa de la Amazonía. **A las 11:00 p.m. se decide**: si no corre fluido, se pasa a planeta fijo con cambio directo al mapa |
| B2 · Dom 7:00 a.m.–1:00 p.m. | Panel lateral de capas. Línea de tiempo con reproducir y pausar y las fechas visibles. Modo historia (planeta → Amazonía, tres pasos con texto corto). | El modo historia corre completo en menos de 60 segundos |
| B2–B3 · Dom hasta 5:00 p.m. | Accesibilidad mínima: todo con teclado (capas, reproducir, flechas para mover el punto) y un texto que el lector de pantalla lee con la capa, el lugar y si el valor es bajo, medio o alto. Revisar 30 cuadros por segundo. | Alguien completa el modo historia sin ratón y con el lector de pantalla activo |

Plan B: texturas más pequeñas primero; si no basta, planeta fijo sin giro libre y cambio directo al mapa, sin animación de aplanado.

## Puntos de encuentro

| Hora | Qué se revisa |
|---|---|
| Sáb 5:30 p.m. | Datos de ejemplo listos y formato de datos acordado |
| Sáb 11:00 p.m. | Una capa de punta a punta; decisión sobre el planeta |
| Dom 1:00 p.m. | Tres capas, línea de tiempo y modo historia |
| Dom 5:00 p.m. | **No entra nada nuevo.** Desde aquí solo arreglos; Danna graba el video |

Si un bloque se atrasa, se recorta en este orden: primero la capa CO2, luego la línea de tiempo queda en 3 instantes fijos, luego el modo historia se lee en vivo. El video y el formulario no se recortan.
