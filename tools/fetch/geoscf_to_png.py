"""GEOS-CF PM2.5 (NetCDF) -> 1440 x 720 grey PNG that jukebox-prep can read.

GEOS-CF v2 files (aqc_tavg_1hr_glo_L1440x721_slv) hold one hour of surface air
quality on a 0.25 degree grid of 1440 x 721 points:
- latitudes run from -90 (south pole, first row) to +90 (north pole, last row),
  so the two poles sit on the end rows;
- longitudes start at -180, so the first column is centred on -180.

The app's grid format is 1440 x 720 cells, north row first, with cell centres at
half a cell from the edges (the first cell starts at -180 and at +90). Each
output cell is therefore the mean of the 2 x 2 block of source points around
its centre: two neighbouring rows (721 -> 720) and two neighbouring columns
(half a cell to the east, wrapping at the date line).

Fixed scale (FR4.3): PM2.5 0 ug/m3 -> grey 0, 150 ug/m3 -> grey 255, linear in
between; values above 150 stay at 255; fill values and missing points are 0.

Usage: python geoscf_to_png.py INPUT.nc4 OUTPUT.png
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

# Surface PM2.5 at 35 % relative humidity, in ug m-3: the name used by the GEOS-CF v2
# aqc_tavg_1hr_glo_L1440x721_slv files (checked on the 2026-09-01 00:30 file; v1
# files called it PM25_RH35_GCC).
PM25_VARIABLE = "PM25_RH35"
SOURCE_SHAPE = (721, 1440)
TARGET_SHAPE = (720, 1440)
# Fixed scale of the smoke layer, in micrograms per cubic metre.
PM25_MAX = 150.0
# GEOS files mark missing points with 1e15; anything this large is not data.
FILL_THRESHOLD = 1e14


class ConversionError(Exception):
    """A problem with the input file, with a message for the person running the script."""


def check_shape(values: np.ndarray) -> None:
    if np.shape(values) != SOURCE_SHAPE:
        raise ConversionError(
            f"expected {SOURCE_SHAPE[0]} latitudes x {SOURCE_SHAPE[1]} longitudes "
            f"(GEOS-CF L1440x721), got an array of shape {np.shape(values)}"
        )


def to_app_grid(values: np.ndarray, south_first: bool = True) -> np.ndarray:
    """721 x 1440 points -> 720 x 1440 cells, north row first, NaN where nothing was valid.

    `south_first` tells whether the first input row is the south pole (GEOS-CF order).
    """
    check_shape(values)
    data = np.asarray(values, dtype=np.float64).copy()
    data[~np.isfinite(data) | (np.abs(data) >= FILL_THRESHOLD)] = np.nan
    if not south_first:
        data = data[::-1]
    rows = np.stack([data[:-1], data[1:]])  # two neighbouring latitudes per cell
    block = np.concatenate([rows, np.roll(rows, -1, axis=2)])  # and two neighbouring longitudes
    valid = np.isfinite(block)
    total = np.where(valid, block, 0.0).sum(axis=0)
    count = valid.sum(axis=0)
    grid = np.full(total.shape, np.nan)
    np.divide(total, count, out=grid, where=count > 0)
    return grid[::-1]  # north row first


def pm25_to_grey(grid: np.ndarray) -> np.ndarray:
    """PM2.5 in ug/m3 -> bytes on the fixed 0..150 scale; NaN and negatives become 0."""
    clean = np.nan_to_num(np.asarray(grid, dtype=np.float64), nan=0.0, posinf=PM25_MAX, neginf=0.0)
    scaled = np.clip(clean, 0.0, PM25_MAX) * (255.0 / PM25_MAX)
    return np.rint(scaled).astype(np.uint8)


def convert(values: np.ndarray, south_first: bool = True) -> np.ndarray:
    """Whole conversion: 721 x 1440 PM2.5 points -> 720 x 1440 grey bytes."""
    grey = pm25_to_grey(to_app_grid(values, south_first))
    assert grey.shape == TARGET_SHAPE
    return grey


def read_pm25(path: Path) -> tuple[np.ndarray, bool]:
    """Reads the PM2.5 field of one GEOS-CF file; returns it and whether the south row comes first."""
    from netCDF4 import Dataset  # imported here so the pure functions need only numpy

    try:
        dataset = Dataset(path)
    except OSError as cause:
        raise ConversionError(f"could not open {path}: {cause}") from cause
    with dataset:
        if PM25_VARIABLE not in dataset.variables:
            names = ", ".join(sorted(dataset.variables))
            raise ConversionError(f"{path} has no variable {PM25_VARIABLE}; it holds: {names}")
        variable = dataset.variables[PM25_VARIABLE]
        values = np.ma.filled(np.ma.asarray(variable[:], dtype=np.float64), np.nan)
        values = np.squeeze(values)  # drop the single time step
        lat = np.asarray(dataset.variables["lat"][:]) if "lat" in dataset.variables else None
    south_first = True if lat is None or lat.size < 2 else bool(lat[0] < lat[-1])
    return values, south_first


def write_png(grey: np.ndarray, path: Path) -> None:
    from PIL import Image

    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(grey, mode="L").save(path)


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    source, target = Path(argv[0]), Path(argv[1])
    try:
        values, south_first = read_pm25(source)
        grey = convert(values, south_first)
        write_png(grey, target)
    except ConversionError as error:
        print(f"geoscf_to_png: {error}", file=sys.stderr)
        return 1
    print(f"  png    {target} (max grey {int(grey.max())})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
