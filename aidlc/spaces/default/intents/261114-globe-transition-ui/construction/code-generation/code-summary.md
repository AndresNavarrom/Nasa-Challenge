# Resumen del código — Paso 12: planeta 3D, transición y mapa de la Amazonía

Se construyeron los 14 pasos de `code-generation-plan.md`, en la rama `interfaz` (creada desde la `main` anterior a la unión de la PR #1). Sin commit ni push.

## Archivos

Nuevos:

- `web/src/scene/geo.ts` y `web/src/scene/geo.test.ts` (6 pruebas): conversión entre punto de la esfera, plano del mundo y longitud/latitud; punto dentro del rectángulo de la Amazonía; posición horizontal 0..1; rotación hacia el centro de la región.
- `web/src/scene/layerTexture.ts` y `web/src/scene/layerTexture.test.ts` (2 pruebas): textura RGBA de una capa desde su cuadrícula, con rampa de color por capa y una neutra para ids nuevos.
- `web/src/scene/listeningPoint.tsx`: punto escuchado compartido; el motor de sonido lo lee con `useListeningPoint()`, que devuelve `{ lon, lat, screenX } | null`.
- `web/src/scene/EarthMesh.tsx`: una sola malla que pasa de esfera a plano según `flatten`, con sombreador propio, imagen base y capa activa encima; detección del cursor con una esfera o un plano invisibles.
- `web/src/scene/FocusTransition.ts`: transición con GSAP (1,6 s de ida y 1,4 s de vuelta, según el código).
- `web/src/scene/EarthScene.tsx`: lienzo, cámara, clic sobre la Amazonía, punto escuchado, valor con `sampleLayerAt` en el primer instante, y modo liviano `?lite=1`.
- `web/src/ui/PlanetHud.tsx`: botones "Amazon" y "Back to Earth", selector temporal de capa, indicador de longitud, latitud y valor, y contador de cuadros por segundo.
- `docs/PLANET-CHECKLIST.md`: revisión manual en el navegador.

Cambiados:

- `web/src/App.tsx`: cuerpo reemplazado; conserva la carga de datos y sus mensajes de carga y de error.
- `README.md`: se agregó la sección "Planet view"; el resto quedó igual.

No se tocó el formato de datos (`web/src/data/`, `tools/`, `data/`, `web/public/data/`) ni se agregaron dependencias.

## Decisiones

- **Capas solo regionales en el planeta**: el humo y el CO2 se dibujan dentro del rectángulo de la Amazonía, tanto en el planeta como en el mapa, y en ningún otro lugar, igual que lee `sampleLayerAt`.
- **Instante que se muestra**: el primero de cada capa, hasta que exista la línea de tiempo.
- **Punto escuchado**: posición horizontal de 0 a 1 sobre el ancho del lienzo; nulo fuera del planeta o del mapa y durante la transición.
- **Sin luces de three.js**: el sombreador propio calcula una luz suave en la esfera y deja el mapa con luz pareja.
- **Modo liviano `?lite=1`**: imagen base a la mitad, malla de 64 × 32 en vez de 128 × 64, sin antialiasing, densidad de píxeles 1 y cambio de vista al instante.

## Pruebas

| Comando | Resultado |
|---|---|
| `docker compose run --rm web-test npx vitest run src/scene/geo.test.ts src/scene/layerTexture.test.ts` | 8 pasan, 0 fallan |
| `docker compose run --rm web-test` | 21 pasan, 0 fallan (las 13 anteriores siguen en verde) |
| `docker compose run --rm web-test npm run typecheck` | Sin errores |
| `docker build --target build web` | Correcta; un paquete JS de 1196 kB (343 kB comprimido) |
| `docker compose up -d web` y `curl` | `/`, `/src/scene/EarthScene.tsx` y `/data/earth.jpg` responden 200 |

Una prueba de coordenadas falló al primer intento por una diferencia de una millonésima de grado: three.js guarda los vértices con precisión simple. La comparación quedó a 4 decimales, que es la precisión real de esos datos; la convención no cambió.

No se mide cobertura de líneas (plan `poc`).

## Pruebas no ejecutadas

Todo lo visual quedó sin comprobar, porque aquí no hay navegador con WebGL; está en `docs/PLANET-CHECKLIST.md`:

- el aspecto del planeta y que la capa coincida con la imagen base;
- el giro y el arrastre;
- el tiempo real de la transición;
- los 30 cuadros por segundo;
- que nada se cargue de internet;
- el aviso si falla `earth.jpg` o si el navegador no tiene WebGL.

No hay pruebas automáticas de los componentes de React ni de la escena: el plan no las pedía.

## Desviaciones del plan

- `layerTextureFor(layer)` devuelve dos texturas (`global` y `region`) en vez de una.
- `gridToRgba` recibe el id de la capa como cuarto parámetro, para que el mensaje de error la nombre.
- Funciones auxiliares que el plan no nombraba: `lonLatToPlanePoint` y `nearestEquivalentAngle` en `geo.ts`, y `mapCameraZ` en `FocusTransition.ts`.
- `listeningPoint.tsx` usa dos contextos (valor y función que lo cambia) para no redibujar la escena a cada movimiento del cursor; la lectura para el sonido es la del plan.
- La segunda parte del plan B (planeta fijo sin giro libre) no está construida; `?lite=1` cubre la primera parte y el cambio directo al mapa.

## Riesgos para la decisión de las 11:00 p.m.

- La fluidez solo se mide en el portátil de la demo.
- A mitad de la transición la cara oculta del planeta se despliega hacia el plano; hay que ver si se ve bien.
- La capa `aerosol` sigue pendiente de Andres; el planeta la mostrará sola cuando llegue.
- La rama `interfaz` salió de la `main` anterior a la PR #1; hay que traer `main` antes de unirla.
