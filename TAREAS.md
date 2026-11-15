# Reparto de tareas — Fernando, Andres Navarro y Samuel

Jukebox Terrestre (equipo Sagitta). Envío: domingo 15 de noviembre, objetivo 10:00 p.m., límite interno 11:50 p.m. (hora de Colombia).

## Dónde estamos (sábado 14 de noviembre, noche)

En `main` ya está, probado:

- **El planeta 3D** (paso 12, PR #2): gira, pasa a la Amazonía en menos de 2 s y entrega al sonido el punto que está bajo el cursor.
- **El motor de sonido** (paso 10, PR #4): una voz por capa.
- **El servidor local y el contenedor final** (paso 11, PR #3): `docker compose up` levanta la app en http://127.0.0.1:8080.
- **Los datos en alta resolución**. Son cuatro capas:
  - **bosque**: altura del dosel de GEDI L3, de 0 a 50 m, con relleno de SVS 4950;
  - **humo**: PM2.5 de GEOS-CF del 1 de septiembre de 2026, global, con 24 horas;
  - **CO2**: SVS 5196, solo en la Amazonía;
  - **rayos**: SVS 5011, acumulados de 2017 a 2023.

  La imagen base es Natural Earth, en 8192 o 4096 píxeles.

## Lo que falta

**Samuel (interfaz)**
- [ ] Revisar el planeta en el navegador con `docs/PLANET-CHECKLIST.md`, para decidir a las 11:00 p.m. si se queda el planeta o se pasa al plan B
- [ ] Paso 13: panel lateral de capas (bosque, humo, CO2 y rayos)
- [ ] Paso 13: línea de tiempo con reproducir, pausar y fechas visibles; el planeta dibuja el instante de la línea de tiempo
- [ ] Paso 13: modo historia (planeta → Amazonía, 3 pasos con texto, menos de 60 s)
- [ ] Paso 13: pantalla de inicio y `data-testid` en todos los controles
- [ ] Paso 14: todo se puede usar con teclado, y `a11y.ts` con su prueba (texto para el lector de pantalla: capa, lugar y valor bajo, medio o alto)
- [ ] Paso 14: comprobar 30 cuadros por segundo en el portátil de la demo
- [ ] Cambiar el título "Global CO2" (la capa solo cubre la Amazonía) y regenerar los datos

**Fernando (sonido)**
- [ ] Bloque B3: afinar con 2 personas que no sean del equipo
- [ ] Medir la latencia (máximo 100 ms) y probar 10 minutos seguidos
- [ ] Dejar en verde `docs/SOUND-ENGINE-CHECKLIST.md`

**Andres (servidor, arranque y documentos)**
- [ ] Paso 15: abrir la PR de `paso-15-demo` (`run-demo.sh`) y unirla a `main`
- [ ] Paso 15: probar con el cable de red desconectado en el portátil de la demo y en el de respaldo (arranque en 5 s o menos)
- [ ] Paso 16, con Danna: `docs/DEMO-CHECKLIST.md` y `docs/SUBMISSION.md` en inglés
- [ ] Actualizar `README.md` y `SUBMISSION.md`: el bosque (GEDI, 0 a 50 m) y el humo (GEOS-CF, 0 a 150 µg/m³) ahora son mediciones, no intensidades relativas

**Danna y equipo (entregables)**
- [ ] Domingo 1:00 p.m.: revisar las capas, la línea de tiempo y el modo historia
- [ ] Domingo 5:00 p.m.: congelamiento de funciones y grabación del video de 30 s en inglés
- [ ] Resumen del proyecto en inglés, con la declaración de uso de IA
- [ ] Domingo 10:00 p.m.: envío (límite interno 11:50 p.m.)

**Si se atrasa algo, se recorta en este orden:**
1. la capa de CO2;
2. la línea de tiempo se queda en 3 instantes fijos;
3. el modo historia se lee en vivo.

El video y el formulario no se recortan.

## El plan original

Lo que sigue es el reparto original, con los pasos 10 a 16 del plan de código:
`aidlc/spaces/default/intents/261114-earth-jukebox-poc/construction/code-generation/code-generation-plan.md`

Qué se construye y por qué está en:
`aidlc/spaces/default/intents/261114-earth-jukebox-poc/inception/requirements-analysis/requirements.md`

## Para arrancar

Solo hace falta Docker Desktop.

```bash
docker compose --profile "*" build      # una vez; la imagen de Rust tarda en descargar
docker compose up web                   # interfaz en http://127.0.0.1:5173, con recarga en vivo
docker compose run --rm web-test        # pruebas de la interfaz y el sonido
docker compose run --rm prep-test       # pruebas de la preparación de datos
docker compose run --rm prep            # regenerar los datos
```

- Los cambios de código no requieren reconstruir. Los de `package.json`, `package-lock.json`, `Cargo.toml` o `Cargo.lock` sí.
- Para agregar un paquete: `docker compose run --rm web npm install <nombre>` y subir `package.json` y `package-lock.json`.
- Si cambia `package-lock.json`, bajen la interfaz con `docker compose down` antes de correr `web-test`.

## Cómo trabajamos

- **Cada uno es dueño de sus carpetas.** Si necesitas un cambio en la carpeta de otro, pídeselo.
- **Una rama por persona**: `sonido`, `datos-rust`, `interfaz`. Se integra a `main` al cierre de cada bloque.
- **El formato del archivo de datos no se cambia sin avisar a los tres.** Está en el plan de código, sección "Formato del archivo de datos", y en `web/src/data/types.ts`.
- Commits pequeños y por tema.

## Lo que ya existe y pueden usar

- `loadJukeboxData()` en `web/src/data/loadManifest.ts`: devuelve las capas y el rectángulo de la Amazonía.
- `sampleLayerAt(…)` en `web/src/lib/interpolate.ts`: el valor de una capa (de 0 a 1) en una longitud, latitud y momento; devuelve `null` donde la capa no tiene datos.
- `web/src/lib/timeline.ts`: convierte la posición común de 0 a 1 en el instante y la fecha de cada capa.
- `web/src/audio/mapping.ts`: de valor a nota y armonía (bosque), aspereza y filtro (humo), ritmo de respiración (CO2), paneo y volumen. Con `null`, el volumen es 0.
- `web/public/data/`: los datos preparados y la imagen base del planeta (`earth.jpg`).

## Tres cosas que hay que saber

- **El bosque, el humo y los rayos son globales; el CO2 solo cubre la Amazonía.** Fuera de la región, el CO2 no se ve ni suena.
- **El bosque y el humo son mediciones con escala fija**: el bosque va de 0 a 50 m (GEDI) y el humo de 0 a 150 µg/m³ (GEOS-CF). **El CO2 y los rayos son valores relativos** leídos de visualizaciones de la NASA: el CO2 es una intensidad y los rayos una frecuencia, no un conteo. Hay que decirlo así en los textos. El detalle está en `data/SOURCES.md`.
- **El CO2 se presenta como contexto global**, no como efecto medido de lo que pasa en la Amazonía.

## Quién hace qué

| Persona | Pasos del plan | Carpetas propias |
|---|---|---|
| Fernando Gonzalez Rivero | 10 | `web/src/audio/`, `web/src/lib/` |
| Andres Navarro Marin | 11, 15 y, con Danna, 16 | `tools/`, `server/`, `data/`, `web/public/data/`, `docker-compose.yml`, `run-demo.sh`, `docs/` |
| Samuel Betancur Muñoz | 12, 13 y 14 | `web/src/scene/`, `web/src/ui/`, `web/src/App.tsx` |

## Fernando — Paso 10: motor de sonido

`web/src/audio/engine.ts` con Web Audio API. Los cálculos ya están en `mapping.ts`; falta hacerlos sonar.

| Bloque | Tarea | Listo cuando |
|---|---|---|
| B1 · Sáb hasta 11:00 p.m. | Voz del bosque: nota dentro de la escala de cinco notas, paneo y volumen. Botón de inicio que desbloquea el audio. Cambios con rampas suaves. | Al mover el cursor se oye el bosque cambiar de nota sin chasquidos |
| B2 · Dom 7:00 a.m.–1:00 p.m. | Voz del humo y voz del CO2. Mezcla de las tres con limitador y medidor de salida. | Con los ojos cerrados, alguien distingue qué capa suena y si el valor es alto o bajo en 4 de 5 intentos |
| B3 · Dom 1:00–5:00 p.m. | Afinar con 2 personas ajenas al equipo. Medir la latencia (máximo 100 ms) y probar 10 minutos seguidos. | La parte de sonido de la lista de verificación queda en verde |

**Ojo:** al cruzar el borde de la Amazonía el valor del bosque pasa de la cuadrícula detallada a la global, que es mucho más gruesa, y puede oírse un salto. Suaviza el volumen o la nota en ese cruce.

Plan B: si hay chasquidos o latencia, usar muestras precargadas para el fondo y dejar la síntesis para la voz principal. Si suena ruidoso, menos voces a la vez.

## Andres Navarro — Pasos 11, 15 y 16: servidor, arranque sin internet y documentos

| Bloque | Tarea | Listo cuando |
|---|---|---|
| B1 · Sáb hasta 11:00 p.m. | Paso 11: servidor local en `server/` con Axum, que entrega la interfaz compilada y los datos en `127.0.0.1`. Ya están declaradas las dependencias; falta el código. | La app compilada se abre desde el servidor local |
| B2 · Dom 7:00 a.m.–1:00 p.m. | Contenedor final de la app (interfaz compilada más servidor) en `docker-compose.yml`. Apoyar a Alberto y Andres David si hay que mejorar los datos. | `docker compose up` levanta la app completa |
| B3 · Dom 1:00–5:00 p.m. | Paso 15: integrar las tres ramas, `run-demo.sh`, y probar con el cable de red desconectado en el portátil de la demo y en el de respaldo. Paso 16, con Danna: `docs/DEMO-CHECKLIST.md` y `docs/SUBMISSION.md` en inglés. | La app arranca sin internet en 5 segundos o menos |

**Ojo:** el arranque sin red nunca se ha probado con la red cortada. Las imágenes de Docker tienen que estar construidas en el portátil antes de desconectarlo.

Plan B: si a Samuel le falta el planeta o la transición al cierre de B1, pasas a apoyar la interfaz y el servidor queda para el domingo temprano.

## Samuel — Pasos 12, 13 y 14: interfaz

| Bloque | Tarea | Listo cuando |
|---|---|---|
| B1 · Sáb hasta 11:00 p.m. | Paso 12: planeta en 3D que gira con la textura de la capa activa; transición a la Amazonía (giro y aplanado, ida y vuelta en 2 segundos o menos); mapa regional. El punto bajo el cursor se convierte en longitud y latitud y se le pasa al sonido. | Se ve el bosque en el planeta y en el mapa. **A las 11:00 p.m. se decide**: si no corre fluido, planeta fijo con cambio directo al mapa |
| B2 · Dom 7:00 a.m.–1:00 p.m. | Paso 13: panel lateral de capas, línea de tiempo con reproducir y pausar y las fechas visibles, modo historia (planeta → Amazonía, tres pasos con texto corto), pantalla de inicio. Todos los controles con `data-testid`. | El modo historia corre completo en menos de 60 segundos |
| B2–B3 · Dom hasta 5:00 p.m. | Paso 14: todo con teclado y un texto que el lector de pantalla lee con la capa, el lugar y si el valor es bajo, medio o alto (`web/src/ui/a11y.ts` y su prueba). Revisar 30 cuadros por segundo. | Alguien completa el modo historia sin ratón y con el lector de pantalla activo |

**Ojo:**
- Cambia el título "Global CO2" en `data/prep-config.json` y regenera los datos antes de mostrarlo en el panel: la capa solo cubre la Amazonía.
- Las texturas del humo y del CO2 son solo del primer instante. Para que imagen y sonido avancen juntos, dibújalas desde las cuadrículas.
- Los instantes del humo se reparten a intervalos iguales, aunque en el video están a tiempos desiguales; las etiquetas muestran el tiempo del clip, no una fecha.

Plan B: texturas más pequeñas primero; si no basta, planeta fijo sin giro libre y cambio directo al mapa, sin animación de aplanado.

## Puntos de encuentro

| Hora | Qué se revisa |
|---|---|
| Sáb 11:00 p.m. | Una capa de punta a punta (se ve y se oye); decisión sobre el planeta |
| Dom 1:00 p.m. | Tres capas, línea de tiempo y modo historia |
| Dom 5:00 p.m. | **No entra nada nuevo.** Desde aquí solo arreglos; Danna graba el video |
| Dom 10:00 p.m. | Envío |

Si un bloque se atrasa, se recorta en este orden: primero la capa CO2, luego la línea de tiempo queda en 3 instantes fijos, luego el modo historia se lee en vivo. El video y el formulario no se recortan.
