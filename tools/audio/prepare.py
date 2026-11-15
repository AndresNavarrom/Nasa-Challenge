#!/usr/bin/env python3
"""Prepare the team's audio library for the web app.

Every ``.wav`` in ``data/audio/source/`` (the original downloads, not versioned)
becomes an Ogg Vorbis file at 48 kHz under ``web/public/audio/samples/``. The
script also rewrites ``web/public/audio/manifest.json`` with one entry per sound.

The final per-sound metadata (role, loop, gain, credit) is not known yet, so those
fields stay ``null``. The manifest already gives each sound a stable ``id``, its
prepared file, the original name, measurements and a *suggested* category; the
later metadata can be merged into those entries without renaming anything.

Run it from the repository root through the ``audio-prep`` Docker service, which
has ffmpeg and numpy::

    docker compose run --rm audio-prep

or, on a machine with ffmpeg and Python 3.10+:

    python tools/audio/prepare.py
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
import unicodedata
import wave
from pathlib import Path

try:  # numpy is in the fetch image; the fallback keeps the script portable.
    import numpy as np
except ImportError:  # pragma: no cover - exercised only outside the Docker image
    np = None

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = ROOT / "data" / "audio" / "source"
DEFAULT_OUT = ROOT / "web" / "public" / "audio" / "samples"
DEFAULT_MANIFEST = ROOT / "web" / "public" / "audio" / "manifest.json"
DEFAULT_SAMPLE_RATE = 48000
DEFAULT_QUALITY = 5


def slugify(name: str) -> str:
    """Lowercase ASCII slug: no spaces, accents, commas or repeated dashes."""
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_name).strip("-").lower()
    return slug or "sound"


def suggest_category(original: str) -> str:
    """A first guess for the later metadata; not a final role."""
    name = slugify(Path(original).stem)
    if name in {"ro"} or name.startswith(("fui", "fuiii", "wua", "wuwuw", "pi-pi", "run-run", "movil")):
        return "ui"
    if name == "3-2-1-0":
        return "ui"
    if any(key in name for key in ("rayo", "tormenta", "tormeta", "trueno", "explosion")):
        return "lightning"
    if any(key in name for key in ("quemado", "fuego", "aire-denso", "rfa-pequena-aire")):
        return "smoke"
    if any(key in name for key in ("tambor", "pimpum", "alarma")):
        return "percussion"
    if any(key in name for key in ("arpa", "guitrra", "guitarra", "melodia", "mimi", "miii")):
        return "music"
    if any(key in name for key in ("hubble", "groar", "gruar", "guugug", "guguguro", "mumu")):
        return "atmosphere"
    if any(key in name for key in ("pajaro", "oajaro", "bicho", "grillo", "rio", "viento", "vineto")):
        return "forest"
    if "aire" in name:
        return "co2"
    return "unknown"


def display_path(path: Path) -> str:
    """Repository-relative path for messages, or the absolute path if outside."""
    try:
        return str(path.relative_to(ROOT)).replace("\\", "/")
    except ValueError:
        return str(path)


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def measure(path: Path) -> dict:
    """Duration, sample rate, channels and level measurements of a PCM WAV."""
    with wave.open(str(path), "rb") as sound:
        channels = sound.getnchannels()
        sample_width = sound.getsampwidth()
        sample_rate = sound.getframerate()
        frame_count = sound.getnframes()

        peak = None
        rms = None
        if sample_width == 2:
            peak_value = 0
            sum_squares = 0.0
            count = 0
            while True:
                chunk = sound.readframes(1 << 20)
                if not chunk:
                    break
                if np is not None:
                    samples = np.frombuffer(chunk, dtype="<i2")
                    peak_value = max(peak_value, int(np.abs(samples.astype(np.int32)).max()))
                    wide = samples.astype(np.float64)
                    sum_squares += float(np.dot(wide, wide))
                    count += int(samples.size)
                else:  # pragma: no cover
                    import array

                    samples = array.array("h")
                    samples.frombytes(chunk)
                    if sys.byteorder == "big":
                        samples.byteswap()
                    for sample in samples:
                        value = -sample if sample < 0 else sample
                        if value > peak_value:
                            peak_value = value
                        sum_squares += float(sample) * float(sample)
                    count += len(samples)
            if count:
                peak = peak_value / 32768.0
                rms = math.sqrt(sum_squares / count) / 32768.0

    duration = frame_count / sample_rate if sample_rate else 0.0

    def dbfs(value: float | None) -> float | None:
        if value is None or value <= 0:
            return None
        return round(20 * math.log10(value), 1)

    return {
        "durationSeconds": round(duration, 3),
        "sourceSampleRate": sample_rate,
        "channels": channels,
        "sourceBitsPerSample": sample_width * 8,
        "peakDbfs": dbfs(peak),
        "rmsDbfs": dbfs(rms),
        "clipped": peak is not None and peak >= 0.999,
    }


def convert(source: Path, destination: Path, sample_rate: int, quality: int) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    command = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(source),
        "-vn",
        "-map_metadata",
        "-1",
        "-ar",
        str(sample_rate),
        "-c:a",
        "libvorbis",
        "-q:a",
        str(quality),
        str(destination),
    ]
    subprocess.run(command, check=True)


def prepare(source_dir: Path, out_dir: Path, manifest_path: Path, sample_rate: int, quality: int) -> int:
    if shutil.which("ffmpeg") is None:
        raise SystemExit("ffmpeg is not installed. Use `docker compose run --rm audio-prep`.")
    if not source_dir.is_dir():
        raise SystemExit(f"Audio source folder not found: {source_dir}")

    sources = sorted(path for path in source_dir.rglob("*") if path.suffix.lower() == ".wav")
    if not sources:
        raise SystemExit(f"No .wav files found in {source_dir}")

    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)

    previous: dict[str, dict] = {}
    if manifest_path.is_file():
        try:
            old = json.loads(manifest_path.read_text(encoding="utf-8"))
            previous = {item["original"]: item for item in old.get("samples", []) if item.get("original")}
        except (OSError, ValueError, TypeError):
            previous = {}

    used_ids: set[str] = set()
    samples: list[dict] = []
    failures: list[str] = []

    for index, source in enumerate(sources, start=1):
        source_hash = sha256_of(source)
        prior = previous.get(source.name)
        if prior and prior.get("sourceSha256") == source_hash:
            prior_file = Path(str(prior.get("file", ""))).name
            prior_destination = out_dir / prior_file
            if prior_file and prior_destination.is_file():
                sound_id = str(prior.get("id") or slugify(source.stem))
                used_ids.add(sound_id)
                print(f"[{index}/{len(sources)}] {source.name} -> {prior_file} (unchanged)", flush=True)
                reused = {
                    **prior,
                    "id": sound_id,
                    "file": f"samples/{prior_file}",
                    "original": source.name,
                    "bytes": prior_destination.stat().st_size,
                    "sourceSampleRate": prior.get("sourceSampleRate", prior.get("sampleRate", sample_rate)),
                    "sourceBitsPerSample": prior.get("sourceBitsPerSample", prior.get("bitsPerSample", 16)),
                    "sampleRate": sample_rate,
                    "sourceSha256": source_hash,
                    "suggestedCategory": suggest_category(source.name),
                }
                reused.pop("bitsPerSample", None)
                samples.append(reused)
                continue

        base_id = slugify(source.stem)
        sound_id = base_id
        suffix = 2
        while sound_id in used_ids:
            sound_id = f"{base_id}-{suffix}"
            suffix += 1
        used_ids.add(sound_id)

        destination = out_dir / f"{sound_id}.ogg"
        print(f"[{index}/{len(sources)}] {source.name} -> {destination.name}", flush=True)
        try:
            convert(source, destination, sample_rate, quality)
        except subprocess.CalledProcessError as error:
            failures.append(f"{source.name}: ffmpeg failed ({error.returncode})")
            continue
        except OSError as error:
            failures.append(f"{source.name}: {error}")
            continue

        measurements = measure(source)
        samples.append(
            {
                "id": sound_id,
                "file": f"samples/{destination.name}",
                "original": source.name,
                "bytes": destination.stat().st_size,
                "sampleRate": sample_rate,
                **measurements,
                "sourceSha256": source_hash,
                "suggestedCategory": suggest_category(source.name),
                # Final metadata arrives later. Preserve anything already filled in
                # for a sound whose content changed, so a re-run never loses it.
                "category": prior.get("category") if prior else None,
                "role": prior.get("role") if prior else None,
                "loop": prior.get("loop") if prior else None,
                "gainDb": prior.get("gainDb") if prior else None,
                "credit": prior.get("credit") if prior else None,
                "metadata": prior.get("metadata") if prior else None,
            }
        )

    written = {Path(item["file"]).name for item in samples}
    for stale in out_dir.glob("*.ogg"):
        if stale.name not in written:
            stale.unlink()
            print(f"Removed stale {stale.name}", flush=True)

    samples.sort(key=lambda item: item["id"])
    manifest = {
        "version": 1,
        "generatedBy": "tools/audio/prepare.py",
        "source": display_path(source_dir),
        "audioBase": "samples/",
        "metadataStatus": "pending",
        "samples": samples,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    total_bytes = sum(item["bytes"] for item in samples)
    clipped = [item["original"] for item in samples if item["clipped"]]
    unknown = [item["original"] for item in samples if item["suggestedCategory"] == "unknown"]
    print(
        f"\nPrepared {len(samples)}/{len(sources)} sounds in {display_path(out_dir)} "
        f"({total_bytes / 1e6:.1f} MB)."
    )
    print(f"Manifest: {display_path(manifest_path)}")
    if clipped:
        print(f"Clipped sources (kept as-is; replace or re-master later): {', '.join(clipped)}")
    if unknown:
        unknown_text = ", ".join(unknown)
        print(f"Category still unknown: {unknown_text}")
    if failures:
        for failure in failures:
            print(f"ERROR: {failure}", file=sys.stderr)
        return 1
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="folder with the original .wav files")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="folder for the prepared .ogg files")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST, help="path of the JSON manifest")
    parser.add_argument("--sample-rate", type=int, default=DEFAULT_SAMPLE_RATE, help="output sample rate in Hz")
    parser.add_argument(
        "--quality",
        type=int,
        default=DEFAULT_QUALITY,
        help="Ogg Vorbis quality, -1..10 (higher is bigger and better)",
    )
    args = parser.parse_args()
    return prepare(args.source.resolve(), args.out.resolve(), args.manifest.resolve(), args.sample_rate, args.quality)


if __name__ == "__main__":
    raise SystemExit(main())
