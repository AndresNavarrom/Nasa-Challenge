# Requisitos — Paso 12: planeta 3D, transición y mapa de la Amazonía

Insumos: `intent-statement.md` (declaración de intención aprobada), el mapa del código en `aidlc/spaces/default/codekb/Nasa-Challenge/` (`business-overview.md`, `architecture.md`, `code-structure.md`) y las respuestas de `requirements-analysis-questions.md` (Q1–Q6).

## Intent analysis

- **Qué se busca**: la vista principal de la Jukebox Terrestre, el planeta 3D que gira con la capa activa y se aplana en el mapa de la Amazonía, con el punto bajo el cursor convertido en longitud y latitud para el sonido (`intent-statement.md`, Problem Statement).
- **Para quién**: el público general y el jurado; la historia es la Amazonía como pulmón del mundo (`intent-statement.md`, Target Customer).
- **Prioridad** (Q1): el bosque, la transición y el cursor van primero. La capa de aerosoles no bloquea la decisión de las 11:00 p.m. y se termina después si hace falta.
- **Novedad frente al plan anterior**: una capa global de carbono negro de GEOS-FP (Q3 de la intención; Q5 y Q6 aquí) que Andres Navarro convierte y entrega (Q4).
- **Tipo de trabajo**: nueva funcionalidad sobre código existente, en `web/src/scene/` y `web/src/App.tsx` (carpetas de Samuel según `TAREAS.md`), más una entrega de datos de Andres.

## Functional requirements

### Planeta

- **FR1** — La app abre con el planeta en 3D.
  - **FR1.1** — Una esfera con `web/public/data/earth.jpg` como imagen base, que gira sola despacio y se puede girar arrastrando con el ratón. Pasa si al arrastrar el planeta responde y al soltar sigue girando.
  - **FR1.2** — La capa activa se dibuja sobre la imagen base, semitransparente, a partir de su cuadrícula global. Pasa si con la capa del bosque activa se ven las zonas de bosque alto más intensas, y coinciden con la imagen base.
  - **FR1.3** — El planeta dibuja cualquier capa del archivo de datos que tenga cuadrícula global, sin nombres de capa fijos en el código. Pasa si al agregar una capa nueva al archivo de datos aparece sin cambiar el código del planeta.
  - **FR1.4** — Mientras llega el panel lateral (paso 13), un control mínimo permite cambiar la capa activa entre las que hay en el archivo de datos. Pasa si con ese control se puede pasar del bosque a otra capa y volver.

### Transición y mapa

- **FR2** — La transición a la Amazonía.
  - **FR2.1** — Al hacer clic sobre la Amazonía, o con un botón "Amazon", el planeta gira hasta centrar la región y se aplana en el mapa regional. Pasa si la ida termina en 2 segundos o menos.
  - **FR2.2** — Un botón "Back to Earth" hace el camino inverso. Pasa si la vuelta termina en 2 segundos o menos y el planeta queda girando de nuevo.
- **FR3** — El mapa de la Amazonía muestra el rectángulo `region.bbox` del archivo de datos con la capa activa encima: la cuadrícula regional si la capa la tiene, o el recorte de su cuadrícula global si no. Pasa si se ve el bosque en el mapa y las capas de humo y CO2 se ven también aquí.

### Punto bajo el cursor

- **FR4** — El punto bajo el cursor se convierte en longitud y latitud.
  - **FR4.1** — En el planeta, el punto de la esfera bajo el cursor se convierte en longitud y latitud con una función pura. Pasa si su prueba ubica bien puntos conocidos (por ejemplo, el ecuador en el meridiano cero y un punto de la Amazonía).
  - **FR4.2** — En el mapa, el punto bajo el cursor se convierte en longitud y latitud dentro de `region.bbox` con una función pura. Pasa si sus pruebas ubican bien las esquinas y el centro del rectángulo.
  - **FR4.3** — El punto escuchado (longitud, latitud y posición horizontal en pantalla de 0 a 1) queda disponible en un estado compartido para que el motor de sonido (paso 10, de Fernando) lo lea. Pasa si el estado cambia al mover el cursor y vale nulo cuando el cursor sale del planeta o del mapa.
  - **FR4.4** — Un indicador en pantalla muestra la longitud, la latitud y el valor de la capa activa en ese punto, usando `sampleLayerAt`. Pasa si al pasar por la Amazonía con el bosque activo el valor es alto, y sobre el océano es bajo o vacío. Sirve para comprobar el paso sin sonido.

### Capa de aerosoles (entrega de Andres Navarro)

- **FR5** — Una capa global de carbono negro de GEOS-FP en el archivo de datos.
  - **FR5.1** — Andres entrega la capa con id `aerosol`: carbono negro (Q5) de GEOS-FP (producto `tavg3_2d_aer_Nx`), los 8 instantes del 1 de septiembre de 2026, cada 3 horas (Q6), con cuadrícula global y fecha y hora de cada instante. Agrega `aerosol` a la lista de capas en `web/src/data/types.ts` y `tools/prep/src/config.rs`. La conversión corre en Docker. Pasa si `docker compose run --rm web-test` sigue en verde y el archivo de datos trae la capa con 8 instantes.
  - **FR5.2** — El planeta y el mapa muestran la capa `aerosol` cuando está en el archivo de datos, y su valor llega al indicador y al punto escuchado como cualquier otra capa. Pasa si al activarla se ve el humo sobre la Amazonía y otras regiones.
  - **FR5.3** — Sin la capa `aerosol` todo lo demás funciona. Pasa si con el archivo de datos actual (sin ella) la app arranca y cumple FR1 a FR4.

