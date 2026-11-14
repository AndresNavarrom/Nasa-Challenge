# Resumen del código — Jukebox Terrestre (prueba de concepto)

## Alcance de esta construcción

Se construyeron los Steps 1 a 9 del plan. Los Steps 10 a 16 no se construyeron por decisión del equipo, que los hará por su cuenta ("en el paso 8 frena el agente, para poder poner al resto de mis compañeros el plan para elaborar tambien"; luego, "dale, para el 9"). Lo que existe es la base: proyecto armado, datos reales preparados y la lógica pura con sus pruebas. No hay todavía sonido audible, planeta 3D ni servidor local.

## Archivos creados

- `README.md`
- `web/`: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `.gitignore`
- `web/src/`: `main.tsx`, `App.tsx` (cascarón que carga los datos y lista las capas), `index.css`
- `web/src/data/`: `types.ts`, `loadManifest.ts`, `loadManifest.test.ts`
- `web/src/lib/`: `interpolate.ts`, `interpolate.test.ts`, `timeline.ts`, `timeline.test.ts`
- `web/src/audio/`: `mapping.ts`, `mapping.test.ts`
- `web/public/data/`: `manifest.json`, `earth.jpg`, y por capa un `.bin` y un `.png` (`forest_global`, `forest_region`, `smoke_region`, `co2_region`)
- `tools/fetch-frames.sh`
- `tools/prep/`: `Cargo.toml`, `Cargo.lock`, `.gitignore`, `src/` (`main.rs`, `error.rs`, `color.rs`, `grid.rs`, `project.rs`, `config.rs`, `pipeline.rs`, `sample.rs`)
- `server/`: `Cargo.toml`, `Cargo.lock`, `.gitignore`, `src/main.rs` (solo esqueleto; el servidor es del Step 11)
- `data/`: `prep-config.json`, `SOURCES.md`, `.gitignore`, `raw/` (49 MB de cuadros descargados, no se versionan)

## Datos

Las tres capas usan cuadros reales de la NASA; ninguna usa datos de ejemplo. Los datos preparados pesan 1,2 MB.

| Capa | Fuente | Instantes | Cobertura |
|---|---|---|---|
| Bosque | SVS 4950, video del globo que rota | 14 cuadros unidos en mosaico | Global (144 × 72) y Amazonía (96 × 72) |
| Humo | SVS 5533, versión EIC de mapa plano | 6 | Solo Amazonía |
| CO2 | SVS 5196, video de cámara en órbita | 12, del 23 al 25 de febrero de 2020 cada 6 horas | Solo Amazonía |

## Decisiones clave

- **Humo y CO2 quedaron solo regionales** (`global` es `null`), por el plan B del plan: no hay vista global plana utilizable de esas visualizaciones. En el planeta solo el bosque tiene datos globales.
- **Las etiquetas de tiempo del humo son tiempos del clip**, no fechas: el video no trae sello de fecha.
- **La ubicación geográfica de las vistas de globo es aproximada** (error de 1 a 2 grados), ajustada a mano con puntos de costa.
- **Los valores son intensidades relativas** leídas de cuadros renderizados, no mediciones físicas. Está dicho en `README.md` y `data/SOURCES.md`.
- **La imagen base del planeta es de SVS 3615**, no Blue Marble, porque el servidor de Blue Marble no respondió.
- No hay archivos .exr publicados para estas visualizaciones.

## Pruebas

| Conjunto | Resultado | Cómo se corrió |
|---|---|---|
| Interfaz y sonido, comando de las instrucciones | 10 pasan, 0 fallan (3 archivos) | Con Deno (`deno run -A npm:vitest run …`), no con npm |
| Todas las pruebas de `web/` | 13 pasan, 0 fallan (4 archivos) | Con Deno |
| `cargo test --manifest-path tools/prep/Cargo.toml` | 5 pasan, 0 fallan | Tal como está escrito |
| Compilación de la interfaz | Termina bien | `deno task build`, no `npm run build` |
| `cargo build` de `tools/prep` y `server` | Compilan | Tal como está escrito |

No se mide cobertura de líneas en esta etapa.

## Pruebas escritas o previstas que no se ejecutaron

- **Los comandos `npm` de `unit-test-instructions.md` no se corrieron tal cual**: en la máquina no hay Node.js ni npm. Se verificó lo mismo con Deno 2.9.8, que ya estaba instalado. Nadie ha corrido aún `npm install`, `npm run build` ni las pruebas con npm.
- **`web/src/ui/a11y.test.ts` no existe**: pertenece al Step 14, que no se construyó. El comando de las instrucciones lo nombra y fallará en ese archivo hasta que exista.
- **Nada se probó en un navegador**: ni la pantalla ni el sonido.

## Desviaciones del plan

- **Tercer método de color a valor, solo para el CO2** (rojo menos azul). El gas se dibuja semitransparente y la barra de color comprimía los valores a un rango muy estrecho. Los requisitos solo nombran barra de color y brillo.
- **Archivo `data/prep-config.json`** y proyección de vistas de globo además de mapas planos; el plan no los nombraba y sin ellos no se podían usar los cuadros de globo.
- **Dos elementos del archivo de datos que el plan no nombraba**: el campo `sample` por capa, y que `global` pueda ser `null`.
- **Más pruebas de las previstas**: 18 en total frente a 12 (5 en Rust, 13 en la interfaz).
- **Versiones exactas fijadas en `web/package.json`**, porque sin npm no hay `package-lock.json`.
- **`README.md` y `App.tsx` adelantados en parte** respecto a los Steps 16 y 12.
- **Archivos `.gitignore` propios** en `web/`, `data/`, `tools/prep/` y `server/`.
- **Dos faltas del desarrollo a sus reglas de trabajo**: un archivo se editó una vez con un comando de consola, y las imágenes de revisión quedaron fuera del proyecto, en una carpeta temporal.

## Para continuar con los Steps 10 a 16

- `loadJukeboxData()` devuelve las capas y el rectángulo de la Amazonía; `sampleLayerAt(…)` da un valor de 0 a 1, o `null` donde la capa no tiene datos.
- `web/src/audio/mapping.ts` ya calcula nota y armonía del bosque, aspereza y filtro del humo, ritmo de respiración del CO2, paneo y volumen; con `null` el volumen es 0.
- `web/node_modules` lo creó Deno: hay que borrarlo antes de usar `npm install`.
- Las texturas de humo y CO2 son solo del primer instante; para que imagen y sonido avancen juntos conviene dibujarlas desde las cuadrículas.
- El título "Global CO2" ya no describe una capa que solo cubre la Amazonía; se cambia en `data/prep-config.json`.
