# Documentación de APIs — Earth Jukebox

No hay API HTTP propia (el servidor `server/` es un esqueleto; en desarrollo Vite sirve archivos estáticos en 127.0.0.1:5173). Las superficies son CLIs y contratos de archivos.

## CLI `jukebox-prep` (`tools/prep/src/main.rs`)

```
jukebox-prep --sample [--out DIR]
jukebox-prep --config FILE [--raw DIR] [--out DIR]
```

- `--raw` por defecto `data/raw`; `--out` por defecto `web/public/data`. Exige exactamente uno de `--sample` o `--config`.
- Salidas: código 0 éxito, 2 argumentos inválidos, 1 error de preparación (mensaje `jukebox-prep: ...`).
- En Compose: `docker compose run --rm prep` (release, `--config data/prep-config.json`).

## Scripts de `fetch`

- `tools/fetch-frames.sh` — sin argumentos; variable `FORCE=1` para volver a descargar. Requiere `curl`, `ffmpeg`, `unzip`, `python3`. Escribe `data/raw/` y reescribe `data/SOURCES.md`.
- `geoscf_to_png.py INPUT.nc4 OUTPUT.png` — PM25_RH35 721×1440 → PNG gris 1440×720, 0–150 µg/m³ → 0–255. Salidas 0/1/2.
- `lightning_composite.py WIDTH HEIGHT OUTPUT.png [MIN_FRAMES]` — lee rgb24 crudo por stdin y escribe la media de "amarillez".

## Contrato de entrada `data/prep-config.json` (`tools/prep/src/config.rs`)

| Campo | Tipo | Notas |
|---|---|---|
| `bbox` | `{west, south, east, north}` | por defecto la Amazonía |
| `grid` | `{global: [w,h], region: [w,h]}` | mínimos 72×36 y 32×32, máximo 2048 por lado |
| `earth` | `{file, sizes, region_file}` | imagen base opcional |
| `layers[]` | `LayerConfig` | `id` en `forest, smoke, co2, lightning`; `static`, `global`, `grid` propio, `value`, `instants[]` |
| `value.method` | `colorbar` \| `brightness` \| `warmth` | `colorbar`: `stops`, `image {file, from, to, samples}`, `max_distance`, `fade`; `brightness`: `low`, `high`, `invert` |
| `instants[].views[]` | `{file, projection, masks}` | `projection.type`: `equirect {west,south,east,north,rect}` u `orthographic {cx,cy,radius,center_lon,center_lat,roll,distance,min_weight}` |

## Contrato de salida `web/public/data/` (`config.rs` Manifest, `web/src/data/types.ts`)

```json
{ "layers": [ { "id": "forest", "title": "...", "description": "...",
    "source": {"title": "...", "url": "..."}, "static": true, "sample": false,
    "dates": ["..."],
    "global": {"width": 1440, "height": 720, "frames": 1, "file": "forest_global.bin", "texture": "forest_global.png"},
    "region": {"width": 360, "height": 280, "frames": 1, "file": "forest_region.bin", "texture": "forest_region.png"} } ],
  "region": { "bbox": {"west": -80, "south": -20, "east": -44, "north": 8} } }
```

- `.bin`: `frames × height × width` bytes, 0..255 (la web divide por 255), fila norte primero, columna oeste primero.
- La web valida: ids conocidos, sin duplicados, `dates.length == region.frames`, `global.frames == region.frames`, tamaño exacto de cada `.bin` (`loadManifest.ts`).

## API de módulos TypeScript

- `loadJukeboxData(baseUrl?, fetcher?)` → `JukeboxData`; lanza `DataLoadError`.
- `sampleLayerAt(layer, bbox, lon, lat, framePosition)` → `number | null` (región dentro del rectángulo, global fuera, `null` si la capa no tiene global).
- `framePosition`, `dateLabelAt`, `advancePosition` (`lib/timeline.ts`).
- `forestToVoice`, `smokeToTimbre`, `co2ToBreath`, `positionToPan`, `intensityToGain` (`audio/mapping.ts`).
- `useListeningPoint()` → `{lon, lat, screenX} | null` (`scene/listeningPoint.tsx`).
