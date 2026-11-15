#!/usr/bin/env bash
# Downloads the smoke of the 2026 fire season from MERRA-2 (M2T1NXAER, hourly
# aerosol diagnostics, NASA GMAO, distributed by the GES DISC): organic and black
# carbon optical depth, every third hour, 1 August to 30 September 2026, into
# data/raw/merra2/nc/, and turns each instant into the 576 x 360 grey image that
# jukebox-prep reads (data/raw/merra2/smoke_<yyyymmdd>_<hh>30.png,
# tools/fetch/merra2_smoke_to_png.py).
#
# A whole daily file is about 470 MB; through NASA's OPeNDAP service only the two
# smoke variables at 8 of the 24 hours are asked for (about 8 MB a day).
#
# Behind the NASA Earthdata login, with the "NASA GESDISC DATA ARCHIVE"
# application authorised (the same as OCO-2):
#
#   docker compose run --rm fetch-merra2          (from the repository root)
#
# The service mounts ~/.netrc read-only at /root/.netrc; this script never
# prints, copies or stores it. The daily files are listed from NASA's public
# catalogue (CMR). Set FORCE=1 to download again files that exist.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RAW="$ROOT/data/raw/merra2"
NETRC="/root/.netrc"
UA="earth-jukebox-fetch/1.0 (NASA Space Apps 2026)"
FORCE="${FORCE:-0}"
FIRST="${MERRA2_FIRST:-2026-08-01}"
LAST="${MERRA2_LAST:-2026-09-30}"
PARALLEL="${MERRA2_PARALLEL:-6}"
CMR="https://cmr.earthdata.nasa.gov/search/granules.json?short_name=M2T1NXAER&version=5.12.4&temporal=${FIRST}T00:00:00Z,${LAST}T23:59:59Z&page_size=400&sort_key=start_date"
# Organic and black carbon optical depth, every third hour (0:3:23), the whole grid.
CE="/OCEXTTAU%5B0:3:23%5D%5B0:360%5D%5B0:575%5D%3B/BCEXTTAU%5B0:3:23%5D%5B0:360%5D%5B0:575%5D"

fail() {
  echo "fetch-merra2: $*" >&2
  exit 1
}

for tool in curl python3 xargs; do
  command -v "$tool" >/dev/null 2>&1 || fail "'$tool' is required; run it in Docker: docker compose run --rm fetch-merra2"
done
[[ -f "$NETRC" && -r "$NETRC" ]] || fail "the Earthdata login file is missing: $NETRC (mounted from ~/.netrc on the host)."

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$RAW/nc"

echo "Wildfire smoke - MERRA-2 organic + black carbon optical depth, $FIRST to $LAST, every 3 hours"
curl -fsS -A "$UA" "$CMR" -o "$WORK/granules.json" || fail "could not list the daily files from NASA CMR: $CMR"
# One line per day: yyyymmdd and the OPeNDAP address of that day's file.
python3 -I -c '
import json, re, sys
for entry in json.load(open(sys.argv[1]))["feed"]["entry"]:
    day = re.search(r"\.(\d{8})\.nc4", entry["title"])
    urls = [l["href"] for l in entry.get("links", []) if l.get("href", "").startswith("https://opendap.earthdata.nasa.gov/")]
    if day and urls:
        print(day.group(1), urls[0])
' "$WORK/granules.json" > "$WORK/days.txt"
expected=$(( ( $(date -u -d "$LAST" +%s) - $(date -u -d "$FIRST" +%s) ) / 86400 + 1 ))
count="$(grep -c . "$WORK/days.txt" || true)"
[[ "$count" -eq "$expected" ]] || fail "NASA CMR lists $count daily files, expected $expected ($FIRST to $LAST)"
echo "  list   $count days"

export RAW UA CE FORCE COOKIES_DIR="$WORK"
# Each download: the two variables of one day, checked to be a NetCDF-4 (HDF5) file.
fetch_day() {
  local day="$1" url="$2" nc="$RAW/nc/smoke_$1.nc4" code
  if [[ "$FORCE" != "1" && -s "$nc" ]]; then
    echo "  have   merra2/nc/smoke_$day.nc4"
    return 0
  fi
  code="$(HOME=/root curl -sS -n -L -c "$COOKIES_DIR/c_$day" -b "$COOKIES_DIR/c_$day" -A "$UA" --retry 3 \
    --connect-timeout 30 --max-time 900 -o "$nc.part" -w '%{http_code}' "$url.dap.nc4?dap4.ce=$CE" || true)"
  if [[ "$code" != "200" ]] || ! head -c 4 "$nc.part" | grep -q "HDF"; then
    rm -f "$nc.part"
    echo "fetch-merra2: download failed for $day (HTTP ${code:-none}). If it is 401, authorise \"NASA GESDISC DATA ARCHIVE\" in your Earthdata profile." >&2
    return 1
  fi
  mv "$nc.part" "$nc"
  echo "  fetch  merra2/nc/smoke_$day.nc4"
}
export -f fetch_day
xargs -P "$PARALLEL" -L 1 bash -c 'fetch_day "$0" "$1"' < "$WORK/days.txt" || fail "some days could not be downloaded; run it again (finished days are kept)"

while read -r day _; do
  nc="$RAW/nc/smoke_$day.nc4"
  if [[ "$FORCE" != "1" && -s "$RAW/smoke_${day}_2130.png" && "$RAW/smoke_${day}_2130.png" -nt "$nc" ]]; then
    echo "  have   merra2/smoke_${day}_*.png"
  elif ! python3 "$ROOT/tools/fetch/merra2_smoke_to_png.py" "$nc" "$RAW" "$day"; then
    fail "could not convert $nc"
  fi
done < "$WORK/days.txt"

echo "fetch-merra2: done. Run docker compose run --rm prep next."
