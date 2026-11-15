# API Documentation

No hay API HTTP propia todavía: el servidor Axum (`server/`) es un esqueleto. Las superficies reales son el contrato de archivos de datos, las funciones exportadas de TypeScript, la CLI de preparación y las CLI de los scripts de descarga.

## 1. Contrato de datos estáticos (`web/public/data/`)

Escrito por `jukebox-prep` (`tools/prep/src/config.rs`, structs `Manifest`, `LayerOut`, `GridOut`) y leído por `web/src/data/loadManifest.ts` (tipos en `web/src/data/types.ts`). `TAREAS.md` prohíbe cambiarlo sin avisar a los tres responsables.

### `manifest.json`

```json
{
  "layers": [
    {
      "id": "forest | smoke | co2",
      "title": "texto",
      "description": "texto",
      "source": { "title": "texto", "url": "texto" },
      "static": true,
      "sample": false,
      "dates": ["una etiqueta por instante"],
      "global": { "width": 144, "height": 72, "frames": 1, "file": "forest_global.bin", "texture": "forest_global.png" },
      "region": { "width": 96, "height": 72, "frames": 1, "file": "forest_region.bin", "texture": "forest_region.png" }
    }
  ],
  "region": { "bbox": { "west": -80.0, "south": -20.0, "east": -44.0, "north": 8.0 } }
}
```

Reglas de validación del cliente (`parseManifest`): al menos una capa; `id` en `LAYER_IDS` (`types.ts:4`) y sin repetir; `dates.length === region.frames`; `global.frames === region.frames` cuando hay global; `global` puede ser `null`; `region` es obligatoria; enteros positivos en tamaños (sin máximo); `texture` debe ser texto no vacío aunque la escena no lo use; `bbox` con `west < east` y `south < north`. No hay campo para la imagen base: `earth.jpg` es un nombre fijo que la escena pide por su cuenta.

### Archivos `*.bin`

Un byte por celda (0..255; el cliente divide entre 255). Orden: instante → fila (norte primero) → columna (oeste primero). Tamaño exacto `width × height × frames`. Las celdas son centradas: la fila `r` de una cuadrícula global de alto `h` cubre la latitud `90 - (r + 0.5) * 180 / h` (`pipeline.rs:138`).

### Texturas

| Archivo | Tamaño | Cobertura | Uso |
|---|---|---|---|
| `earth.jpg` | 2048×1024 RGB fija (`EARTH_TEXTURE`, `pipeline.rs:21`), 233 KB | Planeta entero, equirectangular | Imagen base del planeta y del mapa (`EarthScene.tsx:147`) |
| `forest_global.png` | 1024×512 RGBA fija (`GLOBAL_TEXTURE`) | Planeta entero, equirectangular | Escrita por prep, no usada por la escena |
| `{forest,smoke,co2}_region.png` | 512×398 RGBA | `bbox` de la Amazonía | Escritas por prep, no usadas por la escena |

La escena dibuja cada capa desde su cuadrícula `.bin` (`layerTexture.ts`), solo el primer instante. Las PNG de capas con tiempo (`smoke`, `co2`) muestran solo el primer instante. Canal alfa de las PNG: opaco donde hay dato para `colorbar` sin `fade`; en otros métodos la opacidad crece con la raíz del valor.

Estado actual: `forest` (global 144×72 + región 96×72, 1 instante), `smoke` (solo región, 6 instantes), `co2` (solo región, 12 instantes). Total de `web/public/data/` unos 1.3 MB.

## 2. Funciones exportadas (TypeScript)

| Módulo | Firma | Comportamiento |
|---|---|---|
| `data/loadManifest.ts` | `loadJukeboxData(baseUrl = "./data/", fetcher?) : Promise<JukeboxData>` | Carga y valida todo; lanza `DataLoadError` |
| | `parseManifest(json: unknown): Manifest` | Validación pura |
| | `class DataLoadError extends Error` | Mensaje mostrable |
| `lib/interpolate.ts` | `sampleLayerAt(layer, bbox, lon, lat, framePosition): number \| null` | Región dentro de `bbox`, global fuera, `null` sin datos; normaliza longitud y limita latitud |
| | `sampleGrid(grid, u, v, { framePosition, isStatic, wrapX? })` | Bilineal + lineal en tiempo |
| | `sampleFrame(grid, frame, u, v, wrapX?)` | Bilineal de un instante |
| | `lonLatToUV(lon, lat, bbox)` | `{u, v}` (u oeste→este, v norte→sur) o `null` |
| | `normalizeLongitude(lon)`, `clamp01(v)`, `WORLD_BBOX` | Utilidades |
| `lib/timeline.ts` | `framePosition(position, frames)` | 0..1 → índice fraccional |
| | `dateLabelAt(layer, position)`, `advancePosition(pos, dt, duration, loop?)`, `clampPosition(p)` | Etiqueta y reproducción |
| `audio/mapping.ts` | `forestToVoice(v)`, `smokeToTimbre(v)`, `co2ToBreath(v)` | Parámetros por capa |
| | `positionToPan(horizontal)` | 0..1 en pantalla → paneo -0.9..0.9 |
| | `intensityToGain(v \| null)` | `null` → 0; mínimo activo 0.18 |
| `scene/layerTexture.ts` | `layerTextureFor(layer): { global: DataTexture \| null; region: DataTexture }` | Texturas RGBA del primer instante, filtro lineal, sin mipmaps; global con `RepeatWrapping` en S |
| | `gridToRgba(grid, frame, ramp, layerId): Uint8Array` | Lanza `Error` si faltan bytes o el instante no existe |
| | `rampFor(id)`, `LAYER_RAMPS`, `NEUTRAL_RAMP`, `FIRST_INSTANT`, `disposeLayerTextures` | Rampas por id (`forest`, `smoke`, `aerosol`, `co2`); ids desconocidos usan la neutra |
| `scene/EarthScene.tsx` | `EarthScene(props: EarthSceneProps)` | `data`, `activeLayer`, `targetView`, `lite`, `onRequestView`, `onModeChange`, `onProbe`, `onFps`, `onSceneError` |
| `scene/EarthMesh.tsx` | `EarthMesh(props: EarthMeshProps)` | `baseTexture`, `layerTextures`, `bbox`, `view`, `mode`, `segments` (128×64 normal, 64×32 lite), `onHover`, `onGlobeClick` |

