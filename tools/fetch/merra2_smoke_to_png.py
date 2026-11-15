"""MERRA-2 smoke (organic + black carbon optical depth) -> one grey PNG per instant.

MERRA-2 tavg1_2d_aer_Nx (M2T1NXAER, NASA GMAO, distributed by the GES DISC) gives
hourly means of aerosol optical depth at 550 nm by species. Smoke from fires is
carbonaceous: organic carbon (OCEXTTAU) plus black carbon (BCEXTTAU). Their sum
leaves out desert dust, sea salt and sulphate, so the layer shows smoke only.

fetch-merra2.sh downloads, per day, only these two variables every third hour
(00:30, 03:30 ... 21:30 UTC) through OPeNDAP, on MERRA-2's 0.5 x 0.625 degree
grid of 361 x 576 points (latitudes from -90, longitudes from -180: the same grid
as OCO-2 GEOS, so the 2 x 2 cell averaging of oco2_to_png.py is reused).

Scale (the same for every instant): the square root of the optical depth over
0..AOD_MAX, so thin haze (about 0.05) and thick plumes (1 or more) both show:
0 -> grey 0, AOD_MAX or more -> grey 255.

Usage: python merra2_smoke_to_png.py INPUT.nc4 OUTPUT_DIR YYYYMMDD
Writes OUTPUT_DIR/smoke_<YYYYMMDD>_<hh>30.png for each instant of the file.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

from oco2_to_png import ConversionError, to_app_grid, write_png

VARIABLES = ("OCEXTTAU", "BCEXTTAU")
# Optical depth that takes the top of the scale; thicker plumes stay at 255.
AOD_MAX = 2.0
# Hours of the instants in each daily file (every third hourly mean, from 00:30 UTC).
HOURS = tuple(range(0, 24, 3))


def aod_to_grey(aod: np.ndarray, aod_max: float = AOD_MAX) -> np.ndarray:
    """Optical depth -> bytes on the square-root scale; NaN and negatives become 0."""
    data = np.nan_to_num(np.asarray(aod, dtype=np.float64), nan=0.0)
    scaled = np.sqrt(np.clip(data, 0.0, aod_max) / aod_max) * 255.0
    return np.rint(scaled).astype(np.uint8)


def convert(organic: np.ndarray, black: np.ndarray) -> list[np.ndarray]:
    """(instants x 361 x 576) organic and black carbon optical depth -> one 360 x 576 grey image per instant."""
    if np.shape(organic) != np.shape(black) or np.ndim(organic) != 3:
        raise ConversionError(
            f"expected two arrays of instants x latitudes x longitudes, got {np.shape(organic)} and {np.shape(black)}"
        )
    smoke = np.asarray(organic, dtype=np.float64) + np.asarray(black, dtype=np.float64)
    return [aod_to_grey(to_app_grid(instant)) for instant in smoke]


def output_name(day: str, hour: int) -> str:
    return f"smoke_{day}_{hour:02d}30.png"


def read_smoke(path: Path) -> tuple[np.ndarray, np.ndarray]:
    from netCDF4 import Dataset  # imported here so the pure functions need only numpy

    try:
        dataset = Dataset(path)
    except OSError as cause:
        raise ConversionError(f"could not open {path}: {cause}") from cause
    with dataset:
        missing = [name for name in VARIABLES if name not in dataset.variables]
        if missing:
            names = ", ".join(sorted(dataset.variables))
            raise ConversionError(f"{path} has no {', '.join(missing)}; it holds: {names}")
        organic, black = (
            np.ma.filled(np.ma.asarray(dataset.variables[name][:], dtype=np.float64), np.nan) for name in VARIABLES
        )
    return organic, black


def main(argv: list[str]) -> int:
    if len(argv) != 3 or len(argv[2]) != 8 or not argv[2].isdigit():
        print(__doc__.strip().splitlines()[-2], file=sys.stderr)
        return 2
    source, target, day = Path(argv[0]), Path(argv[1]), argv[2]
    try:
        organic, black = read_smoke(source)
        images = convert(organic, black)
        if len(images) != len(HOURS):
            raise ConversionError(f"{source} holds {len(images)} instants, expected {len(HOURS)} (every third hour)")
        for hour, grey in zip(HOURS, images):
            write_png(grey, target / output_name(day, hour))
    except ConversionError as error:
        print(f"merra2_smoke_to_png: {error}", file=sys.stderr)
        return 1
    peak = float(np.nanmax(organic + black))
    print(f"  png    {target}/smoke_{day}_*.png ({len(images)} instants, smoke optical depth up to {peak:.2f})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
