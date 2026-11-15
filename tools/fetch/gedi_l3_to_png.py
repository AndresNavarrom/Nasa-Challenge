"""GEDI L3 canopy height (GeoTIFF, EASE-Grid 2.0) -> 3600 x 1800 RGBA PNG for jukebox-prep.

GEDI L3 Gridded Land Surface Metrics V3 (ORNL DAAC, doi:10.3334/ORNLDAAC/2525) ships
`rh100_mean` as one global float GeoTIFF in EASE-Grid 2.0 (EPSG:6933), about 1 km
per pixel. jukebox-prep reads flat latitude/longitude images, so this script:

- reads the georeference from the file's own GeoTIFF tags (`ModelPixelScale`,
  `ModelTiepoint`) and the "no data" value from `GDAL_NODATA`, and stops with a
  clear message when any of them is missing;
- turns each pixel column into a longitude and each pixel row into a latitude with
  pyproj (EASE-Grid 2.0 is cylindrical: longitude depends only on x, latitude only
  on y);
- averages every pixel that has data into the equirectangular 0.1 degree cell it
  falls in (3600 x 1800 cells, north row first, the first cell starts at 180 W and
  90 N); "no data" pixels are left out of the mean;
- writes the mean as grey on the fixed scale 0 m -> 0, 50 m -> 255
  (round half up, values above 50 m stay at 255), with alpha 0 in the cells where
  no pixel had data, so jukebox-prep can tell "no data" apart from 0 m.

The file is read strip by strip (or tile by tile), never whole, so a global file
of about 2 GB decoded fits in a container with 4 GB of memory.

Usage: python gedi_l3_to_png.py INPUT.tif OUTPUT.png
"""

from __future__ import annotations

import math
import resource
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Mapping

import numpy as np

# Equirectangular target grid: 0.1 degree cells.
CELL_DEGREES = 0.1
TARGET_SHAPE = (1800, 3600)  # rows (north first), columns (west first)
# Fixed scale of the forest layer, in metres (FR2.3).
HEIGHT_MAX = 50.0
# EASE-Grid 2.0 global (WGS 84 cylindrical equal area at 30 degrees).
EASE_GRID_2_EPSG = 6933
# GeoKey ids (GeoTIFF 1.0): raster type and projected coordinate system.
GT_RASTER_TYPE_GEOKEY = 1025
PROJECTED_CS_TYPE_GEOKEY = 3072
RASTER_PIXEL_IS_POINT = 2
USER_DEFINED = 32767
# Rows per band when the file is uncompressed and memory-mapped instead of decoded.
MEMMAP_BAND_ROWS = 128


class ConversionError(Exception):
    """A problem with the input file, with a message for the person running the script."""


@dataclass(frozen=True)
class Georeference:
    """Where the pixels of the raster sit, in the projected coordinates of `epsg`."""

    width: int
    height: int
    # Projected x, y of the centre of pixel (0, 0); y grows to the north.
    first_x: float
    first_y: float
    pixel_width: float
    pixel_height: float
    nodata: float
    epsg: int = EASE_GRID_2_EPSG


def geokeys(directory: tuple[int, ...] | None) -> dict[int, int]:
    """Short-valued GeoKeys of a `GeoKeyDirectoryTag` as {key id: value}."""
    if not directory or len(directory) < 4:
        return {}
    keys: dict[int, int] = {}
    count = directory[3]
    for index in range(count):
        key_id, location, _count, value = directory[4 + 4 * index : 8 + 4 * index]
        if location == 0:  # value stored in the directory itself
            keys[key_id] = value
    return keys


def parse_nodata(text: object) -> float:
    try:
        return float(str(text).strip().strip("\x00"))
    except ValueError as cause:
        raise ConversionError(f"GDAL_NODATA tag holds {text!r}, which is not a number") from cause


