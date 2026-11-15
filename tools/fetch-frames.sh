#!/usr/bin/env bash
# Downloads the sources used by Earth Jukebox into data/raw/, turns the formats
# that jukebox-prep cannot read (NetCDF, video, 16-bit TIFF) into plain images,
# draws the sharp lightning image of the planet view into
# web/public/data/lightning-4k.png, and rewrites data/SOURCES.md with every file
# and its link.
#
# Runs inside the earth-jukebox-fetch container (tools/fetch/Dockerfile), which
# holds curl, ffmpeg, unzip and Python with netCDF4, numpy and Pillow:
#
#   docker compose build fetch
#   docker compose run --rm fetch          (from the repository root)
#
# Set FORCE=1 (docker compose run --rm -e FORCE=1 fetch) to download again files
# that already exist. No download here needs a login. GEDI L3, the forest height
# source, does: it has its own script (tools/fetch/fetch-gedi.sh), run with
# docker compose run --rm fetch-gedi (needs a NASA Earthdata login in ~/.netrc).
#
# Total download is about 2.2 GB: Natural Earth (324 MB zip), 24 hours of
# GEOS-CF (about 160 MB), two passes over the SVS 5011 lightning video (350 MB
# each, streamed, not stored: one for the map the sound uses, one for the dots
# drawn on the planet; each only when its file is missing) and 14 frames of SVS 4950 in 4K (66 MB each as 16-bit
# TIFF, kept as 8-bit PNG), plus the SVS 5196 CO2 video (12 frames are kept).
# Files from earlier versions of this script (SVS 5533, SVS 3615) stay in
# data/raw/ and are no longer downloaded.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RAW="$ROOT/data/raw"
SOURCES="$ROOT/data/SOURCES.md"
FETCH_TOOLS="$ROOT/tools/fetch"
UA="earth-jukebox-fetch/1.0 (NASA Space Apps 2026)"
SVS="https://svs.gsfc.nasa.gov/vis/a000000"
FORCE="${FORCE:-0}"
ROWS=""

for tool in curl ffmpeg unzip python3; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "fetch-frames: '$tool' is required but was not found in PATH." >&2
    echo "fetch-frames: run it in Docker: docker compose run --rm fetch" >&2
    exit 1
  fi
done

record() { # file, link, how it was obtained
  ROWS+="| \`data/raw/$1\` | <$2> | $3 |"$'\n'
}

have() { # relative path: true when the file exists and FORCE is off
  [[ "$FORCE" != "1" && -s "$RAW/$1" ]]
}

download() { # relative destination, url
  local dest="$RAW/$1" url="$2"
  mkdir -p "$(dirname "$dest")"
  if have "$1"; then
    echo "  have   $1"
  else
    echo "  fetch  $1"
    if ! curl -fsSL --retry 3 --connect-timeout 20 --max-time 1800 -A "$UA" -o "$dest.part" "$url"; then
      rm -f "$dest.part"
      echo "fetch-frames: download failed: $url" >&2
      exit 1
    fi
    mv "$dest.part" "$dest"
  fi
}

echo "Base image - Natural Earth I 10m with shaded relief and water"
NE_ZIP_URL="https://naciscdn.org/naturalearth/10m/raster/NE1_HR_LC_SR_W_DR.zip"
NE_TIF="naturalearth/NE1_HR_LC_SR_W_DR.tif"
download "naturalearth/NE1_HR_LC_SR_W_DR.zip" "$NE_ZIP_URL"
record "naturalearth/NE1_HR_LC_SR_W_DR.zip" "$NE_ZIP_URL" "downloaded as published"
if have "$NE_TIF"; then
  echo "  have   $NE_TIF"
else
  echo "  unzip  $NE_TIF"
  if ! unzip -o -q -j "$RAW/naturalearth/NE1_HR_LC_SR_W_DR.zip" "NE1_HR_LC_SR_W_DR.tif" -d "$RAW/naturalearth"; then
    echo "fetch-frames: NE1_HR_LC_SR_W_DR.tif is not in the Natural Earth zip ($NE_ZIP_URL)" >&2
    exit 1
  fi
