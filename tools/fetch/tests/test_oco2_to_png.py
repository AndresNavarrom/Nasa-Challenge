"""Tests for the OCO-2 GEOS XCO2 conversion. Arrays only: no NetCDF file is read."""

import numpy as np
import pytest

from oco2_to_png import XCO2_HIGH, XCO2_LOW, ConversionError, convert, ppm_to_grey, to_app_grid


def rows_numbered_from_the_south() -> np.ndarray:
    """361 x 576 field whose value is the row index: row 0 is the south pole, row 360 the north pole."""
    return np.repeat(np.arange(361, dtype=np.float64)[:, None], 576, axis=1)


def test_361_rows_become_360_with_the_north_row_first_and_columns_wrap():
    grid = to_app_grid(rows_numbered_from_the_south())
    assert grid.shape == (360, 576)
    assert grid[0, 0] == pytest.approx(359.5)
    assert grid[-1, 0] == pytest.approx(0.5)

    columns = np.repeat(np.arange(576, dtype=np.float64)[None, :], 361, axis=0)
    shifted = to_app_grid(columns)
    assert shifted[0, 0] == pytest.approx(0.5)
    assert shifted[0, 575] == pytest.approx(575 / 2)  # wraps: mean of 575 and 0

    assert np.array_equal(to_app_grid(rows_numbered_from_the_south()[::-1], south_first=False), grid)


def test_fixed_ppm_scale_and_fill_values():
    grey = ppm_to_grey(np.array([XCO2_LOW - 5, XCO2_LOW, (XCO2_LOW + XCO2_HIGH) / 2, XCO2_HIGH, 430.0, np.nan]))
    assert grey.tolist() == [0, 0, 128, 255, 255, 0]

    field = np.full((361, 576), 412e-6)
    field[10, 10] = 1e15  # fill value: left out of its cells, not averaged in
    grey, low, high = convert(field)
    assert grey.shape == (360, 576)
    assert (low, high) == (pytest.approx(412.0), pytest.approx(412.0))
    assert int(grey[0, 0]) == round((412 - XCO2_LOW) * 255 / (XCO2_HIGH - XCO2_LOW))


def test_rejects_an_unexpected_grid():
    with pytest.raises(ConversionError, match="361 latitudes x 576 longitudes"):
        to_app_grid(np.zeros((721, 1440)))
