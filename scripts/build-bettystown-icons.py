#!/usr/bin/env python3
"""Generate artistic OG preview + iOS icons for Mom's Bettystown Weather."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "sites" / "bettystown"
OG_OUT = ROOT / "assets" / "og" / "bettystown-weather.png"

# Coastal palette — bright, warm, professional
SKY_TOP = (255, 248, 230)
SKY_MID = (186, 230, 253)
SKY_LOW = (125, 211, 252)
SEA_DEEP = (2, 62, 138)
SEA_MID = (0, 119, 182)
SEA_LIGHT = (72, 202, 228)
SAND = (255, 236, 179)
SAND_SHADOW = (245, 208, 140)
SUN_CORE = (255, 209, 102)
SUN_GLOW = (255, 183, 3)
CORAL = (255, 107, 107)
MINT = (6, 214, 160)
MINT_SOFT = (168, 230, 207)
INK = (13, 33, 55)
WHITE = (255, 255, 255)


def font(size: int, bold: bool = False, serif: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = []
    if serif:
        candidates += [
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
        ]
    if bold:
        candidates += [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        ]
    candidates += [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
    ]
    for name in candidates:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def lerp_rgb(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return (int(lerp(c1[0], c2[0], t)), int(lerp(c1[1], c2[1], t)), int(lerp(c1[2], c2[2], t)))


def vertical_gradient(w: int, h: int, stops: list[tuple[float, tuple[int, int, int]]]) -> Image.Image:
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        for i in range(len(stops) - 1):
            p0, c0 = stops[i]
            p1, c1 = stops[i + 1]
            if p0 <= t <= p1:
                local = (t - p0) / max(p1 - p0, 1e-6)
                col = lerp_rgb(c0, c1, local)
                break
        else:
            col = stops[-1][1]
        for x in range(w):
            px[x, y] = col
    return img


def radial_glow(w: int, h: int, cx: int, cy: int, radius: int, color: tuple[int, int, int], alpha: int) -> Image.Image:
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for r in range(radius, 0, -max(1, radius // 12)):
        a = int(alpha * (1 - r / radius) ** 1.8)
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color + (a,))
    return layer.filter(ImageFilter.GaussianBlur(radius // 8))


def draw_sun_with_rays(base: Image.Image, cx: int, cy: int, r: int) -> None:
    w, h = base.size
    rays = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(rays)
    for i in range(14):
        ang = i * (360 / 14)
        rad = math.radians(ang)
        x2 = cx + math.cos(rad) * (r * 2.2)
        y2 = cy + math.sin(rad) * (r * 2.2)
        draw.line([(cx, cy), (x2, y2)], fill=SUN_GLOW + (55,), width=max(3, r // 10))
    base.alpha_composite(rays.filter(ImageFilter.GaussianBlur(2)))
    glow = radial_glow(w, h, cx, cy, r * 3, SUN_GLOW, 120)
    base.alpha_composite(glow)
    disc = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(disc)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=SUN_CORE + (255,))
    d.ellipse((cx - r * 0.55, cy - r * 0.55, cx + r * 0.55, cy + r * 0.55), fill=WHITE + (180,))
    base.alpha_composite(disc)


def draw_stylized_clouds(base: Image.Image, specs: list[tuple[int, int, int]]) -> None:
    w, h = base.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for cx, cy, scale in specs:
        for dx, dy, rx, ry in [(-scale, 0, scale, scale * 0.7), (0, -scale * 0.2, scale * 1.1, scale * 0.8), (scale, 0, scale * 0.9, scale * 0.65)]:
            draw.ellipse((cx + dx - rx, cy + dy - ry, cx + dx + rx, cy + dy + ry), fill=WHITE + (235,))
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(max(1, specs[0][2] // 20))))


def draw_ocean_bands(base: Image.Image, top_y: int) -> None:
    w, h = base.size
    sea = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(sea)
    draw.rectangle((0, top_y, w, h), fill=SEA_MID + (255,))
    for i, col in enumerate([SEA_LIGHT, SEA_MID, SEA_DEEP]):
        y0 = top_y + i * ((h - top_y) // 3)
        y1 = top_y + (i + 1) * ((h - top_y) // 3)
        draw.rectangle((0, y0, w, y1), fill=col + (255,))
    for y in range(top_y, h, 18):
        amp = 8 + (y % 36) // 6
        for x in range(-40, w + 40, 38):
            draw.arc((x, y - amp, x + 76, y + amp), 180, 360, fill=WHITE + (35,), width=2)
    base.alpha_composite(sea)


def draw_sand_dune(base: Image.Image, top_y: int) -> None:
    w, h = base.size
    sand = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(sand)
    points = [(0, h), (0, top_y + 40), (w * 0.18, top_y), (w * 0.42, top_y + 28), (w * 0.68, top_y - 8), (w, top_y + 35), (w, h)]
    draw.polygon(points, fill=SAND + (255,))
    draw.polygon([(0, h), (0, top_y + 55), (w * 0.5, top_y + 45), (w, top_y + 60), (w, h)], fill=SAND_SHADOW + (90,))
    base.alpha_composite(sand)


def draw_paw_print(draw: ImageDraw.ImageDraw, cx: int, cy: int, scale: float, fill: tuple[int, int, int, int]) -> None:
    pads = [(0, 0, 1.0), (-0.9, -1.1, 0.55), (0.9, -1.1, 0.55), (-1.2, -2.0, 0.5), (1.2, -2.0, 0.5)]
    s = 10 * scale
    for ox, oy, m in pads:
        r = s * m
        draw.ellipse((cx + ox * s - r, cy + oy * s - r, cx + ox * s + r, cy + oy * s + r), fill=fill)


def draw_dog_silhouette(base: Image.Image, cx: int, cy: int, scale: float = 1.0) -> None:
    w, h = base.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    s = scale
    # Simple golden retriever-ish silhouette facing right
    body = [(cx - 40 * s, cy + 10 * s), (cx + 55 * s, cy + 8 * s), (cx + 70 * s, cy + 22 * s), (cx + 45 * s, cy + 38 * s), (cx - 35 * s, cy + 35 * s)]
    draw.polygon(body, fill=INK + (220,))
    draw.ellipse((cx + 58 * s, cy - 8 * s, cx + 92 * s, cy + 18 * s), fill=INK + (220,))
    draw.polygon([(cx + 88 * s, cy - 2 * s), (cx + 105 * s, cy + 5 * s), (cx + 92 * s, cy + 12 * s)], fill=INK + (220,))
    draw.ellipse((cx + 72 * s, cy + 28 * s, cx + 82 * s, cy + 38 * s), fill=CORAL + (255,))
    draw.ellipse((cx - 18 * s, cy - 28 * s, cx + 8 * s, cy - 8 * s), fill=INK + (220,))
    draw.ellipse((cx + 8 * s, cy - 30 * s, cx + 34 * s, cy - 10 * s), fill=INK + (220,))
    for lx, ly in [(cx - 20 * s, cy + 38 * s), (cx + 5 * s, cy + 40 * s), (cx + 30 * s, cy + 38 * s), (cx + 52 * s, cy + 36 * s)]:
        draw.ellipse((lx - 5 * s, ly - 8 * s, lx + 5 * s, ly + 2 * s), fill=INK + (220,))
    base.alpha_composite(layer)


def draw_glass_card(base: Image.Image, box: tuple[int, int, int, int], radius: int = 28) -> None:
    w, h = base.size
    x0, y0, x1, y1 = box
    card = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle(box, radius=radius, fill=WHITE + (215,))
    draw.rounded_rectangle((x0 + 2, y0 + 2, x1 - 2, y1 - 2), radius=radius - 2, outline=WHITE + (120,), width=2)
    base.alpha_composite(card.filter(ImageFilter.GaussianBlur(0.5)))


def draw_icon_square(size: int) -> Image.Image:
    img = vertical_gradient(size, size, [(0, SKY_TOP), (0.45, SKY_MID), (0.75, SKY_LOW), (1.0, SEA_LIGHT)]).convert("RGBA")
    draw_sun_with_rays(img, int(size * 0.78), int(size * 0.24), int(size * 0.11))
    draw_stylized_clouds(img, [(int(size * 0.22), int(size * 0.18), int(size * 0.08)), (int(size * 0.55), int(size * 0.12), int(size * 0.06))])
    draw_ocean_bands(img, int(size * 0.62))
    draw_sand_dune(img, int(size * 0.58))

    draw_dog_silhouette(img, int(size * 0.56), int(size * 0.72), size / 420)

    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    draw_paw_print(d, int(size * 0.28), int(size * 0.78), size / 220, CORAL + (200,))
    draw_paw_print(d, int(size * 0.36), int(size * 0.73), size / 260, CORAL + (160,))
    img.alpha_composite(layer)

    badge = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bd = ImageDraw.Draw(badge)
    pad = int(size * 0.08)
    bd.rounded_rectangle((pad, pad, size - pad, pad + int(size * 0.16)), radius=int(size * 0.05), fill=WHITE + (230,))
    f = font(max(11, int(size * 0.075)), bold=True)
    label = "Mom's"
    tw = bd.textlength(label, font=f)
    bd.text(((size - tw) / 2, pad + int(size * 0.02)), label, fill=SEA_DEEP + (255,), font=f)
    img.alpha_composite(badge)
    return img


def draw_og_preview() -> Image.Image:
    w, h = 1200, 630
    img = vertical_gradient(w, h, [(0, SKY_TOP), (0.35, SKY_MID), (0.62, SKY_LOW), (1.0, SEA_DEEP)]).convert("RGBA")

    draw_sun_with_rays(img, 980, 95, 78)
    draw_stylized_clouds(img, [(180, 70, 52), (420, 45, 38), (720, 85, 44), (1040, 120, 32)])
    draw_ocean_bands(img, 390)
    draw_sand_dune(img, 360)
    draw_dog_silhouette(img, 920, 470, 1.15)

    # Paw trail in sand
    trail = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    td = ImageDraw.Draw(trail)
    for i, (x, y, sc) in enumerate([(280, 520, 1.1), (350, 505, 1.0), (420, 492, 0.95), (490, 478, 0.9)]):
        draw_paw_print(td, x, y, sc * 2.2, CORAL + (140 - i * 20,))
    img.alpha_composite(trail)

    draw_glass_card(img, (52, 52, 760, 340), radius=32)

    draw = ImageDraw.Draw(img)
    title_f = font(58, bold=True, serif=True)
    sub_f = font(30, bold=True)
    small_f = font(24)

    draw.text((88, 88), "Mom's Bettystown Weather", fill=INK + (255,), font=title_f)
    draw.text((88, 162), "Warm, dry beach days for Mom & Max", fill=SEA_MID + (255,), font=sub_f)

    pill_y = 218
    draw.rounded_rectangle((88, pill_y, 430, pill_y + 44), radius=22, fill=MINT_SOFT + (255,))
    draw.text((108, pill_y + 8), "14-day forecast  ·  dog-friendly scores", fill=SEA_DEEP + (255,), font=small_f)

    cards = [(88, 280, "Sun 20 Sept", "84", "Perfect for Max", MINT), (388, 280, "Mon 21 Sept", "75", "Great walk", SUN_GLOW), (688, 280, "Wed 23 Sept", "86", "Best warmth", CORAL)]
    for x, y, day, score, tag, accent in cards:
        draw.rounded_rectangle((x, y, x + 250, y + 118), radius=20, fill=WHITE + (240,), outline=accent + (200,), width=3)
        draw.text((x + 18, y + 14), day, fill=INK + (255,), font=font(24, bold=True))
        draw.rounded_rectangle((x + 18, y + 52, x + 18 + 72, y + 84), radius=14, fill=accent + (255,))
        draw.text((x + 28, y + 58), score, fill=WHITE + (255,), font=font(22, bold=True))
        draw.text((x + 98, y + 58), tag, fill=SEA_DEEP + (255,), font=font(20, bold=True))
        draw.text((x + 18, y + 92), "Bettystown Beach · County Meath", fill=INK + (150,), font=font(17))

    draw.rounded_rectangle((52, h - 52, 340, h - 18), radius=16, fill=INK + (180,))
    draw.text((68, h - 44), "tgollogly.dev/bettystown", fill=WHITE + (255,), font=font(20, bold=True))
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "icons").mkdir(exist_ok=True)
    og = draw_og_preview().convert("RGB")
    og.save(OUT / "og-preview.png", optimize=True)
    OG_OUT.parent.mkdir(parents=True, exist_ok=True)
    og.save(OG_OUT, optimize=True)
    draw_icon_square(180).convert("RGB").save(OUT / "apple-touch-icon.png", optimize=True)
    draw_icon_square(192).convert("RGB").save(OUT / "icons" / "icon-192.png", optimize=True)
    draw_icon_square(512).convert("RGB").save(OUT / "icons" / "icon-512.png", optimize=True)
    draw_icon_square(32).convert("RGB").save(OUT / "favicon-32.png", optimize=True)
    print("Wrote artistic Bettystown icons to", OUT)


if __name__ == "__main__":
    main()
