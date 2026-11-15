"""SVS 5011 lightning windows -> one grey PNG per month, for the timeline.

The saved lightning windows (data/raw/5011/lightning_dots_2017_2023.npz, made by
``lightning_dots.py collect``) hold the lightning pixels of 250 frames of the
SVS 5011 video, one every 0.4 s. Each frame shows the last ten days of LIS
lightning; the video runs linearly from 1 January 2017 to 31 July 2023 over
100 s, so frame ``k`` of ``n`` ends about ``k / n`` of the way through the period
(about 9.6 days apart for the 250 frames expected; the count of the saved
windows is used, not a fixed 250).

Each window is placed in the month that holds its middle day, and every month
becomes one image: the mean yellowness (0..255, see lightning_composite.py) of
the windows of that month only (two to four of them). Nothing is carried over
from one month to the next, so playing the images in order shows where
lightning was seen in each month (the storm belt moving north and south with
the seasons), not an accumulation.

The output images have the size of the video frames (equirectangular, north row
first, 0 = no lightning) and are named ``lightning_<year>_<mm>.png``. The script
prints one line per month: file, label, ISO start date and number of windows.

Usage: python lightning_months.py DOTS.npz OUTPUT_DIR
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import numpy as np

from lightning_dots import Dots, DotsError, load_dots

PERIOD_START = date(2017, 1, 1)
PERIOD_END = date(2023, 7, 31)
VIDEO_SECONDS = 100.0
SAMPLE_SECONDS = 0.4  # one frame every 0.4 s (ffmpeg fps=2.5)
EXPECTED_FRAMES = int(VIDEO_SECONDS / SAMPLE_SECONDS)  # 250; the real count comes from the saved windows
WINDOW_DAYS = 10

MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


@dataclass(frozen=True, order=True)
class Month:
    year: int
    number: int  # 1..12

    @property
    def file(self) -> str:
        return f"lightning_{self.year}_{self.number:02d}.png"

    def label(self) -> str:
        """Readable month, e.g. "Jan 2017"."""
        return f"{MONTHS[self.number - 1]} {self.year}"

    def iso(self) -> str:
        """First day of the month at midnight UTC, e.g. "2017-01-01T00:00:00Z"."""
        return f"{self.year:04d}-{self.number:02d}-01T00:00:00Z"

    def next(self) -> "Month":
        return Month(self.year + 1, 1) if self.number == 12 else Month(self.year, self.number + 1)


def window_middle(frame: int, frames: int = EXPECTED_FRAMES) -> date:
    """Middle day of the ten-day window shown by frame ``frame`` of ``frames`` samples.

    The frames are spread evenly over the period, so a video that gave fewer or
    more samples than expected still covers it from start to end.
    """
    span = (PERIOD_END - PERIOD_START).days
    end = PERIOD_START + timedelta(days=span * frame / frames)
    return end - timedelta(days=WINDOW_DAYS / 2)


def month_of(day: date) -> Month:
    return Month(day.year, day.month)


def months_in_period() -> list[Month]:
    months: list[Month] = []
    current = month_of(PERIOD_START)
    last = month_of(PERIOD_END)
    while current <= last:
        months.append(current)
        current = current.next()
    return months


def windows_by_month(frames: int) -> dict[Month, list[int]]:
    """Frames of each month of the period; windows whose middle falls outside the period are left out."""
    groups: dict[Month, list[int]] = {month: [] for month in months_in_period()}
    for frame in range(frames):
        middle = window_middle(frame, frames)
        if middle < PERIOD_START or middle > PERIOD_END:
            continue
        groups[month_of(middle)].append(frame)
    return groups


def mean_of_windows(dots: Dots, frames: list[int]) -> np.ndarray:
    """Mean yellowness (0..255, uint8, height x width) of the given windows; all zero without windows."""
    total = np.zeros(dots.width * dots.height, dtype=np.float64)
    for frame in frames:
        index, value = dots.frame(frame)
        total[index.astype(np.int64)] += value
    if frames:
        total /= len(frames)
    return np.rint(np.clip(total, 0, 255)).astype(np.uint8).reshape(dots.height, dots.width)


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    source, target = Path(argv[0]), Path(argv[1])
    try:
        dots = load_dots(source)
    except DotsError as error:
        print(f"lightning_months: {error}", file=sys.stderr)
        return 1
    groups = windows_by_month(dots.frames)
    empty = [month.label() for month, frames in groups.items() if not frames]
    if empty:
        print(f"lightning_months: no window falls in {', '.join(empty)}", file=sys.stderr)
        return 1
    from PIL import Image

    target.mkdir(parents=True, exist_ok=True)
    for month, frames in groups.items():
        grey = mean_of_windows(dots, frames)
        path = target / month.file
        partial = path.with_name(path.name + ".part.png")
        Image.fromarray(grey, mode="L").save(partial)
        partial.replace(path)
        print(f"{month.file}\t{month.label()}\t{month.iso()}\t{len(frames)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
