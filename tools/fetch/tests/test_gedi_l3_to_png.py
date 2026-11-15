"""Tests for the GEDI L3 conversion (FR2.1, FR2.2, FR2.3).

Small in-memory rasters in EASE-Grid 2.0 (EPSG:6933) only: nothing is downloaded,
nothing in data/raw/ is read and no account is used.
"""

import numpy as np
import pytest
import tifffile
from pyproj import Transformer

from gedi_l3_to_png import (
    TARGET_SHAPE,
    ConversionError,
    Georeference,
    accumulate,
    cell_indices,
    georeference_from_tags,
    height_to_grey,
    load_georeference,
    mean_heights,
    pixel_lon_lat,
    to_rgba,
)

NODATA = -9999.0
TO_EASE = Transformer.from_crs("EPSG:4326", "EPSG:6933", always_xy=True)


def ease_x(lon: float) -> float:
    return TO_EASE.transform(lon, 0.0)[0]


def ease_y(lat: float) -> float:
    return TO_EASE.transform(0.0, lat)[1]


def raster_on_four_cells() -> tuple[Georeference, np.ndarray]:
    """4 x 4 pixels of 0.05 degree, from 0 to 0.2 E and from 0.1 N to 0.1 S.

    Each 2 x 2 block of pixels falls in one 0.1 degree cell: rows 899 (0 to 0.1 N)
    and 900 (0 to 0.1 S), columns 1800 (0 to 0.1 E) and 1801 (0.1 to 0.2 E).
    The georeference comes from GeoTIFF tags, as in the real file.
    """
    tags = {
        "ModelPixelScaleTag": (ease_x(0.05), ease_y(0.05), 0.0),
        "ModelTiepointTag": (0.0, 0.0, 0.0, 0.0, ease_y(0.1), 0.0),
        "GDAL_NODATA": str(NODATA),
    }
    geo = georeference_from_tags(tags, width=4, height=4)
    heights = np.array(
        [
            [10.0, 20.0, 40.0, 40.0],
            [30.0, 40.0, 40.0, 40.0],
            [5.0, 5.0, 60.0, 0.0],
            [5.0, 5.0, 0.0, 60.0],
        ],
        dtype=np.float32,
    )
    return geo, heights


def convert_in_memory(geo: Georeference, heights: np.ndarray) -> np.ndarray:
    columns, rows = cell_indices(*pixel_lon_lat(geo))
    sums = np.zeros(TARGET_SHAPE)
    counts = np.zeros(TARGET_SHAPE, dtype=np.int64)
    accumulate(sums, counts, heights, rows, columns, geo.nodata)
    return mean_heights(sums, counts)


def test_ease_grid_pixels_are_averaged_into_the_expected_cells():
    geo, heights = raster_on_four_cells()

    mean = convert_in_memory(geo, heights)

    assert mean[899, 1800] == pytest.approx(25.0)  # (10 + 20 + 30 + 40) / 4
    assert mean[899, 1801] == pytest.approx(40.0)
    assert mean[900, 1800] == pytest.approx(5.0)
    assert mean[900, 1801] == pytest.approx(30.0)  # (60 + 0 + 0 + 60) / 4
    # Nothing else in the 3600 x 1800 grid received data.
    assert np.isfinite(mean).sum() == 4


def test_no_data_pixels_are_left_out_and_empty_cells_are_transparent():
    geo, heights = raster_on_four_cells()
    heights[0, 1] = NODATA  # the cell at row 899, column 1800 keeps only 10 and 40
    heights[1, 0] = np.nan  # NaN is never data either
    heights[2:, :2] = NODATA  # the cell at row 900, column 1800 has no data at all

    mean = convert_in_memory(geo, heights)
    rgba = to_rgba(mean)

    assert mean[899, 1800] == pytest.approx(25.0)  # (10 + 40) / 2, not pulled down by -9999
    assert np.isnan(mean[900, 1800])
    assert rgba[900, 1800].tolist() == [0, 0, 0, 0]
    assert rgba[899, 1800].tolist() == [128, 128, 128, 255]
    assert rgba.shape == (1800, 3600, 4) and rgba.dtype == np.uint8


def test_heights_map_linearly_to_0_255_with_50_m_as_the_top():
    grey = height_to_grey(np.array([0.0, 25.0, 50.0, 60.0, -2.0, np.nan]))

    assert grey.dtype == np.uint8
    assert grey.tolist() == [0, 128, 255, 255, 0, 0]


def test_a_tiff_without_georeference_tags_fails_with_a_clear_message(tmp_path):
    plain = tmp_path / "plain.tif"
    tifffile.imwrite(plain, np.zeros((8, 8), dtype=np.float32))

    with pytest.raises(ConversionError, match=r"ModelPixelScaleTag.*ModelTiepointTag.*GDAL_NODATA"):
        load_georeference(plain)

    # A file in another projection is refused instead of being placed wrongly.
    directory = (1, 1, 0, 1, 3072, 0, 1, 4326)
    with pytest.raises(ConversionError, match="EPSG:4326"):
        georeference_from_tags(
            {
                "ModelPixelScaleTag": (1.0, 1.0, 0.0),
                "ModelTiepointTag": (0, 0, 0, 0.0, 0.0, 0.0),
                "GDAL_NODATA": "-9999",
                "GeoKeyDirectoryTag": directory,
            },
            width=8,
            height=8,
        )