## Non-functional requirements

- **NFR1** — Fluidez: el planeta, la transición y el mapa se mueven a 30 cuadros por segundo o más en el portátil de la demo.
- **NFR2** — Sin internet: nada se carga de internet al usar la app (imagen base y texturas locales).
- **NFR3** — Pruebas (estrategia mínima): una prueba automática por cada función pura nueva (FR4.1 y FR4.2), corridas con `docker compose run --rm web-test`; lo visual se revisa en el navegador con una lista de verificación.
- **NFR4** — Datos: con la capa `aerosol` incluida, los datos preparados siguen por debajo de 200 MB.

## Constraints

- **Plazo**: a las 11:00 p.m. de hoy se decide si se mantiene el planeta o se pasa al plan B (`intent-statement.md`, Initiative Trigger). La capa de aerosoles no entra en esa decisión (Q1).
- **Rama**: `interfaz`, de Samuel.
- **Carpetas**: Samuel toca `web/src/scene/`, `web/src/ui/` y `web/src/App.tsx`. El formato de datos (`web/src/data/`, `tools/`, `data/`, `web/public/data/`) lo cambia Andres (Q4), avisando a los tres como pide `TAREAS.md`.
- **Tecnología**: React, three.js con @react-three/fiber y GSAP, ya instalados en `web/package.json`. Todo corre en Docker.
- **Datos**: solo el bosque tiene cuadrícula global hoy; humo y CO2 solo cubren la Amazonía (`architecture.md`).

### Decisiones de arquitectura

| Decisión | Elegido | Alternativa descartada | Por qué |
|---|---|---|---|
| Cómo se aplana el planeta | Una sola malla que pasa de esfera a plano mezclando las posiciones de sus vértices, animada con GSAP | Dos escenas separadas (esfera y mapa) con un fundido entre ambas | La mezcla se ve continua, que es lo que pide la historia; el fundido es el plan B si la mezcla no llega a 30 cuadros por segundo |
| De dónde sale la textura de la capa | Se dibuja en el navegador desde la cuadrícula del archivo de datos | Usar las imágenes `.png` ya preparadas | Las imágenes son de un solo instante; la cuadrícula sirve también para las capas con varios instantes, como `aerosol` |
| Cómo se comparte el punto escuchado | Un estado pequeño de React (contexto) con longitud, latitud y posición horizontal | Que la escena llame directo al motor de sonido | Separa el trabajo de Samuel del de Fernando: el motor solo lee el estado |

Implicación de seguridad: la app corre en local, no expone servicios y no maneja datos personales; los datos de GEOS-FP son públicos.

## Plan B (si no llega a 30 cuadros por segundo)

Viene de `intent-statement.md`, Success Metrics: primero texturas más pequeñas; si no basta, planeta fijo sin giro libre y cambio directo al mapa, sin aplanado animado.

## Encargo para Andres Navarro

Para enviarle tal cual o adaptarlo:

> Andres, para el planeta necesito una capa global de humo de GEOS-FP. Detalles: id `aerosol`; carbono negro del producto `tavg3_2d_aer_Nx`; los 8 instantes del 1 de septiembre de 2026 (01:30 a 22:30 UTC, cada 3 horas); cuadrícula global (la misma forma que `forest_global`) y, si se puede, también la regional de la Amazonía; etiqueta de fecha y hora por instante. Hay que agregar `aerosol` a `LAYER_IDS` en `web/src/data/types.ts` y en `tools/prep/src/config.rs`. Los scripts de Fernando (`tools/scraping/`, PR #1) descargan los archivos, pero corren con Nix: la conversión tiene que quedar en Docker. Avisa a Fernando y a mí antes de unir a `main`, porque cambia el formato de datos.

## Assumptions

- La variable concreta de carbono negro (masa en columna o en superficie) la confirma Andres al abrir el archivo. Razón: ambas existen en el producto y la de columna se ve mejor desde el espacio.
- La capa `aerosol` llega después de las 11:00 p.m. o mañana temprano. Razón: la decisión de esa hora no depende de ella (Q1).
- El portátil de la demo soporta WebGL. Razón: es la condición normal de un navegador reciente.

## Out of scope

- Panel lateral y línea de tiempo; modo historia y pantalla de inicio (paso 13).
- Accesibilidad con teclado y lector de pantalla (paso 14).
- Motor de sonido (paso 10, de Fernando); este paso solo entrega el punto escuchado.
- La conversión de los datos de GEOS-FP y el cambio del formato de datos (los hace Andres).
- Capas globales de humo de GEOS-CF y de CO2.

## Open questions

- ¿Cuándo entrega Andres la capa `aerosol`? Lo acuerdan Samuel y Andres.
- ¿Se une la PR #1 de Fernando a `main`? Sus scripts son la base para la descarga.
