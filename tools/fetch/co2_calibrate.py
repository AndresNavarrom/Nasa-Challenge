"""Fits the globe of the SVS 5196 CO2 orbit frames to real coastlines.

The NASA frames are a rendered globe with thin white coastlines, seen by a camera
that stays put while the Earth turns under it. jukebox-prep places a longitude and
latitude on such a frame with an ``orthographic`` projection (tools/prep/src/
project.rs): disc centre ``cx``/``cy`` and ``radius`` in pixels, the point under
the camera ``center_lon``/``center_lat``, ``roll`` and the camera ``distance`` in
globe radii. This script finds those numbers instead of guessing them by eye.

1. Coastline points: the land/water edge of the Natural Earth base image
   (web/public/data/earth-4k.jpg), on a 0.1 degree grid, between 70 S and 70 N.
2. Line strength of a frame: brightness minus its blur, so the thin white
   coastlines stand out and the smooth CO2 haze does not.
3. Score of a set of numbers: mean line strength at the projected coastline
   points that face the camera (cosine of the view angle of at least 0.35).
4. ``fit`` first fits every number on the first frame given, then keeps the
   camera (cx, cy, radius, distance, center_lat, roll) and fits only
   ``center_lon`` on every frame, starting from the steady turn of the globe.

Usage (from the repository root):

    docker compose run --rm --entrypoint python3 fetch tools/fetch/co2_calibrate.py fit FRAME.png [FRAME.png ...]
    docker compose run --rm --entrypoint python3 fetch tools/fetch/co2_calibrate.py overlay FRAME.png OUT.png '<json params>'

``fit`` prints one JSON object per frame with its projection. ``overlay`` draws
the projected coastlines in red over a frame, to check a fit by eye.
"""

from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

Image.MAX_IMAGE_PIXELS = None

BASE_IMAGE = Path("web/public/data/earth-4k.jpg")
# Frame 00940 is centred on 49.90 W; the point under the camera moves west by this
# much per frame (the Earth turns east). It is the figure the fit settles on, also
# in fetch-frames.sh and SOURCES.md, and it is the start of the search, which only
# covers +-20 degrees around it.
REFERENCE_FRAME = 940
REFERENCE_LON = -49.90
DEGREES_PER_FRAME = -0.2017
FIT_SCALE = 2  # fit on frames shrunk by this factor (5760 x 3240 -> 2880 x 1620)
MIN_FACING = 0.35
START = {"cx": 2876.0, "cy": 1620.0, "radius": 1410.0, "center_lat": 0.34, "roll": -0.19, "distance": 4.57}


def coastline_points(step_deg: float = 0.1) -> np.ndarray:
    """Longitude/latitude (degrees) of land cells next to water, as an (n, 2) array."""
    image = Image.open(BASE_IMAGE).convert("RGB")
    width, height = int(360 / step_deg), int(180 / step_deg)
    rgb = np.asarray(image.resize((width, height), Image.BILINEAR)).astype(np.int32)
    water = (rgb[..., 2] - rgb[..., 0] > 40) & (rgb[..., 2] >= rgb[..., 1])
    land = ~water
    edge = land & ndimage.binary_dilation(water)
    rows, cols = np.nonzero(edge)
    lon = -180.0 + (cols + 0.5) * step_deg
    lat = 90.0 - (rows + 0.5) * step_deg
    keep = np.abs(lat) <= 70.0
    return np.stack([lon[keep], lat[keep]], axis=1)


