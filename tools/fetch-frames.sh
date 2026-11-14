#!/usr/bin/env bash
# Downloads the NASA Scientific Visualization Studio frames used by Earth Jukebox
# into data/raw/ and rewrites data/SOURCES.md with every file and its link.
#
# Usage (from the repository root):  tools/fetch-frames.sh
# Needs: curl, ffmpeg. Set FORCE=1 to download again files that already exist.
#
# Total download is about 30 MB plus a few seconds of range requests against one
# large video (frames are extracted remotely, the video is not stored).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RAW="$ROOT/data/raw"
SOURCES="$ROOT/data/SOURCES.md"
UA="Mozilla/5.0 (compatible; data-fetch-script)"
SVS="https://svs.gsfc.nasa.gov/vis/a000000"
FORCE="${FORCE:-0}"
ROWS=""

for tool in curl ffmpeg; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "fetch-frames: '$tool' is required but was not found in PATH" >&2
    exit 1
  fi
done

record() { # file, link, how it was obtained
  ROWS+="| \`data/raw/$1\` | <$2> | $3 |"$'\n'
}

download() { # relative destination, url
  local dest="$RAW/$1" url="$2"
  mkdir -p "$(dirname "$dest")"
  if [[ "$FORCE" != "1" && -s "$dest" ]]; then
    echo "  have   $1"
  else
    echo "  fetch  $1"
    if ! curl -fsSL --retry 2 --connect-timeout 20 --max-time 600 -A "$UA" -o "$dest.part" "$url"; then
      rm -f "$dest.part"
      echo "fetch-frames: download failed: $url" >&2
      exit 1
    fi
    mv "$dest.part" "$dest"
  fi
  record "$1" "$url" "downloaded as published"
}

frame_from_file() { # relative video, seconds, relative destination
  local video="$RAW/$1" at="$2" dest="$RAW/$3"
  mkdir -p "$(dirname "$dest")"
  if [[ "$FORCE" == "1" || ! -s "$dest" ]]; then
    echo "  frame  $3 (at ${at}s)"
    if ! ffmpeg -v error -y -ss "$at" -i "$video" -frames:v 1 "$dest"; then
      echo "fetch-frames: could not extract a frame at ${at}s from $1" >&2
      exit 1
    fi
  else
    echo "  have   $3"
  fi
}

frame_from_url() { # url, seconds, relative destination, ffmpeg scale
  local url="$1" at="$2" dest="$RAW/$3" scale="$4"
  mkdir -p "$(dirname "$dest")"
  if [[ "$FORCE" == "1" || ! -s "$dest" ]]; then
    echo "  frame  $3 (remote, at ${at}s)"
    if ! ffmpeg -v error -y -user_agent "$UA" -ss "$at" -i "$url" -frames:v 1 -vf "scale=$scale" "$dest"; then
      echo "fetch-frames: could not extract a frame at ${at}s from $url" >&2
      exit 1
    fi
  else
    echo "  have   $3"
  fi
  record "$3" "$url" "video frame at ${at} s, scaled to ${scale/:/ x } with ffmpeg"
}

echo "Forest height - GEDI (SVS 4950)"
GEDI_VIDEO="$SVS/a004900/a004950/GEDI_global_w_colorbar_1080p60.mp4"
download "4950/GEDI_global_w_colorbar_1080p60.mp4" "$GEDI_VIDEO"
download "4950/GEDI_colorbar_0to50_01_print.jpg" "$SVS/a004900/a004950/GEDI_colorbar_0to50_01_print.jpg"
# The globe makes one turn in about 50.6 s; 14 frames, 3.6 s (25.6 degrees) apart.
for at in 3.3 6.9 10.5 14.1 17.7 21.3 24.9 28.5 32.1 35.7 39.3 42.9 46.5 50.1; do
  frame_from_file "4950/GEDI_global_w_colorbar_1080p60.mp4" "$at" "4950/gedi_globe_${at}.png"
  record "4950/gedi_globe_${at}.png" "$GEDI_VIDEO" "video frame at ${at} s, extracted with ffmpeg"
done

echo "Wildfire smoke - GEOS-CF air quality (SVS 5533)"
SMOKE_VIDEO="$SVS/a005500/a005533/EIC_AirQuality_Preview_3840x1080.mp4"
# Clip times at which the Amazon rectangle sits fully inside the PM2.5 stripe.
for at in 0 4 53 57 61 65; do
  frame_from_url "$SMOKE_VIDEO" "$at" "5533/eic_airquality_${at}.png" "1920:540"
done

