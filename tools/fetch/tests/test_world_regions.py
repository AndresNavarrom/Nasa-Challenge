"""Tests for the world regions (world_regions.py). Small synthetic countries only."""

import json

import pytest

from world_regions import (
    RegionsError,
    build_regions,
    junctions,
    read_ring,
    round_ring,
    simplify_shared,
    focus_bbox,
    main,
    region_name,
    simplify,
    slug,
)


def square(west, south, size, closed=True):
    ring = [[west, south], [west + size, south], [west + size, south + size], [west, south + size]]
    return ring + [ring[0]] if closed else ring


def country(code, subregion, *polygons):
    geometry = {"type": "MultiPolygon", "coordinates": [[ring] for ring in polygons]}
    return {"type": "Feature", "properties": {"ADM0_A3": code, "SUBREGION": subregion}, "geometry": geometry}


def test_region_names_follow_the_un_subregions_with_the_three_changes():
    assert region_name({"ADM0_A3": "BRA", "SUBREGION": "South America"}) == "South America"
    assert region_name({"ADM0_A3": "RUS", "SUBREGION": "Eastern Europe"}) == "Russia"
    assert region_name({"ADM0_A3": "FJI", "SUBREGION": "Melanesia"}) == "Pacific Islands"
    assert region_name({"ADM0_A3": "WSM", "SUBREGION": "Polynesia"}) == "Pacific Islands"
    assert region_name({"ADM0_A3": "COD", "SUBREGION": "Middle Africa"}) == "Central Africa"
    assert region_name({"ADM0_A3": "ATF", "SUBREGION": "Seven seas (open ocean)"}) is None
    assert region_name({}) is None
    assert slug("Australia and New Zealand") == "australia-and-new-zealand"


def test_rings_are_read_rounded_and_short_ones_dropped():
    # A straight edge with a point barely off it: the point goes.
    assert simplify([(0, 0), (1, 0.001), (2, 0)], 0.05) == [(0, 0), (2, 0)]
    assert read_ring(square(10.123, 20.456, 5)) == [(10.123, 20.456), (15.123, 20.456), (15.123, 25.456), (10.123, 25.456)]
    assert round_ring([(10.123, 20.456), (15.123, 20.456), (15.124, 20.4561), (15.123, 25.456)]) == [
        (10.12, 20.46),
        (15.12, 20.46),
        (15.12, 25.46),
    ]
    assert read_ring([[0, 0], [1, 1]]) is None
    assert round_ring([(0.001, 0.001), (0.002, 0.002), (0.003, 0.001)]) is None


def wiggly_border():
    """A north-south border from (0, 0) to (0, 10) with small wiggles the simplification removes."""
    return [(0.0 + (0.01 if i % 2 else 0.0), float(i)) for i in range(11)]


def test_neighbours_keep_exactly_the_same_simplified_border():
    border = wiggly_border()
    west = [(-5.0, 0.0)] + border + [(-5.0, 10.0)]  # west country, border going north
    east = [(5.0, 10.0)] + border[::-1] + [(5.0, 0.0)]  # east country, the same border going south
    fixed = junctions([west, east])
    assert (0.0, 0.0) in fixed and (0.0, 10.0) in fixed
    cache = {}
    simple_west = simplify_shared(west, fixed, cache)
    simple_east = simplify_shared(east, fixed, cache)
    shared_west = [point for point in simple_west if point[0] in (0.0, 0.01)]
    shared_east = [point for point in simple_east if point[0] in (0.0, 0.01)]
    assert sorted(shared_west) == sorted(shared_east)
    assert len(shared_west) < len(border)  # the wiggles were simplified away


def test_tiny_countries_that_share_a_border_are_kept_but_tiny_islands_dropped():
    big = [[0, 0], [1, 0], [1, 0.1], [0.9, 0.1], [0.9, 0.2], [1, 0.2], [1, 1], [0, 1], [0, 0]]
    tiny = [[1, 0.1], [1.05, 0.1], [1.05, 0.2], [1, 0.2], [0.9, 0.2], [0.9, 0.1], [1, 0.1]]  # 0.015 sq deg, shares a border
    island = square(5, 5, 0.1)  # 0.01 sq deg, alone
    countries = {"features": [country("AAA", "Western Europe", big), country("LIE", "Western Europe", tiny), country("BBB", "Western Europe", island)]}
    rings = build_regions(countries)[0]["rings"]
    assert len(rings) == 2  # the big country and the tiny neighbour; the island is gone


def test_an_enclave_matches_the_hole_around_it():
    enclave = [(0.0, 0.0), (1.0, 0.03), (2.0, 0.0), (2.0, 2.0), (0.0, 2.0)]
    hole = enclave[::-1]
    fixed = junctions([enclave, hole])
    cache = {}
    assert sorted(simplify_shared(enclave, fixed, cache)) == sorted(simplify_shared(hole, fixed, cache))


