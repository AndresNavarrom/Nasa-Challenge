import argparse
import json
import os
import sys
import time
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse, unquote

import requests

SVS_SEARCH_URL = "https://svs.gsfc.nasa.gov/api/search/"
GISTEMP_URL = "https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv"
GEOS_BASE_URL = "https://portal.nccs.nasa.gov/datashare/gmao/geos-fp/"

OUTPUT_DIR = "resources"
MANIFEST_FILE = "manifest.json"
GEOS_DEST = os.path.join(OUTPUT_DIR, "data", "geos_fp")

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "earth-jukebox-scraper/1.0"})


def setup_dirs():
    os.makedirs(os.path.join(OUTPUT_DIR, "visuals"), exist_ok=True)
    os.makedirs(os.path.join(OUTPUT_DIR, "data"), exist_ok=True)
    os.makedirs(GEOS_DEST, exist_ok=True)


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag != "a":
            return
        for attr, value in attrs:
            if attr == "href" and value:
                self.links.append(value)


def list_dir(url):
    """Return (subdir_urls, file_urls) for a directory index page."""
    resp = SESSION.get(url, timeout=60)
    resp.raise_for_status()

    parser = LinkParser()
    parser.feed(resp.text)

    base_path = urlparse(url).path.rstrip("/") + "/"
    dirs, files = [], []

    for href in parser.links:
        # Only follow plain relative links: no queries, anchors, mailto,
        # absolute URLs, or parent traversal.
        if href.startswith(("?", "#", "mailto:", "javascript:")):
            continue
        if href.startswith("/") or "://" in href:
            continue
        if ".." in href:
            continue

        full = urljoin(url, href)
        parsed = urlparse(full)
        if parsed.netloc != urlparse(url).netloc:
            continue
        # Containment check: must stay strictly below this directory.
        if not parsed.path.startswith(base_path):
            continue

        (dirs if parsed.path.endswith("/") else files).append(full)

    return dirs, files


def remote_size(url):
    try:
        resp = SESSION.head(url, timeout=60, allow_redirects=True)
        length = resp.headers.get("Content-Length")
        return int(length) if length else None
    except Exception:
        return None


def download_file(url, dest_path, limit_bytes=None, retries=5):
    if os.path.exists(dest_path):
        return dest_path, os.path.getsize(dest_path), True

    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    tmp = dest_path + ".part"

    for attempt in range(1, retries + 1):
        have = os.path.getsize(tmp) if os.path.exists(tmp) else 0
        headers = {"Range": f"bytes={have}-"} if have else {}
        mode = "ab" if have else "wb"
        try:
            with SESSION.get(
                url, stream=True, timeout=(15, 180), headers=headers
            ) as resp:
                if have and resp.status_code == 416:
                    os.replace(tmp, dest_path)
                    return dest_path, have, False
                resp.raise_for_status()
                if have and resp.status_code != 206:
                    have, mode = 0, "wb"
                total = have
                with open(tmp, mode) as fh:
                    for chunk in resp.iter_content(chunk_size=1 << 20):
                        if not chunk:
                            continue
                        total += len(chunk)
                        if limit_bytes is not None and total > limit_bytes:
                            raise RuntimeError(
                                f"size cap exceeded while reading {url}"
                            )
                        fh.write(chunk)
            os.replace(tmp, dest_path)
            return dest_path, total, False
        except RuntimeError:
            if os.path.exists(tmp):
                os.remove(tmp)
            raise
        except Exception as exc:
            size = os.path.getsize(tmp) if os.path.exists(tmp) else 0
            print(
                f"[warn] {os.path.basename(dest_path)} attempt {attempt}/{retries} "
                f"failed at {size} bytes: {exc}",
                file=sys.stderr,
            )
            if attempt == retries:
                raise
            time.sleep(min(2 ** attempt, 15))


