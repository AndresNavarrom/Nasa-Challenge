"""Natural Earth countries -> the world regions of the app (web/public/data/regions.json).

Every country of Natural Earth's 1:50m admin-0 file (public domain) is placed in
its UN subregion (the SUBREGION field), and the countries of each subregion are
merged into one region, so the whole world is divided into about 22 regions of a
similar size to the Amazon view. Three changes keep them usable on the planet:

- Russia is a region of its own: inside Eastern Europe it would make one region
  reach from Poland to the Pacific.
- Melanesia, Micronesia and Polynesia become one region, "Pacific Islands": on
  their own their islands are too small to point at.
- The few islands listed as "Seven seas (open ocean)" are left out.
- France's overseas departments are drawn with the region they lie in (French
  Guiana with South America, Guadeloupe and Martinique with the Caribbean,
  Reunion and Mayotte with Eastern Africa), not with Western Europe.

The outlines are simplified for the browser (Douglas-Peucker, TOLERANCE degrees),
rings smaller than MIN_RING_AREA square degrees are dropped, and coordinates are
rounded to 0.01 degree. Each region keeps all its rings (outer rings and holes
together; the app fills them with the even-odd rule) and the rectangle the app
flies to: the rectangle around its larger rings (at least MAJOR_SHARE of its
area), or around its largest ring when that would be wider than half the
planet (regions cut by the 180 degree meridian).

Usage: python world_regions.py COUNTRIES.geojson OUTPUT.json
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any, Iterable

TOLERANCE = 0.05  # degrees
MIN_RING_AREA = 0.02  # square degrees
MAJOR_SHARE = 0.02  # rings smaller than this share of the region's area do not set its rectangle

RENAMED = {
    "South-Eastern Asia": "Southeast Asia",
    "Middle Africa": "Central Africa",
    "Northern America": "North America",
    "Melanesia": "Pacific Islands",
    "Micronesia": "Pacific Islands",
    "Polynesia": "Pacific Islands",
}
LEFT_OUT = {"Seven seas (open ocean)"}
OWN_REGION = {"RUS": "Russia"}


def overseas_region(code: Any, ring: "Ring") -> str | None:
    """Region of a far-away part of a country (see the module description), or None to keep the country's."""
    if code != "FRA":
        return None
    lon = sum(point[0] for point in ring) / len(ring)
    lat = sum(point[1] for point in ring) / len(ring)
    if lon < -30:
        return "South America" if lat < 9 else "Caribbean"
    if lat < -5:
        return "Eastern Africa"
    return None

Point = tuple[float, float]
Ring = list[Point]


class RegionsError(Exception):
    """A problem with the countries file, with a message for the person running the script."""


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def region_name(properties: dict[str, Any]) -> str | None:
    """Region of a country, or None when it is left out."""
    code = properties.get("ADM0_A3")
    if code in OWN_REGION:
        return OWN_REGION[code]
    subregion = properties.get("SUBREGION")
    if not isinstance(subregion, str) or not subregion or subregion in LEFT_OUT:
        return None
    return RENAMED.get(subregion, subregion)


def ring_area(ring: Ring) -> float:
    """Area in square degrees (shoelace formula, unsigned)."""
    total = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        total += x1 * y2 - x2 * y1
    return abs(total) / 2


