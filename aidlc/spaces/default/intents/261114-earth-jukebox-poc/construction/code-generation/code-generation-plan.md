# Plan de generación de código — Jukebox Terrestre (prueba de concepto)

## Summary

- Builds: app web local con el planeta en 3D, tres capas (bosque, humo, CO2) que suenan en tiempo real, transición al mapa de la Amazonía, y las herramientas en Rust que preparan los datos y sirven la app sin internet
- Touches: `web/` (React, Tailwind, GSAP, three.js), `tools/prep/` (Rust, preparación de datos), `server/` (Rust, Axum, servidor local), `data/` (cuadros descargados), `README.md`, `docker-compose.yml` y los `Dockerfile` de cada parte
- Tests: 12 pruebas unitarias (8 en Vitest para interpolación, mapeo a sonido y línea de tiempo; 4 en `cargo test` para color a valor y cuadrículas)

## Alcance y origen

El plan elegido no divide el trabajo en unidades ni tiene historias de usuario, así que cada paso se liga a los requisitos de `requirements.md` (`FR…`, `NFR…`). Orden de pruebas: test-after (se implementa cada capa y luego se escriben y corren sus pruebas).

Estructura del proyecto:

```
web/            interfaz, sonido y pruebas de Vitest
tools/prep/     programa Rust: cuadros -> cuadrículas de intensidad
server/         programa Rust (Axum): sirve web/dist de forma local
data/raw/       cuadros descargados de la NASA (no se versionan si pesan)
web/public/data/  datos preparados que usa la app
```

## Formato del archivo de datos

Lo pide FR1.4 (dos cuadrículas por capa), FR1.5 (instantes para interpolar), FR2 (archivos empaquetados), FR7 (fechas visibles) y FR9.2 (descripciones). Un archivo `web/public/data/manifest.json` y un archivo binario por capa y vista.

`manifest.json`:

- `layers[]`: una entrada por capa, con
  - `id` (`forest`, `smoke`, `co2`) — FR1.1, FR1.2, FR1.3
  - `title`, `description` (texto en inglés para el panel y el lector de pantalla) — FR9.2
  - `source` (título y enlace de la visualización de la NASA) — FR10.2
  - `static` (verdadero para el bosque) — FR1.5, FR7
  - `dates[]` (etiqueta de fecha de cada instante) — FR7
  - `global` y `region`: cada uno con `width`, `height`, `frames`, `file` (ruta del binario) y `texture` (imagen para dibujar la capa) — FR1.4, FR5
- `region.bbox` (`west`, `south`, `east`, `north`, en grados) — FR1.4, FR5.2

Binario de cuadrícula: valores de 0 a 255 (un byte por celda, que la app divide entre 255), ordenados por instante, fila y columna — FR1.4.

## Pasos

