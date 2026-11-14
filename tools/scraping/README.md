# Scraping tools

Python utilities used during exploration of the NASA data sources. They are
**not part of the shipped POC** and are not wired into `run-demo.sh`; the POC
data path is the SVS intensity-grid pipeline described in
`aidlc/spaces/default/intents/261114-earth-jukebox-poc/construction/code-generation/code-generation-plan.md`.

Run everything from this directory so relative outputs land in `./resources/`.

## Environment

NixOS:

```bash
nix develop
```

If `flake.nix` is still untracked in Git, use `nix develop 'path:.'` instead;
Nix ignores untracked files inside a Git work tree.

The shell provides Python 3, `requests`, `pandas`, `xarray`, `netcdf4`, plus the
`netcdf` and `cdo` command-line tools.

## `collect_resources.py`

Generic collector for three sources:

- NASA SVS search API (`https://svs.gsfc.nasa.gov/api/search/`) — metadata for
  candidate visualizations.
- GISTEMP v4 monthly global temperature CSV.
- The **GEOS-FP portal** (`https://portal.nccs.nasa.gov/datashare/gmao/geos-fp/`),
  crawled recursively with strict containment.

Safety properties:

- Only follows plain relative links; rejects `..`, `/`, `?`, `mailto:` and
  anything resolving outside the start URL.
- `visited` set, iterative stack, and `--max-files` / `--max-gb` hard stops.
- `HEAD` size check before downloading; `.part` files removed on failure.
- Skips already-downloaded files; `--dry-run` prints the plan without writing.

Examples:

```bash
# Preview without downloading
python3 collect_resources.py --dry-run --max-files 10 --geos-start forecast/

# One day of the analysis archive, one variable family
python3 collect_resources.py --geos-start das/Y2026/M11/D13 --geos-ext .nc4 --max-gb 20

# Only the SVS metadata + GISTEMP CSV
python3 collect_resources.py --geos-start forecast/ --max-files 0 --no-gistemp
```

Note: the full `das/` archive is terabytes (hourly `.nc4`, Y2014–Y2026). Never
run it without caps.

## `fetch_geos_variable.py`

Downloads the 24 hourly files for one day of a GEOS-FP group, extracts a single
variable with `xarray`, and writes:

- `<VAR>_<YYYY-MM-DD>.nc4` — one variable, zlib-compressed, dims `(time, lat, lon)`.
- `<VAR>_<YYYY-MM-DD>_global_mean.csv` — **cos(lat)-weighted** global mean per
  hour (the unweighted mean is polar-biased; it reports ~278 K instead of ~287 K).
- `raw/` — the original per-hour files, reused on re-runs.

Examples:

Downloads are resumable: partial files are kept as `.part` and continued with
HTTP `Range` on the next attempt, with exponential backoff between retries.

```bash
python3 fetch_geos_variable.py --date 2026-11-13 --group inst1_2d_lfo --variable TLML
python3 fetch_geos_variable.py --date 2026-11-13 --group inst1_2d_lfo --variable SPEEDLML
```

Groups: `inst1_2d_lfo` (hourly surface fields: `TLML`, `PS`, `QLML`,
`SPEEDLML`, `HLML`), `inst1_2d_smp`, `inst3_2d_asm` (3-hourly), etc. Variable
names are case-sensitive and come from the file header (`ncdump -h` or
`xarray`).

## Data scope warning

`resources/` is git-ignored. It can grow to hundreds of MB per day; delete it
when it is no longer needed.