Notas: `positionToPan` espera la posición horizontal del punto en pantalla (0 = borde izquierdo), no la longitud. Uniformes del shader de `EarthMesh`: `uBase`, `uHasBase`, `uLayerGlobal`, `uHasGlobal`, `uLayerRegion`, `uBbox`, `uLayerOpacity` (0.8), `uRotation`, `uFlatten`.

## 3. CLI `jukebox-prep`

```
jukebox-prep --sample [--out DIR]
jukebox-prep --config FILE [--raw DIR] [--out DIR]
```

Valores por defecto: `--raw data/raw`, `--out web/public/data`. Código de salida 2 para argumentos inválidos y 1 para fallos. En Docker: `docker compose run --rm prep` y `docker compose run --rm prep --sample`.

Configuración (`data/prep-config.json`):

| Campo | Tipo | Valor por defecto / límites |
|---|---|---|
| `bbox` | `{west, south, east, north}` | Amazonía `-80, -20, -44, 8` |
| `grid.global`, `grid.region` | `[ancho, alto]` | `[144, 72]` y `[96, 72]`; mínimos 72×36 y 32×32 (`grid.rs:6-7`); máximo 1024 por lado (`config.rs:78`) |
| `earth.file` | ruta en `--raw` | opcional; imagen de al menos 512×256, se reescala a 2048×1024 |
| `layers[].id` | texto | uno de `LAYER_IDS = ["forest", "smoke", "co2"]` (`config.rs:10`), sin repetir |
| `layers[].static` | bool | si es `true`, exactamente un instante |
| `layers[].global` | bool | `true` por defecto; `false` = solo región |
| `layers[].value` | `method: colorbar` (`stops`, `image {file, from, to, samples}`, `max_distance` 60, `fade`) \| `brightness` (`low`, `high`, `invert`) \| `warmth` (`low`, `high`) | |
| `layers[].instants[]` | `{date, views[]}` | al menos uno, con al menos una vista |
| `views[].file` | ruta en `--raw` | imagen PNG/JPEG/TIFF/EXR de al menos 32×32 |
| `views[].projection` | `type: equirect` (`west, south, east, north`, `rect` opcional) \| `orthographic` (`cx, cy, radius, center_lon, center_lat`, `roll`, `distance`, `min_weight` 0.25) | |
| `views[].masks` | `[[x, y, w, h], ...]` | rectángulos de píxeles a ignorar |

Constantes internas no configurables: `SUPERSAMPLE = 4`, `GLOBAL_TEXTURE = 1024×512`, `REGION_TEXTURE_WIDTH = 512`, `EARTH_TEXTURE = 2048×1024` (`pipeline.rs:18-21`). Prep no lee NetCDF ni video.

## 4. CLI de descarga

- `tools/fetch-frames.sh` (anfitrión, `curl` + `ffmpeg`; `FORCE=1` vuelve a descargar): escribe `data/raw/4950/`, `5533/`, `5196/`, `earth/` y reescribe entero `data/SOURCES.md`. Fuentes fijas en el script: SVS 4950 (video 1080p y barra de color), SVS 5533 (fotogramas remotos escalados a 1920×540), SVS 5196 (video 1080p y barra), SVS 3615 (`earth_noClouds.0330.jpg`).
- `tools/scraping/fetch_geos_variable.py --date YYYY-MM-DD [--group inst1_2d_lfo] [--variable TLML] [--out resources/data/geos_fp]`: lista `https://portal.nccs.nasa.gov/datashare/gmao/geos-fp/das/Y/M/D/`, baja los `.nc4` del grupo (reanudables con `Range`), extrae una variable con `xarray` y escribe `<VAR>_<fecha>.nc4` (dims `time, lat, lon`, zlib) y `<VAR>_<fecha>_global_mean.csv` (media ponderada por cos(lat)).
- `tools/scraping/collect_resources.py [--svs-query] [--no-svs] [--no-gistemp] [--geos-start] [--geos-ext] [--max-files] [--max-gb] [--dry-run]`: metadatos SVS, CSV GISTEMP y recorrido acotado del portal GEOS-FP hacia `resources/`.

Ninguno de los scripts Python apunta a GEOS-CF ni escribe en `data/raw/`.

## 5. Servidor local (previsto)

`jukebox-server` debe servir la app compilada y los datos en `127.0.0.1` (paso 11). Hoy `main` imprime un aviso y sale con código 2.
