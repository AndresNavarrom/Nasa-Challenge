"""Tests for the per-quarter lightning images (lightning_quarters.py). Small synthetic windows only."""

from datetime import date

import numpy as np
from PIL import Image

from lightning_dots import Dots, save_dots
from lightning_quarters import (
    PERIOD_END,
    PERIOD_START,
    Quarter,
    main,
    mean_of_windows,
    quarters_in_period,
    window_middle,
    windows_by_quarter,
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


def test_period_has_27_quarters_with_readable_labels():
    quarters = quarters_in_period()
    assert len(quarters) == 27  # 2017 to 2022 (24) plus January to July 2023 (3)
    assert quarters[0] == Quarter(2017, 1)
    assert quarters[0].label() == "Jan - Mar 2017"
    assert quarters[0].file == "lightning_2017_q1.png"
    assert quarters[-1] == Quarter(2023, 3)
    assert quarters[-1].label() == "Jul 2023"  # the period ends on 31 July 2023
    assert Quarter(2020, 4).label() == "Oct - Dec 2020"


def test_windows_follow_the_video_in_order_and_fill_every_quarter():
    assert window_middle(0) < PERIOD_START  # the first frame's window lies before the period
    assert window_middle(125) > date(2020, 3, 1) and window_middle(125) < date(2020, 6, 1)  # halfway
    assert window_middle(250) <= PERIOD_END

    groups = windows_by_quarter(250)
    assert all(groups[quarter] for quarter in quarters_in_period())
    # Each window belongs to exactly one quarter, in time order.
    flat = [frame for quarter in quarters_in_period() for frame in groups[quarter]]
    assert flat == sorted(flat)
    assert len(flat) == len(set(flat))
    assert 0 not in flat


def test_windows_are_spread_over_the_frames_given_not_a_fixed_250():
    for frames in (200, 250, 300):
        groups = windows_by_quarter(frames)
        # Every quarter still gets a window, July 2023 included, and none is dropped.
        assert all(groups[quarter] for quarter in quarters_in_period())
        assert sum(len(group) for group in groups.values()) == frames - 1  # only frame 0 lies before the period


def test_quarter_image_is_the_mean_of_its_own_windows_only():
    dots = dots_of([[(0, 200)], [(0, 100), (5, 250)], [(7, 255)]])
    grey = mean_of_windows(dots, [0, 1])
    assert grey.shape == (2, 4)
    assert grey[0, 0] == 150  # (200 + 100) / 2
    assert grey[1, 1] == 125  # 250 seen in one of the two windows
    assert grey[1, 3] == 0  # window 2 is another quarter: not carried over
    assert not mean_of_windows(dots, []).any()


def test_main_writes_one_image_per_quarter(tmp_path, capsys):
    frames = [[(index % 8, 120)] for index in range(250)]
    source = tmp_path / "dots.npz"
    save_dots(dots_of(frames), source)

    assert main([str(source), str(tmp_path / "out")]) == 0

    written = sorted(path.name for path in (tmp_path / "out").glob("*.png"))
    assert len(written) == 27
    assert "lightning_2023_q3.png" in written
    image = np.asarray(Image.open(tmp_path / "out" / "lightning_2017_q1.png"))
    assert image.shape == (2, 4)
    assert image.max() > 0
    assert "Jul 2023" in capsys.readouterr().out


def test_main_fails_without_enough_windows(tmp_path, capsys):
    source = tmp_path / "dots.npz"
    save_dots(dots_of([[(0, 120)]] * 10), source)  # covers only the first weeks
    assert main([str(source), str(tmp_path / "out")]) == 1
    assert "no window falls in" in capsys.readouterr().err
    assert main(["only-one-argument"]) == 2
