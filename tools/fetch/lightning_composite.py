"""SVS 5011 lightning video -> one grey PNG with the whole period accumulated.

The video (iss_lightning_sos_yearly_07312023_2048p60.mp4, 4096 x 2048,
equirectangular, 100 s) shows lightning seen by LIS on the ISS from January 2017
to July 2023 as yellow dots over a grey map, through a 10-day roving window:
each frame shows only the last ten days, and the last frame is empty. No single
frame holds the accumulated period, and the video does not restart each year.

So the accumulated map is built from frames spread over the whole video, close
enough that their 10-day windows cover the period (the video runs about 24 days
per second, so one frame every 0.4 s). For each frame, the "yellowness" of a
pixel (the smaller of red and green minus blue) is 0 on the grey map, the grey
grid lines and black space, and high on a lightning dot. The output is the mean
yellowness over all frames: how often lightning was seen there during
2017-2023, as a relative intensity (grey 0 = never, 255 = in every window at
full brightness).

MIN_FRAMES (optional) makes the script fail when fewer frames arrive, for
example when the network stream of the video was cut short.

Usage: ffmpeg ... -f rawvideo -pix_fmt rgb24 - | python lightning_composite.py WIDTH HEIGHT OUTPUT.png [MIN_FRAMES]
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import BinaryIO, Iterable

import numpy as np


class CompositeError(Exception):
    """A problem with the frames, with a message for the person running the script."""


def yellowness(frame: np.ndarray) -> np.ndarray:
    """0..1 per pixel of an RGB frame: min(red, green) minus blue; grey, white and black give 0."""
    if frame.ndim != 3 or frame.shape[2] != 3:
        raise CompositeError(f"expected an RGB frame (height x width x 3), got shape {frame.shape}")
    rgb = frame.astype(np.int16)
    value = np.minimum(rgb[..., 0], rgb[..., 1]) - rgb[..., 2]
    return np.clip(value, 0, 255).astype(np.float32) / 255.0


def mean_yellowness(frames: Iterable[np.ndarray]) -> np.ndarray:
    """Mean yellowness over every frame (all frames must have the same size)."""
    total: np.ndarray | None = None
    count = 0
    for frame in frames:
        value = yellowness(frame)
        if total is None:
            total = np.zeros(value.shape, dtype=np.float64)
        elif value.shape != total.shape:
            raise CompositeError(f"frame {count + 1} is {value.shape}, the first frame was {total.shape}")
        total += value
        count += 1
    if total is None:
        raise CompositeError("no frames were received")
    return total / count


def to_grey(mean: np.ndarray) -> np.ndarray:
    return np.rint(np.clip(mean, 0.0, 1.0) * 255.0).astype(np.uint8)


def read_raw_frames(stream: BinaryIO, width: int, height: int) -> Iterable[np.ndarray]:
    """Frames of a raw rgb24 stream; fails on a cut-off last frame."""
    size = width * height * 3
    index = 0
    while True:
        chunk = stream.read(size)
        if not chunk:
            return
        if len(chunk) != size:
            raise CompositeError(f"frame {index + 1} is cut off: {len(chunk)} of {size} bytes")
        index += 1
        yield np.frombuffer(chunk, dtype=np.uint8).reshape(height, width, 3)


def main(argv: list[str]) -> int:
    if len(argv) not in (3, 4):
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    try:
        width, height = int(argv[0]), int(argv[1])
        min_frames = int(argv[3]) if len(argv) == 4 else 1
    except ValueError:
        print("lightning_composite: WIDTH, HEIGHT and MIN_FRAMES must be whole numbers", file=sys.stderr)
        return 2
    target = Path(argv[2])
    frames = 0

    def counted(stream: Iterable[np.ndarray]) -> Iterable[np.ndarray]:
        nonlocal frames
        for frame in stream:
            frames += 1
            yield frame

    try:
        grey = to_grey(mean_yellowness(counted(read_raw_frames(sys.stdin.buffer, width, height))))
    except CompositeError as error:
        print(f"lightning_composite: {error}", file=sys.stderr)
        return 1
    if frames < min_frames:
        print(f"lightning_composite: only {frames} frames arrived, at least {min_frames} expected", file=sys.stderr)
        return 1
    from PIL import Image

    target.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(grey, mode="L").save(target)
    print(f"  png    {target} ({frames} frames combined, max grey {int(grey.max())})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