def georeference_from_tags(tags: Mapping[str, object], width: int, height: int) -> Georeference:
    """Georeference of a `width` x `height` raster from its GeoTIFF tags (name -> value)."""
    missing = [name for name in ("ModelPixelScaleTag", "ModelTiepointTag", "GDAL_NODATA") if name not in tags]
    if missing:
        raise ConversionError(
            "the file has no " + ", ".join(missing) + " tag; a GEDI L3 GeoTIFF carries its georeference "
            "(ModelPixelScale, ModelTiepoint) and its no-data value (GDAL_NODATA) in its tags"
        )
    scale = tuple(float(v) for v in tags["ModelPixelScaleTag"])  # type: ignore[union-attr]
    tie = tuple(float(v) for v in tags["ModelTiepointTag"])  # type: ignore[union-attr]
    if len(scale) < 2 or len(tie) < 6 or scale[0] <= 0 or scale[1] <= 0:
        raise ConversionError(f"unusable georeference: ModelPixelScale {scale}, ModelTiepoint {tie}")
    keys = geokeys(tags.get("GeoKeyDirectoryTag"))  # type: ignore[arg-type]
    epsg = keys.get(PROJECTED_CS_TYPE_GEOKEY, USER_DEFINED)
    if epsg not in (EASE_GRID_2_EPSG, USER_DEFINED):
        raise ConversionError(
            f"the file is in EPSG:{epsg}, not EASE-Grid 2.0 (EPSG:{EASE_GRID_2_EPSG}); "
            "this script only handles the GEDI L3 global grid"
        )
    # Pixel-is-area (the default): the tie point is the corner of its pixel.
    centre_offset = 0.0 if keys.get(GT_RASTER_TYPE_GEOKEY) == RASTER_PIXEL_IS_POINT else 0.5
    tie_i, tie_j, _k, tie_x, tie_y = tie[:5]
    return Georeference(
        width=width,
        height=height,
        first_x=tie_x + (centre_offset - tie_i) * scale[0],
        first_y=tie_y - (centre_offset - tie_j) * scale[1],
        pixel_width=scale[0],
        pixel_height=scale[1],
        nodata=parse_nodata(tags["GDAL_NODATA"]),
        epsg=EASE_GRID_2_EPSG,
    )


def pixel_lon_lat(geo: Georeference) -> tuple[np.ndarray, np.ndarray]:
    """Longitude of every pixel column and latitude of every pixel row, in degrees."""
    from pyproj import Transformer

    to_lonlat = Transformer.from_crs(f"EPSG:{geo.epsg}", "EPSG:4326", always_xy=True)
    xs = geo.first_x + np.arange(geo.width, dtype=np.float64) * geo.pixel_width
    ys = geo.first_y - np.arange(geo.height, dtype=np.float64) * geo.pixel_height
    lons, _ = to_lonlat.transform(xs, np.zeros_like(xs))
    _, lats = to_lonlat.transform(np.zeros_like(ys), ys)
    lons = (np.asarray(lons) + 180.0) % 360.0 - 180.0  # the east edge wraps to the west
    return lons, np.asarray(lats)


