# Plan de generación de código — Paso 12: planeta 3D, transición y mapa de la Amazonía

## Summary

- Builds: el planeta 3D que gira con la capa activa, la transición de ida y vuelta al mapa de la Amazonía, el punto escuchado (longitud, latitud y posición en pantalla) para el sonido, un indicador de valor y un modo liviano para el plan B
- Touches: rama `interfaz`; nuevos `web/src/scene/` y `web/src/ui/`; reemplaza el cuerpo de `web/src/App.tsx`; `README.md` (sección de la vista del planeta); nuevo `docs/PLANET-CHECKLIST.md`
- Tests: 8 pruebas unitarias en Vitest (6 de conversión de coordenadas, 2 de textura de capa)

## Alcance y origen

El plan elegido (`poc`) no divide el trabajo en unidades ni tiene historias de usuario: cada paso se liga a los requisitos de `requirements.md` (`FR…`, `NFR…`). Orden de pruebas: test-after. Base de código: `aidlc/spaces/default/codekb/Nasa-Challenge/` (React 19, three 0.177.0, @react-three/fiber 9.8.2, gsap 3.15.1, Vitest con entorno `node`).

No se agregan dependencias nuevas: el arrastre del planeta se hace a mano, sin drei.

No se cambia el formato de datos ni la lista de capas: eso es de Andres Navarro (FR5.1). El código del planeta es genérico, así que la capa `aerosol` aparece sola cuando Andres la agregue (FR1.3, FR5.2).

### Reglas que este plan fija (puntos abiertos de la revisión de requisitos)

- **Instante que se muestra**: mientras no exista la línea de tiempo (paso 13), toda capa se dibuja y se lee en su primer instante (posición de tiempo 0). Afecta a `aerosol` y a humo y CO2.
- **Punto escuchado**: la posición horizontal va de 0 (borde izquierdo) a 1 (borde derecho) del lienzo 3D. Vale nulo cuando el cursor está fuera del planeta o del mapa y durante toda la transición.
- **Clic sobre la Amazonía**: se convierte el punto a longitud y latitud con la misma función del cursor y se comprueba si cae dentro de `region.bbox`.
- **Cuadros por segundo**: un contador en pantalla (promedio del último segundo) y, como respaldo, el monitor de rendimiento del navegador.

## Pasos

- [x] **Step 1 — Rama de trabajo.** Crear la rama `interfaz` desde la `main` actual con `git switch -c interfaz` (la descripción del trabajo lo pide). No se hace commit ni push en este paso. (FR1)
- [x] **Step 2 — Corredor de pruebas.** Confirmar que el comando acotado de `unit-test-instructions.md` corre con Vitest en el contenedor `web-test` antes de la primera prueba nueva. (NFR3)
- [x] **Step 3 — Funciones de coordenadas.** `web/src/scene/geo.ts`, funciones puras:
  - `spherePointToLonLat(x, y, z)` y `lonLatToSpherePoint(lon, lat)`, con la misma convención de la esfera que dibuja la escena (FR4.1);
  - `planeUvToLonLat(u, v)` para el plano del mundo aplanado (FR4.2);
  - `isInsideBbox(lon, lat, bbox)` para el clic sobre la Amazonía (FR2.1);
  - `screenX01(clientX, canvasLeft, canvasWidth)` limitada a 0..1 (FR4.3);
  - `bboxCenter(bbox)` y la rotación que deja ese centro mirando a la cámara (FR2.1).
