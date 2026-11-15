#!/usr/bin/env bash
# Downloads GEDI L3 Gridded Land Surface Metrics V3 mean canopy height (rh100_mean,
# ORNL DAAC, doi:10.3334/ORNLDAAC/2525) into data/raw/gedi/ and turns it into the
# 3600 x 1800 RGBA image that jukebox-prep reads (tools/fetch/gedi_l3_to_png.py).
# Once `prep` has written web/public/data/, it also draws the sharp greyscale
# forest images of the planet view there (forest-height-8k.png, -4k.png and
# -amazon.png, tools/fetch/gedi_visual.py).
#
# The file sits behind a NASA Earthdata login, so this is a separate service from
# `fetch` and only the person preparing GEDI needs an account:
#
#   docker compose run --rm fetch-gedi          (from the repository root)
#
# It needs ~/.netrc on the host with a line for urs.earthdata.nasa.gov; the
# service mounts it read-only at /root/.netrc. This script never prints, copies or
# stores that file: curl reads it directly. Session cookies live in a temporary
# folder inside the container and are deleted on exit.
#
# Set FORCE=1 (docker compose run --rm -e FORCE=1 fetch-gedi) to download again a
# file that already exists. The download is about 617 MB.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RAW="$ROOT/data/raw/gedi"
NAME="GEDI03_rh100_mean_2019108_2025190_003_01.tif"
URL="https://data.ornldaac.earthdata.nasa.gov/protected/gedi/GEDI_L3_LandSurface_Metrics_V3/data/$NAME"
PNG="$RAW/gedi_l3_rh100_mean_0p1deg.png"
WEB_DATA="$ROOT/web/public/data"
NETRC="/root/.netrc"
UA="earth-jukebox-fetch/1.0 (NASA Space Apps 2026)"
FORCE="${FORCE:-0}"

fail() {
  echo "fetch-gedi: $*" >&2
  exit 1
}

for tool in curl python3 stat; do
  command -v "$tool" >/dev/null 2>&1 || fail "'$tool' is required; run it in Docker: docker compose run --rm fetch-gedi"
done

if [[ ! -f "$NETRC" || ! -r "$NETRC" ]]; then
  fail "the Earthdata login file is missing: $NETRC (mounted from ~/.netrc on the host).
fetch-gedi: create ~/.netrc with a line for urs.earthdata.nasa.gov, then run: docker compose run --rm fetch-gedi"
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
COOKIES="$WORK/cookies.txt"
HEADERS="$WORK/headers.txt"

mkdir -p "$RAW"
DEST="$RAW/$NAME"

download() {
  local part="$DEST.part" result code type
  echo "  fetch  gedi/$NAME (about 617 MB)"
  # -f: an HTTP error stops curl; -n: login from $HOME/.netrc (/root/.netrc, the
  # read-only mount); -L: follow the redirect to the Earthdata login and back;
  # -c/-b: keep the session cookie.
  if ! result="$(HOME=/root curl -f -sS -n -L -c "$COOKIES" -b "$COOKIES" -A "$UA" \
      --retry 3 --connect-timeout 30 --max-time 3600 -D "$HEADERS" -o "$part" \
      -w '%{http_code} %{content_type}' "$URL")"; then
    rm -f "$part"
    code="$(last_status)"
    case "$code" in
      401 | 403) fail "Earthdata refused the download (HTTP $code). Check the login in ~/.netrc and that ORNL DAAC is authorised in your Earthdata profile (https://urs.earthdata.nasa.gov/profile)." ;;
      *) fail "download failed (HTTP ${code:-none}): $URL" ;;
    esac
  fi
  code="${result%% *}"
  type="${result#* }"
  if [[ "$code" != "200" ]]; then
    rm -f "$part"
    fail "expected HTTP 200 for the GeoTIFF, got $code: $URL"
  fi
  if [[ "$type" == text/html* ]] || ! is_tiff "$part"; then
    rm -f "$part"
    fail "Earthdata answered with a web page instead of the GeoTIFF: the login failed or ORNL DAAC is not authorised in your Earthdata profile (https://urs.earthdata.nasa.gov/profile)."
  fi
  check_size "$part"
  mv "$part" "$DEST"
}

last_status() { # HTTP status of the last response in the header dump
  [[ -s "$HEADERS" ]] || return 0
  awk 'toupper($1) ~ /^HTTP\// { code = $2 } END { print code }' "$HEADERS"
}

last_length() { # Content-Length of the last response in the header dump
  awk 'toupper($1) ~ /^HTTP\// { length_ = "" } tolower($1) == "content-length:" { length_ = $2 } END { gsub(/\r/, "", length_); print length_ }' "$HEADERS"
}

is_tiff() { # little- or big-endian TIFF / BigTIFF signature
  python3 -I -c 'import sys; head = open(sys.argv[1], "rb").read(4); sys.exit(0 if head[:2] in (b"II", b"MM") and head[2:4] in (b"*\0", b"\0*", b"+\0", b"\0+") else 1)' "$1"
}

check_size() {
  local file="$1" expected actual
  expected="$(last_length)"
  actual="$(stat -c %s "$file")"
  if [[ -z "$expected" ]]; then
    rm -f "$file"
    fail "the server sent no Content-Length, so the download cannot be checked; try again"
  fi
  if [[ "$actual" != "$expected" ]]; then
    rm -f "$file"
    fail "incomplete download: $actual bytes received, the server announced $expected; try again"
  fi
  echo "  size   $actual bytes (Content-Length $expected)"
}

if [[ "$FORCE" != "1" && -s "$DEST" ]]; then
  echo "  have   gedi/$NAME ($(stat -c %s "$DEST") bytes)"
else
  download
fi

echo "  png    gedi/$(basename "$PNG")"
if ! python3 "$ROOT/tools/fetch/gedi_l3_to_png.py" "$DEST" "$PNG"; then
  rm -f "$PNG"
  fail "could not convert gedi/$NAME"
fi

# The sharp forest images of the planet view (tools/fetch/gedi_visual.py) fill the
# gaps of GEDI with the final forest grid of `prep`, so they can only be made once
# prep has run.
if [[ -f "$WEB_DATA/forest_global.bin" && -f "$WEB_DATA/manifest.json" ]]; then
  echo "  png    web/public/data/forest-height-{8k,4k,amazon}.png"
  if ! python3 "$ROOT/tools/fetch/gedi_visual.py" --tif "$DEST" --fill "$PNG" --data-dir "$WEB_DATA"; then
    fail "could not make the forest images in web/public/data/ from gedi/$NAME"
  fi
else
  echo "fetch-gedi: web/public/data/forest_global.bin is not there yet, so the sharp forest images were not made." >&2
  echo "fetch-gedi: run docker compose run --rm prep, then docker compose run --rm fetch-gedi again (no new download)." >&2
fi
echo "fetch-gedi: done"
