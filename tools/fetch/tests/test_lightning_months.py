"""Tests for the per-month lightning images (lightning_months.py). Small synthetic windows only."""

from datetime import date

import numpy as np
from PIL import Image

from lightning_dots import Dots, save_dots
from lightning_months import (
    PERIOD_END,
    PERIOD_START,
    Month,
    main,
    mean_of_windows,
    months_in_period,
    window_middle,
    windows_by_month,
)


def dots_of(frames: list[list[tuple[int, int]]], width: int = 4, height: int = 2) -> Dots:
    """Windows given as lists of (flat pixel index, yellowness)."""
    index: list[int] = []
    value: list[int] = []
    starts = [0]
    for frame in frames:
        for pixel, yellow in sorted(frame):
            index.append(pixel)
            value.append(yellow)
        starts.append(len(index))
    return Dots(width, height, np.array(starts, dtype=np.int64), np.array(index, dtype=np.uint32), np.array(value, dtype=np.uint8))


def test_period_has_79_months_with_readable_labels_and_iso_dates():
    months = months_in_period()
    assert len(months) == 79  # 2017 to 2022 (72) plus January to July 2023 (7)
    assert months[0] == Month(2017, 1)
    assert months[0].label() == "Jan 2017"
    assert months[0].iso() == "2017-01-01T00:00:00Z"
    assert months[0].file == "lightning_2017_01.png"
    assert months[-1] == Month(2023, 7)
    assert months[-1].label() == "Jul 2023"
    assert Month(2020, 12).next() == Month(2021, 1)


def test_windows_follow_the_video_in_order_and_fill_every_month():
    assert window_middle(0) < PERIOD_START  # the first frame's window lies before the period
    assert date(2020, 3, 1) < window_middle(125) < date(2020, 6, 1)  # halfway
    assert window_middle(250) <= PERIOD_END

    groups = windows_by_month(250)
    assert all(groups[month] for month in months_in_period())
    # Windows are about 9.6 days apart: two to four of them per month.
    assert all(2 <= len(groups[month]) <= 4 for month in months_in_period())
    flat = [frame for month in months_in_period() for frame in groups[month]]
    assert flat == sorted(flat)
    assert len(flat) == len(set(flat))
    assert 0 not in flat


def test_windows_are_spread_over_the_frames_given_not_a_fixed_250():
    for frames in (240, 250, 300):
        groups = windows_by_month(frames)
        assert all(groups[month] for month in months_in_period())
        assert sum(len(group) for group in groups.values()) == frames - 1  # only frame 0 lies before the period


def test_month_image_is_the_mean_of_its_own_windows_only():
    dots = dots_of([[(0, 200)], [(0, 100), (5, 250)], [(7, 255)]])
    grey = mean_of_windows(dots, [0, 1])
    assert grey.shape == (2, 4)
    assert grey[0, 0] == 150  # (200 + 100) / 2
    assert grey[1, 1] == 125  # 250 seen in one of the two windows
    assert grey[1, 3] == 0  # window 2 is another month: not carried over
    assert not mean_of_windows(dots, []).any()


def test_main_writes_one_image_per_month(tmp_path, capsys):
    frames = [[(index % 8, 120)] for index in range(250)]
    source = tmp_path / "dots.npz"
    save_dots(dots_of(frames), source)

    assert main([str(source), str(tmp_path / "out")]) == 0

    written = sorted(path.name for path in (tmp_path / "out").glob("*.png"))
    assert len(written) == 79
    assert "lightning_2023_07.png" in written
    image = np.asarray(Image.open(tmp_path / "out" / "lightning_2017_01.png"))
    assert image.shape == (2, 4)
    assert image.max() > 0
    out = capsys.readouterr().out
    assert "Jul 2023" in out and "2023-07-01T00:00:00Z" in out


def test_main_fails_without_enough_windows(tmp_path, capsys):
    source = tmp_path / "dots.npz"
    save_dots(dots_of([[(0, 120)]] * 10), source)  # covers only the first weeks
    assert main([str(source), str(tmp_path / "out")]) == 1
    assert "no window falls in" in capsys.readouterr().err
    assert main(["only-one-argument"]) == 2
