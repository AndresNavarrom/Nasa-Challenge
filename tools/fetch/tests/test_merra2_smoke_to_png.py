"""Tests for the MERRA-2 smoke conversion. Arrays only: no NetCDF file is read."""

import numpy as np
import pytest

from merra2_smoke_to_png import AOD_MAX, HOURS, ConversionError, aod_to_grey, convert, output_name


def test_square_root_scale_shows_haze_and_plumes():
    grey = aod_to_grey(np.array([0.0, 0.05, 0.5, AOD_MAX, 12.0, -1.0, np.nan]))
    assert grey.tolist() == [0, 40, 128, 255, 255, 0, 0]


def test_adds_organic_and_black_carbon_one_image_per_instant_north_first():
    organic = np.zeros((8, 361, 576))
    black = np.zeros((8, 361, 576))
    organic[2, 300:302, 10:12] = 0.3  # a plume in the north at the third instant
    black[2, 300:302, 10:12] = 0.2
    images = convert(organic, black)
    assert len(images) == 8
    assert images[0].shape == (360, 576)
    assert not images[0].any()
    # Row 300 from the south is row 360 - 301 = 59 from the north; cells average 2 x 2 points.
    assert images[2][59, 10] == aod_to_grey(np.array([0.5]))[0]
    assert images[2][300:].max() == 0  # nothing ends up in the south


def test_names_and_hours():
    assert HOURS == (0, 3, 6, 9, 12, 15, 18, 21)
    assert output_name("20260801", 21) == "smoke_20260801_2130.png"


def test_rejects_mismatched_arrays():
    with pytest.raises(ConversionError):
        convert(np.zeros((8, 361, 576)), np.zeros((7, 361, 576)))
