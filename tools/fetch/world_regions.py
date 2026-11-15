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

The outlines are simplified for the browser (Douglas-Peucker, TOLERANCE degrees)
without breaking shared borders: every ring is cut into arcs where three or more
borders meet, and each arc is simplified once and reused by every country that
has it, so neighbours keep exactly the same edge and no gaps or overlaps appear
inside a region. Rings smaller than MIN_RING_AREA square degrees are dropped, and
coordinates are rounded to 0.01 degree; a small ring that shares a border is kept (Liechtenstein, San Marino), so it leaves no gap. Each region keeps all its rings (outer rings and holes
together; the app fills them with the even-odd rule) and the rectangle the app
flies to (see focus_bbox).

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


def read_ring(coordinates: Any) -> Ring | None:
    """A GeoJSON ring as points, without its closing point; None when it has fewer than three."""
    if not isinstance(coordinates, (list, tuple)):
        raise RegionsError(f"a ring is not a list of points: {coordinates!r:.60}")
    points: Ring = []
    for pair in coordinates:
        if not isinstance(pair, (list, tuple)) or len(pair) < 2:
            raise RegionsError(f"a point is not a [longitude, latitude] pair: {pair!r:.60}")
        try:
            lon, lat = float(pair[0]), float(pair[1])
        except (TypeError, ValueError) as error:
            raise RegionsError(f"a point is not numeric: {pair!r:.60}") from error
        points.append((lon, lat))
    if len(points) > 1 and points[0] == points[-1]:
        points = points[:-1]
    return points if len(points) >= 3 else None


def junctions(rings: Iterable[Ring]) -> set[Point]:
    """Points where three or more borders meet (more than two distinct neighbours over all rings)."""
    neighbours: dict[Point, set[Point]] = {}
    for ring in rings:
        count = len(ring)
        for index, point in enumerate(ring):
            near = neighbours.setdefault(point, set())
            near.add(ring[index - 1])
            near.add(ring[(index + 1) % count])
    return {point for point, near in neighbours.items() if len(near) > 2}


def simplify_shared(ring: Ring, fixed: set[Point], cache: dict[tuple[Point, ...], Ring]) -> Ring:
    """
    Simplifies a closed ring so that a border shared with other rings is simplified
    the same way in all of them: the ring is cut into arcs at the junction points,
    and each arc (in whichever direction it is met) is simplified once and reused.
    A ring without junctions is one arc starting at its smallest point, so two rings
    with the same points (an enclave and the hole around it) still match.
    """
    cuts = [index for index, point in enumerate(ring) if point in fixed]
    start = cuts[0] if cuts else ring.index(min(ring))
    rotated = ring[start:] + ring[:start]
    cut_points = [index for index, point in enumerate(rotated) if point in fixed] or [0]
    result: Ring = []
    bounds = cut_points + [len(rotated)]
    for first, last in zip(bounds, bounds[1:]):
        arc = tuple(rotated[first:last] + [rotated[last % len(rotated)]])
        backwards = arc[::-1]
        key = min(arc, backwards)
        if key not in cache:
            cache[key] = simplify(list(key), TOLERANCE)
        simplified = cache[key] if key == arc else cache[key][::-1]
        result.extend(simplified[:-1])
    return result


def round_ring(ring: Ring) -> Ring | None:
    """Coordinates rounded to 0.01 degree, repeated points removed; None when fewer than three are left."""
    rounded: Ring = []
    for lon, lat in ring:
        point = (round(lon, 2), round(lat, 2))
        if not rounded or rounded[-1] != point:
            rounded.append(point)
    if len(rounded) > 1 and rounded[0] == rounded[-1]:
        rounded.pop()
    return rounded if len(rounded) >= 3 else None


