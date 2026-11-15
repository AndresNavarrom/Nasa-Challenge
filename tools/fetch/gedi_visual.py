"""GEDI L3 canopy height (1 km GeoTIFF) -> sharp greyscale forest images for the planet view.

The sound and the probe read the 0.25 degree grids written by jukebox-prep; that is
too coarse to draw the forest like NASA SVS 4950. This script draws it from the
GEDI L3 V3 file itself (rh100_mean, EASE-Grid 2.0, about 1 km per pixel) into three
8-bit greyscale PNG images (one channel), north row first, west column first:

- forest-height-8k.png      8192 x 4096, whole planet, 180 W to 180 E, 90 N to 90 S;
- forest-height-4k.png      4096 x 2048, the same at half size (?lite=1, small cards);
- forest-height-amazon.png  the Amazon rectangle of manifest.json at 0.01 degree
                            (3600 x 2800 for 80 W to 44 W, 20 S to 8 N).

Value = height on the fixed scale of the forest layer, 0 m -> 0 and 50 m or more
-> 255 (round half up), the same scale as gedi_l3_to_png.py. 0 also means "no
forest or no data": the planet view draws nothing there.

Each pixel is the mean of the GEDI pixels with data whose centre falls in it.
A pixel that receives no GEDI pixel at all (GEDI only measures along its orbit
tracks: near Manaus about half of the 1 km pixels are empty) is filled, first
match wins:

1. with the GEDI pixel whose area holds the pixel centre, if it has data (only
   matters at 0.01 degree, where GEDI's 0.0104 degree columns are wider than the
   output pixels and every 26th output column would otherwise receive none);
2. with the GEDI mean over 2 x 2, 4 x 4 ... output pixels, as long as those are
   finer than the 0.1 degree image (0.02, 0.04 and 0.08 degree for the Amazon,
   0.088 degree for the 8k image), so the gaps between orbit tracks take a local
   value instead of a 0.1 degree block;
3. with the 0.1 degree GEDI image made by gedi_l3_to_png.py (alpha 0 = no data);
4. with the final forest grid of jukebox-prep (forest_global.bin, 0.25 degree),
   which already holds the NASA SVS 4950 fill beyond about 52 N and S.

Steps 2 and 3 interpolate bilinearly between the coarser cells that have data and
use the result only where at least half of the interpolation weight comes from
cells with data, so the fill never reaches more than half a coarse cell beyond
the data; step 4 interpolates bilinearly.

The GeoTIFF is read tile by tile (about 2 GB decoded, never whole); the sums for
the 8k and Amazon images take about 0.6 GB.

Usage: python gedi_visual.py [--tif PATH] [--fill PATH] [--data-dir DIR]
  --tif       GEDI L3 rh100_mean GeoTIFF (default data/raw/gedi/GEDI03_rh100_mean_...tif)
  --fill      0.1 degree image of gedi_l3_to_png.py (default data/raw/gedi/gedi_l3_rh100_mean_0p1deg.png)
  --data-dir  folder with manifest.json and forest_global.bin, where the images are
              written (default web/public/data)
"""

from __future__ import annotations

import argparse
import json
import os
import resource
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np

from gedi_l3_to_png import (
    HEIGHT_MAX,
    ConversionError,
    Georeference,
    iter_blocks,
    load_georeference,
    pixel_lon_lat,
    valid_mask,
)

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TIF = ROOT / "data/raw/gedi/GEDI03_rh100_mean_2019108_2025190_003_01.tif"
DEFAULT_FILL = ROOT / "data/raw/gedi/gedi_l3_rh100_mean_0p1deg.png"
DEFAULT_DATA_DIR = ROOT / "web/public/data"

GLOBAL_WIDTH = 8192  # the 4k image is this halved
REGION_CELL_DEGREES = 0.01
OUTPUT_8K = "forest-height-8k.png"
OUTPUT_4K = "forest-height-4k.png"
OUTPUT_REGION = "forest-height-amazon.png"
GRID_FILE = "forest_global.bin"
MANIFEST_FILE = "manifest.json"
# A coarser fill is used only where at least this share of its bilinear weight has data.
MIN_FILL_WEIGHT = 0.5
# Rows interpolated at a time while filling (bounds the temporary arrays).
FILL_ROW_CHUNK = 256


