"""Tests for the timeline instants written into prep-config.json (timeline_config.py)."""

import json

from timeline_config import co2_instants, lightning_instants, main, smoke_instants


def test_smoke_is_seven_days_hour_by_hour():
    instants = smoke_instants()
    assert len(instants) == 168
    assert instants[0]["date"] == "Sep 1, 2026 00:30 UTC"
    assert instants[0]["time"] == "2026-09-01T00:30:00Z"
    assert instants[0]["views"][0]["file"] == "geoscf/pm25_20260901_0030.png"
    assert instants[-1]["time"] == "2026-09-07T23:30:00Z"
    assert instants[-1]["views"][0]["file"] == "geoscf/pm25_20260907_2330.png"


def test_co2_is_every_day_of_2020():
    instants = co2_instants()
    assert len(instants) == 366
    assert instants[0] == {
        "date": "Jan 1, 2020",
        "time": "2020-01-01T00:00:00Z",
        "views": [{"file": "oco2/xco2_20200101.png", "projection": instants[0]["views"][0]["projection"]}],
    }
    assert instants[59]["date"] == "Feb 29, 2020"
    assert instants[-1]["time"] == "2020-12-31T00:00:00Z"


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
    text = "{\n  \"layers\": [\n" + ",\n".join([
        layer("forest", one), layer("smoke", one), layer("co2", one), layer("lightning", one),
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
    assert (len(by_id["co2"]["instants"]), by_id["co2"]["cadence"]) == (366, "P1D")
    assert by_id["co2"]["grid"] == {"region": [72, 56], "global": [360, 180]}
    assert (len(by_id["lightning"]["instants"]), by_id["lightning"]["cadence"]) == (79, "P1M")
    assert "global" not in by_id["lightning"]["grid"]