def polygons_of(geometry: Any) -> list[list[Any]]:
    if not isinstance(geometry, dict):
        raise RegionsError(f"a geometry is not an object: {geometry!r:.60}")
    kind = geometry.get("type")
    coordinates = geometry.get("coordinates")
    if not isinstance(coordinates, list):
        raise RegionsError(f"a {kind} geometry has no coordinates list")
    if kind == "Polygon":
        return [coordinates]
    if kind == "MultiPolygon":
        return list(coordinates)
    raise RegionsError(f"unsupported geometry type {kind!r}")


def bbox_of(rings: list[Ring]) -> dict[str, float]:
    lons = [lon for ring in rings for lon, _ in ring]
    lats = [lat for ring in rings for _, lat in ring]
    return {"west": min(lons), "south": min(lats), "east": max(lons), "north": max(lats)}


def focus_bbox(outer_rings: list[Ring]) -> dict[str, float]:
    """
    Rectangle the app flies to, from the region's outer rings only (holes are not
    land of the region). Rings under MAJOR_SHARE of the area do not stretch it; a
    region wider than half the planet uses its largest ring, and when even that is
    wider (Antarctica), a window half the planet wide centred on that ring.
    """
    areas = [ring_area(ring) for ring in outer_rings]
    total = sum(areas)
    major = [ring for ring, area in zip(outer_rings, areas) if area >= total * MAJOR_SHARE]
    box = bbox_of(major)
    if box["east"] - box["west"] > 180:
        largest = outer_rings[areas.index(max(areas))]
        box = bbox_of([largest])
        if box["east"] - box["west"] > 180:
            centre = sum(lon for lon, _ in largest) / len(largest)
            west = min(90.0, max(-180.0, centre - 90.0))
            box = {**box, "west": round(west, 2), "east": round(west + 180.0, 2)}
    return box


def build_regions(countries: Any) -> list[dict[str, Any]]:
    features = countries.get("features") if isinstance(countries, dict) else None
    if not isinstance(features, list) or not features:
        raise RegionsError("the countries file has no features")
    # Every ring of every kept country, with its region and whether it is a hole.
    parts: list[tuple[str, Ring, bool, Any]] = []
    for feature in features:
        if not isinstance(feature, dict):
            continue
        properties = feature.get("properties") if isinstance(feature.get("properties"), dict) else {}
        name = region_name(properties)
        if name is None or not feature.get("geometry"):
            continue
        for polygon in polygons_of(feature["geometry"]):
            for position, coordinates in enumerate(polygon):
                ring = read_ring(coordinates)
                if ring:
                    parts.append((name, ring, position > 0, properties.get("ADM0_A3")))
    # Shared borders are simplified once, so neighbours keep matching edges.
    fixed = junctions(ring for _, ring, _, _ in parts)
    # Points used by more than one ring: a small ring that touches others (Liechtenstein,
    # San Marino and the hole Italy keeps for it) must stay, or it leaves a gap.
    uses: dict[Point, int] = {}
    for _, ring, _, _ in parts:
        for point in set(ring):
            uses[point] = uses.get(point, 0) + 1
    cache: dict[tuple[Point, ...], Ring] = {}
    grouped: dict[str, list[tuple[Ring, bool]]] = {}
    for name, ring, hole, code in parts:
        isolated = all(uses[point] == 1 for point in ring)
        if isolated and ring_area(ring) < MIN_RING_AREA:
            continue
        cleaned = round_ring(simplify_shared(ring, fixed, cache))
        if cleaned:
            grouped.setdefault(overseas_region(code, cleaned) or name, []).append((cleaned, hole))
    regions = []
    for name in sorted(grouped):
        rings = grouped[name]
        outer = [ring for ring, hole in rings if not hole]
        if not outer:
            continue
        regions.append(
            {
                "id": slug(name),
                "name": name,
                "bbox": focus_bbox(outer),
                "rings": [[[lon, lat] for lon, lat in ring] for ring, _ in rings],
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
    except (OSError, ValueError, KeyError, TypeError, AttributeError, RegionsError) as error:
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
