"""Tests for the high-resolution forest images (gedi_visual.py).

Small synthetic rasters in EASE-Grid 2.0 (EPSG:6933) and tiny fill images only:
nothing is downloaded and nothing in data/ or web/public/data/ is read.
"""

import json

import numpy as np
import pytest
import tifffile
from PIL import Image
from pyproj import Transformer

from gedi_l3_to_png import ConversionError, georeference_from_tags, pixel_lon_lat
from gedi_visual import (
    OUTPUT_4K,
    OUTPUT_8K,
    OUTPUT_REGION,
    Accumulator,
    FillSources,
    TargetGrid,
    finish,
    main,
    run,
)

NODATA = -9999.0
TO_EASE = Transformer.from_crs("EPSG:4326", "EPSG:6933", always_xy=True)
AMAZON = {"west": -80.0, "south": -20.0, "east": -44.0, "north": 8.0}


def ease_x(lon: float) -> float:
    return TO_EASE.transform(lon, 0.0)[0]


def ease_y(lat: float) -> float:
    return TO_EASE.transform(0.0, lat)[1]


def no_fill(fill_shape=(18, 36), grid_shape=(4, 8)) -> FillSources:
    """Fill sources that hold nothing: the 0.1 degree image without data and an all-zero grid."""
    return FillSources(
        np.zeros(fill_shape, dtype=np.uint8), np.zeros(fill_shape, dtype=bool), np.zeros(grid_shape, dtype=np.uint8)
    )


def test_each_pixel_is_the_mean_of_the_gedi_pixels_with_data_that_fall_in_it():
    # 4 x 4 GEDI pixels of 0.05 degree from 0 to 0.2 E and 0.1 N to 0.1 S: each 2 x 2
    # block falls in one 0.1 degree output pixel.
    tags = {
        "ModelPixelScaleTag": (ease_x(0.05), ease_y(0.05), 0.0),
        "ModelTiepointTag": (0.0, 0.0, 0.0, 0.0, ease_y(0.1), 0.0),
        "GDAL_NODATA": str(NODATA),
    }
    geo = georeference_from_tags(tags, width=4, height=4)
    heights = np.array(
        [
            [10.0, 20.0, 40.0, NODATA],
            [30.0, 40.0, 40.0, 40.0],
            [5.0, np.nan, 60.0, 0.0],
            [5.0, 5.0, 0.0, 60.0],
        ],
        dtype=np.float32,
    )
    grid = TargetGrid(west=0.0, north=0.1, cell=0.1, width=2, height=2)
    accumulator = Accumulator(grid, geo, *pixel_lon_lat(geo))
    accumulator.add(0, 0, heights)

    image, origin = finish(grid, accumulator.sums, accumulator.counts, accumulator.nearest, no_fill())

    assert image.dtype == np.uint8 and image.shape == (2, 2)
    # (10 + 20 + 30 + 40) / 4 = 25 m -> 127.5 -> 128 (round half up, 50 m = 255).
    assert image[0, 0] == 128
    # The no-data value and NaN are left out: 40 m and 5 m, not pulled down by -9999.
    assert image[0, 1] == 204
    assert image[1, 0] == 26  # 5 m -> 25.5 -> 26
    assert image[1, 1] == 153  # (60 + 0 + 0 + 60) / 4 = 30 m, above 50 m would stay 255
    assert origin["gedi"] == 4
    assert accumulator.pixels == 14


def test_pixels_without_gedi_data_are_filled_from_the_0p1_degree_image_and_then_the_grid():
    # 20 x 10 output pixels of 1 degree from 0 E, 10 N. The "0.1 degree" image is a
    # 36 x 18 raster of 10 degree cells (so the GEDI means at 2, 4 and 8 degrees are
    # tried before it) and the grid a 72 x 36 raster of 5 degree cells.
    grid = TargetGrid(west=0.0, north=10.0, cell=1.0, width=20, height=10)
    sums = np.zeros((10, 20))
    counts = np.zeros((10, 20), dtype=np.int32)
    sums[0, 0], counts[0, 0] = 30.0, 1  # one GEDI pixel of 30 m at 0..1 E, 9..10 N
    nearest = np.full((10, 20), np.nan, dtype=np.float32)
    nearest[9, 19] = 60.0  # the GEDI pixel under this centre has data, although none fell in it
    fill_grey = np.zeros((18, 36), dtype=np.uint8)
    fill_valid = np.zeros((18, 36), dtype=bool)
    fill_grey[8, 19], fill_valid[8, 19] = 200, True  # 10..20 E, 0..10 N
    sources = FillSources(fill_grey, fill_valid, np.full((36, 72), 77, dtype=np.uint8))

    image, origin = finish(grid, sums, counts, nearest, sources)

    assert image[0, 0] == 153  # GEDI itself: 30 m
    assert image[1, 1] == 153  # gap next to it: the GEDI mean over 2 x 2 pixels
    assert image[9, 19] == 255  # the GEDI pixel under the centre (60 m, above the 50 m top)
    assert image[4, 15] == 200  # far from GEDI data: the 0.1 degree image
    assert image[9, 5] == 77  # neither GEDI nor the 0.1 degree image: the grid
    assert origin["gedi"] == 1 and origin["gedi pixel under centre"] == 1
    assert origin["0.1 deg image"] > 0 and origin["forest grid"] > 0
    assert sum(origin.values()) == 200  # every pixel got a value from exactly one step


