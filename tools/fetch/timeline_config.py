"""Writes the timeline instants of smoke, CO2 and lightning into data/prep-config.json.

The timeline plays every layer at its own real cadence, so each of these layers
lists one instant per frame with its UTC start time (``time``) and the layer
names its spacing (``cadence``, ISO 8601):

- smoke: GEOS-CF hourly means, 1 to 7 September 2026 (168 instants, ``PT1H``),
  images ``geoscf/pm25_<yyyymmdd>_<hh>30.png`` from fetch-frames.sh;
- co2: every frame of the SVS 5196 orbit while South America faces the camera,
  frames 00939 to 01005, one model hour each (67 instants, ``PT1H``). Only
  ``center_lon`` of the globe changes from frame to frame (the Earth turns under
  a fixed camera); it is interpolated linearly between the frames already
  fitted to real coastlines (co2_calibrate.py), every sixth one. The five fixed
  fallback views stay as they are;
- lightning: one image per month, January 2017 to July 2023 (79 instants,
  ``P1M``), from lightning_months.py.

Only the ``instants`` list, ``cadence`` and ``grid`` of these three layers are
rewritten; the rest of the file keeps its text and layout. Run it again after
changing the periods below.

Usage: python timeline_config.py data/prep-config.json
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

EQUIRECT = {"type": "equirect", "west": -180, "south": -90, "east": 180, "north": 90}
MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

SMOKE_FIRST_DAY = datetime(2026, 9, 1, tzinfo=timezone.utc)
SMOKE_DAYS = 7
CO2_FIRST_FRAME, CO2_LAST_FRAME = 939, 1005
# Frame 00001 of the SVS 5196 orbit is 14 January 2020 22:00 UTC; one model hour per frame.
CO2_FRAME_ONE = datetime(2020, 1, 14, 22, tzinfo=timezone.utc)
LIGHTNING_FIRST = (2017, 1)
LIGHTNING_LAST = (2023, 7)

# Global grids of the layers with many instants are kept at 720 x 360 (0.5 degree):
# smoke and CO2 are smooth fields and the browser holds every instant in memory.
GLOBAL_GRID = {"smoke": [720, 360], "co2": [720, 360]}


def iso(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


def hour_label(moment: datetime) -> str:
    """Readable hour, e.g. "Sep 1, 2026 00:30 UTC"."""
    return f"{MONTHS[moment.month - 1]} {moment.day}, {moment.year} {moment:%H:%M} UTC"


def smoke_instants() -> list[dict]:
    instants = []
    for hour in range(SMOKE_DAYS * 24):
        moment = SMOKE_FIRST_DAY + timedelta(hours=hour, minutes=30)
        file = f"geoscf/pm25_{moment:%Y%m%d}_{moment:%H}30.png"
        instants.append({"date": hour_label(moment), "time": iso(moment), "views": [{"file": file, "projection": EQUIRECT}]})
    return instants


def co2_frame_time(frame: int) -> datetime:
    return CO2_FRAME_ONE + timedelta(hours=frame - 1)


def interpolate_center_lon(frame: int, fitted: dict[int, float]) -> float:
    """``center_lon`` of a frame, linear between the nearest fitted frames (rounded to 0.01 degree)."""
    if frame in fitted:
        return fitted[frame]
    known = sorted(fitted)
    if frame < known[0] or frame > known[-1]:
        raise ValueError(f"frame {frame} lies outside the fitted frames {known[0]}..{known[-1]}")
    after = next(k for k in known if k > frame)
    before = max(k for k in known if k < frame)
    share = (frame - before) / (after - before)
    return round(fitted[before] + (fitted[after] - fitted[before]) * share, 2)


def co2_instants(current: list[dict]) -> list[dict]:
    """One instant per orbit frame, built on the fitted instants already in the file."""
    pattern = re.compile(r"co2_orbit\.(\d{5})\.png$")
    fitted: dict[int, float] = {}
    template: dict | None = None
    for instant in current:
        main = instant["views"][0]
        match = pattern.search(main["file"])
        if not match:
            raise ValueError(f"CO2 instant {instant['date']!r}: first view {main['file']!r} is not an orbit frame")
        fitted[int(match.group(1))] = main["projection"]["center_lon"]
        template = template or instant
    if template is None:
        raise ValueError("the CO2 layer lists no instant to start from")
    fallbacks = template["views"][1:]
    instants = []
    for frame in range(CO2_FIRST_FRAME, CO2_LAST_FRAME + 1):
        projection = dict(template["views"][0]["projection"], center_lon=interpolate_center_lon(frame, fitted))
        moment = co2_frame_time(frame)
        main = {"file": f"5196/co2_orbit.{frame:05d}.png", "projection": projection}
        instants.append({"date": hour_label(moment), "time": iso(moment), "views": [main, *fallbacks]})
    return instants


def lightning_instants() -> list[dict]:
    instants = []
    year, month = LIGHTNING_FIRST
    while (year, month) <= LIGHTNING_LAST:
        file = f"5011/months/lightning_{year}_{month:02d}.png"
        instants.append({
            "date": f"{MONTHS[month - 1]} {year}",
            "time": f"{year:04d}-{month:02d}-01T00:00:00Z",
            "views": [{"file": file, "projection": EQUIRECT}],
        })
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return instants


def compact(value) -> str:
    """JSON on one line, with spaces inside braces like the rest of the file."""
    if isinstance(value, dict):
        return "{ " + ", ".join(f"{json.dumps(k)}: {compact(v)}" for k, v in value.items()) + " }"
    if isinstance(value, list):
        return "[ " + ", ".join(compact(v) for v in value) + " ]"
    return json.dumps(value, ensure_ascii=False)


def layer_span(text: str, layer_id: str) -> tuple[int, int]:
    """Start and end of the layer object whose id is ``layer_id`` in the file text."""
    start = text.index(f'"id": "{layer_id}"')
    start = text.rindex("{", 0, start)
    depth, index, in_string = 0, start, False
    while index < len(text):
        char = text[index]
        if in_string:
            if char == "\\":
                index += 1
            elif char == '"':
                in_string = False
        elif char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return start, index + 1
        index += 1
    raise ValueError(f"layer {layer_id!r} is not closed")


def rewrite_layer(text: str, layer_id: str, instants: list[dict], cadence: str) -> str:
    start, end = layer_span(text, layer_id)
    block = text[start:end]
    indent = re.search(r'\n(\s*)"id"', block).group(1)
    lines = ",\n".join(f"{indent}  {compact(instant)}" for instant in instants)
    block = re.sub(r'"instants": \[.*\]', lambda _: f'"instants": [\n{lines}\n{indent}]', block, flags=re.S)
    block = re.sub(rf'\n{indent}"cadence": "[^"]*",', "", block)
    block = block.replace(f'\n{indent}"value":', f'\n{indent}"cadence": "{cadence}",\n{indent}"value":', 1)
    if layer_id in GLOBAL_GRID:
        width, height = GLOBAL_GRID[layer_id]
        block = re.sub(r'"grid": \{[^}]*\}', lambda m: _with_global(m.group(0), width, height), block, count=1)
    return text[:start] + block + text[end:]


def _with_global(grid: str, width: int, height: int) -> str:
    sizes = json.loads(grid.split(":", 1)[1])
    sizes["global"] = [width, height]
    return '"grid": ' + compact(sizes)


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    path = Path(argv[0])
    text = path.read_text(encoding="utf-8")
    config = json.loads(text)
    current_co2 = next(layer for layer in config["layers"] if layer["id"] == "co2")["instants"]
    # Fitted frames are every sixth one; a file already rewritten lists every frame,
    # and its interpolated values are recomputed from the fitted ones only.
    fitted_co2 = [i for i in current_co2 if (int(re.search(r"(\d{5})", i["views"][0]["file"]).group(1)) - CO2_FIRST_FRAME) % 6 == 0]
    text = rewrite_layer(text, "smoke", smoke_instants(), "PT1H")
    text = rewrite_layer(text, "co2", co2_instants(fitted_co2), "PT1H")
    text = rewrite_layer(text, "lightning", lightning_instants(), "P1M")
    json.loads(text)  # still valid JSON
    path.write_text(text, encoding="utf-8")
    for layer in json.loads(text)["layers"]:
        print(f"{layer['id']}: {len(layer['instants'])} instants, cadence {layer.get('cadence', '-')}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
