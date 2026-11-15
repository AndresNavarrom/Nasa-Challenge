#!/usr/bin/env python3
"""Validate and publish the clickable scenes for the web app.

The coordinates and metadata live in ``data/scenes/scenes.json``. This script:

1. validates each scene (unique id, coordinates inside the Amazon box, image and
   loop files present, gain in 0..1);
2. copies the images and loops to ``web/public/scenes/<id>/`` with stable names;
3. writes ``web/public/scenes/manifest.json`` for the app.

The source assets stay in ``data/scenes/``. The transition sound is the ARPA
sample prepared by ``tools/audio/prepare.py`` in ``web/public/audio``.

Run from the repository root::

    docker compose run --rm scenes-prep
    python tools/scenes/prepare.py --help
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SCENES = ROOT / "data" / "scenes" / "scenes.json"
DEFAULT_DATA_MANIFEST = ROOT / "web" / "public" / "data" / "manifest.json"
DEFAULT_OUT = ROOT / "web" / "public" / "scenes"
DEFAULT_TRANSITION = "audio/samples/arpa.ogg"


def fail(message: str) -> None:
    raise SystemExit(message)


def load_json(path: Path) -> dict:
    if not path.is_file():
        fail(f"File not found: {path}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        fail(f"Could not read {path}: {error}")


def require_type(value: object, kind, where: str):
    if not isinstance(value, kind):
        expected = kind.__name__ if hasattr(kind, "__name__") else "number"
        fail(f"{where}: expected {expected}, got {type(value).__name__}")
    return value


def amazon_bbox(data_manifest: dict) -> dict:
    try:
        bbox = data_manifest["region"]["bbox"]
        return {key: float(bbox[key]) for key in ("west", "south", "east", "north")}
    except (KeyError, TypeError, ValueError):
        fail("web/public/data/manifest.json has no valid region.bbox; run the data preparation first")


def destination_for(source: Path, scene_id: str, kind: str) -> tuple[Path, str]:
    suffix = source.suffix.lower()
    if kind == "image":
        if suffix in {".jpeg", ".jpg"}:
            suffix = ".jpg"
        elif suffix not in {".png", ".webp"}:
            fail(f"{source}: unsupported image format {suffix}")
    else:
        if suffix not in {".ogg", ".wav", ".mp3"}:
            fail(f"{source}: unsupported audio format {suffix}")
    filename = f"{scene_id}{suffix}"
    return Path(scene_id) / filename, filename


def prepare(scenes_path: Path, data_manifest_path: Path, out_dir: Path) -> int:
    scenes_doc = load_json(scenes_path)
    data_manifest = load_json(data_manifest_path)
    bbox = amazon_bbox(data_manifest)

    scenes = scenes_doc.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        fail("data/scenes/scenes.json has no non-empty \"scenes\" list")

    out_dir.mkdir(parents=True, exist_ok=True)
    expected: set[Path] = set()
    published = []
    seen_ids: set[str] = set()

    for index, raw in enumerate(scenes):
        where = f"scenes[{index}]"
        scene = require_type(raw, dict, where)
        scene_id = require_type(scene.get("id"), str, f"{where}.id").strip()
        if not scene_id or not all(ch.isalnum() or ch in "-_" for ch in scene_id):
            fail(f"{where}.id must contain only letters, digits, '-' and '_'")
        if scene_id in seen_ids:
            fail(f"{where}.id is duplicated: {scene_id}")
        seen_ids.add(scene_id)

        title = require_type(scene.get("title"), str, f"{where}.title").strip()
        description = require_type(scene.get("description"), str, f"{where}.description").strip()
        image_alt = require_type(scene.get("imageAlt", title), str, f"{where}.imageAlt")
        image_source = (scenes_path.parent / require_type(scene.get("image"), str, f"{where}.image")).resolve()
        loop_source = (scenes_path.parent / require_type(scene.get("loop"), str, f"{where}.loop")).resolve()
        if not image_source.is_file():
            fail(f"{where}.image does not exist: {image_source}")
        if not loop_source.is_file():
            fail(f"{where}.loop does not exist: {loop_source}")

        lon = float(require_type(scene.get("lon"), (int, float), f"{where}.lon"))
        lat = float(require_type(scene.get("lat"), (int, float), f"{where}.lat"))
        if not (bbox["west"] <= lon <= bbox["east"] and bbox["south"] <= lat <= bbox["north"]):
            fail(
                f"{where} ({scene_id}) is outside the Amazon box: "
                f"lon {lon} must be {bbox['west']}..{bbox['east']}, "
                f"lat {lat} must be {bbox['south']}..{bbox['north']}"
            )

        gain = float(scene.get("loopGain", 0.8))
        if not 0.0 <= gain <= 1.0:
            fail(f"{where}.loopGain must be between 0 and 1")

        image_rel, image_name = destination_for(image_source, scene_id, "image")
        loop_rel, loop_name = destination_for(loop_source, scene_id, "audio")
        image_dest = out_dir / image_rel
        loop_dest = out_dir / loop_rel
        image_dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(image_source, image_dest)
        shutil.copyfile(loop_source, loop_dest)
        expected.update({image_dest, loop_dest})

        published.append(
            {
                "id": scene_id,
                "title": title,
                "description": description,
                "lon": lon,
                "lat": lat,
                "image": f"scenes/{scene_id}/{image_name}",
                "imageAlt": image_alt,
                "loop": f"scenes/{scene_id}/{loop_name}",
                "loopGain": gain,
                "imageCredit": scene.get("imageCredit"),
                "audioCredit": scene.get("audioCredit"),
            }
        )
        print(f"  {scene_id}: ({lon:.3f}, {lat:.3f}) -> {image_name}, {loop_name}")

    transition = DEFAULT_TRANSITION
    if not (ROOT / "web" / "public" / transition).is_file():
        fail(f"Transition sound not found: web/public/{transition}; prepare the audio library first")

    manifest = {
        "version": 1,
        "generatedBy": "tools/scenes/prepare.py",
        "transition": {"id": "arpa", "file": transition},
        "scenes": published,
    }
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    # Remove outputs that no longer belong to a scene.
    for existing in out_dir.rglob("*"):
        if existing.is_file() and existing.name != "manifest.json" and existing not in expected:
            existing.unlink()
            print(f"Removed stale {existing.relative_to(out_dir)}")
    for directory in sorted(out_dir.rglob("*"), reverse=True):
        if directory.is_dir() and not any(directory.iterdir()):
            directory.rmdir()

    print(f"\nPublished {len(published)} scenes in {out_dir.relative_to(ROOT)}")
    print(f"Manifest: {(out_dir / 'manifest.json').relative_to(ROOT)}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--scenes", type=Path, default=DEFAULT_SCENES, help="source scenes.json")
    parser.add_argument("--data-manifest", type=Path, default=DEFAULT_DATA_MANIFEST, help="prepared data manifest with the Amazon bbox")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="folder published by the web app")
    args = parser.parse_args()
    return prepare(args.scenes.resolve(), args.data_manifest.resolve(), args.out.resolve())


if __name__ == "__main__":
    raise SystemExit(main())
