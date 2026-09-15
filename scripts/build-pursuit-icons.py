#!/usr/bin/env python3
"""Generate PWA / iPhone Home Screen icons for The Pursuit quiz game."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "games" / "the-pursuit" / "icons"

BG = (7, 13, 24)
BG2 = (15, 26, 46)
GOLD = (232, 197, 71)
GOLD2 = (245, 223, 122)
CYAN = (78, 205, 196)
RED = (230, 57, 70)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    names = (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
    )
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), BG + (255,))
    draw = ImageDraw.Draw(img)

    for y in range(size):
        t = y / max(size - 1, 1)
        c = (
            lerp(BG[0], BG2[0], t),
            lerp(BG[1], BG2[1], t),
            lerp(BG[2], BG2[2], t),
        )
        draw.line([(0, y), (size, y)], fill=c + (255,))

    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((size * 0.05, size * 0.02, size * 0.95, size * 0.72), fill=GOLD + (28,))
    gd.ellipse((size * 0.55, size * 0.45, size * 1.05, size * 1.05), fill=CYAN + (18,))
    img = Image.alpha_composite(img.convert("RGBA"), glow)

    draw = ImageDraw.Draw(img)
    cx, cy = size // 2, int(size * 0.46)
    r_outer = int(size * 0.34)
    r_mid = int(size * 0.24)
    r_inner = int(size * 0.12)

    for r, w, col in (
        (r_outer, max(2, size // 40), GOLD),
        (r_mid, max(2, size // 50), GOLD2),
        (r_inner, max(2, size // 60), GOLD),
    ):
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=col + (220,), width=w)

    arm = int(size * 0.36)
    aw = max(3, size // 36)
    draw.line([(cx - arm, cy), (cx + arm, cy)], fill=GOLD + (200,), width=aw)
    draw.line([(cx, cy - arm), (cx, cy + arm)], fill=GOLD + (200,), width=aw)
    draw.ellipse((cx - r_inner // 2, cy - r_inner // 2, cx + r_inner // 2, cy + r_inner // 2), fill=GOLD + (255,))

    ps = max(8, int(size * 0.09))
    draw.ellipse((int(size * 0.18) - ps, int(size * 0.72) - ps, int(size * 0.18) + ps, int(size * 0.72) + ps), fill=CYAN + (255,))
    draw.ellipse((int(size * 0.82) - ps, int(size * 0.72) - ps, int(size * 0.82) + ps, int(size * 0.72) + ps), fill=RED + (255,))
    draw.arc(
        (int(size * 0.14), int(size * 0.64), int(size * 0.86), int(size * 0.88)),
        start=200,
        end=-20,
        fill=GOLD + (180,),
        width=max(2, size // 48),
    )

    if size >= 128:
        f = font(max(10, size // 14), bold=True)
        label = "PURSUIT"
        bb = draw.textbbox((0, 0), label, font=f)
        tw = bb[2] - bb[0]
        draw.text((cx - tw // 2 - bb[0], int(size * 0.84)), label, fill=GOLD2 + (230,), font=f)

    img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=80, threshold=2))
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size, name in ((180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png")):
        path = OUT / name
        draw_icon(size).save(path, "PNG", optimize=True)
        print("Wrote", path)


if __name__ == "__main__":
    main()
