"""SVS 5011 lightning video -> a sharp image of distinct lightning dots for the planet view.

The sound reads the 0.25 degree lightning grids that jukebox-prep makes from the
mean composite (lightning_composite.py). Drawn on the planet, that mean is a soft
blur, and every way of accumulating the whole period at full resolution (mean,
number of windows with lightning, a gamma curve, an unsharp mask) turns the
tropics into one solid patch: over 250 ten-day windows almost every pixel of the
Congo basin sees lightning many times. NASA SVS 5011 shows one ten-day window at
a time, so its dots stay apart.

This script keeps the dots of the video itself and the frequency of the whole
period, in two steps.

``collect`` reads the frames (one every 0.4 s, each a 10-day window, as in
lightning_composite.py) from a raw rgb24 stream and keeps only the lightning
pixels of each frame (yellowness, min(R, G) - B, of at least STORE_MIN) in a
compressed .npz file of about 25 MB, so the video is read only once.

``render`` turns that file into one 8-bit greyscale PNG (one channel, the size of
the video frames, equirectangular, north row first, 0 = no lightning):

1. ``frequency``: in how many windows each pixel lies inside a lightning dot (dot
   core: yellowness of at least CORE), i.e. how often lightning was seen there
   between January 2017 and July 2023.
2. ``level`` (0..1): that frequency, lightly smoothed, relative to the busiest
   places (its FREQUENCY_PERCENTILE-th percentile among places with any
   lightning).
3. Each dot of each window (a connected group of dot-core pixels in one frame,
   with its soft edge) is either drawn whole or left out. Everywhere, at most
   ``Style.most_windows`` windows' worth of dots are drawn, picked from all the
   windows of the period (so every season and every year shows), so where
   lightning is uncommon the number of dots grows with how often it strikes.
   Where that many would cover more of the ground than a set share (from
   ``Style.cover_min`` where lightning is rare to ``Style.cover_max`` at the
   busiest places, following ``level``), fewer are drawn, so the dots in the
   tropics stay apart instead of merging into one patch while still being the
   densest. The share of dots drawn at a place comes from the local share of
   windows with lightning, smoothed over COVERAGE_SIGMA pixels; which dots are
   drawn is a fixed pseudo-random choice (seed SEED), the same on every run.
4. The value of a drawn dot follows ``level``, so dots are dim orange where
   lightning is rare and nearly white where it strikes most often:
   value = edge x (DOT_FLOOR + (255 - DOT_FLOOR) x level), with ``edge`` the soft
   edge of the dot in the video (0 at yellowness STORE_MIN, 1 from EDGE_FULL).

So every lit pixel is a real lightning dot of the video at its real place, and
its colour says how often lightning was seen there over the whole period; only
the number of dots is thinned (about 4 % of the pixels end up lit).

Usage:
  ffmpeg ... -f rawvideo -pix_fmt rgb24 - | python lightning_dots.py collect WIDTH HEIGHT DOTS.npz [MIN_FRAMES]
  python lightning_dots.py render DOTS.npz OUTPUT.png
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Iterable

import numpy as np

from lightning_composite import CompositeError, read_raw_frames

STORE_MIN = 77  # yellowness (0..255) kept from each frame: the dot and its soft edge
CORE = 128  # yellowness of a dot core (the drawn dots peak at about 200)
EDGE_FULL = 150  # a dot is drawn at full strength from this yellowness up
EDGE_REACH = 2  # pixels: how far around its core a drawn dot keeps its soft edge
COVERAGE_SIGMA = 8.0  # pixels: smoothing of the local share of windows with lightning
FREQUENCY_SIGMA = 1.0  # pixels: light smoothing of the frequency before it sets the brightness
FREQUENCY_PERCENTILE = 99.5  # frequency (among places with any lightning) drawn at full brightness
DOT_FLOOR = 72  # value of the dimmest dot at full strength
SEED = 5011  # fixed choice of the dots that are drawn


@dataclass(frozen=True)
class Style:
    """How many dots are drawn and how bright (see the module description)."""

    # Windows' worth of dots drawn where lightning is not common enough to reach the coverage.
    most_windows: float = 14.0
    # Largest share of the ground covered by the drawn dots: from cover_min where lightning
    # is rare to cover_max at the busiest places (linear in the brightness level). The
    # share actually drawn is lower: whole dots are drawn, and their edges overlap.
    cover_min: float = 0.12
    cover_max: float = 0.7
    # level = (frequency / its FREQUENCY_PERCENTILE-th percentile) ** gamma, 0..1.
    gamma: float = 1.0


STYLE = Style()


class DotsError(Exception):
    """A problem with the frames or the dots file, with a message for the person running the script."""


@dataclass(frozen=True)
class Dots:
    """Lightning pixels of every frame: flat pixel index and yellowness, frame after frame."""

    width: int
    height: int
    starts: np.ndarray  # int64, frames + 1 offsets into index / value
    index: np.ndarray  # uint32 flat pixel index (row * width + column), increasing within a frame
    value: np.ndarray  # uint8 yellowness

    @property
    def frames(self) -> int:
        return len(self.starts) - 1

    def frame(self, number: int) -> tuple[np.ndarray, np.ndarray]:
        a, b = int(self.starts[number]), int(self.starts[number + 1])
        return self.index[a:b], self.value[a:b]


def yellowness_u8(frame: np.ndarray) -> np.ndarray:
    """0..255 per pixel of an RGB frame: min(red, green) minus blue, clipped at 0 (grey, white, black give 0)."""
    if frame.ndim != 3 or frame.shape[2] != 3:
        raise DotsError(f"expected an RGB frame (height x width x 3), got shape {frame.shape}")
    rgb = frame.astype(np.int16)
    return np.clip(np.minimum(rgb[..., 0], rgb[..., 1]) - rgb[..., 2], 0, 255).astype(np.uint8)


def collect(frames: Iterable[np.ndarray]) -> Dots:
    """Keeps the pixels of each frame with yellowness of at least STORE_MIN."""
    indices: list[np.ndarray] = []
    values: list[np.ndarray] = []
    starts = [0]
    shape: tuple[int, int] | None = None
    for number, frame in enumerate(frames, start=1):
        yellow = yellowness_u8(frame)
        if shape is None:
            shape = yellow.shape
        elif yellow.shape != shape:
            raise DotsError(f"frame {number} is {yellow.shape}, the first frame was {shape}")
        flat = yellow.ravel()
        where = np.flatnonzero(flat >= STORE_MIN).astype(np.uint32)
        indices.append(where)
        values.append(flat[where])
        starts.append(starts[-1] + where.size)
    if shape is None:
        raise DotsError("no frames were received")
    return Dots(
        width=shape[1],
        height=shape[0],
        starts=np.asarray(starts, dtype=np.int64),
        index=np.concatenate(indices),
        value=np.concatenate(values),
    )


def save_dots(dots: Dots, target: Path) -> None:
    """Writes the dots file (through a temporary name, so a cut-off run leaves no file)."""
    target.parent.mkdir(parents=True, exist_ok=True)
    # Indices increase within a frame: store their differences, which compress well.
    # The first pixel of each frame keeps its own index.
    deltas = np.diff(dots.index.astype(np.int64), prepend=0)
    firsts = dots.starts[:-1][np.diff(dots.starts) > 0]
    deltas[firsts] = dots.index[firsts]
    partial = target.with_name(target.name + ".part.npz")
    np.savez_compressed(
        partial,
        width=dots.width,
        height=dots.height,
        starts=dots.starts,
        deltas=deltas.astype(np.uint32),
        value=dots.value,
    )
    partial.replace(target)


def load_dots(source: Path) -> Dots:
    try:
        with np.load(source) as data:
            width, height = int(data["width"]), int(data["height"])
            starts = data["starts"].astype(np.int64)
            deltas = data["deltas"].astype(np.int64)
            value = data["value"].astype(np.uint8)
    except (OSError, KeyError, ValueError) as error:
        raise DotsError(f"cannot read the dots file {source}: {error}") from error
    if len(starts) < 2 or starts[0] != 0 or starts[-1] != len(deltas) or len(value) != len(deltas):
        raise DotsError(f"the dots file {source} is inconsistent (offsets do not match the pixel lists)")
    if np.any(np.diff(starts) < 0):
        raise DotsError(f"the dots file {source} is inconsistent (offsets go backwards)")
    index = np.empty(len(deltas), dtype=np.int64)
    for number in range(len(starts) - 1):
        a, b = starts[number], starts[number + 1]
        index[a:b] = np.cumsum(deltas[a:b])
    if index.size and (index.min() < 0 or index.max() >= width * height):
        raise DotsError(f"the dots file {source} holds pixels outside its {width} x {height} frame")
    return Dots(width, height, starts, index.astype(np.uint32), value)


def gaussian_blur(image: np.ndarray, sigma: float) -> np.ndarray:
    """Gaussian blur that wraps around east-west (the map is a full circle) and clamps north-south."""
    from scipy.ndimage import gaussian_filter1d

    out = image.astype(np.float32)
    if sigma <= 0:
        return out
    out = gaussian_filter1d(out, sigma, axis=1, mode="wrap", truncate=3.0)
    return gaussian_filter1d(out, sigma, axis=0, mode="nearest", truncate=3.0)


def frequency(dots: Dots, minimum: int = CORE) -> np.ndarray:
    """Number of frames in which each pixel has a yellowness of at least `minimum` (default: inside a dot core)."""
    count = np.zeros(dots.width * dots.height, dtype=np.uint16)
    for number in range(dots.frames):
        index, value = dots.frame(number)
        count[index[value >= minimum]] += 1
    return count.reshape(dots.height, dots.width)


def keep_share(share: np.ndarray, frames: int, coverage: np.ndarray | float, most: float) -> np.ndarray:
    """Share of the dots drawn at each place (0..1).

    With a share p of windows holding a dot at a place, n windows' worth of dots
    cover about 1 - (1 - p)^n of it, so `coverage` is reached at
    n = log(1 - coverage) / log(1 - p). Each place draws min(most, n) windows'
    worth of its `frames` windows.
    """
    if frames < 1:
        raise DotsError("there are no frames to draw")
    p = np.clip(np.asarray(share, dtype=np.float64), 0.0, 0.999)
    cover = np.clip(np.asarray(coverage, dtype=np.float64), 0.0, 0.999)
    with np.errstate(divide="ignore"):
        n = np.where(p > 0, np.log1p(-cover) / np.log1p(-p), np.inf)
    return (np.minimum(n, most) / frames).clip(0.0, 1.0).astype(np.float32)


def brightness(freq: np.ndarray, gamma: float = STYLE.gamma) -> np.ndarray:
    """0..1 per pixel: the lightly smoothed frequency over its FREQUENCY_PERCENTILE-th percentile among places with any, to `gamma`."""
    smooth = gaussian_blur(freq, FREQUENCY_SIGMA)
    seen = smooth[freq > 0]
    if seen.size == 0:
        return np.zeros(freq.shape, dtype=np.float32)
    top = max(float(np.percentile(seen, FREQUENCY_PERCENTILE)), 1e-6)
    return np.clip(smooth / top, 0.0, 1.0) ** gamma


def drawn_dots(
    index: np.ndarray, value: np.ndarray, width: int, height: int, keep: np.ndarray, rng: np.random.Generator
) -> np.ndarray:
    """Which pixels of one frame are drawn.

    A dot is a 4-connected group of core pixels (yellowness of at least CORE; the
    soft edges of neighbouring dots often touch, their cores much less), kept with
    the mean `keep` share of its pixels. A kept dot brings its soft edge: the
    lightning pixels within EDGE_REACH pixels of its core.
    """
    from scipy.ndimage import binary_dilation, label

    if index.size == 0:
        return np.zeros(0, dtype=bool)
    core = index[value >= CORE]
    if core.size == 0:
        return np.zeros(index.size, dtype=bool)
    mask = np.zeros(width * height, dtype=bool)
    mask[core] = True
    labels, groups = label(mask.reshape(height, width))
    group = labels.ravel()[core] - 1
    sizes = np.bincount(group, minlength=groups)
    chance = np.bincount(group, weights=keep[core], minlength=groups) / np.maximum(sizes, 1)
    kept = np.zeros(width * height, dtype=bool)
    kept[core[(rng.random(groups) < chance)[group]]] = True
    reach = binary_dilation(kept.reshape(height, width), iterations=EDGE_REACH).ravel()
    return reach[index]


def render(dots: Dots, style: Style = STYLE) -> np.ndarray:
    """The dots image (uint8, height x width), see the module description."""
    if dots.frames < 1:
        raise DotsError("the dots file holds no frames")
    level = brightness(frequency(dots), style.gamma)
    # The share counts the whole drawn dot, soft edge included, so the coverage is what shows.
    share = gaussian_blur(frequency(dots, STORE_MIN + 1), COVERAGE_SIGMA) / dots.frames
    coverage = style.cover_min + (style.cover_max - style.cover_min) * gaussian_blur(level, COVERAGE_SIGMA)
    keep = keep_share(share, dots.frames, coverage, style.most_windows).ravel()
    strongest = np.zeros(dots.width * dots.height, dtype=np.uint8)
    for number in range(dots.frames):
        index, value = dots.frame(number)
        drawn = drawn_dots(index, value, dots.width, dots.height, keep, np.random.default_rng([SEED, number]))
        index, value = index[drawn], value[drawn]
        strongest[index] = np.maximum(strongest[index], value)
    edge = np.clip((strongest.astype(np.float32) - STORE_MIN) / (EDGE_FULL - STORE_MIN), 0.0, 1.0)
    out = edge * (DOT_FLOOR + (255 - DOT_FLOOR) * level.ravel())
    return np.rint(out).astype(np.uint8).reshape(dots.height, dots.width)


def _collect_main(argv: list[str], stream: BinaryIO) -> int:
    if len(argv) not in (3, 4):
        print(__doc__.strip().splitlines()[-2].strip(), file=sys.stderr)
        return 2
    try:
        width, height = int(argv[0]), int(argv[1])
        min_frames = int(argv[3]) if len(argv) == 4 else 1
    except ValueError:
        print("lightning_dots: WIDTH, HEIGHT and MIN_FRAMES must be whole numbers", file=sys.stderr)
        return 2
    try:
        dots = collect(read_raw_frames(stream, width, height))
    except (CompositeError, DotsError) as error:
        print(f"lightning_dots: {error}", file=sys.stderr)
        return 1
    if dots.frames < min_frames:
        print(f"lightning_dots: only {dots.frames} frames arrived, at least {min_frames} expected", file=sys.stderr)
        return 1
    target = Path(argv[2])
    save_dots(dots, target)
    print(f"  dots   {target} ({dots.frames} frames, {dots.index.size} lightning pixels)")
    return 0


def _render_main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__.strip().splitlines()[-1].strip(), file=sys.stderr)
        return 2
    try:
        image = render(load_dots(Path(argv[0])))
    except DotsError as error:
        print(f"lightning_dots: {error}", file=sys.stderr)
        return 1
    from PIL import Image

    target = Path(argv[1])
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_name(target.name + ".part.png")
    Image.fromarray(image, mode="L").save(partial, format="PNG", optimize=True)
    partial.replace(target)
    lit = float((image > 0).mean()) * 100
    print(f"  png    {target} ({image.shape[1]} x {image.shape[0]}, {lit:.1f} % of pixels lit, max {int(image.max())})")
    return 0


def main(argv: list[str], stream: BinaryIO | None = None) -> int:
    if argv[:1] == ["collect"]:
        return _collect_main(argv[1:], stream if stream is not None else sys.stdin.buffer)
    if argv[:1] == ["render"]:
        return _render_main(argv[1:])
    print("\n".join(line.strip() for line in __doc__.strip().splitlines()[-2:]), file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
