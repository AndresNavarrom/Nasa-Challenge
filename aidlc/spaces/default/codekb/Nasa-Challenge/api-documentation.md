# API Documentation

No hay API HTTP propia todavía: el servidor Axum (`server/`) es un esqueleto. Las superficies reales son el contrato de archivos de datos, las funciones exportadas de TypeScript y la CLI de preparación.

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

Reglas de validación del cliente (`parseManifest`): al menos una capa; `id` en `LAYER_IDS` y sin repetir; `dates.length === region.frames`; `global.frames === region.frames` cuando hay global; `global` puede ser `null`; enteros positivos en tamaños; `bbox` con `west < east` y `south < north`.

### Archivos `*.bin`

Un byte por celda (0..255; el cliente divide entre 255). Orden: instante → fila (norte primero) → columna (oeste primero). Tamaño exacto `width × height × frames`.

### Texturas

| Archivo | Tamaño | Cobertura |
|---|---|---|
| `earth.jpg` | 2048×1024 RGB | Planeta entero, equirectangular |
| `forest_global.png` | 1024×512 RGBA | Planeta entero, equirectangular |
| `{forest,smoke,co2}_region.png` | 512×398 RGBA | `bbox` de la Amazonía |

Las texturas de capas con tiempo (`smoke`, `co2`) muestran solo el primer instante. Canal alfa: opaco donde hay dato para `colorbar` sin `fade`; en otros métodos la opacidad crece con la raíz del valor.

Estado actual: `forest` (global 144×72 + región 96×72, 1 instante), `smoke` (solo región, 6 instantes), `co2` (solo región, 12 instantes).

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

Nota para el paso 12: `positionToPan` espera la posición horizontal del punto en pantalla (0 = borde izquierdo), no la longitud.

## 3. CLI `jukebox-prep`

```
jukebox-prep --sample [--out DIR]
jukebox-prep --config FILE [--raw DIR] [--out DIR]
```

Valores por defecto: `--raw data/raw`, `--out web/public/data`. Código de salida 2 para argumentos inválidos y 1 para fallos. En Docker: `docker compose run --rm prep` y `docker compose run --rm prep --sample`.

Configuración (`data/prep-config.json`): `bbox`, `grid.global`/`grid.region` (`[ancho, alto]`, mínimos 72×36 y 32×32, máximo 1024), `earth.file`, y por capa `id`, `title`, `description`, `source`, `static`, `global`, `value` (`method`: `colorbar` | `brightness` | `warmth`) e `instants[].views[]` con `projection` (`equirect` | `orthographic`) y `masks`.

## 4. Servidor local (previsto)

`jukebox-server` debe servir la app compilada y los datos en `127.0.0.1` (paso 11). Hoy `main` imprime un aviso y sale con código 2.
