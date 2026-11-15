"""Tests for the timeline instants written into prep-config.json (timeline_config.py)."""

import json

import pytest

from timeline_config import (
    co2_frame_time,
    co2_instants,
    interpolate_center_lon,
    iso,
    lightning_instants,
    main,
    smoke_instants,
)


def test_smoke_is_seven_days_hour_by_hour():
    instants = smoke_instants()
    assert len(instants) == 168
    assert instants[0]["date"] == "Sep 1, 2026 00:30 UTC"
    assert instants[0]["time"] == "2026-09-01T00:30:00Z"
    assert instants[0]["views"][0]["file"] == "geoscf/pm25_20260901_0030.png"
    assert instants[-1]["time"] == "2026-09-07T23:30:00Z"
    assert instants[-1]["views"][0]["file"] == "geoscf/pm25_20260907_2330.png"


def test_co2_frames_are_model_hours_from_14_january_2020():
    assert iso(co2_frame_time(1)) == "2020-01-14T22:00:00Z"
    assert iso(co2_frame_time(939)) == "2020-02-23T00:00:00Z"
    assert iso(co2_frame_time(1005)) == "2020-02-25T18:00:00Z"


def test_center_lon_is_linear_between_the_fitted_frames():
    fitted = {939: -49.74, 945: -50.94}
    assert interpolate_center_lon(939, fitted) == -49.74
    assert interpolate_center_lon(942, fitted) == -50.34
    with pytest.raises(ValueError):
        interpolate_center_lon(950, fitted)


def fitted_instant(frame: int, lon: float) -> dict:
    projection = {"type": "orthographic", "cx": 1, "cy": 1, "radius": 1, "center_lon": lon, "center_lat": 0.4}
    fallback = {"file": "5196/co2_orbit.00001.png", "fallback": True, "projection": dict(projection, center_lon=139.52)}
    return {"date": str(frame), "views": [{"file": f"5196/co2_orbit.{frame:05d}.png", "projection": projection}, fallback]}


def test_co2_lists_every_frame_and_keeps_the_fallback_views():
    fitted = [fitted_instant(939 + 6 * k, -49.74 - 1.2 * k) for k in range(12)]
    instants = co2_instants(fitted)
    assert len(instants) == 67
    assert instants[1]["views"][0]["file"] == "5196/co2_orbit.00940.png"
    assert instants[1]["views"][0]["projection"]["center_lon"] == -49.94
    assert instants[1]["views"][1]["fallback"] is True
    assert instants[-1]["time"] == "2020-02-25T18:00:00Z"


def test_lightning_is_monthly_from_january_2017_to_july_2023():
    instants = lightning_instants()
    assert len(instants) == 79
    assert instants[0] == {
        "date": "Jan 2017",
        "time": "2017-01-01T00:00:00Z",
        "views": [{"file": "5011/months/lightning_2017_01.png", "projection": instants[0]["views"][0]["projection"]}],
    }
    assert instants[-1]["date"] == "Jul 2023"


def test_main_rewrites_only_the_three_timed_layers(tmp_path):
    def layer(layer_id, instants, grid='{ "region": [10, 10] }'):
        return f"""    {{
      "id": "{layer_id}",
      "title": "T",
      "grid": {grid},
      "value": {{ "method": "brightness" }},
      "instants": [
{instants}
      ]
    }}"""

    one = '        { "date": "x", "views": [ { "file": "a.png", "projection": { "type": "equirect" } } ] }'
    co2 = ",\n".join("        " + json.dumps(fitted_instant(939 + 6 * k, -49.74 - 1.2 * k)) for k in range(12))
    text = "{\n  \"layers\": [\n" + ",\n".join([
        layer("forest", one), layer("smoke", one), layer("co2", co2), layer("lightning", one),
    ]) + "\n  ]\n}\n"
    path = tmp_path / "prep-config.json"
    path.write_text(text)

    assert main([str(path)]) == 0
    assert main([str(path)]) == 0  # running it twice gives the same file

    config = json.loads(path.read_text())
    by_id = {layer["id"]: layer for layer in config["layers"]}
    assert by_id["forest"]["instants"] == json.loads("[" + one + "]")
    assert "cadence" not in by_id["forest"]
    assert (len(by_id["smoke"]["instants"]), by_id["smoke"]["cadence"]) == (168, "PT1H")
    assert by_id["smoke"]["grid"] == {"region": [10, 10], "global": [720, 360]}
    assert (len(by_id["co2"]["instants"]), by_id["co2"]["cadence"]) == (67, "PT1H")
    assert (len(by_id["lightning"]["instants"]), by_id["lightning"]["cadence"]) == (79, "P1M")
    assert "global" not in by_id["lightning"]["grid"]
