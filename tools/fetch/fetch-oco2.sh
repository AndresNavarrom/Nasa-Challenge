#!/usr/bin/env bash
# Downloads one year of OCO-2 GEOS Level 3 daily XCO2 (OCO2_GEOS_L3CO2_DAY,
# version 10r, NASA GES DISC: column-averaged CO2 from the GEOS model with OCO-2
# observations assimilated, 0.5 x 0.625 degree) into data/raw/oco2/nc/, and turns
# each day into the 576 x 360 grey image that jukebox-prep reads
# (data/raw/oco2/xco2_<yyyymmdd>.png, tools/fetch/oco2_to_png.py).
#
# The files sit behind a NASA Earthdata login, so, like GEDI, this is a separate
# service from `fetch`:
#
#   docker compose run --rm fetch-oco2          (from the repository root)
#
# It needs ~/.netrc on the host with a line for urs.earthdata.nasa.gov, and the
# application "NASA GESDISC DATA ARCHIVE" authorised in the Earthdata profile
# (https://urs.earthdata.nasa.gov/profile, Applications > Authorized Apps). The
# service mounts ~/.netrc read-only at /root/.netrc; this script never prints,
# copies or stores it. Session cookies live in a temporary folder and are
# deleted on exit.
#
# The list of daily files comes from NASA's public catalogue (CMR), so the exact
# file names are never guessed. Set FORCE=1 to download again files that exist.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RAW="$ROOT/data/raw/oco2"
NETRC="/root/.netrc"
UA="earth-jukebox-fetch/1.0 (NASA Space Apps 2026)"
FORCE="${FORCE:-0}"
YEAR="${OCO2_YEAR:-2020}"
CMR="https://cmr.earthdata.nasa.gov/search/granules.json?short_name=OCO2_GEOS_L3CO2_DAY&version=10r&temporal=${YEAR}-01-01T00:00:00Z,${YEAR}-12-31T23:59:59Z&page_size=400&sort_key=start_date"

fail() {
  echo "fetch-oco2: $*" >&2
  exit 1
}

for tool in curl python3; do
  command -v "$tool" >/dev/null 2>&1 || fail "'$tool' is required; run it in Docker: docker compose run --rm fetch-oco2"
done
if [[ ! -f "$NETRC" || ! -r "$NETRC" ]]; then
  fail "the Earthdata login file is missing: $NETRC (mounted from ~/.netrc on the host)."
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
COOKIES="$WORK/cookies.txt"
mkdir -p "$RAW/nc"

echo "CO2 - OCO-2 GEOS L3 daily XCO2, $YEAR"
curl -fsS -A "$UA" "$CMR" -o "$WORK/granules.json" || fail "could not list the daily files from NASA CMR: $CMR"
python3 -I -c '
import json, sys
links = []
for entry in json.load(open(sys.argv[1]))["feed"]["entry"]:
    urls = [l["href"] for l in entry.get("links", []) if l.get("href", "").endswith(".nc4") and l["href"].startswith("https://data.gesdisc")]
    if urls:
        links.append(urls[0])
print("\n".join(links))
' "$WORK/granules.json" > "$WORK/urls.txt"
count="$(grep -c . "$WORK/urls.txt" || true)"
[[ "$count" -ge 365 ]] || fail "NASA CMR lists only $count daily files for $YEAR (expected 365 or 366)"
echo "  list   $count daily files"

while read -r url; do
  name="$(basename "$url")"
  day="$(sed -E 's/.*_day_([0-9]{8})_.*/\1/' <<<"$name")"
  nc="$RAW/nc/$name"
  png="$RAW/xco2_$day.png"
  if [[ "$FORCE" != "1" && -s "$nc" ]]; then
    echo "  have   oco2/nc/$name"
  else
    echo "  fetch  oco2/nc/$name"
    code="$(HOME=/root curl -sS -n -L -c "$COOKIES" -b "$COOKIES" -A "$UA" --retry 3 --connect-timeout 30 \
      --max-time 900 -o "$nc.part" -w '%{http_code}' "$url" || true)"
    if [[ "$code" != "200" ]] || ! head -c 4 "$nc.part" | grep -q "HDF"; then
      rm -f "$nc.part"
      case "$code" in
        401 | 403) fail "Earthdata refused the download (HTTP $code). Authorise \"NASA GESDISC DATA ARCHIVE\" in your Earthdata profile (https://urs.earthdata.nasa.gov/profile, Applications > Authorized Apps) and check ~/.netrc." ;;
        *) fail "download failed (HTTP ${code:-none}) or the answer is not a NetCDF file: $url" ;;
      esac
    fi
    mv "$nc.part" "$nc"
  fi
  if [[ "$FORCE" != "1" && -s "$png" && "$png" -nt "$nc" ]]; then
    echo "  have   oco2/xco2_$day.png"
  elif ! python3 "$ROOT/tools/fetch/oco2_to_png.py" "$nc" "$png"; then
    fail "could not convert $name"
  fi
done < "$WORK/urls.txt"

echo "fetch-oco2: done. Run docker compose run --rm prep next."
