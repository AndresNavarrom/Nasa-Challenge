"""OCO-2 GEOS daily XCO2 (NetCDF) -> 576 x 360 grey PNG that jukebox-prep can read.

OCO2_GEOS_L3CO2_DAY (version 10r, NASA GES DISC) holds one day of column-
averaged CO2 (XCO2, mol/mol) from the GEOS model with OCO-2 observations
assimilated, on a 0.5 x 0.625 degree grid of 361 x 576 points:
- latitudes run from -90 (south pole, first row) to +90 (north pole, last row);
- longitudes start at -180, 0.625 degree apart.

The app reads plain cells, north row first, with cell centres at half a cell
from the edges. Each output cell (576 x 360 cells of 0.625 x 0.5 degree, the
first starting at -180 and +90) is the mean of the 2 x 2 block of source points
around its centre: two neighbouring rows (361 -> 360) and two neighbouring
columns (half a cell to the east, wrapping at the date line).

Fixed scale (the same for every day, so days can be compared): XCO2_LOW ppm ->
grey 0, XCO2_HIGH ppm -> grey 255, linear in between and clipped outside; fill
values are 0. The prints give the day's range in ppm so the scale can be checked.

Usage: python oco2_to_png.py INPUT.nc4 OUTPUT.png
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

XCO2_VARIABLE = "XCO2"
SOURCE_SHAPE = (361, 576)
TARGET_SHAPE = (360, 576)
# Fixed scale of the CO2 layer, in parts per million (2020 spans about 404 to 418 ppm).
XCO2_LOW = 404.0
XCO2_HIGH = 420.0
# GEOS files mark missing points with 1e15; anything this large is not data.
FILL_THRESHOLD = 1e14


class ConversionError(Exception):
    """A problem with the input file, with a message for the person running the script."""


def to_app_grid(values: np.ndarray, south_first: bool = True) -> np.ndarray:
    """361 x 576 points -> 360 x 576 cells, north row first, NaN where nothing was valid."""
    if np.shape(values) != SOURCE_SHAPE:
        raise ConversionError(
            f"expected {SOURCE_SHAPE[0]} latitudes x {SOURCE_SHAPE[1]} longitudes "
            f"(OCO-2 GEOS L3, 0.5 x 0.625 degree), got an array of shape {np.shape(values)}"
        )
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


def ppm_to_grey(grid_ppm: np.ndarray, low: float = XCO2_LOW, high: float = XCO2_HIGH) -> np.ndarray:
    """XCO2 in ppm -> bytes on the fixed low..high scale; NaN becomes 0."""
    data = np.asarray(grid_ppm, dtype=np.float64)
    scaled = (np.clip(data, low, high) - low) * (255.0 / (high - low))
    return np.rint(np.nan_to_num(scaled, nan=0.0)).astype(np.uint8)


def convert(values_mol: np.ndarray, south_first: bool = True) -> tuple[np.ndarray, float, float]:
    """Whole conversion: 361 x 576 XCO2 points (mol/mol) -> 360 x 576 grey bytes and the day's ppm range."""
    grid = to_app_grid(values_mol, south_first) * 1e6
    grey = ppm_to_grey(grid)
    assert grey.shape == TARGET_SHAPE
    return grey, float(np.nanmin(grid)), float(np.nanmax(grid))


def read_xco2(path: Path) -> tuple[np.ndarray, bool]:
    """Reads the XCO2 field of one daily file; returns it and whether the south row comes first."""
    from netCDF4 import Dataset  # imported here so the pure functions need only numpy

    try:
        dataset = Dataset(path)
    except OSError as cause:
        raise ConversionError(f"could not open {path}: {cause}") from cause
    with dataset:
        if XCO2_VARIABLE not in dataset.variables:
            names = ", ".join(sorted(dataset.variables))
            raise ConversionError(f"{path} has no variable {XCO2_VARIABLE}; it holds: {names}")
        variable = dataset.variables[XCO2_VARIABLE]
        values = np.squeeze(np.ma.filled(np.ma.asarray(variable[:], dtype=np.float64), np.nan))
        lat = np.asarray(dataset.variables["lat"][:]) if "lat" in dataset.variables else None
    south_first = True if lat is None or lat.size < 2 else bool(lat[0] < lat[-1])
    return values, south_first


def write_png(grey: np.ndarray, path: Path) -> None:
    from PIL import Image

    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_name(path.name + ".part.png")
    Image.fromarray(grey, mode="L").save(partial)
    partial.replace(path)


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    source, target = Path(argv[0]), Path(argv[1])
    try:
        values, south_first = read_xco2(source)
        grey, low, high = convert(values, south_first)
        write_png(grey, target)
    except ConversionError as error:
        print(f"oco2_to_png: {error}", file=sys.stderr)
        return 1
    print(f"  png    {target} (XCO2 {low:.1f} to {high:.1f} ppm)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
