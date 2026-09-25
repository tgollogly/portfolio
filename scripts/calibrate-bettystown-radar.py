#!/usr/bin/env python3
"""Overlay OSM on Met Éireann radar to calibrate MET_RADAR_GEO_CALIBRATION (dev only).

Requires: pip install pillow

  python3 scripts/calibrate-bettystown-radar.py [--write-artifact]

Output: suggested leftOffset / topOffset for lib/bettystown-weather.js
"""
from __future__ import annotations

import json
import math
import os
import re
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw

W, H = 850, 680
ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = Path(os.environ.get("RADAR_CAL_OUT", str(ROOT / "artifacts")))

BETTYSTOWN = (53.698, -6.248)
BOUNDS = dict(west=-10.75, east=-3.05, south=51.25, north=55.45)
MET_RADAR_PAGE = "https://www.met.ie/latest-reports/recent-rainfall-radar/12-hour-rainfall-radar"
UA = {"User-Agent": "BettystownWeatherCal/1.0 (tgollogly.dev)"}


def fetch_latest_radar_name() -> str:
    req = urllib.request.Request(MET_RADAR_PAGE, headers=UA)
    html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    files = re.findall(r"web\d{2}_radar\d{2}_\d{12}\.png", html)
    if not files:
        raise SystemExit("no radar frames found")
    return files[-1]


def fetch_tile(z: int, x: int, y: int) -> Image.Image:
    url = f"https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=15) as r:
        return Image.open(r).convert("RGBA")


def build_osm() -> Image.Image:
    z = 7
    lat, lon = BETTYSTOWN
    lat_rad = math.radians(lat)
    n = 2.0**z
    cx = int((lon + 180.0) / 360.0 * n)
    cy = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    xmin, xmax = cx - 4, cx + 4
    ymin, ymax = cy - 4, cy + 4
    mosaic = Image.new("RGBA", ((xmax - xmin + 1) * 256, (ymax - ymin + 1) * 256))
    for tx in range(xmin, xmax + 1):
        for ty in range(ymin, ymax + 1):
            try:
                t = fetch_tile(z, tx, ty)
                mosaic.paste(t, ((tx - xmin) * 256, (ty - ymin) * 256))
            except OSError:
                pass

    def tile_lon(x: int, z: int) -> float:
        n = 2**z
        return x / n * 360.0 - 180.0

    def tile_lat(y: int, z: int) -> float:
        n = 2**z
        return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))

    def merc_y(lat: float) -> float:
        lat_rad = math.radians(lat)
        return math.log(math.tan(lat_rad) + 1 / math.cos(lat_rad))

    def lon_to_merc_x(lon: float) -> float:
        return math.radians(lon)

    tw, th = mosaic.size
    mos_xw = tile_lon(xmin, z)
    mos_xe = tile_lon(xmax + 1, z)

    def map_to_mosaic(lon: float, lat: float) -> tuple[float, float]:
        mx = (lon_to_merc_x(lon) - lon_to_merc_x(mos_xw)) / (lon_to_merc_x(mos_xe) - lon_to_merc_x(mos_xw)) * tw
        my = (merc_y(lat) - merc_y(tile_lat(ymax, z))) / (merc_y(tile_lat(ymin, z)) - merc_y(tile_lat(ymax, z))) * th
        return mx, my

    corners = [
        map_to_mosaic(BOUNDS["west"], BOUNDS["north"]),
        map_to_mosaic(BOUNDS["east"], BOUNDS["north"]),
        map_to_mosaic(BOUNDS["west"], BOUNDS["south"]),
        map_to_mosaic(BOUNDS["east"], BOUNDS["south"]),
    ]
    xs = [c[0] for c in corners]
    ys = [c[1] for c in corners]
    return mosaic.crop((int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys)))).resize((W, H), Image.Resampling.LANCZOS)


def is_water(px: tuple[int, int, int, int]) -> bool:
    r, g, b, _a = px
    return b > 168 and r < 195 and g > 145


def east_coast_score(osm: Image.Image, lp: float, tp: float) -> float:
    x = int(lp / 100 * W)
    y = int(tp / 100 * H)
    x = max(0, min(W - 1, x))
    y = max(0, min(H - 1, y))
    if is_water(osm.getpixel((x, y))):
        return -100
    water_e = sum(1 for dx in range(1, 12) if x + dx < W and is_water(osm.getpixel((x + dx, y))))
    land_w = sum(1 for dx in range(1, 8) if x - dx >= 0 and not is_water(osm.getpixel((x - dx, y))))
    if water_e < 4 or land_w < 2:
        return -50
    return water_e * 5 + land_w * 3


def lat_lon_to_pct(lat: float, lon: float) -> tuple[float, float]:
    lp = (lon - BOUNDS["west"]) / (BOUNDS["east"] - BOUNDS["west"]) * 100
    tp = (BOUNDS["north"] - lat) / (BOUNDS["north"] - BOUNDS["south"]) * 100
    return lp, tp


def main() -> None:
    write_artifact = "--write-artifact" in sys.argv
    name = fetch_latest_radar_name()
    radar_url = f"https://www.met.ie/images/radar/{name}"
    req = urllib.request.Request(radar_url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        radar = Image.open(r).convert("RGBA").resize((W, H))

    osm = build_osm()
    best = (-999.0, 0.0, 0.0)
    for lp_i in range(6180, 6420, 2):
        for tp_i in range(4020, 4180, 2):
            lp, tp = lp_i / 100, tp_i / 100
            sc = east_coast_score(osm, lp, tp)
            if sc > best[0]:
                best = (sc, lp, tp)

    computed = lat_lon_to_pct(*BETTYSTOWN)
    calibration = {
        "leftOffset": round(best[1] - computed[0], 2),
        "topOffset": round(best[2] - computed[1], 2),
    }
    out = {
        "bestPinPct": {"score": best[0], "leftPct": best[1], "topPct": best[2]},
        "computed": {"leftPct": computed[0], "topPct": computed[1]},
        "calibration": calibration,
    }
    print(json.dumps(out, indent=2))

    if write_artifact:
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        osm_a = osm.copy()
        osm_a.putalpha(120)
        blend = Image.alpha_composite(radar, osm_a)
        draw = ImageDraw.Draw(blend)
        x, y = best[1] / 100 * W, best[2] / 100 * H
        draw.ellipse((x - 8, y - 8, x + 8, y + 8), outline=(255, 0, 0, 255), width=3)
        path = OUT_DIR / "radar-osm-calibration.png"
        blend.save(path)
        (OUT_DIR / "radar-calibration.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
        print("Wrote", path, file=sys.stderr)


if __name__ == "__main__":
    main()