def test_countries_are_merged_into_regions_with_a_rectangle_to_fly_to():
    countries = {
        "features": [
            country("BRA", "South America", square(-60, -20, 20)),
            country("ARG", "South America", square(-70, -50, 15)),
            country("RUS", "Eastern Europe", square(40, 50, 30)),
            country("POL", "Eastern Europe", square(15, 50, 8)),
            country("ATF", "Seven seas (open ocean)", square(70, -50, 2)),
        ]
    }
    regions = {region["id"]: region for region in build_regions(countries)}
    assert set(regions) == {"south-america", "russia", "eastern-europe"}
    assert len(regions["south-america"]["rings"]) == 2
    assert regions["south-america"]["bbox"] == {"west": -70, "south": -50, "east": -40, "north": 0}


def test_french_overseas_departments_go_with_the_region_they_lie_in():
    france = country("FRA", "Western Europe", square(-4, 43, 8), square(-54, 2, 3), square(-61.5, 15.5, 1), square(55, -21.5, 1))
    regions = {region["id"]: region for region in build_regions({"features": [france]})}
    assert regions["western-europe"]["bbox"] == {"west": -4, "south": 43, "east": 4, "north": 51}
    assert len(regions["south-america"]["rings"]) == 1  # French Guiana
    assert len(regions["caribbean"]["rings"]) == 1  # Guadeloupe
    assert len(regions["eastern-africa"]["rings"]) == 1  # Reunion


def test_holes_do_not_count_as_area_and_antarctica_gets_a_half_planet_window():
    # A country with a big hole (a lake) and a small island: the island still sets the rectangle.
    countries = {
        "features": [
            {
                "properties": {"ADM0_A3": "AAA", "SUBREGION": "Southern Africa"},
                "geometry": {
                    "type": "MultiPolygon",
                    "coordinates": [
                        [square(0, 0, 20), square(1, 1, 18)],  # outer ring and a hole almost as large
                        # An island of about 10 square degrees: 2.5 % of the land (400 + 10), but
                        # under 2 % if the hole (324) were counted as area too.
                        [square(30, 0, 3.2)],
                    ],
                },
            }
        ]
    }
    region = build_regions(countries)[0]
    assert region["bbox"]["east"] == 33.2  # the island counts: the hole did not inflate the total
    assert len(region["rings"]) == 3

    antarctica = [(-180.0, -90.0), (180.0, -90.0), (180.0, -65.0), (-180.0, -65.0)]
    box = focus_bbox([antarctica])
    assert box["east"] - box["west"] == 180
    assert box["south"] == -90.0 and box["north"] == -65.0


def test_regions_cut_by_the_180_meridian_fly_to_their_largest_ring():
    big = [(160.0, -10.0), (179.0, -10.0), (179.0, 0.0), (160.0, 0.0)]
    small_east = [(-179.0, -5.0), (-170.0, -5.0), (-170.0, 0.0), (-179.0, 0.0)]
    assert focus_bbox([big, small_east]) == {"west": 160.0, "south": -10.0, "east": 179.0, "north": 0.0}
    # Tiny rings do not stretch the rectangle.
    speck = [(0.0, 0.0), (0.2, 0.0), (0.2, 0.2), (0.0, 0.2)]
    assert focus_bbox([big, speck])["west"] == 160.0


def test_main_writes_the_regions_file(tmp_path, capsys):
    source = tmp_path / "countries.geojson"
    source.write_text(json.dumps({"features": [country("BRA", "South America", square(-60, -20, 20))]}))
    target = tmp_path / "regions.json"
    assert main([str(source), str(target)]) == 0
    written = json.loads(target.read_text())
    assert written["regions"][0]["name"] == "South America"
    assert "1 regions" in capsys.readouterr().out


def test_main_reports_bad_input(tmp_path, capsys):
    source = tmp_path / "empty.geojson"
    source.write_text(json.dumps({"features": []}))
    assert main([str(source), str(tmp_path / "out.json")]) == 1
    assert "no features" in capsys.readouterr().err
    assert main([]) == 2
    with pytest.raises(RegionsError):
        build_regions({"features": [{"properties": {"SUBREGION": "X"}, "geometry": {"type": "Point", "coordinates": [0, 0]}}]})


def test_malformed_countries_give_a_message_not_a_traceback(tmp_path, capsys):
    bad_coordinates = {"features": [{"properties": {"SUBREGION": "X"}, "geometry": {"type": "Polygon", "coordinates": None}}]}
    bad_point = {"features": [{"properties": {"SUBREGION": "X"}, "geometry": {"type": "Polygon", "coordinates": [[["a", 0], [1, 1], [2, 0]]]}}]}
    for number, content in enumerate([bad_coordinates, bad_point, ["not", "an", "object"]]):
        source = tmp_path / f"bad{number}.geojson"
        source.write_text(json.dumps(content))
        assert main([str(source), str(tmp_path / "out.json")]) == 1
        assert capsys.readouterr().err.startswith("world_regions: ")
    # A feature that is not an object is skipped, not fatal.
    countries = {"features": ["oops", country("BRA", "South America", square(-60, -20, 20))]}
    assert [region["id"] for region in build_regions(countries)] == ["south-america"]
