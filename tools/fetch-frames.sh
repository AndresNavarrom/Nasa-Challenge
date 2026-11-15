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
# Total download is about 3.5 GB: Natural Earth (324 MB zip), two passes over the SVS 5011 lightning video (350 MB
# each, streamed, not stored: one for the map the sound uses, one for the dots
# drawn on the planet; each only when its file is missing) and 14 frames of SVS 4950 in 4K (66 MB each as 16-bit
# TIFF, kept as 8-bit PNG). The CO2 layer (OCO-2 GEOS, behind the Earthdata
# login) has its own script: docker compose run --rm fetch-oco2, and so has the
# smoke layer (MERRA-2): docker compose run --rm fetch-merra2.
# Files from earlier versions of this script (SVS 5533, SVS 3615 and the SVS
# 5196 CO2 frames) stay in data/raw/ and are no longer downloaded.
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

echo "Wildfire smoke - MERRA-2 carbon optical depth (downloaded by fetch-merra2, not by this script)"
MERRA2_URL="https://disc.gsfc.nasa.gov/datasets/M2T1NXAER_5.12.4/summary"
record "merra2/nc/smoke_2026<mmdd>.nc4" "$MERRA2_URL" "OCEXTTAU and BCEXTTAU every third hour of each day, 1 August to 30 September 2026, through NASA OPeNDAP with a NASA Earthdata login, by tools/fetch/fetch-merra2.sh (docker compose run --rm fetch-merra2), not by this script"
record "merra2/smoke_2026<mmdd>_<hh>30.png" "$MERRA2_URL" "organic + black carbon optical depth on 576 x 360 cells, square root of 0 to 2 as grey 0 to 255, by tools/fetch/merra2_smoke_to_png.py"

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
# The timeline frames of the lightning layer: one image per month (January 2017
# to July 2023, 79 images), each the mean of only that month's ten-day windows,
# never accumulated.
LIGHTNING_MONTHS="5011/months"
# Every month must be there, not only the last.
months_present() {
  local year month
  for year in 2017 2018 2019 2020 2021 2022 2023; do
    for month in 01 02 03 04 05 06 07 08 09 10 11 12; do
      [[ "$year" == "2023" && "$month" > "07" ]] && continue
      [[ -s "$RAW/$LIGHTNING_MONTHS/lightning_${year}_${month}.png" ]] || return 1
    done
  done
}
if [[ "$FORCE" != "1" ]] && months_present \
    && [[ "$RAW/$LIGHTNING_MONTHS/lightning_2023_07.png" -nt "$RAW/$LIGHTNING_DOTS" ]]; then
  echo "  have   $LIGHTNING_MONTHS/lightning_<year>_<mm>.png"
elif ! python3 "$FETCH_TOOLS/lightning_months.py" "$RAW/$LIGHTNING_DOTS" "$RAW/$LIGHTNING_MONTHS" >/dev/null; then
  echo "fetch-frames: could not build the monthly lightning images from $LIGHTNING_DOTS" >&2
  exit 1
fi
for png in "$RAW/$LIGHTNING_MONTHS"/lightning_*_??.png; do
  [[ "$png" == *.part.png || ! -f "$png" ]] && continue
  record "$LIGHTNING_MONTHS/$(basename "$png")" "$LIGHTNING_VIDEO" "mean lightning of the ten-day windows of one month only, from \`data/raw/$LIGHTNING_DOTS\`, by tools/fetch/lightning_months.py"
done

