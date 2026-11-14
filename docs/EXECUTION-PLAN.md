# Execution plan — base scaffold + data slice (Fernando)

Status: **not started**. This is the working plan agreed on 2026-11-14 for the
Fernando slice (`tools/`, `server/`, `data/`, `web/public/data/`,
`run-demo.sh`), plus the shared scaffold needed before anyone can build.

Sources of truth:

- `TAREAS.md` (team split and blocks)
- `aidlc/spaces/default/intents/261114-earth-jukebox-poc/inception/requirements-analysis/requirements.md`
- `aidlc/spaces/default/intents/261114-earth-jukebox-poc/construction/code-generation/code-generation-plan.md`
- `aidlc/spaces/default/intents/261114-earth-jukebox-poc/construction/code-generation/unit-test-instructions.md`

## Locked decisions

1. **Data path**: NASA SVS intensity grids (4950 forest, 5533 smoke, 5196 CO₂),
   not physical GEOS-FP variables. `tools/scraping/` is exploration only.
2. **CO₂**: globe-only. SVS 5196 has no flat global map; show it on the 3D
   sphere with a single Amazon voice, no per-point regional detail.
3. **Scaffold**: build Steps 1–2 on `datos-rust`, merge to `main` as soon as
   the tests are green so Samuel and Andres can branch; continue on `datos-rust`.
4. **Python prototypes**: remain outside the shipped app. Only the mapping
   ideas (five-note scale, glide/portamento, filtered-noise texture) are ported
   later to `web/src/audio/`.
5. **`web/src/data/`** belongs to the data slice (it is unassigned in
   `TAREAS.md`).

## SVS investigation (verified 2026-11-14)

API: `https://svs.gsfc.nasa.gov/api/<id>`

| Layer | Global flat | Regional | Color bar | Assets used | Sizes |
|---|---|---|---|---|---|
| Forest 4950 | `GEDI_global_w_colorbar` | none (crop global) | `GEDI_colorbar_0to75_01.tif` | `GEDI_global_w_colorbar_1080p60.mp4` + TIF | 18.6 MB + TIF |
| Smoke 5533 | `AirQuality_MapWithLabels` | crop flat map | none standalone; brightness fallback | `EIC_AirQuality_Preview_3840x1080.mp4` (fallback: flat-map 5760x3240) | 187.5 MB (fallback 299.7 MB) |
| CO₂ 5196 | **none** (globe only) | globe view only | `dyamondCbar_6-27-2024a.png` | `dyamondPointCloud_..._1080p30_h265.mp4` | 7.2 MB |

Notes:

- SVS frame directories are JS listings; use `ffmpeg` on the movie files
  instead, as the code plan already states.
- 5533 dataset range is **2024-07-01 → 2024-09-14**, not July–August.
- Flat maps are not guaranteed plate carrée. The Amazon pixel rectangle and the
  color bar must be calibrated from a real frame in Phase 3; record the
  projection assumption in `data/SOURCES.md`.
- `GEDI_CA` is Central America, not the Amazon. The forest regional view is a
  crop of the global map.

## Phase 0 — Branch and hygiene

- [ ] `git switch -c datos-rust`
- [ ] Extend `.gitignore`:
  - `web/node_modules/`, `web/dist/`
  - `tools/prep/target/`, `server/target/`
  - `data/raw/`
  - `*.part`
  - `tools/scraping/resources/`
- [ ] Confirm `main` is clean before branching.

## Phase 1 — Steps 1–2: scaffold (merge to `main` early)

- [ ] `web/`: Vite + React + TypeScript, Tailwind, GSAP, `three`,
      `@react-three/fiber`, `@react-three/drei`, `vitest`
      (`web/vitest.config.ts`, environment `node`).
- [ ] `tools/prep/`: Rust crate (`clap`, `serde`, `serde_json`, `anyhow`,
      `image` with png/jpeg/tiff features).
- [ ] `server/`: Rust crate (`axum`, `tokio`, `tower-http`, `clap`).
- [ ] `README.md` (English): requirements, install, run, test.
- [ ] Gate:
      ```bash
      npm --prefix web install
      npm --prefix web exec -- vitest run
      cargo test --manifest-path tools/prep/Cargo.toml
      cargo test --manifest-path server/Cargo.toml
      ```
- [ ] Merge scaffold to `main`; `git switch datos-rust`.

## Phase 2 — Data contract + `--sample`

