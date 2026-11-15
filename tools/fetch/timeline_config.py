"""Writes the timeline instants of smoke, CO2 and lightning into data/prep-config.json.

The timeline plays every layer at its own real cadence, so each of these layers
lists one instant per frame with its UTC start time (``time``) and the layer
names its spacing (``cadence``, ISO 8601):

- smoke: GEOS-CF hourly means, 1 to 7 September 2026 (168 instants, ``PT1H``),
  images ``geoscf/pm25_<yyyymmdd>_<hh>30.png`` from fetch-frames.sh;
- co2: OCO-2 GEOS daily XCO2, every day of 2020 (366 instants, ``P1D``),
  images ``oco2/xco2_<yyyymmdd>.png`` from fetch-oco2.sh;
- lightning: one image per month, January 2017 to July 2023 (79 instants,
  ``P1M``), from lightning_months.py.

Only the ``instants`` list, ``cadence`` and ``grid`` sizes of these three layers are
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
CO2_FIRST_DAY = datetime(2020, 1, 1, tzinfo=timezone.utc)
CO2_DAYS = 366  # 2020 is a leap year
LIGHTNING_FIRST = (2017, 1)
LIGHTNING_LAST = (2023, 7)

# Grid sizes of the layers with many instants: the browser holds every instant in
# memory. Smoke keeps 0.5 degree on the planet; CO2 (a smooth field, 0.5 x 0.625
# degree at the source) is 1 degree on the planet and its own 0.5 degree in the Amazon.
GRID_SIZES = {"smoke": {"global": [720, 360]}, "co2": {"global": [360, 180], "region": [72, 56]}}


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


def day_label(moment: datetime) -> str:
    """Readable day, e.g. "Jan 1, 2020"."""
    return f"{MONTHS[moment.month - 1]} {moment.day}, {moment.year}"


def co2_instants() -> list[dict]:
    instants = []
    for day in range(CO2_DAYS):
        moment = CO2_FIRST_DAY + timedelta(days=day)
        file = f"oco2/xco2_{moment:%Y%m%d}.png"
        instants.append({"date": day_label(moment), "time": iso(moment), "views": [{"file": file, "projection": EQUIRECT}]})
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
    if layer_id in GRID_SIZES:
        block = re.sub(r'"grid": \{[^}]*\}', lambda m: _with_sizes(m.group(0), GRID_SIZES[layer_id]), block, count=1)
    return text[:start] + block + text[end:]


def _with_sizes(grid: str, sizes: dict[str, list[int]]) -> str:
    current = json.loads(grid.split(":", 1)[1])
    current.update(sizes)
    return '"grid": ' + compact(current)


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    path = Path(argv[0])
    text = path.read_text(encoding="utf-8")
    text = rewrite_layer(text, "smoke", smoke_instants(), "PT1H")
    text = rewrite_layer(text, "co2", co2_instants(), "P1D")
    text = rewrite_layer(text, "lightning", lightning_instants(), "P1M")
    json.loads(text)  # still valid JSON
    path.write_text(text, encoding="utf-8")
    for layer in json.loads(text)["layers"]:
        print(f"{layer['id']}: {len(layer['instants'])} instants, cadence {layer.get('cadence', '-')}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
