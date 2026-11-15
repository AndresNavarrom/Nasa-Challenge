"""Tests for the GEOS-CF PM2.5 conversion (FR4.2, FR4.3). Arrays only: no NetCDF file is read."""

import numpy as np
import pytest

from geoscf_to_png import PM25_MAX, ConversionError, convert, pm25_to_grey, to_app_grid


def rows_numbered_from_the_south() -> np.ndarray:
    """721 x 1440 field whose value is the row index: row 0 is the south pole, row 720 the north pole."""
    return np.repeat(np.arange(721, dtype=np.float64)[:, None], 1440, axis=1)


def test_721_rows_become_720_with_the_north_row_first():
    grid = to_app_grid(rows_numbered_from_the_south(), south_first=True)

    assert grid.shape == (720, 1440)
    # Each cell is the mean of its two neighbouring latitudes: the first output
    # row sits between the two northernmost input rows (719 and 720).
    assert grid[0, 0] == pytest.approx(719.5)
    assert grid[-1, 0] == pytest.approx(0.5)
    assert np.all(np.diff(grid[:, 0]) < 0), "rows must go from north to south"

    # Columns move half a cell east, wrapping at the date line.
    columns = np.repeat(np.arange(1440, dtype=np.float64)[None, :], 721, axis=0)
    shifted = to_app_grid(columns)
    assert shifted[0, 0] == pytest.approx(0.5)
    assert shifted[0, 1439] == pytest.approx((1439 + 0) / 2)

    # A file stored north row first gives the same result.
    north_first = to_app_grid(rows_numbered_from_the_south()[::-1], south_first=False)
    assert np.array_equal(north_first, grid)


def test_fixed_scale_maps_0_to_0_and_150_or_more_to_255():
    grey = pm25_to_grey(np.array([0.0, PM25_MAX / 2, PM25_MAX, 151.0, 900.0, -3.0]))

    assert grey.dtype == np.uint8
    assert grey.tolist() == [0, 128, 255, 255, 255, 0]

    # Through the whole conversion: a uniform 150 ug/m3 field is white everywhere.
    assert np.all(convert(np.full((721, 1440), 150.0)) == 255)


def test_fill_values_and_missing_points_become_0():
    field = np.full((721, 1440), 75.0)
    field[:2, :] = np.nan  # the two southernmost rows are missing
    field[-2:, :] = 1e15  # the two northernmost rows hold the GEOS fill value

    grey = convert(field)

    assert grey[-1].tolist() == [0] * 1440  # only missing points: 0
    assert grey[0].tolist() == [0] * 1440  # only fill values: 0
    assert grey[360, 0] == 128  # real data elsewhere is untouched
    # A cell with some valid neighbours keeps their mean instead of being pulled down.
    assert grey[-2, 0] == 128


def test_a_wrong_grid_size_fails_with_a_clear_message():
    with pytest.raises(ConversionError, match=r"721 latitudes x 1440 longitudes.*\(720, 1440\)"):
        convert(np.zeros((720, 1440)))
    with pytest.raises(ConversionError, match="shape"):
        to_app_grid(np.zeros((721, 720)))
