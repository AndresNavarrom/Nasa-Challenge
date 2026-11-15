# Data sources

Everything shown and heard in Earth Jukebox comes from the public sources
below. Only GEDI L3 (forest height) needs a free NASA Earthdata login: it is
downloaded on its own with `docker compose run --rm fetch-gedi`, which reads
the login from `~/.netrc`. Keep only the `urs.earthdata.nasa.gov` line in that
file: the download container can read all of it. No other source needs a
login. This file is
rewritten by `tools/fetch-frames.sh` (run it with `docker compose run --rm fetch`).

## Layers

| Layer | Source | Period | What the value is |
|---|---|---|---|
| Forest height | [GEDI L3 Gridded Land Surface Metrics, Version 3](https://www.earthdata.nasa.gov/data/catalog/ornl-cloud-gedi-l3-landsurface-metrics-v3-2525-3) (NASA GEDI, ORNL DAAC, DOI [10.3334/ORNLDAAC/2525](https://doi.org/10.3334/ORNLDAAC/2525)), file `GEDI03_rh100_mean_2019108_2025190_003_01.tif` (mean canopy height, rh100). Fill: [GEDI Forest Height, NASA SVS 4950](https://svs.gsfc.nasa.gov/4950), 4K frames of the rotating globe | April 2019 - July 2025 (SVS 4950 fill: April 2019 - April 2020) | Mean canopy height measured by GEDI on a fixed scale: **0 m = 0 (byte 0), 50 m or more = 1 (byte 255)**, linear in between. Only cells without any GEDI measurement take the SVS 4950 value instead (relative height 0 to 1 read from the colours of 14 rendered globe views on the published 0 to 50 m colour bar); the two are never blended. |
| Wildfire smoke | [GEOS-CF v2](https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/) analysis, NASA GMAO, file `aqc_tavg_1hr_glo_L1440x721_slv`, variable `PM25_RH35` (surface PM2.5 at 35 % relative humidity) | 1 September 2026, 24 hourly means (00:30 to 23:30 UTC) | Model PM2.5 on a fixed scale: **0 ug/m3 = 0 (byte 0), 150 ug/m3 or more = 1 (byte 255)**, linear in between. Missing or fill values are 0. |
| Global CO2 | [DYAMOND Global Carbon Dioxide, NASA SVS 5196](https://svs.gsfc.nasa.gov/5196) (GEOS model, DYAMOND simulation), 12 frames of the orbiting-globe video | 23 - 25 February 2020, every 6 hours | Relative intensity (0 to 1): the "warmth" of each pixel (red minus blue), read from the rendered frames. **Amazon only.** Not ppm. |
| Lightning | [Lightning Events Detected from the ISS 2017-2023, NASA SVS 5011](https://svs.gsfc.nasa.gov/5011), equirectangular video for spheres (LIS on the ISS) | January 2017 - July 2023, accumulated | Relative frequency (0 to 1): how often lightning was drawn at each place across the whole period, read from the video frames. Not a flash count. |

## How each source was turned into a map

- **Smoke.** GEOS-CF stores 721 latitudes (with the poles on the end rows) by
  1440 longitudes starting at 180 W. Each app cell (1440 x 720, 0.25 degrees,
  north row first) is the mean of the 2 x 2 block of model points around its
  centre (tools/fetch/geoscf_to_png.py). The layer is global, and its Amazon
  grid keeps the model resolution (0.25 degrees).
- **Lightning.** The video shows a 10-day roving window: each frame holds only
  the last ten days and its last frame is empty, so no single frame holds the
  accumulated period. One frame every 0.4 s of the video (about every 10 days
  of data, about 250 frames in all) was combined: the value is the mean "yellowness"
  of each pixel (lightning is drawn in yellow over a grey map), so places with
  lightning in more windows are brighter (tools/fetch/lightning_composite.py).
  LIS sees only between about 55 N and 55 S.
- **Forest height.** GEDI L3 V3 is one global GeoTIFF in EASE-Grid 2.0
  (EPSG:6933), about 1 km per pixel (tools/fetch/fetch-gedi.sh downloads it).
  tools/fetch/gedi_l3_to_png.py places every pixel with the file's own
  georeference and averages the pixels that have data into cells of 0.1 degree
  (3600 x 1800); pixels with the file's no-data value are left out, and cells
  with none are marked as having no data. jukebox-prep reduces that image to
  the app grids (1440 x 720 global, 360 x 280 Amazon). Only the cells with no
  GEDI measurement at all take their value from SVS 4950: 14 views of the
  rotating globe, 3.6 s apart in the video (4K frames 0199 to 2999), blended
  into one flat map, each place taking most of its value from the view that
  sees it most directly. That globe is rendered with lighting and exaggerated
  height, so shading affects the colours, and its georeferencing was done by
  hand (errors of roughly 1 to 2 degrees). GEDI measures between about 52 N
  and 52 S, so the fill covers the rest of the land; places neither source
  shows (near the poles) are 0. jukebox-prep prints which share of the cells
  comes from GEDI and which from the fill, for the globe and for the Amazon.
  The planet view draws the forest (not the sound) from sharper greyscale images made from the same GeoTIFF by tools/fetch/gedi_visual.py (run by `docker compose run --rm fetch-gedi` once `prep` has run): `web/public/data/forest-height-8k.png` (8192 x 4096), `forest-height-4k.png` (4096 x 2048) and `forest-height-amazon.png` (the Amazon rectangle at 0.01 degree, 3600 x 2800), 0 to 255 = 0 to 50 m with 0 also meaning no forest, each pixel the mean of the GEDI pixels in it and its gaps filled from coarser GEDI means, then the 0.1 degree image, then the final forest grid (with its SVS 4950 fill).

## Base image of the planet

[Natural Earth I with Shaded Relief and Water](https://www.naturalearthdata.com/downloads/10m-raster-data/10m-natural-earth-1/),
1:10 million scale (`NE1_HR_LC_SR_W_DR`, 21600 x 10800 pixels). Public
domain. The app gets it in two sizes (8192 x 4096 and 4096 x 2048) plus a
crop of the Amazon rectangle at full resolution (2160 x 1680). It is only the
backdrop of the planet and the map; it carries no data values.

## Amazon rectangle

West 80 W, east 44 W, south 20 S, north 8 N.

## Licences and credit

- Natural Earth: public domain
  (<https://www.naturalearthdata.com/about/terms-of-use/>).
- GEOS-CF: NASA Global Modeling and Assimilation Office (GMAO); NASA Earth
  science data are open, with no restrictions on use. Credit: NASA GMAO GEOS-CF.
- GEDI L3 V3: NASA GEDI mission, distributed by the ORNL DAAC
  (doi:10.3334/ORNLDAAC/2525); NASA Earth science data are open, with no
  restrictions on use. Download needs a free NASA Earthdata login.
- SVS 4950 and SVS 5011: NASA Scientific Visualization Studio. NASA imagery is
  generally not copyrighted; credit NASA's Scientific Visualization Studio.

## No longer used

- The old smoke frames (SVS 5533), the 1080p GEDI video and the SVS 3615 base
  image (`earth.jpg`) are no longer downloaded; files already in
  `data/raw/` and `web/public/data/earth.jpg` are kept.

## Files

| File | Link | How it was obtained |
|---|---|---|
| `data/raw/naturalearth/NE1_HR_LC_SR_W_DR.zip` | <https://naciscdn.org/naturalearth/10m/raster/NE1_HR_LC_SR_W_DR.zip> | downloaded as published |
| `data/raw/naturalearth/NE1_HR_LC_SR_W_DR.tif` | <https://naciscdn.org/naturalearth/10m/raster/NE1_HR_LC_SR_W_DR.zip> | extracted from the zip (21600 x 10800 GeoTIFF) |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0030z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0030z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_0030.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0030z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0130z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0130z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_0130.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0130z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0230z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0230z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_0230.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0230z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0330z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0330z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_0330.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0330z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0430z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0430z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_0430.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0430z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0530z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0530z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_0530.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0530z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0630z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0630z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_0630.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0630z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0730z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0730z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_0730.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0730z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0830z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0830z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_0830.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0830z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0930z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0930z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_0930.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_0930z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1030z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1030z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_1030.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1030z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1130z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1130z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_1130.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1130z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1230z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1230z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_1230.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1230z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1330z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1330z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_1330.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1330z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1430z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1430z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_1430.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1430z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1530z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1530z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_1530.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1530z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1630z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1630z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_1630.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1630z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1730z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1730z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_1730.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1730z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1830z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1830z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_1830.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1830z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1930z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1930z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_1930.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_1930z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_2030z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_2030z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_2030.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_2030z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_2130z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_2130z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_2130.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_2130z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_2230z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_2230z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_2230.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_2230z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/geoscf/nc/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_2330z.R0.nc4` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_2330z.R0.nc4> | downloaded as published |
| `data/raw/geoscf/pm25_2330.png` | <https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01/GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_2330z.R0.nc4> | PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py |
| `data/raw/5011/lightning_2017_2023.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005011/iss_lightning_sos_yearly_07312023_2048p60.mp4> | mean lightning (yellow) of about 250 frames, one every 0.4 s, by tools/fetch/lightning_composite.py |
| `data/raw/5196/dyamond_co2_globe_orbit_1080p30_h265.mp4` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | downloaded as published |
| `data/raw/5196/co2_globe_31.3.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 31.3 s, extracted with ffmpeg |
| `data/raw/5196/co2_globe_31.5.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 31.5 s, extracted with ffmpeg |
| `data/raw/5196/co2_globe_31.7.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 31.7 s, extracted with ffmpeg |
| `data/raw/5196/co2_globe_31.9.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 31.9 s, extracted with ffmpeg |
| `data/raw/5196/co2_globe_32.1.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 32.1 s, extracted with ffmpeg |
| `data/raw/5196/co2_globe_32.3.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 32.3 s, extracted with ffmpeg |
| `data/raw/5196/co2_globe_32.5.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 32.5 s, extracted with ffmpeg |
| `data/raw/5196/co2_globe_32.7.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 32.7 s, extracted with ffmpeg |
| `data/raw/5196/co2_globe_32.9.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 32.9 s, extracted with ffmpeg |
| `data/raw/5196/co2_globe_33.1.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 33.1 s, extracted with ffmpeg |
| `data/raw/5196/co2_globe_33.3.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 33.3 s, extracted with ffmpeg |
| `data/raw/5196/co2_globe_33.5.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 33.5 s, extracted with ffmpeg |
| `data/raw/gedi/GEDI03_rh100_mean_2019108_2025190_003_01.tif` | <https://data.ornldaac.earthdata.nasa.gov/protected/gedi/GEDI_L3_LandSurface_Metrics_V3/data/GEDI03_rh100_mean_2019108_2025190_003_01.tif> | downloaded with a NASA Earthdata login by tools/fetch/fetch-gedi.sh (docker compose run --rm fetch-gedi), not by this script |
| `data/raw/gedi/gedi_l3_rh100_mean_0p1deg.png` | <https://data.ornldaac.earthdata.nasa.gov/protected/gedi/GEDI_L3_LandSurface_Metrics_V3/data/GEDI03_rh100_mean_2019108_2025190_003_01.tif> | rh100_mean averaged into 3600 x 1800 cells of 0.1 degree, 0 to 50 m as grey 0 to 255, alpha 0 where GEDI has no data, by tools/fetch/gedi_l3_to_png.py |
| `data/raw/4950/GEDI_colorbar_0to50_01_print.jpg` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_colorbar_0to50_01_print.jpg> | downloaded as published |
| `data/raw/4950/4k/GEDI_global.0199.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_global/GEDI_global.0199.tif> | 4K frame (16-bit TIFF) converted to 8-bit PNG with ffmpeg |
| `data/raw/4950/4k/GEDI_global.0415.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_global/GEDI_global.0415.tif> | 4K frame (16-bit TIFF) converted to 8-bit PNG with ffmpeg |
| `data/raw/4950/4k/GEDI_global.0631.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_global/GEDI_global.0631.tif> | 4K frame (16-bit TIFF) converted to 8-bit PNG with ffmpeg |
| `data/raw/4950/4k/GEDI_global.0847.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_global/GEDI_global.0847.tif> | 4K frame (16-bit TIFF) converted to 8-bit PNG with ffmpeg |
| `data/raw/4950/4k/GEDI_global.1063.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_global/GEDI_global.1063.tif> | 4K frame (16-bit TIFF) converted to 8-bit PNG with ffmpeg |
| `data/raw/4950/4k/GEDI_global.1279.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_global/GEDI_global.1279.tif> | 4K frame (16-bit TIFF) converted to 8-bit PNG with ffmpeg |
| `data/raw/4950/4k/GEDI_global.1495.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_global/GEDI_global.1495.tif> | 4K frame (16-bit TIFF) converted to 8-bit PNG with ffmpeg |
| `data/raw/4950/4k/GEDI_global.1711.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_global/GEDI_global.1711.tif> | 4K frame (16-bit TIFF) converted to 8-bit PNG with ffmpeg |
| `data/raw/4950/4k/GEDI_global.1927.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_global/GEDI_global.1927.tif> | 4K frame (16-bit TIFF) converted to 8-bit PNG with ffmpeg |
| `data/raw/4950/4k/GEDI_global.2143.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_global/GEDI_global.2143.tif> | 4K frame (16-bit TIFF) converted to 8-bit PNG with ffmpeg |
| `data/raw/4950/4k/GEDI_global.2359.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_global/GEDI_global.2359.tif> | 4K frame (16-bit TIFF) converted to 8-bit PNG with ffmpeg |
| `data/raw/4950/4k/GEDI_global.2575.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_global/GEDI_global.2575.tif> | 4K frame (16-bit TIFF) converted to 8-bit PNG with ffmpeg |
| `data/raw/4950/4k/GEDI_global.2791.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_global/GEDI_global.2791.tif> | 4K frame (16-bit TIFF) converted to 8-bit PNG with ffmpeg |
| `data/raw/4950/4k/GEDI_global.2999.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_global/GEDI_global.2999.tif> | 4K frame (16-bit TIFF) converted to 8-bit PNG with ffmpeg |

