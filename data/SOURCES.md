# Data sources

Everything shown and heard in Earth Jukebox comes from the public sources
below. No source needs a login. This file is rewritten by
`tools/fetch-frames.sh` (run it with `docker compose run --rm fetch`).

## Layers

| Layer | Source | Period | What the value is |
|---|---|---|---|
| Forest height | [GEDI Forest Height, NASA SVS 4950](https://svs.gsfc.nasa.gov/4950), 4K frames of the rotating globe | April 2019 - April 2020 | Relative height (0 to 1) read from the colours of 14 rendered globe views, by position on the published colour bar (0 to 50 m). Not a measurement in metres. |
| Wildfire smoke | [GEOS-CF v2](https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/) analysis, NASA GMAO, file `aqc_tavg_1hr_glo_L1440x721_slv`, variable `PM25_RH35` (surface PM2.5 at 35 % relative humidity) | 1 September 2026, 24 hourly means (00:30 to 23:30 UTC) | Model PM2.5 on a fixed scale: **0 ug/m3 = 0 (byte 0), 150 ug/m3 or more = 1 (byte 255)**, linear in between. Missing or fill values are 0. |
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
- **Forest height.** 14 views of the rotating globe, 3.6 s apart in the video
  (4K frames 0199 to 2999), blended into one flat map; each place takes most
  of its value from the view that sees it most directly. The globe is rendered
  with lighting and exaggerated height, so shading affects the colours, and
  the georeferencing was done by hand (errors of roughly 1 to 2 degrees).
  Places the views never show (near the poles) are 0.

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
- SVS 4950 and SVS 5011: NASA Scientific Visualization Studio. NASA imagery is
  generally not copyrighted; credit NASA's Scientific Visualization Studio.

## No longer used

- **Global CO2** (DYAMOND, SVS 5196) is no longer in the data file. Its frames
  in `data/raw/5196/` and its grid in `web/public/data/` stay in the
  repository, unused.
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

