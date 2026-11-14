import argparse
import os
import re
import time
from urllib.parse import urljoin, unquote

import numpy as np
import requests
import xarray as xr

GEOS_BASE = "https://portal.nccs.nasa.gov/datashare/gmao/geos-fp/"
OUT_ROOT = "resources/data/geos_fp"

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "earth-jukebox-scraper/1.0"})

HREF_RE = re.compile(r'href="([^"?][^"]*)"')


def list_files(url):
    resp = SESSION.get(url, timeout=60)
    resp.raise_for_status()
    out = []
    for href in HREF_RE.findall(resp.text):
        if href.startswith(("/", "http", "mailto:", "javascript:")) or ".." in href:
            continue
        if href.endswith("/"):
            continue
        out.append(href)
    return out


def download(url, path, retries=5):
    if os.path.exists(path):
        print(f"[skip] {os.path.basename(path)}")
        return path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".part"

    for attempt in range(1, retries + 1):
        have = os.path.getsize(tmp) if os.path.exists(tmp) else 0
        headers = {"Range": f"bytes={have}-"} if have else {}
        mode = "ab" if have else "wb"
        try:
            with SESSION.get(
                url, stream=True, timeout=(15, 180), headers=headers
            ) as resp:
                if have and resp.status_code == 416:
                    os.replace(tmp, path)
                    print(f"[get] {os.path.basename(path)} (already complete)")
                    return path
                resp.raise_for_status()
                if have and resp.status_code != 206:
                    have, mode = 0, "wb"
                with open(tmp, mode) as fh:
                    for chunk in resp.iter_content(chunk_size=1 << 20):
                        if chunk:
                            fh.write(chunk)
            os.replace(tmp, path)
            print(f"[get] {os.path.basename(path)}")
            return path
        except Exception as exc:
            size = os.path.getsize(tmp) if os.path.exists(tmp) else 0
            print(
                f"[warn] {os.path.basename(path)} attempt {attempt}/{retries} "
                f"failed at {size} bytes: {exc}"
            )
            if attempt == retries:
                raise
            time.sleep(min(2 ** attempt, 15))


def main():
    ap = argparse.ArgumentParser(description="Fetch one GEOS-FP variable for one day")
    ap.add_argument("--date", required=True, help="YYYY-MM-DD (analysis date)")
    ap.add_argument(
        "--group",
        default="inst1_2d_lfo",
        help="file group, e.g. inst1_2d_lfo / inst1_2d_smp / inst3_2d_asm",
    )
    ap.add_argument("--variable", default="TLML", help="variable name to extract")
    ap.add_argument("--out", default=OUT_ROOT)
    args = ap.parse_args()

    year, month, day = args.date.split("-")
    day_dir = f"{args.out}/{args.date}"
    raw_dir = f"{day_dir}/raw"
    os.makedirs(raw_dir, exist_ok=True)

    url = urljoin(GEOS_BASE, f"das/Y{year}/M{month}/D{day}/")
    print(f"[list] {url}")
    files = [f for f in list_files(url) if args.group in f and f.endswith(".nc4")]
    files.sort()
    if not files:
        raise SystemExit(f"no '{args.group}' files found for {args.date}")
    print(f"[info] {len(files)} file(s) for {args.group}")

    paths = []
    for name in files:
        paths.append(download(urljoin(url, name), os.path.join(raw_dir, unquote(name))))

    print(f"[extract] variable {args.variable}")
    parts = []
    for p in paths:
        ds = xr.open_dataset(p)
        if args.variable not in ds:
            raise SystemExit(
                f"{args.variable} not in {p} (available: {list(ds.data_vars)})"
            )
        parts.append(ds[[args.variable]].load())
        ds.close()

    combined = xr.concat(parts, dim="time").sortby("time")
    out_nc = f"{day_dir}/{args.variable}_{args.date}.nc4"
    combined.to_netcdf(out_nc, engine="netcdf4", encoding={args.variable: {"zlib": True, "complevel": 4}})
    print(f"[write] {out_nc}  dims={dict(combined.sizes)}")

    weights = np.cos(np.deg2rad(combined["lat"]))
    da = combined[args.variable]
    ts = da.weighted(weights).mean(dim=("lat", "lon")).to_pandas()
    unit = re.sub(r"[^A-Za-z0-9]+", "_", da.attrs.get("units", "")).strip("_")
    col = f"global_mean_{unit}" if unit else "global_mean"
    out_csv = f"{day_dir}/{args.variable}_{args.date}_global_mean.csv"
    ts.rename(col).to_csv(out_csv, header=True, index_label="time")
    print(f"[write] {out_csv}  (area-weighted)")


if __name__ == "__main__":
    main()