fi
record "$NE_TIF" "$NE_ZIP_URL" "extracted from the zip (21600 x 10800 GeoTIFF)"

echo "Wildfire smoke - GEOS-CF v2 surface PM2.5, 1 September 2026, hourly"
GEOSCF="https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ana/Y2026/M09/D01"
for hour in $(seq -w 0 23); do
  name="GEOS.cf.ana.aqc_tavg_1hr_glo_L1440x721_slv.20260901_${hour}30z.R0.nc4"
  png="geoscf/pm25_${hour}30.png"
  download "geoscf/nc/$name" "$GEOSCF/$name"
  record "geoscf/nc/$name" "$GEOSCF/$name" "downloaded as published"
  if have "$png"; then
    echo "  have   $png"
  elif ! python3 "$FETCH_TOOLS/geoscf_to_png.py" "$RAW/geoscf/nc/$name" "$RAW/$png"; then
    echo "fetch-frames: could not convert $name" >&2
    exit 1
  fi
  record "$png" "$GEOSCF/$name" "PM25_RH35 on 1440 x 720 cells, 0 to 150 ug/m3 as grey 0 to 255, by tools/fetch/geoscf_to_png.py"
done

echo "Lightning - ISS LIS 2017-2023 (SVS 5011)"
LIGHTNING_VIDEO="$SVS/a005000/a005011/iss_lightning_sos_yearly_07312023_2048p60.mp4"
LIGHTNING_PNG="5011/lightning_2017_2023.png"
mkdir -p "$RAW/5011"
if have "$LIGHTNING_PNG"; then
  echo "  have   $LIGHTNING_PNG"
else
  # The video shows a 10-day roving window (its last frame is empty), so the
  # accumulated map combines one frame every 0.4 s (about every 10 days) of the
  # whole video. The video is read once over the network and not stored.
  echo "  frames $LIGHTNING_PNG (remote, one frame every 0.4 s, about 2 minutes)"
  if ! ffmpeg -v error -user_agent "$UA" -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 10 \
      -i "$LIGHTNING_VIDEO" -vf "fps=2.5" -f rawvideo -pix_fmt rgb24 - \
      | python3 "$FETCH_TOOLS/lightning_composite.py" 4096 2048 "$RAW/$LIGHTNING_PNG" 240; then
    rm -f "$RAW/$LIGHTNING_PNG"
    echo "fetch-frames: could not build the lightning map from $LIGHTNING_VIDEO" >&2
    exit 1
  fi
fi
record "$LIGHTNING_PNG" "$LIGHTNING_VIDEO" "mean lightning (yellow) of about 250 frames, one every 0.4 s, by tools/fetch/lightning_composite.py"
# The sharp lightning dots drawn on the planet (not used by the sound): the lightning
# pixels of the same frames are kept once in a small file (about 25 MB), and the
# image web/public/data/lightning-4k.png is drawn from it whenever it is missing,
# older than that file, or FORCE=1.
LIGHTNING_DOTS="5011/lightning_dots_2017_2023.npz"
LIGHTNING_VISUAL="$ROOT/web/public/data/lightning-4k.png"
if have "$LIGHTNING_DOTS"; then
  echo "  have   $LIGHTNING_DOTS"
else
  echo "  frames $LIGHTNING_DOTS (remote, one frame every 0.4 s, about 2 minutes)"
  if ! ffmpeg -v error -user_agent "$UA" -reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 10 \
      -i "$LIGHTNING_VIDEO" -vf "fps=2.5" -f rawvideo -pix_fmt rgb24 - \
      | python3 "$FETCH_TOOLS/lightning_dots.py" collect 4096 2048 "$RAW/$LIGHTNING_DOTS" 240; then
    rm -f "$RAW/$LIGHTNING_DOTS"
    echo "fetch-frames: could not collect the lightning dots from $LIGHTNING_VIDEO" >&2
    exit 1
  fi
