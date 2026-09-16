#!/usr/bin/env python3
"""Generate OG preview + iOS/PWA icons for Newry Fuel Watch — fuel icons only."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "sites" / "newry-fuel"
OG_PUBLIC = ROOT / "assets" / "og" / "newry-fuel-watch.png"

BG_TOP = (255, 247, 237)
BG_MID = (254, 243, 199)
BG_LOW = (224, 242, 254)
INK = (15, 23, 42)
SLATE = (30, 41, 59)
ORANGE = (234, 88, 12)
DIESEL_RED = (220, 38, 38)
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
    candidates += ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "DejaVuSans.ttf"]
    for name in candidates:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


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
                col = tuple(int(c0[j] + (c1[j] - c0[j]) * local) for j in range(3))
                break
        else:
            col = stops[-1][1]
        for x in range(w):
            px[x, y] = col
    return img


def draw_icon_badge(
    base: Image.Image,
    cx: int,
    cy: int,
    radius: int,
    emoji: str,
    ring: tuple[int, int, int],
) -> None:
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=WHITE + (250,), outline=ring + (255,), width=6)
    ef = font(int(radius * 1.05))
    tw = draw.textlength(emoji, font=ef)
    draw.text((cx - tw / 2, cy - radius * 0.72), emoji, fill=INK + (255,), font=ef)
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(0)))


def draw_og_preview() -> Image.Image:
    w, h = 1200, 630
    img = vertical_gradient(w, h, [(0, BG_TOP), (0.45, BG_MID), (1.0, BG_LOW)]).convert("RGBA")

    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((120, 80, 520, 480), fill=ORANGE + (30,))
    gd.ellipse((680, 80, 1080, 480), fill=DIESEL_RED + (28,))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(50)))

    draw_icon_badge(img, 360, 290, 118, "🛢️", ORANGE)
    draw_icon_badge(img, 840, 290, 118, "⛽", DIESEL_RED)

    draw = ImageDraw.Draw(img)
    title_f = font(56, bold=True, serif=True)
    sub_f = font(28, bold=True)
    small_f = font(22)
    title = "Newry Fuel Watch"
    tw = draw.textlength(title, font=title_f)
    draw.text(((w - tw) / 2, 430), title, fill=INK + (255,), font=title_f)
    sub = "Heating oil & diesel · BT35"
    sw = draw.textlength(sub, font=sub_f)
    draw.text(((w - sw) / 2, 500), sub, fill=SLATE + (255,), font=sub_f)
    tag = "Live prices · buy · hold · watch alerts"
    tg = draw.textlength(tag, font=small_f)
    draw.text(((w - tg) / 2, 555), tag, fill=SLATE + (180,), font=small_f)
    return img


def draw_icon_square(size: int) -> Image.Image:
    img = vertical_gradient(size, size, [(0, BG_TOP), (0.55, BG_MID), (1.0, BG_LOW)]).convert("RGBA")
    pad = int(size * 0.08)
    mid = size // 2
    r = int(size * 0.22)
    draw_icon_badge(img, mid - int(size * 0.18), mid, r, "🛢️", ORANGE)
    draw_icon_badge(img, mid + int(size * 0.18), mid, r, "⛽", DIESEL_RED)
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "icons").mkdir(exist_ok=True)
    og = draw_og_preview().convert("RGB")
    og.save(OUT / "og-preview.png", optimize=True)
    OG_PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    og.save(OG_PUBLIC, optimize=True)
    draw_icon_square(180).convert("RGB").save(OUT / "apple-touch-icon.png", optimize=True)
    draw_icon_square(192).convert("RGB").save(OUT / "icons" / "icon-192.png", optimize=True)
    draw_icon_square(512).convert("RGB").save(OUT / "icons" / "icon-512.png", optimize=True)
    draw_icon_square(32).convert("RGB").save(OUT / "favicon-32.png", optimize=True)
    print("Wrote Newry Fuel Watch icons to", OUT)


if __name__ == "__main__":
    main()
