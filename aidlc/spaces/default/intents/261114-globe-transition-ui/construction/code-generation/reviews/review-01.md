## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-14T23:00:48Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | web/src/scene/EarthMesh.tsx > handleSphereMove, onPointerMove de la esfera invisible; web/src/scene/EarthScene.tsx > handleHover | El punto escuchado y el valor del indicador solo se recalculan cuando el cursor se mueve (el lanzamiento de rayos de R3F ocurre con eventos del puntero). Con el planeta girando solo (SPIN_SPEED 0,08 rad/s, unos 4,6 grados por segundo) y el cursor quieto, la longitud, la latitud y el valor mostrados quedan viejos y no corresponden a lo que hay bajo el cursor. Tras terminar una transición el punto también queda nulo hasta que el cursor se mueva. Para el sonido (FR4.3) la pista no sigue la rotación. No es un fallo de la fluidez, pero engaña al comprobar FR4.4 en la demo. | Volver a calcular el punto bajo el cursor en cada cuadro mientras el planeta gira (guardar el último clientX/clientY y hacer un raycast en useFrame), o documentar en `docs/PLANET-CHECKLIST.md` que el valor solo se actualiza al mover el cursor, para que no se tome como defecto. | New |
| R-02 | Major | web/src/scene/EarthScene.tsx > modo liviano `?lite=1`; aidlc/spaces/default/intents/261114-globe-transition-ui/construction/code-generation/code-summary.md > Desviaciones del plan; docs/PLANET-CHECKLIST.md línea 58 | El plan B de los requisitos son dos pasos: texturas más pequeñas y, si no basta, planeta fijo sin giro libre con cambio directo al mapa. Solo está construido el primero; `?lite=1` mantiene el giro automático, el arrastre, la misma malla de shader y los paneles con `backdrop-blur`. La lista de verificación lo presenta como "plan B" completo. Si a las 11:00 p.m. la versión liviana sigue por debajo de 30 fps, no hay un segundo nivel al que bajar, y la medición en modo liviano puede salir casi igual que la completa. | Decir en la lista de verificación que `?lite=1` es solo el primer escalón del plan B y que el planeta fijo no existe. Si hay tiempo, hacer que `lite` apague también el giro, el arrastre y el desenfoque de los paneles. | New |
| R-03 | Minor | web/src/scene/EarthScene.tsx > FpsProbe; web/src/ui/PlanetHud.tsx | El contador promedia cada segundo. La transición dura 1,6 s, así que una caída puntual durante el aplanado queda diluida con los cuadros fluidos antes y después. Es justo el tramo que decide NFR1. | Comprobar la transición mirando el Performance monitor del navegador; indicarlo en la lista de verificación junto con el contador. | New |
| R-04 | Minor | web/src/scene/EarthMesh.tsx > handlePlaneMove, plano de selección de PLANE_WIDTH x PLANE_HEIGHT; aidlc/spaces/default/intents/261114-globe-transition-ui/inception/requirements-analysis/requirements.md > FR4.2 | FR4.2 pide la conversión dentro de `region.bbox`; la función `planeUvToLonLat` y su prueba cubren el plano del mundo entero (el comportamiento es correcto porque el mapa es el mundo aplanado, y la prueba verifica las esquinas del bbox a través de `lonLatToUV`). En pantallas más anchas que el bbox el cursor puede quedar fuera de la Amazonía y dar lon/lat de fuera sin aviso. | Aceptable para la demo; anotarlo en el resumen del código como interpretación de FR4.2. | New |
| R-05 | Minor | web/src/scene/FocusTransition.ts > playFocus / playReturn | Las duraciones (1,6 s y 1,4 s) cumplen el tope de 2 s de FR2.1 y FR2.2 solo en código; el tiempo real depende de los cuadros del portátil, y sin cuadros suficientes GSAP salta el tiempo y la animación se ve brusca aunque dure lo mismo. | Revisar en el navegador que la animación se ve continua, no solo que termina a tiempo. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `docker compose run --rm web-test` | PASS: 6 archivos, 21 pruebas pasan, 0 fallan (geo.test.ts 6, layerTexture.test.ts 2, más las 13 anteriores) | Coincide con lo dicho en code-summary.md. Las funciones puras de FR4.1 y FR4.2 están cubiertas. Nada visual está probado. |
| `docker compose run --rm web-test npx vitest run src/scene/geo.test.ts src/scene/layerTexture.test.ts` | No ejecutado por separado: la corrida completa ya incluye esos dos archivos con 8 pruebas en verde | Sin información adicional. |

### Summary

No hay fallos críticos: las convenciones de coordenadas, de filas de texturas (norte primero) y de rotación son coherentes entre geo.ts, el sombreador y el plano de selección, y las pruebas pasan. Lo que puede engañar la decisión de las 11:00 p.m. es que el valor bajo el cursor se queda viejo mientras el planeta gira solo, y que `?lite=1` es solo la mitad del plan B.