- [x] **Step 1 — Estructura y configuración base.** Crear `web/` con Vite, React, TypeScript, Tailwind, GSAP, three.js y react-three-fiber; crear los proyectos Rust `tools/prep/` y `server/`; `README.md` con cómo ejecutar. (FR2, FR10.3, NFR1)
- [x] **Step 2 — Preparar el corredor de pruebas.** Configurar Vitest en `web/` (`web/vitest.config.ts`) y confirmar que `cargo test` corre en `tools/prep/`; dejar los comandos exactos en `unit-test-instructions.md`. (NFR7)
- [x] **Step 3 — Datos: tipos y lectura del archivo.** `web/src/data/types.ts` y `web/src/data/loadManifest.ts`: leer `manifest.json` y los binarios, validar tamaños y fallar con un mensaje claro si falta o no cuadra un archivo. (FR1.4, FR2)
- [x] **Step 4 — Datos: preparación en Rust.** `tools/prep/`: leer png, jpg y tif (y .exr si aparecen), convertir color a intensidad con la barra de color o con el brillo, recortar la Amazonía por su rectángulo, reducir a cuadrículas global (72 × 36 o más) y regional (32 × 32 o más), escribir binarios, texturas y `manifest.json`. Incluye un modo `--sample` que genera datos de ejemplo para trabajar antes de tener los reales. Los cuadros de video se extraen antes con ffmpeg (comando en el `README.md`). (FR1, FR1.1, FR1.2, FR1.3, FR1.4, FR2)
- [x] **Step 5 — Pruebas de la preparación de datos.** `tools/prep/src/` con pruebas de `cargo test`: color a valor con barra de color, brillo como respaldo, reducción a cuadrícula, y rechazo de una imagen con tamaño inválido. (NFR7, FR1.4)
- [x] **Step 6 — Descarga de cuadros reales.** Script `tools/fetch-frames.sh` que descarga de svs.gsfc.nasa.gov los cuadros de SVS 4950, 5533 y 5196 a `data/raw/` y anota cada archivo y su enlace en `data/SOURCES.md`. Ejecutarlo y correr la preparación; si una capa no tiene vista global plana, dejarla solo regional y anotarlo en `data/SOURCES.md`. (FR1.1, FR1.2, FR1.3, FR10.2)
- [x] **Step 7 — Lógica: interpolación y línea de tiempo.** `web/src/lib/interpolate.ts` (bilineal en el espacio; lineal en el tiempo solo para capas no fijas) y `web/src/lib/timeline.ts` (posición común de 0 a 1 y fecha visible por capa). (FR1.5, FR7)
- [x] **Step 8 — Lógica: mapeo de valor a sonido.** `web/src/audio/mapping.ts`: bosque a nota dentro de una escala de cinco notas; humo a aspereza y filtro; CO2 a ritmo de respiración; posición a paneo; intensidad a volumen. Funciones puras, sin tocar el audio. (FR3.1, FR3.2, FR3.3, FR3.4)
- [x] **Step 9 — Pruebas de la lógica.** `web/src/lib/interpolate.test.ts`, `web/src/lib/timeline.test.ts`, `web/src/audio/mapping.test.ts`. (NFR7, FR1.5, FR3, FR7)
- [ ] **Step 10 — Motor de sonido.** `web/src/audio/engine.ts` con Web Audio API: una voz por capa, cambios con rampas suaves, mezcla con limitador, botón de inicio para desbloquear el audio, y medidor de salida. (FR3, FR4, FR6, NFR2, NFR5)
- [ ] **Step 11 — Servidor local.** `server/` con Axum: sirve `web/dist` y los datos en `127.0.0.1`, con mensaje claro si falta la carpeta. Sin base de datos. (FR2, NFR1, NFR6)
- [ ] **Step 12 — Interfaz: planeta y mapa.** `web/src/scene/Globe.tsx` (planeta que gira, con la textura de la capa activa), `web/src/scene/AmazonMap.tsx` (mapa regional), `web/src/scene/FocusTransition.tsx` (giro hacia la Amazonía y aplanado con GSAP, ida y vuelta en 2 segundos o menos). El punto bajo el cursor se convierte en latitud y longitud y alimenta el sonido. (FR5, FR5.2, FR6, NFR3)
- [ ] **Step 13 — Interfaz: panel lateral, tiempo e historia.** `web/src/ui/LayerSidebar.tsx`, `web/src/ui/TimelineBar.tsx`, `web/src/ui/StoryMode.tsx`, `web/src/ui/StartScreen.tsx`, todos con `data-testid` en los controles. (FR5.1, FR7, FR8)
- [ ] **Step 14 — Accesibilidad mínima.** Uso completo con teclado (capas, reproducir y pausar, flechas para mover el punto escuchado) y una región de texto que el lector de pantalla lee con la capa, el lugar y si el valor es bajo, medio o alto. `web/src/ui/a11y.ts` y su prueba `web/src/ui/a11y.test.ts`. (FR9, FR9.1, FR9.2)
- [ ] **Step 15 — Compilación y arranque sin internet.** Script `run-demo.sh` que compila la interfaz y arranca el servidor; comprobar que no se carga nada de internet (fuentes y texturas locales) y que los datos pesan menos de 200 MB. (FR2, NFR1, NFR4)
- [ ] **Step 16 — Documentación.** `README.md` en inglés (cómo ejecutar, cómo preparar los datos, fuentes de datos, uso de IA), `docs/DEMO-CHECKLIST.md` con la revisión manual de la demo (FR4, NFR2, NFR3, NFR5) y `docs/SUBMISSION.md` con los borradores en inglés para el formulario. (FR10.2, FR10.3, FR10.4)
- [ ] **Step 17 — Contenedores de Docker para correr, probar y desplegar.** Pedido del equipo: todo se corre con Docker. `web/Dockerfile` (Node 20: instalar dependencias con npm, pruebas, compilación y servidor de desarrollo), `tools/prep/Dockerfile` (Rust: pruebas y preparación de datos), `docker-compose.yml` en la raíz con los servicios `web` (interfaz en desarrollo, puerto 5173), `web-test` (pruebas de Vitest), `prep-test` (`cargo test`) y `prep` (regenerar los datos), y archivos `.dockerignore`. Generar `web/package-lock.json` con npm dentro del contenedor y borrar el `web/node_modules` y el `web/deno.lock` que dejó Deno. Correr las dos pruebas dentro de los contenedores. Documentar los comandos en `README.md`. El contenedor final de la app (interfaz compilada más servidor local) se completa con el Step 11 y el Step 15. (NFR7, FR10.3, NFR1)

## Lo que este plan no construye

- El video de 30 segundos (FR10.1): lo graba el equipo; el plan deja el modo historia y un guion en `docs/SUBMISSION.md`.
- El envío del formulario: lo hace el equipo con los textos de `docs/SUBMISSION.md`.

## Riesgos del plan

- Si el planeta o la transición no llegan a 30 cuadros por segundo, el Step 12 aplica el plan B de `requirements.md`: texturas más pequeñas, y si no basta, planeta fijo con cambio directo al mapa.
- Si una capa no tiene vista global plana, el Step 6 la deja solo regional.
- La textura base del planeta se toma de una imagen de la NASA de dominio público, guardada en el proyecto y anotada en `data/SOURCES.md`.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "org",
  "ordering": "implement each applicable testable layer, then write and run that layer's tests.",
  "scope": "poc",
  "test_strategy": "minimal",
  "project_type": "greenfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop`, `classic` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    }
  ],
  "obligations": {
    "strategy": "minimal",
    "strategy_volume": [
      "One verifiable test per requirement at the narrowest effective level.",
      "At least one happy-path unit test per component.",
      "Unit tests are the default; a bugfix/security scope floor may require an integration or E2E regression when that is the narrowest level that reproduces the defect."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:8ea1ef920e68ca73437a39f413355d71d0d909a57d5d857da31deb5d9355e261",
  "contract_sha256": "sha256:615d0f211ddcd07aebccb0dd6a68c9e4b811c5fab93b04a37004687ace5379de"
}
```