def write_inputs(tmp_path):
    """A synthetic GEDI GeoTIFF (tiled, compressed like the real one) and the fill inputs.

    About 0.25 degree pixels from 70 W to 30 E and 20 S to 60 N, no data except two
    patches: 30 m over 0..20 E, 40..50 N and 50 m over 60..50 W, 0..10 S (inside the Amazon).
    """
    x0, y0 = ease_x(-70.0), ease_y(60.0)
    scale = (ease_x(0.25), ease_y(0.25))
    width = 400
    height = int(round((y0 - ease_y(-20.0)) / scale[1]))
    tags = {
        "ModelPixelScaleTag": (scale[0], scale[1], 0.0),
        "ModelTiepointTag": (0.0, 0.0, 0.0, x0, y0, 0.0),
        "GDAL_NODATA": str(NODATA),
    }
    lons, lats = pixel_lon_lat(georeference_from_tags(tags, width=width, height=height))
    heights = np.full((height, width), NODATA, dtype=np.float32)
    heights[np.ix_((lats > 40) & (lats < 50), (lons > 0) & (lons < 20))] = 30.0
    heights[np.ix_((lats > -10) & (lats < 0), (lons > -60) & (lons < -50))] = 50.0
    tif = tmp_path / "gedi.tif"
    tifffile.imwrite(
        tif,
        heights,
        tile=(64, 64),
        compression="zlib",
        extratags=[
            (33550, "d", 3, tags["ModelPixelScaleTag"], False),
            (33922, "d", 6, tags["ModelTiepointTag"], False),
            (42113, "s", 0, tags["GDAL_NODATA"], False),
        ],
    )
    # 1 degree "fill image" without data, so nothing but GEDI shows in the output.
    fill = tmp_path / "fill.png"
    Image.fromarray(np.zeros((180, 360, 4), dtype=np.uint8), "RGBA").save(fill)
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    manifest = {
        "layers": [{"id": "forest", "global": {"width": 8, "height": 4}}],
        "region": {"bbox": AMAZON},
    }
    (data_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    np.zeros(8 * 4, dtype=np.uint8).tofile(data_dir / "forest_global.bin")
    return tif, fill, data_dir


def forest_at(path):
    image = np.asarray(Image.open(path))
    rows, columns = np.nonzero(image)
    return image, set(zip(rows.tolist(), columns.tolist()))


def test_writes_three_greyscale_images_north_up_from_180_w(tmp_path):
    tif, fill, data_dir = write_inputs(tmp_path)

    written = run(tif, fill, data_dir, global_width=72, region_cell=1.0)

    assert set(written) == {OUTPUT_8K, OUTPUT_4K, OUTPUT_REGION}
    for name in written:
        with Image.open(data_dir / name) as image:
            assert image.mode == "L"  # one 8-bit channel
    # "8k" image here: 72 x 36 pixels of 5 degrees; column 0 starts at 180 W, row 0 at 90 N.
    planet, forest = forest_at(data_dir / OUTPUT_8K)
    assert planet.shape == (36, 72)
    north = {(row, column) for row in (8, 9) for column in range(36, 40)}  # 40..50 N, 0..20 E
    amazon = {(row, column) for row in (18, 19) for column in (24, 25)}  # 0..10 S, 60..50 W
    assert forest == north | amazon
    assert all(planet[pixel] == 153 for pixel in north)  # 30 m
    assert all(planet[pixel] == 255 for pixel in amazon)  # 50 m
    # Half size: 10 degree pixels.
    half, forest = forest_at(data_dir / OUTPUT_4K)
    assert half.shape == (18, 36)
    assert forest == {(4, 18), (4, 19), (9, 12)}
    # The Amazon rectangle (80 W to 44 W, 20 S to 8 N) at 1 degree: 36 x 28.
    region, forest = forest_at(data_dir / OUTPUT_REGION)
    assert region.shape == (28, 36)
    assert forest == {(row, column) for row in range(8, 18) for column in range(20, 30)}
    assert all(region[pixel] == 255 for pixel in forest)


def test_a_missing_input_stops_with_a_clear_message(tmp_path, capsys):
    tif, fill, data_dir = write_inputs(tmp_path)
    (data_dir / "forest_global.bin").unlink()

    with pytest.raises(ConversionError, match=r"missing input: forest grid .*forest_global\.bin.*forest grid from .*prep"):
        run(tif, fill, data_dir)

    assert main(["--tif", str(tmp_path / "absent.tif"), "--fill", str(fill), "--data-dir", str(data_dir)]) == 1
    message = capsys.readouterr().err
    assert "gedi_visual: missing input: GEDI L3 GeoTIFF" in message and "absent.tif" in message
    assert not any(data_dir.glob("forest-height-*"))  # nothing half written


def test_reads_the_gzip_grid_named_in_the_manifest(tmp_path):
    import gzip

    tif, fill, data_dir = write_inputs(tmp_path)
    plain = (data_dir / "forest_global.bin").read_bytes()
    (data_dir / "forest_global.bin").unlink()
    (data_dir / "forest_global.bin.gz").write_bytes(gzip.compress(plain))
    manifest = json.loads((data_dir / "manifest.json").read_text(encoding="utf-8"))
    manifest["layers"][0]["global"]["file"] = "forest_global.bin.gz"
    (data_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

    written = run(tif, fill, data_dir, global_width=72, region_cell=1.0)

    assert set(written) == {OUTPUT_8K, OUTPUT_4K, OUTPUT_REGION}
