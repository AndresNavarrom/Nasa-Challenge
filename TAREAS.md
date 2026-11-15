# Reparto de tareas — Fernando, Andres Navarro y Samuel

Jukebox Terrestre (equipo Sagitta). Envío: domingo 15 de noviembre, objetivo 10:00 p.m., límite interno 11:50 p.m. (hora de Colombia).

## Estado actual (domingo 15 de noviembre)

`main` está en **037c593** y vuelve a compilar: **106/106 pruebas**, `tsc` y `vite build` en verde. La llave extra que rompía `App.tsx` quedó corregida.

### Ya está en `main`

- **Planeta 3D, transición a la Amazonía y punto escuchado** (paso 12, PR #2).
- **Vista Earth**, bosque con relieve de GEDI y rayos como puntos de SVS 5011 (PR #6, #7 y #9).
- **Bienvenida, selector de capa y casillas “Listen to”** (PR #8): recorrido con driver.js y control de qué capas suenan.
- **Motor de sonido** (paso 10, PR #4): bosque, humo, CO2 y rayos; limitador y medidor.
- **Línea de tiempo** (PR #5 y #10): reloj compartido, audio que sigue la posición, barra con play/pausa, scrub, 0.1×–8× y fechas por capa.
- **Servidor local y contenedor final** (paso 11, PR #3): `docker compose up` sirve la app en http://127.0.0.1:8080.
- **Datos en alta resolución**, cuatro capas (bosque, humo, CO2 y rayos) e imagen base Natural Earth de 8192 o 4096 píxeles.

### Estado por paso

| Paso | Estado | Qué falta |
|---|---|---|
| 10 · Sonido | **Hecho** | Cierre formal de B3 (véase abajo); integrar la muestra de tormenta de `audio-samples` |
| 11 · Servidor | **Hecho** | — |
| 12 · Planeta | **Hecho** | Revisión manual con `PLANET-CHECKLIST.md` |
| 13 · Interfaz | **Parcial** | La barra de tiempo y la bienvenida están; falta que el planeta dibuje el instante, el modo historia y la pantalla de inicio dedicada |
| 14 · Accesibilidad | **Pendiente** | Teclado, `a11y.ts` y comprobación de 30 fps |
| 15 · Demo | **PR #11 abierta** | Unir, prueba con cable desconectado en los dos portátiles |
| 16 · Documentos | **Borradores en PR #11** | Cerrar los `TODO` con Danna y Andres David |

**La línea de tiempo mueve el sonido y las fechas, pero no la imagen ni el indicador.** `layerTexture.ts` sigue usando `FIRST_INSTANT`, `EarthScene` muestrea `FIRST_INSTANT` y `EarthMesh` no tiene crossfade. Son los pasos 3 a 5 de `docs/TIMELINE-HANDOFF.md`.

## Ramas y PRs

- **`main`**: todo lo anterior; no tocar sin PR, salvo el arreglo de compilación ya hecho.
- **PR #11 `paso-15-demo` → `main` (abierta)**: `run-demo.sh`/`.ps1`, `docs/DEMO-CHECKLIST.md`, `docs/SUBMISSION.md`, README con las cuatro capas.
- **`audio-samples` (subida, sin PR)**: `tools/audio/prepare.py`, 43 OGG en `web/public/audio/samples` y manifiesto; incluye `tormenta-albert.ogg`, los golpes de rayos con cola de 2.4 s y el respaldo sintetizado. `main` todavía usa el golpe sintetizado.

## Lo que falta

### Interfaz y escena (Samuel; la barra de tiempo la hizo Andrés)

- [ ] **Planeta dibuja el instante de la línea de tiempo** (handoff, pasos 3–5): texturas por cuadro en `layerTexture.ts`, crossfade A/B en `EarthMesh.tsx` y `position` + `framePosition` en `EarthScene.tsx` (incluido el indicador).
- [ ] **Revisar el planeta** con `docs/PLANET-CHECKLIST.md`; la lista sigue sin marcar.
- [ ] **Modo historia** (planeta → Amazonía, tres pasos, menos de 60 s); el recorrido de bienvenida no es el modo historia.
- [ ] **Pantalla de inicio dedicada**, si se quiere además del recorrido de bienvenida.
- [ ] **Panel lateral completo**: hoy hay selector de capa, no un panel lateral.
- [ ] **Paso 14**: teclado (capas, reproducir/pausar, flechas para el punto), `web/src/ui/a11y.ts` con su prueba y texto para lector de pantalla (capa, lugar y valor bajo/medio/alto).
- [ ] **30 fps** con audio y en el portátil de la demo.
- [x] Título **“Atmospheric CO2”**, capa CO2 global, en alta resolución y con contraste (PR #13).
- [x] Barra de tiempo, fechas, selector de capa y `data-testid` de esos controles.
- [x] Las capas no se mezclan: solo suena la capa elegida en el selector; se quitan las casillas “Listen to”.

### Sonido (Fernando)

- [x] B1 (bosque), B2 (humo + CO2 + mezcla) y voz de rayos.
- [x] **B3 probado a mano**: 43 ms de latencia de dispositivo en Firefox, sin latencia perceptible, 10 minutos limpios y reproducción confirmada en Chromium. Las capas se distinguen al escucharlas.
- [ ] Cerrar del todo la tabla de `docs/SOUND-ENGINE-CHECKLIST.md`: repetir las mediciones en Chromium y, si se quiere el protocolo completo, la prueba a ciegas con dos personas ajenas.
- [ ] Abrir PR y unir **`audio-samples`**; después, comprobar en la app que los rayos suenan con `tormenta-albert.ogg` y que las colas se superponen a 6 golpes/s.

### Servidor, arranque y documentos (Andrés)

- [x] Servidor local, contenedor final y borrador de `run-demo`.
- [ ] Unir **PR #11** a `main`.
- [ ] **Prueba con el cable desconectado** en el portátil de la demo y en el de respaldo (el portátil de desarrollo ya quedó registrado).
- [ ] Completar con Danna y Andres David los `TODO` de `docs/SUBMISSION.md` (video, redacción final, uso de IA y referencias).
- [ ] Confirmar `README.md` y `SUBMISSION.md` con los datos nuevos ya incluidos en la PR #11.

### Danna y equipo (entregables)

- [ ] Revisar capas, línea de tiempo y modo historia.
- [ ] Congelamiento de funciones y grabación del video de 30 s en inglés.
- [ ] Resumen del proyecto en inglés con la declaración de uso de IA.
- [ ] Envío antes de las 11:50 p.m. (límite interno); el formulario y el video no se recortan.

## Orden sugerido

1. **Planeta dibuja el instante de la línea de tiempo** (pasos 3–5 del handoff) y revisión con `PLANET-CHECKLIST.md`.
2. **Unir PR #11** y hacer la prueba sin cable en los dos portátiles.
3. **Accesibilidad y modo historia** si queda tiempo.
4. ~~**Título del CO2** y regeneración de datos~~: hecho en la PR #13.
5. **PR de `audio-samples`** para que la muestra de tormenta llegue a `main`.
6. Video, formulario y envío.

Si se atrasa algo, se recorta en este orden: primero la capa de CO2; después la línea de tiempo se queda en 3 instantes fijos; por último el modo historia se lee en vivo. El video y el formulario no se recortan.

## Para arrancar

Solo hace falta Docker Desktop.

```bash
docker compose up                         # app final en http://127.0.0.1:8080
docker compose up web                     # interfaz en desarrollo en http://127.0.0.1:5173
docker compose run --rm web-test          # Vitest: interfaz, escena y sonido
docker compose run --rm prep-test         # cargo test de la preparación de datos
docker compose run --rm server-test       # cargo test del servidor
docker compose run --rm prep              # regenerar web/public/data/
docker compose run --rm fetch             # descargar las fuentes de datos
```

- Los cambios de código no requieren reconstruir. Los de `package.json`, `package-lock.json`, `Cargo.toml` o `Cargo.lock` sí.
- Para agregar un paquete: `docker compose run --rm web npm install <nombre>` y subir `package.json` y `package-lock.json`.
- `run-demo.sh` está en la PR #11; hasta que entre, usar `docker compose up`.

## Cómo trabajamos

- **Cada uno es dueño de sus carpetas.** Para tocar la de otro, pedirlo.
- **Una rama por tema** y PR a `main`; revisión breve antes de unir.
- Commits pequeños y por tema.
- El formato del archivo de datos no se cambia sin avisar a los tres; está en el plan de código y en `web/src/data/types.ts`.

## Lo que ya existe y pueden usar

- `loadJukeboxData()` en `web/src/data/loadManifest.ts`: capas y rectángulo de la Amazonía.
- `sampleLayerAt(…)` en `web/src/lib/interpolate.ts`: valor 0..1 de una capa en longitud, latitud y posición temporal; `null` donde no hay datos.
- `web/src/lib/timeline.ts`: posición común 0..1, `framePosition`, `frameBlend` y fecha por capa.
- `web/src/lib/playback.ts` y `web/src/timeline/TimelineProvider.tsx`: reloj compartido, `useTimeline()`, velocidad 0.1×–8× y lazo.
- `web/src/audio/`: motor con voces por capa, mapeo valor → sonido y `start()` que desbloquea el audio.
- `web/public/data/`: datos preparados e imágenes base; `web/public/audio/` llegará con la PR de `audio-samples`.

## Tres cosas que hay que saber

- **Cobertura:** las cuatro capas son globales. El CO2 es un mosaico: sobre las Américas y el Atlántico se mueve con la línea de tiempo (23 a 25 de febrero de 2020); en el resto del planeta cada región tiene la fecha de la vista que la cubre, entre el 14 de enero y el 3 de marzo de 2020, y queda fija (donde dos vistas se solapan, por ejemplo cerca de 23° E, sus fechas se mezclan, con hasta nueve días de diferencia).
- **Escalas:** el bosque es altura GEDI de 0 a 50 m y el humo es PM2.5 de GEOS-CF de 0 a 150 µg/m³; **el CO2 y los rayos son valores relativos** leídos de visualizaciones de la NASA (intensidad y frecuencia, no mediciones). Está en `data/SOURCES.md`.
- **El CO2 se presenta como contexto global**, no como efecto medido de lo que pasa en la Amazonía.

## Quién hace qué

| Persona | Foco actual | Carpetas propias |
|---|---|---|
| Fernando Gonzalez Rivero | Sonido y línea de tiempo (audio) | `web/src/audio/`, `web/src/lib/`, `web/src/timeline/` |
| Andres Navarro Marin | Servidor, arranque sin internet, documentos y barra de tiempo | `tools/`, `server/`, `data/`, `web/public/data/`, `docker-compose.yml`, `run-demo.*`, `docs/`, `web/src/ui/TimelineBar.tsx` |
| Samuel Betancur Muñoz | Escena, planeta, capas, recorrido y accesibilidad | `web/src/scene/`, `web/src/ui/`, `web/src/App.tsx` |
| Danna Vergara | Producto, revisión y entregables | `docs/SUBMISSION.md` con Andrés |

## Hitos del domingo

- [ ] Revisión de capas, línea de tiempo y modo historia.
- [ ] Congelamiento de funciones y grabación del video de 30 s.
- [ ] Resumen en inglés y declaración de uso de IA.
- [ ] Envío (límite interno 11:50 p.m.).

## Referencias

- Plan de código y pasos 10–16: `aidlc/spaces/default/intents/261114-earth-jukebox-poc/construction/code-generation/code-generation-plan.md`.
- Requisitos: `aidlc/spaces/default/intents/261114-earth-jukebox-poc/inception/requirements-analysis/requirements.md`.
- Decisiones y handoff de la línea de tiempo: `docs/TIMELINE-HANDOFF.md`.
- Lista manual del sonido: `docs/SOUND-ENGINE-CHECKLIST.md`.
- Lista manual del planeta: `docs/PLANET-CHECKLIST.md`.