fi
record "$LIGHTNING_DOTS" "$LIGHTNING_VIDEO" "lightning pixels (yellowness of at least 77 of 255) of the same 250 frames, by tools/fetch/lightning_dots.py collect"
if [[ "$FORCE" != "1" && -s "$LIGHTNING_VISUAL" && "$LIGHTNING_VISUAL" -nt "$RAW/$LIGHTNING_DOTS" ]]; then
  echo "  have   web/public/data/lightning-4k.png"
elif ! python3 "$FETCH_TOOLS/lightning_dots.py" render "$RAW/$LIGHTNING_DOTS" "$LIGHTNING_VISUAL"; then
  echo "fetch-frames: could not draw web/public/data/lightning-4k.png from $LIGHTNING_DOTS" >&2
  exit 1
fi
ROWS+="| \`web/public/data/lightning-4k.png\` | <$LIGHTNING_VIDEO> | distinct lightning dots for the planet view (4096 x 2048, one 8-bit channel), drawn from \`data/raw/$LIGHTNING_DOTS\` by tools/fetch/lightning_dots.py render |"$'\n'

echo "Global CO2 - DYAMOND (SVS 5196)"
CO2_VIDEO="$SVS/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4"
download "5196/dyamond_co2_globe_orbit_1080p30_h265.mp4" "$CO2_VIDEO"
record "5196/dyamond_co2_globe_orbit_1080p30_h265.mp4" "$CO2_VIDEO" "downloaded as published"
# South America faces the camera here. The video advances one model hour per
# frame (30 per second), so frames 0.2 s apart are six hours apart:
# 23 Feb 2020 00:00 UTC to 25 Feb 2020 18:00 UTC.
for at in 31.3 31.5 31.7 31.9 32.1 32.3 32.5 32.7 32.9 33.1 33.3 33.5; do
  png="5196/co2_globe_${at}.png"
  if have "$png"; then
    echo "  have   $png"
  else
    echo "  frame  $png (at ${at}s)"
    if ! ffmpeg -v error -y -ss "$at" -i "$RAW/5196/dyamond_co2_globe_orbit_1080p30_h265.mp4" -frames:v 1 "$RAW/$png"; then
      rm -f "$RAW/$png"
      echo "fetch-frames: could not extract a frame at ${at}s from the CO2 video" >&2
      exit 1
    fi
  fi
  record "$png" "$CO2_VIDEO" "video frame at ${at} s, extracted with ffmpeg"
done

echo "Forest height fill - GEDI (SVS 4950), 4K frames"
GEDI_L3_NAME="GEDI03_rh100_mean_2019108_2025190_003_01.tif"
GEDI_L3_URL="https://data.ornldaac.earthdata.nasa.gov/protected/gedi/GEDI_L3_LandSurface_Metrics_V3/data/$GEDI_L3_NAME"
record "gedi/$GEDI_L3_NAME" "$GEDI_L3_URL" "downloaded with a NASA Earthdata login by tools/fetch/fetch-gedi.sh (docker compose run --rm fetch-gedi), not by this script"
record "gedi/gedi_l3_rh100_mean_0p1deg.png" "$GEDI_L3_URL" "rh100_mean averaged into 3600 x 1800 cells of 0.1 degree, 0 to 50 m as grey 0 to 255, alpha 0 where GEDI has no data, by tools/fetch/gedi_l3_to_png.py"
GEDI="$SVS/a004900/a004950"
GEDI_FRAMES="$GEDI/frames/3840x2160_16x9_60p/GEDI_global"
download "4950/GEDI_colorbar_0to50_01_print.jpg" "$GEDI/GEDI_colorbar_0to50_01_print.jpg"
record "4950/GEDI_colorbar_0to50_01_print.jpg" "$GEDI/GEDI_colorbar_0to50_01_print.jpg" "downloaded as published"
# Same 14 globe turns as the 1080p video frames used before (3.3 s to 46.5 s,
# 3.6 s apart): 4K frame number = seconds x 60 + 1 (checked by image
# comparison: frame 1500 matches video frame 1499 counted from 0). The 4K
# sequence ends at frame 2999 (49.97 s), so it replaces the 50.1 s view.
for frame in 0199 0415 0631 0847 1063 1279 1495 1711 1927 2143 2359 2575 2791 2999; do
  tif="4950/4k/GEDI_global.$frame.tif"
  png="4950/4k/GEDI_global.$frame.png"
  if have "$png"; then
    echo "  have   $png"
  else
    download "$tif" "$GEDI_FRAMES/GEDI_global.$frame.tif"
    echo "  png    $png"
    if ! ffmpeg -v error -y -i "$RAW/$tif" -pix_fmt rgb24 "$RAW/$png"; then
      rm -f "$RAW/$png"
      echo "fetch-frames: could not convert $tif to PNG" >&2
      exit 1
    fi
    rm -f "$RAW/$tif" # 66 MB of 16-bit TIFF; the 8-bit PNG is what jukebox-prep reads
  fi
  record "$png" "$GEDI_FRAMES/GEDI_global.$frame.tif" "4K frame (16-bit TIFF) converted to 8-bit PNG with ffmpeg"
