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
| Atmospheric CO2 | [DYAMOND Global Carbon Dioxide, NASA SVS 5196](https://svs.gsfc.nasa.gov/5196) (GEOS model, DYAMOND simulation), 72 frames (5760 x 3240 EXR) of the orbiting-globe animation | 14 January - 3 March 2020: 12 steps of six hours, each side of the globe on its own dates (the Americas 23 - 25 February 2020) | Relative intensity (0 to 1): the "warmth" of each pixel (red minus blue), read from the rendered frames. Not ppm. **Global, and the whole planet moves with the timeline.** The planet view draws sharp images of every step (`web/public/data/co2_sharp_*.png`, 4096 x 2048 and 1152 x 896 for the Amazon); the sound uses the grids. |
| Lightning | [Lightning Events Detected from the ISS 2017-2023, NASA SVS 5011](https://svs.gsfc.nasa.gov/5011), equirectangular video for spheres (LIS on the ISS) | January 2017 - July 2023, one frame per quarter (27 frames, the last one July 2023 only) | Relative frequency (0 to 1): how often lightning was drawn at each place during that quarter only (nothing accumulated between frames), read from the video frames. Not a flash count. Drawn from its grids, one quarter at a time, on the timeline. |

## How each source was turned into a map

- **Smoke.** GEOS-CF stores 721 latitudes (with the poles on the end rows) by
  1440 longitudes starting at 180 W. Each app cell (1440 x 720, 0.25 degrees,
  north row first) is the mean of the 2 x 2 block of model points around its
  centre (tools/fetch/geoscf_to_png.py). The layer is global, and its Amazon
  grid keeps the model resolution (0.25 degrees).
- **CO2.** SVS 5196 is only published as a rendered globe that turns under a
  fixed camera (the point under the camera moves 0.2017 degrees west per frame, because the
  Earth turns east; one model hour per frame), so no frame shows the whole
  planet at one moment. Six sides of the globe move together instead: from
  frames 00001 (Asia and Australia, 14 January 2020), 00232 (India, 24
  January), 00463 (Africa and the Middle East, 3 February), 00694 (Europe and
  West Africa, 12 February), 00939 (the Americas, 23 February) and 01110 (North
  America and the eastern Pacific, 1 March), every sixth frame twelve times,
  so each of the 12 steps is six hours later on every side. The four inner sides
  are used up to 60 degrees from the point under the camera; the two outer ones
  reach further so the Pacific between them is covered. Where two sides meet,
  their values are blended by how directly each sees the place (dates about nine
  days apart). Where the globe sits in each frame follows the turn fitted to the
  Natural Earth coastlines (tools/fetch/co2_calibrate.py). The "warmth" also
  picks up bright beige land: deserts (Sahara, Australia, Atacama) read about
  0.1, a low value, more than the Amazon itself in February 2020 (about 0.04).
  The planet view draws a sharp grey image of every step, made by jukebox-prep
  at 4096 x 2048 (and 1152 x 896 over the Amazon) straight from the frames, where
  the 0.25 degree grids would blur the plumes; the sound keeps the grids.
- **Lightning.** The video shows a 10-day roving window: each frame holds only
  the last ten days and its last frame is empty, so no single frame holds the
  accumulated period. One frame every 0.4 s of the video (about every 10 days
  of data, about 250 frames in all) was combined: the value is the mean "yellowness"
  of each pixel (lightning is drawn in yellow over a grey map), so places with
  lightning in more windows are brighter (tools/fetch/lightning_composite.py).
  LIS sees only between about 55 N and 55 S.
  **Timeline frames.** The app's lightning layer has one frame per quarter,
  January 2017 to July 2023 (27 frames), from the same 250 windows kept in
  `data/raw/5011/lightning_dots_2017_2023.npz`. The video runs linearly over the
  period (100 s, about 24 days per second), so window k ends about k x 0.4 / 100
  of the way through it; each window goes to the quarter of its middle day, and
  each quarter's image is the mean yellowness of its own 9 or 10 windows only
  (2 for July 2023), so playing them shows where lightning was seen each
  quarter, never an accumulation (tools/fetch/lightning_quarters.py, images in
  `data/raw/5011/quarters/`). January - March 2017 is almost empty: the
  video shows almost no lightning in its first weeks (LIS was new on the ISS). The accumulated mean and the
  sharp dots image below are kept but no longer drawn by the app.
  The planet view does not draw that mean, which is a soft blur and covers the
  tropics in one solid patch: over 250 windows almost every pixel of the Congo
  basin sees lightning many times. It draws distinct dots, like SVS 5011, from
  `web/public/data/lightning-4k.png` (4096 x 2048, one 8-bit channel, 0 = no
  lightning), made by tools/fetch/lightning_dots.py. The lightning pixels of the
  same 250 frames are kept once (`data/raw/5011/lightning_dots_2017_2023.npz`).
  Each lit pixel of the image belongs to a real lightning dot of the video, at its
  place, and its brightness is how often lightning was seen there over the whole
  period (the number of windows with a dot core there, relative to the busiest
  places): dim orange where lightning is rare, nearly white where it strikes most.
  Only the number of dots is thinned: each place draws at most 14 windows' worth
  of dots, picked from all the windows so every season and year shows, and fewer
  where they would cover too much of the ground (at most 12 % where lightning is
  rare, up to 70 % at the busiest places, before whole dots and their overlap
  lower that), so the dots stay apart. Which dots are drawn is a fixed
  pseudo-random choice, the same on every run. About 4 % of the pixels are lit.
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

## World regions

The regions outlined on the planet (`web/public/data/regions.json`) divide the
world into 22 regions built from Natural Earth's 1:50m countries
(`ne_50m_admin_0_countries.geojson`, version 5.1.2) by
tools/fetch/world_regions.py: each country goes to its UN subregion (the
SUBREGION field) and each subregion's countries are merged. Russia is a region
of its own, Melanesia, Micronesia and Polynesia are joined as Pacific Islands,
the open-ocean islands are left out, and France's overseas departments go with
the region they lie in. Outlines are simplified (Douglas-Peucker, 0.05 degree)
without breaking shared borders (each border between two countries is simplified
once and used by both, so a region has no gaps inside), and islands under 0.02
square degrees are dropped. The Amazon is drawn on top as
its own region: the app keeps the forest (GEDI height of about 5 m or more)
inside a hand-drawn area around the basin.

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
| `data/raw/5011/lightning_dots_2017_2023.npz` | <https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005011/iss_lightning_sos_yearly_07312023_2048p60.mp4> | lightning pixels (yellowness of at least 77 of 255) of the same 250 frames, by tools/fetch/lightning_dots.py collect |
| `web/public/data/lightning-4k.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005011/iss_lightning_sos_yearly_07312023_2048p60.mp4> | distinct lightning dots for the planet view (4096 x 2048, one 8-bit channel), drawn from `data/raw/5011/lightning_dots_2017_2023.npz` by tools/fetch/lightning_dots.py render |
| `data/raw/5196/co2_orbit.00001.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00001.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00007.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00007.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00013.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00013.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00019.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00019.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00025.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00025.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00031.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00031.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00037.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00037.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00043.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00043.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00049.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00049.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00055.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00055.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00061.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00061.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00067.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00067.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00232.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00232.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00238.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00238.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00244.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00244.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00250.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00250.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00256.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00256.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00262.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00262.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00268.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00268.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00274.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00274.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00280.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00280.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00286.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00286.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00292.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00292.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00298.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00298.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00463.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00463.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00469.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00469.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00475.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00475.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00481.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00481.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00487.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00487.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00493.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00493.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00499.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00499.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00505.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00505.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00511.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00511.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00517.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00517.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00523.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00523.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00529.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00529.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00694.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00694.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00700.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00700.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00706.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00706.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00712.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00712.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00718.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00718.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00724.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00724.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00730.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00730.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00736.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00736.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00742.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00742.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00748.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00748.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00754.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00754.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00760.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00760.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00939.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00939.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00945.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00945.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00951.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00951.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00957.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00957.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00963.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00963.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00969.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00969.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00975.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00975.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00981.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00981.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00987.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00987.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00993.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00993.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.00999.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00999.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.01005.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.01005.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.01110.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.01110.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.01116.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.01116.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.01122.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.01122.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.01128.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.01128.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.01134.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.01134.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.01140.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.01140.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.01146.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.01146.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.01152.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.01152.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.01158.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.01158.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.01164.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.01164.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.01170.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.01170.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
| `data/raw/5196/co2_orbit.01176.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.01176.exr> | EXR frame (5760 x 3240, linear) converted to 8-bit sRGB PNG with ffmpeg |
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
| `data/raw/naturalearth/ne_50m_admin_0_countries.geojson` | <https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson> | downloaded as published |
| `web/public/data/regions.json` | <https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson> | the 22 world regions (UN subregions of the countries, merged and simplified) by tools/fetch/world_regions.py |

