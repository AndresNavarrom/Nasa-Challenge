# Instrucciones de pruebas unitarias — Paso 12

## Configuración

- Vitest 3.2.7, ya configurado en `web/vitest.config.ts` con entorno `node`.
- Requisito único: Docker Desktop con las imágenes construidas (`docker compose --profile "*" build`).
- Las pruebas nuevas son de funciones puras; no necesitan navegador ni WebGL.

## Cómo correr las pruebas de este trabajo

Desde la raíz del proyecto, solo los archivos de este paso:

```bash
docker compose run --rm web-test npx vitest run src/scene/geo.test.ts src/scene/layerTexture.test.ts
```

Todo el conjunto de la interfaz, para confirmar que las pruebas existentes siguen en verde:

```bash
docker compose run --rm web-test
```

## Pruebas previstas (estrategia mínima: 8 pruebas)

| Archivo | Prueba | Requisito |
|---|---|---|
| `web/src/scene/geo.test.ts` | El ecuador en el meridiano cero va y vuelve entre punto de la esfera y longitud/latitud | FR4.1 |
| `web/src/scene/geo.test.ts` | Un punto de la Amazonía va y vuelve entre punto de la esfera y longitud/latitud | FR4.1 |
| `web/src/scene/geo.test.ts` | Las esquinas y el centro del plano del mundo dan las longitudes y latitudes esperadas | FR4.2 |
| `web/src/scene/geo.test.ts` | Un punto dentro y otro fuera del rectángulo de la Amazonía | FR2.1 |
| `web/src/scene/geo.test.ts` | La posición horizontal se limita a 0..1 fuera del lienzo | FR4.3 |
| `web/src/scene/geo.test.ts` | La rotación hacia el centro de la Amazonía deja ese punto mirando a la cámara | FR2.1 |
| `web/src/scene/layerTexture.test.ts` | Una cuadrícula de 2 × 2 da los colores y transparencias esperados en el primer instante | FR1.2 |
| `web/src/scene/layerTexture.test.ts` | Una cuadrícula con menos bytes de los declarados falla con un mensaje que nombra la capa | FR1.3 |

## Cobertura esperada

El plan elegido (`poc`) no fija un mínimo de cobertura de líneas. Objetivo: una prueba por cada función pura nueva (NFR3). La escena 3D, la transición y los controles se revisan a mano con `docs/PLANET-CHECKLIST.md`.

## Dobles y simulaciones

- No se simula WebGL ni three.js: las funciones probadas son matemática pura y arreglos de bytes.
- `layerTextureFor`, que crea la textura de three.js, no se prueba aquí; su conversión de bytes (`gridToRgba`) sí.

## Datos de prueba

- Cuadrículas pequeñas escritas dentro de cada prueba.
- El rectángulo de la Amazonía de prueba se escribe en la prueba; no se lee `web/public/data/`.