def cell_indices(lons: np.ndarray, lats: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """0.1 degree cell column of each longitude and cell row (north first) of each latitude."""
    rows, columns = TARGET_SHAPE
    column = np.floor((np.asarray(lons) + 180.0) / CELL_DEGREES).astype(np.int64)
    row = np.floor((90.0 - np.asarray(lats)) / CELL_DEGREES).astype(np.int64)
    return np.clip(column, 0, columns - 1), np.clip(row, 0, rows - 1)


def valid_mask(block: np.ndarray, nodata: float) -> np.ndarray:
    """True where a pixel has data: finite and not the file's no-data value."""
    valid = np.isfinite(block)
    if math.isfinite(nodata):
        valid &= block != np.asarray(nodata, dtype=block.dtype)
    return valid


def accumulate(
    sums: np.ndarray, counts: np.ndarray, block: np.ndarray, rows: np.ndarray, columns: np.ndarray, nodata: float
) -> int:
    """Adds the pixels of `block` that have data to the per-cell `sums` and `counts`.

    `rows` holds the cell row of each block row and `columns` the cell column of each
    block column. Returns how many pixels had data.
    """
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
    counts[r0:r1, c0:c1] += np.bincount(local, minlength=size).reshape(r1 - r0, span)
    return int(values.size)


def mean_heights(sums: np.ndarray, counts: np.ndarray) -> np.ndarray:
    """Mean height per cell, NaN where no pixel had data."""
    mean = np.full(sums.shape, np.nan)
    np.divide(sums, counts, out=mean, where=counts > 0)
    return mean


def height_to_grey(heights: np.ndarray) -> np.ndarray:
    """Metres -> bytes on the fixed 0..50 m scale, rounded half up; NaN becomes 0."""
    clean = np.nan_to_num(np.asarray(heights, dtype=np.float64), nan=0.0, posinf=HEIGHT_MAX, neginf=0.0)
    scaled = np.clip(clean, 0.0, HEIGHT_MAX) / HEIGHT_MAX * 255.0
    return np.floor(scaled + 0.5).astype(np.uint8)


def to_rgba(mean: np.ndarray) -> np.ndarray:
    """Grey height in R, G and B; alpha 255 where the cell has data and 0 where it has none."""
    grey = height_to_grey(mean)
    alpha = np.where(np.isfinite(mean), 255, 0).astype(np.uint8)
    return np.dstack([grey, grey, grey, alpha])


def read_tags(page) -> dict[str, object]:
    return {tag.name: tag.value for tag in page.tags.values()}


def load_georeference(path: Path) -> Georeference:
    """Opens `path` and reads its georeference and no-data value from the GeoTIFF tags."""
    import tifffile

    try:
        with tifffile.TiffFile(path) as tif:
            page = tif.pages[0]
            return georeference_from_tags(read_tags(page), page.imagewidth, page.imagelength)
    except (OSError, tifffile.TiffFileError) as cause:
        raise ConversionError(f"could not read {path} as a TIFF: {cause}") from cause


def iter_blocks(path: Path) -> Iterator[tuple[int, int, np.ndarray]]:
    """Yields (first row, first column, 2-D block) over the whole first image of `path`."""
    import tifffile

    with tifffile.TiffFile(path) as tif:
        page = tif.pages[0]
        if page.samplesperpixel != 1:
            raise ConversionError(f"expected one band, the file has {page.samplesperpixel}")
        height, width = page.imagelength, page.imagewidth
        if page.is_memmappable:
            data = tifffile.memmap(path, page=0, mode="r").reshape(height, width)
            for y in range(0, height, MEMMAP_BAND_ROWS):
                yield y, 0, np.asarray(data[y : y + MEMMAP_BAND_ROWS])
            return
        for segment, index, _shape in page.segments():
            if segment is None:  # a tile or strip absent from the file holds no data
                continue
            y, x = index[2], index[3]
            yield y, x, segment[0, : height - y, : width - x, 0]


def convert(path: Path) -> tuple[np.ndarray, int]:
    """Whole conversion: GeoTIFF -> RGBA cells; also returns how many pixels had data."""
    geo = load_georeference(path)
    columns, rows = cell_indices(*pixel_lon_lat(geo))
    sums = np.zeros(TARGET_SHAPE, dtype=np.float64)
    counts = np.zeros(TARGET_SHAPE, dtype=np.int64)
    pixels = 0
    for y, x, block in iter_blocks(path):
        block_rows = rows[y : y + block.shape[0]]
        block_columns = columns[x : x + block.shape[1]]
        pixels += accumulate(sums, counts, block, block_rows, block_columns, geo.nodata)
    return to_rgba(mean_heights(sums, counts)), pixels


def write_png(rgba: np.ndarray, path: Path) -> None:
    from PIL import Image

    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba).save(path)


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    source, target = Path(argv[0]), Path(argv[1])
    started = time.monotonic()
    try:
        rgba, pixels = convert(source)
        write_png(rgba, target)
    except ConversionError as error:
        print(f"gedi_l3_to_png: {error}", file=sys.stderr)
        return 1
    cells = int((rgba[..., 3] > 0).sum())
    total = TARGET_SHAPE[0] * TARGET_SHAPE[1]
    peak_mb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024  # kB on Linux
    print(f"  png    {target} ({TARGET_SHAPE[1]} x {TARGET_SHAPE[0]} RGBA)")
    print(f"  cells  {cells} of {total} have GEDI data ({cells * 100.0 / total:.1f}%), from {pixels} pixels")
    print(f"  time   {time.monotonic() - started:.0f} s, peak memory {peak_mb:.0f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