@dataclass(frozen=True)
class TargetGrid:
    """An equirectangular raster: `width` x `height` square cells of `cell` degrees from (west, north)."""

    west: float
    north: float
    cell: float
    width: int
    height: int

    @property
    def wraps(self) -> bool:
        """True when the raster goes all the way round the planet in longitude."""
        return abs(self.width * self.cell - 360.0) < 1e-9

    def columns_of(self, lons: np.ndarray) -> np.ndarray:
        """Column of each longitude, -1 outside the raster."""
        column = np.floor((np.asarray(lons, dtype=np.float64) - self.west) / self.cell).astype(np.int64)
        if self.wraps:
            return np.mod(column, self.width)
        return np.where((column >= 0) & (column < self.width), column, -1)

    def rows_of(self, lats: np.ndarray) -> np.ndarray:
        """Row (north first) of each latitude, -1 outside the raster."""
        row = np.floor((self.north - np.asarray(lats, dtype=np.float64)) / self.cell).astype(np.int64)
        if self.wraps:  # a whole-planet raster also covers the poles exactly
            row = np.clip(row, 0, self.height - 1)
        return np.where((row >= 0) & (row < self.height), row, -1)

    def centre_lons(self) -> np.ndarray:
        return self.west + (np.arange(self.width, dtype=np.float64) + 0.5) * self.cell

    def centre_lats(self) -> np.ndarray:
        return self.north - (np.arange(self.height, dtype=np.float64) + 0.5) * self.cell

    def halved(self) -> "TargetGrid":
        """The raster with cells twice as large (an odd last row or column is padded)."""
        return TargetGrid(self.west, self.north, self.cell * 2, (self.width + 1) // 2, (self.height + 1) // 2)


def global_grid(width: int) -> TargetGrid:
    if width <= 0 or width % 2:
        raise ConversionError(f"the planet image needs an even, positive width, not {width}")
    return TargetGrid(-180.0, 90.0, 360.0 / width, width, width // 2)


def region_grid(bbox: dict[str, float], cell: float) -> TargetGrid:
    """The Amazon rectangle at about `cell` degrees, with cells that fit it exactly."""
    width = round((bbox["east"] - bbox["west"]) / cell)
    height = round((bbox["north"] - bbox["south"]) / cell)
    if width <= 0 or height <= 0:
        raise ConversionError(f"the Amazon rectangle in {MANIFEST_FILE} is empty: {bbox}")
    return TargetGrid(bbox["west"], bbox["north"], (bbox["east"] - bbox["west"]) / width, width, height)


def source_columns(geo: Georeference, lons: np.ndarray) -> np.ndarray:
    """Column of the GEDI pixel whose area holds each longitude, -1 outside the file."""
    from pyproj import Transformer

    to_ease = Transformer.from_crs("EPSG:4326", f"EPSG:{geo.epsg}", always_xy=True)
    xs, _ = to_ease.transform(np.asarray(lons, dtype=np.float64), np.zeros(len(lons)))
    column = np.floor((np.asarray(xs) - geo.first_x) / geo.pixel_width + 0.5)
    column = np.where(np.isfinite(column), column, -1).astype(np.int64)
    return np.where((column >= 0) & (column < geo.width), column, -1)


def source_rows(geo: Georeference, lats: np.ndarray) -> np.ndarray:
    """Row of the GEDI pixel whose area holds each latitude, -1 outside the file."""
    from pyproj import Transformer

    to_ease = Transformer.from_crs("EPSG:4326", f"EPSG:{geo.epsg}", always_xy=True)
    _, ys = to_ease.transform(np.zeros(len(lats)), np.asarray(lats, dtype=np.float64))
    row = np.floor((geo.first_y - np.asarray(ys)) / geo.pixel_height + 0.5)
    row = np.where(np.isfinite(row), row, -1).astype(np.int64)
    return np.where((row >= 0) & (row < geo.height), row, -1)


def accumulate(
    sums: np.ndarray, counts: np.ndarray, block: np.ndarray, rows: np.ndarray, columns: np.ndarray, nodata: float
) -> int:
    """Adds the pixels of `block` that have data and fall inside the raster to `sums` and `counts`.

    `rows` / `columns` hold the target row / column of each block row / column (-1
    outside). Returns how many pixels were added.
    """
    inside_rows = rows >= 0
    inside_columns = columns >= 0
    if not inside_rows.any() or not inside_columns.any():
        return 0
    block = block[inside_rows][:, inside_columns]
    rows = rows[inside_rows]
    columns = columns[inside_columns]
    valid = valid_mask(block, nodata)
    if not valid.any():
        return 0
    r0, r1 = int(rows.min()), int(rows.max()) + 1
    c0, c1 = int(columns.min()), int(columns.max()) + 1
    span = c1 - c0
    local = ((rows - r0)[:, None] * span + (columns - c0)[None, :])[valid]
    size = (r1 - r0) * span
    values = block[valid].astype(np.float64)
    sums[r0:r1, c0:c1] += np.bincount(local, weights=values, minlength=size).reshape(r1 - r0, span)
    counts[r0:r1, c0:c1] += np.bincount(local, minlength=size).reshape(r1 - r0, span).astype(counts.dtype)
    return int(values.size)


class Accumulator:
    """Per-pixel sums and counts of one target raster, plus the GEDI pixel under each pixel centre."""

    def __init__(self, grid: TargetGrid, geo: Georeference, lons: np.ndarray, lats: np.ndarray):
        self.grid = grid
        self.nodata = geo.nodata
        self.sums = np.zeros((grid.height, grid.width), dtype=np.float64)
        self.counts = np.zeros((grid.height, grid.width), dtype=np.int32)
        self.nearest = np.full((grid.height, grid.width), np.nan, dtype=np.float32)
        self.block_columns = grid.columns_of(lons)
        self.block_rows = grid.rows_of(lats)
        self.source_column = source_columns(geo, grid.centre_lons())
        self.source_row = source_rows(geo, grid.centre_lats())
        self.pixels = 0

    def add(self, y: int, x: int, block: np.ndarray) -> None:
        height, width = block.shape
        self.pixels += accumulate(
            self.sums,
            self.counts,
            block,
            self.block_rows[y : y + height],
            self.block_columns[x : x + width],
            self.nodata,
        )
        rows = np.flatnonzero((self.source_row >= y) & (self.source_row < y + height))
        columns = np.flatnonzero((self.source_column >= x) & (self.source_column < x + width))
        if rows.size and columns.size:
            under = block[self.source_row[rows] - y][:, self.source_column[columns] - x]
            self.nearest[np.ix_(rows, columns)] = np.where(valid_mask(under, self.nodata), under, np.nan)


def halve_sums(sums: np.ndarray, counts: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Sums and counts over 2 x 2 pixels (an odd last row or column is padded with zeros)."""
    height, width = sums.shape
    pad = ((0, height % 2), (0, width % 2))
    s = np.pad(sums, pad)
    c = np.pad(counts, pad)
    s = s[0::2, 0::2] + s[1::2, 0::2] + s[0::2, 1::2] + s[1::2, 1::2]
    c = c[0::2, 0::2] + c[1::2, 0::2] + c[0::2, 1::2] + c[1::2, 1::2]
    return s, c


def metres_to_grey(heights: np.ndarray) -> np.ndarray:
    """Metres -> grey 0..255 as floats (not yet rounded), NaN kept."""
    return (np.clip(heights, 0.0, HEIGHT_MAX) / HEIGHT_MAX * 255.0).astype(np.float32)


def mean_grey(sums: np.ndarray, counts: np.ndarray) -> np.ndarray:
    """Mean height per pixel as grey floats, NaN where no GEDI pixel fell."""
    mean = np.full(sums.shape, np.nan, dtype=np.float64)
    np.divide(sums, counts, out=mean, where=counts > 0)
    return metres_to_grey(mean)


def _axis(coords: np.ndarray, size: int, wrap: bool) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Lower and upper source index and the weight of the upper one, for bilinear interpolation."""
    lower = np.floor(coords)
    frac = (coords - lower).astype(np.float32)
    lower = lower.astype(np.int64)
    upper = lower + 1
    if wrap:
        return np.mod(lower, size), np.mod(upper, size), frac
    return np.clip(lower, 0, size - 1), np.clip(upper, 0, size - 1), frac


def fill_gaps(
    grey: np.ndarray,
    grid: TargetGrid,
    values: np.ndarray,
    source: TargetGrid,
    weights: np.ndarray | None = None,
    min_weight: float = MIN_FILL_WEIGHT,
) -> int:
    """Fills the NaN pixels of `grey` (on `grid`) from the coarser raster `values` (on `source`).

    Bilinear between the source cell centres; with `weights` (1 where a source cell
    has data, 0 where not) the interpolation is normalised by the weight of the cells
    with data and used only where that weight reaches `min_weight`. Returns how many
    pixels were filled.
    """
    u = (grid.centre_lons() - source.west) / source.cell - 0.5
    v = (source.north - grid.centre_lats()) / source.cell - 0.5
    c0, c1, fu = _axis(u, source.width, source.wraps)
    r0, r1, fv = _axis(v, source.height, False)
    if weights is None:
        weighted = values.astype(np.float32)
        weight = None
    else:
        weight = weights.astype(np.float32)
        weighted = values.astype(np.float32) * weight
    filled = 0
    for start in range(0, grid.height, FILL_ROW_CHUNK):
        stop = min(grid.height, start + FILL_ROW_CHUNK)
        gaps = np.isnan(grey[start:stop])
        if not gaps.any():
            continue
        a = fv[start:stop, None]
        rows_lo, rows_hi = r0[start:stop], r1[start:stop]
        along = (1 - a) * weighted[rows_lo] + a * weighted[rows_hi]
        num = (1 - fu) * along[:, c0] + fu * along[:, c1]
        if weight is None:
            take = gaps
            result = num
        else:
            along = (1 - a) * weight[rows_lo] + a * weight[rows_hi]
            den = (1 - fu) * along[:, c0] + fu * along[:, c1]
            take = gaps & (den >= min_weight)
            result = np.divide(num, den, out=np.zeros_like(num), where=den > 0)
        grey[start:stop][take] = result[take]
        filled += int(take.sum())
    return filled


@dataclass(frozen=True)
class FillSources:
    """The two coarse sources of the fill: the 0.1 degree GEDI image and the final forest grid."""

    fill_grey: np.ndarray  # 0..255, north row first, whole planet
    fill_valid: np.ndarray  # True where the 0.1 degree image has data
    grid: np.ndarray  # 0..255, north row first, whole planet

    @property
    def fill_grid(self) -> TargetGrid:
        return global_grid_of(self.fill_grey.shape)

    @property
    def grid_grid(self) -> TargetGrid:
        return global_grid_of(self.grid.shape)


def global_grid_of(shape: tuple[int, ...]) -> TargetGrid:
    height, width = shape[0], shape[1]
    return TargetGrid(-180.0, 90.0, 360.0 / width, width, height)


def finish(
    grid: TargetGrid,
    sums: np.ndarray,
    counts: np.ndarray,
    nearest: np.ndarray | None,
    sources: FillSources,
) -> tuple[np.ndarray, dict[str, int]]:
    """Final 8-bit image of one target: GEDI mean, then the fill cascade. Also returns where values came from."""
    grey = mean_grey(sums, counts)
    origin = {"gedi": int(np.count_nonzero(counts))}
    if nearest is not None:
        take = np.isnan(grey) & np.isfinite(nearest)
        grey[take] = metres_to_grey(nearest[take])
        origin["gedi pixel under centre"] = int(take.sum())
    fill_cell = sources.fill_grid.cell
    level_sums, level_counts, level_grid = sums, counts, grid
    while np.isnan(grey).any():
        if level_grid.cell * 2 > fill_cell + 1e-9:
            break
        level_sums, level_counts = halve_sums(level_sums, level_counts)
        level_grid = level_grid.halved()
        level_grey = mean_grey(level_sums, level_counts)
        filled = fill_gaps(grey, grid, np.nan_to_num(level_grey), level_grid, weights=level_counts > 0)
        origin[f"gedi mean at {level_grid.cell:.3g} deg"] = filled
    origin["0.1 deg image"] = fill_gaps(grey, grid, sources.fill_grey, sources.fill_grid, weights=sources.fill_valid)
    origin["forest grid"] = fill_gaps(grey, grid, sources.grid, sources.grid_grid)
    out = np.floor(np.clip(np.nan_to_num(grey, nan=0.0), 0.0, 255.0) + 0.5).astype(np.uint8)
    return out, origin


def load_fill(path: Path) -> tuple[np.ndarray, np.ndarray]:
    """Grey value and "has data" mask of the 0.1 degree RGBA image of gedi_l3_to_png.py."""
    from PIL import Image

    with Image.open(path) as image:
        if image.mode not in ("RGBA", "LA"):
            raise ConversionError(f"{path} should be the RGBA image of gedi_l3_to_png.py, it is {image.mode}")
        pixels = np.asarray(image.convert("RGBA"))
    height, width = pixels.shape[:2]
    if width != 2 * height:
        raise ConversionError(f"{path} should cover the whole planet (width twice the height), it is {width} x {height}")
    return pixels[..., 0].copy(), pixels[..., 3] > 0


def load_manifest(path: Path) -> tuple[dict[str, float], int, int]:
    """Amazon rectangle and size of the global forest grid, from manifest.json."""
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
        bbox = {key: float(manifest["region"]["bbox"][key]) for key in ("west", "south", "east", "north")}
        forest = next(layer for layer in manifest["layers"] if layer["id"] == "forest")
        width, height = int(forest["global"]["width"]), int(forest["global"]["height"])
    except (OSError, ValueError, KeyError, TypeError, StopIteration) as cause:
        raise ConversionError(
            f"could not read the Amazon rectangle and the forest grid size from {path}: {cause!r}"
        ) from cause
    return bbox, width, height


def load_grid(path: Path, width: int, height: int) -> np.ndarray:
    data = np.fromfile(path, dtype=np.uint8)
    if data.size < width * height:
        raise ConversionError(f"{path} holds {data.size} bytes, fewer than its {width} x {height} grid")
    return data[: width * height].reshape(height, width)


def check_inputs(paths: Iterable[tuple[str, Path]]) -> None:
    missing = [f"{what} ({path})" for what, path in paths if not path.is_file()]
    if missing:
        raise ConversionError(
            "missing input: " + "; ".join(missing) + ". The GeoTIFF and the 0.1 degree image come from "
            "`docker compose run --rm fetch-gedi`, manifest.json and forest_global.bin from "
            "`docker compose run --rm prep`."
        )


def write_png(grey: np.ndarray, path: Path) -> None:
    """Writes a one-channel 8-bit PNG, through a temporary file so a failed run leaves no half image."""
    from PIL import Image

    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".part")
    Image.fromarray(np.ascontiguousarray(grey, dtype=np.uint8)).save(temporary, format="PNG", compress_level=9)
    os.replace(temporary, path)


def stream(path: Path, accumulators: list[Accumulator]) -> None:
    for y, x, block in iter_blocks(path):
        for accumulator in accumulators:
            accumulator.add(y, x, block)


def run(
    tif: Path,
    fill: Path,
    data_dir: Path,
    global_width: int = GLOBAL_WIDTH,
    region_cell: float = REGION_CELL_DEGREES,
    report: bool = False,
) -> dict[str, Path]:
    """Whole conversion; returns the written images by name."""
    manifest_path = data_dir / MANIFEST_FILE
    grid_path = data_dir / GRID_FILE
    check_inputs(
        [
            ("GEDI L3 GeoTIFF", tif),
            ("0.1 degree GEDI image", fill),
            ("manifest", manifest_path),
            ("forest grid", grid_path),
        ]
    )
    bbox, grid_width, grid_height = load_manifest(manifest_path)
    fill_grey, fill_valid = load_fill(fill)
    sources = FillSources(fill_grey, fill_valid, load_grid(grid_path, grid_width, grid_height))

    geo = load_georeference(tif)
    lons, lats = pixel_lon_lat(geo)
    planet = Accumulator(global_grid(global_width), geo, lons, lats)
    region = Accumulator(region_grid(bbox, region_cell), geo, lons, lats)
    stream(tif, [planet, region])

    written: dict[str, Path] = {}

    def emit(name: str, grid: TargetGrid, sums: np.ndarray, counts: np.ndarray, nearest: np.ndarray | None) -> None:
        image, origin = finish(grid, sums, counts, nearest, sources)
        target = data_dir / name
        write_png(image, target)
        written[name] = target
        if report:
            total = grid.width * grid.height
            parts = ", ".join(f"{key} {value * 100.0 / total:.1f}%" for key, value in origin.items())
            print(f"  png    {name} ({grid.width} x {grid.height}, {target.stat().st_size / 1e6:.1f} MB): {parts}")

    half_sums, half_counts = halve_sums(planet.sums, planet.counts)
    emit(OUTPUT_8K, planet.grid, planet.sums, planet.counts, planet.nearest)
    del planet
    emit(OUTPUT_4K, global_grid(global_width // 2), half_sums, half_counts, None)
    del half_sums, half_counts
    emit(OUTPUT_REGION, region.grid, region.sums, region.counts, region.nearest)
    if report:
        print(f"  pixels {region.pixels} GEDI pixels with data inside the Amazon rectangle")
    return written


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="gedi_visual.py", description="GEDI L3 -> forest height images for the planet view.")
    parser.add_argument("--tif", type=Path, default=DEFAULT_TIF)
    parser.add_argument("--fill", type=Path, default=DEFAULT_FILL)
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    started = time.monotonic()
    try:
        run(args.tif, args.fill, args.data_dir, report=True)
    except ConversionError as error:
        print(f"gedi_visual: {error}", file=sys.stderr)
        return 1
    peak_mb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024  # kB on Linux
    print(f"  time   {time.monotonic() - started:.0f} s, peak memory {peak_mb:.0f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
