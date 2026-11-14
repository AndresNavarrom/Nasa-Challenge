# Instrucciones de pruebas unitarias — Jukebox Terrestre

## Configuración

- **Interfaz y sonido**: Vitest, configurado en `web/vitest.config.ts`, entorno `node` (las funciones probadas son puras y no necesitan navegador).
- **Preparación de datos**: pruebas integradas de Rust dentro de `tools/prep/src/`.
- Requisitos: Docker Desktop. Sin Docker: Node.js 20 o superior y Rust estable con `cargo`.

## Cómo correr las pruebas de este trabajo

### Con Docker (la forma del equipo)

El equipo corre todo en contenedores; solo hace falta Docker Desktop. Desde la raíz del proyecto:

```bash
docker compose run --rm web-test
```

```bash
docker compose run --rm prep-test
```

`web-test` corre los archivos de prueba de `web/src/` que existan; `prep-test` corre `cargo test` en `tools/prep/`.

### Sin Docker

`src/ui/a11y.test.ts` aparece con el Step 14; hasta entonces, quitarlo del comando de abajo.

Desde la raíz del proyecto, primero instalar una vez las dependencias de la interfaz:

```bash
npm --prefix web install
```

Pruebas de la interfaz y el sonido (solo estos archivos):

```bash
npm --prefix web exec -- vitest run src/lib/interpolate.test.ts src/lib/timeline.test.ts src/audio/mapping.test.ts src/ui/a11y.test.ts
```

Pruebas de la preparación de datos (solo este paquete):

```bash
cargo test --manifest-path tools/prep/Cargo.toml
```

## Pruebas previstas (estrategia mínima: 12 pruebas)

| Archivo | Pruebas | Requisito |
|---|---|---|
| `web/src/lib/interpolate.test.ts` | Interpolación bilineal entre celdas; interpolación en el tiempo entre dos instantes; una capa fija no cambia con el tiempo; coordenadas fuera de la cuadrícula se limitan al borde | FR1.5 |
| `web/src/lib/timeline.test.ts` | La posición 0 a 1 da la fecha correcta de cada capa | FR7 |
| `web/src/audio/mapping.test.ts` | La altura del bosque cae siempre en una nota de la escala; más CO2 da respiración más rápida; valores fuera de 0 a 1 se limitan | FR3.1, FR3.3, FR3.4 |
| `web/src/ui/a11y.test.ts` | La descripción dice capa, lugar y nivel bajo, medio o alto | FR9.2 |
| `tools/prep/src/` | Color a valor con barra de color; brillo como respaldo; reducción a cuadrícula del tamaño pedido; error con imagen de tamaño inválido | FR1.4 |

## Cobertura esperada

El plan elegido (`poc`) no fija un mínimo de cobertura de líneas. El objetivo es una prueba por cada pieza con lógica propia (NFR7). No se mide cobertura de líneas en esta etapa.

## Dobles y simulaciones

- Las funciones de mapeo e interpolación son puras: no se simula el audio ni el navegador.
- El motor de sonido (`web/src/audio/engine.ts`) y la escena 3D no tienen prueba automática; se revisan con `docs/DEMO-CHECKLIST.md`.

## Datos de prueba

- Cuadrículas pequeñas (2 × 2 y 3 × 3) escritas dentro de cada prueba.
- En Rust, imágenes de pocos píxeles creadas en memoria; no se usan archivos de la NASA en las pruebas.