def _distance_to_segment(p: Point, a: Point, b: Point) -> float:
    (px, py), (ax, ay), (bx, by) = p, a, b
    dx, dy = bx - ax, by - ay
    length = dx * dx + dy * dy
    if length == 0:
        return ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length))
    return ((px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2) ** 0.5


def simplify(points: Ring, tolerance: float) -> Ring:
    """Douglas-Peucker on an open line (iterative, so long coasts do not hit the recursion limit)."""
    if len(points) < 3:
        return list(points)
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        farthest, index = 0.0, -1
        for i in range(first + 1, last):
            distance = _distance_to_segment(points[i], points[first], points[last])
            if distance > farthest:
                farthest, index = distance, i
        if index >= 0 and farthest > tolerance:
            keep[index] = True
            stack.append((first, index))
            stack.append((index, last))
    return [point for point, kept in zip(points, keep) if kept]


def clean_ring(coordinates: Iterable[Iterable[float]]) -> Ring | None:
    """A GeoJSON ring simplified and rounded, without its closing point; None when too small."""
    points: Ring = []
    for pair in coordinates:
        lon, lat = (float(value) for value in list(pair)[:2])
        points.append((lon, lat))
    if len(points) > 1 and points[0] == points[-1]:
        points = points[:-1]
    if len(points) < 3 or ring_area(points) < MIN_RING_AREA:
        return None
    # Simplify as a closed line: split at the point farthest from the first.
    far = max(range(len(points)), key=lambda i: (points[i][0] - points[0][0]) ** 2 + (points[i][1] - points[0][1]) ** 2)
    simplified = simplify(points[: far + 1], TOLERANCE)[:-1] + simplify(points[far:] + points[:1], TOLERANCE)[:-1]
    rounded: Ring = []
    for lon, lat in simplified:
        point = (round(lon, 2), round(lat, 2))
        if not rounded or rounded[-1] != point:
            rounded.append(point)
    if len(rounded) > 1 and rounded[0] == rounded[-1]:
        rounded.pop()
    return rounded if len(rounded) >= 3 else None


def polygons_of(geometry: dict[str, Any]) -> list[list[Any]]:
    kind = geometry.get("type")
    if kind == "Polygon":
        return [geometry["coordinates"]]
    if kind == "MultiPolygon":
        return list(geometry["coordinates"])
    raise RegionsError(f"unsupported geometry type {kind!r}")


def bbox_of(rings: list[Ring]) -> dict[str, float]:
    lons = [lon for ring in rings for lon, _ in ring]
    lats = [lat for ring in rings for _, lat in ring]
    return {"west": min(lons), "south": min(lats), "east": max(lons), "north": max(lats)}


def focus_bbox(rings: list[Ring]) -> dict[str, float]:
    """Rectangle the app flies to (see the module description)."""
    areas = [ring_area(ring) for ring in rings]
    total = sum(areas)
    major = [ring for ring, area in zip(rings, areas) if area >= total * MAJOR_SHARE]
    box = bbox_of(major)
    if box["east"] - box["west"] > 180:
        box = bbox_of([rings[areas.index(max(areas))]])
    return box


def build_regions(countries: dict[str, Any]) -> list[dict[str, Any]]:
    features = countries.get("features")
    if not isinstance(features, list) or not features:
        raise RegionsError("the countries file has no features")
    grouped: dict[str, list[Ring]] = {}
    for feature in features:
        name = region_name(feature.get("properties") or {})
        if name is None or not feature.get("geometry"):
            continue
        code = (feature.get("properties") or {}).get("ADM0_A3")
        for polygon in polygons_of(feature["geometry"]):
            for coordinates in polygon:
                ring = clean_ring(coordinates)
                if ring:
                    grouped.setdefault(overseas_region(code, ring) or name, []).append(ring)
    regions = []
    for name in sorted(grouped):
        rings = grouped[name]
        if not rings:
            continue
        regions.append(
            {
                "id": slug(name),
                "name": name,
                "bbox": focus_bbox(rings),
                "rings": [[[lon, lat] for lon, lat in ring] for ring in rings],
            }
        )
    if not regions:
        raise RegionsError("no region was built from the countries file")
    return regions


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    source, target = Path(argv[0]), Path(argv[1])
    try:
        countries = json.loads(source.read_text(encoding="utf-8"))
        regions = build_regions(countries)
    except (OSError, ValueError, KeyError, RegionsError) as error:
        print(f"world_regions: {error}", file=sys.stderr)
        return 1
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_name(target.name + ".part")
    partial.write_text(json.dumps({"source": "Natural Earth 1:50m admin-0 countries, UN subregions", "regions": regions}, separators=(",", ":")), encoding="utf-8")
    partial.replace(target)
    points = sum(len(ring) for region in regions for ring in region["rings"])
    print(f"  json   {target} ({len(regions)} regions, {points} points)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
