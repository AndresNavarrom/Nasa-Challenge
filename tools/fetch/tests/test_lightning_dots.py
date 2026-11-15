"""Tests for the sharp lightning dots image (lightning_dots.py). Small synthetic frames only: no video is read."""

import io

import numpy as np
import pytest
from PIL import Image

from lightning_dots import (
    CORE,
    DOT_FLOOR,
    STORE_MIN,
    Dots,
    DotsError,
    Style,
    collect,
    drawn_dots,
    frequency,
    keep_share,
    load_dots,
    main,
    render,
    save_dots,
    yellowness_u8,
)

GREY = (60, 60, 60)
DOT_CORE = (250, 230, 30)  # yellowness 200
DOT_EDGE = (200, 190, 90)  # yellowness 100: above STORE_MIN, below CORE
# Wide enough that the rare dot (column 100) lies far from the busy box (columns 4 to 40)
# both ways round: the smoothing wraps east-west like the planet.
WIDTH, HEIGHT = 160, 48


def blank() -> np.ndarray:
    return np.full((HEIGHT, WIDTH, 3), GREY, dtype=np.uint8)


def add_dot(frame: np.ndarray, row: int, column: int) -> None:
    """A lightning dot like the video's: a 3 x 3 core with a one-pixel soft edge around it."""
    frame[row - 2 : row + 3, column - 2 : column + 3] = DOT_EDGE
    frame[row - 1 : row + 2, column - 1 : column + 2] = DOT_CORE


def busy_and_rare_frames(frames: int = 40) -> list[np.ndarray]:
    """A busy box (many dots in every window, west) and one rare dot (in one window only, east)."""
    rng = np.random.default_rng(1)
    out = []
    for number in range(frames):
        frame = blank()
        for _ in range(25):
            add_dot(frame, int(rng.integers(4, 40)), int(rng.integers(4, 40)))
        if number == 7:
            add_dot(frame, 24, 100)
        out.append(frame)
    return out


def test_only_yellow_lightning_counts_and_only_lightning_pixels_are_kept():
    frame = blank()
    frame[0, 0] = (220, 220, 220)  # grey grid line
    add_dot(frame, 10, 10)
    yellow = yellowness_u8(frame)
    assert yellow[0, 0] == 0 and yellow[30, 30] == 0
    assert yellow[10, 10] == 200 and yellow[8, 8] == 100

    dots = collect([frame, blank()])
    assert (dots.width, dots.height, dots.frames) == (WIDTH, HEIGHT, 2)
    index, value = dots.frame(0)
    assert index.size == 25 and value.min() >= STORE_MIN  # the 5 x 5 dot, nothing else
    assert dots.frame(1)[0].size == 0


def test_the_dots_file_round_trips_and_a_broken_one_fails_with_a_message(tmp_path):
    frames = busy_and_rare_frames(6)
    frames.insert(2, blank())  # an empty window in the middle
    dots = collect(frames)
    target = tmp_path / "raw" / "dots.npz"
    save_dots(dots, target)
    again = load_dots(target)
    assert again.frames == dots.frames == 7
    for number in range(dots.frames):
        assert np.array_equal(again.frame(number)[0], dots.frame(number)[0])
        assert np.array_equal(again.frame(number)[1], dots.frame(number)[1])
    assert not list(tmp_path.glob("raw/*.part*"))  # written through a temporary name

    np.savez(tmp_path / "bad.npz", width=4, height=4, starts=np.array([0, 3]), deltas=np.array([1, 1], np.uint32), value=np.array([90, 90], np.uint8))
    with pytest.raises(DotsError, match="inconsistent"):
        load_dots(tmp_path / "bad.npz")
    with pytest.raises(DotsError, match="cannot read"):
        load_dots(tmp_path / "missing.npz")


def test_frequency_counts_the_windows_with_a_dot_core():
    first, second = blank(), blank()
    add_dot(first, 10, 10)
    add_dot(second, 10, 10)
    add_dot(second, 30, 60)
    freq = frequency(collect([first, second, blank()]))
    assert freq[10, 10] == 2 and freq[30, 60] == 1
    assert freq[8, 8] == 0  # soft edge, not a core
    assert freq[0, 0] == 0


