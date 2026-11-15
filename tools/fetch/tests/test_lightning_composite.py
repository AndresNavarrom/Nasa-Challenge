"""Tests for the lightning accumulation (FR5.1). Small in-memory frames only: no video is read."""

import io

import numpy as np
import pytest

from lightning_composite import CompositeError, mean_yellowness, read_raw_frames, to_grey, yellowness

GREY_MAP = (60, 60, 60)
GRID_LINE = (200, 200, 200)
DOT = (250, 220, 20)


def frame_with(dot_at=None) -> np.ndarray:
    """2 x 2 frame: grey map, one light-grey grid line pixel, and optionally a yellow lightning dot."""
    frame = np.full((2, 2, 3), GREY_MAP, dtype=np.uint8)
    frame[0, 1] = GRID_LINE
    if dot_at is not None:
        frame[dot_at] = DOT
    return frame


def test_only_lightning_dots_count():
    value = yellowness(frame_with(dot_at=(1, 1)))

    assert value[0, 0] == 0.0  # grey map
    assert value[0, 1] == 0.0  # grey grid line
    assert value[1, 1] == pytest.approx((220 - 20) / 255)


def test_the_mean_over_the_period_grows_with_how_often_lightning_was_seen():
    # Four 10-day windows: the dot shows in one of them at pixel (1, 1) and in all four at (1, 0).
    frames = [frame_with(dot_at=(1, 0)) for _ in range(4)]
    frames[0][1, 1] = DOT

    grey = to_grey(mean_yellowness(frames))

    assert grey[0, 0] == 0 and grey[0, 1] == 0  # never any lightning
    assert grey[1, 0] == 200  # seen in every window
    assert grey[1, 1] == 50  # seen in one window out of four


def test_bad_input_fails_with_a_message():
    with pytest.raises(CompositeError, match="no frames"):
        mean_yellowness([])
    with pytest.raises(CompositeError, match="frame 2"):
        mean_yellowness([frame_with(), np.zeros((3, 3, 3), dtype=np.uint8)])
    # A raw stream whose last frame is cut off.
    stream = io.BytesIO(bytes(2 * 2 * 3) + bytes(5))
    with pytest.raises(CompositeError, match="cut off"):
        list(read_raw_frames(stream, 2, 2))