- [x] **Step 4 — Pruebas de coordenadas.** `web/src/scene/geo.test.ts`: el ecuador en el meridiano cero y un punto de la Amazonía van y vuelven entre esfera y longitud/latitud; las esquinas y el centro del plano dan las longitudes y latitudes esperadas; un punto dentro y otro fuera del rectángulo de la Amazonía; la posición horizontal se limita a 0..1 fuera del lienzo. (FR4.1, FR4.2, FR2.1, FR4.3)
- [x] **Step 5 — Textura de capa desde la cuadrícula.** `web/src/scene/layerTexture.ts`: `gridToRgba(grid, frame, ramp)` convierte un instante de la cuadrícula en píxeles RGBA con una rampa de color por capa (verdes para `forest`, grises a marrones para `smoke` y `aerosol`, ámbar para `co2`, y una rampa neutra para cualquier id desconocido), con transparencia proporcional al valor; falla con un mensaje claro si la cuadrícula no tiene el tamaño declarado. Y `layerTextureFor(layer)` que arma la textura de three.js del primer instante (global si existe; la regional se usa en el mapa). (FR1.2, FR1.3, FR3, FR5.2)
- [x] **Step 6 — Prueba de textura.** `web/src/scene/layerTexture.test.ts`: una cuadrícula de 2 × 2 da los colores y transparencias esperados en el primer instante; una cuadrícula con menos bytes de los declarados falla con un mensaje que nombra la capa. (FR1.2, FR1.3)
- [x] **Step 7 — Punto escuchado compartido.** `web/src/scene/listeningPoint.tsx`: un contexto de React con `{ lon, lat, screenX } | null`, su proveedor y un gancho de lectura, para que el motor de sonido (paso 10) lo lea sin depender de la escena. (FR4.3)
- [x] **Step 8 — Malla del planeta que se aplana.** `web/src/scene/EarthMesh.tsx`: una sola malla segmentada cuyas posiciones mezclan esfera y plano del mundo según un valor `flatten` de 0 a 1 (sombreador o actualización de vértices); imagen base `earth.jpg` más la textura de la capa activa encima, semitransparente. La detección del punto bajo el cursor usa una esfera invisible cuando `flatten` es 0 y un plano invisible cuando es 1, y no detecta nada en medio. Giro automático lento y arrastre con el ratón cuando está en esfera. (FR1.1, FR1.2, FR3, FR4.1, FR4.2, NFR1)
- [x] **Step 9 — Transición.** `web/src/scene/FocusTransition.ts`: con GSAP, la ida gira el planeta hasta centrar la Amazonía, lleva `flatten` de 0 a 1 y acerca la cámara al rectángulo de la región, todo en 2 segundos o menos; la vuelta hace lo inverso en 2 segundos o menos y reanuda el giro. Durante la animación el punto escuchado vale nulo. (FR2.1, FR2.2, FR4.3)
- [x] **Step 10 — Escena.** `web/src/scene/EarthScene.tsx`: el lienzo de @react-three/fiber, luces, cámara, `EarthMesh`, el clic sobre la Amazonía (FR2.1), la actualización del punto escuchado al mover el cursor y el valor de la capa activa con `sampleLayerAt` en el primer instante. Modo liviano para el plan B: con `?lite=1` en la dirección usa texturas a la mitad de resolución y cambia de vista al instante, sin aplanado animado. (FR1, FR2, FR3, FR4, Plan B)
- [x] **Step 11 — Controles mínimos.** `web/src/ui/PlanetHud.tsx`: botones "Amazon" y "Back to Earth" (FR2.1, FR2.2), un selector temporal de capa activa con las capas del archivo de datos (FR1.4), el indicador de longitud, latitud y valor (FR4.4) y el contador de cuadros por segundo (NFR1). Todos los controles con `data-testid`.
- [x] **Step 12 — App.** Reemplazar el cuerpo de `web/src/App.tsx`: conserva la carga de datos y sus mensajes de carga y de error, y monta el proveedor del punto escuchado, `EarthScene` y `PlanetHud`. Sin `aerosol` en el archivo de datos todo funciona con las capas que hay. (FR1, FR5.3)
- [x] **Step 13 — Pruebas y compilación.** Correr el comando acotado de `unit-test-instructions.md`, todo el conjunto con `docker compose run --rm web-test` (las 13 pruebas existentes siguen en verde) y la compilación con `docker build --target build web`. (NFR3)
- [x] **Step 14 — Documentación.** Sección "Planet view" en `README.md` (cómo verla, el modo `?lite=1`, cómo leer el contador) y `docs/PLANET-CHECKLIST.md` con la revisión manual en el navegador: giro y arrastre, capa activa, transición de ida y vuelta medida, mapa, indicador sobre la Amazonía frente a un punto de océano, 30 cuadros por segundo, y que nada se cargue de internet (pestaña de red). (NFR1, NFR2, FR4.4)

## Lo que este plan no construye

- La capa `aerosol` y el cambio del formato de datos (FR5.1): los entrega Andres Navarro.
- Panel lateral definitivo, línea de tiempo, modo historia, pantalla de inicio y accesibilidad (pasos 13 y 14).
- Motor de sonido (paso 10, de Fernando): este plan solo deja el punto escuchado.

## Riesgos del plan

- Si la malla que se aplana no llega a 30 cuadros por segundo, se aplica el plan B con `?lite=1` (texturas más pequeñas y cambio directo al mapa).
- La convención de coordenadas de la esfera tiene que coincidir con la de la imagen base; las pruebas del Step 4 lo fijan con puntos conocidos.
- Lo visual (aspecto, fluidez, tiempo de la transición) solo se comprueba en el navegador, con `docs/PLANET-CHECKLIST.md`.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "org",
  "ordering": "implement each applicable testable layer, then write and run that layer's tests.",
  "scope": "poc",
  "test_strategy": "minimal",
  "project_type": "brownfield",
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
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
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
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
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
  "input_sha256": "sha256:04b9b96625a5fdb1ca6669f4c5c779aaa2bc58912cd9db366657d591f9f98c84",
  "contract_sha256": "sha256:c039c687da4f6501d518118720bb16501c074a1cc249b5a2ccada81243a04a32"
}
```