def test_rare_places_draw_up_to_the_most_windows_and_busy_places_fewer():
    share = np.array([0.0, 0.001, 0.05, 0.5])
    keep = keep_share(share, frames=200, coverage=0.3, most=10)
    assert keep[0] == pytest.approx(10 / 200)  # no lightning nearby: nothing to thin
    assert keep[1] == pytest.approx(10 / 200)
    # 0.05 of the windows: log(0.7) / log(0.95) = 6.95 windows reach 30 % coverage.
    assert keep[2] == pytest.approx(np.log(0.7) / np.log(0.95) / 200, rel=1e-5)
    assert keep[3] < keep[2]
    # A larger coverage target (the busiest places) draws more.
    assert keep_share(share, 200, 0.6, 10)[3] > keep[3]
    with pytest.raises(DotsError, match="no frames"):
        keep_share(share, 0, 0.3, 10)


def test_dots_are_drawn_whole_or_not_at_all():
    frame = blank()
    add_dot(frame, 10, 10)
    add_dot(frame, 30, 60)
    dots = collect([frame])
    index, value = dots.frame(0)
    rng = np.random.default_rng(0)
    assert drawn_dots(index, value, WIDTH, HEIGHT, np.ones(WIDTH * HEIGHT, np.float32), rng).all()
    assert not drawn_dots(index, value, WIDTH, HEIGHT, np.zeros(WIDTH * HEIGHT, np.float32), rng).any()
    # Keep only the dots around (10, 10): the other dot disappears, edge included.
    keep = np.zeros((HEIGHT, WIDTH), np.float32)
    keep[:20, :20] = 1
    drawn = drawn_dots(index, value, WIDTH, HEIGHT, keep.ravel(), rng)
    rows = index[drawn] // WIDTH
    assert drawn.sum() == 25 and rows.max() < 20


def test_busy_places_keep_distinct_bright_dots_and_rare_dots_still_show():
    dots = collect(busy_and_rare_frames())
    style = Style(most_windows=dots.frames, cover_min=0.1, cover_max=0.3)
    image = render(dots, style)

    union = np.zeros(WIDTH * HEIGHT, bool)
    for number in range(dots.frames):
        union[dots.frame(number)[0]] = True
    union = union.reshape(HEIGHT, WIDTH)
    busy = (slice(4, 40), slice(4, 40))
    # Over all windows the busy box is one solid patch; drawn, most of it stays dark.
    assert union[busy].mean() > 0.95
    assert 0.02 < (image[busy] > 0).mean() < 0.6
    # Every lit pixel is a pixel of a real dot.
    assert not np.any((image > 0) & ~union)
    # The rare dot (one window of 40, nothing else near it) is drawn whole, dim.
    assert (image[22:27, 98:103] > 0).all()
    rare_core = int(image[24, 100])
    assert DOT_FLOOR <= rare_core < 140
    # Dots where lightning strikes in every window are brighter than the rare one.
    assert image[busy].max() > rare_core + 60
    # The choice of dots is fixed: the same image on every run.
    assert np.array_equal(image, render(dots, style))


def test_render_fails_without_frames():
    empty = Dots(4, 2, np.array([0]), np.zeros(0, np.uint32), np.zeros(0, np.uint8))
    with pytest.raises(DotsError, match="no frames"):
        render(empty)


def test_command_line_collects_then_renders(tmp_path):
    frames = busy_and_rare_frames(5)
    stream = io.BytesIO(b"".join(frame.tobytes() for frame in frames))
    dots_file = tmp_path / "dots.npz"
    assert main(["collect", str(WIDTH), str(HEIGHT), str(dots_file), "5"], stream) == 0
    png = tmp_path / "out" / "lightning-4k.png"
    assert main(["render", str(dots_file), str(png)]) == 0
    with Image.open(png) as image:
        assert image.mode == "L" and image.size == (WIDTH, HEIGHT)
        assert np.asarray(image).max() > 0

    # Too few frames (a cut stream), a cut-off frame and bad arguments fail.
    assert main(["collect", str(WIDTH), str(HEIGHT), str(tmp_path / "x.npz"), "6"], io.BytesIO(stream.getvalue())) == 1
    assert main(["collect", str(WIDTH), str(HEIGHT), str(tmp_path / "x.npz")], io.BytesIO(bytes(7))) == 1
    assert not (tmp_path / "x.npz").exists()
    assert main(["collect", "wide", str(HEIGHT), str(tmp_path / "x.npz")], io.BytesIO()) == 2
    assert main(["render", str(tmp_path / "missing.npz"), str(png)]) == 1
    assert main(["draw"]) == 2


def test_core_threshold_sits_between_the_edge_and_the_core_of_a_drawn_dot():
    assert STORE_MIN < 100 < CORE < 200
