"""Tests for the world regions (world_regions.py). Small synthetic countries only."""

import json

import pytest

from world_regions import (
    RegionsError,
    build_regions,
    clean_ring,
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


def test_rings_are_simplified_rounded_and_tiny_ones_dropped():
    # A straight edge with a point barely off it: the point goes.
    assert simplify([(0, 0), (1, 0.001), (2, 0)], 0.05) == [(0, 0), (2, 0)]
    ring = clean_ring(square(10.123, 20.456, 5))
    assert ring == [(10.12, 20.46), (15.12, 20.46), (15.12, 25.46), (10.12, 25.46)]
    assert clean_ring(square(0, 0, 0.1)) is None  # 0.01 square degrees: too small
    assert clean_ring([[0, 0], [1, 1]]) is None


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