- [ ] Implement `web/public/data/manifest.json` exactly as specified in the
      code plan (fields: `layers[]`, `id`, `title`, `description`, `source`,
      `static`, `dates[]`, `global`, `region`, `region.bbox`).
- [ ] `tools/prep --sample` generates:
  - global grids `144×72` (≥ 72×36 required)
  - regional grids `64×64` (≥ 32×32 required)
  - one byte per cell, values 0–255
  - placeholder textures and `manifest.json`
- [ ] `web/src/data/types.ts`
- [ ] `web/src/data/loadManifest.ts`: fetch manifest, validate byte sizes,
      fail with a clear message.
- [ ] Gate: Samuel/Andres can load the sample manifest and move a cursor over
      sample data.

## Phase 3 — Step 6: `tools/fetch-frames.sh`

- [ ] Forest: download `GEDI_global_w_colorbar_1080p60.mp4` and
      `GEDI_colorbar_0to75_01.tif`; extract N frames.
- [ ] Smoke: download `EIC_AirQuality_Preview_3840x1080.mp4` (or the flat-map
      movie if the preview is unusable); extract N frames.
- [ ] CO₂: download the 1080p h265 orbit and `dyamondCbar_6-27-2024a.png`;
      extract N frames.
- [ ] Write `data/SOURCES.md`: title, URL, date, chosen instants, why.
- [ ] Calibrate the Amazon pixel rectangle against a real frame; set
      `region.bbox` and document the projection assumption.
- [ ] Gate: each layer has frames + a calibrated crop, and the sources file is
      complete.

## Phase 4 — Steps 4–5: Rust preparation

- [ ] Color→value LUT sampled from the color bar; nearest-color lookup.
- [ ] Brightness fallback when no color bar exists (smoke).
- [ ] Amazon crop using the calibrated pixel rectangle.
- [ ] Downsample to the required grid sizes; write uint8 binaries.
- [ ] Write `manifest.json` with dates, sizes, file paths, textures.
- [ ] Tests (`cargo test`): LUT mapping, brightness fallback, downsample
      dimensions, invalid image size rejected.

## Phase 5 — Steps 11 + 15: server and demo

- [ ] Axum server serving `web/dist` and `/data` on `127.0.0.1`, with a clear
      error if `dist/` is missing. No database.
- [ ] `run-demo.sh`: build web, build server, start, open browser.
- [ ] Offline test with the network cable unplugged; prepared data < 200 MB.

## Phase 6 — Verification

- [ ] `npm --prefix web exec -- vitest run src/lib/interpolate.test.ts src/lib/timeline.test.ts src/audio/mapping.test.ts src/ui/a11y.test.ts`
- [ ] `cargo test --manifest-path tools/prep/Cargo.toml`
- [ ] Manual: boot < 5 s offline, all layers load, cursor→sound path works with
      Samuel's engine, 10-minute run without audio dropouts.
- [ ] Update `requirements.md`: 5533 date range and CO₂ globe-only fallback.

## Files created by this plan

```
web/                       Vite app, vitest, data loader, public/data/*
tools/prep/                Rust: frames -> uint8 grids + manifest
tools/fetch-frames.sh      SVS downloads + ffmpeg extraction
tools/scraping/            exploration scrapers (not shipped) - already added
server/                    Axum local server
data/raw/                  raw movies/frames (gitignored)
data/SOURCES.md            every asset + URL + assumption
run-demo.sh
README.md
docs/DEMO-CHECKLIST.md
docs/SUBMISSION.md
```

## Risks

1. **Projection/bbox calibration** — if the flat map is not plate carrée, the
   degree bbox cannot be applied directly; calibrate pixels in Phase 3 and
   document it.
2. **Smoke color mapping** — no standalone color bar; brightness fallback is
   allowed by requirements but must be declared.
3. **CO₂ has no flat map** — accepted: globe-only, single voice.
4. **Download volume** — up to ~500 MB raw; gitignored; only prepared data
   counts against the 200 MB budget.
5. **Time** — blocks B0/B1 are already compressed; if the Rust prep slips,
   generate the grids with a Python script and keep Rust as the local server
   (documented plan B in `TAREAS.md`).

## Already done in this repository

- `tools/scraping/` added: guarded GEOS-FP recursive downloader
  (`collect_resources.py`), single-variable extractor
  (`fetch_geos_variable.py`), Nix devshell, and README.
