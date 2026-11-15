"""SVS 5011 lightning windows -> one grey PNG per quarter, for the timeline.

The saved lightning windows (data/raw/5011/lightning_dots_2017_2023.npz, made by
``lightning_dots.py collect``) hold the lightning pixels of 250 frames of the
SVS 5011 video, one every 0.4 s. Each frame shows the last ten days of LIS
lightning; the video runs linearly from 1 January 2017 to 31 July 2023 over
100 s, so frame ``k`` of ``n`` ends about ``k / n`` of the way through the period
(about 9.6 days apart for the 250 frames expected; the count of the saved
windows is used, not a fixed 250).

Each window is placed in the quarter that holds its middle day, and every
quarter becomes one image: the mean yellowness (0..255, see
lightning_composite.py) of the windows of that quarter only. Nothing is carried
over from one quarter to the next, so playing the images in order shows where
lightning was seen in each quarter, not an accumulation. The last quarter holds
July 2023 only.

The output images have the size of the video frames (equirectangular, north row
first, 0 = no lightning) and are named ``lightning_<year>_q<n>.png``. The script
prints one line per quarter: file, label and number of windows.

Usage: python lightning_quarters.py DOTS.npz OUTPUT_DIR
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


@dataclass(frozen=True)
class Quarter:
    year: int
    number: int  # 1..4

    @property
    def file(self) -> str:
        return f"lightning_{self.year}_q{self.number}.png"

    @property
    def first_month(self) -> int:
        return (self.number - 1) * 3 + 1

    def label(self) -> str:
        """Months of the quarter inside the period, e.g. "Jan - Mar 2017" or "Jul 2023"."""
        first = self.first_month
        last = min(first + 2, PERIOD_END.month) if self.year == PERIOD_END.year else first + 2
        if last <= first:
            return f"{MONTHS[first - 1]} {self.year}"
        return f"{MONTHS[first - 1]} - {MONTHS[last - 1]} {self.year}"


def window_middle(frame: int, frames: int = EXPECTED_FRAMES) -> date:
    """Middle day of the ten-day window shown by frame ``frame`` of ``frames`` samples.

    The frames are spread evenly over the period, so a video that gave fewer or
    more samples than expected still covers it from start to end.
    """
    span = (PERIOD_END - PERIOD_START).days
    end = PERIOD_START + timedelta(days=span * frame / frames)
    return end - timedelta(days=WINDOW_DAYS / 2)


def quarter_of(day: date) -> Quarter:
    return Quarter(day.year, (day.month - 1) // 3 + 1)


def quarters_in_period() -> list[Quarter]:
    quarters: list[Quarter] = []
    current = quarter_of(PERIOD_START)
    last = quarter_of(PERIOD_END)
    while (current.year, current.number) <= (last.year, last.number):
        quarters.append(current)
        current = Quarter(current.year + 1, 1) if current.number == 4 else Quarter(current.year, current.number + 1)
    return quarters


def windows_by_quarter(frames: int) -> dict[Quarter, list[int]]:
    """Frames of each quarter of the period; windows whose middle falls outside the period are left out."""
    groups: dict[Quarter, list[int]] = {quarter: [] for quarter in quarters_in_period()}
    for frame in range(frames):
        middle = window_middle(frame, frames)
        if middle < PERIOD_START or middle > PERIOD_END:
            continue
        groups[quarter_of(middle)].append(frame)
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
        print(f"lightning_quarters: {error}", file=sys.stderr)
        return 1
    groups = windows_by_quarter(dots.frames)
    empty = [quarter.label() for quarter, frames in groups.items() if not frames]
    if empty:
        print(f"lightning_quarters: no window falls in {', '.join(empty)}", file=sys.stderr)
        return 1
    from PIL import Image

    target.mkdir(parents=True, exist_ok=True)
    for quarter, frames in groups.items():
        grey = mean_of_windows(dots, frames)
        path = target / quarter.file
        partial = path.with_name(path.name + ".part.png")
        Image.fromarray(grey, mode="L").save(partial)
        partial.replace(path)
        print(f"{quarter.file}\t{quarter.label()}\t{len(frames)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