done

echo "World regions - Natural Earth 1:50m countries"
NE_COUNTRIES_URL="https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson"
download "naturalearth/ne_50m_admin_0_countries.geojson" "$NE_COUNTRIES_URL"
record "naturalearth/ne_50m_admin_0_countries.geojson" "$NE_COUNTRIES_URL" "downloaded as published"
REGIONS_JSON="$ROOT/web/public/data/regions.json"
# Rebuilt when missing, older than the countries file or older than the script itself.
if [[ "$FORCE" != "1" && -s "$REGIONS_JSON" && "$REGIONS_JSON" -nt "$RAW/naturalearth/ne_50m_admin_0_countries.geojson" \
    && "$REGIONS_JSON" -nt "$FETCH_TOOLS/world_regions.py" ]]; then
  echo "  have   web/public/data/regions.json"
elif ! python3 "$FETCH_TOOLS/world_regions.py" "$RAW/naturalearth/ne_50m_admin_0_countries.geojson" "$REGIONS_JSON"; then
  echo "fetch-frames: could not build web/public/data/regions.json" >&2
  exit 1
fi
ROWS+="| \`web/public/data/regions.json\` | <$NE_COUNTRIES_URL> | the 22 world regions (UN subregions of the countries, merged and simplified) by tools/fetch/world_regions.py |"$'\n'

cat >"$SOURCES" <<EOF
# Data sources