def walk_geos(start_url, dest_root, exts, max_files, max_bytes, dry_run):
    """Iterative crawler bounded to start_url. Never escapes the root."""
    visited = set()
    stack = [(start_url, "")]
    downloaded = []
    total_bytes = 0

    while stack:
        url, rel_dir = stack.pop()
        if url in visited:
            continue
        visited.add(url)

        try:
            subdirs, files = list_dir(url)
        except Exception as exc:
            print(f"[warn] cannot list {url}: {exc}", file=sys.stderr)
            continue

        for f in files:
            if exts and not f.lower().endswith(exts):
                continue
            if max_files and len(downloaded) >= max_files:
                print(f"[stop] file cap of {max_files} reached")
                return downloaded, total_bytes

            name = unquote(urlparse(f).path.rsplit("/", 1)[-1])
            dest_path = os.path.join(dest_root, rel_dir, name)

            if dry_run:
                print(f"[dry-run] {f} -> {dest_path}")
                downloaded.append({"url": f, "path": dest_path, "bytes": 0})
                continue

            remaining = None if max_bytes is None else max_bytes - total_bytes
            if remaining is not None and remaining <= 0:
                print(f"[stop] byte cap of {max_bytes} reached")
                return downloaded, total_bytes

            if remaining is not None:
                size = remote_size(f)
                if size is not None and size > remaining:
                    print(
                        f"[stop] next file needs {size} bytes, "
                        f"only {remaining} left under the {max_bytes} byte cap"
                    )
                    return downloaded, total_bytes

            try:
                print(f"[get] {name}")
                path, size, cached = download_file(f, dest_path, remaining)
                total_bytes += size
                downloaded.append(
                    {"url": f, "path": path, "bytes": size, "cached": cached}
                )
            except Exception as exc:
                print(f"[warn] failed {f}: {exc}", file=sys.stderr)

        for d in subdirs:
            tail = urlparse(d).path[len(urlparse(url).path):].strip("/")
            stack.append((d, os.path.join(rel_dir, unquote(tail))))

    return downloaded, total_bytes


def fetch_svs_visuals(query, limit=3):
    print(f"[svs] searching for: {query}")
    resp = SESSION.get(
        SVS_SEARCH_URL, params={"search": query, "limit": limit}, timeout=60
    )
    resp.raise_for_status()

    out = []
    for item in resp.json().get("results", []):
        item_id = item["id"]
        detail_url = f"https://svs.gsfc.nasa.gov/api/{item_id}"
        print(f"[svs] {item_id}: {item['title']}")
        detail = SESSION.get(detail_url, timeout=60)
        out.append(
            {
                "id": item_id,
                "title": item["title"],
                "detail_url": detail_url,
                "media": detail.json().get("media", []) if detail.ok else [],
            }
        )
    return out


def fetch_gistemp():
    print("[gistemp] downloading global temperature anomalies")
    resp = SESSION.get(GISTEMP_URL, timeout=60)
    resp.raise_for_status()
    path = os.path.join(OUTPUT_DIR, "data", "gistemp_global.csv")
    with open(path, "wb") as fh:
        fh.write(resp.content)
    return path


def main():
    ap = argparse.ArgumentParser(description="Collect Earth Jukebox resources")
    ap.add_argument("--svs-query", default="sea surface temperature")
    ap.add_argument("--no-svs", action="store_true")
    ap.add_argument("--no-gistemp", action="store_true")
    ap.add_argument(
        "--geos-start",
        default="forecast/",
        help="path under geos-fp/ to crawl, e.g. 'das/Y2026/M01/D01' "
        "or 'forecast/'. Empty string crawls the whole archive.",
    )
    ap.add_argument(
        "--geos-ext",
        default=".nc4",
        help="comma separated extensions to keep (default .nc4, '' = all)",
    )
    ap.add_argument(
        "--max-files",
        type=int,
        default=25,
        help="stop after N files (0 = no limit)",
    )
    ap.add_argument(
        "--max-gb",
        type=float,
        default=5.0,
        help="stop after N GB (0 = no limit)",
    )
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    setup_dirs()

    visuals = [] if args.no_svs else fetch_svs_visuals(args.svs_query)
    gistemp_path = None if args.no_gistemp else fetch_gistemp()

    start_url = urljoin(GEOS_BASE_URL, args.geos_start)
    if not start_url.startswith(GEOS_BASE_URL):
        ap.error("--geos-start must stay inside the geos-fp archive")

    exts = tuple(e.strip().lower() for e in args.geos_ext.split(",") if e.strip())
    max_files = args.max_files or 0
    max_bytes = int(args.max_gb * (1 << 30)) if args.max_gb else None

    geos_files, geos_bytes = walk_geos(
        start_url, GEOS_DEST, exts, max_files, max_bytes, args.dry_run
    )

    manifest = {
        "visuals": visuals,
        "global_data": {
            "gistemp": {"name": "GISTEMP v4", "path": gistemp_path},
            "geos": {
                "name": "GEOS Forward Processing",
                "start_url": start_url,
                "root": GEOS_DEST,
                "total_bytes": geos_bytes,
                "files": geos_files,
            },
        },
    }
    with open(os.path.join(OUTPUT_DIR, MANIFEST_FILE), "w") as fh:
        json.dump(manifest, fh, indent=2)

    print(
        f"\n[done] {len(geos_files)} GEOS file(s), "
        f"{geos_bytes / (1 << 20):.1f} MiB -> {OUTPUT_DIR}/{MANIFEST_FILE}"
    )


if __name__ == "__main__":
    main()