def line_strength(frame_path: str) -> np.ndarray:
    """Thin bright lines of a frame (brightness minus its blur), shrunk by FIT_SCALE."""
    image = Image.open(frame_path).convert("RGB")
    image = image.resize((image.width // FIT_SCALE, image.height // FIT_SCALE), Image.BOX)
    grey = np.asarray(image).astype(np.float32).max(axis=2)
    lines = grey - ndimage.gaussian_filter(grey, 3.0)
    return np.clip(lines, 0.0, None)


def project(points: np.ndarray, p: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Pixel x, y and facing (cosine of the view angle) of each point; same maths as project.rs."""
    lon = np.radians(points[:, 0])
    lat = np.radians(points[:, 1])
    phi0 = math.radians(p["center_lat"])
    delta = lon - math.radians(p["center_lon"])
    x = np.cos(lat) * np.sin(delta)
    y = math.cos(phi0) * np.sin(lat) - math.sin(phi0) * np.cos(lat) * np.cos(delta)
    z = math.sin(phi0) * np.sin(lat) + math.cos(phi0) * np.cos(lat) * np.cos(delta)
    d = p["distance"]
    scale = math.sqrt(d * d - 1.0) / (d - z)
    sin_roll, cos_roll = math.sin(math.radians(p["roll"])), math.cos(math.radians(p["roll"]))
    px = (x * cos_roll + y * sin_roll) * scale
    py = (-x * sin_roll + y * cos_roll) * scale
    return p["cx"] + p["radius"] * px, p["cy"] - p["radius"] * py, z


def score(lines: np.ndarray, points: np.ndarray, p: dict) -> float:
    x, y, z = project(points, p)
    x = x / FIT_SCALE
    y = y / FIT_SCALE
    h, w = lines.shape
    keep = (z >= MIN_FACING) & (x >= 0) & (y >= 0) & (x < w - 1) & (y < h - 1)
    if keep.sum() < 200:
        return 0.0
    values = ndimage.map_coordinates(lines, [y[keep], x[keep]], order=1)
    return float(values.mean())


def refine(lines: np.ndarray, points: np.ndarray, p: dict, steps: dict, rounds: int = 6) -> dict:
    """Coordinate search: try +/- each step, keep improvements, halve the steps each round."""
    best = dict(p)
    best_score = score(lines, points, best)
    steps = dict(steps)
    for _ in range(rounds):
        improved = True
        while improved:
            improved = False
            for key, step in steps.items():
                for sign in (1.0, -1.0):
                    trial = dict(best)
                    trial[key] = best[key] + sign * step
                    s = score(lines, points, trial)
                    if s > best_score:
                        best, best_score = trial, s
                        improved = True
        steps = {key: step / 2.0 for key, step in steps.items()}
    best["score"] = round(best_score, 3)
    return best


def frame_number(path: str) -> int:
    match = re.search(r"\.(\d{5})\.png$", path)
    if not match:
        raise SystemExit(f"co2_calibrate: cannot read a frame number from {path}")
    return int(match.group(1))


def steady_lon(frame: int) -> float:
    lon = REFERENCE_LON + DEGREES_PER_FRAME * (frame - REFERENCE_FRAME)
    return (lon + 180.0) % 360.0 - 180.0


def fit(paths: list[str]) -> None:
    points = coastline_points()
    first = paths[0]
    start = dict(START, center_lon=steady_lon(frame_number(first)))
    camera = refine(
        line_strength(first),
        points,
        start,
        {"cx": 8.0, "cy": 8.0, "radius": 16.0, "center_lat": 1.0, "roll": 1.0, "distance": 0.4, "center_lon": 1.0},
    )
    print(f"# camera from {first}: score {camera['score']}", file=sys.stderr)
    for path in paths:
        p = dict(camera, center_lon=steady_lon(frame_number(path)))
        p.pop("score", None)
        lines = line_strength(path)
        # A coarse sweep first, in case the turn is not perfectly steady.
        sweep = max(
            (score(lines, points, dict(p, center_lon=p["center_lon"] + off)), off)
            for off in np.arange(-20.0, 20.01, 0.5)
        )
        p["center_lon"] += sweep[1]
        p = refine(lines, points, p, {"center_lon": 0.25}, rounds=5)
        out = {key: round(p[key], 2) for key in ("cx", "cy", "radius", "center_lon", "center_lat", "roll", "distance")}
        out["frame"] = frame_number(path)
        out["score"] = p["score"]
        out["steady_lon"] = round(steady_lon(frame_number(path)), 2)
        print(json.dumps(out), flush=True)


def overlay(path: str, out_path: str, params: str) -> None:
    p = json.loads(params)
    image = Image.open(path).convert("RGB")
    rgb = np.asarray(image).copy()
    x, y, z = project(coastline_points(), p)
    keep = (z >= max(0.2, 1 / p["distance"])) & (x >= 0) & (y >= 0) & (x < rgb.shape[1]) & (y < rgb.shape[0])
    rgb[y[keep].astype(int), x[keep].astype(int)] = (255, 0, 0)
    Image.fromarray(rgb).resize((rgb.shape[1] // 3, rgb.shape[0] // 3), Image.BOX).save(out_path)


def main(argv: list[str]) -> None:
    if len(argv) >= 2 and argv[0] == "fit":
        fit(argv[1:])
    elif len(argv) == 4 and argv[0] == "overlay":
        overlay(argv[1], argv[2], argv[3])
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