echo "Atmospheric CO2 - OCO-2 GEOS L3 daily (downloaded by fetch-oco2, not by this script)"
OCO2_URL="https://data.gesdisc.earthdata.nasa.gov/data/OCO2_DATA/OCO2_GEOS_L3CO2_DAY.10r/2020/"
record "oco2/nc/oco2_GEOS_L3CO2_day_2020<mmdd>_*.nc4" "$OCO2_URL" "366 daily files of 2020, downloaded with a NASA Earthdata login by tools/fetch/fetch-oco2.sh (docker compose run --rm fetch-oco2), not by this script"
record "oco2/xco2_2020<mmdd>.png" "$OCO2_URL" "XCO2 on 576 x 360 cells, 404 to 420 ppm as grey 0 to 255, by tools/fetch/oco2_to_png.py"

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
below. GEDI L3 (forest height), OCO-2 GEOS (CO2) and MERRA-2 (smoke) need a
free NASA Earthdata login: they are downloaded on their own with \`docker
compose run --rm fetch-gedi\`, \`fetch-oco2\` and \`fetch-merra2\`, which read the
login from \`~/.netrc\` (OCO-2 and MERRA-2 also need the "NASA GESDISC DATA
ARCHIVE" application authorised in the Earthdata profile). Keep only the \`urs.earthdata.nasa.gov\`
line in that file: the download containers can read all of it. No other source
needs a login. This file is
rewritten by \`tools/fetch-frames.sh\` (run it with \`docker compose run --rm fetch\`).

## Layers

| Layer | Source | Period | What the value is |
|---|---|---|---|
| Forest height | [GEDI L3 Gridded Land Surface Metrics, Version 3](https://www.earthdata.nasa.gov/data/catalog/ornl-cloud-gedi-l3-landsurface-metrics-v3-2525-3) (NASA GEDI, ORNL DAAC, DOI [10.3334/ORNLDAAC/2525](https://doi.org/10.3334/ORNLDAAC/2525)), file \`GEDI03_rh100_mean_2019108_2025190_003_01.tif\` (mean canopy height, rh100). Fill: [GEDI Forest Height, NASA SVS 4950](https://svs.gsfc.nasa.gov/4950), 4K frames of the rotating globe | April 2019 - July 2025 (SVS 4950 fill: April 2019 - April 2020) | Mean canopy height measured by GEDI on a fixed scale: **0 m = 0 (byte 0), 50 m or more = 1 (byte 255)**, linear in between. Only cells without any GEDI measurement take the SVS 4950 value instead (relative height 0 to 1 read from the colours of 14 rendered globe views on the published 0 to 50 m colour bar); the two are never blended. |
| Wildfire smoke | [MERRA-2 tavg1_2d_aer_Nx (M2T1NXAER) V5.12.4](https://disc.gsfc.nasa.gov/datasets/M2T1NXAER_5.12.4/summary) (NASA GMAO reanalysis, GES DISC), variables \`OCEXTTAU\` + \`BCEXTTAU\` (organic + black carbon aerosol optical depth at 550 nm) | 1 August to 30 September 2026, every third hour (488 hourly means, 00:30 to 21:30 UTC) | Smoke optical depth on a fixed square-root scale: **0 = 0 (byte 0), 2 or more = 1 (byte 255)**. Dust, sea salt and sulphate are left out, so only smoke from fires shows. |
| Atmospheric CO2 | [OCO-2 GEOS Level 3 daily, 0.5x0.625 assimilated CO2, V10r](https://disc.gsfc.nasa.gov/datasets/OCO2_GEOS_L3CO2_DAY_10r/summary) (NASA GES DISC: the GEOS model with OCO-2 satellite measurements assimilated), variable \`XCO2\` | Every day of 2020 (366 daily means) | Column-averaged CO2 (XCO2) on a fixed scale: **404 ppm = 0 (byte 0), 420 ppm or more = 1 (byte 255)**, linear in between. The whole planet moves with the timeline. Fill values are 0. |
| Lightning | [Lightning Events Detected from the ISS 2017-2023, NASA SVS 5011](https://svs.gsfc.nasa.gov/5011), equirectangular video for spheres (LIS on the ISS) | January 2017 - July 2023, one frame per month (79 frames) | Relative frequency (0 to 1): how often lightning was drawn at each place during that month only (nothing accumulated between frames), read from the video frames. Not a flash count. Drawn from its grids, one month at a time, on the timeline. |

## How each source was turned into a map

- **Smoke.** MERRA-2 stores 361 latitudes (with the poles on the end rows) by
  576 longitudes starting at 180 W (0.5 x 0.625 degree), the same grid as
  OCO-2 GEOS. tools/fetch/fetch-merra2.sh asks NASA's OPeNDAP service for only
  the organic and black carbon optical depth at every third hour of each day
  (about 8 MB a day instead of 470 MB); tools/fetch/merra2_smoke_to_png.py adds
  the two and averages each image cell (576 x 360) from the 2 x 2 block of
  model points around its centre. The square-root scale lets thin haze (about
  0.05) and thick plumes (1 or more) both show. The app grids are 360 x 180 (1
  degree) for the planet and 72 x 56 (0.5 degree, the model's own) for the
  Amazon. In the app one turn of the planet is one day of smoke.
- **CO2.** OCO-2 GEOS L3 stores 361 latitudes (with the poles on the end
  rows) by 576 longitudes starting at 180 W (0.5 x 0.625 degree). Each image
  cell (576 x 360) is the mean of the 2 x 2 block of model points around its
  centre (tools/fetch/oco2_to_png.py), on the fixed 404 to 420 ppm scale, the
  same every day, so both the yearly rise and the northern summer dip (plants
  taking CO2 up) show. The app grids are 360 x 180 (1 degree) for the planet
  and 72 x 56 (0.5 degree, the model's own) for the Amazon. In the app one turn
  of the planet is 30 days. Downloaded with the Earthdata login by
  tools/fetch/fetch-oco2.sh, which lists the daily files from NASA's public
  catalogue (CMR).
- **Lightning.** The video shows a 10-day roving window: each frame holds only
  the last ten days and its last frame is empty, so no single frame holds the
  accumulated period. One frame every 0.4 s of the video (about every 10 days
  of data, about 250 frames in all) was combined: the value is the mean "yellowness"
  of each pixel (lightning is drawn in yellow over a grey map), so places with
  lightning in more windows are brighter (tools/fetch/lightning_composite.py).
  LIS sees only between about 55 N and 55 S.
  **Timeline frames.** The app's lightning layer has one frame per month,
  January 2017 to July 2023 (79 frames), from the same 250 windows kept in
  \`data/raw/5011/lightning_dots_2017_2023.npz\`. The video runs linearly over the
  period (100 s, about 24 days per second), so window k ends about k x 0.4 / 100
  of the way through it; each window goes to the month of its middle day, and
  each month's image is the mean yellowness of its own 2 to 4 windows only, so
  playing them shows where lightning was seen each month (the storm belt
  moving north and south with the seasons), never an accumulation
  (tools/fetch/lightning_months.py, images in \`data/raw/5011/months/\`). In
  the app one turn of the planet is one year of lightning. January - March 2017 is almost empty: the
  video shows almost no lightning in its first weeks (LIS was new on the ISS). The accumulated mean and the
  sharp dots image below are kept but no longer drawn by the app.
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
- MERRA-2: NASA Global Modeling and Assimilation Office (GMAO), distributed by
  the GES DISC; NASA Earth science data are open, with no restrictions on use.
  Credit: NASA GMAO MERRA-2.
- GEDI L3 V3: NASA GEDI mission, distributed by the ORNL DAAC
  (doi:10.3334/ORNLDAAC/2525); NASA Earth science data are open, with no
  restrictions on use. Download needs a free NASA Earthdata login.
- OCO-2 GEOS L3: NASA OCO-2 project and GMAO, distributed by the GES DISC;
  NASA Earth science data are open, with no restrictions on use. Download
  needs a free NASA Earthdata login.
- SVS 4950 and SVS 5011: NASA Scientific Visualization Studio. NASA imagery is
  generally not copyrighted; credit NASA's Scientific Visualization Studio.

## No longer used

- The old smoke frames (SVS 5533), the 1080p GEDI video, the SVS 3615 base
  image (\`earth.jpg\`), the SVS 5196 CO2 orbit frames (replaced by OCO-2
  GEOS, which covers the whole planet every day) and the GEOS-CF PM2.5 files
  (replaced by MERRA-2 carbon optical depth, which leaves desert dust out) are
  no longer downloaded; files already in
  \`data/raw/\` and \`web/public/data/earth.jpg\` are kept.

## Files

| File | Link | How it was obtained |
|---|---|---|
${ROWS}
EOF

echo "fetch-frames: done. Sources written to data/SOURCES.md"
du -sh "$RAW" | sed 's/^/fetch-frames: raw data size /'