echo "Global CO2 - DYAMOND (SVS 5196)"
CO2_VIDEO="$SVS/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4"
download "5196/dyamond_co2_globe_orbit_1080p30_h265.mp4" "$CO2_VIDEO"
download "5196/dyamondCbar_6-27-2024a.png" "$SVS/a005100/a005196/dyamondCbar_6-27-2024a.png"
# South America faces the camera here. The video advances one model hour per
# frame (30 per second), so frames 0.2 s apart are six hours apart:
# 23 Feb 2020 00:00 UTC to 25 Feb 2020 18:00 UTC.
for at in 31.3 31.5 31.7 31.9 32.1 32.3 32.5 32.7 32.9 33.1 33.3 33.5; do
  frame_from_file "5196/dyamond_co2_globe_orbit_1080p30_h265.mp4" "$at" "5196/co2_globe_${at}.png"
  record "5196/co2_globe_${at}.png" "$CO2_VIDEO" "video frame at ${at} s, extracted with ffmpeg"
done

echo "Base image of the planet (SVS 3615)"
download "earth/earth_noClouds.0330.jpg" "$SVS/a003600/a003615/earth_noClouds.0330.jpg"

cat >"$SOURCES" <<EOF
# Data sources

Everything shown and heard in Earth Jukebox comes from visualizations published
by the NASA Scientific Visualization Studio (SVS) for the Earth Information
Center. This file is rewritten by \`tools/fetch-frames.sh\`.

## Important: what the values are

The values are **relative intensities (0 to 1) read from the colours of rendered
visualization frames**. They are not physical measurements and must not be read
as metres, micrograms or ppm. Georeferencing of the globe views was done by hand
(coastline landmarks) and is approximate, with errors of roughly 1 to 2 degrees.

## Layers

| Layer | NASA visualization | Frames used | View | How colour becomes a value |
|---|---|---|---|---|
| Forest height | [GEDI Forest Height, SVS 4950](https://svs.gsfc.nasa.gov/4950) (data April 2019 - April 2020) | 14 frames of the rotating-globe video | Global mosaic and Amazon detail | Position on the published colour bar (0 to 50 m) |
| Wildfire smoke | [Air Quality Model Runs, SVS 5533](https://svs.gsfc.nasa.gov/5533) (GEOS-CF, July - August 2024), Earth Information Center hyperwall version | 6 frames of the flat-map video | **Amazon only** | Darkness of the PM2.5 colour (pale = clean, dark = smoky) |
| Global CO2 | [DYAMOND Global Carbon Dioxide, SVS 5196](https://svs.gsfc.nasa.gov/5196) (January - March 2020) | 12 frames of the orbiting-globe video, 23 - 25 Feb 2020, every 6 hours | **Amazon only** | "Warmth" of the pixel (red minus blue), which rises along the published colour bar (cream, orange, red) and with the opacity of the gas |

## Fallbacks applied (see the risk table in the requirements)

- **No .exr files** are published for these visualizations; png, jpg and mp4 frames were used.
- **Smoke has no single flat global view of one pollutant.** The published map
  shows four pollutants in vertical stripes that sweep across a fixed map. Only
  the moments when the Amazon rectangle sits entirely inside the PM2.5 stripe
  were used, so the layer is regional only. The video carries no date stamp, so
  each instant is labelled with the period (July - August 2024) and its clip time.
- **CO2 has no flat global view.** The camera orbits a rendered globe, so only
  the frames where South America faces the camera were used; the layer is
  regional only and covers 23 to 25 February 2020 in six-hour steps (dates
  worked out from the stamp in the frames: one model hour per video frame).
  Brightness in this visualization also depends on the viewing angle through
  the gas, which adds to the uncertainty. The gas is drawn semi-transparent, so
  its colours on screen are darker than the published colour bar; the bar
  position could not be read directly and the red-minus-blue "warmth" is used
  instead. In these frames the Amazon is brightest at 06:00 and 12:00 UTC (night
  and early morning there) and dimmest at 18:00 UTC (early afternoon there), on
  all three days.
- **Forest height is a mosaic** of 14 views of a rotating globe rendered with
  lighting and exaggerated height, so shading affects the colours.
- On the planet, the two regional-only layers are drawn and heard over the
  Amazon rectangle only.

## Amazon rectangle

West 80 W, east 44 W, south 20 S, north 8 N.

## Base image of the planet

Cloud-free flat map of the Earth from "Equirectangular Projected Earth for
LARGEST", NASA Scientific Visualization Studio, SVS 3615:
<https://svs.gsfc.nasa.gov/3615>. It is only the backdrop of the planet and the
map; it carries no data values.

## Files

| File | Link | How it was obtained |
|---|---|---|
${ROWS}
EOF

echo "fetch-frames: done. Sources written to data/SOURCES.md"
du -sh "$RAW" | sed 's/^/fetch-frames: raw data size /'