Everything shown and heard in Earth Jukebox comes from the public sources
below. Only GEDI L3 (forest height) needs a free NASA Earthdata login: it is
downloaded on its own with \`docker compose run --rm fetch-gedi\`, which reads
the login from \`~/.netrc\`. Keep only the \`urs.earthdata.nasa.gov\` line in that
file: the download container can read all of it. No other source needs a
login. This file is
rewritten by \`tools/fetch-frames.sh\` (run it with \`docker compose run --rm fetch\`).

## Layers

| Layer | Source | Period | What the value is |
|---|---|---|---|
| Forest height | [GEDI L3 Gridded Land Surface Metrics, Version 3](https://www.earthdata.nasa.gov/data/catalog/ornl-cloud-gedi-l3-landsurface-metrics-v3-2525-3) (NASA GEDI, ORNL DAAC, DOI [10.3334/ORNLDAAC/2525](https://doi.org/10.3334/ORNLDAAC/2525)), file \`GEDI03_rh100_mean_2019108_2025190_003_01.tif\` (mean canopy height, rh100). Fill: [GEDI Forest Height, NASA SVS 4950](https://svs.gsfc.nasa.gov/4950), 4K frames of the rotating globe | April 2019 - July 2025 (SVS 4950 fill: April 2019 - April 2020) | Mean canopy height measured by GEDI on a fixed scale: **0 m = 0 (byte 0), 50 m or more = 1 (byte 255)**, linear in between. Only cells without any GEDI measurement take the SVS 4950 value instead (relative height 0 to 1 read from the colours of 14 rendered globe views on the published 0 to 50 m colour bar); the two are never blended. |
| Wildfire smoke | [GEOS-CF v2](https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/) analysis, NASA GMAO, file \`aqc_tavg_1hr_glo_L1440x721_slv\`, variable \`PM25_RH35\` (surface PM2.5 at 35 % relative humidity) | 1 September 2026, 24 hourly means (00:30 to 23:30 UTC) | Model PM2.5 on a fixed scale: **0 ug/m3 = 0 (byte 0), 150 ug/m3 or more = 1 (byte 255)**, linear in between. Missing or fill values are 0. |
| Global CO2 | [DYAMOND Global Carbon Dioxide, NASA SVS 5196](https://svs.gsfc.nasa.gov/5196) (GEOS model, DYAMOND simulation), 12 frames of the orbiting-globe video | 23 - 25 February 2020, every 6 hours | Relative intensity (0 to 1): the "warmth" of each pixel (red minus blue), read from the rendered frames. **Amazon only.** Not ppm. |
| Lightning | [Lightning Events Detected from the ISS 2017-2023, NASA SVS 5011](https://svs.gsfc.nasa.gov/5011), equirectangular video for spheres (LIS on the ISS) | January 2017 - July 2023, accumulated | Relative frequency (0 to 1): how often lightning was drawn at each place across the whole period, read from the video frames. Not a flash count. The planet view draws the lightning dots of the video themselves (\`web/public/data/lightning-4k.png\`), coloured by that frequency; the sound uses the frequency grids only. |

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
  The planet view does not draw that mean, which is a soft blur and covers the
  tropics in one solid patch: over 250 windows almost every pixel of the Congo
  basin sees lightning many times. It draws distinct dots, like SVS 5011, from
  \`web/public/data/lightning-4k.png\` (4096 x 2048, one 8-bit channel, 0 = no
  lightning), made by tools/fetch/lightning_dots.py. The lightning pixels of the
  same 250 frames are kept once (\`data/raw/5011/lightning_dots_2017_2023.npz\`).
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
  The planet view draws the forest (not the sound) from sharper greyscale images made from the same GeoTIFF by tools/fetch/gedi_visual.py (run by \`docker compose run --rm fetch-gedi\` once \`prep\` has run): \`web/public/data/forest-height-8k.png\` (8192 x 4096), \`forest-height-4k.png\` (4096 x 2048) and \`forest-height-amazon.png\` (the Amazon rectangle at 0.01 degree, 3600 x 2800), 0 to 255 = 0 to 50 m with 0 also meaning no forest, each pixel the mean of the GEDI pixels in it and its gaps filled from coarser GEDI means, then the 0.1 degree image, then the final forest grid (with its SVS 4950 fill).

## Base image of the planet

[Natural Earth I with Shaded Relief and Water](https://www.naturalearthdata.com/downloads/10m-raster-data/10m-natural-earth-1/),
1:10 million scale (\`NE1_HR_LC_SR_W_DR\`, 21600 x 10800 pixels). Public
domain. The app gets it in two sizes (8192 x 4096 and 4096 x 2048) plus a
crop of the Amazon rectangle at full resolution (2160 x 1680). It is only the
backdrop of the planet and the map; it carries no data values.

## Amazon rectangle

West 80 W, east 44 W, south 20 S, north 8 N.

## World regions

The regions outlined on the planet (\`web/public/data/regions.json\`) divide the
world into 22 regions built from Natural Earth's 1:50m countries
(\`ne_50m_admin_0_countries.geojson\`, version 5.1.2) by
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
  image (\`earth.jpg\`) are no longer downloaded; files already in
  \`data/raw/\` and \`web/public/data/earth.jpg\` are kept.

## Files

| File | Link | How it was obtained |
|---|---|---|
${ROWS}
EOF

echo "fetch-frames: done. Sources written to data/SOURCES.md"
du -sh "$RAW" | sed 's/^/fetch-frames: raw data size /'
